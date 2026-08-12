// ============================================================================
// DE QUANTO EM QUANTO TEMPO CADA PESSOA PRECISA DE FEEDBACK.
//
// A coleção de feedbacks existe desde sempre e tinha QUATRO registros, para três
// pessoas, num quadro de trinta. Não é que ninguém converse — é que a conversa
// não fica registrada, e sem registro não há como saber de quem faz meses que
// não se fala. A tela de feedback não é um arquivo: é a FILA de quem está
// esperando.
//
// A cadência de 90 dias é uma escolha, não uma lei. É o intervalo em que a
// conversa ainda tem contexto (o que aconteceu no trimestre) e cabe na rotina de
// um líder com dez pessoas. Se a Impresilk quiser outro ritmo, muda aqui.
//
// O relógio começa na ADMISSÃO, não no zero. Quem entrou há uma semana não está
// "atrasado" por nunca ter recebido feedback — está no prazo, e tratar isso como
// dívida encheria a fila de gente que acabou de chegar e esvaziaria o sentido do
// aviso.
// ============================================================================

import { diasDeCalendario } from "@/lib/format";
import { HOJE } from "@/data/_gen";

export const CADENCIA_FEEDBACK_DIAS = 90;
/** Quantos dias antes do prazo a pessoa já aparece como "chegando a hora". */
const JANELA_AVISO_DIAS = 15;

export interface FeedbackLike {
  id: string;
  colaboradorId: string;
  criadoEm: string;
  tipo?: string;
  autorId?: string | null;
  conteudo?: string;
}

export type SituacaoFeedback = "nunca" | "atrasado" | "a-vencer" | "em-dia";

export interface Cadencia {
  /** O feedback mais recente desta pessoa, se houver. */
  ultimo: FeedbackLike | null;
  /** Dias desde o último feedback — ou desde a admissão, quando nunca houve. */
  diasDesde: number | null;
  /** Dias até o próximo (negativo = já passou). */
  diasParaProximo: number | null;
  situacao: SituacaoFeedback;
}

/** O mais recente da lista, por `criadoEm`. Empate: o último da lista. */
export function ultimoFeedback(lista: readonly FeedbackLike[]): FeedbackLike | null {
  let melhor: FeedbackLike | null = null;
  for (const f of lista) {
    if (!f?.criadoEm) continue;
    if (!melhor || f.criadoEm >= melhor.criadoEm) melhor = f;
  }
  return melhor;
}

/**
 * A situação de UMA pessoa.
 *
 * `dataAdmissao` é o marco de quem nunca recebeu feedback: sem ela não há como
 * dizer se o silêncio é dívida ou se a pessoa acabou de chegar, e nesse caso a
 * resposta honesta é "nunca" sem cobrar prazo.
 */
export function cadenciaDe(
  feedbacksDaPessoa: readonly FeedbackLike[],
  dataAdmissao?: string | null,
  hoje: Date = HOJE,
): Cadencia {
  const ultimo = ultimoFeedback(feedbacksDaPessoa);
  const marco = ultimo?.criadoEm ?? dataAdmissao ?? null;
  if (!marco) return { ultimo, diasDesde: null, diasParaProximo: null, situacao: "nunca" };

  // `diasDeCalendario` ancora no início do dia — a conta crua de milissegundos
  // faria o mesmo registro dizer "89 dias" de manhã e "90" depois do almoço.
  const desde = -diasDeCalendario(marco, hoje);
  if (isNaN(desde)) return { ultimo, diasDesde: null, diasParaProximo: null, situacao: "nunca" };

  const diasParaProximo = CADENCIA_FEEDBACK_DIAS - desde;
  const situacao: SituacaoFeedback = !ultimo && diasParaProximo > 0
    // Nunca recebeu, mas ainda dentro do prazo desde que entrou: é "nunca" como
    // fato, não como cobrança. Quem lê precisa saber que não há histórico.
    ? "nunca"
    : diasParaProximo < 0 ? "atrasado"
      : diasParaProximo <= JANELA_AVISO_DIAS ? "a-vencer"
        : "em-dia";
  return { ultimo, diasDesde: desde, diasParaProximo, situacao };
}

/** Ordem da fila: quem está esperando há mais tempo aparece primeiro. */
export const PESO_SITUACAO: Record<SituacaoFeedback, number> = {
  atrasado: 0, nunca: 1, "a-vencer": 2, "em-dia": 3,
};

export function compararFila(a: Cadencia, b: Cadencia): number {
  const p = PESO_SITUACAO[a.situacao] - PESO_SITUACAO[b.situacao];
  if (p !== 0) return p;
  // Dentro do mesmo grupo, quem espera há mais tempo primeiro.
  return (b.diasDesde ?? -1) - (a.diasDesde ?? -1);
}
