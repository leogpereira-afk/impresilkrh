import { exigirSessao } from "@/lib/auth";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { formatDate } from "@/lib/format";
import { CATEGORIAS_INSTITUCIONAL } from "@/lib/constants";
import { BookOpen, ScrollText, GraduationCap, HardHat, FileText } from "lucide-react";

const ICONE_CATEGORIA: Record<string, React.ComponentType<{ className?: string }>> = {
  "Código de Ética": ScrollText,
  POP: BookOpen,
  Treinamento: GraduationCap,
  SST: HardHat,
};

export default async function DocumentosPage() {
  await exigirSessao();
  const docs = await db.documentoInstitucional.findMany({
    orderBy: [{ categoria: "asc" }, { titulo: "asc" }],
  });

  return (
    <>
      <PageHeader
        title="Documentos Institucionais"
        description="Código de Ética, procedimentos operacionais, treinamentos e segurança do trabalho"
      />

      {docs.length === 0 ? (
        <EmptyState title="Nenhum documento institucional cadastrado" icon={<FileText className="h-8 w-8" />} />
      ) : (
        <div className="space-y-8">
          {CATEGORIAS_INSTITUCIONAL.map((cat) => {
            const lista = docs.filter((d) => d.categoria === cat);
            if (!lista.length) return null;
            const Icon = ICONE_CATEGORIA[cat] ?? FileText;
            return (
              <section key={cat}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                  <Icon className="h-4 w-4 text-brand" /> {cat}
                </h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {lista.map((d) => (
                    <Card key={d.id}>
                      <CardBody>
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-brand-ink">{d.titulo}</h3>
                          {d.versao && <Badge variant="gold">v{d.versao}</Badge>}
                        </div>
                        {d.descricao && <p className="mb-3 text-sm text-slate-500">{d.descricao}</p>}
                        {d.conteudo && (
                          <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">
                            {d.conteudo}
                          </div>
                        )}
                        <p className="mt-3 text-xs text-slate-400">
                          Atualizado em {formatDate(d.atualizadoEm)}
                        </p>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
