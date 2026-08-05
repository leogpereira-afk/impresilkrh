// ============================================================================
// O relógio das férias: quantos dias faltam, quantos já passaram, e quanto
// tempo resta antes de a empresa pagar em dobro.
//
// A tela mostrava datas cruas ("25/12/2025 → 05/01/2026") e deixava a conta
// para a cabeça de quem lê. Quem precisa saber "falta muito?" tinha de abrir o
// calendário e contar. Pior: a coluna CLT ficava com um travessão em quase
// tudo, porque só falava quando o prazo entrava na janela de 60 dias — então a
// tela parecia dizer "não há prazo nenhum" quando havia, sim, com folga.
//
// Tudo aqui conta DIAS DE CALENDÁRIO, nunca instantes. Somar milissegundos
// contra `new Date()` faz a resposta mudar ao longo do dia: de manhã falta 1
// dia, depois das 12h o arredondamento vira 0 e a tela se contradiz entre a
// leitura das 9h e a das 15h.
// ============================================================================
import { diasDeCalendario, formatDate, parseData } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { Ferias } from "@/data/types";

/** Onde este período está na linha do tempo, comparado com hoje. */
export type Fase =
  /** Não há gozo marcado — só o direito, esperando ser agendado. */
  | "sem-gozo"
  /** O gozo começa depois de hoje. */
  | "futuro"
  /** A pessoa está de férias agora. */
  | "em-curso"
  /** O gozo já terminou. */
  | "voltou"
  /** Retorno anterior ao início: o registro está errado, não dá para contar. */
  | "datas-trocadas";

export interface Contagem {
  fase: Fase;
  /** Dias que faltam (futuro / em curso) ou que já passaram (voltou). Nunca negativo. */
  dias: number;
  /** Frase curta e pronta para a célula da tabela. */
  texto: string;
}

const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

/**
 * Quanto falta para as férias — ou quanto falta para voltar delas.
 *
 * Sem data de retorno mas com início, o período conta como começado: é o que a
 * data disponível sustenta. Dizer "voltou" sem saber quando seria inventar.
 */
export function contagem(f: Pick<Ferias, "dataInicio" | "dataRetorno">, hoje: Date = HOJE): Contagem {
  const inicio = parseData(f.dataInicio);
  const retorno = parseData(f.dataRetorno);

  if (!inicio) return { fase: "sem-gozo", dias: 0, texto: "Sem gozo marcado" };

  // Registro invertido. Já apareceu na produção como "-31 dia(s)"; melhor dizer
  // que o dado está errado do que estampar um número impossível.
  if (retorno && retorno.getTime() < inicio.getTime()) {
    return { fase: "datas-trocadas", dias: 0, texto: "Datas trocadas" };
  }

  const paraOInicio = diasDeCalendario(inicio, hoje);
  if (paraOInicio > 0) {
    const texto =
      paraOInicio === 1 ? "Começa amanhã" : `Faltam ${paraOInicio} ${plural(paraOInicio, "dia", "dias")}`;
    return { fase: "futuro", dias: paraOInicio, texto };
  }

  // Sem retorno informado não há como dizer que terminou.
  if (!retorno) {
    return { fase: "em-curso", dias: 0, texto: "De férias · retorno não informado" };
  }

  // O dia do retorno é o dia em que a pessoa VOLTA a trabalhar: nele as férias
  // já acabaram. Por isso a comparação é "hoje < retorno", não "<=".
  const paraORetorno = diasDeCalendario(retorno, hoje);
  if (paraORetorno > 0) {
    const texto =
      paraORetorno === 1 ? "De férias · volta amanhã" : `De férias · volta em ${paraORetorno} dias`;
    return { fase: "em-curso", dias: paraORetorno, texto };
  }

  const desdeORetorno = -paraORetorno;
  const texto =
    desdeORetorno === 0
      ? "Voltou hoje"
      : desdeORetorno === 1
        ? "Voltou ontem"
        : `Voltou há ${desdeORetorno} dias`;
  return { fase: "voltou", dias: desdeORetorno, texto };
}

// -------------------------- a próxima, por pessoa ---------------------------

export interface Proxima {
  /** "em-curso" = está de férias agora; "futuro" = já marcou; "sem-marcacao" = nada agendado. */
  fase: "em-curso" | "futuro" | "sem-marcacao";
  /** Dias que faltam (para sair, ou para voltar). 0 quando não há o que contar. */
  dias: number;
  texto: string;
  /** O período que gerou a contagem, para a tela poder mostrar as datas. */
  registro: Ferias | null;
}

/**
 * A PRÓXIMA férias da pessoa — que é a pergunta que se faz olhando esta tela.
 *
 * A contagem por registro respondia "voltou há 211 dias", o que é verdade e não
 * serve para nada: quem abre o controle de férias quer saber quanto falta para
 * a próxima, não há quanto tempo foi a última.
 *
 * Ordem de prioridade: quem está de férias AGORA vem antes de quem tem uma
 * marcada, porque é o que muda a escala de hoje. Entre as futuras, a mais
 * próxima. Período cancelado não conta.
 */
export function proximaFerias(registros: Ferias[], hoje: Date = HOJE): Proxima {
  const vivos = (registros || []).filter((f) => f.status !== "Cancelada");

  const emCurso = vivos
    .map((f) => ({ f, c: contagem(f, hoje) }))
    .filter((x) => x.c.fase === "em-curso")
    .sort((a, b) => a.c.dias - b.c.dias)[0];
  if (emCurso) {
    return { fase: "em-curso", dias: emCurso.c.dias, texto: emCurso.c.texto, registro: emCurso.f };
  }

  const futuras = vivos
    .map((f) => ({ f, c: contagem(f, hoje) }))
    .filter((x) => x.c.fase === "futuro")
    .sort((a, b) => a.c.dias - b.c.dias);
  if (futuras.length) {
    return { fase: "futuro", dias: futuras[0].c.dias, texto: futuras[0].c.texto, registro: futuras[0].f };
  }

  return { fase: "sem-marcacao", dias: 0, texto: "Sem férias marcadas", registro: null };
}

// ------------------------------ prazo da CLT --------------------------------

/**
 * Último dia para conceder sem pagar em dobro: 12 meses depois do FIM do
 * período aquisitivo (art. 134).
 *
 * Ancorado no meio-dia para a soma de meses não escorregar de dia por causa de
 * fuso, e andando a partir do fim do aquisitivo — que é a data que a lei manda
 * usar — porque `setMonth` transborda mês curto (31/01 + 1 mês => 03/03).
 */
export function limiteDeConcessao(fimDoAquisitivo: string | Date | null | undefined): string {
  const d = parseData(fimDoAquisitivo);
  if (!d) return "";
  const l = new Date(d.getTime());
  l.setHours(12, 0, 0, 0);
  l.setMonth(l.getMonth() + 12);
  return l.toISOString();
}

export type SituacaoPrazo =
  /** Passou do limite: cada dia destes é férias paga em dobro. */
  | "vencido"
  /** Dentro da janela de alerta. */
  | "a-vencer"
  /** Ainda há folga. */
  | "no-prazo"
  /** Período já gozado, ou sem período aquisitivo lançado: não há prazo a correr. */
  | "sem-prazo";

export interface Prazo {
  situacao: SituacaoPrazo;
  /** Dias até o limite (negativo = já passou). NaN quando não há prazo. */
  dias: number;
  /** Data-limite formatada, ou "" quando não há. */
  limite: string;
  /** Frase curta e pronta para a célula da tabela. */
  texto: string;
}

/**
 * O prazo de concessão deste período.
 *
 * `desde` é a data a partir da qual o sistema tem histórico de férias: um
 * período cujo prazo acabou antes disso não é "vencido", é desconhecido — o app
 * chegou a acusar "vencidas há 3.847 dias" para quem só não tinha o histórico
 * antigo digitado. Ver inicioDoHistorico() em lib/clt.ts.
 */
export function prazoDeConcessao(
  f: Pick<Ferias, "status" | "periodoAquisitivoFim">,
  hoje: Date = HOJE,
  desde: Date | null = null,
  janelaAlertaDias = 60,
): Prazo {
  const semPrazo: Prazo = { situacao: "sem-prazo", dias: NaN, limite: "", texto: "" };
  // Período já gozado não tem mais prazo correndo.
  if (f.status !== "Em aberto" && f.status !== "Agendada") return semPrazo;

  const limite = parseData(limiteDeConcessao(f.periodoAquisitivoFim));
  if (!limite) return semPrazo;
  if (desde && limite.getTime() < desde.getTime()) return semPrazo;

  const dias = diasDeCalendario(limite, hoje);
  const formatado = formatDate(limite);
  if (dias < 0) {
    const atraso = -dias;
    return {
      situacao: "vencido",
      dias,
      limite: formatado,
      texto: `Vencido há ${atraso} ${plural(atraso, "dia", "dias")}`,
    };
  }
  const texto =
    dias === 0 ? "Vence hoje" : dias === 1 ? "Vence amanhã" : `Vence em ${dias} dias`;
  return { situacao: dias <= janelaAlertaDias ? "a-vencer" : "no-prazo", dias, limite: formatado, texto };
}

// --------------------------- status × datas ---------------------------------

/**
 * O status gravado bate com o que as datas dizem?
 *
 * Ninguém volta na ficha para trocar "Em andamento" por "Concluída" quando a
 * pessoa retorna — medido na base em 04/08/2026: três registros seguiam "Em
 * andamento" com retorno em julho, ou seja, a tela afirmava que três pessoas
 * estavam de férias enquanto elas trabalhavam. Devolve a frase do problema, ou
 * `null` quando está tudo coerente.
 *
 * Não corrige nada sozinho de propósito: mudar status é decisão de quem cuida
 * da folha, e um registro pode estar "errado" só porque as férias foram
 * antecipadas e ainda não lançaram.
 */
/**
 * O status que as DATAS pedem — para oferecer o conserto de um clique.
 *
 * Devolve `null` quando o status já está coerente (ou quando não dá para
 * afirmar nada: sem gozo marcado, datas trocadas). Nunca aplica sozinho: quem
 * decide é quem cuida da folha, e um registro pode estar "errado" só porque as
 * férias foram antecipadas e ainda não lançaram.
 */
export function statusSugerido(
  f: Pick<Ferias, "status" | "dataInicio" | "dataRetorno">,
  hoje: Date = HOJE,
): string | null {
  if (!statusIncoerente(f, hoje)) return null;
  const { fase } = contagem(f, hoje);
  if (fase === "voltou") return "Concluída";
  if (fase === "em-curso") return "Em andamento";
  if (fase === "futuro") return "Agendada";
  return null;
}

export function statusIncoerente(
  f: Pick<Ferias, "status" | "dataInicio" | "dataRetorno">,
  hoje: Date = HOJE,
): string | null {
  const { fase } = contagem(f, hoje);
  const status = f.status;
  if (fase === "sem-gozo" || fase === "datas-trocadas") return null;

  if (fase === "voltou" && (status === "Em andamento" || status === "Agendada")) {
    return `O status diz "${status}", mas o retorno foi em ${formatDate(f.dataRetorno)}.`;
  }
  if (fase === "em-curso" && status === "Concluída") {
    return "O status diz \"Concluída\", mas o período de gozo está acontecendo agora.";
  }
  if (fase === "em-curso" && (status === "Agendada" || status === "Em aberto")) {
    return `O status diz "${status}", mas o gozo já começou em ${formatDate(f.dataInicio)}.`;
  }
  if (fase === "futuro" && (status === "Em andamento" || status === "Concluída")) {
    return `O status diz "${status}", mas o gozo só começa em ${formatDate(f.dataInicio)}.`;
  }
  return null;
}
