// ============================================================================
// O que abre quando se expande uma linha de férias: observações e documentação.
//
// POR QUE AQUI E NÃO EM DOCUMENTOS: o aviso de férias, o recibo e o acordo de
// abono são procurados no momento em que se olha o período — não numa lista
// geral de documentos da pessoa. Mas o arquivo continua sendo UM só: é gravado
// na coleção `documentos` com a categoria "Férias", então aparece igualmente na
// ficha do colaborador e na tela de Documentos. Guardar um anexo paralelo só
// para esta aba criaria duas verdades sobre o mesmo papel.
//
// A observação vai no próprio registro de férias (campo `observacao`, que já
// existia no tipo e nunca teve campo na tela — só era preenchido sozinho quando
// havia abono vendido).
// ============================================================================
import { useEffect, useState } from "react";
import { AlertTriangle, FileText, Paperclip, Plus, Save, Trash2 } from "lucide-react";
import { Tabs } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Campo, Input } from "@/components/ui/form";
import { ConfirmDialog } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { registrarAcesso } from "@/lib/lgpd";
import { putBlob, getBlob, delBlob } from "@/lib/blobstore";
import { enviarArquivoNuvem, buscarArquivoNuvem } from "@/lib/sync";
import { abrirAnexoEmNovaAba } from "@/lib/abrirArquivo";
import { formatDate } from "@/lib/format";
import { CATEGORIA_DOC_FERIAS } from "@/lib/constants";
import type { Documento, Ferias } from "@/data/types";

const MAX_BYTES = 10 * 1024 * 1024;

function tamanho(bytes?: number | null): string {
  if (!bytes) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

// ------------------------------ observações ---------------------------------

function AbaObservacoes({
  ferias,
  podeEditar,
  avisoStatus,
}: {
  ferias: Ferias;
  podeEditar: boolean;
  avisoStatus: string | null;
}) {
  const toast = useToast();
  const { atualizar } = useColecao("ferias");
  const guardado = ferias.observacao ?? "";
  const [texto, setTexto] = useState(guardado);

  /* Recarrega quando o registro muda por fora (outra aba, sincronização) OU
     quando o painel é reaberto em outra linha. Sem isto, o componente montado
     uma vez guardava o texto da primeira pessoa aberta. */
  useEffect(() => setTexto(guardado), [ferias.id, guardado]);

  const sujo = texto !== guardado;

  const salvar = () => {
    // Grava SÓ este campo. Escrever o registro inteiro por cima apagaria o que
    // outra tela (ou a sincronização) tivesse mudado enquanto o painel estava
    // aberto — foi assim que já se perdeu trabalho aqui.
    atualizar(ferias.id, { observacao: texto.trim() || null });
    toast("Observação salva.");
  };

  return (
    <div className="space-y-3">
      {avisoStatus && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{avisoStatus} Confira o status no lápis de edição.</span>
        </p>
      )}
      {podeEditar ? (
        <>
          <Campo
            label="Observações"
            hint="Fica só neste período de férias. Ex.: antecipada a pedido, 10 dias vendidos, retorno adiado."
          >
            <textarea
              className="input min-h-[96px] resize-y"
              value={texto}
              maxLength={2000}
              placeholder="Nada registrado até aqui."
              onChange={(e) => setTexto(e.target.value)}
            />
          </Campo>
          <div className="flex items-center gap-3">
            <button className="btn-primary" onClick={salvar} disabled={!sujo}>
              <Save className="h-4 w-4" /> Salvar observação
            </button>
            {sujo && <span className="text-xs text-amber-600">Há alteração não salva.</span>}
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap text-sm text-slate-600">
          {guardado || <span className="text-slate-400">Nada registrado até aqui.</span>}
        </p>
      )}
    </div>
  );
}

// ----------------------------- documentação ---------------------------------

function AbaDocumentos({
  colaboradorId,
  nome,
  podeEditar,
}: {
  colaboradorId: string;
  nome: string;
  podeEditar: boolean;
}) {
  const toast = useToast();
  const sessao = useSessao();
  const d = useDominio();
  const { items, criar, atualizar, remover } = useColecao("documentos");
  const docs = items.filter(
    (doc) => doc.colaboradorId === colaboradorId && doc.categoria === CATEGORIA_DOC_FERIAS,
  );

  const [anexando, setAnexando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string; tamanho: number } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState<Documento | null>(null);

  const limpar = () => {
    setAnexando(false);
    setTitulo("");
    setArquivo(null);
  };

  const lerArquivo = (f: File) => {
    if (f.size > MAX_BYTES) {
      toast("Arquivo acima de 10 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    setLendo(true);
    const reader = new FileReader();
    reader.onload = () => {
      setArquivo({ nome: f.name, dataUrl: String(reader.result), tamanho: f.size });
      setLendo(false);
    };
    reader.onerror = () => {
      setLendo(false);
      toast("Não foi possível ler o arquivo. Tente novamente.", "erro");
    };
    reader.readAsDataURL(f);
  };

  const salvar = async () => {
    if (!titulo.trim()) return toast("Dê um nome ao documento.", "erro");
    if (lendo) return toast("Aguarde o anexo terminar de carregar.", "info");
    setSalvando(true);
    try {
      const rec = criar({
        colaboradorId,
        categoria: CATEGORIA_DOC_FERIAS,
        nome: titulo.trim(),
        arquivoNome: arquivo?.nome ?? null,
        tamanhoBytes: arquivo?.tamanho ?? null,
        arquivoDataUrl: null,
        arquivoEmBlob: false,
        enviadoPor: "RH",
        criadoEm: new Date().toISOString(),
      });
      if (arquivo) {
        const ok = await putBlob(`doc:${rec.id}`, arquivo.dataUrl);
        if (ok) {
          // Marca o blob ANTES de enviar à nuvem: fechar a aba no meio de um
          // upload lento deixava o arquivo gravado aqui e o registro dizendo
          // que não tinha anexo.
          atualizar(rec.id, { arquivoEmBlob: true });
          const subiu = await enviarArquivoNuvem(`doc:${rec.id}`, arquivo.dataUrl);
          atualizar(rec.id, { arquivoNaNuvem: subiu });
          if (!subiu) {
            toast("Anexo salvo neste computador; sobe para a nuvem quando houver internet.", "info");
          }
        } else if (arquivo.dataUrl.length < 1_200_000) {
          atualizar(rec.id, { arquivoDataUrl: arquivo.dataUrl }); // fallback p/ arquivo pequeno
        } else {
          toast("Não foi possível guardar o arquivo. O registro ficou sem anexo.", "erro");
        }
      }
      toast("Documento de férias anexado.");
      limpar();
    } finally {
      setSalvando(false);
    }
  };

  const abrir = (doc: Documento) => {
    // Abrir anexo de OUTRA pessoa é acesso a dado sensível: fica na trilha LGPD,
    // igual à ficha do colaborador.
    if (sessao && sessao.colaboradorId !== colaboradorId) {
      registrarAcesso(sessao, d.colabById.get(sessao.colaboradorId)?.nome ?? "Usuário", {
        acao: "VISUALIZAR_DADOS_SENSIVEIS",
        recurso: `Colaborador:Documento:${doc.nome}`,
        colaboradorId,
        detalhe: nome,
      });
    }
    // window.open PRECISA sair dentro do gesto do clique — por isso quem baixa
    // é o callback, e não um await antes de abrir a janela.
    void abrirAnexoEmNovaAba(
      async () => {
        if (!doc.arquivoEmBlob) return doc.arquivoDataUrl ?? null;
        const local = await getBlob(`doc:${doc.id}`);
        if (local) return local;
        const daNuvem = await buscarArquivoNuvem(`doc:${doc.id}`);
        if (daNuvem) void putBlob(`doc:${doc.id}`, daNuvem);
        return daNuvem;
      },
      (m) => toast(m, "erro"),
      doc.nome,
    );
  };

  const confirmarExclusao = async () => {
    if (!excluindo) return;
    const alvo = excluindo;
    setExcluindo(null);
    if (alvo.arquivoEmBlob) await delBlob(`doc:${alvo.id}`);
    remover(alvo.id);
    toast("Documento excluído.");
  };

  return (
    <div className="space-y-3">
      {docs.length === 0 && !anexando ? (
        <EmptyState
          title="Sem documentação de férias"
          description="Aviso de férias, recibo e acordo de abono ficam aqui — e também aparecem na ficha do colaborador."
          icon={<FileText className="h-8 w-8" />}
        />
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {docs.map((doc) => (
            <li key={doc.id} className="flex items-center gap-3 px-3 py-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{doc.nome}</p>
                <p className="truncate text-xs text-slate-400">
                  {formatDate(doc.criadoEm)}
                  {doc.arquivoNome ? ` · ${doc.arquivoNome}` : " · sem arquivo anexado"}
                  {doc.tamanhoBytes ? ` · ${tamanho(doc.tamanhoBytes)}` : ""}
                </p>
              </div>
              {doc.arquivoNaNuvem === false && doc.arquivoEmBlob && (
                <span title="O arquivo ainda não subiu para a nuvem: por enquanto só abre neste computador.">
                  <Badge variant="warning">só neste PC</Badge>
                </span>
              )}
              {(doc.arquivoEmBlob || doc.arquivoDataUrl) && (
                <button className="btn-outline px-2 py-1 text-xs" onClick={() => abrir(doc)}>
                  Abrir
                </button>
              )}
              {podeEditar && (
                <button
                  className="btn-ghost p-1.5 text-red-500 hover:text-red-600"
                  title="Excluir documento"
                  aria-label={`Excluir ${doc.nome}`}
                  onClick={() => setExcluindo(doc)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar &&
        (anexando ? (
          <div className="space-y-3 rounded-lg border border-slate-200 p-3">
            <Campo label="Nome do documento" obrigatorio>
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ex.: Aviso de férias assinado"
              />
            </Campo>
            <Campo label="Arquivo" hint="Até 10 MB. Guardado neste navegador e enviado para a nuvem.">
              <input
                type="file"
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) lerArquivo(f);
                }}
              />
            </Campo>
            {arquivo && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500">
                <Paperclip className="h-3.5 w-3.5" />
                {arquivo.nome} · {tamanho(arquivo.tamanho)}
              </p>
            )}
            <div className="flex gap-2">
              <button className="btn-primary" onClick={salvar} disabled={salvando || lendo}>
                {salvando ? "Anexando…" : "Anexar"}
              </button>
              <button className="btn-outline" onClick={limpar} disabled={salvando}>
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button className="btn-outline" onClick={() => setAnexando(true)}>
            <Plus className="h-4 w-4" /> Anexar documento
          </button>
        ))}

      <ConfirmDialog
        aberto={!!excluindo}
        onFechar={() => setExcluindo(null)}
        onConfirmar={confirmarExclusao}
        titulo="Excluir documento"
        mensagem={
          excluindo ? (
            <>
              Excluir <span className="font-medium text-slate-700">{excluindo.nome}</span> de {nome}? O arquivo
              anexado também é apagado. Esta ação não pode ser desfeita.
            </>
          ) : (
            ""
          )
        }
      />
    </div>
  );
}

// --------------------------------- painel -----------------------------------

export function DetalheFerias({
  ferias,
  nome,
  podeEditar,
  avisoStatus,
}: {
  ferias: Ferias;
  nome: string;
  podeEditar: boolean;
  avisoStatus: string | null;
}) {
  return (
    <Tabs
      // A aba escolhida é lembrada na sessão: quem está conferindo recibo de
      // várias pessoas seguidas não quer clicar em "Documentação" toda vez.
      idPersistencia="ferias-detalhe"
      abas={[
        {
          id: "observacoes",
          label: "Observações",
          icon: <FileText className="h-4 w-4" />,
          conteudo: <AbaObservacoes ferias={ferias} podeEditar={podeEditar} avisoStatus={avisoStatus} />,
        },
        {
          id: "documentos",
          label: "Documentação",
          icon: <Paperclip className="h-4 w-4" />,
          conteudo: (
            <AbaDocumentos colaboradorId={ferias.colaboradorId} nome={nome} podeEditar={podeEditar} />
          ),
        },
      ]}
    />
  );
}
