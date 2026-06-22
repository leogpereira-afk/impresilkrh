import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, Progress, EmptyState, Field } from "@/components/ui/misc";
import { formatBRL, formatDate } from "@/lib/format";
import { JANELA_ALERTA_DIAS } from "@/lib/constants";
import Link from "next/link";
import {
  Target,
  ClipboardCheck,
  Palmtree,
  GitBranch,
  FileWarning,
  ArrowRight,
} from "lucide-react";

export async function DashboardPessoal({
  colaboradorId,
  nome,
}: {
  colaboradorId: string;
  nome: string;
}) {
  const c = await db.colaborador.findUnique({
    where: { id: colaboradorId },
    include: {
      cargo: true,
      nivel: true,
      area: true,
      status: true,
      gestor: { select: { nome: true } },
      metas: { orderBy: { criadoEm: "desc" } },
      pdis: { orderBy: { criadoEm: "desc" } },
      ferias: { orderBy: { criadoEm: "desc" } },
      avaliacoesRecebidas: {
        where: { tipo: "GESTOR" },
        orderBy: { criadoEm: "desc" },
        take: 1,
      },
    },
  });

  if (!c) return <EmptyState title="Colaborador não encontrado" />;

  const hoje = new Date();
  const janela = new Date();
  janela.setDate(janela.getDate() + JANELA_ALERTA_DIAS);
  const docsAVencer = await db.documento.count({
    where: {
      colaboradorId,
      dataVencimento: { not: null, lte: janela },
    },
  });

  const aval = c.avaliacoesRecebidas[0];
  const proximaFerias = c.ferias.find(
    (f) => f.status === "Agendada" || f.status === "Em andamento",
  );
  const pdiAtivo = c.pdis.filter((p) => p.status !== "Concluída");

  return (
    <>
      <PageHeader
        title={`Olá, ${nome.split(" ")[0]}`}
        description="Seu painel de autoatendimento"
      />

      {/* Cartão de identificação */}
      <Card className="mb-4">
        <CardBody className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar nome={c.nome} size="lg" />
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-brand-ink">{c.nome}</h2>
            <p className="text-sm text-slate-500">
              {c.cargo?.nome} · {c.area?.nome}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="info">
                {c.nivel?.codigo} · {c.nivel?.senioridade}
              </Badge>
              {c.status && <Badge variant="success">{c.status.nome}</Badge>}
              {c.gestor && (
                <Badge variant="neutral">Gestor: {c.gestor.nome.split(" ")[0]}</Badge>
              )}
            </div>
          </div>
          <Link href="/meu-perfil" className="btn-outline">
            Ver meu perfil <ArrowRight className="h-4 w-4" />
          </Link>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Última avaliação"
          value={aval?.notaFinal != null ? aval.notaFinal.toFixed(1) : "—"}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="blue"
          hint={aval?.statusDesempenho ?? "Sem avaliação"}
        />
        <StatCard
          label="Metas ativas"
          value={c.metas.filter((m) => m.status !== "Concluída").length}
          icon={<Target className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Ações de PDI"
          value={pdiAtivo.length}
          icon={<GitBranch className="h-5 w-5" />}
          accent="gold"
        />
        <StatCard
          label="Documentos a vencer"
          value={docsAVencer}
          icon={<FileWarning className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Carreira */}
        <Card>
          <CardHeader
            title="Minha posição na carreira"
            icon={<GitBranch className="h-4 w-4" />}
            action={
              <Link href="/carreira" className="text-xs font-medium text-brand hover:underline">
                Simular progressão
              </Link>
            }
          />
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Cargo" value={c.cargo?.nome} />
              <Field label="Nível atual" value={`${c.nivel?.codigo} · ${c.nivel?.senioridade}`} />
              <Field label="Salário" value={formatBRL(c.salario)} />
              <Field
                label="Enquadramento"
                value={c.posicaoFaixa ? <Badge variant={c.posicaoFaixa === "Dentro" ? "success" : c.posicaoFaixa === "Acima" ? "info" : "warning"}>{c.posicaoFaixa}</Badge> : "—"}
              />
            </dl>
          </CardBody>
        </Card>

        {/* Férias */}
        <Card>
          <CardHeader title="Minhas férias" icon={<Palmtree className="h-4 w-4" />} />
          <CardBody>
            {proximaFerias ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Período</span>
                  <span className="text-sm font-medium text-slate-800">
                    {formatDate(proximaFerias.dataInicio)} — {formatDate(proximaFerias.dataRetorno)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Status</span>
                  <Badge variant="info">{proximaFerias.status}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Saldo de dias</span>
                  <span className="text-sm font-medium text-slate-800">
                    {proximaFerias.saldoDias} dias
                  </span>
                </div>
              </div>
            ) : (
              <EmptyState title="Sem férias agendadas" description="Saldo disponível para programação." />
            )}
          </CardBody>
        </Card>
      </div>

      {/* PDI */}
      <Card className="mt-4">
        <CardHeader
          title="Meu Plano de Desenvolvimento Individual (PDI)"
          icon={<Target className="h-4 w-4" />}
          action={
            <Link href="/desempenho" className="text-xs font-medium text-brand hover:underline">
              Ver desempenho
            </Link>
          }
        />
        <CardBody className="space-y-4">
          {c.pdis.length ? (
            c.pdis.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{p.competencia}</span>
                  <Badge
                    variant={
                      p.status === "Concluída"
                        ? "success"
                        : p.status === "Atrasada"
                          ? "danger"
                          : "info"
                    }
                  >
                    {p.status}
                  </Badge>
                </div>
                <p className="mb-2 text-xs text-slate-500">{p.acao}</p>
                <Progress value={p.progresso} />
              </div>
            ))
          ) : (
            <EmptyState title="Nenhuma ação de PDI" description="Converse com seu gestor sobre seu desenvolvimento." />
          )}
        </CardBody>
      </Card>
    </>
  );
}
