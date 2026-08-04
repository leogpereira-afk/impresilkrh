import { useMemo, useState } from "react";
import { Palmtree, CalendarClock, CalendarPlus, ShieldAlert, Plus, BarChart3, Pencil, Trash2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { LinkFicha } from "@/components/ui/link-ficha";
import { Campo, Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasColoridas, BarrasVerticais } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, parseData, diaLocalISO } from "@/lib/format";
import { JANELA_ALERTA_DIAS, STATUS_FERIAS } from "@/lib/constants";
import { feriasEmCurso } from "@/lib/ferias";
import { situacaoFerias, DIAS_FERIAS } from "@/lib/clt";
import {
  validarAgendamento, validarPeriodo, retornoDe, diasEntre, temErro,
  MAX_ABONO_DIAS, type Achado,
} from "@/lib/feriasAgenda";
import { HOJE } from "@/data/_gen";
import type { Ferias as TFerias, Colaborador } from "@/data/types";

const MS_DIA = 86400000;
const diasAte = (d?: string | null) => { const dt = parseData(d); return dt ? Math.round((dt.getTime() - HOJE.getTime()) / MS_DIA) : NaN; };
// ISO -> "yyyy-MM-dd" para inputs type="date" (e o caminho inverso).
const isoParaInput = (iso?: string | null) => { const d = parseData(iso); return d ? diaLocalISO(d) : ""; };
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
  // Dias deixou de ser sempre 30: a CLT permite partir em até três períodos, e
  // quem agenda 15 dias não tinha como registrar isso — ficava gravado 30.
  const [dias, setDias] = useState("30");
  const [abono, setAbono] = useState("0");

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
        .filter((c) => !c.ehDirecao && noQuadro(c)),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  const lista = useMemo(
    () => ferias.filter((f) => idsEscopo.has(f.colaboradorId)),
    [ferias, idsEscopo],
  );

  // "De férias agora" vem das DATAS (helper único em lib/ferias), não do texto
  // "Em andamento": esse texto é digitado à mão e ninguém volta para avançá-lo,
  // então contava quem já voltou e deixava de fora quem está fora hoje. Sem isso
  // esta tela diria 0 enquanto a de Colaboradores diz 2, para a mesma pergunta.
  const deFeriasAgora = useMemo(
    () =>
      lista
        .filter((f) => feriasEmCurso(f))
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

  /* Filtrava por feriasEmCurso, ou seja: só quem JÁ ESTÁ de férias. Um período
     agendado para o mês que vem — justamente o que se quer ver chegando — nunca
     aparecia, e o cartão dizia "nenhum retorno agendado" com o indicador
     "Agendadas 1" logo acima. Agora entra todo retorno futuro que ainda não
     foi concluído nem cancelado. */
  const proximosRetornos = useMemo(
    () =>
      lista
        .filter((f) =>
          f.status !== "Concluída" && f.status !== "Cancelada" &&
          f.dataRetorno && diasAte(f.dataRetorno) >= 0)
        .sort((a, b) => diasAte(a.dataRetorno) - diasAte(b.dataRetorno)),
    [lista],
  );

  const alertasCLT = useMemo(() => lista.filter((f) => alertaCLT(f) !== null), [lista]);

  // Os 4 indicadores são recortes da tabela "Controle de férias", então clicar filtra a tabela.
  const [foco, setFoco] = useState<string | null>(null);
  const alternarFoco = (f: string) => setFoco((atual) => (atual === f ? null : f));

  const tabela = useMemo(() => {
    const base =
      foco === "alertas" ? lista.filter((f) => alertaCLT(f) !== null)
      // "agora" tem chave própria porque não é um status: é o cálculo por datas
      // do card. Filtrar por texto aqui mostraria uma lista diferente do número.
      : foco === "agora" ? lista.filter((f) => feriasEmCurso(f))
      : foco ? lista.filter((f) => f.status === foco)
      : lista;
    return [...base].sort((a, b) => d.nomeColab(a.colaboradorId).localeCompare(d.nomeColab(b.colaboradorId)));
  }, [lista, d, foco]);

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
    setDias("30");
    setAbono("0");
    setNovo(false);
  };

  /* O que a pessoa escolhida já tem: período aquisitivo aberto (calculado da
     admissão pelo motor de clt.ts, que já existia e esta tela não usava) e os
     períodos de férias dela, para conferir saldo e sobreposição. */
  const contexto = useMemo(() => {
    const colab = escopo.find((c) => c.id === colabId) || null;
    const dela = ferias.filter((f) => f.colaboradorId === colabId);
    const sit = colab ? situacaoFerias(colab, dela) : null;
    return { colab, dela, sit };
  }, [colabId, escopo, ferias]);

  const inicioData = dataInicio ? new Date(`${dataInicio}T12:00:00`) : null;
  const diasNum = Number(dias);
  const abonoNum = Number(abono);

  const achados: Achado[] = useMemo(() => {
    if (!colabId || !dataInicio) return [];
    return validarAgendamento({
      inicio: inicioData,
      dias: diasNum,
      abono: abonoNum,
      diasJaLancados: contexto.sit?.diasGozados ?? 0,
      fracoesExistentes: contexto.dela.filter((f) => f.status !== "Cancelada" && f.dataInicio).length,
      outros: contexto.dela,
    });
  }, [colabId, dataInicio, inicioData, diasNum, abonoNum, contexto]);

  const agendar = () => {
    if (!colabId || !dataInicio) {
      toast("Selecione o colaborador e a data de início.", "erro");
      return;
    }
    if (temErro(achados)) {
      toast(achados.find((a) => a.nivel === "erro")!.texto, "erro");
      return;
    }
    const inicio = new Date(`${dataInicio}T12:00:00`);
    const inicioISO = inicio.toISOString();
    const sit = contexto.sit;
    criar({
      colaboradorId: colabId,
      // Antes ia null nos dois, e por isso a coluna CLT e o indicador
      // "Alertas CLT" ficavam vazios em TUDO que era criado por aqui — só os
      // registros antigos, importados, tinham o período preenchido.
      periodoAquisitivoInicio: sit ? sit.aquisitivoInicio.toISOString() : null,
      periodoAquisitivoFim: sit ? sit.direitoDesde.toISOString() : null,
      dataInicio: inicioISO,
      dataRetorno: retornoDe(inicio, diasNum).toISOString(),
      diasGozados: diasNum,
      saldoDias: Math.max(0, DIAS_FERIAS - (sit?.diasGozados ?? 0) - diasNum - abonoNum),
      status: "Agendada",
      observacao: abonoNum > 0 ? `${abonoNum} dia(s) vendido(s) como abono pecuniário (art. 143).` : null,
    });
    toast(`Férias de ${diasNum} dia(s) agendadas para ${d.nomeColab(colabId)}.`);
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

  /* Conferência do que está no formulário de edição. Antes não havia nenhuma:
     dava para gravar retorno ANTES do início (e aí "de férias agora" nunca
     achava a pessoa, porque a janela era negativa), 999 dias gozados e saldo
     de 99 — números que a CLT não permite e que ninguém digitaria de propósito,
     mas que passavam calados quando o dedo escorregava. */
  const edInicio = edForm.dataInicio ? new Date(`${edForm.dataInicio}T12:00:00`) : null;
  const edRetorno = edForm.dataRetorno ? new Date(`${edForm.dataRetorno}T12:00:00`) : null;
  const edAchados: Achado[] = useMemo(() => {
    if (!editando) return [];
    const a = validarPeriodo(edInicio, edRetorno);
    const g = Number(edForm.diasGozados);
    const sa = Number(edForm.saldoDias);
    if (!Number.isFinite(g) || g < 0 || g > DIAS_FERIAS) {
      a.push({ nivel: "erro", texto: `Dias gozados vai de 0 a ${DIAS_FERIAS}.` });
    }
    if (!Number.isFinite(sa) || sa < 0 || sa > DIAS_FERIAS) {
      a.push({ nivel: "erro", texto: `Saldo vai de 0 a ${DIAS_FERIAS}.` });
    }
    if (Number.isFinite(g) && Number.isFinite(sa) && g + sa > DIAS_FERIAS) {
      a.push({ nivel: "aviso", texto: `Gozados + saldo dão ${g + sa} — um período aquisitivo tem ${DIAS_FERIAS} dias.` });
    }
    if (edInicio && edRetorno) {
      const doPeriodo = diasEntre(edInicio, edRetorno);
      if (doPeriodo > 0 && Number.isFinite(g) && g !== doPeriodo) {
        a.push({ nivel: "aviso", texto: `As datas dão ${doPeriodo} dia(s) e "dias gozados" está ${g}.` });
      }
    }
    return a;
  }, [editando, edInicio, edRetorno, edForm.diasGozados, edForm.saldoDias]);

  const salvarEdicao = () => {
    if (!editando) return;
    if (temErro(edAchados)) {
      toast(edAchados.find((a) => a.nivel === "erro")!.texto, "erro");
      return;
    }
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
        <StatCard label="De férias agora" value={deFeriasAgora.length} icon={<Palmtree className="h-5 w-5" />} accent="green" hint="Período em curso hoje" onClick={() => alternarFoco("agora")} ativo={foco === "agora"} title="Filtrar o controle de férias por quem está de férias agora" />
        <StatCard label="Agendadas" value={agendadas.length} icon={<CalendarClock className="h-5 w-5" />} accent="blue" hint="Gozo programado" onClick={() => alternarFoco("Agendada")} ativo={foco === "Agendada"} title="Filtrar o controle de férias pelas agendadas" />
        <StatCard label="Em aberto" value={emAberto.length} icon={<CalendarPlus className="h-5 w-5" />} accent="amber" hint="Saldo a programar" onClick={() => alternarFoco("Em aberto")} ativo={foco === "Em aberto"} title="Filtrar o controle de férias pelas em aberto" />
        <StatCard label="Alertas CLT" value={alertasCLT.length} icon={<ShieldAlert className="h-5 w-5" />} accent={alertasCLT.length ? "red" : "green"} hint="Períodos a vencer/vencidos" onClick={() => alternarFoco("alertas")} ativo={foco === "alertas"} title="Filtrar o controle de férias pelos períodos vencidos/a vencer" />
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
                  <LinkFicha id={f.colaboradorId} className="flex min-w-0 items-center gap-3">
                    <Avatar nome={d.nomeColab(f.colaboradorId)} foto={d.fotoColab(f.colaboradorId)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="truncate text-xs text-slate-400">Desde {formatDate(f.dataInicio)}</p>
                    </div>
                  </LinkFicha>
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
                    <LinkFicha id={f.colaboradorId} className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="text-xs text-slate-400">{formatDate(f.dataRetorno)}</p>
                    </LinkFicha>
                    <Badge variant={feriasEmCurso(f) ? "success" : "info"}>
                      {dd === 0 ? "Volta hoje" : feriasEmCurso(f) ? `volta em ${dd}d` : `sai depois · ${dd}d`}
                    </Badge>
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
            {/* Card de valor zero também é clicável: sem este aviso a tela diria
                que não há férias nenhuma com a lista cheia por trás do filtro. */}
            <EmptyState
              title={foco ? "Nenhum registro neste filtro" : "Sem registros de férias"}
              description={foco ? "Clique de novo no cartão para ver todos os períodos." : "Nenhum período de férias no seu escopo de acesso."}
              icon={<Palmtree className="h-8 w-8" />}
            />
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
                        <LinkFicha id={f.colaboradorId} className="flex items-center gap-3" titulo="Abrir a ficha para lançar/agendar as férias">
                          <Avatar nome={d.nomeColab(f.colaboradorId)} foto={d.fotoColab(f.colaboradorId)} size="sm" />
                          <span className="font-medium text-slate-800">{d.nomeColab(f.colaboradorId)}</span>
                        </LinkFicha>
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
          descricao="Programe o gozo. 30 dias corridos, ou partido em até três períodos."
          rodape={
            <>
              <button className="btn-outline" onClick={resetForm}>Cancelar</button>
              <button className="btn-primary" onClick={agendar} disabled={temErro(achados)}>
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
            {contexto.sit && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Período aquisitivo desde <b>{formatDate(contexto.sit.aquisitivoInicio.toISOString())}</b> ·
                {" "}direito nasceu em <b>{formatDate(contexto.sit.direitoDesde.toISOString())}</b> ·
                {" "}conceder até <b>{formatDate(contexto.sit.limiteConcessao.toISOString())}</b>
                <br />
                Já lançados: <b>{contexto.sit.diasGozados} dia(s)</b> · disponível:{" "}
                <b>{Math.max(0, DIAS_FERIAS - contexto.sit.diasGozados)} dia(s)</b>
              </div>
            )}
            {colabId && !contexto.sit && (
              <p className="text-xs text-amber-700">
                Sem período aquisitivo completo (menos de 12 meses de casa) ou sem data de admissão no cadastro.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data de início" obrigatorio>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </Campo>
              <Campo label="Dias de férias" obrigatorio hint="30 é o normal. Pode partir em até 3 períodos (mín. 5 dias).">
                <Input type="number" min={1} max={30} step={1} value={dias}
                  onChange={(e) => setDias(e.target.value)} />
              </Campo>
            </div>
            <Campo label="Vender como abono (opcional)" hint={`Até ${MAX_ABONO_DIAS} dias, um terço das férias (art. 143).`}>
              <Input type="number" min={0} max={MAX_ABONO_DIAS} step={1} value={abono}
                onChange={(e) => setAbono(e.target.value)} />
            </Campo>
            {dataInicio && inicioData && Number.isFinite(diasNum) && diasNum > 0 && (
              <p className="text-xs text-slate-500">
                Fica fora de <span className="font-medium text-slate-700">{formatDate(inicioData.toISOString())}</span>
                {" "}a <span className="font-medium text-slate-700">{formatDate(retornoDe(inicioData, diasNum - 1).toISOString())}</span>
                {" · "}volta em <span className="font-medium text-slate-700">{formatDate(retornoDe(inicioData, diasNum).toISOString())}</span>
              </p>
            )}
            {achados.length > 0 && (
              <ul className="space-y-1">
                {achados.map((a, i) => (
                  <li key={i} className={`rounded-lg px-3 py-2 text-xs ${a.nivel === "erro" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                    {a.nivel === "erro" ? "⛔ " : "⚠️ "}{a.texto}
                  </li>
                ))}
              </ul>
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
              <button className="btn-primary" onClick={salvarEdicao} disabled={temErro(edAchados)}>
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
            {edInicio && edRetorno && diasEntre(edInicio, edRetorno) > 0 && (
              <button
                type="button"
                className="btn-outline w-full justify-center text-xs"
                onClick={() => {
                  // Acerta os números pelas datas, que é a informação confiável:
                  // as datas vêm do calendário, os dias eram digitados à mão.
                  const dd = diasEntre(edInicio, edRetorno);
                  setEdForm((s) => ({ ...s, diasGozados: String(dd), saldoDias: String(Math.max(0, DIAS_FERIAS - dd)) }));
                }}
              >
                Acertar os dias pelas datas ({diasEntre(edInicio, edRetorno)} dia(s))
              </button>
            )}
            {edAchados.length > 0 && (
              <ul className="space-y-1">
                {edAchados.map((a, i) => (
                  <li key={i} className={`rounded-lg px-3 py-2 text-xs ${a.nivel === "erro" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                    {a.nivel === "erro" ? "⛔ " : "⚠️ "}{a.texto}
                  </li>
                ))}
              </ul>
            )}
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
