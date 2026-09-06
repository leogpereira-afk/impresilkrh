// ============================================================================
// Histórico mensal — a conta por trás de "quanto foi por mês" (do colaborador
// e do custo global). Puro e testado: a tela só desenha.
// ============================================================================

export interface PontoMensal {
  competencia: string; // "2026-08"
  valor: number;
}

export interface LinhaHistorico extends PontoMensal {
  /** Valor do ponto anterior na série (null no primeiro). */
  anterior: number | null;
  /** valor − anterior (null no primeiro). */
  delta: number | null;
  /** delta ÷ anterior (null quando não há anterior ou ele é zero). */
  pct: number | null;
  /** valor ÷ maior da série, 0..1 — para a barra proporcional. */
  parcela: number;
  /** O mês imediatamente anterior NÃO tem ponto: a comparação pula um buraco. */
  lacuna: boolean;
  ano: number;
  /** Primeiro ponto de cada ano — onde a lista mostra o divisor. */
  primeiroDoAno: boolean;
}

export interface ResumoHistorico {
  meses: number;
  total: number;
  media: number;
  maior: PontoMensal | null;
  menor: PontoMensal | null;
  ultimo: PontoMensal | null;
  /** (último − média) ÷ média; null sem média. */
  ultimoVsMedia: number | null;
  linhas: LinhaHistorico[];
}

/** "2026-01" → "2025-12" */
export function mesAnterior(comp: string): string {
  const [a, m] = comp.split("-").map(Number);
  if (!a || !m) return "";
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const arred = (v: number) => Math.round(v * 100) / 100;

export function resumirHistorico(pontos: PontoMensal[]): ResumoHistorico {
  // Soma pontos repetidos da mesma competência: quem chama pode mandar linha a
  // linha, e duas linhas do mesmo mês não podem virar dois meses.
  const porComp = new Map<string, number>();
  for (const p of pontos) {
    if (!p || !p.competencia) continue;
    porComp.set(p.competencia, arred((porComp.get(p.competencia) ?? 0) + (Number(p.valor) || 0)));
  }
  const ordenados = [...porComp.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([competencia, valor]) => ({ competencia, valor }));
  const meses = ordenados.length;
  if (meses === 0) return { meses: 0, total: 0, media: 0, maior: null, menor: null, ultimo: null, ultimoVsMedia: null, linhas: [] };

  const total = arred(ordenados.reduce((s, p) => s + p.valor, 0));
  const media = arred(total / meses);
  let maior = ordenados[0];
  let menor = ordenados[0];
  for (const p of ordenados) {
    if (p.valor > maior.valor) maior = p; // empate: fica o mais antigo
    if (p.valor < menor.valor) menor = p;
  }
  const ultimo = ordenados[meses - 1];
  const ultimoVsMedia = media > 0 ? (ultimo.valor - media) / media : null;

  let anoAnterior = -1;
  const linhas: LinhaHistorico[] = ordenados.map((p, i) => {
    const ant = i > 0 ? ordenados[i - 1] : null;
    const anterior = ant ? ant.valor : null;
    const delta = anterior == null ? null : arred(p.valor - anterior);
    // Sem percentual quando o mês anterior não é positivo: dividir por um total
    // negativo (mês de estorno) troca o SINAL — subir R$ 150 sobre −50 saía como
    // "−300%" ao lado de uma seta de alta. Sem base, só o valor em reais.
    const pct = anterior == null || anterior <= 0 ? null : (p.valor - anterior) / anterior;
    const ano = Number(p.competencia.slice(0, 4)) || 0;
    const primeiroDoAno = ano !== anoAnterior;
    anoAnterior = ano;
    return {
      ...p,
      anterior,
      delta,
      pct,
      parcela: maior.valor > 0 ? Math.max(0, Math.min(1, p.valor / maior.valor)) : 0,
      lacuna: !!ant && mesAnterior(p.competencia) !== ant.competencia,
      ano,
      primeiroDoAno,
    };
  });

  return { meses, total, media, maior, menor, ultimo, ultimoVsMedia, linhas };
}
