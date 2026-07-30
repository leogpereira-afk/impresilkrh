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
  return {
    minutos: min,
    horas,
    valorHoraNormal: vhNormal,
    valorHoraExtra: vhExtra,
    fator: f,
    valor: centavos(vhExtra * horas),
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

export interface CalculoFalta {
  minutos: number;
  horas: number;
  valorHoraNormal: number;
  valorHoras: number;   // desconto das horas faltadas
  dsr: number;          // reflexo no descanso semanal remunerado
  total: number;        // valorHoras + dsr
  diasUteis: number;
  diasRepouso: number;
  semSalario: boolean;
}

/**
 * Falta injustificada em R$: desconta as horas E o reflexo no DSR (Lei 605/49).
 * DSR = (valor das horas faltadas ÷ dias úteis) × dias de repouso do mês.
 * Atestado/abono NÃO entram aqui — são ausências justificadas, sem desconto.
 */
export function calcularFalta({
  salario, minutos, competencia, divisor = DIVISOR_MENSAL_PADRAO, feriadosISO = [], comDsr = true,
}: {
  salario: number | null | undefined;
  minutos: number;
  competencia: string;
  divisor?: number;
  feriadosISO?: string[];
  comDsr?: boolean;
}): CalculoFalta {
  const min = positivo(minutos);
  const horas = min / 60;
  const vh = valorHora(salario, divisor);
  const valorHoras = centavos(vh * horas);
  const { uteis, repouso } = diasDaCompetencia(competencia, feriadosISO);
  // Sem dias úteis conhecidos (competência inválida) não inventa reflexo.
  const dsr = comDsr && uteis > 0 ? centavos((valorHoras / uteis) * repouso) : 0;
  return {
    minutos: min,
    horas,
    valorHoraNormal: vh,
    valorHoras,
    dsr,
    total: centavos(valorHoras + dsr),
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
