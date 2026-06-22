import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { PERFIS } from "@/lib/constants";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { OrgTree, type NoOrg } from "@/components/organograma/org-tree";
import { Network } from "lucide-react";

export default async function OrganogramaPage() {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);

  const colaboradores = await db.colaborador.findMany({
    where: { ...escopo, dataDesligamento: null },
    select: {
      id: true,
      nome: true,
      gestorId: true,
      cargo: { select: { nome: true } },
      area: { select: { nome: true } },
    },
    orderBy: { nome: "asc" },
  });

  const idsNoEscopo = new Set(colaboradores.map((c) => c.id));
  const nos: NoOrg[] = colaboradores.map((c) => ({
    id: c.id,
    nome: c.nome,
    cargo: c.cargo?.nome ?? null,
    area: c.area?.nome ?? null,
    gestorId: c.gestorId && idsNoEscopo.has(c.gestorId) ? c.gestorId : null,
  }));

  // Raízes: quem não tem gestor dentro do escopo
  const raizes = nos.filter((n) => !n.gestorId);

  return (
    <>
      <PageHeader
        title="Organograma"
        description="Estrutura hierárquica e de reporte da organização"
      />
      <Card>
        <CardBody className="overflow-x-auto">
          {nos.length === 0 ? (
            <EmptyState title="Sem estrutura para exibir" icon={<Network className="h-8 w-8" />} />
          ) : (
            <div className="min-w-fit space-y-6">
              {raizes.map((raiz) => (
                <OrgTree key={raiz.id} no={raiz} todos={nos} />
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
