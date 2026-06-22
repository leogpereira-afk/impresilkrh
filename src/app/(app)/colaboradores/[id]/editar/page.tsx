import { exigirPerfil } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { FormEditarColaborador } from "@/components/colaboradores/form-editar";
import { atualizarColaborador } from "../../actions";
import Link from "next/link";
import { ArrowLeft, Pencil } from "lucide-react";

function paraInput(d: Date | null): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

export default async function EditarColaboradorPage({
  params,
}: {
  params: { id: string };
}) {
  await exigirPerfil(PERFIS.ADMIN_RH);

  const [c, areas, cargos, niveis, statuses, gestores] = await Promise.all([
    db.colaborador.findUnique({ where: { id: params.id } }),
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

  if (!c) notFound();

  return (
    <>
      <Link href={`/colaboradores/${c.id}`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Voltar para a ficha
      </Link>
      <PageHeader title={`Editar — ${c.nome}`} description="Atualização cadastral da ficha do colaborador" />

      <Card className="max-w-3xl">
        <CardHeader title="Ficha do colaborador" icon={<Pencil className="h-4 w-4" />} />
        <CardBody>
          <FormEditarColaborador
            action={atualizarColaborador}
            valores={{
              id: c.id,
              nome: c.nome,
              email: c.email,
              telefone: c.telefone,
              cpf: c.cpf,
              dataNascimento: paraInput(c.dataNascimento),
              dataAdmissao: paraInput(c.dataAdmissao),
              dataDesligamento: paraInput(c.dataDesligamento),
              enderecoRua: c.enderecoRua,
              enderecoNumero: c.enderecoNumero,
              enderecoBairro: c.enderecoBairro,
              enderecoCep: c.enderecoCep,
              conjugeNome: c.conjugeNome,
              qtdFilhos: c.qtdFilhos,
              valeTransporte: c.valeTransporte,
              cargoId: c.cargoId,
              areaId: c.areaId,
              nivelId: c.nivelId,
              statusId: c.statusId,
              gestorId: c.gestorId,
              salario: c.salario,
              riscoSaida: c.riscoSaida,
              potencial: c.potencial,
            }}
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
