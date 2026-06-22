import { exigirPerfil } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ShieldCheck, Eye, Download, Pencil, Activity } from "lucide-react";

const ICONE_ACAO: Record<string, React.ComponentType<{ className?: string }>> = {
  VISUALIZAR_DADOS_SENSIVEIS: Eye,
  VISUALIZAR_PROPRIO_PERFIL: Eye,
  EXPORTAR: Download,
};

function variantePorAcao(acao: string): "info" | "warning" | "danger" | "success" | "neutral" {
  if (acao.startsWith("VISUALIZAR")) return "info";
  if (acao.startsWith("EXPORTAR")) return "warning";
  if (acao.startsWith("REMOVER")) return "danger";
  if (acao.startsWith("LOGIN") || acao.startsWith("LOGOUT")) return "neutral";
  return "success";
}

export default async function LgpdPage({
  searchParams,
}: {
  searchParams: { acao?: string };
}) {
  await exigirPerfil(PERFIS.ADMIN_RH);

  const where = searchParams.acao ? { acao: searchParams.acao } : {};

  const [logs, total, acoesDistintas, hoje] = await Promise.all([
    db.accessLog.findMany({
      where,
      include: { usuario: { select: { email: true, colaborador: { select: { nome: true } } } } },
      orderBy: { criadoEm: "desc" },
      take: 200,
    }),
    db.accessLog.count(),
    db.accessLog.groupBy({ by: ["acao"], _count: { acao: true } }),
    db.accessLog.count({
      where: { criadoEm: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
  ]);

  const sensiveis = acoesDistintas
    .filter((a) => a.acao.includes("SENSIVEIS") || a.acao.includes("EXPORTAR"))
    .reduce((s, a) => s + a._count.acao, 0);

  return (
    <>
      <PageHeader
        title="Registros de Acesso (LGPD)"
        description="Trilha de auditoria de acessos a dados pessoais e sensíveis"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total de registros" value={total} icon={<Activity className="h-5 w-5" />} accent="brand" />
        <StatCard label="Acessos hoje" value={hoje} icon={<Eye className="h-5 w-5" />} accent="blue" />
        <StatCard label="A dados sensíveis" value={sensiveis} icon={<ShieldCheck className="h-5 w-5" />} accent="amber" />
        <StatCard label="Tipos de ação" value={acoesDistintas.length} icon={<Pencil className="h-5 w-5" />} accent="green" />
      </div>

      <Card>
        <CardHeader
          title="Trilha de auditoria"
          subtitle="Últimos 200 registros"
          icon={<ShieldCheck className="h-4 w-4" />}
          action={
            <form method="GET" className="flex items-center gap-2">
              <select name="acao" defaultValue={searchParams.acao ?? ""} className="input w-auto text-xs">
                <option value="">Todas as ações</option>
                {acoesDistintas.map((a) => (
                  <option key={a.acao} value={a.acao}>{a.acao} ({a._count.acao})</option>
                ))}
              </select>
              <button type="submit" className="btn-outline text-xs">Filtrar</button>
            </form>
          }
        />
        <CardBody className="p-0">
          {logs.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhum registro de acesso" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="th">Data/Hora</th>
                    <th className="th">Usuário</th>
                    <th className="th">Ação</th>
                    <th className="th hidden md:table-cell">Recurso</th>
                    <th className="th hidden lg:table-cell">Detalhe</th>
                    <th className="th hidden sm:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60">
                      <td className="td whitespace-nowrap text-slate-600">
                        {l.criadoEm.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                      </td>
                      <td className="td">
                        <p className="font-medium text-slate-800">
                          {l.usuario.colaborador?.nome ?? l.usuario.email}
                        </p>
                        <p className="text-xs text-slate-400">{l.usuario.email}</p>
                      </td>
                      <td className="td">
                        <Badge variant={variantePorAcao(l.acao)}>{l.acao}</Badge>
                      </td>
                      <td className="td hidden md:table-cell text-slate-600">{l.recurso}</td>
                      <td className="td hidden lg:table-cell text-xs text-slate-400">{l.detalhe ?? "—"}</td>
                      <td className="td hidden sm:table-cell text-xs text-slate-400">{l.ip ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </>
  );
}
