import { useEffect, useRef, useState } from "react";
import {
  Cloud, CloudOff, RefreshCw, Check, AlertTriangle, Loader2, Download, Upload,
  Info, Link2, ShieldAlert, Send, Power,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { exportarDados, importarDados } from "@/lib/store";
import {
  statusSync, assinarSync, configSync, syncHabilitado, pendentesSync, conflitosSync,
  configurarSync, testarConexao, sincronizarAgora, enviarTudo, aceitarServidor,
  sobrescreverServidor, type StatusSync,
} from "@/lib/sync";

// Aparência do indicador conforme o estado da nuvem.
const VISUAL: Record<StatusSync, { rotulo: string; cor: string; Icone: typeof Cloud; girar?: boolean }> = {
  off: { rotulo: "Nuvem desligada", cor: "text-slate-400", Icone: CloudOff },
  ok: { rotulo: "Sincronizado", cor: "text-green-600", Icone: Check },
  pending: { rotulo: "Pendências a enviar", cor: "text-amber-600", Icone: Cloud },
  offline: { rotulo: "Sem conexão", cor: "text-slate-400", Icone: CloudOff },
  syncing: { rotulo: "Sincronizando…", cor: "text-blue-600", Icone: RefreshCw, girar: true },
  conflito: { rotulo: "Conflito a resolver", cor: "text-red-600", Icone: AlertTriangle },
  erro: { rotulo: "Erro de sincronização", cor: "text-red-600", Icone: AlertTriangle },
};

function useStatusSync(): StatusSync {
  const [, forcar] = useState(0);
  useEffect(() => assinarSync(() => forcar((n) => n + 1)), []);
  return statusSync();
}

export function SyncButton() {
  const toast = useToast();
  const status = useStatusSync();
  const [aberto, setAberto] = useState(false);
  const [tick, setTick] = useState(0); // re-render local após ações (conflitos)
  const fileRef = useRef<HTMLInputElement>(null);
  const recarregar = () => setTick((n) => n + 1);

  const cfg = configSync();
  const ligado = syncHabilitado();
  const pendentes = pendentesSync();
  const conflitos = conflitosSync();
  const vis = VISUAL[status];

  // --- formulário de conexão ---
  const [token, setToken] = useState(cfg.token);
  const [endpoint, setEndpoint] = useState(cfg.endpoint);
  const [testando, setTestando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const conectar = async () => {
    if (!token.trim()) { toast("Informe a senha de sincronização.", "erro"); return; }
    setTestando(true);
    try {
      const ok = await testarConexao(endpoint.trim() || cfg.endpoint, token.trim());
      if (!ok) { toast("Não conectou: confira a senha e se a função está publicada.", "erro"); return; }
      configurarSync({ endpoint: endpoint.trim() || cfg.endpoint, token: token.trim(), habilitado: true });
      toast("Nuvem conectada. Este computador passará a sincronizar automaticamente.");
      recarregar();
    } catch {
      toast("Falha ao testar a conexão (você está online?).", "erro");
    } finally {
      setTestando(false);
    }
  };

  const desligar = () => {
    configurarSync({ habilitado: false });
    toast("Sincronização desligada neste computador. Os dados continuam salvos localmente.");
    recarregar();
  };

  const agora = async () => {
    setOcupado(true);
    try { await sincronizarAgora(); toast("Sincronização concluída."); }
    catch { toast("Não foi possível sincronizar agora.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };

  const enviarOficial = async () => {
    if (!confirm("Enviar TODOS os dados deste computador para a nuvem como versão oficial? Use isto apenas no computador principal, com os dados mais completos.")) return;
    setOcupado(true);
    try { await enviarTudo(); toast("Tudo enviado para a nuvem. Os outros computadores receberão ao sincronizar."); }
    catch (e) { toast(e instanceof Error ? e.message : "Falha ao enviar.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };

  // --- backup manual (arquivo) ---
  const exportar = () => {
    const blob = new Blob([exportarDados()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impresilk-rh-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup gerado.");
  };
  const importar = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { importarDados(String(reader.result)); toast("Dados carregados a partir do arquivo."); }
      catch (e) { toast(e instanceof Error ? e.message : "Falha ao ler o arquivo.", "erro"); }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <button
        onClick={() => setAberto(true)}
        className="relative inline-flex items-center gap-1.5 rounded-xl border border-slate-200/80 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-all duration-200 hover:border-brand-200 hover:bg-brand-50 hover:text-brand active:scale-[0.97]"
        title={`Sincronização: ${vis.rotulo}`}
      >
        <vis.Icone className={`h-4 w-4 ${vis.cor} ${vis.girar ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Sincronizar</span>
        {ligado && (pendentes > 0 || conflitos.length > 0) && (
          <span className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white ${conflitos.length ? "bg-red-500" : "bg-amber-500"}`}>
            {conflitos.length || pendentes}
          </span>
        )}
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
        titulo="Sincronização entre computadores"
        descricao="Mantém os dados iguais em todas as máquinas, automaticamente."
        largura="max-w-xl"
      >
        <div className="space-y-5" data-tick={tick}>
          {/* Estado atual */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <vis.Icone className={`h-5 w-5 ${vis.cor} ${vis.girar ? "animate-spin" : ""}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-ink">{vis.rotulo}</p>
              <p className="text-xs text-slate-500">
                {ligado
                  ? `Conectado · ${pendentes} pendência(s)${conflitos.length ? ` · ${conflitos.length} conflito(s)` : ""}`
                  : "Não conectado neste computador."}
              </p>
            </div>
            {ligado && (
              <button onClick={agora} disabled={ocupado} className="btn-outline px-3 py-1.5 text-sm disabled:opacity-50">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Sincronizar agora</span>
              </button>
            )}
          </div>

          {/* Conflitos */}
          {conflitos.length > 0 && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" /> Conflitos — escolha qual versão manter
              </p>
              {conflitos.map((c) => (
                <div key={`${c.colecao}::${c.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-slate-600"><strong>{c.colecao}</strong> · {c.id}</span>
                  <span className="flex shrink-0 gap-1.5">
                    <button onClick={() => { aceitarServidor(c.colecao, c.id); recarregar(); }} className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">Usar da nuvem</button>
                    <button onClick={() => { sobrescreverServidor(c.colecao, c.id); recarregar(); }} className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 font-medium text-brand hover:bg-brand-100">Manter o meu</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Conexão */}
          {!ligado ? (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink"><Link2 className="h-4 w-4 text-brand" /> Conectar à nuvem</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Digite a <strong>senha de sincronização</strong> (a mesma em todos os computadores). Ela deve ser igual ao
                valor configurado no Netlify (variável <code className="rounded bg-slate-100 px-1">SYNC_TOKEN</code>).
              </p>
              <div className="space-y-2">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder="Senha de sincronização"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                <details className="text-xs text-slate-500">
                  <summary className="cursor-pointer select-none hover:text-slate-700">Endereço da função (avançado)</summary>
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="/.netlify/functions/sync"
                    className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </details>
              </div>
              <button onClick={conectar} disabled={testando} className="btn-primary w-full justify-center disabled:opacity-50">
                {testando ? <><Loader2 className="h-4 w-4 animate-spin" /> Testando…</> : <>Conectar este computador</>}
              </button>
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
                <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <p>
                  <strong>Aviso de segurança:</strong> esta senha fica guardada no navegador e trafega para a função.
                  Ela protege contra acesso casual e robôs, mas <strong>não é segurança forte</strong> — qualquer pessoa
                  com acesso ao computador pode vê-la nas ferramentas de desenvolvedor (DevTools). Para dados realmente
                  sensíveis, o ideal é um login de verdade (usuário/senha por pessoa, com token JWT no servidor).
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-brand-ink">Computador principal</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Faça isto <strong>uma vez</strong>, no computador que tem os dados mais completos: envia tudo para a nuvem
                como versão oficial. Nos outros, basta conectar e usar “Sincronizar agora”.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={enviarOficial} disabled={ocupado} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar tudo (oficial)
                </button>
                <button onClick={desligar} className="btn-outline justify-center">
                  <Power className="h-4 w-4" /> Desligar aqui
                </button>
              </div>
            </div>
          )}

          {/* Backup manual (alternativa offline) */}
          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-slate-600 hover:text-slate-800">
              Backup por arquivo (sem nuvem)
            </summary>
            <div className="space-y-2 border-t border-slate-100 p-4">
              <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50/50 px-3 py-2 text-[11px] leading-relaxed text-slate-600">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                <p>Alternativa manual: baixe um arquivo aqui e carregue no outro computador. Útil para guardar uma cópia de segurança.</p>
              </div>
              <div className="flex gap-2">
                <button onClick={exportar} className="btn-outline flex-1 justify-center"><Download className="h-4 w-4" /> Baixar backup</button>
                <button onClick={() => fileRef.current?.click()} className="btn-outline flex-1 justify-center"><Upload className="h-4 w-4" /> Carregar arquivo</button>
              </div>
            </div>
          </details>
        </div>
      </Modal>
    </>
  );
}
