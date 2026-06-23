import { useMemo, useState } from "react";
import {
  Grid3x3, ClipboardCheck, Target, GraduationCap, MessageSquare,
  Award, AlertTriangle, Users, Gauge, Plus, PencilLine,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { Avatar, Progress, EmptyState } from "@/components/ui/misc";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio, indiceNivel } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import {
  COR_POTENCIAL_DESEMPENHO, COR_RISCO, STATUS_DESEMPENHO, TIPOS_FEEDBACK,
  STATUS_META, STATUS_PDI, faixaMotivacao,
} from "@/lib/constants";
import type { Avaliacao, CicloAvaliacao, Colaborador, Feedback, Meta, PDI } from "@/data/types";

// ===================== Helpers de classificação (puros) =====================
type Bucket = "Baixo" | "Médio" | "Alto";
const NIVEIS: Bucket[] = ["Baixo", "Médio", "Alto"];

// Bucket de desempenho a partir da nota final do gestor.
function bucketDesempenho(nota: number | null | undefined): Bucket {
  if (nota == null) return "Médio";
  if (nota >= 85) return "Alto";
  if (nota >= 70) return "Médio";
  return "Baixo";
}

// Potencial declarado do colaborador (normalizado).
function bucketPotencial(potencial?: string | null): Bucket {
  return potencial === "Alto" ? "Alto" : potencial === "Baixo" ? "Baixo" : "Médio";
}

function statusDesempenhoDe(notaFinal: number): string {
  if (notaFinal >= 80) return "Apto";
  if (notaFinal >= 60) return "Em desenvolvimento";
  return "Não apto";
}

function variantStatusDesempenho(status?: string | null) {
  if (status === "Apto") return "success" as const;
  if (status === "Não apto") return "danger" as const;
  if (status === "Em desenvolvimento") return "warning" as const;
  return "neutral" as const;
}

function variantStatusMeta(status: string) {
  if (status === "Concluída") return "success" as const;
  if (status === "Atrasada") return "danger" as const;
  if (status === "Em andamento") return "info" as const;
  return "neutral" as const;
}

function variantStatusPdi(status: string) {
  if (status === "Concluída") return "success" as const;
  if (status === "Atrasada") return "danger" as const;
  if (status === "Em andamento") return "info" as const;
  return "neutral" as const;
}

function variantTipoFeedback(tipo: string) {
  if (tipo === "Positivo") return "success" as const;
  if (tipo === "Desenvolvimento") return "warning" as const;
  return "info" as const;
}

// Cor de fundo de cada célula 9-box: diagonal estrelas (verde) → riscos (vermelho).
// Pontuação 0..4 a partir dos índices de desempenho (x) + potencial (y).
function corCelula(idxDesempenho: number, idxPotencial: number): string {
  const score = idxDesempenho + idxPotencial; // 0..4
  switch (score) {
    case 4:
      return "bg-green-100 border-green-200";
    case 3:
      return "bg-green-50 border-green-200";
    case 2:
      return "bg-amber-50 border-amber-200";
    case 1:
      return "bg-orange-50 border-orange-200";
    default:
      return "bg-red-50 border-red-200";
  }
}

const ROTULOS_9BOX: Record<string, string> = {
  "Alto-Alto": "Estrela",
  "Médio-Alto": "Alto potencial",
  "Baixo-Alto": "Enigma",
  "Alto-Médio": "Forte desempenho",
  "Médio-Médio": "Mantenedor",
  "Baixo-Médio": "Em desenvolvimento",
  "Alto-Baixo": "Especialista",
  "Médio-Baixo": "Eficaz",
  "Baixo-Baixo": "Risco / Atenção",
};

// Dica de gestão por quadrante (chave `desempenho-potencial`).
const DICAS_9BOX: Record<string, string> = {
  "Alto-Alto": "Reter e acelerar: desafios, visibilidade e plano de sucessão.",
  "Médio-Alto": "Desenvolver rápido: mentoria e metas mais ousadas para destravar.",
  "Baixo-Alto": "Investigar a causa: ajuste de função, contexto ou engajamento.",
  "Alto-Médio": "Reconhecer e expandir escopo; mapear próximo passo de carreira.",
  "Médio-Médio": "Manter e estimular: metas claras e feedback contínuo.",
  "Baixo-Médio": "Plano de desenvolvimento com acompanhamento próximo.",
  "Alto-Baixo": "Valorizar a expertise: reter como referência técnica.",
  "Médio-Baixo": "Consolidar entregas e dar consistência ao desempenho.",
  "Baixo-Baixo": "Plano de ação ou realocação; defina prazo de melhoria.",
};

// Motivação baixa = faixa abaixo de "Neutro" (score < 40), quando informada.
function motivacaoBaixa(score?: number | null): boolean {
  return typeof score === "number" && score < 40;
}

const num = (v: string): number | null => {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// ===================== Página =====================
export default function Desempenho() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const drill = useDrill();

  const { items: avaliacoes, criar: criarAval, atualizar: atualizarAval } = useColecao("avaliacoes");
  const { items: metas, criar: criarMeta, atualizar: atualizarMeta } = useColecao("metas");
  const { items: pdis, criar: criarPdi, atualizar: atualizarPdi } = useColecao("pdis");
  const { items: feedbacks, criar: criarFeedback } = useColecao("feedbacks");
  const { items: ciclos } = useColecao("ciclos");

  const gerir = podeGerir(sessao);

  // Ciclo aberto (fallback para o primeiro cadastrado).
  const ciclo: CicloAvaliacao | undefined = useMemo(
    () => ciclos.find((c) => c.status === "Aberto") ?? ciclos[0],
    [ciclos],
  );

  // Escopo: colaboradores visíveis, sem direção e não inativos.
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => !c.ehDirecao && c.statusId !== "inativo")
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  // Avaliação GESTOR do ciclo por colaborador.
  const avalGestorPorColab = useMemo(() => {
    const m = new Map<string, Avaliacao>();
    for (const a of avaliacoes) {
      if (a.tipo === "GESTOR" && (!ciclo || a.cicloId === ciclo.id)) m.set(a.colaboradorId, a);
    }
    return m;
  }, [avaliacoes, ciclo]);

  // KPIs do topo (listas para drill-down + contagens derivadas).
  const avaliadosColabs = useMemo(
    () => escopo.filter((c) => avalGestorPorColab.get(c.id)?.notaFinal != null),
    [escopo, avalGestorPorColab],
  );
  const elegiveisColabs = useMemo(
    () => escopo.filter((c) => avalGestorPorColab.get(c.id)?.elegivelPromocao),
    [escopo, avalGestorPorColab],
  );
  const riscoAltoColabs = useMemo(
    () => escopo.filter((c) => c.riscoSaida === "Alto"),
    [escopo],
  );

  const comNota = avaliadosColabs
    .map((c) => avalGestorPorColab.get(c.id)?.notaFinal)
    .filter((n): n is number => n != null);
  const notaMedia = comNota.length ? comNota.reduce((s, n) => s + n, 0) / comNota.length : null;
  const elegiveis = elegiveisColabs.length;
  const riscoAlto = riscoAltoColabs.length;

  // Metas / PDIs / Feedbacks restritos ao escopo (individuais por colaborador; metas de área sempre visíveis).
  const metasVisiveis = useMemo(
    () => metas.filter((m) => !m.colaboradorId || idsEscopo.has(m.colaboradorId)),
    [metas, idsEscopo],
  );
  const pdisVisiveis = useMemo(() => pdis.filter((p) => idsEscopo.has(p.colaboradorId)), [pdis, idsEscopo]);
  const feedbacksVisiveis = useMemo(
    () =>
      feedbacks
        .filter((f) => idsEscopo.has(f.colaboradorId))
        .sort((a, b) => (a.criadoEm < b.criadoEm ? 1 : -1)),
    [feedbacks, idsEscopo],
  );

  const abas = [
    {
      id: "9box",
      label: "9-Box",
      icon: <Grid3x3 className="h-4 w-4" />,
      conteudo: <NoveBox escopo={escopo} avalPorColab={avalGestorPorColab} d={d} drill={drill} />,
    },
    {
      id: "avaliacoes",
      label: "Avaliações",
      icon: <ClipboardCheck className="h-4 w-4" />,
      conteudo: (
        <AbaAvaliacoes
          escopo={escopo}
          avalPorColab={avalGestorPorColab}
          ciclo={ciclo}
          gerir={gerir}
          d={d}
          toast={toast}
          criarAval={criarAval}
          atualizarAval={atualizarAval}
        />
      ),
    },
    {
      id: "metas",
      label: "Metas",
      icon: <Target className="h-4 w-4" />,
      conteudo: (
        <AbaMetas
          metas={metasVisiveis}
          escopo={escopo}
          gerir={gerir}
          d={d}
          toast={toast}
          criarMeta={criarMeta}
          atualizarMeta={atualizarMeta}
        />
      ),
    },
    {
      id: "pdi",
      label: "PDI",
      icon: <GraduationCap className="h-4 w-4" />,
      conteudo: (
        <AbaPdi
          pdis={pdisVisiveis}
          escopo={escopo}
          gerir={gerir}
          d={d}
          toast={toast}
          criarPdi={criarPdi}
          atualizarPdi={atualizarPdi}
        />
      ),
    },
    {
      id: "feedbacks",
      label: "Feedbacks",
      icon: <MessageSquare className="h-4 w-4" />,
      conteudo: (
        <AbaFeedbacks
          feedbacks={feedbacksVisiveis}
          escopo={escopo}
          gerir={gerir}
          d={d}
          toast={toast}
          criarFeedback={criarFeedback}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Desempenho e Retenção"
        description={`Matriz 9-Box, avaliações, metas, PDI e feedbacks — ${ciclo?.nome ?? "Ciclo 2026.1"}.`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          className="w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => drill.abrir("Colaboradores avaliados", avaliadosColabs, `${avaliadosColabs.length} com nota lançada · de ${escopo.length} no escopo`)}
        >
          <StatCard label="Avaliados" value={comNota.length} hint={`de ${escopo.length} no escopo`} icon={<Users className="h-5 w-5" />} accent="brand" />
        </button>
        <StatCard label="Nota média" value={notaMedia != null ? notaMedia.toFixed(1) : "—"} hint={comNota.length ? `Média de ${comNota.length} avaliado(s)` : "Sem notas lançadas"} icon={<Gauge className="h-5 w-5" />} accent="gold" />
        <button
          type="button"
          className="w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => drill.abrir("Elegíveis a promoção", elegiveisColabs, ciclo ? `${elegiveisColabs.length} colaborador(es) · nota mín. ${ciclo.notaMinPromocao}` : `${elegiveisColabs.length} colaborador(es)`)}
        >
          <StatCard label="Elegíveis a promoção" value={elegiveis} hint={ciclo ? `Nota mín. ${ciclo.notaMinPromocao}` : undefined} icon={<Award className="h-5 w-5" />} accent="green" />
        </button>
        <button
          type="button"
          className="w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => drill.abrir("Risco de saída alto", riscoAltoColabs, `${riscoAltoColabs.length} colaborador(es) · atenção à retenção`)}
        >
          <StatCard label="Risco de saída alto" value={riscoAlto} hint="Atenção à retenção" icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
        </button>
      </div>

      <div className="mt-6">
        <Tabs abas={abas} />
      </div>

      <DrillModal {...drill.props} />
    </div>
  );
}

// ===================== Aba 1 — 9-Box =====================
function NoveBox({
  escopo,
  avalPorColab,
  d,
  drill,
}: {
  escopo: Colaborador[];
  avalPorColab: Map<string, Avaliacao>;
  d: ReturnType<typeof useDominio>;
  drill: ReturnType<typeof useDrill>;
}) {
  // matriz[yPotencial][xDesempenho] => colaboradores
  const matriz = useMemo(() => {
    const m: Record<Bucket, Record<Bucket, Colaborador[]>> = {
      Alto: { Baixo: [], Médio: [], Alto: [] },
      Médio: { Baixo: [], Médio: [], Alto: [] },
      Baixo: { Baixo: [], Médio: [], Alto: [] },
    };
    for (const c of escopo) {
      const des = bucketDesempenho(avalPorColab.get(c.id)?.notaFinal);
      const pot = bucketPotencial(c.potencial);
      m[pot][des].push(c);
    }
    return m;
  }, [escopo, avalPorColab]);

  // Retenção: risco de saída alto OU motivação baixa. Estratégicos = também alto potencial/desempenho.
  const retencao = useMemo(() => {
    const emRisco = escopo.filter(
      (c) => c.riscoSaida === "Alto" || motivacaoBaixa(c.motivacao),
    );
    const criticos = emRisco.filter(
      (c) => c.riscoSaida === "Alto" && motivacaoBaixa(c.motivacao),
    );
    const estrategicos = emRisco.filter((c) => {
      const des = bucketDesempenho(avalPorColab.get(c.id)?.notaFinal);
      return bucketPotencial(c.potencial) === "Alto" || des === "Alto";
    });
    return { emRisco, criticos, estrategicos };
  }, [escopo, avalPorColab]);

  // Linhas de cima (potencial Alto) para baixo.
  const linhasPotencial: Bucket[] = ["Alto", "Médio", "Baixo"];

  return (
    <div className="space-y-4">
    <Card>
      <CardHeader
        title="Matriz 9-Box"
        subtitle="Eixo X: Desempenho (avaliação do gestor) · Eixo Y: Potencial"
        icon={<Grid3x3 className="h-[18px] w-[18px]" />}
        action={
          <span className="hidden text-xs text-slate-400 sm:inline">
            Clique em uma célula para ver os nomes.
          </span>
        }
      />
      <CardBody>
        <div className="flex gap-3">
          {/* Eixo Y vertical */}
          <div className="hidden w-6 shrink-0 items-center justify-center sm:flex">
            <span className="rotate-180 text-xs font-semibold uppercase tracking-wider text-slate-400 [writing-mode:vertical-rl]">
              Potencial →
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="grid grid-cols-3 gap-3">
              {linhasPotencial.map((pot) =>
                NIVEIS.map((des) => {
                  const colabs = matriz[pot][des];
                  const idxDes = NIVEIS.indexOf(des);
                  const idxPot = NIVEIS.indexOf(pot);
                  const chave = `${des}-${pot}`;
                  const rotulo = ROTULOS_9BOX[chave] ?? "—";
                  const dica = DICAS_9BOX[chave] ?? "";
                  const temPessoas = colabs.length > 0;
                  return (
                    <button
                      key={`${pot}-${des}`}
                      type="button"
                      disabled={!temPessoas}
                      title={dica}
                      onClick={
                        temPessoas
                          ? () =>
                              drill.abrir(
                                `9-Box · ${pot} potencial × ${des} desempenho`,
                                colabs,
                                `${rotulo} · ${colabs.length} colaborador(es) · ${dica}`,
                              )
                          : undefined
                      }
                      className={`flex min-h-[176px] flex-col rounded-xl border p-3 text-left transition ${corCelula(idxDes, idxPot)} ${
                        temPessoas
                          ? "cursor-pointer hover:shadow-md hover:ring-2 hover:ring-brand/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                          : "cursor-default"
                      }`}
                    >
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{rotulo}</p>
                          <p className="text-[11px] text-slate-500">
                            Desemp. {des} · Potenc. {pot}
                          </p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-slate-600">
                          {colabs.length}
                          {temPessoas && <span className="font-medium text-brand">ver</span>}
                        </span>
                      </div>
                      {dica && (
                        <p className="mb-2 rounded-md bg-white/60 px-2 py-1 text-[11px] leading-snug text-slate-600 ring-1 ring-inset ring-white/70">
                          <span className="font-semibold text-slate-700">Ação: </span>
                          {dica}
                        </p>
                      )}
                      <div className="flex flex-1 flex-col gap-1.5">
                        {colabs.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          colabs.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-2 rounded-lg bg-white/80 px-2 py-1 ring-1 ring-inset ring-slate-200/70"
                              title={`${c.nome} · ${d.nomeCargo(c)}`}
                            >
                              <Avatar nome={c.nome} size="sm" />
                              <span className="truncate text-xs font-medium text-slate-700">{c.nome}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </button>
                  );
                }),
              )}
            </div>
            <div className="mt-2 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
              Desempenho →
            </div>
          </div>
        </div>

        {/* Legenda */}
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <LegendaItem cor="bg-green-100 border-green-200" texto="Estrelas / talentos a reter" />
            <LegendaItem cor="bg-amber-50 border-amber-200" texto="Mantenedores / desenvolver" />
            <LegendaItem cor="bg-red-50 border-red-200" texto="Risco — plano de ação" />
            <span className="text-xs text-slate-400">
              Sem avaliação no ciclo → desempenho considerado “Médio”.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Potencial:</span>
            {NIVEIS.slice().reverse().map((pot) => (
              <span key={pot} className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COR_POTENCIAL_DESEMPENHO[pot] }} aria-hidden />
                {pot}
              </span>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>

    {/* Como ler o 9-Box (legenda dinâmica) */}
    <Card>
      <CardHeader
        title="Como ler o 9-Box"
        subtitle="Guia rápido de leitura e ação por quadrante"
        icon={<Grid3x3 className="h-[18px] w-[18px]" />}
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-3">
          <GuiaItem
            cor="bg-green-100 border-green-200"
            titulo="Talentos a reter"
            texto="Estrela, Alto potencial e Forte desempenho. Acelere, dê visibilidade e prepare sucessão."
            qtd={
              matriz.Alto.Alto.length +
              matriz.Alto.Médio.length +
              matriz.Médio.Alto.length
            }
          />
          <GuiaItem
            cor="bg-amber-50 border-amber-200"
            titulo="Manter e desenvolver"
            texto="Mantenedores e especialistas. Metas claras, feedback contínuo e desafios graduais."
            qtd={
              matriz.Médio.Médio.length +
              matriz.Baixo.Alto.length +
              matriz.Baixo.Médio.length +
              matriz.Alto.Baixo.length +
              matriz.Médio.Baixo.length
            }
          />
          <GuiaItem
            cor="bg-red-50 border-red-200"
            titulo="Risco — plano de ação"
            texto="Baixo desempenho e baixo potencial. Defina plano com prazo ou avalie realocação."
            qtd={matriz.Baixo.Baixo.length}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          A dica de ação aparece em cada célula. Sem avaliação no ciclo, o desempenho é considerado
          “Médio”. Clique numa célula para ver os nomes.
        </p>
      </CardBody>
    </Card>

    {/* Atenção à retenção: cruza risco de saída alto com motivação baixa */}
    <Card>
      <CardHeader
        title="Atenção à retenção"
        subtitle="Risco de saída alto cruzado com motivação baixa"
        icon={<AlertTriangle className="h-[18px] w-[18px]" />}
        action={
          retencao.emRisco.length > 0 ? (
            <button
              type="button"
              className="btn-outline px-2.5 py-1.5 text-xs"
              onClick={() =>
                drill.abrir(
                  "Atenção à retenção",
                  retencao.emRisco,
                  `${retencao.emRisco.length} em risco · ${retencao.criticos.length} crítico(s) (risco alto + motivação baixa)`,
                )
              }
            >
              Ver todos
            </button>
          ) : undefined
        }
      />
      <CardBody>
        {retencao.emRisco.length === 0 ? (
          <EmptyState
            title="Nenhum colaborador em risco de retenção"
            icon={<AlertTriangle className="h-8 w-8" />}
          />
        ) : (
          <div className="space-y-3">
            {retencao.criticos.length > 0 && (
              <button
                type="button"
                className="w-full rounded-xl border border-red-200 bg-red-50/70 p-3 text-left transition hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
                onClick={() =>
                  drill.abrir(
                    "Retenção crítica",
                    retencao.criticos,
                    `${retencao.criticos.length} colaborador(es) · risco de saída alto + motivação baixa`,
                  )
                }
              >
                <p className="text-sm font-semibold text-red-700">
                  Prioridade máxima · {retencao.criticos.length} colaborador(es)
                </p>
                <p className="mt-0.5 text-xs text-red-600">
                  Risco de saída alto e motivação baixa ao mesmo tempo. Conversa de retenção
                  imediata: escute, ajuste carga/perspectiva e registre um plano.
                </p>
              </button>
            )}

            {retencao.estrategicos.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Estratégicos em risco ({retencao.estrategicos.length})
                </p>
                <p className="mt-0.5 mb-2 text-xs text-amber-700/90">
                  Alto potencial ou alto desempenho com sinal de saída. Recomendação: visibilidade,
                  desafio e plano de carreira.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {retencao.estrategicos.map((c) => (
                    <RetencaoLinha key={c.id} c={c} d={d} />
                  ))}
                </div>
              </div>
            )}

            <div className="grid gap-2 sm:grid-cols-2">
              {retencao.emRisco
                .filter((c) => !retencao.estrategicos.includes(c))
                .map((c) => (
                  <RetencaoLinha key={c.id} c={c} d={d} />
                ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
    </div>
  );
}

// Linha compacta de um colaborador em risco de retenção (risco + motivação).
function RetencaoLinha({
  c,
  d,
}: {
  c: Colaborador;
  d: ReturnType<typeof useDominio>;
}) {
  const motiv = typeof c.motivacao === "number" ? faixaMotivacao(c.motivacao) : null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white/80 px-3 py-2 ring-1 ring-inset ring-slate-200/70">
      <div className="flex min-w-0 items-center gap-2">
        <Avatar nome={c.nome} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-700">{c.nome}</p>
          <p className="truncate text-xs text-slate-400">{d.nomeCargo(c)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {c.riscoSaida === "Alto" && (
          <Badge variant="danger">Saída alta</Badge>
        )}
        {motiv && motivacaoBaixa(c.motivacao) && (
          <span
            className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
            style={{ backgroundColor: motiv.cor }}
            title={`Motivação ${c.motivacao}/100`}
          >
            {motiv.label}
          </span>
        )}
      </div>
    </div>
  );
}

function GuiaItem({
  cor,
  titulo,
  texto,
  qtd,
}: {
  cor: string;
  titulo: string;
  texto: string;
  qtd: number;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
          <span className={`h-3 w-3 rounded border ${cor}`} aria-hidden />
          {titulo}
        </span>
        <Badge variant="neutral">{qtd}</Badge>
      </div>
      <p className="text-xs leading-snug text-slate-500">{texto}</p>
    </div>
  );
}

function LegendaItem({ cor, texto }: { cor: string; texto: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-slate-600">
      <span className={`h-3 w-3 rounded border ${cor}`} aria-hidden />
      {texto}
    </span>
  );
}

// ===================== Aba 2 — Avaliações =====================
interface EdicaoNota {
  colab: Colaborador;
  aval?: Avaliacao;
  tecnico: string;
  comportamental: string;
  resultado: string;
}

function AbaAvaliacoes({
  escopo,
  avalPorColab,
  ciclo,
  gerir,
  d,
  toast,
  criarAval,
  atualizarAval,
}: {
  escopo: Colaborador[];
  avalPorColab: Map<string, Avaliacao>;
  ciclo: CicloAvaliacao | undefined;
  gerir: boolean;
  d: ReturnType<typeof useDominio>;
  toast: ReturnType<typeof useToast>;
  criarAval: ReturnType<typeof useColecao<"avaliacoes">>["criar"];
  atualizarAval: ReturnType<typeof useColecao<"avaliacoes">>["atualizar"];
}) {
  const [edicao, setEdicao] = useState<EdicaoNota | null>(null);

  function abrir(colab: Colaborador) {
    const aval = avalPorColab.get(colab.id);
    setEdicao({
      colab,
      aval,
      tecnico: aval?.notaTecnico != null ? String(aval.notaTecnico) : "",
      comportamental: aval?.notaComportamental != null ? String(aval.notaComportamental) : "",
      resultado: aval?.notaResultado != null ? String(aval.notaResultado) : "",
    });
  }

  // Pré-visualização da nota final (mesma fórmula do salvar).
  const previa = useMemo(() => {
    if (!edicao || !ciclo) return null;
    const tec = num(edicao.tecnico);
    const comp = num(edicao.comportamental);
    const res = num(edicao.resultado);
    if (tec == null || comp == null || res == null) return null;
    return +(tec * ciclo.pesoTecnico + comp * ciclo.pesoComportamental + res * ciclo.pesoResultado).toFixed(1);
  }, [edicao, ciclo]);

  function salvar() {
    if (!edicao) return;
    if (!ciclo) {
      toast("Nenhum ciclo de avaliação configurado.", "erro");
      return;
    }
    const tec = num(edicao.tecnico);
    const comp = num(edicao.comportamental);
    const res = num(edicao.resultado);
    if (tec == null || comp == null || res == null) {
      toast("Informe as três notas (0–100).", "erro");
      return;
    }
    if ([tec, comp, res].some((n) => n < 0 || n > 100)) {
      toast("As notas devem estar entre 0 e 100.", "erro");
      return;
    }

    const notaFinal = +(
      tec * ciclo.pesoTecnico +
      comp * ciclo.pesoComportamental +
      res * ciclo.pesoResultado
    ).toFixed(1);
    const statusDesempenho = statusDesempenhoDe(notaFinal);
    const nivelIdx = indiceNivel(edicao.colab.nivelId);
    const elegivelPromocao = notaFinal >= ciclo.notaMinPromocao && nivelIdx > 0 && nivelIdx < 5;
    const proximoNivel = elegivelPromocao ? `N${nivelIdx + 1}` : edicao.aval?.proximoNivel ?? null;

    const patch = {
      notaTecnico: tec,
      notaComportamental: comp,
      notaResultado: res,
      notaFinal,
      statusDesempenho,
      elegivelPromocao,
      proximoNivel,
    };

    if (edicao.aval) {
      atualizarAval(edicao.aval.id, patch);
    } else {
      criarAval({
        cicloId: ciclo.id,
        colaboradorId: edicao.colab.id,
        avaliadorId: edicao.colab.gestorId ?? null,
        tipo: "GESTOR",
        ...patch,
        status: "Concluída",
        criadoEm: new Date().toISOString(),
      });
    }
    toast(`Nota lançada para ${edicao.colab.nome.split(" ")[0]} (final ${notaFinal}).`, "sucesso");
    setEdicao(null);
  }

  // Distribuição por status de desempenho (apenas avaliações lançadas).
  const distribuicao = useMemo(() => {
    const cont: Record<string, number> = {};
    for (const s of STATUS_DESEMPENHO) cont[s] = 0;
    for (const c of escopo) {
      const st = avalPorColab.get(c.id)?.statusDesempenho;
      if (st && st in cont) cont[st] += 1;
    }
    return cont;
  }, [escopo, avalPorColab]);

  if (escopo.length === 0) {
    return <EmptyState title="Sem colaboradores no escopo" icon={<ClipboardCheck className="h-8 w-8" />} />;
  }

  return (
    <>
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATUS_DESEMPENHO.map((s) => (
          <div key={s} className="card flex items-center justify-between px-4 py-3">
            <span className="text-xs font-medium text-slate-500">{s}</span>
            <Badge variant={variantStatusDesempenho(s)}>{distribuicao[s]}</Badge>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="Avaliações do ciclo"
          subtitle={ciclo ? `${ciclo.nome} · pesos ${pct(ciclo.pesoTecnico)}/${pct(ciclo.pesoComportamental)}/${pct(ciclo.pesoResultado)} (téc./comp./result.)` : "Avaliação de desempenho"}
          icon={<ClipboardCheck className="h-[18px] w-[18px]" />}
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-slate-100 bg-slate-50/50">
              <tr>
                <th className="th">Colaborador</th>
                <th className="th text-right">Técnico</th>
                <th className="th text-right">Comportamental</th>
                <th className="th text-right">Resultado</th>
                <th className="th text-right">Nota final</th>
                <th className="th">Status</th>
                <th className="th">Elegível</th>
                {gerir && <th className="th text-right">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {escopo.map((c) => {
                const a = avalPorColab.get(c.id);
                return (
                  <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="td">
                      <div className="flex items-center gap-2">
                        <Avatar nome={c.nome} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-700">{c.nome}</p>
                          <p className="truncate text-xs text-slate-400">
                            {d.nomeCargo(c)} · {d.nomeNivel(c.nivelId)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="td text-right tabular-nums text-slate-600">{a?.notaTecnico ?? "—"}</td>
                    <td className="td text-right tabular-nums text-slate-600">{a?.notaComportamental ?? "—"}</td>
                    <td className="td text-right tabular-nums text-slate-600">{a?.notaResultado ?? "—"}</td>
                    <td className="td text-right tabular-nums font-semibold text-brand-ink">{a?.notaFinal ?? "—"}</td>
                    <td className="td">
                      {a?.statusDesempenho ? (
                        <Badge variant={variantStatusDesempenho(a.statusDesempenho)}>{a.statusDesempenho}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Pendente</span>
                      )}
                    </td>
                    <td className="td">
                      {a?.elegivelPromocao ? (
                        <Badge variant="gold">Sim{a.proximoNivel ? ` → ${a.proximoNivel}` : ""}</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">Não</span>
                      )}
                    </td>
                    {gerir && (
                      <td className="td text-right">
                        <button className="btn-outline px-2.5 py-1.5 text-xs" onClick={() => abrir(c)}>
                          <PencilLine className="h-3.5 w-3.5" />
                          Lançar nota
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        aberto={!!edicao}
        onFechar={() => setEdicao(null)}
        titulo="Lançar nota de avaliação"
        descricao={edicao ? `${edicao.colab.nome} · ${ciclo?.nome ?? ""}` : undefined}
        rodape={
          <>
            <button className="btn-outline" onClick={() => setEdicao(null)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar avaliação</button>
          </>
        }
      >
        {edicao && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Campo label="Técnico" obrigatorio>
                <Input
                  type="number" min={0} max={100} value={edicao.tecnico}
                  onChange={(e) => setEdicao({ ...edicao, tecnico: e.target.value })}
                />
              </Campo>
              <Campo label="Comportamental" obrigatorio>
                <Input
                  type="number" min={0} max={100} value={edicao.comportamental}
                  onChange={(e) => setEdicao({ ...edicao, comportamental: e.target.value })}
                />
              </Campo>
              <Campo label="Resultado" obrigatorio>
                <Input
                  type="number" min={0} max={100} value={edicao.resultado}
                  onChange={(e) => setEdicao({ ...edicao, resultado: e.target.value })}
                />
              </Campo>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Nota final (ponderada)</span>
                <span className="text-2xl font-semibold text-brand-ink">{previa != null ? previa : "—"}</span>
              </div>
              {previa != null && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge variant={variantStatusDesempenho(statusDesempenhoDe(previa))}>
                    {statusDesempenhoDe(previa)}
                  </Badge>
                  {ciclo && previa >= ciclo.notaMinPromocao && indiceNivel(edicao.colab.nivelId) > 0 && indiceNivel(edicao.colab.nivelId) < 5 && (
                    <Badge variant="gold">Elegível → N{indiceNivel(edicao.colab.nivelId) + 1}</Badge>
                  )}
                </div>
              )}
              {ciclo && (
                <p className="mt-2 text-xs text-slate-400">
                  Pesos: técnico {pct(ciclo.pesoTecnico)}, comportamental {pct(ciclo.pesoComportamental)}, resultado {pct(ciclo.pesoResultado)}.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

// ===================== Aba 3 — Metas =====================
interface EdicaoMeta {
  id?: string;
  titulo: string;
  tipo: string;
  colaboradorId: string;
  indicador: string;
  valorAlvo: string;
  valorAtual: string;
  unidade: string;
  prazo: string;
  status: string;
}

const metaVazia = (): EdicaoMeta => ({
  titulo: "",
  tipo: "Individual",
  colaboradorId: "",
  indicador: "",
  valorAlvo: "",
  valorAtual: "",
  unidade: "%",
  prazo: "",
  status: "Em andamento",
});

function AbaMetas({
  metas,
  escopo,
  gerir,
  d,
  toast,
  criarMeta,
  atualizarMeta,
}: {
  metas: Meta[];
  escopo: Colaborador[];
  gerir: boolean;
  d: ReturnType<typeof useDominio>;
  toast: ReturnType<typeof useToast>;
  criarMeta: ReturnType<typeof useColecao<"metas">>["criar"];
  atualizarMeta: ReturnType<typeof useColecao<"metas">>["atualizar"];
}) {
  const [edicao, setEdicao] = useState<EdicaoMeta | null>(null);

  function abrirNova() {
    setEdicao(metaVazia());
  }
  function abrirEdicao(m: Meta) {
    setEdicao({
      id: m.id,
      titulo: m.titulo,
      tipo: m.tipo,
      colaboradorId: m.colaboradorId ?? "",
      indicador: m.indicador ?? "",
      valorAlvo: m.valorAlvo != null ? String(m.valorAlvo) : "",
      valorAtual: m.valorAtual != null ? String(m.valorAtual) : "",
      unidade: m.unidade ?? "",
      prazo: m.prazo ? m.prazo.slice(0, 10) : "",
      status: m.status,
    });
  }

  function salvar() {
    if (!edicao) return;
    if (!edicao.titulo.trim()) {
      toast("Informe o título da meta.", "erro");
      return;
    }
    const colab = edicao.colaboradorId ? d.colabById.get(edicao.colaboradorId) : undefined;
    const dados = {
      titulo: edicao.titulo.trim(),
      tipo: edicao.tipo,
      colaboradorId: edicao.tipo === "Individual" ? edicao.colaboradorId || null : null,
      areaId: edicao.tipo === "Individual" ? colab?.areaId ?? null : null,
      indicador: edicao.indicador.trim() || undefined,
      valorAlvo: num(edicao.valorAlvo) ?? undefined,
      valorAtual: num(edicao.valorAtual) ?? 0,
      unidade: edicao.unidade.trim() || undefined,
      prazo: edicao.prazo || null,
      status: edicao.status,
    };
    if (edicao.id) {
      atualizarMeta(edicao.id, dados);
      toast("Meta atualizada.", "sucesso");
    } else {
      criarMeta(dados);
      toast("Meta criada.", "sucesso");
    }
    setEdicao(null);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Metas do ciclo"
          subtitle="Metas de área e individuais com acompanhamento de indicadores"
          icon={<Target className="h-[18px] w-[18px]" />}
          action={
            gerir ? (
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={abrirNova}>
                <Plus className="h-3.5 w-3.5" />
                Nova meta
              </button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3">
          {metas.length === 0 ? (
            <EmptyState title="Nenhuma meta cadastrada" icon={<Target className="h-8 w-8" />} />
          ) : (
            metas.map((m) => {
              const alvo = m.valorAlvo ?? 0;
              const atual = m.valorAtual ?? 0;
              const progresso = alvo > 0 ? clamp((atual / alvo) * 100, 0, 100) : 0;
              return (
                <div key={m.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-slate-700">{m.titulo}</p>
                        <Badge variant={m.tipo === "Área" ? "info" : "neutral"}>{m.tipo}</Badge>
                        <Badge variant={variantStatusMeta(m.status)}>{m.status}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {m.tipo === "Individual" && m.colaboradorId
                          ? d.nomeColab(m.colaboradorId)
                          : d.nomeArea(m.areaId)}
                        {m.indicador ? ` · ${m.indicador}` : ""}
                        {m.prazo ? ` · prazo ${formatDate(m.prazo)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm tabular-nums text-slate-600">
                        {atual}
                        {m.unidade ?? ""} / {alvo}
                        {m.unidade ?? ""}
                      </span>
                      {gerir && (
                        <button className="btn-ghost px-2 py-1 text-xs" onClick={() => abrirEdicao(m)}>
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-3">
                    <Progress value={progresso} cor={m.status === "Atrasada" ? COR_RISCO.Alto : undefined} />
                    <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-500">{Math.round(progresso)}%</span>
                  </div>
                </div>
              );
            })
          )}
        </CardBody>
      </Card>

      <Modal
        aberto={!!edicao}
        onFechar={() => setEdicao(null)}
        titulo={edicao?.id ? "Editar meta" : "Nova meta"}
        rodape={
          <>
            <button className="btn-outline" onClick={() => setEdicao(null)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar</button>
          </>
        }
      >
        {edicao && (
          <div className="space-y-3">
            <Campo label="Título" obrigatorio>
              <Input value={edicao.titulo} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Tipo">
                <Select value={edicao.tipo} onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value })}>
                  <option value="Individual">Individual</option>
                  <option value="Área">Área</option>
                </Select>
              </Campo>
              <Campo label="Status">
                <Select value={edicao.status} onChange={(e) => setEdicao({ ...edicao, status: e.target.value })}>
                  {STATUS_META.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Campo>
            </div>
            {edicao.tipo === "Individual" && (
              <Campo label="Colaborador" hint="Opcional — define a área da meta.">
                <Select value={edicao.colaboradorId} onChange={(e) => setEdicao({ ...edicao, colaboradorId: e.target.value })}>
                  <option value="">— Selecionar —</option>
                  {escopo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
              </Campo>
            )}
            <Campo label="Indicador">
              <Input value={edicao.indicador} onChange={(e) => setEdicao({ ...edicao, indicador: e.target.value })} />
            </Campo>
            <div className="grid grid-cols-3 gap-3">
              <Campo label="Valor alvo">
                <Input type="number" value={edicao.valorAlvo} onChange={(e) => setEdicao({ ...edicao, valorAlvo: e.target.value })} />
              </Campo>
              <Campo label="Valor atual">
                <Input type="number" value={edicao.valorAtual} onChange={(e) => setEdicao({ ...edicao, valorAtual: e.target.value })} />
              </Campo>
              <Campo label="Unidade">
                <Input value={edicao.unidade} onChange={(e) => setEdicao({ ...edicao, unidade: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Prazo">
              <Input type="date" value={edicao.prazo} onChange={(e) => setEdicao({ ...edicao, prazo: e.target.value })} />
            </Campo>
          </div>
        )}
      </Modal>
    </>
  );
}

// ===================== Aba 4 — PDI =====================
interface EdicaoPdi {
  id?: string;
  colaboradorId: string;
  competencia: string;
  acao: string;
  resultadoEsperado: string;
  prazo: string;
  status: string;
  progresso: string;
}

const pdiVazio = (colaboradorId: string): EdicaoPdi => ({
  colaboradorId,
  competencia: "",
  acao: "",
  resultadoEsperado: "",
  prazo: "",
  status: "Em andamento",
  progresso: "0",
});

function AbaPdi({
  pdis,
  escopo,
  gerir,
  d,
  toast,
  criarPdi,
  atualizarPdi,
}: {
  pdis: PDI[];
  escopo: Colaborador[];
  gerir: boolean;
  d: ReturnType<typeof useDominio>;
  toast: ReturnType<typeof useToast>;
  criarPdi: ReturnType<typeof useColecao<"pdis">>["criar"];
  atualizarPdi: ReturnType<typeof useColecao<"pdis">>["atualizar"];
}) {
  const [edicao, setEdicao] = useState<EdicaoPdi | null>(null);

  function abrirNovo() {
    setEdicao(pdiVazio(escopo[0]?.id ?? ""));
  }
  function abrirEdicao(p: PDI) {
    setEdicao({
      id: p.id,
      colaboradorId: p.colaboradorId,
      competencia: p.competencia,
      acao: p.acao,
      resultadoEsperado: p.resultadoEsperado ?? "",
      prazo: p.prazo ? p.prazo.slice(0, 10) : "",
      status: p.status,
      progresso: String(p.progresso ?? 0),
    });
  }

  function salvar() {
    if (!edicao) return;
    if (!edicao.colaboradorId) {
      toast("Selecione o colaborador.", "erro");
      return;
    }
    if (!edicao.competencia.trim() || !edicao.acao.trim()) {
      toast("Informe competência e ação.", "erro");
      return;
    }
    const dados = {
      colaboradorId: edicao.colaboradorId,
      competencia: edicao.competencia.trim(),
      acao: edicao.acao.trim(),
      resultadoEsperado: edicao.resultadoEsperado.trim() || undefined,
      prazo: edicao.prazo || null,
      status: edicao.status,
      progresso: clamp(num(edicao.progresso) ?? 0, 0, 100),
    };
    if (edicao.id) {
      atualizarPdi(edicao.id, dados);
      toast("PDI atualizado.", "sucesso");
    } else {
      criarPdi(dados);
      toast("PDI criado.", "sucesso");
    }
    setEdicao(null);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Planos de Desenvolvimento Individual"
          subtitle="Competências, ações e progresso por colaborador"
          icon={<GraduationCap className="h-[18px] w-[18px]" />}
          action={
            gerir ? (
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={abrirNovo}>
                <Plus className="h-3.5 w-3.5" />
                Novo PDI
              </button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3">
          {pdis.length === 0 ? (
            <EmptyState title="Nenhum PDI cadastrado" icon={<GraduationCap className="h-8 w-8" />} />
          ) : (
            pdis.map((p) => (
              <div key={p.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-700">{p.competencia}</p>
                      <Badge variant={variantStatusPdi(p.status)}>{p.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {d.nomeColab(p.colaboradorId)}
                      {p.prazo ? ` · prazo ${formatDate(p.prazo)}` : ""}
                    </p>
                  </div>
                  {gerir && (
                    <button className="btn-ghost px-2 py-1 text-xs shrink-0" onClick={() => abrirEdicao(p)}>
                      <PencilLine className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-2 text-sm text-slate-600">{p.acao}</p>
                {p.resultadoEsperado && (
                  <p className="mt-1 text-xs text-slate-500">
                    <span className="font-medium text-slate-600">Resultado esperado:</span> {p.resultadoEsperado}
                  </p>
                )}
                <div className="mt-2.5 flex items-center gap-3">
                  <Progress value={p.progresso ?? 0} />
                  <span className="w-10 shrink-0 text-right text-xs font-medium text-slate-500">{p.progresso ?? 0}%</span>
                </div>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Modal
        aberto={!!edicao}
        onFechar={() => setEdicao(null)}
        titulo={edicao?.id ? "Editar PDI" : "Novo PDI"}
        rodape={
          <>
            <button className="btn-outline" onClick={() => setEdicao(null)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Salvar</button>
          </>
        }
      >
        {edicao && (
          <div className="space-y-3">
            <Campo label="Colaborador" obrigatorio>
              <Select value={edicao.colaboradorId} onChange={(e) => setEdicao({ ...edicao, colaboradorId: e.target.value })}>
                <option value="">— Selecionar —</option>
                {escopo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Campo>
            <Campo label="Competência" obrigatorio>
              <Input value={edicao.competencia} onChange={(e) => setEdicao({ ...edicao, competencia: e.target.value })} />
            </Campo>
            <Campo label="Ação" obrigatorio>
              <Textarea value={edicao.acao} onChange={(e) => setEdicao({ ...edicao, acao: e.target.value })} />
            </Campo>
            <Campo label="Resultado esperado">
              <Textarea value={edicao.resultadoEsperado} onChange={(e) => setEdicao({ ...edicao, resultadoEsperado: e.target.value })} />
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Status">
                <Select value={edicao.status} onChange={(e) => setEdicao({ ...edicao, status: e.target.value })}>
                  {STATUS_PDI.map((s) => <option key={s} value={s}>{s}</option>)}
                </Select>
              </Campo>
              <Campo label="Progresso (%)">
                <Input type="number" min={0} max={100} value={edicao.progresso} onChange={(e) => setEdicao({ ...edicao, progresso: e.target.value })} />
              </Campo>
            </div>
            <Campo label="Prazo">
              <Input type="date" value={edicao.prazo} onChange={(e) => setEdicao({ ...edicao, prazo: e.target.value })} />
            </Campo>
          </div>
        )}
      </Modal>
    </>
  );
}

// ===================== Aba 5 — Feedbacks =====================
interface EdicaoFeedback {
  colaboradorId: string;
  tipo: string;
  conteudo: string;
}

function AbaFeedbacks({
  feedbacks,
  escopo,
  gerir,
  d,
  toast,
  criarFeedback,
}: {
  feedbacks: Feedback[];
  escopo: Colaborador[];
  gerir: boolean;
  d: ReturnType<typeof useDominio>;
  toast: ReturnType<typeof useToast>;
  criarFeedback: ReturnType<typeof useColecao<"feedbacks">>["criar"];
}) {
  const sessao = useSessao();
  const [edicao, setEdicao] = useState<EdicaoFeedback | null>(null);

  function abrirNovo() {
    setEdicao({ colaboradorId: escopo[0]?.id ?? "", tipo: "Positivo", conteudo: "" });
  }

  function salvar() {
    if (!edicao) return;
    if (!edicao.colaboradorId) {
      toast("Selecione o colaborador.", "erro");
      return;
    }
    if (!edicao.conteudo.trim()) {
      toast("Escreva o conteúdo do feedback.", "erro");
      return;
    }
    criarFeedback({
      colaboradorId: edicao.colaboradorId,
      autorId: sessao?.colaboradorId ?? null,
      tipo: edicao.tipo,
      conteudo: edicao.conteudo.trim(),
      contexto: "Ciclo 2026.1",
      criadoEm: new Date().toISOString(),
    });
    toast("Feedback registrado.", "sucesso");
    setEdicao(null);
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Feedbacks"
          subtitle="Reconhecimento e orientações de desenvolvimento"
          icon={<MessageSquare className="h-[18px] w-[18px]" />}
          action={
            gerir ? (
              <button className="btn-primary px-3 py-1.5 text-xs" onClick={abrirNovo}>
                <Plus className="h-3.5 w-3.5" />
                Novo feedback
              </button>
            ) : undefined
          }
        />
        <CardBody className="space-y-3">
          {feedbacks.length === 0 ? (
            <EmptyState title="Nenhum feedback registrado" icon={<MessageSquare className="h-8 w-8" />} />
          ) : (
            feedbacks.map((f) => (
              <div key={f.id} className="rounded-xl border border-slate-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Avatar nome={d.nomeColab(f.colaboradorId)} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="text-xs text-slate-400">
                        por {f.autorId ? d.nomeColab(f.autorId) : "—"} · {formatDate(f.criadoEm)}
                      </p>
                    </div>
                  </div>
                  <Badge variant={variantTipoFeedback(f.tipo)}>{f.tipo}</Badge>
                </div>
                <p className="mt-2 text-sm text-slate-600">{f.conteudo}</p>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Modal
        aberto={!!edicao}
        onFechar={() => setEdicao(null)}
        titulo="Novo feedback"
        rodape={
          <>
            <button className="btn-outline" onClick={() => setEdicao(null)}>Cancelar</button>
            <button className="btn-primary" onClick={salvar}>Registrar</button>
          </>
        }
      >
        {edicao && (
          <div className="space-y-3">
            <Campo label="Colaborador" obrigatorio>
              <Select value={edicao.colaboradorId} onChange={(e) => setEdicao({ ...edicao, colaboradorId: e.target.value })}>
                <option value="">— Selecionar —</option>
                {escopo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Campo>
            <Campo label="Tipo">
              <Select value={edicao.tipo} onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value })}>
                {TIPOS_FEEDBACK.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            </Campo>
            <Campo label="Conteúdo" obrigatorio>
              <Textarea
                rows={4}
                value={edicao.conteudo}
                onChange={(e) => setEdicao({ ...edicao, conteudo: e.target.value })}
              />
            </Campo>
          </div>
        )}
      </Modal>
    </>
  );
}
