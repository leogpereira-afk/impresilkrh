import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { RichContent } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";

/**
 * @param comoAba  Sem o cabeçalho de página — a tela vira aba de Documentos
 *                 Institucionais. A rota /pops continua valendo para quem tem
 *                 o endereço salvo; o caminho novo é pelo menu Documentos,
 *                 porque item nenhum do menu levava aqui: os POPs estavam
 *                 publicados e invisíveis.
 */
export default function Pops({ comoAba = false }: { comoAba?: boolean } = {}) {
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
      {!comoAba && (
        <PageHeader
          title="Procedimentos (POPs)"
          description="Procedimentos Operacionais Padrão."
        >
          {pops.length > 0 && (
            <>
              <button className="btn-outline min-h-10 px-3 py-1.5 text-xs" onClick={expandirTodos}>
                Expandir todos
              </button>
              <button className="btn-ghost min-h-10 px-3 py-1.5 text-xs" onClick={recolherTodos}>
                Recolher todos
              </button>
            </>
          )}
        </PageHeader>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-[1_1_20rem] items-start gap-2 rounded-lg border border-slate-200/70 bg-white px-3 py-2">
          <ClipboardCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
          <p className="text-sm text-slate-700">
            <span className="font-medium">Todos os colaboradores devem ler e estar cientes dos POPs.</span>{" "}
            <span className="text-xs text-slate-500">Os procedimentos abaixo padronizam a execução e garantem qualidade e segurança.</span>
          </p>
        </div>
        {comoAba && pops.length > 0 && (
          <div className="ml-auto flex gap-2">
            <button className="btn-outline min-h-10 px-3 py-1.5 text-xs" onClick={expandirTodos}>Expandir todos</button>
            <button className="btn-ghost min-h-10 px-3 py-1.5 text-xs" onClick={recolherTodos}>Recolher todos</button>
          </div>
        )}
      </div>

      {pops.length === 0 ? (
        <EmptyState
          title="Nenhum POP cadastrado"
          description="Os procedimentos operacionais padrão aparecerão aqui."
          icon={<BookOpen className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-2">
          {pops.map((pop) => {
            const aberto = abertos.has(pop.id);
            return (
              <Card key={pop.id}>
                <button
                  type="button"
                  onClick={() => alternar(pop.id)}
                  aria-expanded={aberto}
                  aria-controls={`pop-corpo-${pop.id}`}
                  className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
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
