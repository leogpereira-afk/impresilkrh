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
const dias = (de: Date, ate: Date) => Math.round((ate.getTime() - de.getTime()) / DIA);
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
  situacao: "em-dia" | "a-vencer" | "vencida";
}

/**
 * Situação das férias de uma pessoa hoje.
 * `null` quando não dá para calcular (sem admissão) ou ainda não completou 1 ano.
 */
export function situacaoFerias(c: Colaborador, feriasDaPessoa: Ferias[], hoje = HOJE): SituacaoFerias | null {
  const adm = parseData(c.dataAdmissao);
  if (!adm) return null;
  const mesesDeCasa = Math.floor(dias(adm, hoje) / 30.44);
  if (mesesDeCasa < 12) return null; // ainda no primeiro período aquisitivo

  // Períodos aquisitivos completos: 1 a cada 12 meses. Pegamos o mais recente.
  const ciclosCompletos = Math.floor(mesesDeCasa / 12);
  const aquisitivoInicio = somaMeses(adm, (ciclosCompletos - 1) * 12);
  const direitoDesde = somaMeses(adm, ciclosCompletos * 12);
  const limiteConcessao = somaMeses(direitoDesde, 12);
  const diasParaLimite = dias(hoje, limiteConcessao);

  // Gozou dentro da janela? Basta um período de férias iniciado depois que o
  // direito nasceu (e que não tenha sido cancelado).
  const jaGozou = feriasDaPessoa.some((f) => {
    if (f.status === "Cancelada") return false;
    const ini = parseData(f.dataInicio);
    return !!ini && ini.getTime() >= direitoDesde.getTime();
  });

  const situacao = jaGozou ? "em-dia" : diasParaLimite < 0 ? "vencida" : diasParaLimite <= 90 ? "a-vencer" : "em-dia";
  return { aquisitivoInicio, direitoDesde, limiteConcessao, diasParaLimite, jaGozou, situacao };
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
export function situacaoExperiencia(c: Colaborador, hoje = HOJE): SituacaoExperiencia | null {
  const adm = parseData(c.dataAdmissao);
  if (!adm) return null;
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
