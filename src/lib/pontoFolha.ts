// ============================================================================
// Converte o que o PONTO apurou (minutos) em DINHEIRO.
//
// O cartão ponto do Secullum já entrega horas extras e faltas calculadas pela
// CLT; aqui elas viram reais, usando o salário do cadastro.
//
// Divisor 220: a jornada da Impresilk (7:30–11:28 e 13:10–18:00, seg–sex) dá
// 8h48 por dia = 44h por semana — exatamente a jornada cujo divisor mensal legal
// é 220 horas. Fica parametrizável porque acordo coletivo pode mudar.
//
// IMPORTANTE: todo valor daqui é SUGESTÃO — a tela deixa o RH editar antes de
// fechar o mês. Por isso `semSalario` é devolvido explicitamente: quem não tem
// salário no cadastro precisa aparecer como pendência, nunca como R$ 0,00 mudo.
//
// Não confundir com `folha.ts`, que agrega os pagamentos JÁ REALIZADOS.
// ============================================================================

export const DIVISOR_MENSAL_PADRAO = 220;

// 50% é o piso da CLT em dia útil; 100% é o usual em domingo/feriado. O RH
// escolhe no lançamento e ainda pode editar o valor final.
export const ADICIONAIS_HE = [
  { fator: 1.5, label: "+50% (dia útil)", curto: "+50%" },
  { fator: 2, label: "+100% (domingo/feriado)", curto: "+100%" },
] as const;
export const FATOR_HE_PADRAO = 1.5;

const centavos = (v: number) => Math.round(v * 100) / 100;
const positivo = (n: number | null | undefined) => (Number.isFinite(n) && (n as number) > 0 ? (n as number) : 0);

/** Valor da hora normal: salário ÷ divisor mensal. */
export function valorHora(salario: number | null | undefined, divisor = DIVISOR_MENSAL_PADRAO): number {
  const s = positivo(salario);
  const d = positivo(divisor) || DIVISOR_MENSAL_PADRAO;
  return centavos(s / d);
}

export interface CalculoHoraExtra {
  minutos: number;
  horas: number;          // decimal (5h37 → 5.62)
  valorHoraNormal: number;
  valorHoraExtra: number; // já com o adicional
  fator: number;
  valor: number;          // total sugerido em R$
  semSalario: boolean;    // true = cadastro sem salário; a tela deve avisar
}

/** Hora extra em R$: (salário ÷ divisor) × fator × horas. */
export function calcularHoraExtra({
  salario, minutos, fator = FATOR_HE_PADRAO, divisor = DIVISOR_MENSAL_PADRAO,
}: {
  salario: number | null | undefined;
  minutos: number;
  fator?: number;
  divisor?: number;
}): CalculoHoraExtra {
  const min = positivo(minutos);
  const horas = min / 60;
  const f = positivo(fator) || FATOR_HE_PADRAO;
  const vhNormal = valorHora(salario, divisor);
  const vhExtra = centavos(vhNormal * f);
  // Arredonda uma vez só, no fim: arredondar a hora e o fator antes de
  // multiplicar pelas horas embutia erro sistemático (sempre p/ o mesmo lado).
  const s = positivo(salario);
  const d = positivo(divisor) || DIVISOR_MENSAL_PADRAO;
  return {
    minutos: min,
    horas,
    valorHoraNormal: vhNormal,
    valorHoraExtra: vhExtra,
    fator: f,
    valor: centavos((s / d) * f * horas),
    // Hora extra NÃO recebe reflexo de DSR aqui (decisão do usuário em
    // 31/07/2026 — o escritório contábil é quem faz esse cálculo, se fizer).
    semSalario: positivo(salario) === 0,
  };
}

/**
 * Dias úteis e de repouso de uma competência "YYYY-MM".
 * Úteis = seg–sex (a empresa não trabalha sábado; as 44h já cabem em 5 dias).
 * Repouso = domingos + feriados informados.
 */
export function diasDaCompetencia(competencia: string, feriadosISO: string[] = []) {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia || "");
  if (!m) return { uteis: 0, repouso: 0, totalDias: 0 };
  const ano = +m[1];
  const mes = +m[2];
  if (mes < 1 || mes > 12) return { uteis: 0, repouso: 0, totalDias: 0 };
  const totalDias = new Date(ano, mes, 0).getDate(); // dia 0 do mês seguinte = último deste
  const feriados = new Set(feriadosISO.map((f) => String(f).slice(0, 10)));
  let uteis = 0;
  let repouso = 0;
  for (let dia = 1; dia <= totalDias; dia++) {
    const semana = new Date(ano, mes - 1, dia).getDay(); // 0 = domingo, 6 = sábado
    const iso = `${m[1]}-${m[2]}-${String(dia).padStart(2, "0")}`;
    if (semana === 0 || feriados.has(iso)) repouso++;
    else if (semana >= 1 && semana <= 5) uteis++;
    // sábado sem feriado: nem útil (não se trabalha) nem repouso remunerado
  }
  return { uteis, repouso, totalDias };
}

// Dia de falta do mensalista vale 1/30 do salário (praxe da folha), não a
// jornada convertida em horas. Decisão do usuário, confirmada em 31/07/2026.
export const DIVISOR_DIARIO = 30;

/** Valor do dia para o mensalista: salário ÷ 30. */
export function valorDia(salario: number | null | undefined, divisorDiario = DIVISOR_DIARIO): number {
  const s = positivo(salario);
  const d = positivo(divisorDiario) || DIVISOR_DIARIO;
  return centavos(s / d);
}

export interface CalculoFalta {
  diasCheios: number;      // dias faltados por inteiro
  minutosAtraso: number;   // atrasos/saídas antecipadas (horas soltas)
  horasAtraso: number;
  valorDia: number;
  valorHoraNormal: number;
  valorDiasCheios: number; // diasCheios × (salário ÷ 30)
  valorAtrasos: number;    // horas × (salário ÷ 220)
  dsr: number;             // reflexo no descanso semanal remunerado
  total: number;
  diasUteis: number;
  diasRepouso: number;
  semSalario: boolean;
}

/**
 * Falta injustificada em R$.
 * - Dia faltado por inteiro: 1/30 do salário (praxe do mensalista).
 * - Atraso / saída antecipada: horas × (salário ÷ 220).
 * - Reflexo no DSR (Lei 605/49): (desconto ÷ dias úteis) × dias de repouso.
 * Atestado/abono NÃO entram aqui — são ausências justificadas, sem desconto.
 *
 * Os valores são SUGESTÃO para o RH se planejar; o relatório que vai à
 * contabilidade sai só com as horas apuradas.
 */
export function calcularFalta({
  salario, diasCheios = 0, minutosAtraso = 0, competencia,
  divisor = DIVISOR_MENSAL_PADRAO, divisorDiario = DIVISOR_DIARIO,
  feriadosISO = [], comDsr = true,
}: {
  salario: number | null | undefined;
  diasCheios?: number;
  minutosAtraso?: number;
  competencia: string;
  divisor?: number;
  divisorDiario?: number;
  feriadosISO?: string[];
  comDsr?: boolean;
}): CalculoFalta {
  const nDias = Math.max(0, Math.round(positivo(diasCheios)));
  const minAtraso = positivo(minutosAtraso);
  const horasAtraso = minAtraso / 60;
  const vd = valorDia(salario, divisorDiario);
  const vh = valorHora(salario, divisor);
  // Arredonda só no fim de cada parcela: arredondar o valor/hora antes de
  // multiplicar embutia um erro sistemático (sempre para o mesmo lado).
  const s = positivo(salario);
  const dDia = positivo(divisorDiario) || DIVISOR_DIARIO;
  const dHora = positivo(divisor) || DIVISOR_MENSAL_PADRAO;
  const valorDiasCheios = centavos((s / dDia) * nDias);
  const valorAtrasos = centavos((s / dHora) * horasAtraso);
  const bruto = valorDiasCheios + valorAtrasos;
  const { uteis, repouso } = diasDaCompetencia(competencia, feriadosISO);
  // Sem dias úteis conhecidos (competência inválida) não inventa reflexo.
  const dsr = comDsr && uteis > 0 ? centavos((bruto / uteis) * repouso) : 0;
  return {
    diasCheios: nDias,
    minutosAtraso: minAtraso,
    horasAtraso,
    valorDia: vd,
    valorHoraNormal: vh,
    valorDiasCheios,
    valorAtrasos,
    dsr,
    total: centavos(bruto + dsr),
    diasUteis: uteis,
    diasRepouso: repouso,
    semSalario: positivo(salario) === 0,
  };
}

/** Minutos → horas decimais (para mostrar a conta: "5,62 h × R$ 13,64"). */
export function horasDecimais(minutos: number): number {
  return Math.round((positivo(minutos) / 60) * 100) / 100;
}

/**
 * Intervalo de relógio em minutos: "18:00" → "21:30" = 210.
 * Devolve 0 se algum lado estiver vazio/inválido. Fim antes do início é virada
 * de meia-noite (22:00 → 02:00 = 4h), que acontece em plantão.
 */
export function minutosEntre(inicio: string, fim: string): number {
  const hm = (s: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec((s || "").trim());
    if (!m) return null;
    const h = +m[1];
    const min = +m[2];
    if (h > 23 || min > 59) return null;
    return h * 60 + min;
  };
  const a = hm(inicio);
  const b = hm(fim);
  if (a == null || b == null) return 0;
  return b >= a ? b - a : 24 * 60 - a + b;
}
