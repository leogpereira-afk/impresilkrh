// ============================================================================
// O QUE O SISTEMA JÁ SABE SOBRE A PESSOA, na hora da conversa.
//
// A tela de Feedback só dizia QUEM está esperando. Quem ia conversar chegava
// sem nada na mão: sem saber que a pessoa faltou três vezes no trimestre, que
// recebeu R$ 2.400 de hora extra, que fez a NR-35 mês passado, ou que a última
// avaliação dela subiu. Tudo isso já estava no sistema, em quatro telas
// diferentes, e ninguém abre quatro telas antes de uma conversa de dez minutos.
//
// A REGRA QUE MANDA AQUI: dado que não existe não vira zero.
//
// "Nenhuma falta" e "não temos o ponto dessa pessoa" são fatos opostos, e o
// segundo disfarçado do primeiro faz o líder elogiar a assiduidade de alguém
// que ele nem mediu. Por isso cada bloco devolve `temDados`, e a tela mostra
// "sem registro" em vez de um número bonito e falso.
// ============================================================================

import { diasDeCalendario } from "@/lib/format";
import { ARQUETIPOS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

/** Quanto tempo para trás o dossiê olha. Um trimestre: é o intervalo da
 *  cadência de feedback, então a conversa cobre o período desde a última. */
export const JANELA_MESES = 3;

/* Tipos de pagamento que NÃO são ganho variável: o salário e o adiantamento
   são a mesma remuneração combinada, e férias/rescisão são direito, não
   desempenho. O que sobra é o que a pessoa ganhou ALÉM do combinado. */
const NAO_E_GANHO_EXTRA = new Set([
  "Salário", "Adiantamento", "Férias", "Rescisão", "Vale Transporte", "Plano de Saúde",
]);

const cem = (n: number) => Math.round(n * 100) / 100;

export interface PontoLike {
  colaboradorId?: string | null;
  competencia?: string;
  faltasMin?: number;
  extrasMin?: number;
  dias?: { situacao?: string }[];
}
export interface PagamentoLike {
  colaboradorId?: string | null;
  competencia?: string;
  tipo?: string;
  valor?: number;
}
export interface TreinamentoLike {
  colaboradorId?: string | null;
  titulo?: string;
  status?: string;
  concluidoEm?: string | null;
}
export interface AvaliacaoLike {
  colaboradorId?: string | null;
  notaFinal?: number | null;
  statusDesempenho?: string | null;
  planoAcao?: string | null;
  comentarios?: string | null;
  criadoEm?: string;
}

/** As competências (YYYY-MM) da janela, da mais nova para a mais velha. */
export function competenciasDaJanela(hoje: Date = HOJE, meses = JANELA_MESES): string[] {
  const fora: string[] = [];
  const d = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  for (let i = 0; i < meses; i++) {
    fora.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    d.setMonth(d.getMonth() - 1);
  }
  return fora;
}

export interface Assiduidade {
  temDados: boolean;
  meses: number;          // quantas competências realmente tinham ponto
  faltas: number;         // dias
  atestados: number;
  horasExtras: number;    // decimais
  horasFalta: number;
}

/** Assiduidade da janela. `temDados: false` quando não há ponto nenhum. */
export function assiduidade(
  pontos: readonly PontoLike[], colaboradorId: string, hoje: Date = HOJE, meses = JANELA_MESES,
): Assiduidade {
  const janela = new Set(competenciasDaJanela(hoje, meses));
  const meus = pontos.filter((p) => p.colaboradorId === colaboradorId && janela.has(String(p.competencia)));
  if (!meus.length) return { temDados: false, meses: 0, faltas: 0, atestados: 0, horasExtras: 0, horasFalta: 0 };
  let faltas = 0, atestados = 0, extrasMin = 0, faltasMin = 0;
  for (const p of meus) {
    extrasMin += Number(p.extrasMin) || 0;
    faltasMin += Number(p.faltasMin) || 0;
    for (const d of p.dias ?? []) {
      if (d.situacao === "falta") faltas++;
      if (d.situacao === "atestado") atestados++;
    }
  }
  return {
    temDados: true,
    meses: meus.length,
    faltas,
    atestados,
    horasExtras: cem(extrasMin / 60),
    horasFalta: cem(faltasMin / 60),
  };
}

export interface GanhoExtra { tipo: string; valor: number }
export interface Ganhos {
  temDados: boolean;
  total: number;
  porTipo: GanhoExtra[];  // do maior para o menor
}

/** O que a pessoa recebeu ALÉM do salário combinado, na janela. */
export function ganhosAlemDoSalario(
  pagamentos: readonly PagamentoLike[], colaboradorId: string, hoje: Date = HOJE, meses = JANELA_MESES,
): Ganhos {
  const janela = new Set(competenciasDaJanela(hoje, meses));
  const meus = pagamentos.filter((p) => p.colaboradorId === colaboradorId && janela.has(String(p.competencia)));
  if (!meus.length) return { temDados: false, total: 0, porTipo: [] };
  const mapa = new Map<string, number>();
  for (const p of meus) {
    const tipo = String(p.tipo ?? "Outros");
    if (NAO_E_GANHO_EXTRA.has(tipo)) continue;
    mapa.set(tipo, (mapa.get(tipo) ?? 0) + (Number(p.valor) || 0));
  }
  const porTipo = [...mapa.entries()]
    .map(([tipo, valor]) => ({ tipo, valor: cem(valor) }))
    .filter((x) => x.valor !== 0)
    .sort((a, b) => b.valor - a.valor);
  return { temDados: true, total: cem(porTipo.reduce((n, x) => n + x.valor, 0)), porTipo };
}

export interface Perfil {
  temDados: boolean;
  comportamental?: string;
  humor?: string;
  aprendizagem?: string;
  /** Como dar feedback a esse perfil — o campo `feedback` do arquétipo. */
  comoFalar?: string;
  /** Como dar notícia ruim a ele — usado quando a conversa é de ajuste. */
  noticiaRuim?: string;
  /** O que EVITAR com esse perfil. */
  evite?: string;
  fortesDoPerfil?: string[];
  atencaoDoPerfil?: string[];
}

/** O perfil comportamental e o que ele orienta na conversa. */
export function perfilParaConversa(colab: {
  perfilComportamental?: string; humor?: string; estiloAprendizagem?: string;
}): Perfil {
  const p = String(colab.perfilComportamental ?? "").trim();
  const a = ARQUETIPOS[p];
  if (!p && !colab.humor && !colab.estiloAprendizagem) return { temDados: false };
  /* O arquétipo tem um campo `feedback` FEITO para isto, e um `noticiasRuins`
     para a conversa de ajuste. Esse texto já estava escrito em constants.ts e
     nunca tinha chegado a uma tela de feedback — que é exatamente onde ele
     serve. */
  return {
    temDados: true,
    comportamental: p || undefined,
    humor: colab.humor || undefined,
    aprendizagem: colab.estiloAprendizagem || undefined,
    comoFalar: a?.comoLidar?.feedback,
    noticiaRuim: a?.comoLidar?.noticiasRuins,
    evite: a?.comoLidar?.evite,
    fortesDoPerfil: a?.fortes,
    atencaoDoPerfil: a?.atencao,
  };
}

export interface Desenvolvimento {
  temDados: boolean;
  concluidos: { titulo: string; em?: string | null }[];
  pendentes: string[];
  notaFinal?: number | null;
  statusDesempenho?: string | null;
  planoAcao?: string | null;
  /** Comparado com a avaliação anterior: subiu, caiu ou manteve. */
  tendencia?: "subiu" | "caiu" | "manteve" | null;
}

/** Treinamento e avaliação — o que a pessoa desenvolveu. */
export function desenvolvimento(
  treinamentos: readonly TreinamentoLike[],
  avaliacoes: readonly AvaliacaoLike[],
  colaboradorId: string,
): Desenvolvimento {
  const meus = treinamentos.filter((t) => t.colaboradorId === colaboradorId);
  const avals = avaliacoes
    .filter((a) => a.colaboradorId === colaboradorId && a.notaFinal != null)
    .sort((a, b) => String(b.criadoEm ?? "").localeCompare(String(a.criadoEm ?? "")));
  if (!meus.length && !avals.length) {
    return { temDados: false, concluidos: [], pendentes: [] };
  }
  const concluidos = meus
    .filter((t) => /conclu/i.test(String(t.status ?? "")))
    .map((t) => ({ titulo: String(t.titulo ?? ""), em: t.concluidoEm ?? null }));
  const pendentes = meus
    .filter((t) => !/conclu/i.test(String(t.status ?? "")))
    .map((t) => String(t.titulo ?? ""));
  const ultima = avals[0];
  const anterior = avals[1];
  let tendencia: Desenvolvimento["tendencia"] = null;
  if (ultima?.notaFinal != null && anterior?.notaFinal != null) {
    const d = ultima.notaFinal - anterior.notaFinal;
    tendencia = d > 0.05 ? "subiu" : d < -0.05 ? "caiu" : "manteve";
  }
  return {
    temDados: true,
    concluidos,
    pendentes,
    notaFinal: ultima?.notaFinal ?? null,
    statusDesempenho: ultima?.statusDesempenho ?? null,
    planoAcao: ultima?.planoAcao?.trim() || null,
    tendencia,
  };
}

export interface Dossie {
  assiduidade: Assiduidade;
  ganhos: Ganhos;
  perfil: Perfil;
  desenvolvimento: Desenvolvimento;
  /** Quais blocos vieram vazios — a tela avisa em vez de fingir que está tudo lá. */
  semDados: string[];
  janelaMeses: number;
}

/** Junta tudo para uma pessoa. */
export function dossieDoColaborador(
  colab: { id: string; perfilComportamental?: string; humor?: string; estiloAprendizagem?: string },
  fontes: {
    pontos?: readonly PontoLike[];
    pagamentos?: readonly PagamentoLike[];
    treinamentos?: readonly TreinamentoLike[];
    avaliacoes?: readonly AvaliacaoLike[];
  },
  hoje: Date = HOJE,
  meses = JANELA_MESES,
): Dossie {
  const a = assiduidade(fontes.pontos ?? [], colab.id, hoje, meses);
  const g = ganhosAlemDoSalario(fontes.pagamentos ?? [], colab.id, hoje, meses);
  const p = perfilParaConversa(colab);
  const d = desenvolvimento(fontes.treinamentos ?? [], fontes.avaliacoes ?? [], colab.id);
  const semDados = [
    a.temDados ? null : "ponto",
    g.temDados ? null : "pagamentos",
    p.temDados ? null : "perfil comportamental",
    d.temDados ? null : "treinamento e avaliação",
  ].filter(Boolean) as string[];
  return { assiduidade: a, ganhos: g, perfil: p, desenvolvimento: d, semDados, janelaMeses: meses };
}

/* Quantos dias desde a data — usado pela tela para dizer "há 12 dias". */
export const diasDesde = (iso?: string | null, hoje: Date = HOJE): number | null => {
  if (!iso) return null;
  const n = -diasDeCalendario(iso, hoje);
  return Number.isFinite(n) ? n : null;
};
