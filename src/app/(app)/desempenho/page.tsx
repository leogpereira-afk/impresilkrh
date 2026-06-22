import { exigirSessao } from "@/lib/auth";
import { escopoColaboradores } from "@/lib/rbac";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { NineBox, type PontoNineBox } from "@/components/desempenho/nine-box";
import { DesempenhoPessoal } from "@/components/desempenho/desempenho-pessoal";
import { formatDate } from "@/lib/format";
import { Grid3x3, ClipboardCheck, Award, CalendarRange, Target } from "lucide-react";

function bucketDesempenho(nota: number | null | undefined, status?: string | null): string {
  if (nota != null) {
    if (nota >= 80) return "Alto";
    if (nota >= 60) return "Médio";
    return "Baixo";
  }
  if (status === "Apto") return "Alto";
  if (status === "Não apto") return "Baixo";
  return "Médio";
}

export default async function DesempenhoPage() {
  const sessao = await exigirSessao();

  if (sessao.perfil === PERFIS.COLABORADOR && sessao.colaboradorId) {
    return (
      <>
        <PageHeader title="Meu Desempenho" description="Avaliações, metas e desenvolvimento" />
        <DesempenhoPessoal colaboradorId={sessao.colaboradorId} />
      </>
    );
  }

  const escopo = await escopoColaboradores(sessao);
  const ciclo = await db.cicloAvaliacao.findFirst({
    where: { status: "Aberto" },
    orderBy: { dataInicio: "desc" },
  });

  const colaboradores = await db.colaborador.findMany({
    where: { ...escopo, status: { contaComoAtivo: true }, dataDesligamento: null },
    include: {
      cargo: true,
      area: true,
      avaliacoesRecebidas: {
        where: { tipo: "GESTOR" },
        orderBy: { criadoEm: "desc" },
        take: 1,
      },
    },
    orderBy: { nome: "asc" },
  });

  const pontos: PontoNineBox[] = colaboradores.map((c) => {
    const av = c.avaliacoesRecebidas[0];
    return {
      id: c.id,
      nome: c.nome,
      potencial: c.potencial ?? "Médio",
      desempenho: bucketDesempenho(av?.notaFinal, av?.statusDesempenho),
    };
  });

  // Avaliações do ciclo atual no escopo
  const avaliacoesCiclo = ciclo
    ? await db.avaliacao.findMany({
        where: {
          cicloId: ciclo.id,
          tipo: "GESTOR",
          colaborador: escopo,
        },
        include: { colaborador: { select: { id: true, nome: true, cargo: { select: { nome: true } } } } },
        orderBy: { notaFinal: "desc" },
      })
    : [];

  const elegiveis = avaliacoesCiclo.filter((a) => a.elegivelPromocao).length;
  const avaliados = avaliacoesCiclo.length;
  const mediaNota =
    avaliacoesCiclo.length > 0
      ? avaliacoesCiclo.reduce((s, a) => s + (a.notaFinal ?? 0), 0) / avaliacoesCiclo.length
      : 0;

  return (
    <>
      <PageHeader
        title="Desempenho e Retenção"
        description={ciclo ? `Ciclo atual: ${ciclo.nome}` : "Nenhum ciclo aberto"}
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Avaliados no ciclo" value={avaliados} icon={<ClipboardCheck className="h-5 w-5" />} accent="blue" />
        <StatCard label="Nota média" value={mediaNota.toFixed(1)} icon={<Target className="h-5 w-5" />} accent="brand" />
        <StatCard label="Elegíveis a promoção" value={elegiveis} icon={<Award className="h-5 w-5" />} accent="gold" />
        <StatCard
          label="Ciclo"
          value={ciclo ? "Aberto" : "—"}
          icon={<CalendarRange className="h-5 w-5" />}
          accent="green"
          hint={ciclo ? `até ${formatDate(ciclo.dataFim)}` : undefined}
        />
      </div>

      {/* Matriz 9-box */}
      <Card className="mb-6">
        <CardHeader
          title="Matriz 9-Box"
          subtitle="Desempenho × Potencial — base para decisões de retenção e sucessão"
          icon={<Grid3x3 className="h-4 w-4" />}
        />
        <CardBody>
          {pontos.length ? <NineBox pontos={pontos} /> : <EmptyState title="Sem dados para a matriz" />}
        </CardBody>
      </Card>

      {/* Avaliações do ciclo */}
      <Card>
        <CardHeader title="Avaliações do ciclo" icon={<ClipboardCheck className="h-4 w-4" />} />
        <CardBody className="p-0">
          {avaliacoesCiclo.length === 0 ? (
            <div className="p-5"><EmptyState title="Nenhuma avaliação no ciclo atual" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="th">Colaborador</th>
                  <th className="th text-right">Técnico</th>
                  <th className="th text-right">Comport.</th>
                  <th className="th text-right">Result.</th>
                  <th className="th text-right">Final</th>
                  <th className="th">Status</th>
                  <th className="th">Promoção</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {avaliacoesCiclo.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-2.5">
                        <Avatar nome={a.colaborador.nome} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{a.colaborador.nome}</p>
                          <p className="truncate text-xs text-slate-500">{a.colaborador.cargo?.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="td text-right tabular-nums text-slate-600">{a.notaTecnico?.toFixed(1) ?? "—"}</td>
                    <td className="td text-right tabular-nums text-slate-600">{a.notaComportamental?.toFixed(1) ?? "—"}</td>
                    <td className="td text-right tabular-nums text-slate-600">{a.notaResultado?.toFixed(1) ?? "—"}</td>
                    <td className="td text-right tabular-nums font-semibold text-brand-ink">{a.notaFinal?.toFixed(1) ?? "—"}</td>
                    <td className="td">
                      {a.statusDesempenho && (
                        <Badge variant={a.statusDesempenho === "Apto" ? "success" : a.statusDesempenho === "Não apto" ? "danger" : "warning"}>
                          {a.statusDesempenho}
                        </Badge>
                      )}
                    </td>
                    <td className="td">
                      {a.elegivelPromocao ? <Badge variant="gold">Elegível</Badge> : <span className="text-xs text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
