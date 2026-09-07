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
import type { ContaPlano } from "@/data/types";

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
): Promise<{ contas: ContaMubi[]; titulos: number; paginas: number; incompleta: boolean }> {
  const TETO_PAGINAS = 40;
  const paginas: ContaMubi[][] = [];
  let titulos = 0;
  let pagina = 1;
  let totalPaginas = 1;
  let incompleta = false;

  for (;;) {
    if (cancelado?.()) { incompleta = true; break; }
    const r = await buscarPlanoMubi(competencia, pagina);
    paginas.push(r.contas);
    titulos += r.totalTitulosNoMes || 0;
    totalPaginas = r.paginas || 1;
    aoProgredir?.(pagina, totalPaginas);
    if (!r.temMais) break;
    pagina++;
    if (pagina > TETO_PAGINAS) { incompleta = true; break; }
  }
  return { contas: juntarContas(paginas), titulos, paginas: totalPaginas, incompleta };
}

/**
 * As contas do ERP viram registros do plano de contas.
 *
 * `folha: true` em TODAS, de propósito. Na planilha do contador a conta-pai
 * carrega a soma das filhas, e `folha` existe para não contar as duas vezes.
 * Aqui cada título está em UMA conta só: 2.1.11 e 2.1.11.4 podem existir juntas
 * e os valores não se sobrepõem — marcar a pai como não-folha jogaria fora o
 * dinheiro lançado direto nela.
 */
export function montarPlanoDoErp(contas: ContaMubi[], competencia: string): ContaPlano[] {
  return contas
    .filter((c) => c.codigo && Number.isFinite(c.valor))
    .map((c) => ({
      id: idConta(competencia, c.codigo),
      competencia,
      codigo: c.codigo,
      nome: c.nome || c.codigo,
      valor: Math.round(c.valor * 100) / 100,
      folha: true,
      origem: "erp" as const,
    }));
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
  somem: number;
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
export function compararPlano(atual: ContaPlano[], novo: ContaPlano[]): ComparacaoPlano {
  const antes = new Map(atual.map((c) => [c.codigo, c]));
  const depois = new Map(novo.map((c) => [c.codigo, c]));
  const codigos = [...new Set([...antes.keys(), ...depois.keys()])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
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
  const soma = (xs: ContaPlano[]) => Math.round(xs.filter((c) => c.folha).reduce((s, c) => s + c.valor, 0) * 100) / 100;
  return {
    linhas,
    iguais: linhas.filter((l) => l.estado === "igual").length,
    mudaram: linhas.filter((l) => l.estado === "mudou").length,
    novas: linhas.filter((l) => l.estado === "nova").length,
    somem: linhas.filter((l) => l.estado === "some").length,
    totalAntes: soma(atual),
    totalDepois: soma(novo),
  };
}
