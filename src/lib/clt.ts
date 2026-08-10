// ============================================================================
// Prazos da CLT que custam dinheiro se passarem batido.
//
// O app avisava sobre documento e NR vencendo, mas não sobre os dois prazos com
// multa direta:
//
// 1) FÉRIAS (CLT art. 134 e 137). A cada 12 meses trabalhados a pessoa ganha
//    direito a 30 dias ("período aquisitivo"). A empresa tem os 12 meses
//    SEGUINTES para conceder ("período concessivo"). Passou disso, paga as
//    férias EM DOBRO — e ainda cabe multa. Ninguém enxergava esse relógio.
//
// 2) CONTRATO DE EXPERIÊNCIA (CLT art. 445, § único). No máximo 90 dias, com no
//    máximo uma prorrogação. Se o dia 90 passa e a pessoa continua trabalhando,
//    o contrato vira automaticamente por prazo INDETERMINADO — some a saída sem
//    custo e passa a valer aviso prévio e multa do FGTS. É preciso decidir ANTES.
//
// Tudo é calculado a partir da data de admissão e dos períodos de férias já
// lançados. Nenhum campo novo é exigido de quem usa.
// ============================================================================
import { parseData } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { Colaborador, Ferias } from "@/data/types";

const DIA = 86_400_000;
/** Dias de férias por período aquisitivo completo (CLT art. 130, I). */
export const DIAS_FERIAS = 30;
/* Ancorado no início do dia dos DOIS lados. Com a conta crua, `HOJE` carrega a
   hora atual e o prazo mudava de resposta ao longo do dia: no 90º dia do
   contrato de experiência, de manhã faltava 1 dia para decidir e depois das 12h
   o app já declarava EXPIRADO — no dia em que ainda dava para agir. */
const dias = (de: Date, ate: Date) => {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate()).getTime();
  return Math.round((b - a) / DIA);
};
const somaMeses = (d: Date, m: number) => {
  const r = new Date(d.getTime());
  r.setMonth(r.getMonth() + m);
  return r;
};

// ------------------------------- férias -------------------------------------
export interface SituacaoFerias {
  /** Início do período aquisitivo aberto (o 12º mês mais recente já completado). */
  aquisitivoInicio: Date;
  /** Data em que o direito nasceu (fim do aquisitivo). */
  direitoDesde: Date;
  /** Último dia para a empresa conceder sem pagar em dobro. */
  limiteConcessao: Date;
  /** Dias até o limite (negativo = já passou). */
  diasParaLimite: number;
  /** Já gozou férias dentro deste período concessivo? */
  jaGozou: boolean;
  /** Dias já gozados neste período (0 a 30). */
  diasGozados: number;
  /** Dias que ainda faltam conceder — é o que vira pagamento em dobro. */
  diasEmAberto: number;
  /**
   * Dias já LANÇADOS para uma data futura. Não quitam nada (agendar não é
   * gozar), mas a tela precisa saber que existem: sem isso ela repetiria
   * "VENCIDAS há 247 dias" para quem já tem as férias marcadas, e quem lançou
   * acharia que o sistema não registrou.
   */
  diasAgendados: number;
  /** A data agendada mais próxima, quando houver. */
  agendadoPara: Date | null;
  situacao: "em-dia" | "a-vencer" | "vencida" | "sem-registro";
}

/**
 * A partir de quando este sistema TEM histórico de férias.
 *
 * Existe porque a conta acima só sabe o que está lançado, e o app começou a
 * guardar férias muito depois de a empresa existir. Sem esse corte, quem tem
 * dez anos de casa aparecia com "férias VENCIDAS há 3.847 dias" — não porque
 * nunca tirou, mas porque as férias de 2015 nunca foram digitadas aqui.
 *
 * Medido em produção: das 12 pessoas apontadas como vencidas, TODAS as 12
 * tinham o limite de concessão anterior ao primeiro registro do banco. Ou seja,
 * o alerta era 100% ruído — e ruído em alerta de multa é pior que alerta
 * nenhum, porque ensina a ignorar.
 *
 * O corte sai do próprio dado: o registro de férias mais antigo que existe.
 * Conforme a empresa lançar histórico para trás, o corte anda junto sozinho.
 */
export function inicioDoHistorico(ferias: Ferias[]): Date | null {
  let menor: Date | null = null;
  for (const f of ferias) {
    const d = parseData(f.dataInicio);
    if (d && (!menor || d.getTime() < menor.getTime())) menor = d;
  }
  return menor;
}

/**
 * Situação das férias de uma pessoa hoje.
 * `null` quando não dá para calcular (sem admissão) ou ainda não completou 1 ano.
 */
export function situacaoFerias(
  c: Colaborador,
  feriasDaPessoa: Ferias[],
  hoje = HOJE,
  /** Antes desta data o sistema não tem histórico — ver inicioDoHistorico(). */
  desde: Date | null = null,
): SituacaoFerias | null {
  const adm = parseData(c.dataAdmissao);
  if (!adm) return null;
  // Quem saiu tem o relógio parado no último dia. Sem isto a ficha de um
  // desligado continuava abrindo período aquisitivo novo contra HOJE e o
  // "vencidas há N dias" crescia sozinho todo dia — em 53 pessoas inativas.
  const saida = parseData(c.dataDesligamento);
  const ate = saida && saida.getTime() < hoje.getTime() ? saida : hoje;
  const mesesDeCasa = Math.floor(dias(adm, ate) / 30.44);
  if (mesesDeCasa < 12) return null; // ainda no primeiro período aquisitivo

  // Cada gozo, com QUANTOS dias foram tirados. A conta antiga só perguntava se
  // EXISTIA um gozo na janela — quem tirou 15 dias dos 30 era marcado como
  // resolvido, o aviso sumia e o Resumo 360º estampava "Nada pendente" enquanto
  // a própria aba Férias mostrava "Saldo 15 dias". Esses 15 vencem no mesmo
  // prazo e também são pagos EM DOBRO. Agora só quita o período quem somou 30.
  const todosOsRegistros = feriasDaPessoa
    .filter((f) => f.status !== "Cancelada")
    .map((f) => ({ inicio: parseData(f.dataInicio), dias: Number(f.diasGozados) || 0 }))
    .filter((g): g is { inicio: Date; dias: number } => !!g.inicio);

  /* AGENDAR NÃO É GOZAR. Só quita o período o que JÁ COMEÇOU — quem decide isso
     é a DATA, não o texto do status: "Agendada" é digitado à mão e ninguém volta
     para trocar depois que a pessoa saiu de férias.
     Sem esta separação, bastava lançar 30 dias para o ano que vem e o "VENCIDAS
     há N dias — por lei o pagamento é em dobro" sumia no mesmo instante da
     ficha, do sino e do calendário, com a dívida do art. 137 intacta. Pior: era
     mais fácil apagar o alerta do que resolvê-lo. */
  const gozos = todosOsRegistros.filter((g) => g.inicio.getTime() <= ate.getTime());
  const agendados = todosOsRegistros.filter((g) => g.inicio.getTime() > ate.getTime());

  // Percorre TODOS os períodos aquisitivos já completos, do mais antigo para o
  // mais novo, e reporta o PRIMEIRO que ainda não foi gozado — é ele que corre
  // risco de vencer. Olhar só o período mais recente escondia justamente o caso
  // grave: quem acumulou um período antigo nunca tirado (o que paga em dobro).
  const ciclos = Math.floor(mesesDeCasa / 12);
  const periodos = Array.from({ length: ciclos }, (_, k) => {
    const i = k + 1;
    const direitoDesde = somaMeses(adm, i * 12);
    return {
      aquisitivoInicio: somaMeses(adm, (i - 1) * 12),
      direitoDesde,
      limiteConcessao: somaMeses(direitoDesde, 12),
      creditados: 0,
      gozoSemDias: false,
    };
  });

  /* Cada dia gozado abate o período EM ABERTO MAIS ANTIGO cujo direito já havia
     nascido na data do gozo (FIFO — é assim que se acerta férias atrasadas).
     Férias partidas em 15+15 somam, e um gozo grande transborda para o período
     seguinte.
   *
   * Antes, cada período só olhava os gozos dentro de uma janela fixa de 24 meses
   * (12 de concessão + 12 de atraso tolerado). Quem regularizou com MAIS atraso
   * que isso — que é justamente quem estava pior — nunca quitava o período: o
   * gozo caía fora da janela, era creditado ao período seguinte, e a ficha
   * seguia estampando "Férias VENCIDAS há 940 dia(s)" para alguém que tinha
   * tirado as férias. O aviso não tinha como sair da tela, e ainda afirmava
   * "por lei, o pagamento é em dobro" sobre um período já concedido.
   *
   * A data do gozo continua importando para uma coisa só: ninguém goza um
   * período cujo direito ainda não nasceu. */
  /* Período cujo prazo de concessão acabou ANTES de o sistema ter qualquer
     registro de férias. Não está "em aberto": é DESCONHECIDO. Por isso ele não
     recebe abatimento — senão um gozo de 2026 quitaria um período de 2015 sobre
     o qual o sistema não sabe nada, e o período de 2025, que ele sabe julgar,
     ficaria descoberto e apareceria como vencido. */
  const desconhecido = (p: { limiteConcessao: Date }) =>
    !!desde && p.limiteConcessao.getTime() < desde.getTime();

  for (const g of [...gozos].sort((a, b) => a.inicio.getTime() - b.inicio.getTime())) {
    let restante = g.dias;
    for (const p of periodos) {
      if (p.direitoDesde.getTime() > g.inicio.getTime()) break; // direito ainda não nascido
      if (desconhecido(p)) continue;
      const quitado = p.gozoSemDias || p.creditados >= DIAS_FERIAS;
      if (quitado) continue;
      /* Base antiga: gozo lançado sem `diasGozados`. Não dá para somar nada, mas
         também não dá para ignorar — senão o sistema passaria a gritar com todo
         registro antigo. Vale como quitação do período mais antigo em aberto…
         …mas SÓ se o período estiver intocado. Num período que já recebeu 15
         dias, deixar o registro sem dias "quitar" apagava os outros 15 — que a
         empresa ainda deve, e que vencem pagos em dobro. */
      if (g.dias === 0) {
        if (p.creditados === 0) { p.gozoSemDias = true; break; }
        continue;
      }
      if (restante <= 0) break;
      const usa = Math.min(DIAS_FERIAS - p.creditados, restante);
      p.creditados += usa;
      restante -= usa;
    }
  }

  let ultimo: SituacaoFerias | null = null;
  for (const p of periodos) {
    const jaGozou = p.gozoSemDias || p.creditados >= DIAS_FERIAS;
    const diasParaLimite = dias(ate, p.limiteConcessao);
    // Sem registro no período: não dá para dizer que venceu, só que não está
    // aqui. Afirmar "venceu" seria inventar; some do alerta e vira informação.
    const foraDoHistorico = !jaGozou && desconhecido(p);
    const situacao: SituacaoFerias["situacao"] = jaGozou
      ? "em-dia"
      : foraDoHistorico ? "sem-registro"
      : diasParaLimite < 0 ? "vencida" : diasParaLimite <= 90 ? "a-vencer" : "em-dia";
    const atual: SituacaoFerias = {
      aquisitivoInicio: p.aquisitivoInicio,
      direitoDesde: p.direitoDesde,
      limiteConcessao: p.limiteConcessao,
      diasParaLimite,
      jaGozou,
      diasGozados: p.gozoSemDias ? DIAS_FERIAS : p.creditados,
      diasEmAberto: Math.max(0, DIAS_FERIAS - (p.gozoSemDias ? DIAS_FERIAS : p.creditados)),
      diasAgendados: agendados.reduce((s, g) => s + g.dias, 0),
      agendadoPara: agendados.length
        ? agendados.reduce((a, b) => (a.inicio.getTime() <= b.inicio.getTime() ? a : b)).inicio
        : null,
      situacao,
    };
    // O mais antigo EM ABERTO é o que importa — mas um período sem histórico
    // não é "em aberto", é desconhecido. Parar nele escondia o período seguinte,
    // que o sistema tem como julgar de verdade.
    if (!jaGozou && situacao !== "sem-registro") return atual;
    ultimo = atual;
  }
  return ultimo; // todos gozados: devolve o último, marcado como em dia
}

// -------------------------- contrato de experiência --------------------------
export const LIMITE_EXPERIENCIA_DIAS = 90;
/** Marcos usados no aviso: 45 dias (decidir prorrogar) e 90 (decidir efetivar). */
export interface SituacaoExperiencia {
  diasDeCasa: number;
  /** Dia em que completa os 90 dias. */
  fim: Date;
  diasParaFim: number;
  situacao: "primeiro-periodo" | "decidir-prorrogacao" | "decidir-efetivacao" | "expirou";
}

/**
 * Situação do contrato de experiência. `null` se já passou dos 90 dias há muito
 * tempo (aí é contrato normal e não há o que avisar) ou sem data de admissão.
 */
/**
 * O FIM DA EXPERIÊNCIA — que é o fim do onboarding.
 *
 * `situacaoExperiencia` existe para AVISAR e por isso devolve `null` em vários
 * casos (já decidida, desligado, mais de 15 dias do prazo). O onboarding
 * precisa de outra coisa: o fato cru de quando a experiência acaba, mesmo
 * quando não há mais nada a decidir — é esse o marco que encerra a integração
 * da pessoa e libera o cartão da tela.
 */
export interface FimExperiencia {
  /** Dia em que os 90 dias se completam. `null` sem data de admissão. */
  fim: Date | null;
  /** Dias até lá (negativo = já passou). NaN quando não dá para calcular. */
  diasParaFim: number;
  /** Os 90 dias já passaram? */
  encerrada: boolean;
  /** A direção já decidiu (efetivou/prorrogou) ou a pessoa saiu. */
  decidida: boolean;
}

export function fimDaExperiencia(c: Colaborador, hoje = HOJE): FimExperiencia {
  const adm = parseData(c.dataAdmissao);
  const decidida = !!c.experienciaDecididaEm || !!c.dataDesligamento;
  if (!adm) return { fim: null, diasParaFim: NaN, encerrada: false, decidida };
  const fim = new Date(adm.getTime() + LIMITE_EXPERIENCIA_DIAS * DIA);
  const diasParaFim = dias(hoje, fim);
  return { fim, diasParaFim, encerrada: diasParaFim < 0, decidida };
}

export function situacaoExperiencia(c: Colaborador, hoje = HOJE): SituacaoExperiencia | null {
  const adm = parseData(c.dataAdmissao);
  if (!adm) return null;
  // Já decidido (efetivado/prorrogado) ou já fora do quadro: não há o que
  // decidir, e insistir fazia o RH clicar de novo em "Efetivar" — duplicando a
  // movimentação de carreira toda vez.
  if (c.experienciaDecididaEm || c.dataDesligamento || c.statusId === "inativo") return null;
  const diasDeCasa = dias(adm, hoje);
  if (diasDeCasa < 0) return null;
  const fim = new Date(adm.getTime() + LIMITE_EXPERIENCIA_DIAS * DIA);
  const diasParaFim = dias(hoje, fim);
  // Passou mais de 15 dias do prazo: o contrato já virou indeterminado, não há
  // mais decisão a tomar — para de avisar para não virar ruído eterno.
  if (diasParaFim < -15) return null;

  const situacao =
    diasParaFim < 0 ? "expirou"
      : diasDeCasa >= 45 - 10 && diasDeCasa <= 45 + 5 ? "decidir-prorrogacao"
        : diasParaFim <= 15 ? "decidir-efetivacao"
          : "primeiro-periodo";
  return { diasDeCasa, fim, diasParaFim, situacao };
}
