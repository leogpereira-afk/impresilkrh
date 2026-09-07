// ============================================================================
// Reserva de encargos — quanto guardar por mês para pagar 13º e férias de uma
// conta própria, sem passar pelo caixa da operação.
//
// Pedido do Leonardo (07/09/2026): "criar um encargos estimados, mês a mês,
// com título em cima com regra mensal e anual, para eu começar a depositar
// esse valor mensalmente". A régua é a MESMA do bloco "Encargos estimados
// sobre o bruto" da ficha (lib/encargos, e as taxas vêm de lá, não copiadas):
// FGTS 8%, 13º 1/12 e férias 1/12 × 1,3333 sobre salário + adiantamento de
// cada pessoa. Sócio não entra (quem chama já filtra).
//
// Três decisões de método que valem dinheiro (revisão adversarial de
// 07/09/2026, 27 achados confirmados):
//
//   • Mês sem folha NÃO é R$ 0,00: é ausência. Fica fora da média e, no total
//     do ano, entra ESTIMADO pela média, com a marca.
//   • Mês PELA METADE (só adiantamento; o salário vence no início do mês
//     seguinte) também fica fora da média — e o que se DEPOSITA nele não é a
//     metade que já entrou, é a média. Depositar metade num mês inteiro era o
//     erro mais caro da primeira versão: o card dizia "Depositar em Set" com
//     ~40% do valor.
//   • Aguardando ≠ buraco. "Aguardando" é o mês corrente, que ainda vai
//     fechar; "buraco" é o mês cuja janela já fechou e continua sem salário —
//     esse não sobe sozinho, precisa de "Puxar histórico".
// ============================================================================
import { FGTS_PCT, PROVISAO_13, PROVISAO_FERIAS, calcularEncargos } from "./encargos";

export interface PagReserva {
  competencia: string;
  tipo: string;
  valor: number;
  colaboradorId?: string;
}

/** O que a reserva FUNDA: as duas provisões que ela guarda mês a mês. */
export const TIPOS_DA_RESERVA = ["13º Salário", "Férias"] as const;
/**
 * Acertos que saem da folha mas a reserva NÃO cobre: rescisão (saldo de
 * salário, aviso prévio) e o FGTS por pessoa que chega do ERP, que é o
 * rescisório/multa — a guia mensal é coletiva e nem aparece por pessoa.
 */
export const TIPOS_FORA_DA_RESERVA = ["Rescisão", "FGTS"] as const;

export interface EncargosDoMes {
  competencia: string;
  /** Base: salário + adiantamento. */
  base: number;
  fgts: number;
  decimoTerceiro: number;
  ferias: number;
  /** O que a folha DESTE mês gera de provisão (13º + férias, mais FGTS se incluído). */
  deposito: number;
  /** Quantas pessoas têm base no mês. */
  pessoas: number;
  /** 13º e férias que saíram no mês — é o que a reserva teria pago. */
  acertosDaReserva: number;
  /** Rescisão e FGTS rescisório que saíram no mês — a reserva não cobre. */
  acertosFora: number;
  acertosPorTipo: { tipo: string; valor: number }[];
  /** true quando há salário/adiantamento no mês. */
  temFolha: boolean;
}

export interface Opcoes {
  /** FGTS 8% entra no depósito? (ele já sai todo mês pela guia; é escolha do dono.) */
  incluirFgts: boolean;
}

export const OPCOES_PADRAO: Opcoes = { incluirFgts: true };

/** A fração do salário que a reserva guarda por mês — a régua, num número só. */
export const taxaDaReserva = (opcoes: Opcoes = OPCOES_PADRAO): number =>
  (opcoes.incluirFgts ? FGTS_PCT : 0) + PROVISAO_13 + PROVISAO_FERIAS;

const num = (v: unknown) => Number(v) || 0;

/** Os encargos estimados do mês, para o conjunto de pagamentos dado. */
export function encargosDoMes(pags: PagReserva[], comp: string, opcoes: Opcoes = OPCOES_PADRAO): EncargosDoMes {
  const doMes = pags.filter((p) => p.competencia === comp);
  const enc = calcularEncargos(doMes);
  const comBase = new Set(doMes.filter((p) => p.tipo === "Salário" || p.tipo === "Adiantamento").map((p) => p.colaboradorId).filter(Boolean));
  const acertos = new Map<string, number>();
  const daReserva = TIPOS_DA_RESERVA as readonly string[];
  const fora = TIPOS_FORA_DA_RESERVA as readonly string[];
  let acertosDaReserva = 0;
  let acertosFora = 0;
  for (const p of doMes) {
    const v = num(p.valor);
    if (daReserva.includes(p.tipo)) acertosDaReserva += v;
    else if (fora.includes(p.tipo)) acertosFora += v;
    else continue;
    acertos.set(p.tipo, (acertos.get(p.tipo) ?? 0) + v);
  }
  return {
    competencia: comp,
    base: enc.bruto,
    fgts: enc.fgts,
    decimoTerceiro: enc.decimoTerceiro,
    ferias: enc.ferias,
    deposito: enc.decimoTerceiro + enc.ferias + (opcoes.incluirFgts ? enc.fgts : 0),
    pessoas: comBase.size,
    acertosDaReserva,
    acertosFora,
    acertosPorTipo: [...acertos.entries()].map(([tipo, valor]) => ({ tipo, valor })).sort((a, b) => b.valor - a.valor),
    temFolha: enc.bruto > 0,
  };
}

export interface PessoaEncargos {
  colaboradorId: string;
  base: number;
  fgts: number;
  decimoTerceiro: number;
  ferias: number;
  deposito: number;
}

/** O mês pessoa por pessoa, do maior para o menor. A soma fecha com encargosDoMes. */
export function encargosPorPessoa(pags: PagReserva[], comp: string, opcoes: Opcoes = OPCOES_PADRAO): PessoaEncargos[] {
  const doMes = pags.filter((p) => p.competencia === comp && p.colaboradorId);
  const ids = [...new Set(doMes.map((p) => String(p.colaboradorId)))];
  return ids
    .map((colaboradorId) => {
      const enc = calcularEncargos(doMes.filter((p) => p.colaboradorId === colaboradorId));
      return {
        colaboradorId,
        base: enc.bruto,
        fgts: enc.fgts,
        decimoTerceiro: enc.decimoTerceiro,
        ferias: enc.ferias,
        deposito: enc.decimoTerceiro + enc.ferias + (opcoes.incluirFgts ? enc.fgts : 0),
      };
    })
    .filter((p) => p.base > 0)
    .sort((a, b) => b.deposito - a.deposito);
}

export type OrigemDoMes = "folha" | "parcial" | "buraco" | "estimado" | "vazio";
export type EstadoFolha = "completa" | "aguardando" | "incompleta";

export interface MesDaReserva extends EncargosDoMes {
  /**
   * folha    — folha completa: o número é o que é.
   * parcial  — o mês ainda vai fechar (só adiantamento; o salário vence no
   *            início do mês seguinte). Sobe sozinho quando o salário entrar.
   * buraco   — a janela do mês já fechou e o salário não chegou. NÃO sobe
   *            sozinho: falta importar.
   * estimado — sem folha no sistema: vale a média dos meses completos.
   * vazio    — sem folha e sem média para estimar.
   */
  origem: OrigemDoMes;
  /**
   * O que LEVAR AO BANCO neste mês. Igual ao `deposito` nos meses completos;
   * nos meses pela metade e nos sem folha, a média (nunca menos do que já
   * entrou). É este o número do card e o que soma o ano.
   */
  aDepositar: number;
}

export interface ReservaDoAno {
  ano: number;
  meses: MesDaReserva[];
  /** Média do depósito dos até 12 últimos meses completos até dezembro do ano. */
  mediaMensal: number;
  /** De onde veio a média: quantos meses e qual a faixa. */
  baseDaMedia: { meses: number; de: string | null; ate: string | null };
  /** Soma dos meses de folha completa. */
  realizado: number;
  /** O que falta nos meses pela metade (parcial/buraco) para chegar à média. */
  completado: number;
  /** Soma dos meses sem folha, pela média. */
  estimado: number;
  /** realizado + completado + estimado — o tamanho do ano. */
  totalAno: number;
  mesesCompletos: number;
  mesesPelaMetade: number;
  mesesEstimados: number;
  /** 13º e férias que saíram no ano: o que a reserva teria pago. */
  acertosDaReserva: number;
  /** Rescisão e FGTS rescisório do ano: fora da reserva. */
  acertosFora: number;
}

const compDe = (ano: number, m: number) => `${ano}-${String(m).padStart(2, "0")}`;

/**
 * O ano inteiro, mês a mês, com a regra mensal (média) e a anual (total).
 *
 * `estadoDe(comp)` diz se a folha do mês está completa, aguardando ou com
 * buraco; sem ela, todo mês com base conta como completo.
 */
export function reservaDoAno(
  pags: PagReserva[],
  ano: number,
  opcoes: Opcoes = OPCOES_PADRAO,
  estadoDe?: (comp: string) => EstadoFolha,
): ReservaDoAno {
  const estado = (comp: string): EstadoFolha => (estadoDe ? estadoDe(comp) : "completa");
  const brutos = Array.from({ length: 12 }, (_, i) => encargosDoMes(pags, compDe(ano, i + 1), opcoes));

  // A média é uma JANELA MÓVEL de até 12 meses completos até dezembro do ano
  // escolhido — não "os meses completos deste ano". Com a régua velha, em
  // janeiro o depósito fixo era a média dos 12 anteriores e em fevereiro
  // virava janeiro sozinho: um depósito "fixo" que mudava todo mês.
  const fim = `${ano}-12`;
  const janela = [...new Set(pags.map((p) => p.competencia).filter(Boolean))]
    .filter((c) => c <= fim)
    .sort()
    .map((c) => encargosDoMes(pags, c, opcoes))
    .filter((m) => m.temFolha && estado(m.competencia) === "completa")
    .slice(-12);
  const mediaMensal = janela.length ? janela.reduce((s, m) => s + m.deposito, 0) / janela.length : 0;

  const meses: MesDaReserva[] = brutos.map((m) => {
    if (m.temFolha) {
      const e = estado(m.competencia);
      const origem: OrigemDoMes = e === "completa" ? "folha" : e === "aguardando" ? "parcial" : "buraco";
      // Mês pela metade: o que falta é o salário, não o depósito. Leva a
      // média — e nunca menos do que a folha do mês já gerou.
      const aDepositar = origem === "folha" ? m.deposito : Math.max(m.deposito, mediaMensal);
      return { ...m, origem, aDepositar };
    }
    if (mediaMensal > 0) {
      // A média vira um mês "típico": base típica e as três parcelas na mesma
      // proporção, com as taxas de lib/encargos (nunca copiadas aqui).
      const tipico = calcularEncargos([{ tipo: "Salário", valor: mediaMensal / taxaDaReserva(opcoes) }]);
      return {
        ...m,
        base: tipico.bruto,
        fgts: tipico.fgts,
        decimoTerceiro: tipico.decimoTerceiro,
        ferias: tipico.ferias,
        deposito: mediaMensal,
        origem: "estimado",
        aDepositar: mediaMensal,
      };
    }
    return { ...m, origem: "vazio", aDepositar: 0 };
  });

  const soma = (f: (m: MesDaReserva) => number) => meses.reduce((s, m) => s + f(m), 0);
  const pelaMetade = meses.filter((m) => m.origem === "parcial" || m.origem === "buraco");
  return {
    ano,
    meses,
    mediaMensal,
    baseDaMedia: { meses: janela.length, de: janela[0]?.competencia ?? null, ate: janela[janela.length - 1]?.competencia ?? null },
    realizado: meses.filter((m) => m.origem === "folha").reduce((s, m) => s + m.deposito, 0),
    completado: pelaMetade.reduce((s, m) => s + m.aDepositar, 0),
    estimado: meses.filter((m) => m.origem === "estimado").reduce((s, m) => s + m.aDepositar, 0),
    totalAno: soma((m) => m.aDepositar),
    mesesCompletos: meses.filter((m) => m.origem === "folha").length,
    mesesPelaMetade: pelaMetade.length,
    mesesEstimados: meses.filter((m) => m.origem === "estimado").length,
    acertosDaReserva: soma((m) => m.acertosDaReserva),
    acertosFora: soma((m) => m.acertosFora),
  };
}

/** Anos que têm algum pagamento — para o seletor da tela. */
export function anosComFolha(pags: PagReserva[]): number[] {
  return [...new Set(pags.map((p) => Number(String(p.competencia).slice(0, 4))).filter((a) => a > 2000))].sort();
}
