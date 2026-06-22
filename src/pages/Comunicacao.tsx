import { useStore } from "@/lib/store";
import { PageHeader, Card, CardHeader, CardBody, Badge, EmptyState } from "@/components/ui";
import { Megaphone, MessageSquare, Clock, CheckCircle2, GitBranch } from "lucide-react";

const PRINCIPIOS = [["Clareza", "Informação completa e objetiva."], ["Fluxo", "Toda comunicação respeita o processo."], ["Canal correto", "Cada demanda usa o canal adequado."]];
const CANAIS = [["Pedidos e demandas", "Canal oficial / formulário"], ["Urgências", "Canal exclusivo de urgência"], ["Dúvidas técnicas", "PCP / Design"], ["Produção", "Somente via PCP"], ["Decisões", "Dentro do fluxo / liderança"]];
const SLAS = [["Validação de pedido (PCP)", "até 24h"], ["Revisão técnica (Design)", "até 12h úteis"], ["Retorno sobre urgência", "até 4h úteis"]];

export function Comunicacao() {
  const { db } = useStore();
  const docs = db.documentos.filter((d) => d.categoria === "Comunicação");
  return (
    <>
      <PageHeader title="Comunicação Interna" description="Fluxos claros, menos ruído, mais resultado" />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PRINCIPIOS.map(([t, d]) => (
          <Card key={t}><CardBody className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand/10 text-brand"><CheckCircle2 className="h-5 w-5" /></span>
            <div><p className="font-semibold text-brand-ink">{t}</p><p className="mt-0.5 text-sm text-slate-500">{d}</p></div>
          </CardBody></Card>
        ))}
      </div>

      <Card className="mb-6 bg-brand-ink text-white">
        <CardBody className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-gold-200"><GitBranch className="h-4 w-4" /> Fluxo padrão</p>
          <div className="flex items-center gap-2">{["Comercial", "PCP", "Produção"].map((e, i) => <div key={e} className="flex items-center gap-2"><span className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold">{e}</span>{i < 2 && <span className="text-gold-200">→</span>}</div>)}</div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Canais oficiais" icon={<MessageSquare className="h-4 w-4" />} />
          <CardBody className="p-0"><table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
            {CANAIS.map(([t, c]) => <tr key={t}><td className="px-5 py-2.5 font-medium text-slate-700">{t}</td><td className="px-5 py-2.5 text-right text-slate-500">{c}</td></tr>)}
          </tbody></table></CardBody>
        </Card>
        <Card>
          <CardHeader title="Prazos de resposta (SLA)" icon={<Clock className="h-4 w-4" />} />
          <CardBody className="space-y-3">{SLAS.map(([t, p]) => <div key={t} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-2.5"><span className="text-sm text-slate-700">{t}</span><Badge variant="gold">{p}</Badge></div>)}</CardBody>
        </Card>
      </div>

      <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500"><Megaphone className="h-4 w-4 text-brand" /> Guias e planos (conteúdo completo)</h2>
      {docs.length === 0 ? <EmptyState title="Nenhum guia cadastrado" /> : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {docs.map((d) => (
            <Card key={d.id}><CardBody>
              <div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-semibold text-brand-ink">{d.titulo}</h3>{d.versao && <Badge variant="gold">v{d.versao}</Badge>}</div>
              {d.descricao && <p className="mb-3 text-sm text-slate-500">{d.descricao}</p>}
              <div className="max-h-80 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">{d.conteudo}</div>
            </CardBody></Card>
          ))}
        </div>
      )}
    </>
  );
}
