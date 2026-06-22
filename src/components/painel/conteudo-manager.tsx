import { useState } from "react";
import { Plus, Pencil, Trash2, FileText } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { BlockEditor } from "@/components/ui/rich";
import { useColecao } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { CATEGORIAS_INSTITUCIONAL } from "@/lib/constants";
import type { Bloco } from "@/data/types";

type Colecao = "pops" | "comunicacao" | "institucionais";

interface ItemConteudo {
  id: string;
  titulo: string;
  descricao?: string;
  versao?: string;
  sla?: string;
  categoria?: string;
  blocos?: Bloco[];
  conteudo?: string;
  ordem?: number;
  atualizadoEm?: string;
}

export function ConteudoManager({
  colecao,
  titulo,
  subtitulo,
  comSla = false,
  comCategoria = false,
}: {
  colecao: Colecao;
  titulo: string;
  subtitulo: string;
  comSla?: boolean;
  comCategoria?: boolean;
}) {
  const toast = useToast();
  const { items, criar, atualizar, remover } = useColecao(colecao);
  const [editando, setEditando] = useState<ItemConteudo | null>(null);
  const [novo, setNovo] = useState(false);
  const [excluir, setExcluir] = useState<ItemConteudo | null>(null);

  const lista = [...(items as ItemConteudo[])].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));

  return (
    <Card>
      <CardHeader
        title={titulo}
        subtitle={subtitulo}
        icon={<FileText className="h-[18px] w-[18px]" />}
        action={<button className="btn-outline" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo</button>}
      />
      <CardBody>
        {lista.length === 0 ? (
          <EmptyState title="Nenhum conteúdo" />
        ) : (
          <div className="divide-y divide-slate-100">
            {lista.map((it) => (
              <div key={it.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-slate-800">{it.titulo}</p>
                    {it.versao && <Badge variant="neutral">v{it.versao}</Badge>}
                    {it.categoria && <Badge variant="info">{it.categoria}</Badge>}
                    {it.sla && <Badge variant="gold">SLA {it.sla}</Badge>}
                  </div>
                  {it.descricao && <p className="mt-0.5 truncate text-xs text-slate-500">{it.descricao}</p>}
                  <p className="mt-0.5 text-[11px] text-slate-400">Atualizado em {formatDate(it.atualizadoEm)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button className="btn-ghost p-1.5" onClick={() => setEditando(it)}><Pencil className="h-4 w-4" /></button>
                  <button className="btn-ghost p-1.5 text-red-500" onClick={() => setExcluir(it)}><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>

      {(novo || editando) && (
        <EditorConteudo
          item={editando}
          comSla={comSla}
          comCategoria={comCategoria}
          onFechar={() => {
            setNovo(false);
            setEditando(null);
          }}
          onSalvar={(dados) => {
            if (editando) {
              atualizar(editando.id, dados);
              toast("Conteúdo atualizado.");
            } else {
              criar({ ...dados, ordem: lista.length + 1 });
              toast("Conteúdo criado.");
            }
            setNovo(false);
            setEditando(null);
          }}
        />
      )}

      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => {
          if (excluir) {
            remover(excluir.id);
            toast("Conteúdo excluído.");
          }
        }}
        titulo="Excluir conteúdo?"
        mensagem={`"${excluir?.titulo}" será removido permanentemente.`}
      />
    </Card>
  );
}

function EditorConteudo({
  item,
  comSla,
  comCategoria,
  onFechar,
  onSalvar,
}: {
  item: ItemConteudo | null;
  comSla: boolean;
  comCategoria: boolean;
  onFechar: () => void;
  onSalvar: (dados: Partial<ItemConteudo>) => void;
}) {
  const [titulo, setTitulo] = useState(item?.titulo ?? "");
  const [descricao, setDescricao] = useState(item?.descricao ?? "");
  const [versao, setVersao] = useState(item?.versao ?? "1.0");
  const [sla, setSla] = useState(item?.sla ?? "");
  const [categoria, setCategoria] = useState(item?.categoria ?? "POP");
  const [blocos, setBlocos] = useState<Bloco[]>(
    item?.blocos ?? (item?.conteudo ? [{ tipo: "paragrafo", texto: item.conteudo }] : []),
  );

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={item ? "Editar conteúdo" : "Novo conteúdo"}
      descricao="Editor de texto rico (títulos, listas, passos)."
      largura="max-w-3xl"
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button
            className="btn-primary"
            onClick={() =>
              onSalvar({
                titulo,
                descricao,
                versao,
                ...(comSla ? { sla } : {}),
                ...(comCategoria ? { categoria } : {}),
                blocos,
                conteudo: undefined,
                atualizadoEm: new Date().toISOString(),
              })
            }
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Título" obrigatorio><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Campo>
        <Campo label="Descrição"><Input value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Versão"><Input value={versao} onChange={(e) => setVersao(e.target.value)} /></Campo>
          {comSla && <Campo label="SLA"><Input value={sla} onChange={(e) => setSla(e.target.value)} placeholder="ex.: 24h" /></Campo>}
          {comCategoria && (
            <Campo label="Categoria">
              <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                {CATEGORIAS_INSTITUCIONAL.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Campo>
          )}
        </div>
        <div>
          <span className="label">Conteúdo</span>
          <BlockEditor blocos={blocos} onChange={setBlocos} />
        </div>
      </div>
    </Modal>
  );
}
