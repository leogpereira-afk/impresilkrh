// O topo da tela de Custos: "está atualizado?" e "o que mudou?" — as duas
// perguntas que a auditoria de 06/09/2026 achou a seis telas de rolagem uma da
// outra.
//
// Duas regras vivem aqui, puras e testadas:
//
//   variacaoMensal   — quanto o mês custou a mais (ou a menos) que o anterior, e
//                      QUEM explica a diferença. Em agosto/2026 o total subiu
//                      R$ 20.683 (+33,5%) e a base de salário+adiantamento só
//                      R$ 758: quase tudo era diária e hora extra. Um número
//                      sozinho ("+33,5%") assusta; a decomposição explica.
//
//   sinaisDaCompetencia — o semáforo: folha do ERP, plano de contas, pendências
//                      e última conciliação, cada um com tom (ok / atenção /
//                      ruim). Zero aqui NUNCA é resultado: mês sem plano de
//                      contas mostra "ausente", não "R$ 0,00" de rateio.
import { TIPOS_BASE_ENCARGOS } from "./encargos";
import type { DiagnosticoCompetencia } from "./custos";
import type { Config } from "@/data/types";

type Pag = { competencia: string; tipo: string; valor: number; colaboradorId?: string };

// ---------------------------------------------------------------------------
// Variação contra o mês anterior
// ---------------------------------------------------------------------------

export interface MotorDaVariacao {
  tipo: string;
  atual: number;
  anterior: number;
  delta: number;
}

export interface VariacaoMensal {
  /** Falso quando não há competência anterior com folha: aí não existe variação. */
  temAnterior: boolean;
  compAnterior: string | null;
  /** Pago à pessoa (sem FGTS/INSS lançados, que são custo da empresa). */
  pago: number;
  pagoAnterior: number;
  delta: number;
  /** Nulo quando o mês anterior é zero — dividir por zero não é percentual. */
  pct: number | null;
  /** Salário + adiantamento — a base sobre a qual se provisiona. */
  base: number;
  baseAnterior: number;
  deltaBase: number;
  /** delta − deltaBase: o que mudou FORA da base (diária, extra, faxina…). */
  deltaForaDaBase: number;
  /** Por tipo, do maior |delta| para o menor. Tipo sem mudança fica de fora. */
  motores: MotorDaVariacao[];
  /**
   * Fração do delta que os `n` maiores motores NO MESMO SENTIDO explicam
   * (0,91 = "diárias e horas extras explicam 91% do aumento"). Nulo quando
   * não há delta.
   */
  parcelaDosMaiores: number | null;
  quantosMaiores: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

function somaPorTipo(pags: Pag[], comp: string, ignorar: readonly string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of pags) {
    if (p.competencia !== comp || ignorar.includes(p.tipo)) continue;
    m.set(p.tipo, (m.get(p.tipo) ?? 0) + (p.valor || 0));
  }
  return m;
}

/**
 * Competência imediatamente anterior COM folha. Não é "mês − 1": setembro sem
 * lançamento ainda não é comparação para agosto — é ausência.
 */
export function competenciaAnteriorComFolha(comp: string, pags: Pag[]): string | null {
  const antes = [...new Set(pags.map((p) => p.competencia))].filter((c) => c && c < comp).sort();
  return antes.length ? antes[antes.length - 1] : null;
}

export function variacaoMensal(
  pags: Pag[],
  comp: string,
  tiposEncargo: readonly string[],
  quantosMaiores = 2,
): VariacaoMensal {
  const compAnterior = competenciaAnteriorComFolha(comp, pags);
  const base = TIPOS_BASE_ENCARGOS as readonly string[];
  const atual = somaPorTipo(pags, comp, tiposEncargo);
  const anterior = compAnterior ? somaPorTipo(pags, compAnterior, tiposEncargo) : new Map<string, number>();

  const total = (m: Map<string, number>) => [...m.values()].reduce((s, v) => s + v, 0);
  const soBase = (m: Map<string, number>) => [...m].filter(([t]) => base.includes(t)).reduce((s, [, v]) => s + v, 0);

  const pago = r2(total(atual));
  const pagoAnterior = r2(total(anterior));
  const baseAtual = r2(soBase(atual));
  const baseAnterior = r2(soBase(anterior));
  const delta = r2(pago - pagoAnterior);
  const deltaBase = r2(baseAtual - baseAnterior);

  const tipos = new Set([...atual.keys(), ...anterior.keys()]);
  const motores: MotorDaVariacao[] = [];
  for (const tipo of tipos) {
    const a = r2(atual.get(tipo) ?? 0);
    const b = r2(anterior.get(tipo) ?? 0);
    const d = r2(a - b);
    if (d !== 0) motores.push({ tipo, atual: a, anterior: b, delta: d });
  }
  motores.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.tipo.localeCompare(y.tipo, "pt-BR"));

  // Só os motores que puxam NO SENTIDO do delta contam para "explicam N%": se o
  // total subiu, uma queda de férias não explica a subida — ela a atenua.
  let parcela: number | null = null;
  if (delta !== 0 && compAnterior) {
    const sinal = Math.sign(delta);
    const noSentido = motores.filter((m) => Math.sign(m.delta) === sinal).slice(0, quantosMaiores);
    const soma = noSentido.reduce((s, m) => s + m.delta, 0);
    parcela = Math.min(1, Math.abs(soma) / Math.abs(delta));
  }

  return {
    temAnterior: compAnterior != null,
    compAnterior,
    pago,
    pagoAnterior,
    delta,
    pct: compAnterior && pagoAnterior !== 0 ? delta / pagoAnterior : null,
    base: baseAtual,
    baseAnterior,
    deltaBase,
    deltaForaDaBase: r2(delta - deltaBase),
    motores,
    parcelaDosMaiores: parcela,
    quantosMaiores,
  };
}

// ---------------------------------------------------------------------------
// O semáforo da competência
// ---------------------------------------------------------------------------

export type Tom = "ok" | "atencao" | "ruim" | "neutro";

export interface Sinal {
  id: "folha" | "plano" | "pendencias" | "conciliacao";
  rotulo: string;
  /** O número ou a palavra que o chip mostra grande. */
  valor: string;
  tom: Tom;
  /** Uma linha que diz por que o tom é esse. */
  detalhe: string;
}

export interface EntradaSinais {
  comp: string;
  /** Lançamentos gravados nesta competência, e quantos deles são manuais. */
  gravados: number;
  manuais: number;
  /** Contas do plano nesta competência (0 = ausente). */
  contasNoPlano: number;
  conferencia: Pick<DiagnosticoCompetencia, "estado" | "semSalario">;
  ultimaBusca: Config["ultimaBuscaMubi"];
  ultimaConciliacao: Config["ultimaConciliacaoMubi"];
}

const dataHora = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm} ${hh}:${mi}`;
};

export function sinaisDaCompetencia(e: EntradaSinais): Sinal[] {
  const { comp, gravados, manuais, contasNoPlano, conferencia, ultimaBusca, ultimaConciliacao } = e;

  // --- Folha do ERP -------------------------------------------------------
  const buscaCobreEsteMes = !!ultimaBusca && ultimaBusca.competencia === comp;
  let folha: Sinal;
  if (gravados === 0) {
    folha = {
      id: "folha", rotulo: "Folha do ERP", valor: "sem folha", tom: "ruim",
      detalhe: buscaCobreEsteMes
        ? `A busca de ${dataHora(ultimaBusca!.em)} não achou lançamento de pessoal neste mês.`
        : "Nenhum lançamento gravado nesta competência. Use \"Buscar do Mubisys\".",
    };
  } else if (buscaCobreEsteMes) {
    const b = ultimaBusca!;
    // O que explica "consultou 140, gravou 141": os gravados que NÃO vieram
    // desta busca — lançados à mão ou mantidos de uma busca anterior.
    const foraDaBusca = Math.max(0, gravados - b.quantidade);
    const partes = [`${b.quantidade} vinculado(s) na busca de ${dataHora(b.em)}`];
    if (b.naoCasados) partes.push(`${b.naoCasados} sem par no cadastro`);
    if (foraDaBusca > 0) partes.push(`${foraDaBusca} gravado(s) fora desta busca${manuais ? ` (${manuais} manual)` : ""}`);
    if (b.truncado) partes.push("busca veio cortada");
    folha = {
      id: "folha", rotulo: "Folha do ERP", valor: `${gravados} gravados`,
      tom: b.truncado || (b.naoCasados ?? 0) > 0 ? "atencao" : "ok",
      detalhe: partes.join(" · "),
    };
  } else {
    folha = {
      id: "folha", rotulo: "Folha do ERP", valor: `${gravados} gravados`, tom: "neutro",
      detalhe: ultimaBusca
        ? `Última busca foi de outro mês (${dataHora(ultimaBusca.em)}). Este mês vem do que já estava gravado.`
        : "Nunca houve busca no Mubisys — o que está aqui veio de planilha.",
    };
  }

  // --- Plano de contas ----------------------------------------------------
  let plano: Sinal;
  if (contasNoPlano > 0) {
    plano = { id: "plano", rotulo: "Plano de contas", valor: `${contasNoPlano} contas`, tom: "ok", detalhe: "Rateio e Custo Global calculados com a planilha do contador." };
  } else if (gravados > 0) {
    plano = { id: "plano", rotulo: "Plano de contas", valor: "ausente", tom: "ruim", detalhe: "Sem a planilha do contador, rateio e Custo Global ficam INDISPONÍVEIS — não zerados." };
  } else {
    plano = { id: "plano", rotulo: "Plano de contas", valor: "ausente", tom: "neutro", detalhe: "Mês sem folha e sem plano." };
  }

  // --- Pendências ---------------------------------------------------------
  const semSalario = conferencia.semSalario.length;
  const naoCasados = buscaCobreEsteMes ? (ultimaBusca?.naoCasados ?? 0) : 0;
  const total = semSalario + naoCasados;
  const itens: string[] = [];
  if (semSalario) itens.push(`${semSalario} com adiantamento e sem salário${conferencia.estado === "aguardando" ? " (a folha ainda vence)" : ""}`);
  if (naoCasados) itens.push(`${naoCasados} título(s) do ERP sem colaborador`);
  const pendencias: Sinal = {
    id: "pendencias", rotulo: "Pendências",
    valor: total === 0 ? "nenhuma" : String(total),
    tom: total === 0 ? "ok" : conferencia.estado === "incompleta" ? "ruim" : "atencao",
    detalhe: total === 0 ? "Todo mundo com adiantamento tem salário, e todo título tem dono." : itens.join(" · "),
  };

  // --- Última conciliação -------------------------------------------------
  let conciliacao: Sinal;
  if (!ultimaConciliacao) {
    conciliacao = { id: "conciliacao", rotulo: "Última conciliação", valor: "nunca", tom: "neutro", detalhe: "A folha do ERP ainda não foi aplicada por aqui." };
  } else {
    const c = ultimaConciliacao;
    const cobre = c.competencias.includes(comp);
    const partes = [`${c.iguais} iguais`, `${c.corrigidos} corrigidos`, `${c.novos} novos`];
    if (c.mantidos) partes.push(`${c.mantidos} mantidos fora da busca`);
    if (c.removidos) partes.push(`${c.removidos} removidos`);
    conciliacao = {
      id: "conciliacao", rotulo: "Última conciliação", valor: dataHora(c.em),
      tom: cobre ? "ok" : "neutro",
      detalhe: `${partes.join(" · ")}${cobre ? "" : ` — cobriu ${c.competencias.map((x) => x.slice(5) + "/" + x.slice(2, 4)).join(", ")}, não este mês`}`,
    };
  }

  return [folha, plano, pendencias, conciliacao];
}
