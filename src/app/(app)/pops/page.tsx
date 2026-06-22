import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { BookOpen, ChevronDown } from "lucide-react";

export default async function PopsPage() {
  await exigirSessao();
  const pops = await db.documentoInstitucional.findMany({
    where: { categoria: "POP" },
    orderBy: { titulo: "asc" },
  });

  return (
    <>
      <PageHeader
        title="POPs e Procedimentos"
        description="Procedimentos operacionais padrão — o passo a passo de como o trabalho flui"
      />

      {pops.length === 0 ? (
        <EmptyState title="Nenhum POP cadastrado" icon={<BookOpen className="h-8 w-8" />} />
      ) : (
        <div className="space-y-3">
          {pops.map((p) => (
            <Card key={p.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <div>
                      <h3 className="font-semibold text-brand-ink">{p.titulo}</h3>
                      {p.descricao && <p className="text-sm text-slate-500">{p.descricao}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.versao && <Badge variant="gold">v{p.versao}</Badge>}
                    <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                  </div>
                </summary>
                {p.conteudo && (
                  <CardBody className="border-t border-slate-100 pt-4">
                    <div className="whitespace-pre-line text-sm leading-relaxed text-slate-600">
                      {p.conteudo}
                    </div>
                    <p className="mt-4 text-xs text-slate-400">Atualizado em {formatDate(p.atualizadoEm)}</p>
                  </CardBody>
                )}
              </details>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
