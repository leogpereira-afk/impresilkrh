import { useMemo, useState } from "react";
import {
  Grid3x3, ClipboardCheck, Target, GraduationCap, MessageSquare,
  Award, AlertTriangle, Users, Gauge, Plus, PencilLine,
  ClipboardList, Sparkles, Trash2,
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
import type { Avaliacao, CicloAvaliacao, Colaborador, Feedback, Meta, PDI, Pesquisa, PerguntaPesquisa, TipoPesquisa, StatusPesquisa, TipoPergunta } from "@/data/types";

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

// Cor da nota/média (verde ≥80, âmbar ≥60, vermelho abaixo).
const corNota = (n: number) => (n >= 80 ? "#16a34a" : n >= 60 ? "#d97706" : "#dc2626");

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

  // Média de desempenho por setor (área): soma das notas ÷ avaliados.
  // Ordenado do menor para o maior — o topo é onde concentrar a atenção.
  const mediaPorSetor = useMemo(() => {
    const m = new Map<string, { areaId: string; soma: number; avaliados: number; total: number }>();
    for (const c of escopo) {
      const areaId = c.areaId ?? "sem-area";
      const g = m.get(areaId) ?? { areaId, soma: 0, avaliados: 0, total: 0 };
      g.total += 1;
      const nota = avalGestorPorColab.get(c.id)?.notaFinal;
      if (nota != null) { g.soma += nota; g.avaliados += 1; }
      m.set(areaId, g);
    }
    return [...m.values()]
      .map((g) => ({ ...g, media: g.avaliados ? g.soma / g.avaliados : null }))
      .sort((a, b) => {
        if (a.media == null) return b.media == null ? 0 : 1; // setores sem nota ao fim
        if (b.media == null) return -1;
        return a.media - b.media; // menor média primeiro = onde atuar
      });
  }, [escopo, avalGestorPorColab]);
  const focoAreaId = mediaPorSetor.find((s) => s.media != null)?.areaId;

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
    {
      id: "pesquisas",
      label: "Pesquisas e Dinâmicas",
      icon: <ClipboardList className="h-4 w-4" />,
      conteudo: <AbaPesquisas />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Desempenho, Retenção e Pesquisas"
        description={`9-Box, avaliações, metas, PDI, feedbacks, pesquisas e dinâmicas — ${ciclo?.nome ?? "Ciclo 2026.1"}.`}
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
        <Card>
          <CardHeader
            title="Média de desempenho por setor"
            subtitle="Soma das notas ÷ avaliados, do menor para o maior — comece a atuar pelo topo da lista."
            icon={<Gauge className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {comNota.length === 0 ? (
              <EmptyState title="Sem notas lançadas" description="Lance avaliações na aba “Avaliações” para ver a média por setor." icon={<Gauge className="h-8 w-8" />} />
            ) : (
              <div className="space-y-3">
                {mediaPorSetor.map((s) => {
                  const nome = s.areaId === "sem-area" ? "Sem setor" : d.nomeArea(s.areaId);
                  const foco = s.media != null && s.areaId === focoAreaId;
                  const cor = s.media == null ? "#94a3b8" : corNota(s.media);
                  const colabs = escopo.filter((c) => (c.areaId ?? "sem-area") === s.areaId);
                  return (
                    <button
                      key={s.areaId}
                      type="button"
                      onClick={() => drill.abrir(`Setor: ${nome}`, colabs, s.media != null ? `Média ${s.media.toFixed(1)} · ${s.avaliados}/${s.total} avaliados` : `${s.total} colaborador(es) · sem notas`)}
                      className="block w-full rounded-lg p-2 text-left transition hover:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                          {nome}
                          {foco && <Badge variant="warning">Atue aqui</Badge>}
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: cor }}>
                          {s.media != null ? s.media.toFixed(1) : "—"}
                          <span className="ml-1 text-xs font-normal text-slate-400">{s.avaliados}/{s.total} aval.</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all" style={{ width: `${s.media ?? 0}%`, backgroundColor: cor }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardBody>
        </Card>
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

// ===================== Pesquisas e Dinâmicas =====================
const VAR_STATUS_PESQ: Record<StatusPesquisa, "success" | "neutral" | "warning"> = {
  Ativa: "success", Rascunho: "neutral", Encerrada: "warning",
};
const LABEL_PERGUNTA: Record<TipoPergunta, string> = {
  Escala: "Escala (1–5)", Texto: "Texto livre", SimNao: "Sim / Não", Multipla: "Múltipla escolha",
};

function AbaPesquisas() {
  const sessao = useSessao();
  const toast = useToast();
  const { items, criar, atualizar, remover } = useColecao("pesquisas");
  const gere = podeGerir(sessao);
  const [editar, setEditar] = useState<Pesquisa | null>(null);
  const [novo, setNovo] = useState(false);

  const pesquisas = items as Pesquisa[];
  const surveys = pesquisas.filter((p) => p.tipo === "Pesquisa");
  const dinamicas = pesquisas.filter((p) => p.tipo === "Dinâmica");
  const ativas = pesquisas.filter((p) => p.status === "Ativa").length;

  const salvar = (dados: Omit<Pesquisa, "id" | "criadoEm">) => {
    if (editar && editar.id) atualizar(editar.id, dados);
    else criar({ ...dados, criadoEm: new Date().toISOString().slice(0, 10) });
    toast(editar && editar.id ? "Atualizada." : `${dados.tipo} criada.`);
    setEditar(null); setNovo(false);
  };
  const ciclarStatus = (p: Pesquisa) => {
    const prox: StatusPesquisa = p.status === "Ativa" ? "Encerrada" : "Ativa";
    atualizar(p.id, { status: prox });
    toast(`"${p.titulo}" agora está ${prox.toLowerCase()}.`);
  };
  const excluir = (p: Pesquisa) => {
    if (confirm(`Excluir "${p.titulo}"?`)) { remover(p.id); toast("Removida."); }
  };

  const aberto = novo || !!editar;
  const tipoNovo: TipoPesquisa = editar && !editar.id ? "Dinâmica" : "Pesquisa";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Pesquisas" value={surveys.length} icon={<ClipboardList className="h-5 w-5" />} accent="brand" />
        <StatCard label="Dinâmicas" value={dinamicas.length} icon={<Sparkles className="h-5 w-5" />} accent="gold" />
        <StatCard label="Ativas" value={ativas} icon={<ClipboardCheck className="h-5 w-5" />} accent="green" />
        <StatCard label="Total" value={pesquisas.length} icon={<MessageSquare className="h-5 w-5" />} accent="blue" />
      </div>

      <Card>
        <CardHeader
          title="Banco de pesquisas"
          subtitle="Clima, eNPS, pulse — com as perguntas de cada uma"
          icon={<ClipboardList className="h-[18px] w-[18px]" />}
          action={gere ? <button className="btn-outline" onClick={() => { setEditar(null); setNovo(true); }}><Plus className="h-4 w-4" /> Nova pesquisa</button> : undefined}
        />
        <CardBody>
          {surveys.length === 0 ? (
            <EmptyState title="Nenhuma pesquisa" description="Crie pesquisas de clima, eNPS e pulse com suas perguntas." icon={<ClipboardList className="h-8 w-8" />} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {surveys.map((p) => (
                <CardPesquisa key={p.id} p={p} gere={gere} onEdit={() => { setNovo(false); setEditar(p); }} onCiclo={() => ciclarStatus(p)} onDel={() => excluir(p)} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Dinâmicas de equipe"
          subtitle="Quebra-gelos e atividades para integrar e engajar o time"
          icon={<Sparkles className="h-[18px] w-[18px]" />}
          action={gere ? <button className="btn-outline" onClick={() => { setNovo(false); setEditar({ id: "", titulo: "", tipo: "Dinâmica", status: "Rascunho", perguntas: [], criadoEm: "" } as Pesquisa); }}><Plus className="h-4 w-4" /> Nova dinâmica</button> : undefined}
        />
        <CardBody>
          {dinamicas.length === 0 ? (
            <EmptyState title="Nenhuma dinâmica" description="Cadastre dinâmicas com o roteiro da atividade." icon={<Sparkles className="h-8 w-8" />} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {dinamicas.map((p) => (
                <CardPesquisa key={p.id} p={p} gere={gere} onEdit={() => { setNovo(false); setEditar(p); }} onCiclo={() => ciclarStatus(p)} onDel={() => excluir(p)} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {gere && aberto && (
        <PesquisaEditor
          pesquisa={editar && editar.id ? editar : null}
          tipoInicial={tipoNovo}
          onFechar={() => { setEditar(null); setNovo(false); }}
          onSalvar={salvar}
        />
      )}
    </div>
  );
}

function CardPesquisa({ p, gere, onEdit, onCiclo, onDel }: { p: Pesquisa; gere: boolean; onEdit: () => void; onCiclo: () => void; onDel: () => void }) {
  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-brand-ink">{p.titulo}</p>
          <p className="text-xs text-slate-400">
            {p.tipo}{p.publico ? ` · ${p.publico}` : ""}{p.anonima ? " · anônima" : ""}
          </p>
        </div>
        <Badge variant={VAR_STATUS_PESQ[p.status]}>{p.status}</Badge>
      </div>
      {p.descricao && <p className="mt-2 text-sm leading-relaxed text-slate-600">{p.descricao}</p>}
      {p.tipo === "Pesquisa" && p.perguntas.length > 0 && (
        <ul className="mt-3 space-y-1 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          {p.perguntas.map((q, i) => (
            <li key={q.id} className="flex items-start gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-400">{i + 1}.</span>
              <span className="flex-1">{q.texto}</span>
              <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-200">{LABEL_PERGUNTA[q.tipo]}</span>
            </li>
          ))}
        </ul>
      )}
      {gere && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <button className="btn-outline h-8 px-3 text-xs" onClick={onEdit}><PencilLine className="h-3.5 w-3.5" /> Editar</button>
          <button className="btn-outline h-8 px-3 text-xs" onClick={onCiclo}>{p.status === "Ativa" ? "Encerrar" : "Ativar"}</button>
          <button className="btn-ghost h-8 px-2 text-xs text-red-600" onClick={onDel} aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

function PesquisaEditor({ pesquisa, tipoInicial, onFechar, onSalvar }: {
  pesquisa: Pesquisa | null;
  tipoInicial: TipoPesquisa;
  onFechar: () => void;
  onSalvar: (dados: Omit<Pesquisa, "id" | "criadoEm">) => void;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(pesquisa?.titulo ?? "");
  const [tipo, setTipo] = useState<TipoPesquisa>(pesquisa?.tipo ?? tipoInicial);
  const [status, setStatus] = useState<StatusPesquisa>(pesquisa?.status ?? "Rascunho");
  const [anonima, setAnonima] = useState(pesquisa?.anonima ?? true);
  const [publico, setPublico] = useState(pesquisa?.publico ?? "");
  const [descricao, setDescricao] = useState(pesquisa?.descricao ?? "");
  const [perguntas, setPerguntas] = useState<PerguntaPesquisa[]>(pesquisa?.perguntas ?? []);
  const [seq, setSeq] = useState(0);

  const novaPergunta = () => { setPerguntas((ps) => [...ps, { id: `q_${ps.length}_${seq}`, texto: "", tipo: "Escala" }]); setSeq((s) => s + 1); };
  const mudarPergunta = (id: string, patch: Partial<PerguntaPesquisa>) => setPerguntas((ps) => ps.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const removerPergunta = (id: string) => setPerguntas((ps) => ps.filter((q) => q.id !== id));

  const salvar = () => {
    if (!titulo.trim()) { toast("Dê um título.", "erro"); return; }
    onSalvar({
      titulo: titulo.trim(),
      tipo,
      status,
      anonima: tipo === "Pesquisa" ? anonima : undefined,
      publico: publico.trim() || undefined,
      descricao: descricao.trim() || undefined,
      perguntas: tipo === "Pesquisa" ? perguntas.filter((q) => q.texto.trim()) : [],
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={pesquisa ? "Editar" : tipo === "Dinâmica" ? "Nova dinâmica" : "Nova pesquisa"}
      descricao="Defina os dados e, para pesquisas, as perguntas."
      largura="max-w-2xl"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}><Plus className="h-4 w-4" /> Salvar</button></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Título" obrigatorio className="sm:col-span-2">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pesquisa de Clima 2026" />
        </Campo>
        <Campo label="Tipo">
          <Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPesquisa)}>
            <option value="Pesquisa">Pesquisa (com perguntas)</option>
            <option value="Dinâmica">Dinâmica (atividade)</option>
          </Select>
        </Campo>
        <Campo label="Status">
          <Select value={status} onChange={(e) => setStatus(e.target.value as StatusPesquisa)}>
            <option value="Rascunho">Rascunho</option>
            <option value="Ativa">Ativa</option>
            <option value="Encerrada">Encerrada</option>
          </Select>
        </Campo>
        <Campo label="Público-alvo">
          <Input value={publico} onChange={(e) => setPublico(e.target.value)} placeholder="Ex.: Todos os colaboradores" />
        </Campo>
        {tipo === "Pesquisa" && (
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={anonima} onChange={(e) => setAnonima(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
            Respostas anônimas
          </label>
        )}
        <Campo label={tipo === "Dinâmica" ? "Roteiro da dinâmica" : "Descrição"} className="sm:col-span-2">
          <Textarea rows={tipo === "Dinâmica" ? 4 : 2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder={tipo === "Dinâmica" ? "Objetivo, duração e passo a passo da atividade…" : "Sobre o que é a pesquisa…"} />
        </Campo>

        {tipo === "Pesquisa" && (
          <div className="sm:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Perguntas ({perguntas.length})</p>
              <button className="btn-outline h-8 px-3 text-xs" onClick={novaPergunta}><Plus className="h-3.5 w-3.5" /> Pergunta</button>
            </div>
            {perguntas.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Adicione perguntas à pesquisa.</p>
            ) : (
              <ul className="space-y-2">
                {perguntas.map((q, i) => (
                  <li key={q.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 p-2.5 sm:flex-row sm:items-center">
                    <span className="text-xs font-semibold text-slate-400">{i + 1}.</span>
                    <Input value={q.texto} onChange={(e) => mudarPergunta(q.id, { texto: e.target.value })} placeholder="Texto da pergunta" className="h-9 flex-1 py-1.5 text-sm" />
                    <Select value={q.tipo} onChange={(e) => mudarPergunta(q.id, { tipo: e.target.value as TipoPergunta })} className="h-9 py-1.5 text-sm sm:w-44">
                      {(Object.keys(LABEL_PERGUNTA) as TipoPergunta[]).map((t) => <option key={t} value={t}>{LABEL_PERGUNTA[t]}</option>)}
                    </Select>
                    <button className="btn-ghost h-9 px-2 text-red-600" onClick={() => removerPergunta(q.id)} aria-label="Remover pergunta"><Trash2 className="h-4 w-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
