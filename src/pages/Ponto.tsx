import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ShieldAlert, MessageSquareWarning, FileWarning, Plus, Trash2,
  Upload, ExternalLink, CalendarRange, CalendarX2, Clock, CheckCircle2, Trophy, BarChart3,
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
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, formatNumber, formatPercent } from "@/lib/format";
import { TIPOS_ADVERTENCIA } from "@/lib/constants";
import { HOJE } from "@/data/_gen";
import type { Colaborador } from "@/data/types";

// As datas de advertências/ausências são guardadas como "YYYY-MM-DD" — a comparação
// lexicográfica funciona como comparação cronológica.
const iso = (d: Date) => d.toISOString().slice(0, 10);
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
        ]}
      />

      <DrillModal {...drill.props} />
    </div>
  );
}

type Drill = ReturnType<typeof useDrill>;

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
  const { items: advertencias, criar, remover } = useColecao("advertencias");
  const [novo, setNovo] = useState(false);
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
      <div className="mb-6 flex items-center justify-end">
        {podeEditar && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Registrar advertência
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total de advertências" value={lista.length} icon={<ShieldAlert className="h-5 w-5" />} accent="brand" hint="No seu escopo" />
        <StatCard label="Verbais" value={porTipo.Verbal} icon={<MessageSquareWarning className="h-5 w-5" />} accent="blue" hint="Orientação registrada" />
        <StatCard label="Escritas" value={porTipo.Escrita} icon={<FileWarning className="h-5 w-5" />} accent="amber" hint="Advertência formal" />
        <StatCard label="Suspensões" value={porTipo.Suspensão} icon={<AlertTriangle className="h-5 w-5" />} accent="red" hint="Medida disciplinar" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Advertências por colaborador"
          subtitle="Reincidência disciplinar no escopo — clique para abrir a ficha"
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
                        <Avatar nome={d.nomeColab(a.colaboradorId)} size="sm" />
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
                        <button
                          className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
                          onClick={() => setExcluir(a.id)}
                          aria-label="Excluir advertência"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {novo && (
        <NovaAdvertenciaModal
          aberto={novo}
          onFechar={() => setNovo(false)}
          escopo={escopo}
          onCriar={(payload) => {
            criar(payload);
            toast("Advertência registrada.");
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
  onFechar,
  escopo,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  escopo: Colaborador[];
  onCriar: (payload: Record<string, unknown>) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo] = useState<string>(TIPOS_ADVERTENCIA[0]);
  const [data, setData] = useState(iso(HOJE));
  const [motivo, setMotivo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string } | null>(null);
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
    onCriar({
      colaboradorId,
      tipo,
      data,
      motivo: motivo.trim(),
      descricao: descricao.trim() || undefined,
      arquivoNome: arquivo?.nome ?? null,
      arquivoDataUrl: arquivo?.dataUrl ?? null,
      registradoPor: "RH",
      criadoEm: new Date().toISOString(),
    });
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Registrar advertência"
      descricao="Registro disciplinar conforme política interna de conduta."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={lendo}>
            <Plus className="h-4 w-4" /> Registrar
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
  const { items: ausencias, criar, remover } = useColecao("ausencias");
  const [lancar, setLancar] = useState(false);
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
          subtitle="Ranking de ausências no período — clique para abrir a ficha"
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
                      <Avatar nome={r.nome} size="sm" />
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
                        <Avatar nome={d.nomeColab(a.colaboradorId)} size="sm" />
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
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => setExcluir(a.id)} title="Excluir lançamento">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {lancar && (
        <ModalLancarAusencia
          escopo={escopo}
          onFechar={() => setLancar(false)}
          onSalvar={(dados) => {
            criar(dados);
            toast("Ausência lançada.");
            setLancar(false);
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
  onFechar,
  onSalvar,
}: {
  escopo: Colaborador[];
  onFechar: () => void;
  onSalvar: (dados: { colaboradorId: string; data: string; tipo: string; horas?: number; justificada: boolean; observacao?: string }) => void;
}) {
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState(escopo[0]?.id ?? "");
  const [data, setData] = useState(iso(HOJE));
  const [tipo, setTipo] = useState<string>("Falta");
  const [justificada, setJustificada] = useState(false);
  const [horas, setHoras] = useState("");
  const [observacao, setObservacao] = useState("");
  const comHoras = tipo === "Atraso" || tipo === "Saída antecipada";

  const salvar = () => {
    if (!colaboradorId) return toast("Selecione o colaborador.", "erro");
    if (!data) return toast("Informe a data.", "erro");
    onSalvar({
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
      titulo="Lançar falta / ausência"
      descricao="Registro manual de frequência da equipe."
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Lançar</button></>}
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
