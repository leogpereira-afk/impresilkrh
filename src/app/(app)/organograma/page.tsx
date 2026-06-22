import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { PERFIS } from "@/lib/constants";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { OrgTree, type NoOrg } from "@/components/organograma/org-tree";
import { PainelOrganograma } from "@/components/organograma/painel";
import { definirGestor } from "./actions";
import { Network, Settings2 } from "lucide-react";

export default async function OrganogramaPage() {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);
  const ehRH = sessao.perfil === PERFIS.ADMIN_RH;

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

  const arvore = (
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
  );

  const painel = (
    <Card>
      <CardBody className="p-0">
        <p className="px-5 py-3 text-xs text-slate-500">
          Defina a quem cada colaborador se reporta. A mudança é salva automaticamente e o
          organograma se atualiza. O sistema impede ciclos (um gestor não pode ficar abaixo de quem o lidera).
        </p>
        <PainelOrganograma
          action={definirGestor}
          pessoas={colaboradores.map((c) => ({
            id: c.id,
            nome: c.nome,
            cargo: c.cargo?.nome ?? null,
            gestorId: c.gestorId,
          }))}
        />
      </CardBody>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Organograma"
        description="Estrutura hierárquica e de reporte da organização"
      />
      {ehRH ? (
        <Tabs
          abas={[
            { id: "arvore", label: "Organograma", icon: <Network className="h-4 w-4" />, conteudo: arvore },
            { id: "painel", label: "Painel de controle", icon: <Settings2 className="h-4 w-4" />, conteudo: painel },
          ]}
        />
      ) : (
        arvore
      )}
    </>
  );
}
