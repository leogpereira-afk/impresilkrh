import { exigirPerfil } from "@/lib/auth";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plane, MapPin, Receipt, CalendarClock } from "lucide-react";

export default async function ViagensPage() {
  await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);

  const recursos = [
    { icon: MapPin, titulo: "Roteiros de campo", desc: "Controle de deslocamentos das equipes de montagem e instalação." },
    { icon: Receipt, titulo: "Diárias e despesas", desc: "Cálculo automático de diárias, adiantamentos e prestação de contas." },
    { icon: CalendarClock, titulo: "Agenda de viagens", desc: "Planejamento e aprovação de viagens com antecedência." },
  ];

  return (
    <>
      <PageHeader title="Viagens e Diárias" description="Módulo de controle de deslocamentos e diárias da equipe de campo" />

      <Card>
        <CardBody className="flex flex-col items-center py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Plane className="h-8 w-8" />
          </div>
          <Badge variant="gold">Em breve</Badge>
          <h2 className="mt-3 text-lg font-semibold text-brand-ink">Módulo em desenvolvimento</h2>
          <p className="mt-1 max-w-md text-sm text-slate-500">
            A arquitetura do sistema já está preparada para o controle de viagens e diárias da
            equipe de campo. Este módulo será habilitado em uma próxima etapa.
          </p>

          <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
            {recursos.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.titulo} className="rounded-xl border border-slate-200 p-4 text-left">
                  <Icon className="mb-2 h-5 w-5 text-gold-600" />
                  <p className="text-sm font-semibold text-slate-800">{r.titulo}</p>
                  <p className="mt-1 text-xs text-slate-500">{r.desc}</p>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>
    </>
  );
}
