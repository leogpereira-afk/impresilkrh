import { Fragment, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ShieldAlert, MessageSquareWarning, FileWarning, Plus, Trash2, Pencil,
  Upload, ExternalLink, CalendarRange, CalendarX2, Clock, CheckCircle2, Trophy, BarChart3, Brain,
  ChevronDown, ChevronRight, Stethoscope, Coins, Info, ListChecks, Copy, FileDown, FileSpreadsheet, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasVerticais, BarrasColoridas } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao, useConfig } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, formatNumber, formatPercent, diaLocalISO } from "@/lib/format";
import { cn } from "@/lib/cn";
import { TIPOS_ADVERTENCIA } from "@/lib/constants";
import { GlossarioComportamental } from "@/components/comportamental/glossario";
import { Link } from "react-router-dom";
import { HOJE, slug } from "@/data/_gen";
import type { Colaborador, Ponto, PontoDia, SituacaoDia } from "@/data/types";
import { lerPontoPdf, minParaHora, type PontoImportado } from "@/lib/pontoImport";
import FolhaVariavel from "@/pages/FolhaVariavel";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const labelMes = (comp: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(comp || "");
  return m ? `${MESES[+m[2] - 1]}/${m[1]}` : (comp || "—");
};

// As datas de advertências/ausências são guardadas como "YYYY-MM-DD" — a comparação
// lexicográfica funciona como comparação cronológica.
const iso = (d: Date) => diaLocalISO(d); // dia LOCAL (não UTC) — não pula de dia à noite
const diaData = (data?: string | null) => (data ? formatDate(`${String(data).slice(0, 10)}T12:00:00`) : "—");

const COR_TIPO_ADV: Record<string, "neutral" | "warning" | "danger"> = {
  Verbal: "neutral",
  Escrita: "warning",
  Suspensão: "danger",
};

const COR_TIPO_AUS: Record<string, string> = {
  Falta: "#dc2626",
  Atraso: "#d97706",
  Atestado: "#2563eb",
  "Falta justificada": "#16a34a",
  "Saída antecipada": "#7c3aed",
};
const TIPOS_AUSENCIA = ["Falta", "Atraso", "Atestado", "Falta justificada", "Saída antecipada"] as const;

const primeiroNome = (nome: string) => nome.split(" ")[0];

// --- Extrato do ponto: rótulos e cores por situação do dia --------------------
const SIT_LABEL: Record<SituacaoDia, string> = {
  normal: "Trabalhado", falta: "Falta", atestado: "Atestado", abono: "Abono",
  feriado: "Feriado", ferias: "Férias", folga: "Folga (DSR)",
};
const SIT_BADGE: Record<SituacaoDia, "neutral" | "danger" | "info" | "success" | "warning"> = {
  normal: "neutral", falta: "danger", atestado: "info", abono: "success",
  feriado: "warning", ferias: "info", folga: "neutral",
};
// Situações que a legenda explica (na ordem em que aparecem).
const SIT_LEGENDA: { s: SituacaoDia; txt: string }[] = [
  { s: "normal", txt: "Dia trabalhado normalmente." },
  { s: "falta", txt: "Falta não justificada — desconta na folha." },
  { s: "atestado", txt: "Falta coberta por atestado médico (abonada)." },
  { s: "abono", txt: "Falta abonada pela empresa." },
  { s: "feriado", txt: "Feriado." },
  { s: "ferias", txt: "Dia dentro de período de férias." },
  { s: "folga", txt: "Descanso semanal remunerado (fim de semana)." },
];
const diaCurto = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d);

// Contagens do extrato para o dashboard (soma de todos os colaboradores do mês).
function resumoDias(dias: PontoDia[] | undefined) {
  const r = { faltas: 0, atestados: 0, abonos: 0, comExtra: 0, extrasMin: 0, faltasMin: 0 };
  for (const dia of dias ?? []) {
    if (dia.situacao === "falta") r.faltas++;
    if (dia.situacao === "atestado") r.atestados++;
    if (dia.situacao === "abono") r.abonos++;
    if (dia.extrasMin > 0) r.comExtra++;
    r.extrasMin += dia.extrasMin;
    r.faltasMin += dia.faltasMin;
  }
  return r;
}

export default function Ponto() {
  const sessao = useSessao();
  const d = useDominio();
  const drill = useDrill();
  const podeEditar = podeGerir(sessao);

  // Escopo de visibilidade: colaboradores ativos (sem direção / sem inativos).
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => !c.ehDirecao && c.statusId !== "inativo")
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  return (
    <div>
      <PageHeader
        title="Frequência e Advertências"
        description="Registro disciplinar e relatórios de absenteísmo da equipe."
      />

      <Tabs
        abas={[
          {
            id: "advertencias",
            label: "Advertências",
            icon: <ShieldAlert className="h-4 w-4" />,
            conteudo: <AbaAdvertencias escopo={escopo} idsEscopo={idsEscopo} podeEditar={podeEditar} drill={drill} />,
          },
          {
            id: "absenteismo",
            label: "Absenteísmo",
            icon: <BarChart3 className="h-4 w-4" />,
            conteudo: <AbaAbsenteismo escopo={escopo} idsEscopo={idsEscopo} drill={drill} podeEditar={podeEditar} />,
          },
          {
            id: "ponto",
            label: "Ponto do mês",
            icon: <Clock className="h-4 w-4" />,
            conteudo: <AbaPontoMes podeEditar={podeEditar} />,
          },
          {
            id: "folha-variavel",
            label: "Folha Variável",
            icon: <Coins className="h-4 w-4" />,
            conteudo: <FolhaVariavel embutido />,
          },
          {
            id: "comportamental",
            label: "Guia comportamental",
            icon: <Brain className="h-4 w-4" />,
            conteudo: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                  <p className="text-sm text-slate-600">
                    Antes de advertir, entenda o perfil. Como identificar e como lidar com cada pessoa.
                  </p>
                  <Link to="/comportamental" className="btn-outline shrink-0">
                    <Brain className="h-4 w-4" /> Abrir guia completo
                  </Link>
                </div>
                <GlossarioComportamental />
              </div>
            ),
          },
        ]}
      />

      <DrillModal {...drill.props} />
    </div>
  );
}

type Drill = ReturnType<typeof useDrill>;

// =====================================================================================
// ABA — PONTO DO MÊS (importa o Cartão Ponto do Secullum em PDF)
// =====================================================================================
function AbaPontoMes({ podeEditar }: { podeEditar: boolean }) {
  const d = useDominio();
  const config = useConfig();
  const toast = useToast();
  const { items: pontos, criar, atualizar, remover } = useColecao("pontos");
  const fileRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<PontoImportado | null>(null);
  const [competencia, setCompetencia] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<"tudo" | "resumo">("tudo");
  const [excluir, setExcluir] = useState<string | null>(null);
  const [expandido, setExpandido] = useState<Set<string>>(() => new Set());
  const toggleExp = (id: string) =>
    setExpandido((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const colOpts = useMemo(() => d.colaboradores.map((c) => ({ id: c.id, nome: c.nome })), [d.colaboradores]);
  const nomeColab = (id: string | null | undefined) => (id ? (d.colaboradores.find((c) => c.id === id)?.nome ?? id) : null);

  const onArquivo = async (file: File) => {
    setOcupado(true);
    try {
      const buf = await file.arrayBuffer();
      const r = await lerPontoPdf(buf, colOpts);
      if (!r.linhas.length) { toast("Não encontrei funcionários neste PDF. É o Cartão Ponto do Secullum?", "erro"); return; }
      setPrevia(r);
      setCompetencia(r.competencia || competencia);
      const casados = r.linhas.filter((l) => l.colaboradorId).length;
      toast(`Lido: ${r.linhas.length} funcionário(s), ${casados} casaram com o cadastro.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não consegui ler este PDF.", "erro");
    } finally { setOcupado(false); }
  };

  const definirColab = (i: number, colId: string) => {
    if (!previa) return;
    setPrevia({ ...previa, linhas: previa.linhas.map((l, j) => (j === i ? { ...l, colaboradorId: colId || null, colaboradorNome: nomeColab(colId) } : l)) });
  };

  const importar = () => {
    if (!previa) return;
    if (!/^\d{4}-\d{2}$/.test(competencia)) { toast("Escolha a competência (mês/ano).", "erro"); return; }
    const agora = new Date().toISOString();
    let n = 0;
    for (const l of previa.linhas) {
      const chave = l.colaboradorId || `pdf-${slug(l.nomePdf)}`;
      const id = `${competencia}::${chave}`;
      const rec = {
        id, competencia, colaboradorId: l.colaboradorId, nomePdf: l.nomePdf,
        normaisMin: l.normaisMin, faltasMin: l.faltasMin, extrasMin: l.extrasMin,
        dias: l.dias,
        periodoInicio: previa.periodoInicio ?? null, periodoFim: previa.periodoFim ?? null,
        importadoEm: agora, atualizadoEm: agora,
      };
      if (pontos.some((p) => p.id === id)) atualizar(id, rec); else criar(rec);
      n++;
    }
    toast(`${n} ponto(s) importados para ${labelMes(competencia)}. Vão somar no custo mensal.`);
    setPrevia(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const doMes = useMemo(
    () => pontos.filter((p) => p.competencia === competencia)
      .sort((a, b) => (nomeColab(a.colaboradorId) || a.nomePdf).localeCompare(nomeColab(b.colaboradorId) || b.nomePdf)),
    [pontos, competencia], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const totExtras = doMes.reduce((s, p) => s + (p.extrasMin || 0), 0);
  const totFaltas = doMes.reduce((s, p) => s + (p.faltasMin || 0), 0);
  const comps = useMemo(() => [...new Set(pontos.map((p) => p.competencia))].sort().reverse(), [pontos]);

  // Dashboard do extrato: soma das contagens diárias de todos os colaboradores.
  const agg = useMemo(
    () => doMes.reduce(
      (r, p) => { const x = resumoDias(p.dias); r.faltas += x.faltas; r.atestados += x.atestados; r.abonos += x.abonos; r.comExtra += x.comExtra; return r; },
      { faltas: 0, atestados: 0, abonos: 0, comExtra: 0 },
    ),
    [doMes],
  );

  // Resumo p/ enviar: só quem teve hora extra, falta ou atestado no mês.
  const resumoLinhas = useMemo<LinhaResumo[]>(
    () => doMes
      .map((p) => ({ ...ocorrenciasDo(p), nome: nomeColab(p.colaboradorId) || `${p.nomePdf} (não vinculado)` }))
      .filter(temOcorrencia),
    [doMes], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Totais do resumo derivam das PRÓPRIAS linhas exibidas — fecham com o corpo da tabela.
  const totResumo = useMemo(
    () => resumoLinhas.reduce(
      (t, r) => { t.extrasMin += r.extrasMin; t.faltasMin += r.faltasMin; t.atestados += r.atestados.length; return t; },
      { extrasMin: 0, faltasMin: 0, atestados: 0 },
    ),
    [resumoLinhas],
  );
  const empresa = config.empresaNome || "Impresilk";
  const copiarResumo = async () => {
    try {
      await navigator.clipboard.writeText(textoResumo(empresa, competencia, resumoLinhas));
      toast("Resumo copiado — é só colar no WhatsApp.");
    } catch { toast("Não consegui copiar aqui. Baixe o PDF.", "erro"); }
  };

  // Quem não bate ponto (comissão/externo/direção): fica fora da conferência.
  const { atualizar: atualizarColab } = useColecao("colaboradores");
  const [gerNaoBate, setGerNaoBate] = useState(false);
  const naoBatem = useMemo(() => d.colaboradores.filter((c) => c.naoBatePonto), [d.colaboradores]);

  // Conferência: quem do cadastro (ativo, não-direção, que bate ponto) NÃO veio no PDF.
  const presentesIds = useMemo(
    () => new Set(doMes.map((p) => p.colaboradorId).filter((x): x is string => !!x)),
    [doMes],
  );
  const faltandoNoPonto = useMemo(
    () => d.colaboradores
      .filter((c) => !c.ehDirecao && !c.naoBatePonto && c.statusId !== "inativo" && !presentesIds.has(c.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [d.colaboradores, presentesIds],
  );

  // Expandir/recolher todos os extratos (modo Tudo) — para varrer o mês inteiro.
  const idsExpansiveis = useMemo(() => doMes.filter((p) => (p.dias?.length ?? 0) > 0).map((p) => p.id), [doMes]);
  const todosAbertos = idsExpansiveis.length > 0 && idsExpansiveis.every((id) => expandido.has(id));
  const alternarTodos = () => setExpandido(todosAbertos ? new Set() : new Set(idsExpansiveis));

  if (!podeEditar) {
    return <EmptyState icon={<Clock className="h-6 w-6" />} title="Sem permissão" description="O import de ponto é restrito ao RH/gestão." />;
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <Card>
        <CardHeader title="Importar Cartão Ponto (Secullum)" subtitle="Suba o PDF do mês. As horas extras e faltas já vêm calculadas — só extraio e cruzo com o cadastro." icon={<Upload className="h-[18px] w-[18px]" />} />
        <CardBody>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onArquivo(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={ocupado} className="btn-primary disabled:opacity-50">
            {ocupado ? <Clock className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {ocupado ? "Lendo o PDF…" : "Escolher o PDF do ponto"}
          </button>
          <p className="mt-2 text-xs text-slate-400">Nada é enviado para fora: o PDF é lido aqui no seu navegador.</p>
        </CardBody>
      </Card>

      {/* Prévia da importação */}
      {previa && (
        <Card>
          <CardHeader
            title="Confira antes de importar"
            subtitle={`${previa.linhas.length} funcionário(s)${previa.periodoInicio ? ` · período ${diaData(previa.periodoInicio)} a ${diaData(previa.periodoFim)}` : ""}`}
            icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            action={
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Competência</label>
                <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none" />
              </div>
            }
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="th">Funcionário (PDF)</th>
                    <th className="th">Cadastro</th>
                    <th className="th text-right">Normais</th>
                    <th className="th text-right">Faltas</th>
                    <th className="th text-right">Extras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previa.linhas.map((l, i) => (
                    <tr key={i} className={l.colaboradorId ? "" : "bg-amber-50/50"}>
                      <td className="td text-slate-700">{l.nomePdf}</td>
                      <td className="td">
                        {l.colaboradorId ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> {nomeColab(l.colaboradorId)}</span>
                        ) : (
                          <Select value="" onChange={(e) => definirColab(i, e.target.value)} className="min-w-[180px] text-xs">
                            <option value="">⚠️ Vincular a…</option>
                            {colOpts.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </Select>
                        )}
                      </td>
                      <td className="td text-right tabular-nums text-slate-600">{l.normaisTxt || "—"}</td>
                      <td className={`td text-right tabular-nums ${l.faltasMin > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{l.faltasTxt || "—"}</td>
                      <td className={`td text-right tabular-nums ${l.extrasMin > 0 ? "font-medium text-brand" : "text-slate-400"}`}>{l.extrasTxt || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => { setPrevia(null); if (fileRef.current) fileRef.current.value = ""; }} className="btn-outline">Cancelar</button>
              <button onClick={importar} className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Importar {previa.linhas.length} para {labelMes(competencia)}</button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Ponto já importado da competência */}
      {!previa && (
        <Card>
          <CardHeader
            title="Ponto importado"
            subtitle="Horas extras e faltas do mês, por colaborador. Estes números somam no custo mensal de cada um."
            icon={<Clock className="h-[18px] w-[18px]" />}
            action={
              <div className="flex items-center gap-2">
                <button className="btn-outline h-9 px-3 py-0 text-xs" onClick={() => setGerNaoBate(true)} title="Marque quem não registra ponto — fica fora da conferência">
                  <Users className="h-3.5 w-3.5" /> Não batem ponto{naoBatem.length ? ` (${naoBatem.length})` : ""}
                </button>
                {comps.length > 0 && (
                  <Select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="text-sm">
                    {!comps.includes(competencia) && <option value="">Escolha o mês…</option>}
                    {comps.map((c) => <option key={c} value={c}>{labelMes(c)}</option>)}
                  </Select>
                )}
              </div>
            }
          />
          <CardBody>
            {doMes.length === 0 ? (
              <EmptyState icon={<Clock className="h-6 w-6" />} title="Nada importado ainda" description="Suba o PDF do Cartão Ponto acima para começar." />
            ) : (
              <>
                {/* Dashboard: resumo do mês */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Horas extras" value={minParaHora(totExtras)} icon={<Trophy className="h-4 w-4" />} hint={`${agg.comExtra} dia(s) com extra`} />
                  <StatCard label="Horas de falta" value={minParaHora(totFaltas)} icon={<CalendarX2 className="h-4 w-4" />} hint="descontam na folha" />
                  <StatCard label="Faltas" value={String(agg.faltas)} icon={<AlertTriangle className="h-4 w-4" />} hint="dias de falta (dia cheio)" />
                  <StatCard label="Atestados" value={String(agg.atestados)} icon={<Stethoscope className="h-4 w-4" />} hint={agg.abonos ? `+ ${agg.abonos} abono(s)` : "dias com atestado"} />
                </div>

                {/* Seletor de visão: Tudo (extrato completo) ou Resumo (p/ enviar) */}
                <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button type="button" onClick={() => setModo("tudo")}
                    className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition", modo === "tudo" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    <CalendarRange className="h-3.5 w-3.5" /> Tudo
                  </button>
                  <button type="button" onClick={() => setModo("resumo")}
                    className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition", modo === "resumo" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    <ListChecks className="h-3.5 w-3.5" /> Resumo p/ enviar
                  </button>
                </div>

                {modo === "tudo" ? (
                <>
                {/* Conferência: quem do cadastro não apareceu no ponto (fora os que não batem) */}
                {faltandoNoPonto.length > 0 && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800"><AlertTriangle className="h-4 w-4" /> {faltandoNoPonto.length} do cadastro não apareceram neste ponto</p>
                    <p className="mt-1 text-xs text-amber-700">{faltandoNoPonto.map((c) => c.nome).join(", ")}</p>
                    <p className="mt-1 text-[11px] text-amber-600/80">Quem não bate ponto (comissão/externo) já ficou fora desta lista — ajuste em "Não batem ponto".</p>
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    {doMes.length} funcionário(s){doMes.filter((p) => !p.colaboradorId).length ? ` · ${doMes.filter((p) => !p.colaboradorId).length} não vinculado(s)` : ""} · clique no nome para o extrato diário.
                  </p>
                  {idsExpansiveis.length > 0 && (
                    <button className="btn-ghost shrink-0 px-2 py-1 text-xs text-slate-500 hover:text-brand" onClick={alternarTodos}>
                      {todosAbertos ? "Recolher todos" : "Expandir todos"}
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-500">
                      <tr>
                        <th className="th">Colaborador</th>
                        <th className="th text-right">Normais</th>
                        <th className="th text-right">Faltas</th>
                        <th className="th text-right">Extras</th>
                        <th className="th" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {doMes.map((p) => {
                        const rd = resumoDias(p.dias);
                        const temDias = (p.dias?.length ?? 0) > 0;
                        const aberto = expandido.has(p.id);
                        return (
                          <Fragment key={p.id}>
                            <tr className={cn(!p.colaboradorId && "bg-amber-50/40", temDias && "cursor-pointer hover:bg-slate-50/50")} onClick={() => temDias && toggleExp(p.id)}>
                              <td className="td">
                                <div className="flex items-center gap-2">
                                  {temDias
                                    ? (aberto ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />)
                                    : <span className="w-4 shrink-0" />}
                                  <div className="min-w-0">
                                    {p.colaboradorId
                                      ? <span className="font-medium text-slate-700">{nomeColab(p.colaboradorId)}</span>
                                      : <span className="text-amber-700">{p.nomePdf} <Badge variant="warning">não vinculado</Badge></span>}
                                    {temDias && (rd.faltas > 0 || rd.atestados > 0 || rd.comExtra > 0) && (
                                      <p className="mt-0.5 text-[11px] text-slate-400">
                                        {[rd.comExtra && `${rd.comExtra} dia(s) c/ extra`, rd.faltas && `${rd.faltas} falta(s)`, rd.atestados && `${rd.atestados} atestado(s)`].filter(Boolean).join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="td text-right tabular-nums text-slate-600">{minParaHora(p.normaisMin)}</td>
                              <td className={`td text-right tabular-nums ${p.faltasMin > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{minParaHora(p.faltasMin)}</td>
                              <td className={`td text-right tabular-nums ${p.extrasMin > 0 ? "font-medium text-brand" : "text-slate-400"}`}>{minParaHora(p.extrasMin)}</td>
                              <td className="td text-right">
                                <button className="btn-ghost p-1.5 text-red-500" title="Remover" onClick={(e) => { e.stopPropagation(); setExcluir(p.id); }}><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                            {aberto && temDias && (
                              <tr>
                                <td colSpan={5} className="bg-slate-50/50 p-0">
                                  <ExtratoDiario dias={p.dias!} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
                ) : (
                  resumoLinhas.length === 0 ? (
                    <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Sem ocorrências no mês" description="Ninguém teve hora extra, falta ou atestado nesta competência." />
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">{resumoLinhas.length} colaborador(es) com ocorrências em {labelMes(competencia)} · pronto para enviar.</p>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-outline" onClick={copiarResumo}><Copy className="h-4 w-4" /> Copiar p/ WhatsApp</button>
                          <button className="btn-outline" onClick={() => void exportarResumoPdf(empresa, competencia, resumoLinhas)}><FileDown className="h-4 w-4" /> PDF</button>
                          <button className="btn-outline" onClick={() => exportarResumoExcel(empresa, competencia, resumoLinhas)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-100 text-xs text-slate-500">
                            <tr>
                              <th className="th">Colaborador</th>
                              <th className="th text-right">Horas extras</th>
                              <th className="th text-right">Faltas</th>
                              <th className="th text-right">Atestados</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {resumoLinhas.map((r, i) => (
                              <tr key={`${r.nome}-${i}`} className="hover:bg-slate-50/50">
                                <td className="td align-top font-medium text-slate-700">{r.nome}</td>
                                <td className="td align-top text-right">
                                  {r.extrasMin > 0 ? (
                                    <>
                                      <div className="font-medium tabular-nums text-brand">{minParaHora(r.extrasMin)}</div>
                                      {r.extras.length > 0 && <div className="text-[11px] text-slate-400">{r.extras.map((x) => `${diaCurto(x.data)} (${minParaHora(x.extrasMin)})`).join(", ")}</div>}
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="td align-top text-right">
                                  {r.faltasMin > 0 ? (
                                    <>
                                      <div className="font-medium tabular-nums text-red-600">{minParaHora(r.faltasMin)}{r.faltasDias.length ? ` · ${r.faltasDias.length}d` : ""}</div>
                                      <div className="text-[11px] text-slate-400">{faltasDetalhe(r)}</div>
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="td align-top text-right">
                                  {r.atestados.length ? (
                                    <>
                                      <div className="font-medium tabular-nums text-blue-600">{r.atestados.length}d</div>
                                      <div className="text-[11px] text-slate-400">{r.atestados.map((x) => diaCurto(x.data)).join(", ")}</div>
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-200 text-sm">
                            <tr>
                              <td className="td font-semibold text-slate-700">Total do mês</td>
                              <td className="td text-right font-bold tabular-nums text-brand">{minParaHora(totResumo.extrasMin)}</td>
                              <td className="td text-right font-bold tabular-nums text-red-600">{minParaHora(totResumo.faltasMin)}</td>
                              <td className="td text-right font-bold tabular-nums text-blue-600">{totResumo.atestados}d</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )
                )}

                {/* Legenda / explicação — só no modo Tudo (o resumo não usa os selos de situação) */}
                {modo === "tudo" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Info className="h-3.5 w-3.5" /> Como ler o extrato</p>
                  <div className="grid gap-x-6 gap-y-1.5 text-xs text-slate-500 sm:grid-cols-2">
                    {SIT_LEGENDA.map(({ s, txt }) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className="shrink-0"><Badge variant={SIT_BADGE[s]}>{SIT_LABEL[s]}</Badge></span>
                        <span>{txt}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    As horas <b>Normais</b>, <b>Faltas</b> e <b>Extras</b> já vêm calculadas pelo Secullum (regras da CLT) — não recalculamos, para não divergir da folha legal. A soma dos dias confere exatamente com o total do mês.
                  </p>
                </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        aberto={excluir != null}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => { if (excluir) { remover(excluir); toast("Ponto removido."); } setExcluir(null); }}
        titulo="Remover ponto do mês?"
        mensagem="O ponto importado deste colaborador nesta competência será apagado. Para recuperar, é preciso reimportar o PDF do mês."
      />

      {gerNaoBate && (
        <NaoBatePontoModal
          colaboradores={d.colaboradores}
          onToggle={(id, valor) => atualizarColab(id, { naoBatePonto: valor })}
          onFechar={() => setGerNaoBate(false)}
        />
      )}
    </div>
  );
}

// Modal para marcar quem NÃO bate ponto (comissão/externo/direção) — fica fora da
// conferência do ponto. Grava o flag no cadastro do colaborador.
function NaoBatePontoModal({
  colaboradores, onToggle, onFechar,
}: {
  colaboradores: Colaborador[];
  onToggle: (id: string, valor: boolean) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return colaboradores
      .filter((c) => !c.ehDirecao && c.statusId !== "inativo")
      .filter((c) => (t ? c.nome.toLowerCase().includes(t) : true))
      .sort((a, b) => Number(!!b.naoBatePonto) - Number(!!a.naoBatePonto) || a.nome.localeCompare(b.nome));
  }, [colaboradores, busca]);
  const marcados = colaboradores.filter((c) => c.naoBatePonto).length;

  return (
    <Modal aberto onFechar={onFechar} titulo="Quem não bate ponto" descricao="Marque quem não registra ponto (comissão, externo, direção). Fica fora da conferência do ponto do mês." largura="max-w-lg">
      <div className="space-y-3">
        <Input placeholder="Buscar colaborador…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <p className="text-xs text-slate-500">{marcados} marcado(s) como “não bate ponto”.</p>
        <div className="max-h-[55vh] space-y-0.5 overflow-y-auto pr-1">
          {lista.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={!!c.naoBatePonto}
                onChange={(e) => onToggle(c.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span className="text-sm text-slate-700">{c.nome}</span>
            </label>
          ))}
          {lista.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">Ninguém encontrado.</p>}
        </div>
      </div>
    </Modal>
  );
}

// Extrato diário de um colaborador — segue o layout da folha de ponto do Secullum.
function ExtratoDiario({ dias }: { dias: PontoDia[] }) {
  return (
    <div className="px-3 py-3 sm:px-4">
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="th">Dia</th>
              <th className="th">Batidas</th>
              <th className="th text-right">Normais</th>
              <th className="th text-right">Faltas</th>
              <th className="th text-right">Extras</th>
              <th className="th">Situação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dias.map((dia) => {
              const batidas = (dia.marcacoes ?? []).filter((m) => /^\d{1,2}:\d{2}$/.test(m));
              return (
              <tr
                key={dia.data}
                className={cn(
                  dia.extrasMin > 0 && "bg-brand/[0.04]",
                  dia.situacao === "falta" && "bg-red-50/60",
                  dia.situacao === "atestado" && "bg-blue-50/40",
                )}
              >
                <td className="td whitespace-nowrap">
                  <span className="font-medium tabular-nums text-slate-700">{diaCurto(dia.data)}</span>
                  {dia.diaSemana && <span className="ml-1 text-slate-400">{dia.diaSemana}</span>}
                </td>
                <td className="td tabular-nums text-slate-500">{batidas.length ? batidas.join(" · ") : "—"}</td>
                <td className="td text-right tabular-nums text-slate-500">{dia.normaisMin ? minParaHora(dia.normaisMin) : "—"}</td>
                <td className={cn("td text-right tabular-nums", dia.faltasMin > 0 ? "font-medium text-red-600" : "text-slate-300")}>{dia.faltasMin ? minParaHora(dia.faltasMin) : "—"}</td>
                <td className={cn("td text-right tabular-nums", dia.extrasMin > 0 ? "font-medium text-brand" : "text-slate-300")}>{dia.extrasMin ? minParaHora(dia.extrasMin) : "—"}</td>
                <td className="td">{dia.situacao !== "normal" && <Badge variant={SIT_BADGE[dia.situacao]}>{SIT_LABEL[dia.situacao]}</Badge>}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Resumo do mês (só extras/faltas/atestados) — visão condensada p/ enviar ----------
interface LinhaResumo {
  nome: string;
  extrasMin: number;
  extras: PontoDia[];       // dias com hora extra
  faltasMin: number;
  faltasDias: PontoDia[];   // dias de falta cheia (situação "falta")
  atrasosMin: number;       // faltasMin que NÃO são de falta cheia (atrasos/parciais)
  atestados: PontoDia[];    // dias com atestado
  temDetalhe: boolean;      // false = registro legado sem detalhe diário
}

// Extrai as ocorrências de um ponto (o que interessa no resumo).
function ocorrenciasDo(p: Ponto): LinhaResumo {
  const dias = p.dias ?? [];
  const faltasDias = dias.filter((x) => x.situacao === "falta");
  const faltasMin = p.faltasMin ?? 0;
  const faltaCheiaMin = faltasDias.reduce((s, x) => s + (x.faltasMin || 0), 0);
  return {
    nome: p.colaboradorId ? "" : p.nomePdf, // nome real é preenchido por quem chama (tem o cadastro)
    extrasMin: p.extrasMin ?? 0,
    extras: dias.filter((x) => x.extrasMin > 0),
    faltasMin,
    faltasDias,
    atrasosMin: Math.max(0, faltasMin - faltaCheiaMin), // sobra = atrasos/parciais em dias normais
    atestados: dias.filter((x) => x.situacao === "atestado"),
    temDetalhe: (p.dias?.length ?? 0) > 0,
  };
}
// Extras gateiam pelo TOTAL (extrasMin), não pela contagem de dias — assim registros
// antigos sem detalhe diário (dias=undefined) também entram no resumo (simétrico a faltas).
const temOcorrencia = (r: LinhaResumo) => r.extrasMin > 0 || r.faltasMin > 0 || r.atestados.length > 0;

// Detalhe das faltas: datas das faltas cheias + a sobra de atrasos, para o total FECHAR
// com as datas. Sem detalhe diário (registro legado) não afirma a natureza da ausência.
function faltasDetalhe(r: LinhaResumo): string {
  if (!r.temDetalhe) return "sem detalhe diário";
  const partes: string[] = [];
  if (r.faltasDias.length) partes.push(r.faltasDias.map((x) => diaCurto(x.data)).join(", "));
  if (r.atrasosMin > 0) partes.push(`+ ${minParaHora(r.atrasosMin)} em atrasos`);
  return partes.join(" ") || "—";
}

// Texto pronto para colar no WhatsApp.
function textoResumo(empresa: string, comp: string, linhas: LinhaResumo[]): string {
  const corpo = linhas.map((r) => {
    const partes: string[] = [];
    if (r.extrasMin > 0) partes.push(`Extras ${minParaHora(r.extrasMin)}${r.extras.length ? ` (${r.extras.map((x) => diaCurto(x.data)).join(", ")})` : ""}`);
    if (r.faltasMin > 0) partes.push(`Faltas ${minParaHora(r.faltasMin)}${r.faltasDias.length ? ` · ${r.faltasDias.length}d` : ""} (${faltasDetalhe(r)})`);
    if (r.atestados.length) partes.push(`Atestado ${r.atestados.length}d (${r.atestados.map((x) => diaCurto(x.data)).join(", ")})`);
    return `• ${r.nome} — ${partes.join(" | ")}`;
  }).join("\n");
  return `*${empresa} — Resumo do ponto — ${labelMes(comp)}*\n\n${corpo}`;
}

function baixarBlob(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga só depois: em Safari/Firefox o fetch do blob pode ser assíncrono.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportarResumoPdf(empresa: string, comp: string, linhas: LinhaResumo[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const marinho: [number, number, number] = [22, 51, 79];
  doc.setFontSize(15); doc.setTextColor(...marinho); doc.text(empresa || "Impresilk", 14, 16);
  doc.setFontSize(12); doc.setTextColor(60); doc.text(`Resumo do ponto — ${labelMes(comp)}`, 14, 24);
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text("Horas extras, faltas e atestados por colaborador — já calculados pelo Secullum (CLT).", 14, 30);
  autoTable(doc, {
    startY: 35,
    head: [["Colaborador", "Horas extras", "Faltas", "Atestados"]],
    body: linhas.map((r) => [
      r.nome,
      r.extrasMin > 0 ? `${minParaHora(r.extrasMin)}${r.extras.length ? `\n${r.extras.map((x) => diaCurto(x.data)).join(", ")}` : ""}` : "—",
      r.faltasMin > 0 ? `${minParaHora(r.faltasMin)}${r.faltasDias.length ? ` · ${r.faltasDias.length}d` : ""}\n${faltasDetalhe(r)}` : "—",
      r.atestados.length ? `${r.atestados.length}d\n${r.atestados.map((x) => diaCurto(x.data)).join(", ")}` : "—",
    ]),
    headStyles: { fillColor: marinho },
    styles: { fontSize: 8, cellPadding: 2, valign: "top" },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  baixarBlob(`resumo-ponto-${comp}.pdf`, doc.output("blob"));
}

function exportarResumoExcel(empresa: string, comp: string, linhas: LinhaResumo[]) {
  const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const faltasCel = (r: LinhaResumo) => r.faltasDias.map((x) => diaCurto(x.data)).join(", ") + (r.atrasosMin > 0 ? ` (+ ${minParaHora(r.atrasosMin)} atrasos)` : "");
  const corpo = linhas.map((r) => `<tr><td>${esc(r.nome)}</td><td>${r.extrasMin > 0 ? minParaHora(r.extrasMin) : ""}</td><td>${esc(r.extras.map((x) => diaCurto(x.data)).join(", "))}</td><td>${r.faltasMin > 0 ? minParaHora(r.faltasMin) : ""}</td><td>${esc(faltasCel(r))}</td><td>${r.atestados.length || ""}</td><td>${esc(r.atestados.map((x) => diaCurto(x.data)).join(", "))}</td></tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1">
<tr><td colspan="7" style="font-weight:bold;font-size:14px">${esc(empresa)} — Resumo do ponto — ${labelMes(comp)}</td></tr>
<tr style="background:#16334f;color:#fff;font-weight:bold"><td>Colaborador</td><td>Horas extras</td><td>Dias c/ extra</td><td>Horas de falta</td><td>Dias de falta</td><td>Atestados (dias)</td><td>Datas do atestado</td></tr>
${corpo || '<tr><td colspan="7">Sem ocorrências</td></tr>'}
</table></body></html>`;
  baixarBlob(`resumo-ponto-${comp}.xls`, new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}

// =====================================================================================
// ABA — ADVERTÊNCIAS
// =====================================================================================
function AbaAdvertencias({
  escopo,
  idsEscopo,
  podeEditar,
  drill,
}: {
  escopo: Colaborador[];
  idsEscopo: Set<string>;
  podeEditar: boolean;
  drill: Drill;
}) {
  const d = useDominio();
  const toast = useToast();
  const { items: advertencias, criar, atualizar, remover } = useColecao("advertencias");
  const [novo, setNovo] = useState(false);
  const [editar, setEditar] = useState<(typeof advertencias)[number] | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);

  const lista = useMemo(
    () =>
      advertencias
        .filter((a) => idsEscopo.has(a.colaboradorId))
        .sort((a, b) => String(b.data).localeCompare(String(a.data))),
    [advertencias, idsEscopo],
  );

  const porTipo = useMemo(() => {
    const c = { Verbal: 0, Escrita: 0, Suspensão: 0 } as Record<string, number>;
    lista.forEach((a) => {
      c[a.tipo] = (c[a.tipo] ?? 0) + 1;
    });
    return c;
  }, [lista]);

  // Ranking: colaboradores com mais advertências no escopo.
  const ranking = useMemo(() => {
    const mapa = new Map<string, number>();
    lista.forEach((a) => mapa.set(a.colaboradorId, (mapa.get(a.colaboradorId) ?? 0) + 1));
    return [...mapa.entries()]
      .map(([id, total]) => ({ id, nome: d.nomeColab(id), total }))
      .sort((a, b) => b.total - a.total);
  }, [lista, d]);

  const rankingChart = useMemo(
    () => ranking.slice(0, 8).map((r) => ({ nome: primeiroNome(r.nome), valor: r.total })),
    [ranking],
  );

  const abrirDrill = (id: string) => {
    const c = d.colabById.get(id);
    if (c) drill.abrir(`Advertências de ${c.nome}`, [c], "Registros disciplinares no escopo atual");
  };

  return (
    <div>
      {podeEditar && (
        <div className="mb-6 flex items-center justify-end">
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Registrar advertência
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total de advertências" value={lista.length} icon={<ShieldAlert className="h-5 w-5" />} accent="brand" hint="No seu escopo" />
        <StatCard label="Verbais" value={porTipo.Verbal} icon={<MessageSquareWarning className="h-5 w-5" />} accent="blue" hint="Orientação registrada" />
        <StatCard label="Escritas" value={porTipo.Escrita} icon={<FileWarning className="h-5 w-5" />} accent="amber" hint="Advertência formal" />
        <StatCard label="Suspensões" value={porTipo.Suspensão} icon={<AlertTriangle className="h-5 w-5" />} accent="red" hint="Medida disciplinar" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Advertências por colaborador"
          subtitle="Reincidência disciplinar no escopo"
          icon={<Trophy className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {rankingChart.length === 0 ? (
            <EmptyState title="Sem advertências registradas" description="Nenhum registro disciplinar no seu escopo." icon={<ShieldAlert className="h-8 w-8" />} />
          ) : (
            <BarrasVerticais
              data={rankingChart}
              cor="#dc2626"
              onItemClick={(nome) => {
                const alvo = ranking.find((r) => primeiroNome(r.nome) === nome);
                if (alvo) abrirDrill(alvo.id);
              }}
            />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Registros de advertência"
          subtitle={`${lista.length} registro(s) no seu escopo de acesso`}
          icon={<ShieldAlert className="h-[18px] w-[18px]" />}
        />
        {lista.length === 0 ? (
          <CardBody>
            <EmptyState title="Sem advertências" description="Nenhuma advertência registrada no seu escopo." icon={<ShieldAlert className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th">Tipo</th>
                  <th className="th hidden sm:table-cell">Data</th>
                  <th className="th">Motivo</th>
                  <th className="th hidden md:table-cell">Anexo</th>
                  {podeEditar && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <button
                        type="button"
                        onClick={() => abrirDrill(a.colaboradorId)}
                        className="flex items-center gap-3 text-left"
                      >
                        <Avatar nome={d.nomeColab(a.colaboradorId)} foto={d.fotoColab(a.colaboradorId)} size="sm" />
                        <span className="font-medium text-slate-800 hover:text-brand">{d.nomeColab(a.colaboradorId)}</span>
                      </button>
                    </td>
                    <td className="td">
                      <Badge variant={COR_TIPO_ADV[a.tipo] ?? "neutral"}>{a.tipo}</Badge>
                    </td>
                    <td className="td hidden sm:table-cell text-slate-500">{diaData(a.data)}</td>
                    <td className="td">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{a.motivo}</p>
                        {a.descricao && <p className="truncate text-xs text-slate-400">{a.descricao}</p>}
                      </div>
                    </td>
                    <td className="td hidden md:table-cell">
                      {a.arquivoDataUrl ? (
                        <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => abrirArquivo(a.arquivoDataUrl, toast)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    {podeEditar && (
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost p-1.5 text-slate-400 hover:text-brand"
                            onClick={() => setEditar(a)}
                            aria-label="Editar advertência"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
                            onClick={() => setExcluir(a.id)}
                            aria-label="Excluir advertência"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(novo || editar) && (
        <NovaAdvertenciaModal
          aberto={novo || !!editar}
          inicial={editar}
          onFechar={() => {
            setNovo(false);
            setEditar(null);
          }}
          escopo={escopo}
          onSalvar={(payload) => {
            if (editar) {
              atualizar(editar.id, payload);
              toast("Advertência atualizada.");
            } else {
              criar(payload);
              toast("Advertência registrada.");
            }
          }}
        />
      )}

      <ConfirmDialog
        aberto={excluir != null}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => {
          if (excluir) {
            remover(excluir);
            toast("Advertência removida.");
          }
          setExcluir(null);
        }}
        titulo="Excluir advertência"
        mensagem="Tem certeza que deseja excluir este registro disciplinar? Esta ação não pode ser desfeita."
      />
    </div>
  );
}

function abrirArquivo(dataUrl: string | null | undefined, toast: (msg: string, tipo?: "sucesso" | "erro" | "info") => void) {
  if (!dataUrl) {
    toast("Este registro não possui arquivo anexado.", "info");
    return;
  }
  const w = window.open();
  if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
}

function NovaAdvertenciaModal({
  aberto,
  inicial,
  onFechar,
  escopo,
  onSalvar,
}: {
  aberto: boolean;
  inicial?: Record<string, any> | null;
  onFechar: () => void;
  escopo: Colaborador[];
  onSalvar: (payload: Record<string, unknown>) => void;
}) {
  const ehEdicao = !!inicial;
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [colaboradorId, setColaboradorId] = useState(inicial?.colaboradorId ?? "");
  const [tipo, setTipo] = useState<string>(inicial?.tipo ?? TIPOS_ADVERTENCIA[0]);
  const [data, setData] = useState(inicial?.data ? String(inicial.data).slice(0, 10) : iso(HOJE));
  const [motivo, setMotivo] = useState(inicial?.motivo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string } | null>(
    inicial?.arquivoDataUrl ? { nome: inicial.arquivoNome ?? "Anexo atual", dataUrl: inicial.arquivoDataUrl } : null,
  );
  const [lendo, setLendo] = useState(false);

  const onFile = (f: File) => {
    if (f.size > 2 * 1024 * 1024) {
      toast("Arquivo acima de 2 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    setLendo(true);
    const reader = new FileReader();
    reader.onload = () => { setArquivo({ nome: f.name, dataUrl: String(reader.result) }); setLendo(false); };
    reader.onerror = () => { setLendo(false); toast("Não foi possível ler o arquivo. Tente novamente.", "erro"); };
    reader.readAsDataURL(f);
  };

  const salvar = () => {
    if (!colaboradorId) return toast("Selecione o colaborador.", "erro");
    if (!data) return toast("Informe a data da advertência.", "erro");
    if (!motivo.trim()) return toast("Informe o motivo da advertência.", "erro");
    if (lendo) return toast("Aguarde o anexo terminar de carregar.", "info");
    onSalvar({
      ...(inicial ?? {}),
      colaboradorId,
      tipo,
      data,
      motivo: motivo.trim(),
      descricao: descricao.trim() || undefined,
      arquivoNome: arquivo?.nome ?? null,
      arquivoDataUrl: arquivo?.dataUrl ?? null,
      registradoPor: inicial?.registradoPor ?? "RH",
      criadoEm: inicial?.criadoEm ?? new Date().toISOString(),
    });
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={ehEdicao ? "Editar advertência" : "Registrar advertência"}
      descricao="Registro disciplinar conforme política interna de conduta."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={lendo}>
            {ehEdicao ? <><Pencil className="h-4 w-4" /> Salvar</> : <><Plus className="h-4 w-4" /> Registrar</>}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Colaborador" obrigatorio className="sm:col-span-2">
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            <option value="">Selecione…</option>
            {escopo.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Tipo" obrigatorio>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_ADVERTENCIA.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Data" obrigatorio>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo label="Motivo" obrigatorio className="sm:col-span-2">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Atrasos recorrentes" />
        </Campo>
        <Campo label="Descrição" className="sm:col-span-2">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhe a ocorrência e as orientações dadas ao colaborador." />
        </Campo>
        <div className="sm:col-span-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button className="btn-outline w-full" onClick={() => fileRef.current?.click()} disabled={lendo}>
            <Upload className="h-4 w-4" /> {lendo ? "Lendo arquivo…" : arquivo ? arquivo.nome : "Anexar documento (≤ 2 MB)"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================================
// ABA — ABSENTEÍSMO
// =====================================================================================
const PERIODOS_RAPIDOS = [
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
  { label: "180 dias", dias: 180 },
  { label: "Ano", dias: 365 },
];

function AbaAbsenteismo({
  escopo,
  idsEscopo,
  drill,
  podeEditar,
}: {
  escopo: Colaborador[];
  idsEscopo: Set<string>;
  drill: Drill;
  podeEditar: boolean;
}) {
  const d = useDominio();
  const toast = useToast();
  const { items: ausencias, criar, atualizar, remover } = useColecao("ausencias");
  const [lancar, setLancar] = useState(false);
  const [editar, setEditar] = useState<(typeof ausencias)[number] | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);

  const [de, setDe] = useState(() => iso(new Date(HOJE.getTime() - 90 * 86400000)));
  const [ate, setAte] = useState(() => iso(HOJE));

  const aplicarRapido = (dias: number) => {
    setDe(iso(new Date(HOJE.getTime() - dias * 86400000)));
    setAte(iso(HOJE));
  };

  // Filtra ausências do escopo dentro do período (comparação lexicográfica de "YYYY-MM-DD").
  const lista = useMemo(() => {
    const min = de || "0000-00-00";
    const max = ate || "9999-99-99";
    return ausencias
      .filter((a) => idsEscopo.has(a.colaboradorId))
      .filter((a) => {
        const dia = String(a.data).slice(0, 10);
        return dia >= min && dia <= max;
      })
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [ausencias, idsEscopo, de, ate]);

  const total = lista.length;
  const faltasNaoJust = useMemo(
    () => lista.filter((a) => a.tipo === "Falta" && !a.justificada).length,
    [lista],
  );
  const atrasos = useMemo(() => lista.filter((a) => a.tipo === "Atraso").length, [lista]);
  const pctJustificadas = total === 0 ? 0 : lista.filter((a) => a.justificada).length / total;

  // Ranking de quem mais falta no período: nº de ausências, faltas e horas de atraso.
  const ranking = useMemo(() => {
    const mapa = new Map<string, { ausencias: number; faltas: number; horas: number }>();
    lista.forEach((a) => {
      const atual = mapa.get(a.colaboradorId) ?? { ausencias: 0, faltas: 0, horas: 0 };
      atual.ausencias += 1;
      if (a.tipo === "Falta") atual.faltas += 1;
      if (a.tipo === "Atraso" || a.tipo === "Saída antecipada") atual.horas += a.horas ?? 0;
      mapa.set(a.colaboradorId, atual);
    });
    return [...mapa.entries()]
      .map(([id, m]) => ({ id, nome: d.nomeColab(id), ...m }))
      .sort((a, b) => b.ausencias - a.ausencias || b.faltas - a.faltas);
  }, [lista, d]);

  const rankingChart = useMemo(
    () => ranking.slice(0, 8).map((r) => ({ nome: primeiroNome(r.nome), valor: r.ausencias })),
    [ranking],
  );

  const porTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    lista.forEach((a) => mapa.set(a.tipo, (mapa.get(a.tipo) ?? 0) + 1));
    return TIPOS_AUSENCIA
      .filter((t) => (mapa.get(t) ?? 0) > 0)
      .map((t) => ({ nome: t, valor: mapa.get(t) ?? 0, cor: COR_TIPO_AUS[t] ?? "#64748b" }));
  }, [lista]);

  const abrirDrill = (id: string) => {
    const c = d.colabById.get(id);
    if (c) drill.abrir(`Ausências de ${c.nome}`, [c], `Período de ${diaData(de)} a ${diaData(ate)}`);
  };

  return (
    <div>
      {podeEditar && (
        <div className="mb-4 flex justify-end">
          <button className="btn-primary" onClick={() => setLancar(true)}>
            <Plus className="h-4 w-4" /> Lançar falta / ausência
          </button>
        </div>
      )}
      {/* Filtro de período */}
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo label="De" className="sm:w-44">
              <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
            </Campo>
            <Campo label="Até" className="sm:w-44">
              <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS_RAPIDOS.map((p) => (
              <button key={p.dias} className="btn-outline h-9 px-3 py-0 text-xs" onClick={() => aplicarRapido(p.dias)}>
                {p.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ausências no período" value={total} icon={<CalendarRange className="h-5 w-5" />} accent="brand" hint={`${diaData(de)} – ${diaData(ate)}`} />
        <StatCard label="Faltas não justificadas" value={faltasNaoJust} icon={<CalendarX2 className="h-5 w-5" />} accent="red" hint="Sem justificativa" />
        <StatCard label="Atrasos" value={atrasos} icon={<Clock className="h-5 w-5" />} accent="amber" hint="Registros de atraso" />
        <StatCard label="% justificadas" value={formatPercent(pctJustificadas)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" hint="Com justificativa" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Quem mais falta"
          subtitle="Ranking de ausências no período"
          icon={<Trophy className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {ranking.length === 0 ? (
            <EmptyState title="Sem ausências no período" description="Ajuste o intervalo de datas para ver os registros." icon={<CalendarRange className="h-8 w-8" />} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Nº de ausências por colaborador</p>
                <BarrasVerticais
                  data={rankingChart}
                  cor="#16334f"
                  onItemClick={(nome) => {
                    const alvo = ranking.find((r) => primeiroNome(r.nome) === nome);
                    if (alvo) abrirDrill(alvo.id);
                  }}
                />
              </div>
              <ol className="space-y-1">
                {ranking.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => abrirDrill(r.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                          (i === 0
                            ? "bg-gold/15 text-gold"
                            : i === 1
                              ? "bg-slate-200 text-slate-600"
                              : i === 2
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500")
                        }
                      >
                        {i + 1}º
                      </span>
                      <Avatar nome={r.nome} foto={d.fotoColab(r.id)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{r.nome}</p>
                        <p className="text-xs text-slate-500">
                          {r.faltas} falta(s) · {formatNumber(r.horas)}h de atraso
                        </p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-slate-800">{r.ausencias}</span>
                        <span className="text-[11px] text-slate-400">ausência(s)</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Ausências por tipo"
          subtitle="Distribuição dos motivos de ausência no período"
          icon={<BarChart3 className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {porTipo.length === 0 ? (
            <EmptyState title="Sem dados no período" description="Nenhuma ausência registrada no intervalo selecionado." icon={<BarChart3 className="h-8 w-8" />} />
          ) : (
            <BarrasColoridas data={porTipo} />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Registros de ausência"
          subtitle={`${lista.length} registro(s) entre ${diaData(de)} e ${diaData(ate)}`}
          icon={<CalendarRange className="h-[18px] w-[18px]" />}
        />
        {lista.length === 0 ? (
          <CardBody>
            <EmptyState title="Sem ausências no período" description="Nenhum registro no intervalo e escopo selecionados." icon={<CalendarRange className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th hidden sm:table-cell">Data</th>
                  <th className="th">Tipo</th>
                  <th className="th">Justificada</th>
                  <th className="th hidden md:table-cell">Horas</th>
                  {podeEditar && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar nome={d.nomeColab(a.colaboradorId)} foto={d.fotoColab(a.colaboradorId)} size="sm" />
                        <span className="font-medium text-slate-800">{d.nomeColab(a.colaboradorId)}</span>
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell text-slate-500">{diaData(a.data)}</td>
                    <td className="td">
                      <Badge variant={a.tipo === "Falta" ? "danger" : a.tipo === "Atraso" || a.tipo === "Saída antecipada" ? "warning" : a.tipo === "Atestado" ? "info" : "success"}>
                        {a.tipo}
                      </Badge>
                    </td>
                    <td className="td">
                      <Badge variant={a.justificada ? "success" : "danger"}>{a.justificada ? "Sim" : "Não"}</Badge>
                    </td>
                    <td className="td hidden md:table-cell text-slate-500">
                      {a.horas ? `${formatNumber(a.horas)}h` : "—"}
                    </td>
                    {podeEditar && (
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" onClick={() => setEditar(a)} title="Editar lançamento">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => setExcluir(a.id)} title="Excluir lançamento">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(lancar || editar) && (
        <ModalLancarAusencia
          escopo={escopo}
          inicial={editar}
          onFechar={() => {
            setLancar(false);
            setEditar(null);
          }}
          onSalvar={(dados) => {
            if (editar) {
              atualizar(editar.id, dados);
              toast("Ausência atualizada.");
            } else {
              criar(dados);
              toast("Ausência lançada.");
            }
            setLancar(false);
            setEditar(null);
          }}
        />
      )}
      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => {
          if (excluir) {
            remover(excluir);
            toast("Lançamento excluído.");
            setExcluir(null);
          }
        }}
        titulo="Excluir lançamento?"
        mensagem="Este registro de ausência será removido permanentemente."
      />
    </div>
  );
}

function ModalLancarAusencia({
  escopo,
  inicial,
  onFechar,
  onSalvar,
}: {
  escopo: Colaborador[];
  inicial?: Record<string, any> | null;
  onFechar: () => void;
  onSalvar: (dados: { colaboradorId: string; data: string; tipo: string; horas?: number; justificada: boolean; observacao?: string }) => void;
}) {
  const ehEdicao = !!inicial;
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState(inicial?.colaboradorId ?? escopo[0]?.id ?? "");
  const [data, setData] = useState(inicial?.data ? String(inicial.data).slice(0, 10) : iso(HOJE));
  const [tipo, setTipo] = useState<string>(inicial?.tipo ?? "Falta");
  const [justificada, setJustificada] = useState<boolean>(inicial?.justificada ?? false);
  const [horas, setHoras] = useState(inicial?.horas != null ? String(inicial.horas) : "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const comHoras = tipo === "Atraso" || tipo === "Saída antecipada";

  const salvar = () => {
    if (!colaboradorId) return toast("Selecione o colaborador.", "erro");
    if (!data) return toast("Informe a data.", "erro");
    onSalvar({
      ...(inicial ?? {}),
      colaboradorId,
      data,
      tipo,
      justificada,
      horas: comHoras && horas ? Number(horas) : undefined,
      observacao: observacao.trim() || undefined,
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={ehEdicao ? "Editar falta / ausência" : "Lançar falta / ausência"}
      descricao="Registro manual de frequência da equipe."
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>{ehEdicao ? "Salvar" : "Lançar"}</button></>}
    >
      <div className="space-y-3">
        <Campo label="Colaborador" obrigatorio>
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            {escopo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data" obrigatorio><Input type="date" value={data} max={iso(HOJE)} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_AUSENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Campo>
        </div>
        {comHoras && (
          <Campo label="Horas" hint="Horas de atraso / saída antecipada">
            <Input type="number" min={0} step={0.5} value={horas} onChange={(e) => setHoras(e.target.value)} />
          </Campo>
        )}
        <div className="pt-1">
          <Toggle checked={justificada} onChange={setJustificada} label="Ausência justificada" />
        </div>
        <Campo label="Observação"><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" /></Campo>
      </div>
    </Modal>
  );
}
