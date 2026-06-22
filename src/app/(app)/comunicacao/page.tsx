import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import Link from "next/link";
import {
  Megaphone, MessageSquare, Clock, GitBranch, CheckCircle2,
  AlertTriangle, Send, BookOpen, Sparkles,
} from "lucide-react";

const PRINCIPIOS = [
  { titulo: "Clareza", desc: "A informação deve ser completa e objetiva." },
  { titulo: "Fluxo", desc: "Toda comunicação respeita o processo definido." },
  { titulo: "Canal correto", desc: "Cada tipo de demanda usa o canal adequado." },
];

const CANAIS = [
  { tipo: "Pedidos e demandas", canal: "Canal oficial / formulário padrão" },
  { tipo: "Urgências", canal: "Canal exclusivo de urgência" },
  { tipo: "Dúvidas técnicas", canal: "PCP / Design" },
  { tipo: "Produção", canal: "Somente via PCP" },
  { tipo: "Decisões", canal: "Dentro do fluxo / liderança" },
];

const SLAS = [
  { item: "Validação de pedido (PCP)", prazo: "até 24h" },
  { item: "Revisão técnica (Design)", prazo: "até 12h úteis" },
  { item: "Retorno sobre urgência", prazo: "até 4h úteis" },
];

const FLUXO = ["Comercial", "PCP", "Produção"];

export default async function ComunicacaoPage() {
  await exigirSessao();
  const docs = await db.documentoInstitucional.findMany({
    where: { categoria: "Comunicação" },
    orderBy: { titulo: "asc" },
  });

  return (
    <>
      <PageHeader
        title="Comunicação Interna"
        description="Fluxos claros, menos ruído, mais resultado — o jeito Impresilk de se comunicar"
      />

      {/* Princípios */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PRINCIPIOS.map((p) => (
          <Card key={p.titulo}>
            <CardBody className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div>
                <p className="font-semibold text-brand-ink">{p.titulo}</p>
                <p className="mt-0.5 text-sm text-slate-500">{p.desc}</p>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Fluxo padrão */}
      <Card className="mb-6 border-brand/20 bg-brand-ink text-white">
        <CardBody>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-gold-200">
                <GitBranch className="h-4 w-4" /> Fluxo padrão da empresa
              </p>
              <p className="mt-1 text-xs text-slate-300">
                Pedido só entra no fluxo se estiver completo. O PCP valida antes de seguir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {FLUXO.map((etapa, i) => (
                <div key={etapa} className="flex items-center gap-2">
                  <span className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">{etapa}</span>
                  {i < FLUXO.length - 1 && <span className="text-gold-200">→</span>}
                </div>
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Canais oficiais */}
        <Card>
          <CardHeader title="Canais oficiais" subtitle="Cada assunto tem um canal certo" icon={<MessageSquare className="h-4 w-4" />} />
          <CardBody className="p-0">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {CANAIS.map((c) => (
                  <tr key={c.tipo}>
                    <td className="px-5 py-2.5 font-medium text-slate-700">{c.tipo}</td>
                    <td className="px-5 py-2.5 text-right text-slate-500">{c.canal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-5 py-3 text-xs text-slate-400">
              Mensagem fora do canal não orienta execução.
            </p>
          </CardBody>
        </Card>

        {/* SLAs */}
        <Card>
          <CardHeader title="Prazos de resposta (SLA)" subtitle="Para o fluxo rodar, todos respeitam os prazos" icon={<Clock className="h-4 w-4" />} />
          <CardBody className="space-y-3">
            {SLAS.map((s) => (
              <div key={s.item} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2.5">
                <span className="text-sm text-slate-700">{s.item}</span>
                <Badge variant="gold">{s.prazo}</Badge>
              </div>
            ))}
            <p className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" /> Responder dentro do prazo evita urgência artificial.
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Documentos de comunicação (do banco) */}
      <div className="mt-6">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          <Megaphone className="h-4 w-4 text-brand" /> Guias e planos de comunicação
        </h2>
        {docs.length === 0 ? (
          <EmptyState title="Nenhum guia cadastrado" />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {docs.map((d) => (
              <Card key={d.id}>
                <CardBody>
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="flex items-center gap-2 font-semibold text-brand-ink">
                      {d.titulo.includes("Endomarketing") ? <Sparkles className="h-4 w-4 text-gold-600" /> : <Send className="h-4 w-4 text-brand" />}
                      {d.titulo}
                    </h3>
                    {d.versao && <Badge variant="gold">v{d.versao}</Badge>}
                  </div>
                  {d.descricao && <p className="mb-3 text-sm text-slate-500">{d.descricao}</p>}
                  {d.conteudo && (
                    <div className="max-h-72 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
                      {d.conteudo}
                    </div>
                  )}
                  <p className="mt-3 text-xs text-slate-400">Atualizado em {formatDate(d.atualizadoEm)}</p>
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 px-5 py-4">
        <p className="text-sm text-slate-600">
          Os fluxos detalhados (pedido, design, produção, urgência) estão nos procedimentos.
        </p>
        <Link href="/pops" className="btn-outline flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> Ver POPs
        </Link>
      </div>
    </>
  );
}
