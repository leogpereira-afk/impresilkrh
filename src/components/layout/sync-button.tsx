import { useRef, useState } from "react";
import { RefreshCw, Download, Upload, Info } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { exportarDados, importarDados } from "@/lib/store";

// Sincronização manual entre computadores (o app guarda os dados no navegador
// de cada máquina; não há servidor unindo-os). Exporta aqui, importa lá.
export function SyncButton() {
  const toast = useToast();
  const [aberto, setAberto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const exportar = () => {
    const blob = new Blob([exportarDados()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impresilk-rh-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Arquivo gerado. Leve-o para o outro computador e use “Carregar atualização”.");
  };

  const importar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importarDados(String(reader.result));
        toast("Dados atualizados a partir do arquivo. Este computador está em dia.");
        setAberto(false);
      } catch (e) {
        toast(e instanceof Error ? e.message : "Falha ao ler o arquivo.", "erro");
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand active:scale-[0.97]"
        title="Sincronizar dados entre computadores"
      >
        <RefreshCw className="h-4 w-4" />
        <span className="hidden sm:inline">Sincronizar</span>
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }}
      />

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Sincronizar dados"
        descricao="Leve as suas atualizações de um computador para o outro."
        largura="max-w-lg"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-2.5 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
            <p>
              Os dados ficam salvos <strong>no navegador de cada computador</strong> — não há um servidor unindo as
              máquinas. Por isso, uma alteração feita aqui não aparece sozinha em outro computador. Para passar as
              atualizações, <strong>baixe</strong> o arquivo no computador que está mais atualizado e <strong>carregue</strong> nos outros.
            </p>
          </div>

          <button
            onClick={exportar}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700"><Download className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-semibold text-brand-ink">Baixar deste computador</span>
              <span className="block text-xs text-slate-500">Gera um arquivo com tudo que está aqui. Use no computador que tem as últimas alterações.</span>
            </span>
          </button>

          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-start gap-3 rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand-200 hover:bg-brand-50/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Upload className="h-5 w-5" /></span>
            <span>
              <span className="block text-sm font-semibold text-brand-ink">Carregar atualização</span>
              <span className="block text-xs text-slate-500">Lê um arquivo baixado em outro computador e atualiza este. Substitui os dados atuais deste navegador.</span>
            </span>
          </button>

          <p className="text-[11px] leading-relaxed text-slate-400">
            Dica: defina <strong>um computador como o “oficial”</strong> (onde você edita) e use o “Carregar” nos demais.
            Para sincronização automática entre máquinas seria necessário um servidor/nuvem (não incluído nesta versão) — posso ativar se você quiser.
          </p>
        </div>
      </Modal>
    </>
  );
}
