// ============================================================================
// Os dois dias de dinheiro do mês.
//
//  • SALÁRIO — até o 5º dia ÚTIL do mês seguinte ao trabalhado (CLT art. 459,
//    § único). Atrasar gera correção e multa, e é a data que a equipe inteira
//    tem na cabeça.
//  • ADIANTAMENTO — dia 20, prática da casa.
//
// O 5º dia útil não é "dia 5", nem "dia 7": depende de onde caem os fins de
// semana e os feriados daquele mês. Em maio/2026, por exemplo, o dia 1º é
// feriado e cai numa sexta — quem conta na mão erra.
//
// Os feriados vêm do próprio calendário do app (eventos do tipo "Feriado",
// incluindo os que se repetem todo ano). Feriado que ninguém cadastrou o
// sistema não tem como saber, então o dia sai como útil — por isso a tela diz
// de onde a conta saiu, em vez de afirmar sozinha.
// ============================================================================
import { parseData } from "@/lib/format";

/** Dia do mês em que o adiantamento é pago (prática da Impresilk). */
export const DIA_ADIANTAMENTO = 20;
/** Quantos dias úteis a CLT dá para o pagamento do salário (art. 459). */
export const DIAS_UTEIS_PAGAMENTO = 5;

const ehFimDeSemana = (d: Date) => d.getDay() === 0 || d.getDay() === 6;
const chave = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Só mês-dia, para o feriado que se repete todo ano. */
const chaveAnual = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export interface FeriadoDoCalendario {
  data?: string | null;
  tipo?: string;
  recorrenteAnual?: boolean;
  titulo?: string;
}

/** Monta as duas listas de feriado a partir dos eventos do calendário. */
export function feriadosDe(eventos: FeriadoDoCalendario[]) {
  const fixos = new Set<string>();
  const anuais = new Set<string>();
  for (const e of eventos) {
    if (e.tipo !== "Feriado") continue;
    const d = parseData(e.data);
    if (!d) continue;
    (e.recorrenteAnual ? anuais : fixos).add(e.recorrenteAnual ? chaveAnual(d) : chave(d));
  }
  return { fixos, anuais };
}

const ehFeriado = (d: Date, f: ReturnType<typeof feriadosDe>) =>
  f.fixos.has(chave(d)) || f.anuais.has(chaveAnual(d));

/** O dia é útil? (não é fim de semana nem feriado cadastrado) */
export function ehDiaUtil(d: Date, feriados: ReturnType<typeof feriadosDe>): boolean {
  return !ehFimDeSemana(d) && !ehFeriado(d, feriados);
}

/**
 * O N-ésimo dia útil do mês. `mes` é 0-based, como no JS.
 * Devolve null se o mês não tiver dias úteis suficientes — não acontece com
 * N=5 em mês nenhum, mas devolver null é mais honesto do que devolver o dia 31.
 */
export function nEsimoDiaUtil(
  ano: number,
  mes: number,
  n: number,
  feriados: ReturnType<typeof feriadosDe> = { fixos: new Set(), anuais: new Set() },
): Date | null {
  if (n < 1) return null;
  let contados = 0;
  const d = new Date(ano, mes, 1);
  while (d.getMonth() === mes) {
    if (ehDiaUtil(d, feriados)) {
      contados += 1;
      if (contados === n) return new Date(d.getTime());
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/** O dia do pagamento do salário naquele mês: 5º dia útil (art. 459). */
export const diaDoPagamento = (ano: number, mes: number, feriados?: ReturnType<typeof feriadosDe>) =>
  nEsimoDiaUtil(ano, mes, DIAS_UTEIS_PAGAMENTO, feriados);

/**
 * O dia do adiantamento: dia 20, ou o ÚTIL anterior quando o 20 cai em fim de
 * semana ou feriado — dinheiro não entra na conta em dia sem expediente
 * bancário, e antecipar é o que a casa faz (nunca atrasar).
 */
export function diaDoAdiantamento(
  ano: number,
  mes: number,
  feriados: ReturnType<typeof feriadosDe> = { fixos: new Set(), anuais: new Set() },
): Date {
  const d = new Date(ano, mes, DIA_ADIANTAMENTO);
  while (!ehDiaUtil(d, feriados)) d.setDate(d.getDate() - 1);
  return d;
}
