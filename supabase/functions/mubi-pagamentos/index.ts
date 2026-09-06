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
import { createClient } from "npm:@supabase/supabase-js@2";

const MUBI_BASE = Deno.env.get("MUBI_BASE_URL") ?? "https://api.mubisys.com/api";
const MUBI_KEY = Deno.env.get("MUBI_PUBLIC_KEY") ?? "";
const MUBI_TOKEN = Deno.env.get("MUBI_TOKEN") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

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
const ehFolha = (plano: string) => {
  const c = codigoDoPlano(plano);
  return c.startsWith("2.1.") || FOLHA_FORA_DO_21.some((p) => c === p || c.startsWith(p + "."));
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

async function buscaPagina(competencia: string, page: number, perPage: number) {
  const { datainicial, datafinal } = janelaDaCompetencia(competencia);
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

    const primeira = await buscaPagina(competencia, umaPagina ? paginaPedida : 1, PER_PAGE);
    let itens: Record<string, unknown>[] = primeira?.data ?? [];
    // O Mubisys às vezes devolve a paginação em "pagination", às vezes em "meta"
    // (o cliente do Painel já trata os dois). Lendo só um formato, o total virava
    // 1: as páginas seguintes eram ignoradas em silêncio e "truncado" saía false
    // — o alerta de busca incompleta nunca dispararia. Sem nenhum dos dois, o
    // sinal é a página ter vindo cheia.
    const pag = primeira?.pagination ?? primeira?.meta ?? {};
    const totalPaginas = Number(
      pag.last_page ?? pag.total_pages ?? (itens.length >= PER_PAGE ? paginaPedida + 1 : Math.max(1, paginaPedida)),
    ) || 1;

    if (!umaPagina) {
      // Modo antigo: varre até a 4ª página aqui dentro.
      for (let p = 2; p <= Math.min(totalPaginas, 4); p++) {
        const prox = await buscaPagina(competencia, p, PER_PAGE);
        itens = itens.concat(prox?.data ?? []);
      }
    }

    const folha = itens.filter((i) => ehFolha(String(i.plano_contas)));

    // O QUE FICOU DE FORA, dito em voz alta.
    //
    // `ehFolha` é uma lista fechada de CÓDIGOS, e código muda: a faxina já viveu
    // em 2.3.2.1 e some da folha desde julho/2026 sem que nada na tela avisasse
    // — foi assim que a faxina e a empreita ficaram meses fora em 2026 (ver
    // FOLHA_FORA_DO_21). Um zero silencioso parece "não teve"; então toda conta
    // recusada cujo NOME é de pagamento a pessoa volta agregada (conta, quantos,
    // total), sem nome de ninguém, para o RH decidir se ela entra na lista.
    const NOME_DE_PESSOA = /faxina|limpeza|empreita|freela|diaria|comiss|bonus|hora ?extra|adiantamento|salario|ferias|rescis|vale ?transporte|decimo|estagio|uniforme|produtividade/;
    const fora = new Map<string, { plano: string; quantos: number; total: number }>();
    for (const i of itens) {
      const plano = String(i.plano_contas ?? "");
      if (!plano || ehFolha(plano)) continue;
      const nome = normalizar(plano.split("-").slice(1).join("-"));
      if (!nome || !NOME_DE_PESSOA.test(nome)) continue;
      const x = fora.get(plano) ?? { plano, quantos: 0, total: 0 };
      x.quantos += 1;
      x.total = Math.round((x.total + (num(i.valor_pagamento) || num(i.valor_titulo))) * 100) / 100;
      fora.set(plano, x);
    }
    const contasForaDaFolha = [...fora.values()].sort((a, b) => b.total - a.total);
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
        descricao: String(i.descricao ?? i.despesa ?? "").trim(),
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
      pagina: umaPagina ? paginaPedida : 1,
      temMais: umaPagina ? paginaPedida < totalPaginas : totalPaginas > 4,
      linhas,
    });
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha ao consultar o Mubisys." }, 502);
  }
});
