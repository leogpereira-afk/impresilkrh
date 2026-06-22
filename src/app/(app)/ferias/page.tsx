import { exigirPerfil } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { formatDate, mesesDeCasa } from "@/lib/format";
import Link from "next/link";
import { Palmtree, PlaneTakeoff, AlertTriangle, CalendarClock, CalendarCheck } from "lucide-react";

export default async function FeriasPage() {
  const sessao = await exigirPerfil(PERFIS.ADMIN_RH, PERFIS.GESTOR);
  const escopo = await escopoColaboradores(sessao);
  const hoje = new Date();
  const em30 = new Date();
  em30.setDate(em30.getDate() + 30);

  const colaboradores = await db.colaborador.findMany({
    where: { ...escopo, dataDesligamento: null, status: { contaComoAtivo: true } },
    include: {
      cargo: { select: { nome: true } },
      ferias: { orderBy: { dataInicio: "desc" } },
    },
    orderBy: { nome: "asc" },
  });

  type Linha = {
    id: string; nome: string; cargo: string | null;
    diasAcumulados: number; diasGozados: number; saldo: number;
    ultimoRetorno: Date | null; risco: "Vencidas" | "Vencendo" | "Em dia";
    deFeriasAgora: { dataRetorno: Date | null } | null;
    proxima: { dataInicio: Date | null; dataRetorno: Date | null } | null;
  };

  const linhas: Linha[] = colaboradores.map((c) => {
    const meses = mesesDeCasa(c.dataAdmissao);
    const ciclos = Math.floor(meses / 12);
    const diasAcumulados = ciclos * 30;
    const diasGozados = c.ferias.reduce((s, f) => s + (f.diasGozados ?? 0), 0);
    const saldo = Math.max(0, diasAcumulados - diasGozados);

    const concluidas = c.ferias.filter((f) => f.dataRetorno && f.dataRetorno < hoje);
    const ultimoRetorno = concluidas[0]?.dataRetorno ?? null;

    const deFeriasAgora =
      c.ferias.find(
        (f) => f.dataInicio && f.dataRetorno && f.dataInicio <= hoje && f.dataRetorno >= hoje,
      ) ?? null;
    const proxima =
      c.ferias.find((f) => f.dataInicio && f.dataInicio > hoje) ?? null;

    let risco: Linha["risco"] = "Em dia";
    if (saldo >= 60) risco = "Vencidas";
    else if (saldo >= 30) risco = "Vencendo";

    return {
      id: c.id, nome: c.nome, cargo: c.cargo?.nome ?? null,
      diasAcumulados, diasGozados, saldo, ultimoRetorno, risco,
      deFeriasAgora: deFeriasAgora ? { dataRetorno: deFeriasAgora.dataRetorno } : null,
      proxima: proxima ? { dataInicio: proxima.dataInicio, dataRetorno: proxima.dataRetorno } : null,
    };
  });

  const deFeriasAgora = linhas.filter((l) => l.deFeriasAgora);
  const proximas = linhas
    .filter((l) => l.proxima?.dataInicio && l.proxima.dataInicio <= em30)
    .sort((a, b) => (a.proxima!.dataInicio!.getTime() - b.proxima!.dataInicio!.getTime()));
  const vencidas = linhas.filter((l) => l.risco === "Vencidas");
  const saldoTotal = linhas.reduce((s, l) => s + l.saldo, 0);

  return (
    <>
      <PageHeader
        title="Painel de Férias"
        description="Controle de saldos, programação e conformidade com a CLT"
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="De férias agora" value={deFeriasAgora.length} icon={<PlaneTakeoff className="h-5 w-5" />} accent="blue" />
        <StatCard label="Próximas (30 dias)" value={proximas.length} icon={<CalendarClock className="h-5 w-5" />} accent="green" />
        <StatCard label="Períodos vencidos" value={vencidas.length} icon={<AlertTriangle className="h-5 w-5" />} accent="red" hint="Risco de dobra (CLT)" />
        <StatCard label="Saldo total (dias)" value={saldoTotal} icon={<Palmtree className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* De férias agora */}
        <Card>
          <CardHeader title="De férias agora" icon={<PlaneTakeoff className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {deFeriasAgora.length === 0 ? (
              <EmptyState title="Ninguém de férias no momento" />
            ) : (
              deFeriasAgora.map((l) => (
                <Link key={l.id} href={`/colaboradores/${l.id}`} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                  <Avatar nome={l.nome} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{l.nome}</p>
                    <p className="truncate text-xs text-slate-500">{l.cargo}</p>
                  </div>
                  <Badge variant="info">retorna {formatDate(l.deFeriasAgora!.dataRetorno)}</Badge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>

        {/* Próximas */}
        <Card>
          <CardHeader title="Próximas férias (30 dias)" icon={<CalendarClock className="h-4 w-4" />} />
          <CardBody className="space-y-2">
            {proximas.length === 0 ? (
              <EmptyState title="Nenhuma féria agendada no período" />
            ) : (
              proximas.map((l) => (
                <Link key={l.id} href={`/colaboradores/${l.id}`} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 hover:bg-slate-50">
                  <Avatar nome={l.nome} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{l.nome}</p>
                    <p className="truncate text-xs text-slate-500">{l.cargo}</p>
                  </div>
                  <Badge variant="gold">{formatDate(l.proxima!.dataInicio)}</Badge>
                </Link>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      {/* Saldos e conformidade */}
      <Card>
        <CardHeader
          title="Saldos e conformidade"
          subtitle="Dias acumulados vs. gozados — alertas de período vencido conforme a CLT"
          icon={<CalendarCheck className="h-4 w-4" />}
        />
        <CardBody className="p-0">
          {linhas.length === 0 ? (
            <div className="p-5"><EmptyState title="Sem colaboradores no escopo" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="th">Colaborador</th>
                    <th className="th text-right">Acumulado</th>
                    <th className="th text-right">Gozado</th>
                    <th className="th text-right">Saldo</th>
                    <th className="th hidden md:table-cell">Último retorno</th>
                    <th className="th">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {linhas.map((l) => (
                    <tr key={l.id} className="hover:bg-slate-50/60">
                      <td className="td">
                        <Link href={`/colaboradores/${l.id}`} className="flex items-center gap-2.5">
                          <Avatar nome={l.nome} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-800">{l.nome}</p>
                            <p className="truncate text-xs text-slate-500">{l.cargo}</p>
                          </div>
                        </Link>
                      </td>
                      <td className="td text-right tabular-nums text-slate-600">{l.diasAcumulados}</td>
                      <td className="td text-right tabular-nums text-slate-600">{l.diasGozados}</td>
                      <td className="td text-right tabular-nums font-semibold text-brand-ink">{l.saldo}</td>
                      <td className="td hidden md:table-cell text-slate-500">{l.ultimoRetorno ? formatDate(l.ultimoRetorno) : "Nunca"}</td>
                      <td className="td">
                        <Badge variant={l.risco === "Vencidas" ? "danger" : l.risco === "Vencendo" ? "warning" : "success"}>
                          {l.risco}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <p className="mt-3 text-xs text-slate-400">
        Conformidade: pela CLT, as férias devem ser concedidas nos 12 meses seguintes ao período aquisitivo;
        o não cumprimento implica pagamento em dobro. Saldo ≥ 30 dias indica período a vencer; ≥ 60 dias, período vencido.
      </p>
    </>
  );
}
