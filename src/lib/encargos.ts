// ============================================================================
// Encargos sobre a folha — quanto um colaborador custa além do que ele recebe.
//
// Estes números estavam soltos dentro da tela de Custos. Regra de dinheiro em
// arquivo de tela é ruim por dois motivos: ninguém acha quando precisa conferir,
// e não dá para testar sem abrir o navegador. Aqui ficam num lugar só, com o
// porquê escrito e cobertos por teste.
// ============================================================================

/**
 * Base de cálculo dos encargos: só Salário + Adiantamento (juntos = 1 salário).
 *
 * Os demais tipos (Limpeza/Faxina, Horas Extras, Comissão...) entram no TOTAL
 * PAGO à pessoa — para saber quanto a Impresilk desembolsou no mês —, mas NÃO
 * geram FGTS/13º/férias neste cálculo. Foi uma decisão explícita do Leonardo em
 * 2026-07: "ele entra no que foi pago no mês mas não entra na composição de
 * encargos".
 */
export const TIPOS_BASE_ENCARGOS = ["Salário", "Adiantamento"] as const;

/** FGTS mensal: 8% sobre o bruto (CLT/Lei 8.036). */
export const FGTS_PCT = 0.08;
/** 13º salário: provisiona 1/12 por mês. */
export const PROVISAO_13 = 1 / 12;
/** Férias + 1/3 constitucional: 1/12 do bruto acrescido de 1/3 (≈ 1,3333). */
export const PROVISAO_FERIAS = (1 / 12) * 1.3333;

export interface Encargos {
  /** Base usada (só salário + adiantamento). */
  bruto: number;
  fgts: number;
  decimoTerceiro: number;
  ferias: number;
  /** FGTS de fato lançado na folha (rescisão etc.), somado por cima. */
  fgtsLancado: number;
  /** Soma de tudo. */
  total: number;
}

/** Soma os lançamentos que formam a base de encargos. */
export function baseEncargos(linhas: { tipo: string; valor: number }[]): number {
  const base = TIPOS_BASE_ENCARGOS as readonly string[];
  return linhas.filter((l) => base.includes(l.tipo)).reduce((s, l) => s + (l.valor || 0), 0);
}

/**
 * Encargos de um colaborador no mês.
 * `fgtsLancado` é o FGTS que apareceu de verdade na folha (rescisão), somado ao
 * estimado em vez de substituí-lo — os dois existem no mesmo mês.
 */
export function calcularEncargos(linhas: { tipo: string; valor: number }[], fgtsLancado = 0): Encargos {
  const bruto = baseEncargos(linhas);
  const fgts = bruto * FGTS_PCT;
  const decimoTerceiro = bruto * PROVISAO_13;
  const ferias = bruto * PROVISAO_FERIAS;
  return {
    bruto,
    fgts,
    decimoTerceiro,
    ferias,
    fgtsLancado,
    total: fgts + decimoTerceiro + ferias + fgtsLancado,
  };
}

/**
 * Separa o que a pessoa recebeu entre DENTRO e FORA da base de encargo.
 *
 * Existe porque a tela mostrava "encargos sobre o bruto (R$ 20.418)" ao lado de
 * um custo pago de R$ 25.788 e não dizia o que eram os R$ 5.370 de diferença.
 * Com a faxina e a empreita voltando do ERP (contas 2.3.2.1 e 2.11.1), essa
 * diferença cresce e a pergunta "então quanto essa pessoa recebeu no total?"
 * passa a valer dinheiro.
 *
 * Decisão do Leonardo, mantida em 01/08/2026 depois de rever os números: esses
 * pagamentos entram no TOTAL RECEBIDO, para ver a pessoa como um todo, mas NÃO
 * viram base de FGTS/13º/férias — a provisão continua igual à que a empresa
 * realmente deve. Ver TIPOS_BASE_ENCARGOS acima.
 *
 * `tiposEncargo` são os lançamentos que são custo da EMPRESA e não pagamento à
 * pessoa (FGTS, INSS): ficam fora dos dois lados para o total não mentir.
 */
export interface RecebidoNoMes {
  /** Dentro da base: Salário + Adiantamento (é o mesmo número do `bruto`). */
  base: number;
  /** Fora da base: faxina, empreita, comissão, extras, benefícios… */
  fora: number;
  /** base + fora = tudo que a pessoa recebeu (sem encargo da empresa). */
  totalRecebido: number;
  /** Detalhe do que está fora, do maior para o menor. */
  linhasFora: { tipo: string; valor: number }[];
}

export function separarRecebido(
  linhas: { tipo: string; valor: number }[],
  tiposEncargo: readonly string[] = [],
): RecebidoNoMes {
  const naBase = TIPOS_BASE_ENCARGOS as readonly string[];
  let base = 0;
  const foraPorTipo = new Map<string, number>();
  for (const l of linhas) {
    if (tiposEncargo.includes(l.tipo)) continue; // custo da empresa, não é recebimento
    const v = l.valor || 0;
    if (naBase.includes(l.tipo)) base += v;
    else foraPorTipo.set(l.tipo, (foraPorTipo.get(l.tipo) ?? 0) + v);
  }
  const linhasFora = [...foraPorTipo.entries()]
    .map(([tipo, valor]) => ({ tipo, valor }))
    .sort((a, b) => b.valor - a.valor);
  const fora = linhasFora.reduce((s, l) => s + l.valor, 0);
  return { base, fora, totalRecebido: base + fora, linhasFora };
}

/**
 * Prefixo das contas de pessoal no plano de contas (grupo "2.1.").
 * O PONTO FINAL É ESSENCIAL: sem ele, "2.1" também casava com 2.10, 2.11 e 2.12
 * — foi exatamente esse bug que fez o total do RH não bater com o do DRE.
 */
export const PREFIXO_FUNCIONARIOS = "2.1.";
export const ehContaDeFuncionarios = (codigo: string) => String(codigo).startsWith(PREFIXO_FUNCIONARIOS);
