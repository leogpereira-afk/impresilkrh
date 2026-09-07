// ============================================================================
// Plano de contas direto do Contas a Pagar do Mubisys.
//
// Até 06/09/2026 o plano de contas só entrava por planilha: o contador fechava
// o mês, mandava o .xlsx e alguém subia. Enquanto isso não acontecia, rateio e
// Custo Global ficavam INDISPONÍVEIS — julho e agosto de 2026 estavam assim.
// O ERP tem o mesmo dado, título a título, e a soma por conta é o plano.
//
// A JANELA É O MÊS CIVIL DO VENCIMENTO, não a competência 16→15 da folha.
// Conferido contra a planilha do contador de jan a jun/2026: pelo mês civil, 22
// pares (conta × mês) batem ao centavo, e em 20 deles a janela 16→15 erra; pelo
// caminho inverso, nenhum. A faxina fecha o caso — o contador lança R$ 600 em
// junho, que são exatamente os dois títulos de 05/06.
//
// O QUE VEM DO ERP NÃO É A PLANILHA FECHADA. O contador ainda ajusta,
// provisiona e reclassifica depois. Por isso nada é gravado sem o RH conferir a
// prévia, e a conta trazida do ERP fica marcada como tal (origem "erp"): quando
// a planilha do mês chegar, ela manda.
// ============================================================================
import { supabase, FN_MUBI_PAGAMENTOS } from "@/lib/supabase";
import { idConta } from "@/data/planoContas";
import type { ClasseCusto, ContaPlano } from "@/data/types";
import { contaEhConfidencial } from "@/lib/custos";
import { codigoDeReferencia, desserializar, ehConfidencialEquivalente, type Equivalencias, type EquivalenciasSerializadas } from "@/lib/renumeracao";
import { tipoDoPlanoErp } from "@/lib/tipoDoPlano";

export interface ContaMubi {
  codigo: string;
  nome: string;
  valor: number;
  quantos: number;
}

export interface RespostaPlanoMubi {
  competencia: string;
  buscadoEm: string;
  totalTitulosNoMes: number;
  paginas: number;
  pagina?: number;
  temMais?: boolean;
  truncado: boolean;
  contas: ContaMubi[];
  /** Contas 2.14 que o servidor cortou (só contagem; nunca vem valor). */
  societariasOmitidas?: { contas: number; titulos: number };
  /**
   * A equivalência entre a numeração que o ERP manda e a do plano de
   * referência do contador (lib/renumeracao), calculada no servidor — que é
   * quem tem o plano inteiro e quem corta o confidencial na porta de dados.
   */
  equivalencias?: EquivalenciasSerializadas;
}

/** Uma página do plano de contas do mês. */
export async function buscarPlanoMubi(competencia: string, page?: number): Promise<RespostaPlanoMubi> {
  if (!supabase || !FN_MUBI_PAGAMENTOS) throw new Error("Nuvem não configurada.");
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao?.session?.access_token;
  if (!token) throw new Error("Faça login novamente para buscar do Mubisys.");

  const r = await fetch(FN_MUBI_PAGAMENTOS, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ competencia, escopo: "plano", ...(page ? { page } : {}) }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo?.erro || `Falha ao consultar o Mubisys (${r.status}).`);
  const resp = corpo as RespostaPlanoMubi;
  // Uma função ANTIGA no ar ignora `escopo` e devolve a folha de pessoal — que
  // não tem `contas`. Gravar isso apagaria o plano do mês com um objeto vazio.
  if (!Array.isArray(resp?.contas)) {
    throw new Error("A função do Mubisys no servidor ainda não sabe trazer o plano de contas. Publique a versão nova e tente de novo.");
  }
  return resp;
}

/** Soma duas listas de contas do ERP (páginas diferentes do mesmo mês). */
export function juntarContas(listas: ContaMubi[][]): ContaMubi[] {
  const m = new Map<string, ContaMubi>();
  for (const l of listas) {
    for (const c of l) {
      const x = m.get(c.codigo) ?? { codigo: c.codigo, nome: c.nome, valor: 0, quantos: 0 };
      // O nome pode variar entre títulos da mesma conta ("2.1.11.3-Diária" e
      // "2.1.11.3-Diarias"). Fica o primeiro não vazio — o código é a chave.
      if (!x.nome && c.nome) x.nome = c.nome;
      x.valor = Math.round((x.valor + c.valor) * 100) / 100;
      x.quantos += c.quantos;
      m.set(c.codigo, x);
    }
  }
  return [...m.values()].sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
}

/** O mês inteiro, página a página, com progresso e cancelamento. */
export async function buscarPlanoCompleto(
  competencia: string,
  aoProgredir?: (pagina: number, totalPaginas: number) => void,
  cancelado?: () => boolean,
): Promise<{ contas: ContaMubi[]; titulos: number; paginas: number; incompleta: boolean; societariasOmitidas: number; equivalencias: Equivalencias | null }> {
  const TETO_PAGINAS = 40;
  const paginas: ContaMubi[][] = [];
  let titulos = 0;
  let societariasOmitidas = 0;
  let equivalencias: Equivalencias | null = null;
  let pagina = 1;
  let totalPaginas = 1;
  let incompleta = false;

  for (;;) {
    if (cancelado?.()) { incompleta = true; break; }
    const r = await buscarPlanoMubi(competencia, pagina);
    paginas.push(r.contas);
    titulos += r.totalTitulosNoMes || 0;
    societariasOmitidas += r.societariasOmitidas?.titulos ?? 0;
    if (!equivalencias && r.equivalencias) equivalencias = desserializar(r.equivalencias);
    totalPaginas = r.paginas || 1;
    aoProgredir?.(pagina, totalPaginas);
    if (!r.temMais) break;
    pagina++;
    if (pagina > TETO_PAGINAS) { incompleta = true; break; }
  }
  return { contas: juntarContas(paginas), titulos, paginas: totalPaginas, incompleta, societariasOmitidas, equivalencias };
}

/**
 * Tipos que são pagamento A UMA PESSOA. O que cai aqui já entra na tela por
 * pessoa, pela folha (coleção "pagamentos") — trazer de novo pelo plano seria
 * o mesmo dinheiro em dois lugares. O que NÃO está aqui é custo coletivo ou
 * encargo (alimentação, confraternização, treinamento, FGTS, INSS…).
 */
const TIPOS_PESSOAIS = new Set([
  "Salário", "Adiantamento", "13º Salário", "Férias", "Rescisão", "Horas Extras", "Diária", "Comissão", "Bônus",
  "Incentivo de Produtividade", "Incentivo de Viagens", "Vale Transporte", "Plano de Saúde", "Uniforme",
  "Freelancer (Empreita)", "Limpeza/Faxina", "Prestação de Serviços", "Estágio/Bolsa", "Arrendamento", "Retirada",
]);

const CODIGO_VALIDO = /^2(\.\d+)*$/;
/** 2.14 — Despesas Societárias. O servidor corta; isto é a rede do cliente. */
const PREFIXOS_SOCIETARIOS = ["2.14"] as const;

/** A conta, ou qualquer ancestral dela, está classificada como individual? */
function ehIndividualPorClasse(codigo: string, classes: Map<string, ClasseCusto>): boolean {
  const partes = codigo.split(".");
  for (let n = partes.length; n >= 1; n--) {
    const cls = classes.get(partes.slice(0, n).join("."));
    if (cls) return cls === "individual";
  }
  return false;
}

/**
 * É pagamento a pessoa? Duas réguas, qualquer uma basta: a CLASSE da conta (ou
 * do pai, porque o contador renumera subconta) é "individual", ou o NOME da
 * conta diz um tipo pessoal (a mesma tradução que a folha usa).
 */
export function ehContaPessoal(codigo: string, nome: string, classes: Map<string, ClasseCusto>): boolean {
  if (ehIndividualPorClasse(codigo, classes)) return true;
  return TIPOS_PESSOAIS.has(tipoDoPlanoErp(`${codigo}-${nome}`, "Outros"));
}

export interface PlanoMontado {
  /** O que entra no plano: coletivo e encargo, com origem "erp". */
  contas: ContaPlano[];
  /** Pagamento a pessoa: já está na folha por pessoa, fica de fora daqui. */
  pessoais: ContaMubi[];
  /** 2.14 — nunca entra por este caminho (o servidor já corta; isto é a rede). */
  societarias: ContaMubi[];
  /** Código que não é do grupo 2 (ou não é código): fica visível, não some. */
  naoReconhecidas: ContaMubi[];
  /** Renumeradas pelo contador e reconhecidas pelo nome dentro do grupo. */
  renumeradas: number;
  /** Entraram, mas sem par no plano de referência: classe pelo código literal — confira. */
  semPar: ContaMubi[];
}

/**
 * As contas do ERP viram registros do plano de contas — SÓ as que não são
 * pagamento a pessoa (pedido do Léo, 07/09/2026: "comissão interna e o que é
 * pessoal não pode entrar"). O individual já entra pela folha, pessoa a
 * pessoa; pelo plano vem o coletivo (rateio) e o encargo (FGTS, INSS).
 *
 * `folha: true` em todas, de propósito: no ERP cada título está em UMA conta,
 * então conta-pai e conta-filha não se sobrepõem — e folhasDoMes só calcula
 * valor próprio quando há linha marcada como pai.
 *
 * Nada some calado: o que ficou de fora volta em três listas para a prévia.
 */
export function montarPlanoDoErp(
  contas: ContaMubi[],
  competencia: string,
  classes: Map<string, ClasseCusto>,
  eq: Equivalencias | null = null,
): PlanoMontado {
  const out: PlanoMontado = { contas: [], pessoais: [], societarias: [], naoReconhecidas: [], renumeradas: 0, semPar: [] };
  for (const c of contas) {
    if (!c.codigo || !Number.isFinite(c.valor)) continue;
    if (!CODIGO_VALIDO.test(c.codigo)) { out.naoReconhecidas.push(c); continue; }
    // Confidencial em QUALQUER numeração — e, sem par, pelo nome (na dúvida, esconde).
    if (ehConfidencialEquivalente(c, PREFIXOS_SOCIETARIOS, eq) || contaEhConfidencial({ codigo: c.codigo })) { out.societarias.push(c); continue; }
    // O código pelo qual se CLASSIFICA é o de referência: as classes são
    // guardadas pela numeração do contador.
    const ref = codigoDeReferencia(c.codigo, eq?.mapa);
    if (ehContaPessoal(ref, c.nome, classes)) { out.pessoais.push(c); continue; }
    const temPar = !eq || eq.mapa.has(c.codigo);
    if (!temPar) out.semPar.push(c);
    if (ref !== c.codigo) out.renumeradas++;
    out.contas.push({
      id: idConta(competencia, c.codigo),
      competencia,
      codigo: c.codigo,
      ...(ref !== c.codigo ? { equivaleA: ref } : {}),
      nome: c.nome || c.codigo,
      valor: Math.round(c.valor * 100) / 100,
      folha: true,
      origem: "erp",
    });
  }
  return out;
}

/**
 * A competência já tem linha do CONTADOR (planilha)? Linha sem `origem` é da
 * planilha — o campo nasceu em 06/09/2026 e o que veio antes é tudo planilha.
 * Nesse mês o ERP só confere: gravar apagaria provisão que o contador lançou
 * e o Contas a Pagar não tem.
 */
export const competenciaEhDoContador = (plano: ContaPlano[], competencia: string): boolean =>
  plano.some((p) => p.competencia === competencia && p.origem !== "erp");

/**
 * Mescla o plano do ERP na coleção SEM apagar nada: as contas trazidas entram
 * (ou substituem a versão anterior delas, vinda do ERP); o que já existia e o
 * ERP não trouxe fica como está. Substituir a competência inteira — como a
 * planilha faz — era o que fazia "377 contas sumirem" na prévia.
 */
export function mesclarPlano(atual: ContaPlano[], novo: ContaPlano[], competencia: string): ContaPlano[] {
  const trazidos = new Map(novo.map((c) => [c.codigo, c]));
  // O que é do CONTADOR fica. O que veio do ERP numa puxada anterior e não
  // veio nesta SAI: o ERP é a fonte dessas linhas, e a versão velha delas era
  // justamente o que carregava a classificação errada (e o que a porta de
  // dados ainda não cortava) antes da equivalência de 07/09/2026.
  const mantidas = atual.filter((p) => p.competencia !== competencia || (!trazidos.has(p.codigo) && p.origem !== "erp"));
  return [...mantidas, ...novo];
}

export interface LinhaComparada {
  codigo: string;
  nome: string;
  antes: number | null;
  depois: number | null;
  /** depois − antes; null quando falta um dos lados. */
  dif: number | null;
  estado: "igual" | "mudou" | "nova" | "some";
}

export interface ComparacaoPlano {
  linhas: LinhaComparada[];
  iguais: number;
  mudaram: number;
  novas: number;
  /** Existem hoje e o ERP não trouxe — os três baldes abaixo somam isto. */
  somem: number;
  /** …das quais valem R$ 0,00: não movimentam, irrelevantes. */
  somemZeradas: number;
  /** …contas-pai (soma das filhas): a árvore, que o ERP nunca vai ter. */
  somemPais: number;
  /** …folhas COM dinheiro: as únicas que merecem decisão. */
  somemComValor: number;
  /** R$ nas folhas com dinheiro que o ERP não trouxe. */
  valorQueSome: number;
  /** Linhas 2.14 tiradas da lista (quem não é master não as vê). */
  confidenciaisOcultas: number;
  totalAntes: number;
  totalDepois: number;
}

/**
 * O que muda se o plano do ERP entrar no lugar do que já está gravado.
 *
 * "somem" são as contas que existem hoje e o ERP não trouxe — importar
 * SUBSTITUI a competência, então elas seriam apagadas. É a linha que mais
 * importa quando o mês já tem a planilha do contador: ele lança provisão (FGTS,
 * férias) que não existe em contas a pagar.
 */
export function compararPlano(atual: ContaPlano[], novo: ContaPlano[], opcoes: { ocultarConfidenciais?: boolean } = {}): ComparacaoPlano {
  const antes = new Map(atual.map((c) => [c.codigo, c]));
  const depois = new Map(novo.map((c) => [c.codigo, c]));
  let confidenciaisOcultas = 0;
  const codigos = [...new Set([...antes.keys(), ...depois.keys()])]
    .filter((codigo) => {
      const conta = antes.get(codigo) ?? depois.get(codigo)!;
      if (opcoes.ocultarConfidenciais && contaEhConfidencial(conta)) { confidenciaisOcultas++; return false; }
      return true;
    })
    .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const linhas: LinhaComparada[] = codigos.map((codigo) => {
    const a = antes.get(codigo);
    const b = depois.get(codigo);
    const va = a ? a.valor : null;
    const vb = b ? b.valor : null;
    const estado: LinhaComparada["estado"] =
      va == null ? "nova" : vb == null ? "some" : Math.abs(vb - va) < 0.005 ? "igual" : "mudou";
    return {
      codigo,
      nome: (b?.nome || a?.nome) ?? codigo,
      antes: va,
      depois: vb,
      dif: va != null && vb != null ? Math.round((vb - va) * 100) / 100 : null,
      estado,
    };
  });
  const visivel = (c: ContaPlano) => !(opcoes.ocultarConfidenciais && contaEhConfidencial(c));
  const soma = (xs: ContaPlano[]) => Math.round(xs.filter((c) => c.folha && visivel(c)).reduce((s, c) => s + c.valor, 0) * 100) / 100;
  const somemLinhas = linhas.filter((l) => l.estado === "some");
  const ehPai = (codigo: string) => antes.get(codigo)?.folha === false;
  const somemZeradas = somemLinhas.filter((l) => Math.abs(l.antes ?? 0) < 0.005).length;
  const somemPais = somemLinhas.filter((l) => Math.abs(l.antes ?? 0) >= 0.005 && ehPai(l.codigo)).length;
  const comValor = somemLinhas.filter((l) => Math.abs(l.antes ?? 0) >= 0.005 && !ehPai(l.codigo));
  return {
    linhas,
    iguais: linhas.filter((l) => l.estado === "igual").length,
    mudaram: linhas.filter((l) => l.estado === "mudou").length,
    novas: linhas.filter((l) => l.estado === "nova").length,
    somem: somemLinhas.length,
    somemZeradas,
    somemPais,
    somemComValor: comValor.length,
    valorQueSome: Math.round(comValor.reduce((s, l) => s + (l.antes ?? 0), 0) * 100) / 100,
    confidenciaisOcultas,
    totalAntes: soma(atual),
    totalDepois: soma(novo),
  };
}
