import { exigirPerfil } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { criarColaborador } from "../actions";
import { FormNovoColaborador } from "@/components/colaboradores/form-novo";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";

export default async function NovoColaboradorPage() {
  await exigirPerfil(PERFIS.ADMIN_RH);

  const [areas, cargos, niveis, statuses, gestores] = await Promise.all([
    db.area.findMany({ orderBy: { nome: "asc" } }),
    db.cargo.findMany({ include: { area: true }, orderBy: { nome: "asc" } }),
    db.nivel.findMany({ orderBy: { ordem: "asc" } }),
    db.statusColaborador.findMany({ orderBy: { ordem: "asc" } }),
    db.colaborador.findMany({
      where: { dataDesligamento: null },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <>
      <Link href="/colaboradores" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <PageHeader title="Novo colaborador" description="Cadastro de uma nova ficha no sistema" />

      <Card className="max-w-3xl">
        <CardHeader title="Dados de admissão" icon={<UserPlus className="h-4 w-4" />} />
        <CardBody>
          <FormNovoColaborador
            action={criarColaborador}
            areas={areas.map((a) => ({ id: a.id, nome: a.nome }))}
            cargos={cargos.map((c) => ({ id: c.id, nome: c.nome, area: c.area.nome }))}
            niveis={niveis.map((n) => ({ id: n.id, codigo: n.codigo, senioridade: n.senioridade }))}
            statuses={statuses.map((s) => ({ id: s.id, nome: s.nome }))}
            gestores={gestores}
          />
        </CardBody>
      </Card>
    </>
  );
}
