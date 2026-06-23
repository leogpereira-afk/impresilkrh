import { useEffect, useRef, useState } from "react";
import {
  Cloud, CloudOff, RefreshCw, Check, AlertTriangle, Loader2, Download, Upload,
  Info, ShieldAlert, Send, Power, Wifi, PlugZap,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { exportarDados, importarDados } from "@/lib/store";
import {
  statusSync, assinarSync, configSync, syncHabilitado, syncConfigurado, pendentesSync,
  conflitosSync, ligarSync, desligarSync, definirEndpoint, testarConexao, sincronizarAgora,
  enviarTudo, aceitarServidor, sobrescreverServidor, type StatusSync,
} from "@/lib/sync";

// Aparência do indicador conforme o estado da nuvem.
const VISUAL: Record<StatusSync, { rotulo: string; cor: string; Icone: typeof Cloud; girar?: boolean }> = {
  off: { rotulo: "Sincronização desligada", cor: "text-slate-400", Icone: CloudOff },
  ok: { rotulo: "Tudo sincronizado", cor: "text-green-600", Icone: Check },
  pending: { rotulo: "Enviando alterações…", cor: "text-amber-600", Icone: Cloud },
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
  const [tick, setTick] = useState(0); // re-render local após ações
  const fileRef = useRef<HTMLInputElement>(null);
  const recarregar = () => setTick((n) => n + 1);

  const cfg = configSync();
  const configurado = syncConfigurado(); // o site tem SYNC_TOKEN embutido?
  const ligado = syncHabilitado();
  const pendentes = pendentesSync();
  const conflitos = conflitosSync();
  const vis = VISUAL[status];

  const [endpoint, setEndpoint] = useState(cfg.endpoint);
  const [ocupado, setOcupado] = useState(false);

  const agora = async () => {
    setOcupado(true);
    try { await sincronizarAgora(); toast("Sincronização concluída."); }
    catch { toast("Não foi possível sincronizar agora.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };

  const testar = async () => {
    setOcupado(true);
    try {
      const ok = await testarConexao();
      toast(ok ? "Conexão com a nuvem OK." : "Sem resposta da nuvem. Confira o deploy no Netlify.", ok ? "sucesso" : "erro");
    } finally { setOcupado(false); recarregar(); }
  };

  const enviarOficial = async () => {
    if (!confirm("Enviar TODOS os dados deste computador para a nuvem como versão oficial? Use isto apenas no computador principal, com os dados mais completos.")) return;
    setOcupado(true);
    try { await enviarTudo(); toast("Tudo enviado para a nuvem. Os outros computadores recebem ao abrir."); }
    catch (e) { toast(e instanceof Error ? e.message : "Falha ao enviar.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };

  const alternarLigado = () => {
    if (ligado) { desligarSync(); toast("Sincronização desligada neste computador. Os dados continuam salvos localmente."); }
    else { ligarSync(); toast("Sincronização ligada neste computador."); }
    recarregar();
  };

  const salvarEndpoint = () => { definirEndpoint(endpoint); toast("Endereço da função salvo."); recarregar(); };

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
        descricao="Automática: os dados ficam iguais em todas as máquinas, sem senha."
        largura="max-w-xl"
      >
        <div className="space-y-5" data-tick={tick}>
          {/* Estado atual */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <vis.Icone className={`h-5 w-5 ${vis.cor} ${vis.girar ? "animate-spin" : ""}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-ink">{vis.rotulo}</p>
              <p className="text-xs text-slate-500">
                {configurado
                  ? ligado
                    ? `Automática · ${pendentes} pendência(s)${conflitos.length ? ` · ${conflitos.length} conflito(s)` : ""}`
                    : "Desligada neste computador."
                  : "Ainda não configurada no Netlify."}
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

          {/* Não configurado: instrução de 1 variável no Netlify */}
          {!configurado ? (
            <div className="space-y-2 rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink"><PlugZap className="h-4 w-4 text-brand" /> Ligar a sincronização automática</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Falta um passo, feito <strong>uma única vez</strong> no painel do Netlify: crie a variável de ambiente
                <code className="mx-1 rounded bg-slate-100 px-1">SYNC_TOKEN</code> com uma senha forte e publique o site.
                A partir daí, <strong>todo computador que abrir o app já sincroniza sozinho</strong> — ninguém digita nada.
                O passo a passo está no arquivo <code className="rounded bg-slate-100 px-1">SINCRONIZACAO.md</code>.
              </p>
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink"><Wifi className="h-4 w-4 text-brand" /> Computador principal</p>
              <p className="text-xs leading-relaxed text-slate-500">
                Faça <strong>uma vez</strong>, no computador com os dados mais completos: envia tudo para a nuvem como
                versão oficial. Os outros recebem sozinhos ao abrir.
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={enviarOficial} disabled={ocupado} className="btn-primary flex-1 justify-center disabled:opacity-50">
                  {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar tudo (oficial)
                </button>
                <button onClick={testar} disabled={ocupado} className="btn-outline justify-center disabled:opacity-50">
                  <PlugZap className="h-4 w-4" /> Testar conexão
                </button>
                <button onClick={alternarLigado} className="btn-outline justify-center">
                  <Power className="h-4 w-4" /> {ligado ? "Desligar aqui" : "Ligar aqui"}
                </button>
              </div>
              <details className="text-xs text-slate-500">
                <summary className="cursor-pointer select-none hover:text-slate-700">Endereço da função (avançado)</summary>
                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    placeholder="/.netlify/functions/sync"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                  <button onClick={salvarEndpoint} className="btn-outline px-3">Salvar</button>
                </div>
              </details>
            </div>
          )}

          {/* Aviso de segurança (sempre visível: vale para o modelo automático) */}
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-800">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              <strong>Aviso de segurança:</strong> para ser automática (sem senha), a chave de acesso fica
              <strong> embutida no app</strong> e é entregue a quem abrir o site — ou seja, é <strong>visível no
              DevTools</strong>. Isso protege contra acesso casual e robôs, mas <strong>não é segurança forte</strong>.
              Para dados realmente sensíveis, o ideal é um login de verdade (usuário/senha por pessoa, com token JWT no
              servidor). Posso evoluir para esse modelo quando quiser.
            </p>
          </div>

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
