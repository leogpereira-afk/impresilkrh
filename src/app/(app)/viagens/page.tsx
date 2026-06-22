import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PERFIS, COR_STATUS_VIAGEM } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { FormViagem } from "@/components/viagens/forms";
import { salvarViagem, removerViagem } from "./actions";
import { formatBRL, formatDate } from "@/lib/format";
import { Plane, MapPin, Wallet, CalendarClock, Trash2 } from "lucide-react";

export default async function ViagensPage() {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);

  const [viagens, colaboradores] = await Promise.all([
    db.viagem.findMany({
      where: { colaborador: escopo },
      include: { colaborador: { select: { id: true, nome: true, cargo: { select: { nome: true } } } } },
      orderBy: { dataInicio: "desc" },
    }),
    db.colaborador.findMany({
      where: { ...escopo, dataDesligamento: null },
      select: { id: true, nome: true },
      orderBy: { nome: "asc" },
    }),
  ]);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const gastoMes = viagens
    .filter((v) => v.dataInicio >= inicioMes && v.status !== "Cancelada")
    .reduce((s, v) => s + v.valorTotal, 0);
  const emAndamento = viagens.filter((v) => v.status === "Em andamento").length;
  const planejadas = viagens.filter((v) => v.status === "Planejada" || v.status === "Aprovada").length;
  const totalDiarias = viagens.filter((v) => v.status !== "Cancelada").reduce((s, v) => s + v.dias, 0);

  return (
    <>
      <PageHeader
        title="Viagens e Diárias"
        description="Controle de deslocamentos e diárias da equipe de campo"
      />

      <div className="mb-4">
        <FormViagem action={salvarViagem} colaboradores={colaboradores} />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Gasto no mês" value={formatBRL(gastoMes)} icon={<Wallet className="h-5 w-5" />} accent="brand" />
        <StatCard label="Em andamento" value={emAndamento} icon={<Plane className="h-5 w-5" />} accent="amber" />
        <StatCard label="Planejadas / Aprovadas" value={planejadas} icon={<CalendarClock className="h-5 w-5" />} accent="blue" />
        <StatCard label="Total de diárias" value={totalDiarias} icon={<MapPin className="h-5 w-5" />} accent="green" />
      </div>

      <Card>
        <CardHeader title="Viagens" subtitle={`${viagens.length} registro(s)`} icon={<Plane className="h-4 w-4" />} />
        <CardBody className="p-0">
          {viagens.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhuma viagem registrada" icon={<Plane className="h-8 w-8" />} /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="th">Colaborador</th>
                    <th className="th">Destino</th>
                    <th className="th hidden md:table-cell">Período</th>
                    <th className="th text-right">Diárias</th>
                    <th className="th text-right">Total</th>
                    <th className="th">Status</th>
                    <th className="th" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {viagens.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <div className="flex items-center gap-2.5">
                          <Avatar nome={v.colaborador.nome} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{v.colaborador.nome}</p>
                            <p className="truncate text-xs text-slate-500">{v.colaborador.cargo?.nome}</p>
                          </div>
                        </div>
                      </td>
                      <td className="td">
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />{v.destino}
                        </span>
                      </td>
                      <td className="td hidden md:table-cell text-slate-600">{formatDate(v.dataInicio)} — {formatDate(v.dataFim)}</td>
                      <td className="td text-right tabular-nums text-slate-600">{v.dias}</td>
                      <td className="td text-right tabular-nums font-medium text-brand-ink">{formatBRL(v.valorTotal)}</td>
                      <td className="td">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
                          style={{ backgroundColor: (COR_STATUS_VIAGEM[v.status] ?? "#64748b") + "22", color: COR_STATUS_VIAGEM[v.status] ?? "#64748b" }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: COR_STATUS_VIAGEM[v.status] ?? "#64748b" }} />
                          {v.status}
                        </span>
                      </td>
                      <td className="td text-right">
                        <form action={removerViagem}>
                          <input type="hidden" name="id" value={v.id} />
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" title="Remover"><Trash2 className="h-4 w-4" /></button>
                        </form>
                      </td>
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
