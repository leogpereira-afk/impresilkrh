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
export async function buscarPagamentosMubi(competencia: string): Promise<RespostaMubi> {
  if (!supabase || !FN_MUBI_PAGAMENTOS) throw new Error("Nuvem não configurada.");
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao?.session?.access_token;
  if (!token) throw new Error("Faça login novamente para buscar do Mubisys.");

  const r = await fetch(FN_MUBI_PAGAMENTOS, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ competencia }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo?.erro || `Falha ao consultar o Mubisys (${r.status}).`);
  return corpo as RespostaMubi;
}

/**
 * Acha o colaborador de um nome vindo do ERP.
 * Ordem: vínculo salvo pelo RH → nome igual → todos os pedaços do nome do
 * cadastro cabem no nome do ERP (resolve o abreviado "F." x "Ferreira").
 */
export function casarColaborador(
  nomeMubi: string,
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): Colaborador | null {
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
    // Vem do id do título no ERP: reimportar o mesmo mês atualiza em vez de duplicar.
    id: `mubi-${l.idMubi}`,
    colaboradorId,
    competencia: competenciaDe(l),
    tipo: l.tipo,
    valor: l.valor,
    dataPagamento: l.dataVencimento,
    descricao: [l.descricao, l.planoContas].filter(Boolean).join(" · ") || undefined,
  };
}

/**
 * Converte a resposta do ERP no MESMO formato que a importação por planilha
 * devolve, para reaproveitar a conciliação que já existe (prévia com o que é
 * novo, o que mudou e o que sumiu).
 *
 * Linhas sem nome (bolo de aniversário, Uber, reembolso) não são de ninguém:
 * ficam de fora dos registros e são devolvidas à parte, como despesa coletiva.
 */
export function paraRegistros(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): { registros: Pagamento[]; naoCasados: string[]; coletivas: LinhaMubi[] } {
  const registros: Pagamento[] = [];
  const naoCasados = new Set<string>();
  const coletivas: LinhaMubi[] = [];

  for (const l of linhas) {
    if (!l.nome.trim()) { coletivas.push(l); continue; }
    const c = casarColaborador(l.nome, colaboradores, vinculos);
    if (!c) { naoCasados.add(l.nome.trim()); continue; }
    registros.push(montarPagamento(l, c.id));
  }
  return { registros, naoCasados: [...naoCasados], coletivas };
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
    const c = casarColaborador(l.nome, colaboradores, vinculos);
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
