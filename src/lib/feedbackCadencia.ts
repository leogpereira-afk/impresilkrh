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
import {
  PALAVRAS_BLOQUEIO_GRAVE, PALAVRAS_BLOQUEIO_SENSIVEL, EFEITO_ROTA_SEGURANCA,
} from "@/lib/constants";

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
  /** Conversa com a EQUIPE: mesmo texto em várias fichas. */
  grupoId?: string | null;
  /** "treinamento" = fala do curso, não do serviço do dia a dia. */
  origem?: string | null;
  /* As três etapas — ver jaFoiDado. */
  preparadoEm?: string | null;
  agendadaPara?: string | null;
  ocorridoEm?: string | null;
}

export type SituacaoFeedback = "nunca" | "atrasado" | "a-vencer" | "em-dia";

/**
 * Esta conversa ACONTECEU?
 *
 * Feedback preparado ou agendado ainda não é feedback dado, e tratar como se
 * fosse seria o pior defeito possível nesta tela: preparar tiraria a pessoa da
 * fila sem ninguém ter falado com ela, e o sistema passaria a dizer "em dia"
 * para quem está esperando há meses.
 *
 * Registro ANTIGO não tem nenhuma das datas novas — e esse conta como dado,
 * porque na época só se registrava depois da conversa. Exigir `ocorridoEm`
 * jogaria o histórico inteiro para "nunca recebeu".
 */
export function jaFoiDado(f: {
  preparadoEm?: string | null; agendadaPara?: string | null; ocorridoEm?: string | null;
}): boolean {
  if (f.ocorridoEm) return true;
  // Só está "em preparo" quem foi explicitamente preparado ou agendado.
  return !f.preparadoEm && !f.agendadaPara;
}

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
  /* Cada pessoa pode ter um ritmo próprio (30 dias em experiência, 45 com plano
     aberto) — ver cadenciaDaPessoa. Sem passar, vale o padrão de 90. */
  cadenciaDias: number = CADENCIA_FEEDBACK_DIAS,
): Cadencia {
  /* CONVERSA COM A EQUIPE conta menos que conversa individual, e a diferença
     importa: ela tira a pessoa de "nunca recebeu" — porque de fato houve
     conversa e ela ouviu —, mas NÃO zera o relógio da cadência. Se zerasse,
     bastaria um elogio coletivo por trimestre para o quadro inteiro aparecer
     "em dia" sem ninguém nunca ter tido uma conversa sobre o próprio trabalho.
     O relógio individual segue contando a partir do último feedback INDIVIDUAL. */
  // Só conversa que ACONTECEU move o relógio — ver jaFoiDado.
  const dados = feedbacksDaPessoa.filter(jaFoiDado);
  const ultimo = ultimoFeedback(dados);
  /* O relógio da cadência conta só a CONVERSA SOBRE O TRABALHO: individual e
     sem origem externa. Feedback de treinamento fala do curso que a pessoa fez;
     tratá-lo como conversa de trabalho faria o histórico dizer que houve
     conversa quando o que houve foi um elogio no fim de um treinamento — e o RH
     leria a ficha errado na hora de decidir efetivação ou promoção. */
  const ultimoIndividual = ultimoFeedback(
    dados.filter((f) => !f.grupoId && !f.origem),
  );
  const marco = ultimoIndividual?.criadoEm ?? dataAdmissao ?? null;
  if (!marco) return { ultimo, diasDesde: null, diasParaProximo: null, situacao: "nunca" };

  // `diasDeCalendario` ancora no início do dia — a conta crua de milissegundos
  // faria o mesmo registro dizer "89 dias" de manhã e "90" depois do almoço.
  const desde = -diasDeCalendario(marco, hoje);
  if (isNaN(desde)) return { ultimo, diasDesde: null, diasParaProximo: null, situacao: "nunca" };

  const diasParaProximo = cadenciaDias - desde;
  const situacao: SituacaoFeedback = !ultimoIndividual && diasParaProximo > 0
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

// ============================================================================
// O REGISTRO ESTRUTURADO — regras vindas da pesquisa e das duas críticas.
// ============================================================================

export type MotivoBloqueio = "grave" | "sensivel" | null;

/**
 * Este texto pode ser gravado aqui?
 *
 * Avisar, permitir e guardar é a pior das três opções: assédio e agressão têm
 * canal próprio (Lei 14.457/2022, art. 23, para empresa com CIPA), e saúde,
 * religião, sindicato e deficiência são dado SENSÍVEL com base legal própria
 * (art. 11 da LGPD). Nos dois casos a gravação é BLOQUEADA e o texto não é
 * guardado em lugar nenhum.
 *
 * O que NÃO foi feito de propósito: aviso suave sobre adjetivos ("preguiçoso",
 * "relaxado", "vive fazendo"). Corrigir o jeito de falar de quem escreve produz
 * "conversamos, ok" — e o sistema perde o conteúdo. A proteção contra julgar a
 * pessoa é o RÓTULO do campo ("O que aconteceu", não "como ele é").
 */
export function bloqueio(texto: string): MotivoBloqueio {
  const t = ` ${String(texto ?? "").toLowerCase()} `;
  // Fronteira de palavra: sem isto "acidente" acha "acidentalmente" e
  // "droga" acha "drogaria" — bloqueio falso ensina a contornar a tela.
  const acha = (lista: readonly string[]) =>
    lista.some((p) => new RegExp(`(^|[^a-zà-ú])${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-zà-ú]|$)`, "i").test(t));
  if (acha(PALAVRAS_BLOQUEIO_GRAVE)) return "grave";
  if (acha(PALAVRAS_BLOQUEIO_SENSIVEL)) return "sensivel";
  return null;
}

/** "Risco de segurança" não é etiqueta, é rota: fecha o feedback e abre o
 *  registro de segurança. Um combinado "usar o cinto" sem medida nenhuma é,
 *  numa ação de acidente, prova de que a empresa conhecia o risco e tolerou. */
export const ehRotaSeguranca = (efeito?: string | null) => efeito === EFEITO_ROTA_SEGURANCA;

export interface CombinadoLike {
  combinado?: string;
  combinadoPrazo?: string | null;
  combinadoGatilho?: string | null;
  desfecho?: string | null;
  ocorridoEm?: string;
  criadoEm: string;
}

/** O combinado mais recente que ainda não teve desfecho. */
export function combinadoEmAberto<T extends CombinadoLike>(lista: readonly T[]): T | null {
  const abertos = lista.filter((f) => f.combinado && !f.desfecho);
  if (!abertos.length) return null;
  return [...abertos].sort((a, b) =>
    (b.ocorridoEm ?? b.criadoEm).localeCompare(a.ocorridoEm ?? a.criadoEm))[0];
}

/** Venceu? "Na próxima peça" NUNCA vence por calendário — vence no encontro. */
export function combinadoVencido(f: CombinadoLike | null, hoje: Date = HOJE): boolean {
  if (!f?.combinado || f.desfecho) return false;
  if (f.combinadoGatilho === "proxima-peca") return false;
  if (!f.combinadoPrazo) return false;
  return diasDeCalendario(f.combinadoPrazo, hoje) < 0;
}

/* CADÊNCIA POR SITUAÇÃO. Os 90 dias uniformes faziam o primeiro feedback de um
   recém-contratado cair no dia 90 — o MESMO dia em que o contrato de
   experiência vira indeterminado sozinho, e a decisão de efetivar chegava sem
   nenhuma conversa escrita para sustentá-la. */
export const CADENCIA_EXPERIENCIA_DIAS = 30;
export const CADENCIA_PLANO_DIAS = 45;

export function cadenciaDaPessoa(opts: {
  emExperiencia?: boolean;
  comPlanoAberto?: boolean;
}): number {
  if (opts.emExperiencia) return CADENCIA_EXPERIENCIA_DIAS;
  if (opts.comPlanoAberto) return CADENCIA_PLANO_DIAS;
  return CADENCIA_FEEDBACK_DIAS;
}

/** Monta o texto que as telas antigas leem e que a pessoa vê na ficha dela.
 *  Sem "Ele respondeu: …" — anotação unilateral rotulada como fala do
 *  trabalhador convida à alegação de falsidade e derruba o registro inteiro. */
export function montarConteudo(r: {
  oQueAconteceu?: string; efeito?: string; combinado?: string;
  combinadoPrazo?: string | null; combinadoGatilho?: string | null;
}): string {
  const partes = [String(r.oQueAconteceu ?? "").trim()];
  if (r.efeito) partes.push(`No que deu: ${r.efeito}.`);
  if (r.combinado) {
    const quando = r.combinadoGatilho === "proxima-peca"
      ? "na próxima peça"
      : r.combinadoPrazo ? `até ${r.combinadoPrazo.slice(8, 10)}/${r.combinadoPrazo.slice(5, 7)}` : null;
    partes.push(`Combinado: ${r.combinado.trim()}${quando ? ` (${quando})` : ""}.`);
  }
  return partes.filter(Boolean).join(" ");
}
