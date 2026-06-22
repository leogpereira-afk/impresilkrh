import { useMemo } from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { RichContent } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";
import { formatDate } from "@/lib/format";
import type { DocumentoInstitucional } from "@/data/types";

export default function Documentos() {
  const { items } = useColecao("institucionais");

  // Documentos institucionais (SST tem página própria — excluído aqui).
  const grupos = useMemo(() => {
    const visiveis = items.filter((d) => d.categoria !== "SST");
    const mapa = new Map<string, DocumentoInstitucional[]>();
    for (const d of visiveis) {
      const arr = mapa.get(d.categoria) ?? [];
      arr.push(d);
      mapa.set(d.categoria, arr);
    }
    return [...mapa.entries()]
      .map(([categoria, docs]) => ({
        categoria,
        docs: [...docs].sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR")),
      }))
      .sort((a, b) => a.categoria.localeCompare(b.categoria, "pt-BR"));
  }, [items]);

  return (
    <div>
      <PageHeader
        title="Documentos Institucionais"
        description="Políticas, código de ética e materiais oficiais da empresa."
      />

      {grupos.length === 0 ? (
        <EmptyState
          title="Nenhum documento institucional cadastrado"
          description="Os documentos oficiais da empresa aparecerão aqui."
          icon={<FileText className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => (
            <section key={grupo.categoria}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand">
                <span className="h-3 w-0.5 rounded-full bg-gold" />
                {grupo.categoria}
              </h2>
              <div className="space-y-6">
                {grupo.docs.map((doc) => (
                  <DocumentoCard key={doc.id} doc={doc} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentoCard({ doc }: { doc: DocumentoInstitucional }) {
  const ehEtica = doc.categoria === "Código de Ética";
  return (
    <Card>
      <CardHeader
        title={doc.titulo}
        subtitle={doc.descricao}
        icon={
          ehEtica ? (
            <ShieldCheck className="h-[18px] w-[18px]" />
          ) : (
            <FileText className="h-[18px] w-[18px]" />
          )
        }
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Badge variant="info">{doc.categoria}</Badge>
            {doc.versao && <Badge variant="neutral">v{doc.versao}</Badge>}
            <span className="text-xs text-slate-400">
              Atualizado em {formatDate(doc.atualizadoEm)}
            </span>
          </div>
        }
      />
      <CardBody>
        {doc.blocos?.length ? (
          <RichContent blocos={doc.blocos} />
        ) : (
          <p className="text-sm text-slate-600 whitespace-pre-line">{doc.conteudo}</p>
        )}

        {ehEtica && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <Link to="/aceites" className="btn-outline">
              <ShieldCheck className="h-4 w-4" /> Ir para aceite eletrônico
            </Link>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
