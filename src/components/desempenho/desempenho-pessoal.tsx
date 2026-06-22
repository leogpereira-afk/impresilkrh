import { db } from "@/lib/db";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress, EmptyState, Field } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { ClipboardCheck, Target, GitBranch, MessageSquare } from "lucide-react";

export async function DesempenhoPessoal({ colaboradorId }: { colaboradorId: string }) {
  const [avaliacoes, metas, pdis, feedbacks] = await Promise.all([
    db.avaliacao.findMany({
      where: { colaboradorId, tipo: "GESTOR" },
      include: { ciclo: true },
      orderBy: { criadoEm: "desc" },
    }),
    db.meta.findMany({ where: { colaboradorId }, orderBy: { criadoEm: "desc" } }),
    db.pDI.findMany({ where: { colaboradorId }, orderBy: { criadoEm: "desc" } }),
    db.feedback.findMany({
      where: { colaboradorId },
      include: { autor: { select: { nome: true } } },
      orderBy: { criadoEm: "desc" },
      take: 10,
    }),
  ]);

  const ultima = avaliacoes[0];

  return (
    <div className="space-y-6">
      {/* Última avaliação */}
      <Card>
        <CardHeader title="Minha avaliação de desempenho" icon={<ClipboardCheck className="h-4 w-4" />} />
        <CardBody>
          {ultima ? (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="flex h-16 w-16 flex-col items-center justify-center rounded-xl bg-brand text-white">
                  <span className="text-xl font-bold">{ultima.notaFinal?.toFixed(0) ?? "—"}</span>
                  <span className="text-[10px] uppercase">nota</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">{ultima.ciclo.nome}</p>
                  {ultima.statusDesempenho && (
                    <Badge
                      variant={
                        ultima.statusDesempenho === "Apto" ? "success"
                          : ultima.statusDesempenho === "Não apto" ? "danger" : "warning"
                      }
                    >
                      {ultima.statusDesempenho}
                    </Badge>
                  )}
                </div>
              </div>
              <dl className="grid grid-cols-3 gap-4">
                <Field label="Técnico" value={ultima.notaTecnico?.toFixed(1) ?? "—"} />
                <Field label="Comportamental" value={ultima.notaComportamental?.toFixed(1) ?? "—"} />
                <Field label="Resultados" value={ultima.notaResultado?.toFixed(1) ?? "—"} />
              </dl>
              {ultima.comentarios && (
                <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  {ultima.comentarios}
                </div>
              )}
            </>
          ) : (
            <EmptyState title="Nenhuma avaliação registrada" />
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Metas */}
        <Card>
          <CardHeader title="Minhas metas" icon={<Target className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            {metas.length ? metas.map((m) => {
              const pct = m.valorAlvo && m.valorAtual != null
                ? Math.min(100, (m.valorAtual / m.valorAlvo) * 100) : 0;
              return (
                <div key={m.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{m.titulo}</span>
                    <Badge variant={m.status === "Concluída" ? "success" : m.status === "Atrasada" ? "danger" : "info"}>
                      {m.status}
                    </Badge>
                  </div>
                  {m.descricao && <p className="mb-2 text-xs text-slate-500">{m.descricao}</p>}
                  {m.valorAlvo != null && (
                    <>
                      <Progress value={pct} />
                      <p className="mt-1 text-xs text-slate-400">
                        {m.valorAtual ?? 0} / {m.valorAlvo} {m.unidade ?? ""}
                      </p>
                    </>
                  )}
                </div>
              );
            }) : <EmptyState title="Nenhuma meta definida" />}
          </CardBody>
        </Card>

        {/* PDI */}
        <Card>
          <CardHeader title="Plano de Desenvolvimento (PDI)" icon={<GitBranch className="h-4 w-4" />} />
          <CardBody className="space-y-4">
            {pdis.length ? pdis.map((p) => (
              <div key={p.id}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">{p.competencia}</span>
                  <Badge variant={p.status === "Concluída" ? "success" : p.status === "Atrasada" ? "danger" : "info"}>
                    {p.status}
                  </Badge>
                </div>
                <p className="mb-2 text-xs text-slate-500">{p.acao}</p>
                <Progress value={p.progresso} cor="#c2a14d" />
              </div>
            )) : <EmptyState title="Nenhuma ação de PDI" />}
          </CardBody>
        </Card>
      </div>

      {/* Feedbacks */}
      <Card>
        <CardHeader title="Feedbacks recebidos" icon={<MessageSquare className="h-4 w-4" />} />
        <CardBody className="space-y-3">
          {feedbacks.length ? feedbacks.map((f) => (
            <div key={f.id} className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="mb-1 flex items-center justify-between">
                <Badge variant={f.tipo === "Positivo" ? "success" : f.tipo === "Desenvolvimento" ? "warning" : "neutral"}>
                  {f.tipo}
                </Badge>
                <span className="text-xs text-slate-400">{formatDate(f.criadoEm)}</span>
              </div>
              <p className="text-sm text-slate-700">{f.conteudo}</p>
              {f.autor && <p className="mt-1 text-xs text-slate-400">— {f.autor.nome}</p>}
            </div>
          )) : <EmptyState title="Nenhum feedback recebido" />}
        </CardBody>
      </Card>
    </div>
  );
}
