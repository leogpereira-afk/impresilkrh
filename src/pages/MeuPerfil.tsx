import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth";
import { PageHeader, Card, CardHeader, CardBody, Avatar, Badge, Field, EmptyState } from "@/components/ui";
import { formatBRL } from "@/lib/format";
import { User, Briefcase } from "lucide-react";

export function MeuPerfil() {
  const { db } = useStore();
  const { sessao } = useAuth();
  const c = db.colaboradores.find((x) => x.id === sessao!.colaboradorId);
  if (!c) return <EmptyState title="Ficha não encontrada" />;
  const cargo = db.cargos.find((x) => x.id === c.cargoId);
  const area = db.areas.find((x) => x.id === c.areaId);
  const gestor = db.colaboradores.find((x) => x.id === c.gestorId);

  return (
    <>
      <PageHeader title="Meu perfil" description="Seus dados no sistema" />
      <Card className="mb-6"><CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        <Avatar nome={c.nome} size="lg" />
        <div className="flex-1"><h2 className="text-lg font-semibold text-brand-ink">{c.nome}</h2>
          <p className="text-sm text-slate-500">{cargo?.nome} · {area?.nome}</p>
          <div className="mt-2 flex flex-wrap gap-2">{c.nivel && <Badge variant="info">{c.nivel}</Badge>}<Badge variant="success">{c.status}</Badge></div></div>
      </CardBody></Card>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Dados pessoais" icon={<User className="h-4 w-4" />} />
          <CardBody><dl className="grid grid-cols-2 gap-4"><Field label="Nome" value={c.nome} /><Field label="E-mail" value={c.email} /></dl></CardBody></Card>
        <Card><CardHeader title="Dados profissionais" icon={<Briefcase className="h-4 w-4" />} />
          <CardBody><dl className="grid grid-cols-2 gap-4"><Field label="Cargo" value={cargo?.nome} /><Field label="Nível" value={c.nivel} /><Field label="Salário" value={formatBRL(c.salario)} /><Field label="Gestor" value={gestor?.nome} /></dl></CardBody></Card>
      </div>
    </>
  );
}
