import { useMemo, useState } from "react";
import { Palmtree, CalendarClock, CalendarPlus, ShieldAlert, Plus, BarChart3, Pencil, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasColoridas, BarrasVerticais } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, parseData } from "@/lib/format";
import { JANELA_ALERTA_DIAS, STATUS_FERIAS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";
import type { Ferias as TFerias, Colaborador } from "@/data/types";

const MS_DIA = 86400000;
const diasAte = (d?: string | null) => { const dt = parseData(d); return dt ? Math.round((dt.getTime() - HOJE.getTime()) / MS_DIA) : NaN; };
const addDiasISO = (base: string, dias: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
};

// ISO -> "yyyy-MM-dd" para inputs type="date" (e o caminho inverso).
const isoParaInput = (iso?: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
const inputParaIso = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);

// Paleta dos status de férias (alinhada às variantes de Badge / Quadro de Comando).
const CORES_STATUS: Record<string, string> = {
  "Em andamento": "#16a34a",
  Agendada: "#2563eb",
  "Em aberto": "#d97706",
  Concluída: "#94a3b8",
};

// Variante de Badge por status de férias (Apêndice — CLT).
function varianteStatus(status: string): "neutral" | "success" | "info" | "warning" {
  if (status === "Concluída") return "neutral";
  if (status === "Em andamento") return "success";
  if (status === "Agendada") return "info";
  return "warning"; // Em aberto
}

// Alerta CLT: período aquisitivo vencido ou a vencer (60 dias) e ainda não gozado.
type Alerta = "vencido" | "a-vencer" | null;
function alertaCLT(f: TFerias): Alerta {
  if (f.status !== "Em aberto" && f.status !== "Agendada") return null;
  if (!f.periodoAquisitivoFim) return null;
  const d = diasAte(f.periodoAquisitivoFim);
  if (isNaN(d)) return null;
  if (d < 0) return "vencido";
  if (d <= JANELA_ALERTA_DIAS) return "a-vencer";
  return null;
}

export default function Ferias() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: ferias, criar, atualizar, remover } = useColecao("ferias");
  const drill = useDrill();

  const [novo, setNovo] = useState(false);
  const [colabId, setColabId] = useState("");
  const [dataInicio, setDataInicio] = useState("");

  // CRUD — edição/exclusão de um registro de férias (Quadro de Comando).
  const [editando, setEditando] = useState<TFerias | null>(null);
  const [edForm, setEdForm] = useState({
    dataInicio: "",
    dataRetorno: "",
    diasGozados: "0",
    saldoDias: "0",
    status: "Em aberto" as string,
  });
  const [excluindo, setExcluindo] = useState<TFerias | null>(null);

  const podeEditar = podeGerir(sessao);

  // Escopo: colaboradores visíveis, sem direção e sem inativos.
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => !c.ehDirecao && c.statusId !== "inativo"),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  const lista = useMemo(
    () => ferias.filter((f) => idsEscopo.has(f.colaboradorId)),
    [ferias, idsEscopo],
  );

  const deFeriasAgora = useMemo(
    () =>
      lista
        .filter((f) => f.status === "Em andamento")
        // registros sem data de retorno (NaN) vão para o fim, sem embaralhar a ordem.
        .sort((a, b) => {
          const da = diasAte(a.dataRetorno), db = diasAte(b.dataRetorno);
          if (isNaN(da)) return isNaN(db) ? 0 : 1;
          if (isNaN(db)) return -1;
          return da - db;
        }),
    [lista],
  );
  const agendadas = useMemo(() => lista.filter((f) => f.status === "Agendada"), [lista]);
  const emAberto = useMemo(() => lista.filter((f) => f.status === "Em aberto"), [lista]);

  const proximosRetornos = useMemo(
    () =>
      lista
        .filter((f) => f.status === "Em andamento" && f.dataRetorno && diasAte(f.dataRetorno) >= 0)
        .sort((a, b) => diasAte(a.dataRetorno) - diasAte(b.dataRetorno)),
    [lista],
  );

  const alertasCLT = useMemo(() => lista.filter((f) => alertaCLT(f) !== null), [lista]);

  const tabela = useMemo(
    () =>
      [...lista].sort((a, b) => d.nomeColab(a.colaboradorId).localeCompare(d.nomeColab(b.colaboradorId))),
    [lista, d],
  );

  // ---- Quadro de Comando: distribuição por status (gráfico clicável) ----
  const porStatus = useMemo(
    () =>
      STATUS_FERIAS.map((s) => ({
        nome: s,
        valor: lista.filter((f) => f.status === s).length,
        cor: CORES_STATUS[s] ?? "#64748b",
      })),
    [lista],
  );

  // Distribuição por área (somente registros com gozo programado/ativo/concluído).
  const porArea = useMemo(() => {
    const acc = new Map<string, number>();
    for (const f of lista) {
      const c = d.colabById.get(f.colaboradorId);
      const area = d.nomeArea(c?.areaId);
      acc.set(area, (acc.get(area) ?? 0) + 1);
    }
    return [...acc.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [lista, d]);

  // Mapeia uma lista de férias -> colaboradores (para o drill-down).
  const colabsDe = (fs: TFerias[]): Colaborador[] =>
    fs
      .map((f) => d.colabById.get(f.colaboradorId))
      .filter((c): c is Colaborador => !!c);

  const abrirDrillStatus = (status: string) => {
    const fs = lista.filter((f) => f.status === status);
    if (fs.length === 0) {
      toast(`Nenhum colaborador com férias "${status}".`, "erro");
      return;
    }
    drill.abrir(`Férias — ${status}`, colabsDe(fs), `${fs.length} colaborador(es) neste status`);
  };

  const abrirDrillArea = (area: string) => {
    const fs = lista.filter((f) => d.nomeArea(d.colabById.get(f.colaboradorId)?.areaId) === area);
    if (fs.length === 0) return;
    drill.abrir(`Férias — ${area}`, colabsDe(fs), `${fs.length} registro(s) na área`);
  };

  const resetForm = () => {
    setColabId("");
    setDataInicio("");
    setNovo(false);
  };

  const agendar = () => {
    if (!colabId || !dataInicio) {
      toast("Selecione o colaborador e a data de início.", "erro");
      return;
    }
    const inicioISO = new Date(`${dataInicio}T12:00:00`).toISOString();
    criar({
      colaboradorId: colabId,
      periodoAquisitivoInicio: null,
      periodoAquisitivoFim: null,
      dataInicio: inicioISO,
      dataRetorno: addDiasISO(inicioISO, 30),
      diasGozados: 0,
      saldoDias: 30,
      status: "Agendada",
    });
    toast(`Férias agendadas para ${d.nomeColab(colabId)}.`);
    resetForm();
  };

  // ---- Editar registro de férias ----
  const abrirEdicao = (f: TFerias) => {
    setEditando(f);
    setEdForm({
      dataInicio: isoParaInput(f.dataInicio),
      dataRetorno: isoParaInput(f.dataRetorno),
      diasGozados: String(f.diasGozados ?? 0),
      saldoDias: String(f.saldoDias ?? 0),
      status: f.status,
    });
  };

  const salvarEdicao = () => {
    if (!editando) return;
    atualizar(editando.id, {
      dataInicio: inputParaIso(edForm.dataInicio),
      dataRetorno: inputParaIso(edForm.dataRetorno),
      diasGozados: Math.max(0, Number(edForm.diasGozados) || 0),
      saldoDias: Math.max(0, Number(edForm.saldoDias) || 0),
      status: edForm.status,
    });
    toast(`Férias de ${d.nomeColab(editando.colaboradorId)} atualizadas.`);
    setEditando(null);
  };

  // ---- Excluir registro de férias ----
  const confirmarExclusao = () => {
    if (!excluindo) return;
    const nome = d.nomeColab(excluindo.colaboradorId);
    remover(excluindo.id);
    toast(`Registro de férias de ${nome} excluído.`);
    setExcluindo(null);
  };

  return (
    <div>
      <PageHeader title="Férias" description="Painel de férias, saldos e conformidade CLT da sua equipe.">
        {podeEditar && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <CalendarPlus className="h-4 w-4" /> Agendar férias
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="De férias agora" value={deFeriasAgora.length} icon={<Palmtree className="h-5 w-5" />} accent="green" hint="Em andamento" />
        <StatCard label="Agendadas" value={agendadas.length} icon={<CalendarClock className="h-5 w-5" />} accent="blue" hint="Gozo programado" />
        <StatCard label="Em aberto" value={emAberto.length} icon={<CalendarPlus className="h-5 w-5" />} accent="amber" hint="Saldo a programar" />
        <StatCard label="Alertas CLT" value={alertasCLT.length} icon={<ShieldAlert className="h-5 w-5" />} accent={alertasCLT.length ? "red" : "green"} hint="Períodos a vencer/vencidos" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quem está de férias agora" subtitle="Colaboradores ausentes no momento" icon={<Palmtree className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {deFeriasAgora.length === 0 ? (
              <EmptyState title="Ninguém de férias" description="Nenhum colaborador em gozo de férias no momento." icon={<Palmtree className="h-8 w-8" />} />
            ) : (
              deFeriasAgora.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar nome={d.nomeColab(f.colaboradorId)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="truncate text-xs text-slate-400">Desde {formatDate(f.dataInicio)}</p>
                    </div>
                  </div>
                  <Badge variant="success">Retorna {formatDate(f.dataRetorno)}</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Próximos retornos" subtitle="Ordenados pela data de retorno" icon={<CalendarClock className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {proximosRetornos.length === 0 ? (
              <EmptyState title="Sem retornos previstos" description="Nenhum retorno de férias agendado." icon={<CalendarClock className="h-8 w-8" />} />
            ) : (
              proximosRetornos.map((f) => {
                const dd = diasAte(f.dataRetorno);
                return (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="text-xs text-slate-400">{formatDate(f.dataRetorno)}</p>
                    </div>
                    <Badge variant="info">{dd === 0 ? "Hoje" : `em ${dd}d`}</Badge>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Quadro de Comando"
            subtitle="Distribuição por status"
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {lista.length === 0 ? (
              <EmptyState title="Sem dados" description="Nenhum registro de férias no seu escopo." icon={<BarChart3 className="h-8 w-8" />} />
            ) : (
              <>
                <BarrasColoridas data={porStatus} altura={240} onItemClick={abrirDrillStatus} />
                <div className="mt-3 flex flex-wrap gap-3">
                  {porStatus.map((s) => (
                    <button
                      key={s.nome}
                      type="button"
                      onClick={() => abrirDrillStatus(s.nome)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-brand"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} aria-hidden />
                      {s.nome} <span className="font-medium text-slate-700">({s.valor})</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Férias por área"
            subtitle="Volume de registros por área"
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {porArea.length === 0 ? (
              <EmptyState title="Sem dados" description="Nenhum registro de férias no seu escopo." icon={<BarChart3 className="h-8 w-8" />} />
            ) : (
              <BarrasVerticais data={porArea} altura={240} onItemClick={abrirDrillArea} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Controle de férias" subtitle={`${tabela.length} registro(s) no seu escopo`} icon={<Palmtree className="h-[18px] w-[18px]" />} />
        {tabela.length === 0 ? (
          <CardBody>
            <EmptyState title="Sem registros de férias" description="Nenhum período de férias no seu escopo de acesso." icon={<Palmtree className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th hidden md:table-cell">Período aquisitivo</th>
                  <th className="th hidden sm:table-cell">Gozo</th>
                  <th className="th">Saldo</th>
                  <th className="th">Status</th>
                  <th className="th">CLT</th>
                  {podeEditar && <th className="th text-right">Ações</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabela.map((f) => {
                  const alerta = alertaCLT(f);
                  return (
                    <tr key={f.id} className="transition hover:bg-slate-50/60">
                      <td className="td">
                        <div className="flex items-center gap-3">
                          <Avatar nome={d.nomeColab(f.colaboradorId)} size="sm" />
                          <span className="font-medium text-slate-800">{d.nomeColab(f.colaboradorId)}</span>
                        </div>
                      </td>
                      <td className="td hidden md:table-cell text-slate-500">
                        {f.periodoAquisitivoInicio || f.periodoAquisitivoFim
                          ? `${formatDate(f.periodoAquisitivoInicio)} – ${formatDate(f.periodoAquisitivoFim)}`
                          : "—"}
                      </td>
                      <td className="td hidden sm:table-cell text-slate-500">
                        {f.dataInicio ? `${formatDate(f.dataInicio)} → ${formatDate(f.dataRetorno)}` : "—"}
                      </td>
                      <td className="td text-slate-700">{f.saldoDias} dias</td>
                      <td className="td"><Badge variant={varianteStatus(f.status)}>{f.status}</Badge></td>
                      <td className="td">
                        {alerta === "vencido" ? (
                          <Badge variant="danger">Período vencido</Badge>
                        ) : alerta === "a-vencer" ? (
                          <Badge variant="warning">Período a vencer</Badge>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                      {podeEditar && (
                        <td className="td">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              className="btn-ghost p-1.5"
                              title="Editar férias"
                              aria-label={`Editar férias de ${d.nomeColab(f.colaboradorId)}`}
                              onClick={() => abrirEdicao(f)}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              className="btn-ghost p-1.5 text-red-500 hover:text-red-600"
                              title="Excluir férias"
                              aria-label={`Excluir férias de ${d.nomeColab(f.colaboradorId)}`}
                              onClick={() => setExcluindo(f)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {podeEditar && (
        <Modal
          aberto={novo}
          onFechar={resetForm}
          titulo="Agendar férias"
          descricao="Programe um período de gozo de 30 dias para um colaborador."
          rodape={
            <>
              <button className="btn-outline" onClick={resetForm}>Cancelar</button>
              <button className="btn-primary" onClick={agendar}>
                <Plus className="h-4 w-4" /> Agendar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Campo label="Colaborador" obrigatorio>
              <Select value={colabId} onChange={(e) => setColabId(e.target.value)}>
                <option value="">Selecione…</option>
                {escopo
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
              </Select>
            </Campo>
            <Campo label="Data de início" obrigatorio hint="O retorno é calculado automaticamente em 30 dias.">
              <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </Campo>
            {dataInicio && (
              <p className="text-xs text-slate-500">
                Retorno previsto: <span className="font-medium text-slate-700">{formatDate(addDiasISO(new Date(`${dataInicio}T12:00:00`).toISOString(), 30))}</span>
              </p>
            )}
          </div>
        </Modal>
      )}

      {podeEditar && (
        <Modal
          aberto={!!editando}
          onFechar={() => setEditando(null)}
          titulo="Editar férias"
          descricao={editando ? d.nomeColab(editando.colaboradorId) : undefined}
          rodape={
            <>
              <button className="btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEdicao}>
                <Save className="h-4 w-4" /> Salvar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Início do gozo">
                <Input type="date" value={edForm.dataInicio} onChange={(e) => setEdForm((s) => ({ ...s, dataInicio: e.target.value }))} />
              </Campo>
              <Campo label="Retorno">
                <Input type="date" value={edForm.dataRetorno} onChange={(e) => setEdForm((s) => ({ ...s, dataRetorno: e.target.value }))} />
              </Campo>
              <Campo label="Dias gozados">
                <Input type="number" min={0} value={edForm.diasGozados} onChange={(e) => setEdForm((s) => ({ ...s, diasGozados: e.target.value }))} />
              </Campo>
              <Campo label="Saldo de dias">
                <Input type="number" min={0} value={edForm.saldoDias} onChange={(e) => setEdForm((s) => ({ ...s, saldoDias: e.target.value }))} />
              </Campo>
            </div>
            <Campo label="Status">
              <Select value={edForm.status} onChange={(e) => setEdForm((s) => ({ ...s, status: e.target.value }))}>
                {STATUS_FERIAS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Campo>
          </div>
        </Modal>
      )}

      {podeEditar && (
        <ConfirmDialog
          aberto={!!excluindo}
          onFechar={() => setExcluindo(null)}
          onConfirmar={confirmarExclusao}
          titulo="Excluir registro de férias"
          mensagem={
            excluindo ? (
              <>
                Excluir o registro de férias de{" "}
                <span className="font-medium text-slate-700">{d.nomeColab(excluindo.colaboradorId)}</span>? Esta ação não pode ser desfeita.
              </>
            ) : (
              ""
            )
          }
        />
      )}

      <DrillModal {...drill.props} />
    </div>
  );
}
