// ============================================================================
// Pagamentos vindos do ERP Mubisys (contas a pagar) — lado do cliente.
//
// A busca em si é feita por uma Edge Function (o token do ERP não pode ir para
// o navegador). Aqui cuidamos de: casar cada pagamento com o colaborador certo,
// lembrar os vínculos que o RH fez à mão, e montar os registros no formato da
// coleção "pagamentos".
//
// O casamento erra por motivos bobos e conhecidos: o ERP escreve o nome por
// extenso ("BARBARA PATRICIA FERREIRA VASCONCELOS") e o cadastro tem abreviado
// ("Barbara Patrícia F. Vasconcelos"); ou o cadastro tem um erro de digitação
// ("Golçalves" x "Gonçalves"). Por isso existe o vínculo manual, que fica
// guardado e resolve o mesmo nome nos meses seguintes.
// ============================================================================
import { supabase, FN_MUBI_PAGAMENTOS } from "@/lib/supabase";
import { competenciaPagto } from "@/lib/custos";
import type { Colaborador, Pagamento } from "@/data/types";

export interface LinhaMubi {
  idMubi: string;
  nome: string;
  ehColaborador: boolean;
  cpfCnpj: string | null;
  planoContas: string;
  tipo: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
  formaPagamento: string;
  centroCusto: string;
}

export interface RespostaMubi {
  competencia: string;
  buscadoEm: string;
  totalTitulosNoMes: number;
  paginas: number;
  truncado: boolean;
  /** Página devolvida (quando o cliente pediu página a página). */
  pagina?: number;
  /** Ainda há página depois desta? */
  temMais?: boolean;
  linhas: LinhaMubi[];
}

export const norm = (s: string) =>
  (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();

// Conectivos não ajudam a identificar ninguém e aparecem de forma inconsistente
// ("Jessica Fernanda Souza" no cadastro x "JESSICA FERNANDA DE SOUZA" no ERP).
const CONECTIVOS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
const tokens = (s: string) => norm(s).split(" ").filter((t) => t && !CONECTIVOS.has(t));

// O Mubisys CORTA o nome em 30 caracteres: "Barbara Patricia Ferreira
// Vasconcelos" chega como "BARBARA PATRICIA FERREIRA VASC". Além disso, o
// cadastro às vezes abrevia ("F." no lugar de "Ferreira"). Por isso dois
// pedaços casam quando um é começo do outro — nos dois sentidos.
const pedacoCasa = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);

/** Busca os pagamentos de pessoal de um mês no Mubisys. */
export async function buscarPagamentosMubi(competencia: string, page?: number): Promise<RespostaMubi> {
  if (!supabase || !FN_MUBI_PAGAMENTOS) throw new Error("Nuvem não configurada.");
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao?.session?.access_token;
  if (!token) throw new Error("Faça login novamente para buscar do Mubisys.");

  const r = await fetch(FN_MUBI_PAGAMENTOS, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(page ? { competencia, page } : { competencia }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo?.erro || `Falha ao consultar o Mubisys (${r.status}).`);
  return corpo as RespostaMubi;
}

/**
 * Uma competência inteira, percorrendo TODAS as páginas até o fim.
 *
 * O ERP devolve 500 títulos por página. A versão anterior parava na 4ª (2.000
 * títulos) e o que passasse disso ficava para trás sem ninguém saber — em mês
 * de 13º ou de rescisão, é justamente quando o volume estoura. Agora o laço vai
 * até o servidor dizer que acabou.
 *
 * O teto de segurança existe só para não girar para sempre se o ERP mentir na
 * paginação (last_page errado): 40 páginas = 20 mil títulos num mês, muito além
 * de qualquer realidade da empresa.
 */
export async function buscarCompetenciaCompleta(
  competencia: string,
  aoProgredir?: (pagina: number, totalPaginas: number) => void,
  cancelado?: () => boolean,
): Promise<{ linhas: LinhaMubi[]; paginas: number; incompleta: boolean }> {
  const TETO_PAGINAS = 40;
  const linhas: LinhaMubi[] = [];
  let pagina = 1;
  let totalPaginas = 1;
  let incompleta = false;

  for (;;) {
    if (cancelado?.()) { incompleta = true; break; }
    const r = await buscarPagamentosMubi(competencia, pagina);
    linhas.push(...r.linhas);
    totalPaginas = r.paginas || 1;
    aoProgredir?.(pagina, totalPaginas);
    // `temMais` só existe na função nova. Numa função antiga (sem redeploy) ele
    // vem undefined e a busca se comporta como antes — uma chamada só.
    if (!r.temMais) break;
    pagina++;
    if (pagina > TETO_PAGINAS) { incompleta = true; break; }
  }
  return { linhas, paginas: totalPaginas, incompleta };
}

/**
 * Varre VÁRIAS competências do ERP, da mais recente para a mais antiga.
 *
 * Por que mês a mês e não tudo de uma vez: cada consulta ao Mubisys leva 25-40
 * segundos, e a janela de uma competência vai do dia 16 ao 15 do mês seguinte —
 * um intervalo largo devolveria títulos misturados, sem como dizer de que
 * competência é cada um. Então o laço é aqui, no navegador, e não dentro da
 * Edge Function, que tem tempo limitado e morreria no meio de uma varredura
 * longa deixando metade do histórico para trás.
 *
 * Sequencial de propósito: disparar 12 consultas ao mesmo tempo derruba o ERP
 * (e ele responde 25-40s por consulta, então o paralelo não ajudaria tanto
 * quanto atrapalha).
 *
 * `aoProgredir` recebe o andamento para a tela poder mostrar onde está — uma
 * varredura de 12 meses passa de 5 minutos e sem retorno visual parece travada.
 * `cancelado` é consultado a cada volta: o RH precisa poder desistir.
 */
export async function buscarHistoricoMubi(
  competencias: string[],
  aoProgredir?: (feitos: number, total: number, competencia: string) => void,
  cancelado?: () => boolean,
): Promise<{ linhas: LinhaMubi[]; buscadoEm: string; truncado: boolean; falhas: { competencia: string; erro: string }[]; competenciasLidas: string[] }> {
  const linhas: LinhaMubi[] = [];
  const falhas: { competencia: string; erro: string }[] = [];
  const competenciasLidas: string[] = [];
  let truncado = false;

  for (let i = 0; i < competencias.length; i++) {
    if (cancelado?.()) break;
    const comp = competencias[i];
    aoProgredir?.(i, competencias.length, comp);
    try {
      // Todas as páginas do mês — não só as 4 primeiras.
      const r = await buscarCompetenciaCompleta(
        comp,
        (pag, tot) => aoProgredir?.(i, competencias.length, tot > 1 ? `${comp} (página ${pag}/${tot})` : comp),
        cancelado,
      );
      // Um mês que falha NÃO derruba a varredura inteira: o ERP cai, dá tempo
      // limite ou vem 500 num mês qualquer, e perder os outros 11 por causa
      // dele seria pior. As falhas voltam listadas para o RH tentar de novo.
      linhas.push(...r.linhas);
      competenciasLidas.push(comp);
      if (r.incompleta) truncado = true;
    } catch (e) {
      falhas.push({ competencia: comp, erro: e instanceof Error ? e.message : "falha" });
    }
  }
  aoProgredir?.(competencias.length, competencias.length, "");

  // O mesmo título pode voltar em duas competências vizinhas (a janela 16→15 faz
  // um vencimento de virada aparecer nas duas buscas). Fica só uma cópia — senão
  // a prévia mostraria o dobro de linhas antes mesmo de gravar.
  const vistos = new Set<string>();
  const unicas = linhas.filter((l) => {
    const k = String(l.idMubi);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return { linhas: unicas, buscadoEm: new Date().toISOString(), truncado, falhas, competenciasLidas };
}

/** Lista de competências (AAAA-MM) de `meses` atrás até a atual, da mais nova para a mais antiga. */
export function competenciasParaTras(meses: number, hoje = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Acha o colaborador de um nome vindo do ERP.
 * Ordem: vínculo salvo pelo RH → nome igual → todos os pedaços do nome do
 * cadastro cabem no nome do ERP (resolve o abreviado "F." x "Ferreira").
 */
const soDigitos = (v?: string | null) => String(v ?? "").replace(/\D/g, "");

export function casarColaborador(
  nomeMubi: string,
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
  cpfMubi?: string | null,
): Colaborador | null {
  // 1) CPF — a chave forte, e a que estava sobrando.
  //
  // O ERP manda o documento em cada título e nós casávamos só por NOME. Nos
  // pagamentos recorrentes isso funcionava (o nome do colaborador fixo é
  // escrito igual todo mês), mas quebrava justamente onde o nome varia: das 10
  // linhas de Limpeza/Faxina, NENHUMA casava; das 28 de Freelancer, só 1.
  // Eram os pagamentos que somem do extrato da pessoa sem ninguém perceber.
  //
  // 14 dígitos é CNPJ (fornecedor, não é gente) e fica de fora.
  const doc = soDigitos(cpfMubi);
  if (doc.length === 11) {
    const porCpf = colaboradores.filter((c) => soDigitos(c.cpf) === doc);
    if (porCpf.length === 1) return porCpf[0];
  }

  const alvo = norm(nomeMubi);
  if (!alvo) return null;

  const salvo = vinculos[alvo];
  if (salvo) {
    const c = colaboradores.find((x) => x.id === salvo);
    if (c) return c;
  }

  const exato = colaboradores.find((c) => norm(c.nome) === alvo);
  if (exato) return exato;

  // Compara pedaço a pedaço, na ordem: o nome do ERP precisa ser o começo do
  // nome do cadastro (ele vem cortado em 30 caracteres). Exige pelo menos dois
  // pedaços para nunca casar alguém só pelo primeiro nome.
  const alvoToks = tokens(nomeMubi);
  if (alvoToks.length < 2) return null;

  const candidatos = colaboradores.filter((c) => {
    const toks = tokens(c.nome);
    if (toks.length < 2 || alvoToks.length > toks.length) return false;
    return alvoToks.every((t, i) => pedacoCasa(t, toks[i]));
  });
  // Só aceita quando não há dúvida: dois candidatos = decisão do RH.
  return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Competência de um pagamento — a MESMA regra da planilha: vencimento até o dia
 * 15 conta para o mês anterior (`competenciaPagto`, em custos.ts).
 *
 * Antes aqui era `slice(0, 7)` (o mês do vencimento cru). Como 63% da folha
 * vence até o dia 15, o ERP jogava esses lançamentos um mês à frente do que já
 * estava gravado, e a conciliação os via como NOVOS: o mesmo dinheiro contado
 * em dois meses. A regra mora em UM lugar só; não copiar para cá.
 */
export const competenciaDe = (l: LinhaMubi) => {
  const venc = (l.dataVencimento || "").slice(0, 10);
  // Título sem vencimento não tem competência (competenciaPagto quebraria no split).
  return /^\d{4}-\d{2}-\d{2}$/.test(venc) ? competenciaPagto(venc) : "";
};

/** Monta o registro da coleção "pagamentos" a partir da linha do ERP. */
export function montarPagamento(l: LinhaMubi, colaboradorId: string): Pagamento {
  return {
    // O id é só a chave do registro; a IDENTIDADE do título é o campo idMubi
    // abaixo — é ele que faz a reimportação atualizar em vez de duplicar, e é
    // ele que os lançamentos vindos de planilha adotam no primeiro encontro.
    id: `mubi-${l.idMubi}`,
    idMubi: String(l.idMubi),
    colaboradorId,
    competencia: competenciaDe(l),
    tipo: l.tipo,
    valor: l.valor,
    dataPagamento: l.dataVencimento,
    descricao: [l.descricao, l.planoContas].filter(Boolean).join(" · ") || undefined,
  };
}

/**
 * Casa uma linha pela DESCRIÇÃO do título.
 *
 * Por que existe (01/08/2026): o ERP lança levas inteiras com a ORIGEM
 * genérica — "Colaboradores", 44 títulos, R$ 70 mil — e o nome da pessoa vai
 * no texto da descrição. O casamento por origem não tem como resolver isso, e
 * o grupo aparecia na tela como um bloco opaco só com o total: impossível de
 * vincular, e perigoso (vincular o grupo a alguém mandaria títulos de gente
 * diferente para uma pessoa só).
 *
 * A régua: TODOS os pedaços do nome do colaborador (2+) precisam aparecer na
 * descrição, NA ORDEM (subsequência), aceitando truncamento/abreviação
 * (pedacoCasa). E só casa com UM candidato — descrição que menciona duas
 * pessoas não é de ninguém.
 */
export function casarPelaDescricao(descricao: string, colaboradores: Colaborador[]): Colaborador | null {
  const descToks = tokens(descricao);
  if (descToks.length < 2) return null;
  const candidatos = colaboradores.filter((c) => {
    const toks = tokens(c.nome);
    if (toks.length < 2) return false;
    // subsequência: cada pedaço do nome aparece na descrição, na ordem
    let i = 0;
    for (const t of descToks) {
      if (i < toks.length && pedacoCasa(t, toks[i])) i++;
    }
    return i === toks.length;
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Converte a resposta do ERP no MESMO formato que a importação por planilha
 * devolve, para reaproveitar a conciliação que já existe (prévia com o que é
 * novo, o que mudou e o que sumiu).
 *
 * Ordem de decisão por título:
 *  1. origem (CPF → vínculo salvo → nome), como sempre;
 *  2. vínculo manual POR TÍTULO (vinculosTitulo[idMubi]) — o RH apontou;
 *  3. DESCRIÇÃO (casarPelaDescricao) — para as levas de origem genérica;
 *  4. CNPJ (14 dígitos) → despesa coletiva: SUPER TRIGO não é colaborador;
 *  5. origem FGTS/INSS sem CPF → guia paga ao governo, coletiva (rateio);
 *  6. sobrou → "não encontrado", agora COM os títulos linha a linha.
 */
export function paraRegistros(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
  vinculosTitulo: Record<string, string> = {},
): { registros: Pagamento[]; naoCasados: NaoCasado[]; coletivas: LinhaMubi[]; cpfsAprendidos: { colaboradorId: string; cpf: string }[] } {
  const registros: Pagamento[] = [];
  const porNome = new Map<string, NaoCasado>();
  const coletivas: LinhaMubi[] = [];
  const cpfs = new Map<string, string>();
  const porId = new Map(colaboradores.map((c) => [c.id, c]));

  for (const l of linhas) {
    if (!l.nome.trim()) { coletivas.push(l); continue; }
    const doc = String(l.cpfCnpj ?? "").replace(/\D/g, "");

    const c =
      casarColaborador(l.nome, colaboradores, vinculos, l.cpfCnpj) ??
      (vinculosTitulo[l.idMubi] ? porId.get(vinculosTitulo[l.idMubi]) ?? null : null) ??
      casarPelaDescricao(l.descricao, colaboradores);

    if (!c) {
      // CNPJ é fornecedor (padaria da alimentação, plano de saúde da empresa):
      // não é de ninguém — vai para as coletivas e segue no rateio, em vez de
      // ficar na lista pedindo um vínculo que seria errado.
      if (doc.length === 14) { coletivas.push(l); continue; }
      // Guia de FGTS/INSS: origem é o próprio imposto, não uma pessoa.
      if (/^(FGTS|INSS)$/i.test(l.nome.trim()) && doc.length !== 11) { coletivas.push(l); continue; }
      // Guarda o VALOR e os TÍTULOS junto do nome: uma lista só de nomes é
      // fácil de ignorar, e sem as linhas não dá para conferir até o fim nem
      // vincular título a título quando a origem é genérica.
      const chave = l.nome.trim();
      const atual = porNome.get(chave) ?? { nome: chave, cpf: l.cpfCnpj ?? null, linhas: 0, total: 0, tipos: new Set<string>(), titulos: [] as LinhaMubi[] };
      atual.linhas += 1;
      atual.total += l.valor || 0;
      atual.tipos.add(l.tipo);
      atual.titulos.push(l);
      if (!atual.cpf && l.cpfCnpj) atual.cpf = l.cpfCnpj;
      porNome.set(chave, atual);
      continue;
    }
    // Casou pelo NOME e o cadastro está sem CPF: aprende, para o mês que vem
    // casar pela chave forte e não depender de como o ERP escreveu o nome.
    if (doc.length === 11 && !String(c.cpf ?? "").replace(/\D/g, "")) cpfs.set(c.id, doc);
    registros.push(montarPagamento(l, c.id));
  }
  return {
    registros,
    naoCasados: [...porNome.values()].sort((a, b) => b.total - a.total),
    coletivas,
    cpfsAprendidos: [...cpfs.entries()].map(([colaboradorId, cpf]) => ({ colaboradorId, cpf })),
  };
}

/**
 * Sugestão para um nome que o casamento automático NÃO resolveu — o sistema
 * pergunta em vez de deixar em aberto.
 *
 * Por que existe: 57 dos 88 do cadastro são INATIVOS, quase todos com
 * lançamento, e valores altos ficavam presos na lista de "não encontrados"
 * porque o seletor de vínculo escondia ex-colaborador. A pedido do Leonardo
 * (01/08/2026): quando parecer um inativo, o sistema tem que PERGUNTAR.
 *
 * A regra é mais frouxa que a do casamento automático de propósito — e por
 * isso ela NUNCA grava sozinha, só sugere com botão de confirmar:
 *  - automático: os pedaços têm de casar NA ORDEM, do começo do nome;
 *  - sugestão: cada pedaço do ERP acha par em QUALQUER posição do nome
 *    ("JESSICA SAMPAIO" acha "Jessica Fernanda Souza Sampaio").
 * Continua exigindo 2+ pedaços e um único candidato — dois candidatos é
 * decisão do RH no seletor, não chute do sistema.
 *
 * Erro de digitação (Golçalves × Gonçalves) segue NÃO sugerido, de propósito:
 * aproximação por semelhança de letras em folha de pagamento troca pessoa.
 * Para esses o caminho é o seletor manual — que agora mostra os inativos.
 */
export function sugerirVinculo(nomeMubi: string, colaboradores: Colaborador[]): Colaborador | null {
  const alvoToks = tokens(nomeMubi);
  if (alvoToks.length < 2) return null;
  const candidatos = colaboradores.filter((c) => {
    const toks = tokens(c.nome);
    if (toks.length < 2) return false;
    return alvoToks.every((t) => toks.some((x) => pedacoCasa(t, x)));
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

/** Nome do ERP que não casou com ninguém — com o que está ficando de fora. */
export interface NaoCasado {
  nome: string;
  cpf: string | null;
  linhas: number;
  total: number;
  tipos: Set<string>;
  /** Os títulos por trás do total — para conferir até a última linha e
   *  vincular um a um quando a origem é genérica ("Colaboradores"). */
  titulos: LinhaMubi[];
}

export interface PreviaMubi {
  vinculadas: { linha: LinhaMubi; colaborador: Colaborador }[];
  semVinculo: LinhaMubi[];   // nome no ERP que não casou com ninguém
  semNome: LinhaMubi[];      // despesa coletiva (bolo, Uber, reembolso) — não é de ninguém
  totalVinculado: number;
  totalSemVinculo: number;
  totalSemNome: number;
}

/** Separa o que já dá para gravar do que precisa da decisão do RH. */
export function montarPrevia(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): PreviaMubi {
  const vinculadas: PreviaMubi["vinculadas"] = [];
  const semVinculo: LinhaMubi[] = [];
  const semNome: LinhaMubi[] = [];

  for (const l of linhas) {
    if (!l.nome.trim()) { semNome.push(l); continue; }
    const c = casarColaborador(l.nome, colaboradores, vinculos, l.cpfCnpj);
    if (c) vinculadas.push({ linha: l, colaborador: c });
    else semVinculo.push(l);
  }
  const soma = (arr: { valor: number }[]) => arr.reduce((s, x) => s + (x.valor || 0), 0);
  return {
    vinculadas, semVinculo, semNome,
    totalVinculado: soma(vinculadas.map((v) => v.linha)),
    totalSemVinculo: soma(semVinculo),
    totalSemNome: soma(semNome),
  };
}

// ---------------------------------------------------------------------------
// Salário do cadastro, a partir do que o ERP pagou.
//
// ISTO NÃO É O SALÁRIO DE CONTRATO. O que sai do contas a pagar é o LÍQUIDO: já
// saíram INSS, IRRF, vale-transporte e o desconto de falta do mês. Usar esse
// número como salário do cadastro rebaixaria quase todo mundo — e esse campo é
// a base de TODO o cálculo de hora extra e de desconto de falta
// (lib/pontoFolha). Um mês com falta rebaixaria a base e erraria o cálculo do
// mês seguinte, que por sua vez erraria o próximo: um ciclo se alimentando.
//
// Por isso só entra quem está SEM salário nenhum no cadastro. Ali não há o que
// rebaixar, e um ponto de partida conferido pelo RH é melhor do que o sistema
// não conseguir calcular nada para aquela pessoa. Quem já tem salário, o
// cadastro manda — o ERP não opina.
// ---------------------------------------------------------------------------

/** Tipos que, somados na competência, compõem a remuneração do mês. */
const TIPOS_SALARIO = ["Salário", "Adiantamento"];

export interface SugestaoSalario {
  colaborador: Colaborador;
  /** Soma de Salário + Adiantamento na competência usada (líquido pago). */
  sugerido: number;
  competencia: string;
  /** O que está gravado hoje no cadastro (null = em branco). */
  atual: number | null;
  /** As linhas do ERP que formaram a soma — para conferir a origem. */
  origem: LinhaMubi[];
  /** O mês tem as DUAS pernas (adiantamento e saldo)? Se não, é meio salário. */
  completo: boolean;
}

export function sugerirSalarios(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
  hoje = new Date(),
): SugestaoSalario[] {
  // A competência corrente ainda não fechou (a janela vai do 16 ao 15): nela
  // costuma haver só o adiantamento, e metade do salário viraria "o salário".
  const compCorrente = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;

  const porPessoa = new Map<string, Map<string, LinhaMubi[]>>();
  for (const l of linhas) {
    if (!TIPOS_SALARIO.includes(l.tipo) || !l.nome.trim()) continue;
    const c = casarColaborador(l.nome, colaboradores, vinculos, l.cpfCnpj);
    if (!c) continue;
    if (c.salario != null && c.salario > 0) continue; // já tem salário: o cadastro manda
    if (c.ehDirecao) continue;                        // direção não tem salário por definição
    const comp = competenciaDe(l);
    if (!comp || comp >= compCorrente) continue;
    const porComp = porPessoa.get(c.id) ?? new Map<string, LinhaMubi[]>();
    porComp.set(comp, [...(porComp.get(comp) ?? []), l]);
    porPessoa.set(c.id, porComp);
  }

  const out: SugestaoSalario[] = [];
  for (const [colaboradorId, porComp] of porPessoa) {
    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) continue;
    // Prefere o mês mais recente que tenha as DUAS pernas; se nenhum tiver, usa
    // o mais recente e marca como incompleto (a tela não deixa aplicar).
    const comps = [...porComp.keys()].sort().reverse();
    const completo = comps.find((k) => {
      const tipos = new Set((porComp.get(k) ?? []).map((l) => l.tipo));
      return tipos.has("Salário") && tipos.has("Adiantamento");
    });
    const competencia = completo ?? comps[0];
    if (!competencia) continue;
    const origem = porComp.get(competencia) ?? [];
    const sugerido = Math.round(origem.reduce((s, l) => s + (l.valor ?? 0), 0) * 100) / 100;
    if (sugerido <= 0) continue;
    out.push({
      colaborador, sugerido, competencia,
      atual: colaborador.salario ?? null,
      origem,
      completo: !!completo,
    });
  }

  return out.sort((a, b) =>
    Number(b.completo) - Number(a.completo) ||
    a.colaborador.nome.localeCompare(b.colaborador.nome, "pt"),
  );
}
