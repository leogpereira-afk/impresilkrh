import { useParams, Link, Navigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { useAuth, escopo, podeVerSensivel } from "@/lib/auth";
import { PageHeader, Card, CardHeader, CardBody, Avatar, Badge, Field, EmptyState } from "@/components/ui";
import { formatBRL, enquadrar, COR_ENQUADRAMENTO } from "@/lib/format";
import { ArrowLeft, User, Briefcase, Users } from "lucide-react";

export function ColaboradorDetalhe() {
  const { id } = useParams();
  const { db } = useStore();
  const { sessao } = useAuth();

  const c = db.colaboradores.find((x) => x.id === id);
  const visiveis = new Set(escopo(sessao!, db.colaboradores).map((x) => x.id));
  if (!c) return <EmptyState title="Colaborador não encontrado" />;
  if (!visiveis.has(c.id)) return <Navigate to="/colaboradores" replace />;

  const cargo = db.cargos.find((x) => x.id === c.cargoId);
  const area = db.areas.find((x) => x.id === c.areaId);
  const gestor = db.colaboradores.find((x) => x.id === c.gestorId);
  const liderados = db.colaboradores.filter((x) => x.gestorId === c.id);
  const sensivel = podeVerSensivel(sessao!, c.id);
  const enq = enquadrar(c.salario, cargo?.faixas ?? {});

  return (
    <>
      <Link to="/colaboradores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> Voltar</Link>
      <div className="mb-6 flex flex-col items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-soft sm:flex-row sm:items-center">
        <Avatar nome={c.nome} size="lg" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-brand-ink">{c.nome}</h1>
          <p className="text-sm text-slate-500">{cargo?.nome ?? "—"} · {area?.nome ?? "—"}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {c.nivel && <Badge variant="info">{c.nivel}</Badge>}
            <Badge variant="neutral">{c.status}</Badge>
            {enq !== "—" && <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium" style={{ backgroundColor: COR_ENQUADRAMENTO[enq] + "22", color: COR_ENQUADRAMENTO[enq] }}>{enq}</span>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Dados" icon={<User className="h-4 w-4" />} />
          <CardBody>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome" value={c.nome} />
              <Field label="E-mail" value={c.email} />
              <Field label="Cargo" value={cargo?.nome} />
              <Field label="Área" value={area?.nome} />
              <Field label="Nível" value={c.nivel} />
              <Field label="Salário" value={sensivel ? formatBRL(c.salario) : "•••••"} />
            </dl>
            {!sensivel && <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Salário oculto conforme política (LGPD). Apenas o RH e o próprio colaborador veem.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Hierarquia" icon={<Users className="h-4 w-4" />} />
          <CardBody className="space-y-3">
            <div><p className="text-xs uppercase tracking-wide text-slate-400">Reporta-se a</p>
              {gestor ? <Link to={`/colaboradores/${gestor.id}`} className="mt-1 flex items-center gap-2 text-sm text-brand hover:underline"><Avatar nome={gestor.nome} size="sm" />{gestor.nome}</Link> : <p className="mt-1 text-sm text-slate-500">Sem gestor</p>}</div>
            {liderados.length > 0 && <div><p className="mb-1 text-xs uppercase tracking-wide text-slate-400">Lidera {liderados.length}</p>
              <div className="space-y-1">{liderados.map((l) => <Link key={l.id} to={`/colaboradores/${l.id}`} className="flex items-center gap-2 rounded-lg px-2 py-1 text-sm text-slate-700 hover:bg-slate-50"><Avatar nome={l.nome} size="sm" /><span className="truncate">{l.nome}</span></Link>)}</div></div>}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
