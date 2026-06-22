import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { RichContent } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";

export default function Pops() {
  const { items } = useColecao("pops");
  const pops = useMemo(() => [...items].sort((a, b) => a.ordem - b.ordem), [items]);

  // Por padrão, o primeiro POP fica expandido e os demais recolhidos.
  const [abertos, setAbertos] = useState<Set<string>>(
    () => new Set(pops.length > 0 ? [pops[0].id] : []),
  );

  const alternar = (id: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });

  const expandirTodos = () => setAbertos(new Set(pops.map((p) => p.id)));
  const recolherTodos = () => setAbertos(new Set());

  return (
    <div>
      <PageHeader
        title="POPs e Procedimentos"
        description="Procedimentos Operacionais Padrão."
      >
        {pops.length > 0 && (
          <>
            <button className="btn-outline px-3 py-1.5 text-xs" onClick={expandirTodos}>
              Expandir todos
            </button>
            <button className="btn-ghost px-3 py-1.5 text-xs" onClick={recolherTodos}>
              Recolher todos
            </button>
          </>
        )}
      </PageHeader>

      <Card className="mb-6">
        <CardBody className="flex items-start gap-3 p-5">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            <ClipboardCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-medium text-slate-700">
              Todos os colaboradores devem ler e estar cientes dos POPs.
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Os procedimentos abaixo padronizam a execução e garantem qualidade e segurança.
            </p>
          </div>
        </CardBody>
      </Card>

      {pops.length === 0 ? (
        <EmptyState
          title="Nenhum POP cadastrado"
          description="Os procedimentos operacionais padrão aparecerão aqui."
          icon={<BookOpen className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {pops.map((pop) => {
            const aberto = abertos.has(pop.id);
            return (
              <Card key={pop.id}>
                <button
                  type="button"
                  onClick={() => alternar(pop.id)}
                  aria-expanded={aberto}
                  aria-controls={`pop-corpo-${pop.id}`}
                  className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 text-brand">
                      <BookOpen className="h-[18px] w-[18px]" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-800">{pop.titulo}</h3>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {pop.sla && <Badge variant="gold">SLA {pop.sla}</Badge>}
                    {pop.versao && <Badge variant="neutral">v{pop.versao}</Badge>}
                    <ChevronDown
                      className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
                        aberto ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </div>
                </button>
                {aberto && (
                  <CardBody className="border-t border-slate-100">
                    {pop.descricao && (
                      <p className="mb-4 text-xs text-slate-500">{pop.descricao}</p>
                    )}
                    <RichContent blocos={pop.blocos} />
                  </CardBody>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
