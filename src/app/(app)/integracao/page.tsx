import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, Progress, EmptyState } from "@/components/ui/misc";
import { FormIniciar, FormAddTarefa } from "@/components/integracao/forms";
import { iniciarChecklist, alternarTarefa, adicionarTarefa, removerTarefa } from "./actions";
import { formatDate } from "@/lib/format";
import { UserPlus, UserMinus, CheckSquare, Square, Trash2, Rocket, ClipboardList } from "lucide-react";

export default async function IntegracaoPage() {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);

  const [tarefas, colaboradores] = await Promise.all([
    db.tarefa.findMany({
      where: { colaborador: escopo },
      include: { colaborador: { select: { id: true, nome: true, cargo: { select: { nome: true } } } } },
      orderBy: [{ colaboradorId: "asc" }, { ordem: "asc" }],
    }),
    db.colaborador.findMany({
      where: { ...escopo },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  // Agrupa por colaborador + tipo
  type Grupo = {
    colaboradorId: string; nome: string; cargo: string | null; tipo: string;
    itens: { id: string; titulo: string; responsavel: string | null; concluida: boolean; concluidaEm: Date | null }[];
  };
  const mapa = new Map<string, Grupo>();
  for (const t of tarefas) {
    const chave = `${t.colaboradorId}|${t.tipo}`;
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        colaboradorId: t.colaboradorId, nome: t.colaborador.nome,
        cargo: t.colaborador.cargo?.nome ?? null, tipo: t.tipo, itens: [],
      });
    }
    mapa.get(chave)!.itens.push({
      id: t.id, titulo: t.titulo, responsavel: t.responsavel,
      concluida: t.concluida, concluidaEm: t.concluidaEm,
    });
  }
  const grupos = [...mapa.values()];
  const onboarding = grupos.filter((g) => g.tipo === "Admissão");
  const offboarding = grupos.filter((g) => g.tipo === "Desligamento");

  const pct = (g: Grupo) => Math.round((g.itens.filter((i) => i.concluida).length / g.itens.length) * 100);
  const onboardingAtivos = onboarding.filter((g) => pct(g) < 100).length;
  const concluidos = grupos.filter((g) => pct(g) === 100).length;

  function ChecklistCard({ g }: { g: Grupo }) {
    const feitas = g.itens.filter((i) => i.concluida).length;
    const p = pct(g);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-3">
          <Avatar nome={g.nome} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{g.nome}</p>
            <p className="truncate text-xs text-slate-500">{g.cargo}</p>
          </div>
          <Badge variant={p === 100 ? "success" : "info"}>{feitas}/{g.itens.length}</Badge>
        </div>
        <Progress value={p} cor={p === 100 ? "#16a34a" : "#16334f"} />
        <ul className="mt-3 space-y-1.5">
          {g.itens.map((i) => (
            <li key={i.id} className="flex items-center gap-2">
              <form action={alternarTarefa}>
                <input type="hidden" name="id" value={i.id} />
                <button type="submit" className="flex items-center text-brand hover:text-brand-dark" title={i.concluida ? "Desmarcar" : "Concluir"}>
                  {i.concluida ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4 text-slate-300" />}
                </button>
              </form>
              <span className={`flex-1 text-sm ${i.concluida ? "text-slate-400 line-through" : "text-slate-700"}`}>
                {i.titulo}
              </span>
              {i.responsavel && <Badge variant="neutral">{i.responsavel}</Badge>}
              <form action={removerTarefa}>
                <input type="hidden" name="id" value={i.id} />
                <button type="submit" className="btn-ghost p-1 text-slate-300 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
              </form>
            </li>
          ))}
        </ul>
        <FormAddTarefa action={adicionarTarefa} colaboradorId={g.colaboradorId} tipo={g.tipo} />
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Integração e Desligamento" description="Checklists de onboarding e offboarding" />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Onboarding em curso" value={onboardingAtivos} icon={<UserPlus className="h-5 w-5" />} accent="blue" />
        <StatCard label="Desligamentos" value={offboarding.length} icon={<UserMinus className="h-5 w-5" />} accent="amber" />
        <StatCard label="Checklists concluídos" value={concluidos} icon={<CheckSquare className="h-5 w-5" />} accent="green" />
        <StatCard label="Checklists ativos" value={grupos.length} icon={<ClipboardList className="h-5 w-5" />} accent="brand" />
      </div>

      <Card className="mb-6">
        <CardHeader title="Iniciar novo checklist" icon={<Rocket className="h-4 w-4" />} />
        <CardBody>
          <FormIniciar action={iniciarChecklist} colaboradores={colaboradores} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <UserPlus className="h-4 w-4 text-brand" /> Integração (admissão)
          </h2>
          <div className="space-y-4">
            {onboarding.length === 0 ? <EmptyState title="Nenhum onboarding ativo" /> :
              onboarding.map((g) => <ChecklistCard key={g.colaboradorId} g={g} />)}
          </div>
        </div>
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <UserMinus className="h-4 w-4 text-brand" /> Desligamento
          </h2>
          <div className="space-y-4">
            {offboarding.length === 0 ? <EmptyState title="Nenhum desligamento em curso" /> :
              offboarding.map((g) => <ChecklistCard key={g.colaboradorId} g={g} />)}
          </div>
        </div>
      </div>
    </>
  );
}
