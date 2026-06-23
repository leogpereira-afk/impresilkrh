import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  GraduationCap, Plus, Trophy, Clock, CheckCircle2, Trash2, ListChecks, Users, BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { Avatar, EmptyState, Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasColoridas } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, formatPercent } from "@/lib/format";
import { TIPOS_TREINAMENTO, STATUS_TREINAMENTO } from "@/lib/constants";
import { HOJE } from "@/data/_gen";
import type { Colaborador, Treinamento } from "@/data/types";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const diaData = (data?: string | null) => (data ? formatDate(`${String(data).slice(0, 10)}T12:00:00`) : "—");
const primeiroNome = (nome: string) => nome.split(" ")[0];

// Paleta por tipo de treinamento (gráficos e badges coloridos)
const COR_TIPO: Record<string, string> = {
  Obrigatório: "#dc2626",
  Reciclagem: "#d97706",
  Onboarding: "#2563eb",
  Técnico: "#7c3aed",
  Segurança: "#0f766e",
};

// Variante de Badge por status do treinamento
const VAR_STATUS: Record<string, "neutral" | "warning" | "success"> = {
  Pendente: "neutral",
  "Em andamento": "warning",
  Concluído: "success",
};

const COR_PROGRESSO = (p: number) => (p >= 100 ? "#16a34a" : p >= 50 ? "#16334f" : "#d97706");

export default function Treinamento() {
  const sessao = useSessao();
  const d = useDominio();
  const drill = useDrill();
  const toast = useToast();
  const podeEditar = podeGerir(sessao);
  const { items: treinamentos, criar, atualizar, remover } = useColecao("treinamentos");

  const [novo, setNovo] = useState(false);
  const [excluir, setExcluir] = useState<string | null>(null);

  // Escopo de visibilidade: colaboradores do escopo do usuário, sem inativos.
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => c.statusId !== "inativo")
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  // Treinamentos visíveis (apenas de colaboradores do escopo).
  const lista = useMemo(
    () => treinamentos.filter((t) => idsEscopo.has(t.colaboradorId)),
    [treinamentos, idsEscopo],
  );

  // ----- Indicadores -----
  const concluidos = useMemo(() => lista.filter((t) => t.status === "Concluído"), [lista]);
  const pendentes = useMemo(() => lista.filter((t) => t.status === "Pendente"), [lista]);
  const ativos = useMemo(() => lista.filter((t) => t.status !== "Concluído"), [lista]);
  const progressoMedio = useMemo(() => {
    if (lista.length === 0) return 0;
    const soma = lista.reduce((acc, t) => acc + (t.progresso ?? 0), 0);
    return soma / lista.length / 100;
  }, [lista]);

  // Pessoas (únicas) por trás de uma lista de treinamentos — para o drill-down.
  const pessoasDe = (regs: Treinamento[]): Colaborador[] => {
    const ids = new Set(regs.map((t) => t.colaboradorId));
    return [...ids]
      .map((id) => d.colabById.get(id))
      .filter((c): c is Colaborador => !!c)
      .sort((a, b) => a.nome.localeCompare(b.nome));
  };

  // Distribuição por tipo (gráfico clicável).
  const porTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    lista.forEach((t) => mapa.set(t.tipo, (mapa.get(t.tipo) ?? 0) + 1));
    return TIPOS_TREINAMENTO
      .filter((t) => (mapa.get(t) ?? 0) > 0)
      .map((t) => ({ nome: t, valor: mapa.get(t) ?? 0, cor: COR_TIPO[t] ?? "#64748b" }));
  }, [lista]);

  // Distribuição por status (gráfico clicável).
  const porStatus = useMemo(() => {
    const mapa = new Map<string, number>();
    lista.forEach((t) => mapa.set(t.status, (mapa.get(t.status) ?? 0) + 1));
    const cores: Record<string, string> = { Pendente: "#94a3b8", "Em andamento": "#d97706", Concluído: "#16a34a" };
    return STATUS_TREINAMENTO
      .filter((s) => (mapa.get(s) ?? 0) > 0)
      .map((s) => ({ nome: s, valor: mapa.get(s) ?? 0, cor: cores[s] ?? "#64748b" }));
  }, [lista]);

  // "Quem está em treinamento": registros ativos ordenados por prazo (mais próximo primeiro).
  const emTreinamento = useMemo(
    () =>
      ativos.slice().sort((a, b) => {
        const pa = a.prazo ? String(a.prazo).slice(0, 10) : "9999-99-99";
        const pb = b.prazo ? String(b.prazo).slice(0, 10) : "9999-99-99";
        return pa.localeCompare(pb);
      }),
    [ativos],
  );

  // "O que precisa treinar": agrupa treinamentos PENDENTES por título.
  const precisaTreinar = useMemo(() => {
    const mapa = new Map<string, Treinamento[]>();
    pendentes.forEach((t) => {
      const arr = mapa.get(t.titulo) ?? [];
      arr.push(t);
      mapa.set(t.titulo, arr);
    });
    return [...mapa.entries()]
      .map(([titulo, regs]) => ({ titulo, regs, tipo: regs[0]?.tipo ?? "—", pessoas: pessoasDe(regs) }))
      .sort((a, b) => b.pessoas.length - a.pessoas.length || a.titulo.localeCompare(b.titulo));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendentes, d]);

  // ----- Drills -----
  const drillRegs = (titulo: string, regs: Treinamento[], subtitulo?: string) =>
    drill.abrir(titulo, pessoasDe(regs), subtitulo ?? `${pessoasDe(regs).length} colaborador(es) no seu escopo`);

  const excluirReg = excluir ? lista.find((t) => t.id === excluir) : null;

  return (
    <div>
      <PageHeader
        title="Treinamento e Capacitação"
        description="Quem está em treinamento e o que cada colaborador ainda precisa treinar."
      >
        {podeEditar && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo treinamento
          </button>
        )}
      </PageHeader>

      {/* Indicadores — clicáveis (drill nas pessoas) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          className="w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => drillRegs("Em treinamento", ativos, `${pessoasDe(ativos).length} pessoa(s) com treinamento em aberto`)}
        >
          <StatCard label="Em treinamento" value={ativos.length} hint="Treinamentos não concluídos" icon={<GraduationCap className="h-5 w-5" />} accent="brand" />
        </button>
        <button
          type="button"
          className="w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => drillRegs("Treinamentos concluídos", concluidos, `${pessoasDe(concluidos).length} pessoa(s) com treinamento concluído`)}
        >
          <StatCard label="Concluídos" value={concluidos.length} hint="Capacitações finalizadas" icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
        </button>
        <button
          type="button"
          className="w-full text-left rounded-2xl transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
          onClick={() => drillRegs("Treinamentos pendentes", pendentes, `${pessoasDe(pendentes).length} pessoa(s) com pendência`)}
        >
          <StatCard label="Pendentes" value={pendentes.length} hint="Ainda não iniciados" icon={<Clock className="h-5 w-5" />} accent="amber" />
        </button>
        <StatCard label="Progresso médio" value={formatPercent(progressoMedio, 0)} hint="Média de conclusão" icon={<Trophy className="h-5 w-5" />} accent="gold" />
      </div>

      {/* Gráficos por tipo e por status */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Treinamentos por tipo"
            subtitle="Distribuição da carga de capacitação"
            icon={<BookOpen className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {porTipo.length === 0 ? (
              <EmptyState title="Sem treinamentos" description="Nenhum treinamento registrado no seu escopo." icon={<BookOpen className="h-8 w-8" />} />
            ) : (
              <BarrasColoridas
                data={porTipo}
                onItemClick={(nome) => {
                  const regs = lista.filter((t) => t.tipo === nome);
                  if (regs.length) drillRegs(`Treinamento ${nome}`, regs);
                }}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Treinamentos por status"
            subtitle="Andamento geral das capacitações"
            icon={<ListChecks className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {porStatus.length === 0 ? (
              <EmptyState title="Sem treinamentos" description="Nenhum treinamento registrado no seu escopo." icon={<ListChecks className="h-8 w-8" />} />
            ) : (
              <BarrasColoridas
                data={porStatus}
                onItemClick={(nome) => {
                  const regs = lista.filter((t) => t.status === nome);
                  if (regs.length) drillRegs(`Treinamentos: ${nome}`, regs);
                }}
              />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Quem está em treinamento */}
      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Quem está em treinamento"
          subtitle={`${emTreinamento.length} treinamento(s) em andamento ou pendentes, por prazo`}
          icon={<GraduationCap className="h-[18px] w-[18px]" />}
        />
        {emTreinamento.length === 0 ? (
          <CardBody>
            <EmptyState title="Ninguém em treinamento" description="Todos os treinamentos do seu escopo estão concluídos." icon={<CheckCircle2 className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th">Treinamento</th>
                  <th className="th hidden sm:table-cell">Tipo</th>
                  <th className="th">Status</th>
                  <th className="th">Progresso</th>
                  <th className="th hidden md:table-cell">Prazo</th>
                  {podeEditar && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {emTreinamento.map((t) => (
                  <tr key={t.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <Link to={`/colaboradores/${t.colaboradorId}`} className="flex items-center gap-3 text-left">
                        <Avatar nome={d.nomeColab(t.colaboradorId)} size="sm" />
                        <span className="font-medium text-slate-800 hover:text-brand">{d.nomeColab(t.colaboradorId)}</span>
                      </Link>
                    </td>
                    <td className="td">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-700">{t.titulo}</p>
                        {t.descricao && <p className="truncate text-xs text-slate-400">{t.descricao}</p>}
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell">
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset"
                        style={{ backgroundColor: `${COR_TIPO[t.tipo] ?? "#64748b"}14`, color: COR_TIPO[t.tipo] ?? "#64748b", boxShadow: "inset 0 0 0 1px currentColor" }}
                      >
                        {t.tipo}
                      </span>
                    </td>
                    <td className="td">
                      {podeEditar ? (
                        <Select
                          value={t.status}
                          onChange={(e) => {
                            const status = e.target.value;
                            const patch: Partial<Treinamento> = { status };
                            if (status === "Concluído") patch.progresso = 100;
                            else if (status === "Pendente") patch.progresso = 0;
                            // "Em andamento" precisa ficar entre 1 e 99 (senão herda 0/100 incoerente).
                            else patch.progresso = Math.min(99, Math.max(1, t.progresso || 0));
                            atualizar(t.id, patch);
                            toast("Status atualizado.");
                          }}
                          className="h-8 w-full max-w-[150px] py-0 text-xs"
                        >
                          {STATUS_TREINAMENTO.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </Select>
                      ) : (
                        <Badge variant={VAR_STATUS[t.status] ?? "neutral"}>{t.status}</Badge>
                      )}
                    </td>
                    <td className="td">
                      {podeEditar ? (
                        <div className="flex items-center gap-2">
                          <Input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={t.progresso ?? 0}
                            onChange={(e) => {
                              const progresso = Number(e.target.value);
                              const patch: Partial<Treinamento> = { progresso };
                              if (progresso >= 100) patch.status = "Concluído";
                              else if (progresso > 0 && t.status === "Pendente") patch.status = "Em andamento";
                              atualizar(t.id, patch);
                            }}
                            className="h-1.5 w-24 cursor-pointer p-0"
                          />
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-600">{t.progresso ?? 0}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Progress value={t.progresso ?? 0} cor={COR_PROGRESSO(t.progresso ?? 0)} className="w-24" />
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-slate-600">{t.progresso ?? 0}%</span>
                        </div>
                      )}
                    </td>
                    <td className="td hidden md:table-cell text-slate-500">{diaData(t.prazo)}</td>
                    {podeEditar && (
                      <td className="td text-right">
                        <button
                          className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
                          onClick={() => setExcluir(t.id)}
                          aria-label="Excluir treinamento"
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

      {/* O que precisa treinar (pendentes agrupados por título) */}
      <Card className="mt-6">
        <CardHeader
          title="O que precisa treinar"
          subtitle="Treinamentos pendentes agrupados"
          icon={<ListChecks className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {precisaTreinar.length === 0 ? (
            <EmptyState title="Nada pendente" description="Não há treinamentos pendentes no seu escopo." icon={<CheckCircle2 className="h-8 w-8" />} />
          ) : (
            <ul className="divide-y divide-slate-100">
              {precisaTreinar.map((g) => (
                <li key={g.titulo}>
                  <button
                    type="button"
                    onClick={() => drill.abrir(`Pendente: ${g.titulo}`, g.pessoas, `${g.pessoas.length} pessoa(s) precisam deste treinamento`)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left transition hover:bg-slate-50"
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${COR_TIPO[g.tipo] ?? "#64748b"}1a`, color: COR_TIPO[g.tipo] ?? "#64748b" }}
                    >
                      <BookOpen className="h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800">{g.titulo}</p>
                      <p className="text-xs text-slate-500">{g.tipo}</p>
                    </div>
                    <span className="flex shrink-0 items-center gap-1.5 text-right">
                      <Users className="h-4 w-4 text-slate-300" />
                      <span className="text-sm font-semibold text-slate-800">{g.pessoas.length}</span>
                      <span className="hidden text-[11px] text-slate-400 sm:inline">pessoa(s)</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {novo && (
        <NovoTreinamentoModal
          escopo={escopo}
          onFechar={() => setNovo(false)}
          onCriar={(payload) => {
            criar(payload);
            toast("Treinamento criado.");
            setNovo(false);
          }}
        />
      )}

      <ConfirmDialog
        aberto={excluir != null}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => {
          if (excluir) {
            remover(excluir);
            toast("Treinamento removido.");
          }
          setExcluir(null);
        }}
        titulo="Excluir treinamento"
        mensagem={
          excluirReg
            ? `Remover "${excluirReg.titulo}" de ${d.nomeColab(excluirReg.colaboradorId)}? Esta ação não pode ser desfeita.`
            : "Tem certeza que deseja excluir este treinamento?"
        }
      />

      <DrillModal {...drill.props} />
    </div>
  );
}

// =====================================================================================
// MODAL — NOVO TREINAMENTO
// =====================================================================================
function NovoTreinamentoModal({
  escopo,
  onFechar,
  onCriar,
}: {
  escopo: Colaborador[];
  onFechar: () => void;
  onCriar: (payload: Partial<Treinamento>) => void;
}) {
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState(escopo[0]?.id ?? "");
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState<string>(TIPOS_TREINAMENTO[0]);
  const [status, setStatus] = useState<string>(STATUS_TREINAMENTO[0]);
  const [progresso, setProgresso] = useState(0);
  const [prazo, setPrazo] = useState(iso(HOJE));
  const [descricao, setDescricao] = useState("");

  const salvar = () => {
    if (!colaboradorId) return toast("Selecione o colaborador.", "erro");
    if (!titulo.trim()) return toast("Informe o título do treinamento.", "erro");
    // Mantém status e progresso coerentes.
    let st = status;
    let pr = Math.max(0, Math.min(100, progresso));
    if (st === "Concluído") pr = 100;
    else if (st === "Pendente") pr = 0;
    else if (pr >= 100) st = "Concluído";
    onCriar({
      colaboradorId,
      titulo: titulo.trim(),
      tipo,
      status: st,
      progresso: pr,
      prazo: prazo || null,
      descricao: descricao.trim() || undefined,
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo="Novo treinamento"
      descricao="Atribua um treinamento ou capacitação a um colaborador."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar}>
            <Plus className="h-4 w-4" /> Criar
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
        <Campo label="Título" obrigatorio className="sm:col-span-2">
          <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Uso de EPIs e Segurança (NR-06)" />
        </Campo>
        <Campo label="Tipo" obrigatorio>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_TREINAMENTO.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Status" obrigatorio>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUS_TREINAMENTO.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Progresso" hint={`${Math.max(0, Math.min(100, progresso))}% concluído`}>
          <Input
            type="range"
            min={0}
            max={100}
            step={5}
            value={progresso}
            onChange={(e) => setProgresso(Number(e.target.value))}
            className="cursor-pointer p-0"
          />
        </Campo>
        <Campo label="Prazo">
          <Input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
        </Campo>
        <Campo label="Descrição" className="sm:col-span-2">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhe o conteúdo e o objetivo do treinamento." />
        </Campo>
      </div>
    </Modal>
  );
}
