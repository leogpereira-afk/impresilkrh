import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileText, ShieldCheck, FolderOpen, Upload, ExternalLink, Download, Plus, Trash2, Search,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { RichContent } from "@/components/ui/rich";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import type { DocumentoInstitucional, ArquivoRepositorio } from "@/data/types";

export default function Documentos() {
  return (
    <div>
      <PageHeader
        title="Documentos"
        description="Políticas, código de ética, materiais oficiais e repositório institucional."
      />

      <Tabs
        abas={[
          {
            id: "institucionais",
            label: "Documentos Institucionais",
            icon: <FileText className="h-4 w-4" />,
            conteudo: <DocumentosInstitucionais />,
          },
          {
            id: "repositorio",
            label: "Repositório",
            icon: <FolderOpen className="h-4 w-4" />,
            conteudo: <Repositorio />,
          },
        ]}
      />
    </div>
  );
}

/* ============================ Documentos Institucionais ============================ */
/* Conteúdo institucional original — preservado integralmente.                        */

function DocumentosInstitucionais() {
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

  if (grupos.length === 0) {
    return (
      <EmptyState
        title="Nenhum documento institucional cadastrado"
        description="Os documentos oficiais da empresa aparecerão aqui."
        icon={<FileText className="h-8 w-8" />}
      />
    );
  }

  return (
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

/* ============================ Repositório (Módulo G) ============================ */

const CATEGORIAS_REPOSITORIO = [
  "Política",
  "Manual",
  "Formulário",
  "Comunicado",
  "Outro",
] as const;

const VARIANTE_CATEGORIA: Record<string, "info" | "gold" | "success" | "warning" | "neutral"> = {
  Política: "info",
  Manual: "gold",
  Formulário: "success",
  Comunicado: "warning",
  Outro: "neutral",
};

function formatarBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Dispara o download de um arquivo (data URL) criando um <a> temporário.
function baixar(dataUrl: string, nome: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function Repositorio() {
  const sessao = useSessao();
  const toast = useToast();
  const podeGerir = ehRH(sessao);
  const { items, criar, remover } = useColecao("repositorio");
  const [busca, setBusca] = useState("");
  const [novo, setNovo] = useState(false);
  const [excluir, setExcluir] = useState<ArquivoRepositorio | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (a) =>
        a.nome.toLowerCase().includes(q) ||
        a.categoria.toLowerCase().includes(q),
    );
  }, [items, busca]);

  // Agrupa por categoria, preservando a ordem das 5 categorias conhecidas e
  // anexando ao final eventuais categorias fora da lista.
  const grupos = useMemo(() => {
    const mapa = new Map<string, ArquivoRepositorio[]>();
    for (const a of filtrados) {
      const arr = mapa.get(a.categoria) ?? [];
      arr.push(a);
      mapa.set(a.categoria, arr);
    }
    const ordem = [
      ...CATEGORIAS_REPOSITORIO,
      ...[...mapa.keys()].filter((k) => !CATEGORIAS_REPOSITORIO.includes(k as never)),
    ];
    return ordem
      .filter((cat) => mapa.has(cat))
      .map((categoria) => ({
        categoria,
        arquivos: [...(mapa.get(categoria) ?? [])].sort((a, b) =>
          a.nome.localeCompare(b.nome, "pt-BR"),
        ),
      }));
  }, [filtrados]);

  const porCategoria = useMemo(() => {
    const c = new Map<string, number>();
    for (const a of items) c.set(a.categoria, (c.get(a.categoria) ?? 0) + 1);
    return c;
  }, [items]);

  const totalCategorias = porCategoria.size;
  const comArquivo = items.filter((a) => !!a.arquivoDataUrl).length;

  const abrir = (dataUrl?: string | null) => {
    if (!dataUrl) {
      toast("Este documento não possui arquivo anexado.", "info");
      return;
    }
    const w = window.open();
    if (w) {
      w.document.write(
        `<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`,
      );
    }
  };

  const baixarArquivo = (arq: ArquivoRepositorio) => {
    if (!arq.arquivoDataUrl) {
      toast("Este documento não possui arquivo anexado.", "info");
      return;
    }
    baixar(arq.arquivoDataUrl, arq.arquivoNome ?? arq.nome);
  };

  const confirmarExclusao = () => {
    if (!excluir) return;
    remover(excluir.id);
    toast("Documento removido do repositório.");
    setExcluir(null);
  };

  return (
    <div className="space-y-6">
      {/* Resumo */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total de documentos"
          value={items.length}
          icon={<FolderOpen className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Categorias"
          value={totalCategorias}
          hint="Tipos de documento ativos"
          icon={<FileText className="h-5 w-5" />}
          accent="gold"
        />
        <StatCard
          label="Com arquivo anexado"
          value={comArquivo}
          hint={`${items.length - comArquivo} sem anexo`}
          icon={<Upload className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Maior categoria"
          value={
            porCategoria.size
              ? [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0][0]
              : "—"
          }
          hint={
            porCategoria.size
              ? `${[...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0][1]} documento(s)`
              : undefined
          }
          icon={<FileText className="h-5 w-5" />}
          accent="blue"
        />
      </div>

      {/* Barra de ações */}
      <Card>
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome ou categoria…"
              className="pl-9"
            />
          </div>
          {podeGerir && (
            <button className="btn-primary shrink-0" onClick={() => setNovo(true)}>
              <Plus className="h-4 w-4" /> Adicionar documento
            </button>
          )}
        </CardBody>
      </Card>

      {/* Listagem por categoria */}
      {grupos.length === 0 ? (
        <EmptyState
          title={busca ? "Nenhum documento encontrado" : "Repositório vazio"}
          description={
            busca
              ? "Tente ajustar os termos da busca."
              : "Os documentos institucionais aparecerão aqui."
          }
          icon={<FolderOpen className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-8">
          {grupos.map((grupo) => (
            <section key={grupo.categoria}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-brand">
                <span className="h-3 w-0.5 rounded-full bg-gold" />
                {grupo.categoria}
                <Badge variant="neutral">{grupo.arquivos.length}</Badge>
              </h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {grupo.arquivos.map((arq) => (
                  <ArquivoCard
                    key={arq.id}
                    arq={arq}
                    podeGerir={podeGerir}
                    onAbrir={() => abrir(arq.arquivoDataUrl)}
                    onBaixar={() => baixarArquivo(arq)}
                    onExcluir={() => setExcluir(arq)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {novo && (
        <NovoArquivoModal
          aberto={novo}
          onFechar={() => setNovo(false)}
          onCriar={criar}
        />
      )}
      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={confirmarExclusao}
        titulo="Remover documento"
        mensagem={
          <>
            Tem certeza que deseja remover{" "}
            <strong>{excluir?.nome}</strong> do repositório? Esta ação não pode ser
            desfeita.
          </>
        }
      />
    </div>
  );
}

function ArquivoCard({
  arq,
  podeGerir,
  onAbrir,
  onBaixar,
  onExcluir,
}: {
  arq: ArquivoRepositorio;
  podeGerir: boolean;
  onAbrir: () => void;
  onBaixar: () => void;
  onExcluir: () => void;
}) {
  const temArquivo = !!arq.arquivoDataUrl;
  return (
    <Card>
      <CardBody className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
          <FileText className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-800">{arq.nome}</h3>
            <Badge variant={VARIANTE_CATEGORIA[arq.categoria] ?? "neutral"}>
              {arq.categoria}
            </Badge>
          </div>
          {arq.descricao && (
            <p className="mt-1 text-xs text-slate-500">{arq.descricao}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
            <span>Adicionado em {formatDate(arq.criadoEm)}</span>
            {temArquivo && arq.arquivoNome && (
              <span className="truncate">
                {arq.arquivoNome} · {formatarBytes(arq.tamanhoBytes)}
              </span>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {temArquivo ? (
              <>
                <button className="btn-outline" onClick={onAbrir}>
                  <ExternalLink className="h-4 w-4" /> Abrir arquivo
                </button>
                <button className="btn-outline" onClick={onBaixar}>
                  <Download className="h-4 w-4" /> Baixar
                </button>
              </>
            ) : (
              <span className="text-xs italic text-slate-400">Sem arquivo anexado</span>
            )}
          </div>
        </div>
        {podeGerir && (
          <button
            className="btn-ghost shrink-0 p-1.5 text-slate-400 hover:text-red-600"
            onClick={onExcluir}
            aria-label="Remover documento"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </CardBody>
    </Card>
  );
}

function NovoArquivoModal({
  aberto,
  onFechar,
  onCriar,
}: {
  aberto: boolean;
  onFechar: () => void;
  onCriar: (item: Partial<ArquivoRepositorio>) => void;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [nome, setNome] = useState("");
  const [categoria, setCategoria] = useState<string>(CATEGORIAS_REPOSITORIO[0]);
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string; tamanho: number } | null>(
    null,
  );

  const onFile = (f: File) => {
    if (f.size > 2 * 1024 * 1024) {
      toast("Arquivo acima de 2 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setArquivo({ nome: f.name, dataUrl: String(reader.result), tamanho: f.size });
    reader.readAsDataURL(f);
  };

  const salvar = () => {
    if (!nome.trim()) return toast("Informe o nome do documento.", "erro");
    onCriar({
      nome: nome.trim(),
      categoria,
      descricao: descricao.trim() || undefined,
      arquivoNome: arquivo?.nome ?? null,
      arquivoDataUrl: arquivo?.dataUrl ?? null,
      tamanhoBytes: arquivo?.tamanho ?? null,
      criadoEm: new Date().toISOString(),
    });
    toast("Documento adicionado ao repositório.");
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Adicionar documento"
      descricao="O arquivo é guardado no navegador (até 2 MB) e abre em nova aba."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={salvar}>
            Adicionar
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Campo label="Nome do documento" obrigatorio>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Política de Home Office"
          />
        </Campo>
        <Campo label="Categoria">
          <Select value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {CATEGORIAS_REPOSITORIO.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </Select>
        </Campo>
        <Campo label="Descrição">
          <Input
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Breve descrição do conteúdo (opcional)"
          />
        </Campo>
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button className="btn-outline w-full" onClick={() => fileRef.current?.click()}>
            <Upload className="h-4 w-4" />{" "}
            {arquivo ? arquivo.nome : "Selecionar arquivo (≤ 2 MB)"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
