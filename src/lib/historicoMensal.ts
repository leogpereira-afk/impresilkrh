// ============================================================================
// Histórico mensal — a conta por trás de "quanto foi por mês" (do colaborador
// e do custo global). Puro e testado: a tela só desenha.
// ============================================================================

export interface PontoMensal {
  competencia: string; // "2026-08"
  valor: number;
  /**
   * O valor deste mês NÃO é o número do mês — é o pedaço que se sabe.
   *
   * No Custo Global, o plano de jul/2026 em diante veio sem a folha: a coluna
   * mostra "—" e o quadro amarelo explica. Só que o gráfico, os quatro tiles e
   * o "Custo do período" continuavam somando o pedaço como se fosse o mês
   * inteiro — a mesma tela dizia "não sei" e "R$ 492.581,23" ao mesmo tempo.
   * Ponto incompleto entra na LISTA (o mês existe) e fica fora de toda conta.
   */
  incompleto?: boolean;
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
  /** Quantos meses ficaram FORA das contas por estarem incompletos. */
  mesesIncompletos: number;
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
  const incompletos = new Set<string>();
  for (const p of pontos) {
    if (!p || !p.competencia) continue;
    porComp.set(p.competencia, arred((porComp.get(p.competencia) ?? 0) + (Number(p.valor) || 0)));
    if (p.incompleto) incompletos.add(p.competencia);
  }
  const ordenados = [...porComp.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([competencia, valor]) => ({ competencia, valor, incompleto: incompletos.has(competencia) }));
  const meses = ordenados.length;
  if (meses === 0) return { meses: 0, mesesIncompletos: 0, total: 0, media: 0, maior: null, menor: null, ultimo: null, ultimoVsMedia: null, linhas: [] };

  // TODA CONTA IGNORA O MÊS INCOMPLETO. Ele continua na lista, com a marca —
  // some do total, da média, do maior, do menor e da barra proporcional.
  const contaveis = ordenados.filter((p) => !p.incompleto);
  const mesesIncompletos = meses - contaveis.length;
  const total = arred(contaveis.reduce((s, p) => s + p.valor, 0));
  const media = contaveis.length ? arred(total / contaveis.length) : 0;
  let maior = contaveis[0] ?? null;
  let menor = contaveis[0] ?? null;
  for (const p of contaveis) {
    if (maior && p.valor > maior.valor) maior = p; // empate: fica o mais antigo
    if (menor && p.valor < menor.valor) menor = p;
  }
  const ultimo = [...contaveis].reverse()[0] ?? null;
  const ultimoVsMedia = ultimo && media > 0 ? (ultimo.valor - media) / media : null;

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
      parcela: !p.incompleto && maior && maior.valor > 0 ? Math.max(0, Math.min(1, p.valor / maior.valor)) : 0,
      lacuna: !!ant && mesAnterior(p.competencia) !== ant.competencia,
      ano,
      primeiroDoAno,
    };
  });

  return { meses, mesesIncompletos, total, media, maior, menor, ultimo, ultimoVsMedia, linhas };
}
