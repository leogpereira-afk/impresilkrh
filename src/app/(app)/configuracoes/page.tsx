import { exigirPerfil } from "@/lib/auth";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { FormStatus, FormCiclo } from "@/components/configuracoes/forms";
import { criarStatus, criarCiclo, alternarCiclo } from "./actions";
import { Settings, Tag, CalendarRange, Layers, Building2 } from "lucide-react";

export default async function ConfiguracoesPage() {
  await exigirPerfil(PERFIS.ADMIN_RH);

  const [statuses, ciclos, areas, niveis, cargosCount] = await Promise.all([
    db.statusColaborador.findMany({ orderBy: { ordem: "asc" }, include: { _count: { select: { colaboradores: true } } } }),
    db.cicloAvaliacao.findMany({ orderBy: { dataInicio: "desc" } }),
    db.area.findMany({ orderBy: { nome: "asc" }, include: { _count: { select: { colaboradores: true, cargos: true } } } }),
    db.nivel.findMany({ orderBy: { ordem: "asc" } }),
    db.cargo.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Configurações"
        description="Parâmetros do sistema, status, ciclos de avaliação e estrutura"
      />

      {/* Status de colaboradores */}
      <Card className="mb-6">
        <CardHeader title="Status de colaboradores" subtitle="Estados configuráveis do quadro" icon={<Tag className="h-4 w-4" />} />
        <CardBody className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {statuses.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
                style={{ backgroundColor: s.cor + "22", color: s.cor }}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} />
                {s.nome}
                <span className="text-xs opacity-70">({s._count.colaboradores})</span>
                {!s.contaComoAtivo && <span className="text-xs opacity-60">· inativo</span>}
              </span>
            ))}
          </div>
          <div className="border-t border-slate-100 pt-4">
            <FormStatus action={criarStatus} />
          </div>
        </CardBody>
      </Card>

      {/* Ciclos de avaliação */}
      <Card className="mb-6">
        <CardHeader title="Ciclos de avaliação" subtitle="Períodos de avaliação de desempenho" icon={<CalendarRange className="h-4 w-4" />} />
        <CardBody className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="th">Ciclo</th>
                  <th className="th">Período</th>
                  <th className="th">Nota mín.</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ciclos.map((c) => (
                  <tr key={c.id}>
                    <td className="td font-medium text-slate-800">{c.nome}</td>
                    <td className="td text-slate-600">{formatDate(c.dataInicio)} — {formatDate(c.dataFim)}</td>
                    <td className="td text-slate-600">{c.notaMinPromocao}</td>
                    <td className="td">
                      <Badge variant={c.status === "Aberto" ? "success" : "neutral"}>{c.status}</Badge>
                    </td>
                    <td className="td text-right">
                      <form action={alternarCiclo}>
                        <input type="hidden" name="id" value={c.id} />
                        <button className="btn-outline text-xs">
                          {c.status === "Aberto" ? "Fechar" : "Reabrir"}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
                {ciclos.length === 0 && (
                  <tr><td colSpan={5} className="td text-center text-slate-400">Nenhum ciclo cadastrado</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <FormCiclo action={criarCiclo} />
          </div>
        </CardBody>
      </Card>

      {/* Estrutura (somente leitura) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Áreas e cargos" subtitle={`${areas.length} áreas · ${cargosCount} cargos`} icon={<Building2 className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {areas.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="text-sm font-medium text-slate-700">{a.nome}</span>
                <span className="text-xs text-slate-400">
                  {a._count.cargos} cargos · {a._count.colaboradores} pessoas
                </span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Régua de níveis" subtitle="Senioridade N1–N5" icon={<Layers className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {niveis.map((n) => (
              <div key={n.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                    {n.codigo}
                  </span>
                  {n.senioridade}
                </span>
                <span className="text-xs text-slate-400">{n.nome}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
