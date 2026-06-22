import { useMemo, useState } from "react";
import {
  ClipboardList,
  CheckCircle2,
  UserPlus,
  UserMinus,
  Plus,
  PlayCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select, Toggle } from "@/components/ui/form";
import { Avatar, Progress, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { Tarefa } from "@/data/types";

type TipoChecklist = "Admissão" | "Desligamento";

const variantePorcentagem = (
  pct: number,
): "neutral" | "warning" | "info" | "success" => {
  if (pct >= 100) return "success";
  if (pct >= 50) return "info";
  if (pct > 0) return "warning";
  return "neutral";
};

export default function Integracao() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: tarefas, criar, atualizar } = useColecao("tarefas");
  const { items: modelos } = useColecao("modelosChecklist");

  const gere = podeGerir(sessao);
  const [iniciar, setIniciar] = useState(false);

  const escopo = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  const tarefasEscopo = useMemo(
    () => tarefas.filter((t) => idsEscopo.has(t.colaboradorId)),
    [tarefas, idsEscopo],
  );

  // Estatísticas de cabeçalho
  const resumo = useMemo(() => {
    const grupos = new Map<string, { tipo: string; total: number; feitas: number }>();
    for (const t of tarefasEscopo) {
      const chave = `${t.colaboradorId}::${t.tipo}`;
      const g = grupos.get(chave) ?? { tipo: t.tipo, total: 0, feitas: 0 };
      g.total += 1;
      if (t.concluida) g.feitas += 1;
      grupos.set(chave, g);
    }
    let onAndamento = 0;
    let onConcluidos = 0;
    let offTotal = 0;
    for (const g of grupos.values()) {
      if (g.tipo === "Admissão") {
        if (g.feitas >= g.total) onConcluidos += 1;
        else onAndamento += 1;
      } else if (g.tipo === "Desligamento") {
        offTotal += 1;
      }
    }
    return { onAndamento, onConcluidos, offTotal };
  }, [tarefasEscopo]);

  const alternar = (t: Tarefa, valor: boolean) => {
    atualizar(t.id, {
      concluida: valor,
      concluidaEm: valor ? HOJE.toISOString() : null,
    });
  };

  return (
    <div>
      <PageHeader
        title="Integração e Desligamento"
        description="Checklists de onboarding (admissão) e offboarding (desligamento) por colaborador."
      >
        {gere && (
          <button className="btn-primary" onClick={() => setIniciar(true)}>
            <PlayCircle className="h-4 w-4" /> Iniciar checklist
          </button>
        )}
      </PageHeader>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Onboardings em andamento"
          value={resumo.onAndamento}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="brand"
          hint="Admissões com itens pendentes"
        />
        <StatCard
          label="Onboardings concluídos"
          value={resumo.onConcluidos}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Offboardings"
          value={resumo.offTotal}
          icon={<UserMinus className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <div className="mt-6">
        <Tabs
          abas={[
            {
              id: "admissao",
              label: "Onboarding (Admissão)",
              icon: <UserPlus className="h-4 w-4" />,
              conteudo: (
                <PainelChecklist
                  tipo="Admissão"
                  tarefas={tarefasEscopo}
                  escopoIds={idsEscopo}
                  onAlternar={alternar}
                />
              ),
            },
            {
              id: "desligamento",
              label: "Offboarding (Desligamento)",
              icon: <UserMinus className="h-4 w-4" />,
              conteudo: (
                <PainelChecklist
                  tipo="Desligamento"
                  tarefas={tarefasEscopo}
                  escopoIds={idsEscopo}
                  onAlternar={alternar}
                />
              ),
            },
          ]}
        />
      </div>

      {iniciar && (
        <IniciarChecklistModal
          aberto={iniciar}
          onFechar={() => setIniciar(false)}
          escopo={escopo}
          tarefas={tarefas}
          modelos={modelos}
          criar={criar}
          onConcluido={(qtd, nome) => {
            toast(`Checklist iniciado para ${nome} (${qtd} itens).`);
            setIniciar(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- Painel de uma aba (lista de cards por colaborador) ----------
function PainelChecklist({
  tipo,
  tarefas,
  escopoIds,
  onAlternar,
}: {
  tipo: TipoChecklist;
  tarefas: Tarefa[];
  escopoIds: Set<string>;
  onAlternar: (t: Tarefa, valor: boolean) => void;
}) {
  const grupos = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      if (t.tipo !== tipo) continue;
      const arr = mapa.get(t.colaboradorId) ?? [];
      arr.push(t);
      mapa.set(t.colaboradorId, arr);
    }
    return [...mapa.entries()]
      .map(([colaboradorId, itens]) => ({
        colaboradorId,
        itens: [...itens].sort((a, b) => a.ordem - b.ordem),
      }))
      .filter((g) => escopoIds.has(g.colaboradorId));
  }, [tarefas, tipo, escopoIds]);

  if (grupos.length === 0) {
    return (
      <EmptyState
        title={
          tipo === "Admissão"
            ? "Nenhum onboarding em aberto"
            : "Nenhum offboarding em aberto"
        }
        description="Use “Iniciar checklist” para criar um novo a partir de um modelo."
        icon={<ClipboardList className="h-8 w-8" />}
      />
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {grupos.map((g) => (
        <CardChecklist
          key={`${tipo}-${g.colaboradorId}`}
          colaboradorId={g.colaboradorId}
          tipo={tipo}
          itens={g.itens}
          onAlternar={onAlternar}
        />
      ))}
    </div>
  );
}

// ---------- Card de checklist de um colaborador ----------
function CardChecklist({
  colaboradorId,
  tipo,
  itens,
  onAlternar,
}: {
  colaboradorId: string;
  tipo: TipoChecklist;
  itens: Tarefa[];
  onAlternar: (t: Tarefa, valor: boolean) => void;
}) {
  const sessao = useSessao();
  const d = useDominio();
  const { criar } = useColecao("tarefas");
  const gere = podeGerir(sessao);

  const [novoItem, setNovoItem] = useState("");

  const colab = d.colabById.get(colaboradorId);
  const total = itens.length;
  const feitas = itens.filter((t) => t.concluida).length;
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  const adicionarItem = () => {
    const titulo = novoItem.trim();
    if (!titulo) return;
    const proximaOrdem =
      itens.reduce((max, t) => Math.max(max, t.ordem), -1) + 1;
    criar({
      colaboradorId,
      tipo,
      titulo,
      responsavel: "RH",
      concluida: false,
      concluidaEm: null,
      ordem: proximaOrdem,
    });
    setNovoItem("");
  };

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-3">
            <Avatar nome={colab?.nome ?? "—"} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {colab?.nome ?? "Colaborador"}
              </p>
              <p className="truncate text-xs font-normal text-slate-500">
                {colab ? d.nomeCargo(colab) : "—"}
              </p>
            </div>
          </div>
        }
        action={
          <Badge variant={variantePorcentagem(pct)}>
            {feitas}/{total} · {pct}%
          </Badge>
        }
      />
      <CardBody className="space-y-3">
        <Progress value={pct} cor={pct >= 100 ? "#16a34a" : undefined} />

        <ul className="space-y-1.5">
          {itens.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                <p
                  className={
                    t.concluida
                      ? "text-sm text-slate-400 line-through"
                      : "text-sm font-medium text-slate-700"
                  }
                >
                  {t.titulo}
                </p>
                <p className="text-xs text-slate-400">
                  {t.responsavel ?? "RH"}
                  {t.concluida && t.concluidaEm
                    ? ` · Concluído em ${formatDate(t.concluidaEm)}`
                    : ""}
                </p>
              </div>
              <div className="mt-0.5 shrink-0">
                <Toggle
                  checked={t.concluida}
                  onChange={(v) => onAlternar(t, v)}
                />
              </div>
            </li>
          ))}
        </ul>

        {gere && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarItem();
                }
              }}
              placeholder="Adicionar item…"
              className="h-9 flex-1 py-1.5 text-sm"
            />
            <button
              type="button"
              className="btn-outline px-3"
              onClick={adicionarItem}
              disabled={!novoItem.trim()}
              aria-label="Adicionar item"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ---------- Modal: iniciar checklist a partir de um modelo ----------
function IniciarChecklistModal({
  aberto,
  onFechar,
  escopo,
  tarefas,
  modelos,
  criar,
  onConcluido,
}: {
  aberto: boolean;
  onFechar: () => void;
  escopo: ReturnType<typeof useDominio>["colaboradores"];
  tarefas: Tarefa[];
  modelos: { id: string; tipo: string; itens: { titulo: string; responsavel: string }[] }[];
  criar: (item: Partial<Tarefa> & Record<string, unknown>) => Tarefa;
  onConcluido: (qtd: number, nome: string) => void;
}) {
  const d = useDominio();
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo] = useState<TipoChecklist>("Admissão");

  const candidatos = useMemo(
    () => [...escopo].sort((a, b) => a.nome.localeCompare(b.nome)),
    [escopo],
  );

  const jaExiste = useMemo(
    () =>
      colaboradorId
        ? tarefas.some(
            (t) => t.colaboradorId === colaboradorId && t.tipo === tipo,
          )
        : false,
    [tarefas, colaboradorId, tipo],
  );

  const modelo = useMemo(
    () => modelos.find((m) => m.tipo === tipo),
    [modelos, tipo],
  );

  const criarTarefas = () => {
    if (!colaboradorId) {
      toast("Selecione um colaborador.", "erro");
      return;
    }
    if (!modelo || modelo.itens.length === 0) {
      toast("Nenhum modelo disponível para este tipo.", "erro");
      return;
    }
    modelo.itens.forEach((item, i) => {
      criar({
        colaboradorId,
        tipo,
        titulo: item.titulo,
        responsavel: item.responsavel,
        concluida: false,
        concluidaEm: null,
        ordem: i,
      });
    });
    const nome = d.nomeColab(colaboradorId);
    onConcluido(modelo.itens.length, nome);
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Iniciar checklist"
      descricao="Cria as tarefas a partir do modelo correspondente."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={criarTarefas}
            disabled={!colaboradorId || !modelo}
          >
            Criar {modelo ? `${modelo.itens.length} itens` : "checklist"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Campo label="Tipo de checklist" obrigatorio>
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoChecklist)}
          >
            <option value="Admissão">Onboarding (Admissão)</option>
            <option value="Desligamento">Offboarding (Desligamento)</option>
          </Select>
        </Campo>

        <Campo label="Colaborador" obrigatorio>
          <Select
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {d.nomeCargo(c)}
              </option>
            ))}
          </Select>
        </Campo>

        {jaExiste && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Já existe um checklist de {tipo.toLowerCase()} para este colaborador.
            Os novos itens serão adicionados aos existentes.
          </div>
        )}

        {modelo && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Itens do modelo ({modelo.itens.length})
            </p>
            <ul className="space-y-0.5">
              {modelo.itens.map((item, i) => (
                <li key={i} className="text-xs text-slate-600">
                  • {item.titulo}{" "}
                  <span className="text-slate-400">— {item.responsavel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
