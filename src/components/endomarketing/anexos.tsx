import { useState } from "react";
import type { AnexoEndo } from "@/data/endomarketing";
import { getBlob, putBlob } from "@/lib/blobstore";
import { enviarArquivoNuvem, buscarArquivoNuvem } from "@/lib/sync";
import { abrirAnexoEmNovaAba } from "@/lib/abrirArquivo";
import { useToast } from "@/components/ui/toast";

export function validarArquivoEndo(file: Pick<File, "name" | "size">): string | null {
  if (file.size > 10 * 1024 * 1024) return "Escolha um arquivo de até 10 MB.";
  if (!/\.(pdf|png|jpe?g|webp|docx|xlsx)$/i.test(file.name)) return "Use PDF, imagem (JPG, PNG, WebP), DOCX ou XLSX.";
  return null;
}
const ler = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
  reader.readAsDataURL(file);
});
export function AnexosEndo({ anexos, onChange, onBusy }: { anexos: AnexoEndo[]; onChange?: (anexos: AnexoEndo[]) => void; onBusy?: (busy: boolean) => void }) {
  const toast = useToast();
  const [ocupado, setOcupado] = useState(false);
  const trabalhar = async (tarefa: () => Promise<void>) => {
    setOcupado(true); onBusy?.(true);
    try { await tarefa(); } catch (e) { toast(e instanceof Error ? e.message : "Não foi possível guardar o arquivo.", "erro"); }
    finally { setOcupado(false); onBusy?.(false); }
  };
  const adicionar = async (file?: File) => {
    if (!file || !onChange) return;
    const erro = validarArquivoEndo(file); if (erro) { toast(erro, "erro"); return; }
    await trabalhar(async () => {
      const id = `endo:${crypto.randomUUID()}`;
      const data = await ler(file);
      if (!await putBlob(id, data)) throw new Error("Não foi possível guardar neste aparelho. O arquivo não foi anexado.");
      const naNuvem = await enviarArquivoNuvem(id, data);
      onChange([...anexos, { id, nome: file.name, tamanho: file.size, naNuvem }]);
      if (!naNuvem) toast("Arquivo salvo neste aparelho. Use Enviar à nuvem quando houver conexão.", "info");
    });
  };
  const reenviar = async (anexo: AnexoEndo) => trabalhar(async () => {
    const data = await getBlob(anexo.id);
    if (!data || !await enviarArquivoNuvem(anexo.id, data)) throw new Error("Não foi possível enviar. Tente no aparelho onde o arquivo foi anexado e confira a conexão.");
    onChange?.(anexos.map(a => a.id === anexo.id ? { ...a, naNuvem: true } : a));
  });
  return <section aria-label="Arquivos da ação" className="rounded-lg border border-slate-200 p-3">
    <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-700">Arquivos · {anexos.length}</h3>{onChange && <label className="cursor-pointer text-xs font-semibold text-brand">{ocupado ? "Guardando…" : "+ Anexar"}<input className="sr-only" aria-label="Anexar arquivo" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.xlsx" disabled={ocupado} onChange={e => { void adicionar(e.target.files?.[0]); e.target.value = ""; }} /></label>}</div>
    {!anexos.length && <p className="mt-1 text-xs text-slate-400">Fotos, artes e documentos desta ação ou data.</p>}
    <ul className="mt-1 divide-y divide-slate-100">{anexos.map(a => <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-xs"><button className="min-w-0 flex-1 break-all text-left font-medium text-brand" onClick={() => void abrirAnexoEmNovaAba(async () => await getBlob(a.id) || await buscarArquivoNuvem(a.id), msg => toast(msg, "erro"), a.nome)}>{a.nome}</button><span className="text-slate-400">{Math.ceil(a.tamanho / 1024)} KB · {a.naNuvem ? "Na nuvem" : "Só neste aparelho"}</span>{onChange && !a.naNuvem && <button disabled={ocupado} onClick={() => void reenviar(a)} className="text-brand">Enviar à nuvem</button>}{onChange && <button disabled={ocupado} aria-label={`Desvincular ${a.nome}`} className="text-slate-500" onClick={() => onChange(anexos.filter(x => x.id !== a.id))}>Desvincular</button>}</li>)}</ul>
    {onChange && <p className="text-[11px] text-slate-400">Até 10 MB por arquivo. Salve a ação para confirmar os vínculos.</p>}
  </section>;
}
