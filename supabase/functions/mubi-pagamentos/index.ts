// ============================================================================
// Busca os pagamentos de pessoal no ERP Mubisys (contas a pagar) — Edge Function.
//
// Por que no servidor e não no navegador: o token do Mubisys não pode ir para
// o bundle (qualquer pessoa leria o código da página e teria acesso ao ERP
// inteiro). Aqui ele fica como secret do Supabase e nunca sai daqui.
//
// O que devolve: só o que é FOLHA (plano de contas 2.1.x), já normalizado no
// formato que o RH usa. Quem chama decide o que gravar — esta função não grava
// nada, só lê.
//
// Armadilhas do Mubisys (custaram um dia de trabalho em 2026-07-27):
//  - o header é "Access-Token", não "Authorization: Bearer";
//  - filtrodata/status em MAIÚSCULAS, e datainicial/datafinal são obrigatórios;
//  - SUCESSO vem como HTTP 201 (não 200);
//  - é lento: 25-40s por requisição.
// ============================================================================
import { json, preflight } from "../_shared/cors.ts";
import { decidirPaginacao } from "../_shared/paginacao.ts";
import { codigoDeReferencia, ehConfidencialEquivalente, equivalenciasDeContas, serializar, type ContaRef } from "../_shared/renumeracao.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const MUBI_BASE = Deno.env.get("MUBI_BASE_URL") ?? "https://api.mubisys.com/api";
const MUBI_KEY = Deno.env.get("MUBI_PUBLIC_KEY") ?? "";
const MUBI_TOKEN = Deno.env.get("MUBI_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

/**
 * O plano de contas de referência: o mês mais recente gravado pelo CONTADOR
 * (origem ausente ou "planilha"), com código e nome de cada conta. Só isso —
 * nenhum valor sai daqui. Paginado de 500 em 500 porque o PostgREST corta em
 * 1000 linhas sem avisar.
 */
async function planoDeReferencia(): Promise<{ competencia: string | null; contas: ContaRef[] }> {
  const porMes = new Map<string, ContaRef[]>();
  for (let inicio = 0; ; inicio += 500) {
    const { data, error } = await admin.from("registros").select("registro").eq("colecao", "planoContas").eq("apagado", false).order("id").range(inicio, inicio + 499);
    if (error || !data) break;
    for (const linha of data as { registro: Record<string, unknown> }[]) {
      const r = linha.registro ?? {};
      if (r.origem === "erp") continue;
      const comp = String(r.competencia ?? "");
      const codigo = String(r.codigo ?? "").trim();
      if (!comp || !codigo) continue;
      porMes.set(comp, [...(porMes.get(comp) ?? []), { codigo, nome: String(r.nome ?? "") }]);
    }
    if (data.length < 500) break;
  }
  const competencia = [...porMes.keys()].sort().pop() ?? null;
  return { competencia, contas: competencia ? porMes.get(competencia)! : [] };
}

/* SÓ O ADMIN_RH. Isto aqui devolve a FOLHA INTEIRA do ERP — todo mundo, com
   valor — e aceitava GESTOR, que hoje são três pessoas (Jéssica, Pedro e
   Saulo). As outras duas portas dos MESMOS dados são mais estreitas: a tela é
   restrita ao RH e o `sync` devolve `null` para pagamento de terceiro
   (mascarar, colecao "pagamentos"). Três portas para o mesmo dado, e a mais
   larga era a que ninguém olhava.

   A régua de uma porta de dados não é o cargo de quem lidera equipe; é quem
   pode ver aquele dado. Liderar equipe não é ver a folha dela.
   (Conferência dos 8 sistemas, 16/08/2026.) */
async function ehGestao(req: Request): Promise<boolean> {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const { data, error } = await admin.auth.getUser(m[1]);
  if (error || !data?.user) return false;
  /* `ativo` TAMBEM, e nao so o cargo. A coluna nasceu em 17/08/2026 e o `sync`
     passou a exigi-la no mesmo dia -- estas duas irmas ficaram para tras, e uma
     trava que vale em metade das portas nao e trava: quem fosse desligado
     continuava entrando por aqui com o cargo antigo. */
  const { data: perfil } = await admin.from("perfis")
    .select("perfil, ativo").eq("user_id", data.user.id).maybeSingle();
  return perfil?.perfil === "ADMIN_RH" && perfil?.ativo !== false;
}

// Plano de contas do Mubisys → tipo de pagamento do RH.
//
// O NOME DA CONTA MANDA; O CÓDIGO SÓ DESEMPATA. Cópia fiel de
// src/lib/tipoDoPlano.ts (que tem os testes) — o cliente refaz esta conta ao
// receber as linhas, então o que sai daqui é uma DICA para versões antigas do
// app; a decisão final é do cliente. Mudou lá, muda aqui igual.
//
// Por que (06/09/2026): o contador RENUMEROU as subcontas 2.1.11.x em julho.
// Até junho 2.1.11.1 era Diária; de julho em diante é Comissão interna (.2
// Bônus, .3 Diária, .4 Empreita, .6 Hora Extra, .7 Incentivo de Viagens). A
// tabela só por código continuou lendo o significado antigo e 70 lançamentos
// de jul/ago saíram no tipo errado — comissão de vendedora como "Diária",
// diária como "Limpeza/Faxina", empreita como "Horas Extras". O ERP manda o
// nome na mesma string ("2.1.11.1-Comissão interna"): ler o nome é ler o
// contador, seja qual for o número.
//
// A versão anterior (31/07) já tinha sido escrita por dedução e tinha três
// rótulos trocados; a lição é a mesma: código não é significado.
const normalizar = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// A ORDEM É A REGRA (cópia de src/lib/tipoDoPlano.ts, que tem os testes):
// FGTS/INSS na frente (guia é encargo, "FGTS Rescisório" é FGTS); "Rescisão" e
// "13º" antes de "Férias"/"Salário"; "Férias" antes de "Adiantamento"
// ("Adiantamento de Férias" é férias); "Salário" por último. O `\bamil\b` tem
// fronteira de palavra porque "amil" casa dentro de "família".
const POR_NOME: [RegExp, string][] = [
  [/fgts/, "FGTS"],
  [/inss/, "INSS"],
  [/rescis/, "Rescisão"],
  [/(^|\D)13(\D|$)|decimo ?terceiro/, "13º Salário"],
  [/ferias/, "Férias"],
  [/adiantamento/, "Adiantamento"],
  [/comiss|comercial/, "Comissão"],
  [/bonus/, "Bônus"],
  [/diaria/, "Diária"],
  [/empreita|freela/, "Freelancer (Empreita)"],
  [/faxina|limpeza/, "Limpeza/Faxina"],
  [/horas? ?extras?|plantao/, "Horas Extras"],
  [/produtividade/, "Incentivo de Produtividade"],
  [/viage/, "Incentivo de Viagens"],
  [/vale ?transporte|\bvt\b/, "Vale Transporte"],
  [/estagio|bolsa/, "Estágio/Bolsa"],
  [/uniforme/, "Uniforme"],
  [/alimenta/, "Alimentação"],
  [/confraterniza|aniversario|festa/, "Confraternização"],
  [/prestacao/, "Prestação de Serviços"],
  [/treinamento/, "Treinamentos"],
  [/farmacia|minas brasil|drogaria/, "Farmácia"],
  [/plano de saude|\bsaude\b|pro ?vida|unimed|\bamil\b|odonto/, "Plano de Saúde"],
  [/salario/, "Salário"],
];

// Desempate por código: só contas de GRUPO, subconta herda do pai. As 2.1.11.x
// ficam de fora de propósito — já foram renumeradas uma vez.
const POR_CODIGO = new Map<string, string>([
  ["2.1.1", "Salário"],
  ["2.1.2", "Adiantamento"],
  ["2.1.3", "Férias"],
  ["2.1.4", "13º Salário"],
  ["2.1.5", "Vale Transporte"],
  ["2.1.6", "Rescisão"],
  ["2.1.7", "Estágio/Bolsa"],
  ["2.1.8", "Uniforme"],
  ["2.1.9", "FGTS"],                 // e 2.1.9.1/.2/.3 (regular, empréstimo, rescisão)
  ["2.1.10", "INSS"],
  ["2.1.12", "Comissão"],            // Comissão Interna
  ["2.1.13", "Incentivo de Produtividade"],
  ["2.1.14", "Alimentação"],
  ["2.1.15", "Confraternização"],    // e as subcontas (festa junina, aniversário…)
  ["2.1.16", "Prestação de Serviços"],
  ["2.1.17", "Treinamentos"],
  ["2.1.18", "Farmácia"],            // "Minas Brasil" = drogaria conveniada
  ["2.1.19", "Incentivo de Viagens"],
  ["2.1.20", "Plano de Saúde"],      // e 2.1.20.1 Pró Vida
  // 2.1.21 (Divulgação de vagas) e 2.1.22 (Advocatícios) são despesas de RH,
  // não pagamento a colaborador — ficam em "Outros" de propósito.
  //
  // FORA DO GRUPO 2.1, mas é gente recebendo (ver FOLHA_FORA_DO_21 abaixo):
  ["2.3.2.1", "Limpeza/Faxina"],     // Limpeza Escritório
  ["2.3.2.2", "Limpeza/Faxina"],     // Limpeza Produção
  ["2.11.1", "Freelancer (Empreita)"],
]);

/**
 * Contas fora do grupo 2.1 que mesmo assim pagam PESSOA.
 *
 * Descoberto em 01/08/2026 cruzando o plano de contas do contador com a folha:
 * a faxina da Barbara e da Marcella e a empreita NUNCA chegavam do ERP, e não
 * era problema de casamento de nome — o contador não lança essas duas em 2.1.
 * A faxina vai para 2.3.2.1 (Limpeza Escritório) e a empreita para 2.11.1
 * (Freelancer), e o filtro daqui só aceitava "2.1.".
 *
 * A prova é aritmética: 2.3.2.1 vale R$ 600 em jan, fev, mar e jun, R$ 750 em
 * abr e R$ 300 em mai — exatamente os pagamentos de faxina que existem na base,
 * vindos da época da planilha. Quando a fonte virou o ERP, esse dinheiro parou
 * de entrar em silêncio, porque a planilha classificava pelo TEXTO ("faxina") e
 * o ERP classifica pelo CÓDIGO.
 *
 * É lista fechada, e por código exato, de propósito: as irmãs 2.3.2.3 (Caçamba)
 * e 2.3.2.4 (Serquip) são empresas de resíduo, e 2.11.2/3/4 são Munk, Gráfica e
 * Frete. Abrir o 2.3.2 ou o 2.11 inteiro jogaria fornecedor na ficha de gente.
 * Empresa que apareça mesmo assim (CNPJ) não vira pessoa: o casamento por CPF
 * recusa 14 dígitos e ela cai na lista de não encontrados, visível.
 */
const FOLHA_FORA_DO_21 = ["2.3.2.1", "2.3.2.2", "2.11.1"];

const codigoDoPlano = (plano: string) => String(plano || "").trim().split("-")[0].trim();

/**
 * Traduz a conta do ERP no tipo de pagamento do RH: nome, depois código
 * (subindo a hierarquia: 2.1.9.1 → 2.1.9 → 2.1 → 2), senão "Outros".
 */
function tipoDoPlano(plano: string): string {
  const nome = normalizar(String(plano || "").trim().split("-").slice(1).join("-").trim());
  if (nome) {
    for (const [re, tipo] of POR_NOME) if (re.test(nome)) return tipo;
  }
  const codigo = codigoDoPlano(plano);
  if (!codigo) return "Outros";
  const partes = codigo.split(".");
  for (let n = partes.length; n >= 1; n--) {
    const t = POR_CODIGO.get(partes.slice(0, n).join("."));
    if (t) return t;
  }
  return "Outros";
}

// Compara por CÓDIGO, não pelo texto cru: "2.11.1-Freelancer" não começa por
// "2.1." (o caractere depois de "2.1" é o segundo "1", não o ponto), então a
// checagem antiga já estava certa em não deixar o 2.11 entrar de carona — o que
// faltava era deixar entrar de propósito quem é gente.
// Conta de pagamento a pessoa também pelo NOME: o contador renumerou o plano
// em jul/2026 e a Limpeza saiu de 2.3.2.1 para um código que a lista não
// conhece — a faxina de julho e agosto sumiu da folha calada (07/09/2026).
const NOME_DE_FOLHA = /faxina|limpeza|empreita|freela|diaria|comiss|bonus|hora ?extra|adiantamento|salario|ferias|rescis|vale ?transporte|decimo|13|estagio|uniforme|produtividade|incentivo|plantao/;
const ehFolha = (plano: string) => {
  const c = codigoDoPlano(plano);
  if (c.startsWith("2.1.") || FOLHA_FORA_DO_21.some((p) => c === p || c.startsWith(p + "."))) return true;
  // Fora das listas: entra se o NOME diz que é pagamento a pessoa — mas nunca
  // societário (2.14 e o que a equivalência mapear para lá é cortado na rota do plano).
  if (c === "2.14" || c.startsWith("2.14.")) return false;
  const nome = normalizar(String(plano || "").split("-").slice(1).join("-"));
  return !!nome && NOME_DE_FOLHA.test(nome);
};

// "Colab: Fulano de Tal" → "Fulano de Tal"
const limpaNome = (s: string) => String(s || "").replace(/^\s*colab\s*:\s*/i, "").trim();

const num = (v: unknown) => {
  const n = Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

/**
 * Janela de vencimentos de uma competência.
 *
 * A competência NÃO é o mês de calendário: vencimento até o dia 15 conta para o
 * mês anterior (regra da folha, em src/lib/custos.ts). Então a competência de
 * julho é tudo que vence de 16/07 a 15/08. Buscar 01–31/07 trazia meio mês de
 * junho e deixava de fora a primeira quinzena de agosto — e o que faltava
 * aparecia na conferência como "sumiu do ERP", convidando a apagar pagamento bom.
 */
function janelaDaCompetencia(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  const inicio = new Date(ano, mes - 1, 16);
  const fim = new Date(ano, mes, 15);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { datainicial: iso(inicio), datafinal: iso(fim) };
}

/**
 * Janela do PLANO DE CONTAS: o mês civil do vencimento.
 *
 * NÃO é a janela da folha (16→15). Conferido em 06/09/2026 contra a planilha do
 * contador de jan a jun: somando os títulos pelo mês civil do vencimento, 22
 * pares (conta × mês) batem ao centavo e 20 deles NÃO batem pela janela 16→15;
 * pelo caminho inverso, nenhum. A faxina fecha o caso: o contador lança R$ 600
 * em junho e são exatamente os dois títulos de 05/06.
 */
function janelaDoMes(competencia: string) {
  const [ano, mes] = competencia.split("-").map(Number);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { datainicial: iso(new Date(ano, mes - 1, 1)), datafinal: iso(new Date(ano, mes, 0)) };
}

async function buscaPagina(competencia: string, page: number, perPage: number, escopo: "folha" | "plano" = "folha") {
  const { datainicial, datafinal } = escopo === "plano" ? janelaDoMes(competencia) : janelaDaCompetencia(competencia);
  const q = new URLSearchParams({
    filtrodata: "VENCIMENTO",
    datainicial,
    datafinal,
    status: "TODOS",
    page: String(page),
    per_page: String(perPage),
  });
  const url = `${MUBI_BASE}/${MUBI_KEY}/contas-pagar?${q}`;
  const r = await fetch(url, { headers: { Accept: "application/json", "Access-Token": MUBI_TOKEN } });
  // O Mubisys responde 201 no sucesso; 200 também é aceito por segurança.
  if (r.status !== 201 && r.status !== 200) {
    const corpo = await r.text().catch(() => "");
    throw new Error(`Mubisys respondeu ${r.status}: ${corpo.slice(0, 200)}`);
  }
  return await r.json();
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (!MUBI_KEY || !MUBI_TOKEN) {
    return json({ erro: "Integração com o Mubisys não configurada (faltam as credenciais no servidor)." }, 503);
  }
  if (!(await ehGestao(req))) return json({ erro: "Não autorizado." }, 401);

  try {
    const corpo = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const competencia = String(corpo.competencia || "");
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return json({ erro: "Informe a competência no formato AAAA-MM." }, 400);
    }

    // per_page alto para fazer o mínimo de chamadas: cada uma leva 25-40s.
    const PER_PAGE = 500;

    // UMA PÁGINA POR CHAMADA, quando o cliente pede.
    //
    // A versão anterior varria até a 4ª página aqui dentro e parava — teto de
    // 2000 títulos por mês, com o resto ficando para trás em silêncio. Subir o
    // teto não resolve: cada página leva 25-40s e a função tem tempo limitado;
    // uma varredura longa morreria no meio e perderia TUDO, inclusive as
    // páginas que já tinham vindo.
    //
    // Com o cliente pedindo página por página, cada chamada é curta, o
    // progresso aparece na tela, dá para cancelar, e um erro numa página não
    // derruba o que já foi lido. Sem `page` no pedido, o comportamento antigo
    // continua valendo (compatibilidade com versões do app já publicadas).
    const paginaPedida = Number(corpo.page ?? 0);
    const umaPagina = Number.isFinite(paginaPedida) && paginaPedida >= 1;
    // "plano" = plano de contas do mês (TODA despesa, agregada por conta), no
    // lugar da folha de pessoal. Mesma paginação, outra janela de datas.
    const escopo: "folha" | "plano" = corpo.escopo === "plano" ? "plano" : "folha";

    const primeira = await buscaPagina(competencia, umaPagina ? paginaPedida : 1, PER_PAGE, escopo);
    let itens: Record<string, unknown>[] = primeira?.data ?? [];
    // O Mubisys às vezes devolve a paginação em "pagination", às vezes em "meta"
    // (o cliente do Painel já trata os dois). Lendo só um formato, o total virava
    // 1: as páginas seguintes eram ignoradas em silêncio e "truncado" saía false
    // — o alerta de busca incompleta nunca dispararia. Sem nenhum dos dois, o
    // sinal é a página ter vindo cheia.
    const pag = primeira?.pagination ?? primeira?.meta ?? {};
    /* PÁGINA CURTA NÃO PROVA QUE ACABOU (08/09/2026).
     *
     * A régua antiga era "veio menos que per_page ⇒ era a última". Quando o
     * Mubisys não manda paginação (e ele não manda em toda rota), qualquer
     * página curta encerrava a varredura — e o que ficou para trás sumia em
     * SILÊNCIO, com "truncado: false" na resposta.
     *
     * O estrago apareceu no plano de contas: julho, agosto e setembro/2026
     * vieram com 120, 120 e 80 contas e NENHUMA conta de folha, enquanto os
     * mesmos meses tinham ~110 títulos de salário, hora extra e diária
     * vencendo. A tela então mostrava "Individual R$ 0,00" como se a folha
     * daquele mês não tivesse custado nada.
     *
     * Agora, sem paginação declarada, só uma página VAZIA encerra: o cliente
     * pede a seguinte enquanto vier item, até o teto dele. `paginacaoInferida`
     * conta para a tela que o total é palpite, não informação do ERP. */
    const { totalPaginas, paginacaoInferida } = decidirPaginacao({
      itens: itens.length,
      totalDeclarado: Number(pag.last_page ?? pag.total_pages ?? 0) || 0,
      pagina: paginaPedida,
    });

    if (!umaPagina) {
      // Modo antigo: varre até a 4ª página aqui dentro.
      for (let p = 2; p <= Math.min(totalPaginas, 4); p++) {
        const prox = await buscaPagina(competencia, p, PER_PAGE, escopo);
        itens = itens.concat(prox?.data ?? []);
      }
    }

    if (escopo === "plano") {
      // O plano de REFERÊNCIA: o mês mais recente que veio do contador (não do
      // ERP). É contra ele que a numeração de hoje é reconhecida pelo nome —
      // o contador renumerou o plano inteiro em jul/2026 e o corte do que é
      // societário, por prefixo literal, deixou de alcançar (2.14.2.2 virou
      // 2.11.2.2). Lê da mesma tabela do sync, paginado: max_rows=1000.
      const referencia = await planoDeReferencia();
      // O plano de contas do mês: TODA despesa somada por conta, do jeito que a
      // planilha do contador mostra. Sem nome de ninguém — conta, quantos
      // títulos e o total.
      const contas = new Map<string, { codigo: string; nome: string; valor: number; quantos: number }>();
      // 2.14 (Despesas Societárias: retirada de sócio, arrendamento) NUNCA sai
      // daqui — nem agregado. A tela de Custos é de ADMIN_RH e só o master vê
      // societária; cortar na porta de dados é o único lugar que segura isso.
      // O que ficou de fora volta contado (contas e títulos), sem valor.
      const societarias = { contas: new Set<string>(), titulos: 0 };
      for (const i of itens) {
        const plano = String(i.plano_contas ?? "").trim();
        if (!plano) continue;
        const codigo = codigoDoPlano(plano);
        if (!codigo) continue;
        if (codigo === "2.14" || codigo.startsWith("2.14.")) { societarias.contas.add(codigo); societarias.titulos += 1; continue; }
        const x = contas.get(codigo) ?? { codigo, nome: plano.split("-").slice(1).join("-").trim() || codigo, quantos: 0, valor: 0 };
        x.quantos += 1;
        x.valor = Math.round((x.valor + (num(i.valor_pagamento) || num(i.valor_titulo))) * 100) / 100;
        contas.set(codigo, x);
      }
      const eq = equivalenciasDeContas(referencia.contas, [...contas.values()], { prefixosConfidenciais: ["2.14"] });
      eq.referencia = referencia.competencia;
      for (const [codigo, c] of [...contas]) {
        if (ehConfidencialEquivalente(c, ["2.14"], eq)) { societarias.contas.add(codigo); societarias.titulos += c.quantos; contas.delete(codigo); }
      }
      return json({
        competencia,
        escopo: "plano",
        equivalencias: serializar(eq),
        buscadoEm: new Date().toISOString(),
        totalTitulosNoMes: itens.length,
        paginas: totalPaginas,
        truncado: umaPagina ? false : totalPaginas > 4,
        pagina: umaPagina ? paginaPedida : 1,
        paginacaoInferida,
        temMais: umaPagina ? (paginacaoInferida ? itens.length > 0 : paginaPedida < totalPaginas) : totalPaginas > 4,
        contas: [...contas.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true })),
        societariasOmitidas: { contas: societarias.contas.size, titulos: societarias.titulos },
      });
    }

    /* A FOLHA SEGUE O CONTADOR, NÃO O NÚMERO (07/09/2026).
     *
     * `ehFolha` decide por código (2.1.x + a lista fechada) e por nome. Isso
     * quebra quando o contador RENUMERA: em julho o grupo 2.3 inteiro mudou de
     * significado — era "Despesas Limpeza", virou IOF, ISSQN e aluguéis — e a
     * faxina da Barbara e da Marcella, que vivia em 2.3.2.1, parou de chegar.
     * Ninguém viu: a pessoa continua na folha porque o salário dela vem, e o
     * mês só fecha um pouco menor.
     *
     * Agora a decisão passa pela EQUIVALÊNCIA: o mesmo mecanismo que a rota do
     * plano já usa aprende, pelo NOME dentro do grupo, qual conta de hoje
     * corresponde a qual conta do plano de referência do contador. Se a conta
     * antiga era folha, a nova é folha — seja qual for o número.
     *
     * O antigo continua valendo: quem casa por código ou por nome entra como
     * sempre entrou. A equivalência só ACRESCENTA quem o número novo escondia.
     */
    const refFolha = await planoDeReferencia();
    const contasDoMes = [...new Map(
      itens
        .map((i) => String(i.plano_contas ?? "").trim())
        .filter(Boolean)
        .map((plano) => [codigoDoPlano(plano), { codigo: codigoDoPlano(plano), nome: plano.split("-").slice(1).join("-").trim() }] as const),
    ).values()];
    const eqFolha = equivalenciasDeContas(refFolha.contas, contasDoMes);
    /** Folha pela régua de sempre, OU porque a conta equivalente do contador era folha. */
    const ehFolhaOuEquivalente = (plano: string) => {
      if (ehFolha(plano)) return true;
      const antigo = codigoDeReferencia(codigoDoPlano(plano), eqFolha.mapa);
      if (!antigo || antigo === codigoDoPlano(plano)) return false;
      return antigo.startsWith("2.1.") || FOLHA_FORA_DO_21.some((x) => antigo === x || antigo.startsWith(x + "."));
    };
    const folha = itens.filter((i) => ehFolhaOuEquivalente(String(i.plano_contas)));

    // O QUE FICOU DE FORA, dito em voz alta.
    //
    // `ehFolha` é uma lista fechada de CÓDIGOS, e código muda: a faxina já viveu
    // em 2.3.2.1 e some da folha desde julho/2026 sem que nada na tela avisasse
    // — foi assim que a faxina e a empreita ficaram meses fora em 2026 (ver
    // FOLHA_FORA_DO_21). Um zero silencioso parece "não teve"; então toda conta
    // recusada cujo NOME é de pagamento a pessoa volta agregada (conta, quantos,
    // total), sem nome de ninguém, para o RH decidir se ela entra na lista.
    // O PONTO CEGO QUE ISSO FECHA (07/09/2026). A lista voltava só as contas
    // recusadas cujo NOME bate no vocabulário de pagamento a pessoa. Mas o caso
    // que mais dói é o contrário: o contador RENOMEIA a conta e o nome novo não
    // bate em nada — aí ela some das DUAS listas, do filtro da folha e daqui.
    // Foi o que aconteceu com a faxina da Barbara e da Marcella: para em
    // jun/2026 e nada na tela dizia para onde foi.
    //
    // Agora volta TODA conta recusada que moveu dinheiro, com o palpite
    // `pareceGente` para a tela destacar as suspeitas. Ver conta demais é
    // ruído; não ver a conta que sumiu é perder dinheiro em silêncio.
    const NOME_DE_PESSOA = /faxina|limpeza|empreita|freela|diaria|comiss|bonus|hora ?extra|adiantamento|salario|ferias|rescis|vale ?transporte|decimo|estagio|uniforme|produtividade/;
    const TETO_FORA = 80;
    const fora = new Map<string, { plano: string; quantos: number; total: number; pareceGente: boolean }>();
    for (const i of itens) {
      const plano = String(i.plano_contas ?? "");
      if (!plano || ehFolhaOuEquivalente(plano)) continue;
      const nome = normalizar(plano.split("-").slice(1).join("-"));
      const x = fora.get(plano) ?? { plano, quantos: 0, total: 0, pareceGente: !!nome && NOME_DE_PESSOA.test(nome) };
      x.quantos += 1;
      x.total = Math.round((x.total + (num(i.valor_pagamento) || num(i.valor_titulo))) * 100) / 100;
      fora.set(plano, x);
    }
    const todasFora = [...fora.values()]
      .filter((c) => c.total !== 0)
      // Suspeita primeiro; depois o que move mais dinheiro.
      .sort((a, b) => Number(b.pareceGente) - Number(a.pareceGente) || Math.abs(b.total) - Math.abs(a.total));
    // Corte declarado, nunca calado: quem lê precisa saber que há mais.
    const contasForaDaFolha = todasFora.slice(0, TETO_FORA);
    const contasForaOmitidas = Math.max(0, todasFora.length - contasForaDaFolha.length);
    // Os IDS de TODO título recusado por `ehFolha` (não só os de nome de
    // pessoa). A tela precisa deles para não oferecer "remover" um lançamento
    // cujo título EXISTE no ERP e só ficou de fora pelo código da conta: para
    // ela, sem esta lista, ele parecia ter sumido. Só ids — nenhum nome, nenhum
    // valor (revisão de 07/09/2026).
    const idsForaDaFolha = itens
      .filter((i) => !ehFolhaOuEquivalente(String(i.plano_contas ?? "")))
      .map((i) => String(i.id ?? ""))
      .filter(Boolean);
    const linhas = folha.map((i) => {
      const nome = limpaNome(String(i.origem ?? ""));
      return {
        // id estável: o mesmo título do ERP não pode virar dois pagamentos.
        idMubi: String(i.id ?? ""),
        nome,
        ehColaborador: String(i.origem_tipo ?? "") === "Colaborador",
        cpfCnpj: String(i.origem_cnpj ?? "").trim() || null,
        planoContas: String(i.plano_contas ?? ""),
        tipo: tipoDoPlano(String(i.plano_contas ?? "")),
        // O NOME DA PESSOA PODE ESTAR EM QUALQUER UM DOS DOIS CAMPOS.
        //
        // Era `String(i.descricao ?? i.despesa ?? "")`, e o `??` só cai para
        // `despesa` quando `descricao` é null/undefined: string VAZIA passa
        // direto e o texto da despesa ia embora. O ERP mostra esse campo como
        // "Despesa" na tela dele, e é lá que o Léo escreveu
        // "Curso Marcella Laiara Rocha Farias" em 08/09/2026 para o curso cair
        // na ficha dela — perder esse texto anulava a correção inteira.
        //
        // Junta os dois quando ambos têm conteúdo e são diferentes: é deste
        // texto que sai o casamento com a pessoa (`casarPelaDescricao` e o id
        // de 6 dígitos), então nada aqui pode ser descartado por engano.
        descricao: [...new Set([i.descricao, i.despesa].map((v) => String(v ?? "").trim()).filter(Boolean))].join(" — "),
        valor: num(i.valor_pagamento) || num(i.valor_titulo),
        dataVencimento: String(i.data_vencimento ?? "").slice(0, 10),
        dataPagamento: String(i.data_pagamento ?? "").slice(0, 10) || null,
        status: String(i.status ?? ""),
        formaPagamento: String(i.forma_pagamento ?? ""),
        centroCusto: String(i.centro_custo ?? ""),
      };
    });

    return json({
      competencia,
      buscadoEm: new Date().toISOString(),
      totalTitulosNoMes: itens.length,
      paginas: totalPaginas,
      // Quem pede página a página nunca é truncado: o cliente vai até o fim.
      truncado: umaPagina ? false : totalPaginas > 4,
      contasForaDaFolha,
      contasForaOmitidas,
      idsForaDaFolha,
      pagina: umaPagina ? paginaPedida : 1,
      paginacaoInferida,
      // Mesma régua do plano: sem paginação declarada, só página vazia encerra.
      temMais: umaPagina ? (paginacaoInferida ? itens.length > 0 : paginaPedida < totalPaginas) : totalPaginas > 4,
      linhas,
    });
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha ao consultar o Mubisys." }, 502);
  }
});
