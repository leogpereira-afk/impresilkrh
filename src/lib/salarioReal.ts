// ============================================================================
// O QUE A EMPRESA PAGA DE VERDADE EM CADA CARGO.
//
// Isto NÃO é a faixa do plano de carreira. A faixa é o que o plano diz que o
// cargo deveria pagar; aqui é o que a contabilidade pagou. Servem a perguntas
// diferentes, e quem está montando uma proposta de contratação precisa da
// segunda: "quanto custa hoje um serralheiro nesta casa".
//
// DUAS ARMADILHAS que o dado do ERP tem, e que fariam o número sair errado:
//
// 1. O salário vem PARTIDO. No Brasil paga-se o adiantamento por volta do dia
//    20 e o saldo no 5º dia útil do mês seguinte. Somar só a rubrica "Salário"
//    daria ~60% do valor; somar só "Adiantamento", ~40%. O mês só está inteiro
//    quando as duas entraram.
//
// 2. O MÊS CORRENTE está pela metade. Medido em 10/08/2026: a competência
//    2026-07 tinha 29 adiantamentos e ZERO salários — o saldo ainda não fora
//    lançado. Usar o mês mais recente mostraria 40% do que se paga, e uma
//    proposta de contratação sairia pela metade. Por isso a conta procura a
//    última competência FECHADA, e a tela diz qual mês está mostrando.
//
// Rubricas variáveis (horas extras, comissão, 13º, incentivos) ficam de fora de
// propósito: elas variam de mês para mês e não são o que se combina numa
// contratação.
// ============================================================================

export interface PagamentoLike {
  colaboradorId: string;
  competencia?: string | null;
  tipo?: string | null;
  valor?: number | null;
}

/** As duas metades do salário mensal. Só elas entram na conta. */
export const RUBRICAS_DO_SALARIO = ["Salário", "Adiantamento"] as const;
/** Sem esta rubrica lançada, o mês ainda não fechou. */
const RUBRICA_QUE_FECHA = "Salário";

/**
 * A última competência com o salário JÁ FECHADO (isto é, com a rubrica
 * "Salário" lançada). Devolve null quando não há nenhuma.
 */
export function ultimaCompetenciaFechada(pagamentos: readonly PagamentoLike[]): string | null {
  let maior: string | null = null;
  for (const p of pagamentos) {
    const c = p.competencia;
    if (!c || p.tipo !== RUBRICA_QUE_FECHA) continue;
    if (!maior || c > maior) maior = c;
  }
  return maior;
}

/** Quanto CADA pessoa recebeu de salário na competência indicada. */
export function salarioPorPessoa(
  pagamentos: readonly PagamentoLike[],
  competencia: string,
): Map<string, number> {
  const m = new Map<string, number>();
  const rubricas = new Set<string>(RUBRICAS_DO_SALARIO);
  for (const p of pagamentos) {
    if (p.competencia !== competencia || !rubricas.has(p.tipo ?? "")) continue;
    const v = Number(p.valor) || 0;
    m.set(p.colaboradorId, (m.get(p.colaboradorId) ?? 0) + v);
  }
  return m;
}

export interface ResumoCargo {
  /** Quantas pessoas do cargo tinham salário pago na competência. */
  quantos: number;
  menor: number;
  maior: number;
  /** MEDIANA, não média: um único salário fora da curva puxa a média e faz a
   *  proposta de contratação sair torta. A mediana descreve o cargo. */
  mediana: number;
}

export function resumoDoCargo(valores: readonly number[]): ResumoCargo | null {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const meio = Math.floor(v.length / 2);
  const mediana = v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
  return { quantos: v.length, menor: v[0], maior: v[v.length - 1], mediana };
}

/**
 * Onde um salário cai entre o MENOR e o MAIOR realmente pagos no cargo.
 * É a régua da realidade, não a do plano — e por isso a tela pode mostrar as
 * duas sem que uma dependa da outra.
 */
export function posicaoEntre(valor: number, menor: number, maior: number): number {
  if (!Number.isFinite(valor)) return 0;
  if (maior <= menor) return 50; // uma pessoa só (ou todas iguais): não há régua
  const pct = ((valor - menor) / (maior - menor)) * 100;
  return Math.min(100, Math.max(0, pct));
}

/**
 * O mês daquela pessoa foi PROPORCIONAL (ela entrou ou saiu no meio dele)?
 *
 * Medido na base real em 10/08/2026, competência 2026-06: um cargo com 7 pessoas
 * mostrava "menor R$ 474,42" e outro, R$ 118,15 — valores abaixo do salário
 * mínimo, que são recortes de quem trabalhou parte do mês. Como referência de
 * contratação isso é veneno: diria que o cargo começa em R$ 474.
 *
 * Estas pessoas saem do RESUMO do cargo (menor/mediana/maior), mas continuam na
 * lista nominal marcadas como proporcionais — sumir com elas seria esconder
 * gente que está no cargo.
 */
export function mesProporcional(
  colab: { dataAdmissao?: string | null; dataDesligamento?: string | null },
  competencia: string,
): boolean {
  // "2026-06" → tudo que começa com isso caiu dentro do mês.
  const dentro = (d?: string | null) => !!d && d.slice(0, 7) === competencia;
  if (dentro(colab.dataAdmissao)) return true;
  if (dentro(colab.dataDesligamento)) return true;
  // Admitida DEPOIS do mês: não deveria ter salário cheio ali.
  if (colab.dataAdmissao && colab.dataAdmissao.slice(0, 7) > competencia) return true;
  return false;
}
