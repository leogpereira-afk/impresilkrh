import { useStore } from "@/lib/store";
import { PageHeader, Card, CardBody, Badge, EmptyState } from "@/components/ui";
import { FileText, ScrollText, BookOpen, Megaphone, HardHat } from "lucide-react";

const CATS = ["Código de Ética", "POP", "Comunicação", "SST"];
const ICON: Record<string, any> = { "Código de Ética": ScrollText, POP: BookOpen, Comunicação: Megaphone, SST: HardHat };

export function Documentos() {
  const { db } = useStore();
  return (
    <>
      <PageHeader title="Documentos Institucionais" description="Código de Ética, POPs, Comunicação e SST" />
      {db.documentos.length === 0 ? <EmptyState title="Nenhum documento" icon={<FileText className="h-8 w-8" />} /> : (
        <div className="space-y-8">
          {CATS.map((cat) => {
            const lista = db.documentos.filter((d) => d.categoria === cat);
            if (!lista.length) return null;
            const Icon = ICON[cat] ?? FileText;
            return (
              <section key={cat}>
                <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500"><Icon className="h-4 w-4 text-brand" /> {cat}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {lista.map((d) => (
                    <Card key={d.id}><CardBody>
                      <div className="mb-2 flex items-start justify-between gap-2"><h3 className="font-semibold text-brand-ink">{d.titulo}</h3>{d.versao && <Badge variant="gold">v{d.versao}</Badge>}</div>
                      {d.descricao && <p className="mb-3 text-sm text-slate-500">{d.descricao}</p>}
                      <div className="max-h-64 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm leading-relaxed text-slate-600">{d.conteudo}</div>
                    </CardBody></Card>
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
