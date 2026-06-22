import { useMemo } from "react";
import { BookOpen, ClipboardCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { RichContent } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";

export default function Pops() {
  const { items } = useColecao("pops");
  const pops = useMemo(() => [...items].sort((a, b) => a.ordem - b.ordem), [items]);

  return (
    <div>
      <PageHeader
        title="POPs e Procedimentos"
        description="Procedimentos Operacionais Padrão."
      />

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
        <div className="space-y-6">
          {pops.map((pop) => (
            <Card key={pop.id}>
              <CardHeader
                title={pop.titulo}
                subtitle={pop.descricao}
                icon={<BookOpen className="h-[18px] w-[18px]" />}
                action={
                  <div className="flex items-center gap-2">
                    {pop.sla && <Badge variant="gold">SLA {pop.sla}</Badge>}
                    {pop.versao && <Badge variant="neutral">v{pop.versao}</Badge>}
                  </div>
                }
              />
              <CardBody>
                <RichContent blocos={pop.blocos} />
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
