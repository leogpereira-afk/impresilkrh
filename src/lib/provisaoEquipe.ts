// O total da equipe no mês — e quanto separar por mês para pagar esses acertos
// de uma conta própria, sem passar pelo caixa da operação (pedido do Leonardo,
// 07/09/2026).
//
// Por que existe: a aba individual respondia "quanto custa o Adilson" e nunca
// "quanto custa a folha inteira deste mês". O número existia solto em outra
// aba, com outra régua. Aqui ele é UM só, testado, e as duas telas o usam.
//
// As três reguas, iguais às do resto da tela (lib/encargos, lib/custos):
//   pago      — o que foi pago ÀS PESSOAS no mês (FGTS/INSS lançados ficam fora:
//               são custo da empresa, não pagamento à pessoa).
//   provisoes — FGTS 8% + 13º + férias sobre salário + adiantamento, mais o
//               FGTS que já foi lançado de verdade no mês.
//   estimado  — pago + provisões. NÃO é o custo patronal completo.
//
// Sócio não entra: quem chama já filtra (pagamentosDaEquipe).
import { calcularEncargos } from "./encargos";
import { TIPOS_ENCARGO } from "./folha";

export interface Pag {
  competencia: string;
  tipo: string;
  valor: number;
  colaboradorId?: string;
}

export interface MesDaEquipe {
  competencia: string;
  pago: number;
  provisoes: number;
  estimado: number;
  /** Base de encargo do mês (salário + adiantamento). */
  base: number;
  /** Quantas pessoas tiveram algum lançamento no mês. */
  pessoas: number;
}

export interface ResumoDaEquipe extends MesDaEquipe {
  /** Média por pessoa no mês (0 quando o mês não tem ninguém). */
  mediaPorPessoa: number;
  /** Os até `meses` meses fechados+aberto até a competência, do mais antigo ao mais novo. */
  serie: MesDaEquipe[];
  /** Média do estimado na série — a reserva mensal sugerida. */
  mediaEstimada: number;
  /** Maior estimado da série: o mês que a conta precisa aguentar. */
  picoEstimado: number;
  competenciaDoPico: string | null;
  /** mediaEstimada × 12 — o tamanho do ano. */
  projecaoAno: number;
  /** Quanto o mês foge da média da série (null quando não há série anterior). */
  pctSobreMedia: number | null;
}

const somaPagos = (ps: Pag[]) =>
  ps.filter((p) => !TIPOS_ENCARGO.includes(p.tipo)).reduce((s, p) => s + (Number(p.valor) || 0), 0);

/** O mês, com a mesma régua da tela. */
export function mesDaEquipe(pags: Pag[], comp: string): MesDaEquipe {
  const doMes = pags.filter((p) => p.competencia === comp);
  const fgtsLancado = doMes.filter((p) => p.tipo === "FGTS").reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const enc = calcularEncargos(doMes, fgtsLancado);
  const pago = somaPagos(doMes);
  return {
    competencia: comp,
    pago,
    provisoes: enc.total,
    estimado: pago + enc.total,
    base: enc.bruto,
    pessoas: new Set(doMes.map((p) => p.colaboradorId).filter(Boolean)).size,
  };
}

/**
 * O mês + a série que serve de base para a reserva.
 *
 * `meses` é o tamanho da janela (12 por padrão). A série só inclui competências
 * que TÊM lançamento: mês vazio no meio não vira R$ 0,00 na média — zero não é
 * resultado, é ausência, e puxaria a reserva para baixo em silêncio.
 */
export function resumoDaEquipe(pags: Pag[], comp: string, meses = 12): ResumoDaEquipe {
  const mes = mesDaEquipe(pags, comp);
  const comps = [...new Set(pags.map((p) => p.competencia).filter(Boolean))]
    .filter((c) => c <= comp)
    .sort()
    .slice(-meses);
  const serie = comps.map((c) => mesDaEquipe(pags, c));
  const mediaEstimada = serie.length ? serie.reduce((s, m) => s + m.estimado, 0) / serie.length : 0;
  const pico = serie.reduce<MesDaEquipe | null>((a, m) => (!a || m.estimado > a.estimado ? m : a), null);
  return {
    ...mes,
    mediaPorPessoa: mes.pessoas > 0 ? mes.estimado / mes.pessoas : 0,
    serie,
    mediaEstimada,
    picoEstimado: pico?.estimado ?? 0,
    competenciaDoPico: pico?.competencia ?? null,
    projecaoAno: mediaEstimada * 12,
    pctSobreMedia: mediaEstimada > 0 ? (mes.estimado - mediaEstimada) / mediaEstimada : null,
  };
}

/** Quanto uma pessoa pesa no estimado do mês (0 a 1). Null quando o mês é zero. */
export function pesoDaPessoa(pags: Pag[], comp: string, colaboradorId: string): number | null {
  const mes = mesDaEquipe(pags, comp);
  if (!(mes.estimado > 0)) return null;
  const dela = pags.filter((p) => p.competencia === comp && p.colaboradorId === colaboradorId);
  const fgtsLancado = dela.filter((p) => p.tipo === "FGTS").reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const enc = calcularEncargos(dela, fgtsLancado);
  return (somaPagos(dela) + enc.total) / mes.estimado;
}
