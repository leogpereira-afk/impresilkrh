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

/**
 * Hora extra em R$: (salário ÷ divisor) → arredonda → × fator → arredonda →
 * × horas → arredonda.
 *
 * ARREDONDA A CADA PASSO, e é de propósito — foi um conserto, não um descuido.
 *
 * Antes a conta era feita inteira em precisão cheia e só arredondava no fim.
 * Matematicamente é mais exato, e mesmo assim estava ERRADO onde importa: a
 * tela mostrava os passos já arredondados ("R$ 11,19/h · com +50% = R$ 16,79/h
 * · × 4,5h") e cravava um total que aqueles números não produzem. Quem conferia
 * na calculadora fazia 16,79 × 4,5 e achava R$ 75,56, enquanto o sistema
 * gravava R$ 75,52. Três centavos bastam para o RH parar de confiar no número —
 * e um número em que não se confia manda a pessoa de volta para a planilha.
 *
 * Arredondando a cada passo, a conta que a tela mostra é a conta que o sistema
 * faz, e dá para conferir na mão. É também como a folha faz: o valor-hora vai
 * ao holerite com dois decimais, e a linha é quantidade × esse valor.
 *
 * O valor-hora com adicional sai do valor-hora JÁ ARREDONDADO (1119 → ×1,5 →
 * 1679), que é o caminho que a pessoa percorre lendo a tela.
 */
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
  const s = positivo(salario);
  const d = positivo(divisor) || DIVISOR_MENSAL_PADRAO;

  // Em CENTAVOS inteiros: evita que 16,79 × 4,5 = 7555,4999… vire 75,55 por
  // conta de float, quando a conta na mão dá 75,56.
  const centHoraNormal = Math.round((s / d) * 100);
  const centHoraExtra = Math.round(centHoraNormal * f);
  const centTotal = Math.round(centHoraExtra * horas);

  return {
    minutos: min,
    horas,
    valorHoraNormal: centHoraNormal / 100,
    valorHoraExtra: centHoraExtra / 100,
    fator: f,
    valor: centTotal / 100,
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

/**
 * Lê um valor em dinheiro digitado por gente, aceitando os dois jeitos.
 *
 * A regra antiga apagava TODO ponto tratando-o como separador de milhar, então
 * "10.50" (que muitos teclados entregam) virava 1050 — cem vezes o valor, sem
 * aviso. Agora: se há vírgula, ela é o decimal e os pontos são milhar; se só há
 * ponto, ele é o decimal — a menos que esteja claramente separando milhar
 * ("1.050" ou "1.234.567").
 */
export function valorDigitado(txt: string | number | null | undefined): number {
  if (typeof txt === "number") return Number.isFinite(txt) ? txt : 0;
  const s = String(txt ?? "").replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!s) return 0;
  const temVirgula = s.includes(",");
  let limpo: string;
  if (temVirgula) {
    limpo = s.replace(/\./g, "").replace(",", ".");
  } else {
    const pontos = (s.match(/\./g) || []).length;
    const ultimo = s.lastIndexOf(".");
    const casasDepois = ultimo >= 0 ? s.length - ultimo - 1 : -1;
    // "1.050" / "1.234.567" = milhar (3 casas depois do último ponto).
    limpo = pontos >= 2 || (pontos === 1 && casasDepois === 3) ? s.replace(/\./g, "") : s;
  }
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

/**
 * O separador decimal é ambíguo neste texto?
 *
 * O leitor de dinheiro (valorDigitado) precisa adivinhar quando o formato é
 * misto, e adivinhar errado em salário custa 100×: "2.500.38" — ponto de milhar
 * mais ponto de centavo, digitação natural no teclado numérico — seria lido como
 * dois separadores de milhar e viraria R$ 250.038,00. Em vez de adivinhar, aqui
 * a gente recusa e pede o formato certo. Aceita: 2500 · 2500,38 · 2.500,38 ·
 * 1.234.567,89 · 2500.38 · 1.050. Recusa: 2.500.38 · 2,500.38 · 2500,384.
 */
export function dinheiroAmbiguo(txt: string): boolean {
  const s = txt.replace(/R\$/gi, "").replace(/\s/g, "").trim();
  if (!/^[\d.,]+$/.test(s)) return true; // letra ou símbolo no meio
  const virgulas = (s.match(/,/g) || []).length;
  if (virgulas > 1) return true;
  if (virgulas === 1) {
    const [inteiro, dec] = s.split(",");
    if (dec.length > 2) return true;                                  // 2500,384
    return inteiro.includes(".") && !/^\d{1,3}(\.\d{3})*$/.test(inteiro); // 2,500.38
  }
  const pontos = (s.match(/\./g) || []).length;
  // Um ponto só nunca é ambíguo: ou é o decimal (2500.38, 12500.5), ou é milhar
  // com três casas (1.050) — e essa é justamente a regra do leitor.
  if (pontos <= 1) return false;
  return !/^\d{1,3}(\.\d{3})+$/.test(s); // vários pontos: só milhar bem formado
}

/** Minutos → horas decimais (para mostrar a conta: "5,62 h × R$ 13,64"). */
export function horasDecimais(minutos: number): number {
  return Math.round((positivo(minutos) / 60) * 100) / 100;
}

/**
 * Lê uma DURAÇÃO digitada ("02:50" = 2h50 = 170 min).
 *
 * Diferente de `minutosEntre`, que recebe começo e fim de relógio: aqui vem a
 * quantidade de horas já somada, que é como a planilha do RH registra.
 *
 * Devolve `null` quando não entende, e é isso que importa: `horaParaMin`
 * devolve 0 para lixo, e 0 minuto vira R$ 0,00 — o lançamento sairia zerado
 * sem ninguém ver que a digitação estava errada. Com `null` a tela pode
 * recusar e pedir de novo.
 *
 * Aceita também horas decimais ("2,5" = 2h30), porque quem vem da planilha
 * digita dos dois jeitos. NÃO aceita "2.50" com ponto: seria 2h30 ou 2,5h?
 * Adivinhar aqui erra em dinheiro — melhor recusar e pedir "02:30".
 */
export function minutosDaDuracao(txt: string | null | undefined): number | null {
  const s = String(txt ?? "").trim().replace(/\s/g, "");
  if (!s) return null;
  const relogio = /^(\d{1,3}):([0-5]\d)$/.exec(s);
  if (relogio) return +relogio[1] * 60 + +relogio[2];
  // Só vírgula como decimal — ver o porquê no comentário acima.
  if (/^\d{1,3}(,\d{1,2})?$/.test(s)) return Math.round(Number(s.replace(",", ".")) * 60);
  return null;
}

/**
 * O valor digitado saiu do que a conta sugeriu?
 *
 * Existe porque o RH PRECISA poder alterar o valor calculado — "tem horas que
 * tem bônus". Mas um valor alterado que se parece com um valor calculado é uma
 * armadilha: seis meses depois ninguém sabe se aqueles R$ 30 a mais foram
 * bônus combinado ou erro de digitação. Então a tela mostra a diferença, e ela
 * vai junto na descrição do lançamento.
 *
 * Tolerância de um centavo: arredondamento não é bônus.
 */
export function diferencaDoCalculo(digitado: number, calculado: number): number {
  if (!Number.isFinite(digitado) || !Number.isFinite(calculado) || calculado <= 0) return 0;
  const d = centavos(digitado - calculado);
  return Math.abs(d) < 0.01 ? 0 : d;
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
