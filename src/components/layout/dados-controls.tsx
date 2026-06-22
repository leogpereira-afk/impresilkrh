import { useRef, useState } from "react";
import { Download, Upload, RotateCcw } from "lucide-react";
import { exportarDados, importarDados, restaurarPadrao } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { ConfirmDialog } from "@/components/ui/modal";

// Backup / portabilidade: as edições ficam no navegador (localStorage).
// O export/import .json é a forma de salvar, restaurar e transferir tudo.
export function DadosControls({ compacto = false }: { compacto?: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const exportar = () => {
    const blob = new Blob([exportarDados()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impresilk-rh-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup exportado com sucesso.");
  };

  const importar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        importarDados(String(reader.result));
        toast("Dados importados e restaurados.");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Falha ao importar arquivo.", "erro");
      }
    };
    reader.readAsText(file);
  };

  const btn = compacto
    ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium"
    : "btn-outline";

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) importar(f);
          e.target.value = "";
        }}
      />
      <div className={compacto ? "flex gap-1.5" : "flex flex-wrap gap-2"}>
        <button className={compacto ? `${btn} text-slate-600 hover:bg-slate-100` : btn} onClick={exportar} title="Exportar dados (.json)">
          <Download className="h-4 w-4" /> Exportar
        </button>
        <button
          className={compacto ? `${btn} text-slate-600 hover:bg-slate-100` : btn}
          onClick={() => inputRef.current?.click()}
          title="Importar dados (.json)"
        >
          <Upload className="h-4 w-4" /> Importar
        </button>
        {!compacto && (
          <button className="btn-ghost text-slate-500" onClick={() => setConfirmReset(true)} title="Restaurar dados padrão">
            <RotateCcw className="h-4 w-4" /> Restaurar padrão
          </button>
        )}
      </div>
      <ConfirmDialog
        aberto={confirmReset}
        onFechar={() => setConfirmReset(false)}
        onConfirmar={() => {
          restaurarPadrao();
          toast("Dados restaurados para o padrão de fábrica.");
        }}
        titulo="Restaurar dados padrão?"
        mensagem="Todas as edições feitas neste navegador serão descartadas e os dados originais da Impresilk serão recarregados. Esta ação não pode ser desfeita."
        textoConfirmar="Restaurar"
      />
    </>
  );
}
