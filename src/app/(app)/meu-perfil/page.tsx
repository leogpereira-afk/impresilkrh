import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { registrarAcesso } from "@/lib/lgpd";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, Field, EmptyState } from "@/components/ui/misc";
import { formatBRL, formatCPF, formatDate, tempoDeCasa } from "@/lib/format";
import { PERFIL_LABEL } from "@/lib/constants";
import { User, Briefcase, FileText, ShieldCheck, Palmtree } from "lucide-react";

export default async function MeuPerfilPage() {
  const sessao = await exigirSessao();

  if (!sessao.colaboradorId) {
    return (
      <>
        <PageHeader title="Meu perfil" />
        <Card>
          <CardBody>
            <EmptyState
              title="Perfil administrativo"
              description="Sua conta não está vinculada a uma ficha de colaborador."
            />
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Field label="E-mail" value={sessao.email} />
              <Field label="Perfil de acesso" value={PERFIL_LABEL[sessao.perfil]} />
            </dl>
          </CardBody>
        </Card>
      </>
    );
  }

  const c = await db.colaborador.findUnique({
    where: { id: sessao.colaboradorId },
    include: {
      cargo: true,
      nivel: true,
      area: true,
      status: true,
      gestor: { select: { nome: true } },
      documentos: { orderBy: { criadoEm: "desc" } },
      ferias: { orderBy: { dataInicio: "desc" }, take: 5 },
      consentimentos: { orderBy: { data: "desc" } },
    },
  });

  if (!c) {
    return (
      <>
        <PageHeader title="Meu perfil" />
        <EmptyState title="Ficha não encontrada" />
      </>
    );
  }

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "VISUALIZAR_PROPRIO_PERFIL",
    recurso: "Colaborador:Ficha",
    colaboradorId: c.id,
  });

  return (
    <>
      <PageHeader title="Meu perfil" description="Seus dados cadastrais e documentos" />

      {/* Identificação */}
      <Card className="mb-6">
        <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar nome={c.nome} size="lg" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-brand-ink">{c.nome}</h2>
            <p className="text-sm text-slate-500">{c.cargo?.nome} · {c.area?.nome}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {c.nivel && <Badge variant="info">{c.nivel.codigo} · {c.nivel.senioridade}</Badge>}
              {c.status && <Badge variant="success">{c.status.nome}</Badge>}
              {c.dataAdmissao && <Badge variant="neutral">{tempoDeCasa(c.dataAdmissao)} de casa</Badge>}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dados pessoais */}
        <Card>
          <CardHeader title="Dados pessoais" icon={<User className="h-4 w-4" />} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="CPF" value={formatCPF(c.cpf)} />
              <Field label="E-mail" value={c.email} />
              <Field label="Telefone" value={c.telefone} />
              <Field label="Nascimento" value={formatDate(c.dataNascimento)} />
              <Field
                label="Endereço"
                value={c.enderecoRua ? `${c.enderecoRua}, ${c.enderecoNumero ?? "s/n"}` : "—"}
                className="col-span-2"
              />
              <Field label="Bairro" value={c.enderecoBairro} />
              <Field label="CEP" value={c.enderecoCep} />
            </dl>
            <p className="mt-4 text-xs text-slate-400">
              Para atualizar seus dados, entre em contato com o RH.
            </p>
          </CardBody>
        </Card>

        {/* Dados profissionais */}
        <Card>
          <CardHeader title="Dados profissionais" icon={<Briefcase className="h-4 w-4" />} />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Cargo" value={c.cargo?.nome} />
              <Field label="Nível" value={c.nivel ? `${c.nivel.codigo} · ${c.nivel.senioridade}` : "—"} />
              <Field label="Área" value={c.area?.nome} />
              <Field label="Gestor" value={c.gestor?.nome} />
              <Field label="Admissão" value={formatDate(c.dataAdmissao)} />
              <Field label="Salário" value={formatBRL(c.salario)} />
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* Documentos */}
      <Card className="mt-6">
        <CardHeader title="Meus documentos" icon={<FileText className="h-4 w-4" />} />
        <CardBody className="p-0">
          {c.documentos.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhum documento" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="th">Documento</th>
                  <th className="th hidden sm:table-cell">Categoria</th>
                  <th className="th">Vencimento</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {c.documentos.map((d) => (
                  <tr key={d.id}>
                    <td className="td font-medium text-slate-800">{d.nome}</td>
                    <td className="td hidden sm:table-cell"><Badge variant="neutral">{d.categoria}</Badge></td>
                    <td className="td">
                      {d.dataVencimento ? (
                        <Badge variant={d.dataVencimento < new Date() ? "danger" : "success"}>
                          {formatDate(d.dataVencimento)}
                        </Badge>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Férias */}
        <Card>
          <CardHeader title="Minhas férias" icon={<Palmtree className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {c.ferias.length === 0 ? (
              <EmptyState title="Sem registros de férias" />
            ) : (
              c.ferias.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-sm text-slate-700">
                    {formatDate(f.dataInicio)} — {formatDate(f.dataRetorno)}
                  </span>
                  <Badge variant={f.status === "Concluída" ? "success" : "info"}>{f.status}</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* LGPD */}
        <Card>
          <CardHeader title="Privacidade e consentimentos (LGPD)" icon={<ShieldCheck className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {c.consentimentos.length === 0 ? (
              <p className="text-sm text-slate-500">
                Seus dados são tratados conforme a Lei Geral de Proteção de Dados (LGPD),
                exclusivamente para fins de gestão de recursos humanos.
              </p>
            ) : (
              c.consentimentos.map((co) => (
                <div key={co.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <span className="text-sm text-slate-700">{co.finalidade}</span>
                  <Badge variant={co.consentido ? "success" : "neutral"}>
                    {co.consentido ? "Consentido" : "Pendente"}
                  </Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
