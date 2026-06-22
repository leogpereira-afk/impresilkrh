import { exigirSessao } from "@/lib/auth";
import { dashboardGeral } from "@/lib/queries";
import { db } from "@/lib/db";
import { PERFIS } from "@/lib/constants";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Avatar } from "@/components/ui/misc";
import { BarrasVerticais, BarrasColoridas, Rosca } from "@/components/charts/charts";
import { formatBRL, MESES_PT } from "@/lib/format";
import { DashboardPessoal } from "@/components/dashboard/dashboard-pessoal";
import {
  Users,
  UserPlus,
  UserMinus,
  TrendingDown,
  FileWarning,
  ClipboardCheck,
  Palmtree,
  Cake,
  AlertTriangle,
  ArrowUpRight,
  Gauge,
} from "lucide-react";

export default async function DashboardPage() {
  const sessao = await exigirSessao();

  if (sessao.perfil === PERFIS.COLABORADOR && sessao.colaboradorId) {
    return <DashboardPessoal colaboradorId={sessao.colaboradorId} nome={sessao.nome} />;
  }

  const d = await dashboardGeral(sessao);
  const mesNome = MESES_PT[new Date().getMonth()];
  const escopoLabel =
    sessao.perfil === PERFIS.ADMIN_RH ? "Visão geral da empresa" : "Sua equipe";

  return (
    <>
      <PageHeader
        title={`Olá, ${sessao.nome.split(" ")[0]}`}
        description={`${escopoLabel} · Indicadores de gestão de pessoas`}
      />

      {/* KPIs principais */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Colaboradores ativos"
          value={d.totalAtivos}
          icon={<Users className="h-5 w-5" />}
          accent="brand"
          hint="Headcount atual"
        />
        <StatCard
          label="Admissões (12m)"
          value={d.admissoesPeriodo}
          icon={<UserPlus className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Desligamentos (12m)"
          value={d.desligamentosPeriodo}
          icon={<UserMinus className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label="Turnover (12m)"
          value={`${d.turnover}%`}
          icon={<TrendingDown className="h-5 w-5" />}
          accent={d.turnover > 10 ? "red" : "green"}
          hint="Meta RH ≤ 10%"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Documentos a vencer"
          value={d.documentosAVencer}
          icon={<FileWarning className="h-5 w-5" />}
          accent="amber"
          hint={`${d.documentosVencidos} já vencidos`}
        />
        <StatCard
          label="Avaliações pendentes"
          value={d.avaliacoesPendentes}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="blue"
          hint="Autoavaliações do ciclo"
        />
        <StatCard
          label="Férias em aberto"
          value={d.feriasEmAberto}
          icon={<Palmtree className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Risco de saída alto"
          value={d.riscoAlto}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent="red"
          hint="Colaboradores estratégicos"
        />
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Colaboradores por área"
            subtitle="Distribuição do headcount ativo"
            icon={<Users className="h-4 w-4" />}
          />
          <CardBody>
            {d.porArea.length ? (
              <BarrasVerticais data={d.porArea} />
            ) : (
              <EmptyState title="Sem dados" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Enquadramento salarial"
            subtitle="Posição vs. mercado (MOC)"
            icon={<Gauge className="h-4 w-4" />}
          />
          <CardBody>
            {d.porStatusSalarial.length ? (
              <Rosca data={d.porStatusSalarial} />
            ) : (
              <EmptyState title="Sem dados" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Distribuição por nível"
            subtitle="Régua de senioridade N1–N5"
            icon={<ArrowUpRight className="h-4 w-4" />}
          />
          <CardBody>
            <BarrasVerticais data={d.porNivel} cor="#c2a14d" altura={220} />
          </CardBody>
        </Card>

        {/* Aniversariantes */}
        <Card>
          <CardHeader
            title={`Aniversariantes de ${mesNome}`}
            subtitle={`${d.aniversariantesMes.length} no mês`}
            icon={<Cake className="h-4 w-4" />}
          />
          <CardBody className="space-y-3">
            {d.aniversariantesMes.length ? (
              d.aniversariantesMes.map((a) => (
                <div key={a.id} className="flex items-center gap-3">
                  <Avatar nome={a.nome} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {a.nome}
                    </p>
                    <p className="truncate text-xs text-slate-500">{a.cargo}</p>
                  </div>
                  <Badge variant="gold">dia {a.dia}</Badge>
                </div>
              ))
            ) : (
              <EmptyState title="Nenhum aniversariante este mês" />
            )}
          </CardBody>
        </Card>

        {/* Alertas */}
        <Card>
          <CardHeader
            title="Alertas e vencimentos"
            subtitle="Próximos 60 dias"
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <CardBody className="space-y-2.5">
            {d.alertas.length ? (
              d.alertas.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      a.severidade === "danger"
                        ? "bg-red-500"
                        : a.severidade === "warning"
                          ? "bg-amber-500"
                          : "bg-blue-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-700">
                      {a.titulo}
                    </p>
                    <p className="text-[11px] text-slate-500">{a.detalhe}</p>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState title="Nenhum alerta no período" />
            )}
          </CardBody>
        </Card>
      </div>

      {/* Faixa resumo */}
      <div className="mt-6 flex flex-col items-start justify-between gap-3 rounded-xl bg-brand-ink px-6 py-5 text-white sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-gold-200">Resumo executivo</p>
          <p className="mt-1 text-sm text-slate-300">
            {d.mediaSalarial != null && (
              <>
                Média salarial da equipe:{" "}
                <span className="font-semibold text-white">{formatBRL(d.mediaSalarial)}</span>
                {" · "}
              </>
            )}
            {d.elegiveisPromocao} elegível(is) a promoção no ciclo atual
          </p>
        </div>
        <Badge variant="gold">Ciclo 2026.1</Badge>
      </div>
    </>
  );
}
