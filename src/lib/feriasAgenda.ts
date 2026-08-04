// ============================================================================
// As regras de quem pode tirar férias, quantos dias e quando — em um lugar só.
//
// A tela de férias aceitava qualquer coisa: dava para gravar retorno ANTES do
// início, 999 dias gozados e saldo de 99 dias, tudo sem um aviso. E só sabia
// agendar períodos de 30 dias corridos, quando a CLT permite partir em até três.
//
// Aqui mora a conta; a tela só mostra. Assim dá para testar cada regra sem
// abrir o navegador — e foi testando que apareceu o caso do retorno invertido.
//
// Base legal:
//   art. 130    — 30 dias por período aquisitivo de 12 meses
//   art. 134    — concessão em até 12 meses após o direito nascer
//   art. 134 §1 — fracionamento em até 3 períodos: um com 14+ dias, os outros
//                 com 5+ dias cada
//   art. 134 §3 — não pode COMEÇAR nos 2 dias que antecedem feriado ou repouso
//                 semanal (na prática: nada de começar de quinta a domingo)
//   art. 143    — abono pecuniário: vender até 1/3 (10 dias)
// ============================================================================
import { parseData } from "@/lib/format";
import { DIAS_FERIAS } from "@/lib/clt";
import type { Ferias } from "@/data/types";

const MS_DIA = 86_400_000;

/** Menor período quando as férias são partidas (art. 134 §1). */
export const MIN_FRACAO_DIAS = 5;
/** Um dos períodos precisa ter pelo menos isto (art. 134 §1). */
export const MIN_PERIODO_MAIOR = 14;
/** Máximo de períodos por aquisitivo (art. 134 §1). */
export const MAX_FRACOES = 3;
/** Teto do abono pecuniário: 1/3 dos 30 dias (art. 143). */
export const MAX_ABONO_DIAS = 10;

export type Nivel = "erro" | "aviso";
export interface Achado {
  nivel: Nivel;
  texto: string;
}

/** Soma dias a uma data, sem deixar o fuso empurrar para o dia anterior. */
export function somaDias(base: Date, dias: number): Date {
  const d = new Date(base.getTime());
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + dias);
  return d;
}

/**
 * Data de RETORNO ao trabalho: o dia seguinte ao último dia de férias.
 * 30 dias começando em 01/09 => último dia 30/09 => retorno 01/10.
 */
export function retornoDe(inicio: Date, dias: number): Date {
  return somaDias(inicio, dias);
}

/** Quantos dias de férias existem entre início e retorno. */
export function diasEntre(inicio: Date, retorno: Date): number {
  return Math.round((retorno.getTime() - inicio.getTime()) / MS_DIA);
}

// Com artigo, porque a frase fica "começariam numa sexta" / "num sábado".
const SEMANA = ["num domingo", "numa segunda", "numa terça", "numa quarta",
  "numa quinta", "numa sexta", "num sábado"];

/**
 * art. 134 §3: as férias não podem COMEÇAR no período de dois dias que antecede
 * feriado ou o repouso semanal. Com repouso no domingo, isso barra sexta e
 * sábado — e começar no próprio domingo também não faz sentido, porque o
 * primeiro dia de férias seria um dia em que a pessoa já não trabalharia.
 *
 * Feriado municipal não está aqui: o app não tem calendário de feriados, e
 * inventar um seria pior do que avisar o que dá para afirmar.
 */
export function inicioProibido(inicio: Date): boolean {
  const d = inicio.getDay();
  return d === 0 || d === 5 || d === 6;
}

export interface DadosAgendamento {
  /** Data de início do gozo. */
  inicio: Date | null;
  /** Quantos dias de férias. */
  dias: number;
  /** Dias já lançados em outros períodos do MESMO período aquisitivo. */
  diasJaLancados?: number;
  /** Quantos períodos já existem neste aquisitivo. */
  fracoesExistentes?: number;
  /** Outros períodos da mesma pessoa, para conferir sobreposição. */
  outros?: Ferias[];
  /** Id do registro sendo editado (para ele não brigar consigo mesmo). */
  ignorarId?: string;
  /** Dias vendidos como abono pecuniário. */
  abono?: number;
}

/**
 * Confere um agendamento e devolve o que está errado (erro) e o que merece
 * atenção (aviso). Lista vazia = pode gravar.
 *
 * Erro trava a gravação; aviso não. A diferença importa: fracionar em 5 dias é
 * legal e comum, então não pode travar — mas a pessoa precisa ver que aquele
 * período não fecha os 30 sozinho.
 */
export function validarAgendamento(d: DadosAgendamento): Achado[] {
  const achados: Achado[] = [];
  const dias = Number(d.dias);
  const jaLancados = Math.max(0, Number(d.diasJaLancados ?? 0));
  const abono = Math.max(0, Number(d.abono ?? 0));

  if (!d.inicio || isNaN(d.inicio.getTime())) {
    achados.push({ nivel: "erro", texto: "Escolha a data de início." });
    return achados;
  }

  if (!Number.isFinite(dias) || !Number.isInteger(dias) || dias <= 0) {
    achados.push({ nivel: "erro", texto: "Os dias de férias precisam ser um número inteiro maior que zero." });
    return achados;
  }
  if (dias > DIAS_FERIAS) {
    achados.push({ nivel: "erro", texto: `Um período aquisitivo dá ${DIAS_FERIAS} dias (art. 130). Você pediu ${dias}.` });
  }

  // Fracionamento (art. 134 §1)
  if (dias < DIAS_FERIAS) {
    if (dias < MIN_FRACAO_DIAS) {
      achados.push({ nivel: "erro", texto: `Período partido não pode ter menos de ${MIN_FRACAO_DIAS} dias (art. 134 §1).` });
    }
    const fracoes = Math.max(0, Number(d.fracoesExistentes ?? 0)) + 1;
    if (fracoes > MAX_FRACOES) {
      achados.push({ nivel: "erro", texto: `As férias já estão partidas em ${MAX_FRACOES} períodos — a CLT não permite um quarto (art. 134 §1).` });
    }
    // A regra dos 14 dias é sobre o CONJUNTO, então só dá para cobrar quando
    // este é o último período que fecha os 30.
    const somaComEste = jaLancados + dias;
    if (somaComEste >= DIAS_FERIAS && dias < MIN_PERIODO_MAIOR && jaLancados > 0) {
      // fecha os 30, mas nenhum período chegou a 14? isso a tela não sabe
      // sozinha; avisa para conferir.
      achados.push({ nivel: "aviso", texto: `Um dos períodos precisa ter ${MIN_PERIODO_MAIOR} dias ou mais (art. 134 §1) — confira os períodos já lançados.` });
    }
  }

  // Saldo do período aquisitivo
  // Só fala de saldo quando há algo lançado ou vendido: sem isso, pedir 45 dias
  // gerava DUAS mensagens dizendo a mesma coisa ("dá 30" e "sobram 30").
  const restam = DIAS_FERIAS - jaLancados - abono;
  if ((jaLancados > 0 || abono > 0) && dias > restam && restam >= 0) {
    achados.push({
      nivel: "erro",
      texto: abono > 0
        ? `Sobram ${restam} dia(s): ${jaLancados} já lançado(s) e ${abono} vendido(s) como abono.`
        : `Sobram ${restam} dia(s) neste período aquisitivo — ${jaLancados} já foi(ram) lançado(s).`,
    });
  }

  // Abono pecuniário (art. 143)
  if (abono > MAX_ABONO_DIAS) {
    achados.push({ nivel: "erro", texto: `O abono é de no máximo ${MAX_ABONO_DIAS} dias, um terço das férias (art. 143).` });
  }

  // Início proibido (art. 134 §3)
  if (inicioProibido(d.inicio)) {
    achados.push({
      nivel: "aviso",
      texto: `As férias começariam ${SEMANA[d.inicio.getDay()]}. A CLT não deixa começar nos dois dias antes do descanso semanal (art. 134 §3) — prefira de segunda a quinta.`,
    });
  }

  // Sobreposição com outro período da mesma pessoa
  const fim = retornoDe(d.inicio, dias);
  for (const o of d.outros ?? []) {
    if (d.ignorarId && o.id === d.ignorarId) continue;
    if (o.status === "Cancelada") continue;
    const oi = parseData(o.dataInicio);
    const of = parseData(o.dataRetorno);
    if (!oi || !of) continue;
    if (d.inicio.getTime() < of.getTime() && oi.getTime() < fim.getTime()) {
      achados.push({
        nivel: "erro",
        texto: `Bate com outro período já lançado (${oi.toLocaleDateString("pt-BR")} a ${of.toLocaleDateString("pt-BR")}).`,
      });
      break;
    }
  }

  return achados;
}

/** Confere o par de datas do formulário de edição.
 *
 * As DUAS vazias é um estado legítimo e comum: período aquisitivo em aberto,
 * com saldo de 30 dias e nenhum gozo agendado ainda — 13 dos 31 registros da
 * empresa estão assim. Exigir as datas nesse caso travava o botão Salvar e
 * deixava esses registros impossíveis de editar, inclusive para trocar o
 * status. Só cobra o par quando UMA delas foi preenchida: aí sim é um gozo
 * pela metade. */
export function validarPeriodo(inicio: Date | null, retorno: Date | null): Achado[] {
  const achados: Achado[] = [];
  if (!inicio && !retorno) return achados;
  if (!inicio) achados.push({ nivel: "erro", texto: "Informe o início do gozo (ou apague o retorno para deixar o período em aberto)." });
  if (!retorno) achados.push({ nivel: "erro", texto: "Informe a data de retorno (ou apague o início para deixar o período em aberto)." });
  if (!inicio || !retorno) return achados;

  const dias = diasEntre(inicio, retorno);
  if (dias <= 0) {
    // Era gravável: o app aceitava 01/09 → 01/08 sem dizer nada, e depois
    // "de férias agora" nunca encontrava a pessoa porque a janela era negativa.
    achados.push({ nivel: "erro", texto: "O retorno precisa ser depois do início." });
    return achados;
  }
  if (dias > DIAS_FERIAS) {
    achados.push({ nivel: "erro", texto: `São ${dias} dias entre as duas datas — o máximo por período aquisitivo é ${DIAS_FERIAS} (art. 130).` });
  }
  if (dias < MIN_FRACAO_DIAS) {
    achados.push({ nivel: "erro", texto: `Período partido não pode ter menos de ${MIN_FRACAO_DIAS} dias (art. 134 §1).` });
  }
  return achados;
}

/** Só os erros (o que trava a gravação). */
export const erros = (a: Achado[]) => a.filter((x) => x.nivel === "erro");
/** Tem erro? */
export const temErro = (a: Achado[]) => a.some((x) => x.nivel === "erro");
