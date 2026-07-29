import { useRef, useState } from "react";
import { Download, Upload, RotateCcw, AlertTriangle, ArrowRight } from "lucide-react";
import { exportarDados, importarDados, analisarBackup, restaurarPadrao, type AnaliseBackup } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Modal, ConfirmDialog } from "@/components/ui/modal";

// Backup / portabilidade: as edições ficam no navegador (localStorage).
// O export/import .json é a forma de salvar, restaurar e transferir tudo.
export function DadosControls({ compacto = false }: { compacto?: boolean }) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  // Arquivo escolhido, esperando conferência antes de trocar a base.
  const [pendente, setPendente] = useState<{ json: string; nome: string; analise: AnaliseBackup } | null>(null);

  const baixar = (conteudo: string, nome: string) => {
    const blob = new Blob([conteudo], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportar = () => {
    baixar(exportarDados(), `impresilk-rh-backup-${new Date().toISOString().slice(0, 10)}.json`);
    toast("Backup exportado com sucesso.");
  };

  // Escolher o arquivo NÃO restaura mais nada: só analisa e mostra a prévia.
  const escolher = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const json = String(reader.result);
      try {
        setPendente({ json, nome: file.name, analise: analisarBackup(json) });
      } catch (e) {
        toast(e instanceof Error ? e.message : "Falha ao ler o arquivo.", "erro");
      }
    };
    reader.readAsText(file);
  };

  const confirmarRestauracao = () => {
    if (!pendente) return;
    try {
      // Rede de segurança: guarda o estado atual antes de trocar, para dar
      // para voltar atrás se o arquivo escolhido não era o certo.
      baixar(exportarDados(), `impresilk-rh-ANTES-de-restaurar-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`);
      importarDados(pendente.json);
      toast("Dados restaurados. Guardamos um backup do estado anterior nos seus downloads.");
      setPendente(null);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao importar arquivo.", "erro");
    }
  };

  const btn = compacto
    ? "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium"
    : "btn-outline";

  const a = pendente?.analise;
  const mudam = a?.linhas.filter((l) => l.diferenca !== 0) ?? [];

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) escolher(f);
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

      {/* Prévia da restauração — antes isto trocava tudo sem perguntar nada */}
      {pendente && a && (
        <Modal
          aberto
          onFechar={() => setPendente(null)}
          titulo="Conferir antes de restaurar"
          descricao={`Arquivo: ${pendente.nome}${a.exportadoEm ? ` · gerado em ${new Date(a.exportadoEm).toLocaleString("pt-BR")}` : ""}`}
          largura="max-w-2xl"
          rodape={
            <>
              <button className="btn-outline" onClick={() => setPendente(null)}>Cancelar</button>
              <button className="btn-danger" onClick={confirmarRestauracao}>
                Restaurar mesmo assim
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {a.alertas.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-amber-200 bg-amber-50 p-3">
                {a.alertas.map((al, i) => (
                  <p key={i} className="flex gap-2 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {al}
                  </p>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-red-100 bg-red-50/60 p-3">
                <p className="text-xs font-medium text-red-700">Registros que SOMEM</p>
                <p className="text-2xl font-semibold text-red-700">{a.perdaTotal}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                <p className="text-xs font-medium text-emerald-700">Registros que ENTRAM</p>
                <p className="text-2xl font-semibold text-emerald-700">{a.ganhoTotal}</p>
              </div>
            </div>

            {mudam.length === 0 ? (
              <p className="text-sm text-slate-500">Nada muda: o arquivo tem exatamente o que já está aqui.</p>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Coleção</th>
                      <th className="px-3 py-2 text-right font-medium">Hoje</th>
                      <th className="px-3 py-2 text-center font-medium" />
                      <th className="px-3 py-2 text-right font-medium">Depois</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {mudam.map((l) => (
                      <tr key={l.colecao}>
                        <td className="px-3 py-1.5 text-slate-700">{l.colecao}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{l.agora}</td>
                        <td className="px-3 py-1.5 text-center text-slate-300"><ArrowRight className="mx-auto h-3.5 w-3.5" /></td>
                        <td className={`px-3 py-1.5 text-right font-medium tabular-nums ${l.diferenca < 0 ? "text-red-600" : "text-emerald-600"}`}>
                          {l.noArquivo} <span className="text-xs">({l.diferenca > 0 ? "+" : ""}{l.diferenca})</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p className="text-xs text-slate-500">
              Ao confirmar, o estado atual é baixado antes como <strong>impresilk-rh-ANTES-de-restaurar…json</strong>,
              para dar como voltar atrás. Depois disso a restauração também sobe para a nuvem.
            </p>
          </div>
        </Modal>
      )}

      <ConfirmDialog
        aberto={confirmReset}
        onFechar={() => setConfirmReset(false)}
        onConfirmar={() => {
          baixar(exportarDados(), `impresilk-rh-ANTES-de-restaurar-padrao-${new Date().toISOString().slice(0, 10)}.json`);
          restaurarPadrao();
          toast("Dados restaurados para o padrão. Um backup do estado anterior foi baixado.");
        }}
        titulo="Restaurar dados padrão?"
        mensagem="Todas as edições feitas neste navegador serão descartadas e os dados originais da Impresilk serão recarregados. Um backup do estado atual será baixado antes, mas a ação em si não pode ser desfeita."
        textoConfirmar="Restaurar"
      />
    </>
  );
}
