import { useMemo } from "react";
import { Megaphone, Compass, Radio, Timer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { RichContent } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";

const CANAIS: { rotulo: string; destino: string }[] = [
  { rotulo: "Pedidos", destino: "PCP" },
  { rotulo: "Urgências", destino: "canal de urgência" },
  { rotulo: "Decisões", destino: "registradas no fluxo" },
];

const SLAS: { rotulo: string; prazo: string }[] = [
  { rotulo: "Validação PCP", prazo: "24h" },
  { rotulo: "Revisão técnica", prazo: "12h úteis" },
  { rotulo: "Urgência", prazo: "4h úteis" },
];

export default function Comunicacao() {
  const { items } = useColecao("comunicacao");
  const guias = useMemo(() => [...items].sort((a, b) => a.ordem - b.ordem), [items]);

  return (
    <div>
      <PageHeader
        title="Comunicação Interna"
        description="Fluxos claros, menos ruído, mais resultado."
      />

      {/* Modelo operacional */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Compass className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800">Princípios</h3>
          </div>
          <p className="mt-3 text-sm text-slate-600">Clareza · Fluxo · Canal correto</p>
          <p className="mt-1 text-xs text-slate-400">
            Toda comunicação começa com objetivo claro, segue um fluxo definido e usa o canal certo.
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
              <Radio className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800">Canais oficiais</h3>
          </div>
          <ul className="mt-3 space-y-1.5">
            {CANAIS.map((c) => (
              <li key={c.rotulo} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="mt-px h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                <span className="font-medium text-slate-700">{c.rotulo}</span>
                <span className="text-slate-400">→</span>
                <span>{c.destino}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
              <Timer className="h-5 w-5" />
            </span>
            <h3 className="text-sm font-semibold text-slate-800">SLAs</h3>
          </div>
          <ul className="mt-3 space-y-1.5">
            {SLAS.map((s) => (
              <li key={s.rotulo} className="flex items-center justify-between gap-2 text-sm">
                <span className="text-slate-600">{s.rotulo}</span>
                <Badge variant="gold">{s.prazo}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Guias de comunicação */}
      {guias.length === 0 ? (
        <EmptyState
          title="Nenhum guia de comunicação cadastrado"
          description="Os guias de comunicação interna aparecerão aqui."
          icon={<Megaphone className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-6">
          {guias.map((guia) => (
            <Card key={guia.id}>
              <CardHeader
                title={guia.titulo}
                subtitle={guia.descricao}
                icon={<Megaphone className="h-[18px] w-[18px]" />}
                action={guia.versao ? <Badge variant="neutral">v{guia.versao}</Badge> : undefined}
              />
              <CardBody>
                <RichContent blocos={guia.blocos} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
