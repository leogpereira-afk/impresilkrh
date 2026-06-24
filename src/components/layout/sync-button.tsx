import { useEffect, useRef, useState } from "react";
import {
  Cloud, CloudOff, RefreshCw, Check, AlertTriangle, Loader2, Download, Upload,
  Send, Power, ShieldAlert, PlugZap, Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { exportarDados, importarDados } from "@/lib/store";
import {
  statusSync, assinarSync, configSync, syncHabilitado, syncConfigurado, pendentesSync,
  conflitosSync, ligarSync, desligarSync, definirEndpoint, testarConexao, sincronizarAgora,
  enviarTudo, aceitarServidor, sobrescreverServidor, definirTokenSync, diagnosticar,
  apagarColecoes,
  type StatusSync, type PassoDiag,
} from "@/lib/sync";
import { Stethoscope, KeyRound } from "lucide-react";
import { MODO_JWT } from "@/lib/auth";

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
  const [tick, setTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const recarregar = () => setTick((n) => n + 1);

  const cfg = configSync();
  const configurado = syncConfigurado();
  const ligado = syncHabilitado();
  const pendentes = pendentesSync();
  const conflitos = conflitosSync();
  const vis = VISUAL[status];

  const [endpoint, setEndpoint] = useState(cfg.endpoint);
  const [ocupado, setOcupado] = useState(false);
  const [token, setToken] = useState("");
  const [diag, setDiag] = useState<PassoDiag[] | null>(null);

  const rodarDiag = async () => {
    setOcupado(true);
    setDiag(null);
    try { setDiag(await diagnosticar()); }
    catch { toast("Não foi possível rodar o diagnóstico.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };
  const salvarToken = () => {
    if (!token.trim()) { toast("Cole o token primeiro.", "erro"); return; }
    definirTokenSync(token);
    setToken("");
    toast("Token salvo neste computador. Sincronizando…");
    recarregar();
  };

  const agora = async () => {
    setOcupado(true);
    try { await sincronizarAgora(); toast("Sincronização concluída."); }
    catch { toast("Não foi possível sincronizar agora.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };
  const testar = async () => {
    setOcupado(true);
    try { const ok = await testarConexao(); toast(ok ? "Conexão com a nuvem OK." : "Sem resposta da nuvem. Confira o deploy.", ok ? "sucesso" : "erro"); }
    finally { setOcupado(false); recarregar(); }
  };
  const enviarOficial = async () => {
    if (!confirm("Enviar TODOS os dados deste computador para a nuvem como versão oficial? Use apenas no computador principal, com os dados mais completos.")) return;
    setOcupado(true);
    try { await enviarTudo(); toast("Tudo enviado. Os outros computadores recebem ao abrir."); }
    catch (e) { toast(e instanceof Error ? e.message : "Falha ao enviar.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };
  const apagarLancamentos = async () => {
    if (!confirm(
      "Apagar TODA a folha (pagamentos) e o plano de contas — deste computador E da nuvem?\n\n" +
      "O cadastro de colaboradores NÃO é afetado. Use para recomeçar do zero antes de importar os dados corrigidos.\n\nEsta ação não pode ser desfeita.",
    )) return;
    setOcupado(true);
    try {
      const r = await apagarColecoes(["pagamentos", "planoContas"]);
      const tot = r.reduce((s, x) => s + x.apagadosNuvem, 0);
      toast(`Folha e plano apagados. ${tot} registro(s) removidos da nuvem. Agora importe o arquivo corrigido e clique em "Enviar tudo".`);
    } catch (e) { toast(e instanceof Error ? e.message : "Falha ao apagar.", "erro"); }
    finally { setOcupado(false); recarregar(); }
  };
  const alternarLigado = () => {
    if (ligado) { desligarSync(); toast("Sincronização desligada neste computador."); }
    else { ligarSync(); toast("Sincronização ligada neste computador."); }
    recarregar();
  };
  const salvarEndpoint = () => { definirEndpoint(endpoint); toast("Endereço salvo."); recarregar(); };

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

      <input ref={fileRef} type="file" accept="application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) importar(f); e.target.value = ""; }} />

      <Modal
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Sincronização"
        descricao="Automática: envia ao salvar e atualiza ao abrir ou focar a janela."
        largura="max-w-md"
      >
        <div className="space-y-4" data-tick={tick}>
          {/* Status + ação única do dia a dia */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <vis.Icone className={`h-5 w-5 ${vis.cor} ${vis.girar ? "animate-spin" : ""}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-brand-ink">{vis.rotulo}</p>
              <p className="text-xs text-slate-500">
                {configurado ? (ligado ? `${pendentes} pendência(s)` : "Desligada neste computador.") : "Falta configurar no Netlify."}
              </p>
            </div>
            {ligado && (
              <button onClick={agora} disabled={ocupado} className="btn-outline px-3 py-1.5 text-sm disabled:opacity-50" title="Sincronizar agora">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-1.5 hidden sm:inline">Agora</span>
              </button>
            )}
          </div>

          {/* Conflitos (só aparecem quando existem) */}
          {conflitos.length > 0 && (
            <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-red-700">
                <AlertTriangle className="h-4 w-4" /> Escolha qual versão manter
              </p>
              {conflitos.map((c) => (
                <div key={`${c.colecao}::${c.id}`} className="flex items-center justify-between gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs">
                  <span className="min-w-0 truncate text-slate-600"><strong>{c.colecao}</strong> · {c.id}</span>
                  <span className="flex shrink-0 gap-1.5">
                    <button onClick={() => { aceitarServidor(c.colecao, c.id); recarregar(); }} className="rounded-md border border-slate-200 px-2 py-1 font-medium text-slate-600 hover:bg-slate-50">Da nuvem</button>
                    <button onClick={() => { sobrescreverServidor(c.colecao, c.id); recarregar(); }} className="rounded-md border border-brand-200 bg-brand-50 px-2 py-1 font-medium text-brand hover:bg-brand-100">O meu</button>
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Falta o token: oferece corrigir AGORA colando o token (sem redeploy) */}
          {!cfg.temToken && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <p className="flex items-start gap-2 text-xs leading-relaxed text-amber-800">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Falta o token de sincronização. Defina <code className="rounded bg-amber-100 px-1">SYNC_TOKEN</code> no Netlify e publique — <strong>ou</strong> cole aqui o mesmo valor para ligar agora (vale neste computador).
              </p>
              <div className="flex gap-2">
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Cole o SYNC_TOKEN"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                <button onClick={salvarToken} className="btn-outline px-3 text-sm"><KeyRound className="h-4 w-4" /> Salvar</button>
              </div>
            </div>
          )}

          {/* Diagnóstico: torna VISÍVEL por que a sincronização não funciona */}
          <div className="space-y-2">
            <button onClick={rodarDiag} disabled={ocupado} className="btn-outline w-full justify-center disabled:opacity-50">
              {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Diagnóstico da sincronização
            </button>
            {diag && (
              <ul className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                {diag.map((p, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    {p.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-600" />}
                    <span><strong className="text-slate-700">{p.etapa}:</strong> <span className="text-slate-600">{p.detalhe}</span></span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Tudo o que é raro fica aqui dentro */}
          <details className="rounded-xl border border-slate-200">
            <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-800">Mais opções</summary>
            <div className="space-y-3 border-t border-slate-100 p-4">
              {configurado && (
                <>
                  <button onClick={enviarOficial} disabled={ocupado} className="btn-outline w-full justify-center disabled:opacity-50">
                    {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar tudo (computador oficial)
                  </button>
                  <div className="flex gap-2">
                    <button onClick={testar} disabled={ocupado} className="btn-outline flex-1 justify-center disabled:opacity-50"><PlugZap className="h-4 w-4" /> Testar</button>
                    <button onClick={alternarLigado} className="btn-outline flex-1 justify-center"><Power className="h-4 w-4" /> {ligado ? "Desligar" : "Ligar"}</button>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <button onClick={exportar} className="btn-outline flex-1 justify-center"><Download className="h-4 w-4" /> Backup</button>
                <button onClick={() => fileRef.current?.click()} className="btn-outline flex-1 justify-center"><Upload className="h-4 w-4" /> Carregar</button>
              </div>
              {/* Recomeçar do zero: apaga folha + plano (local e nuvem). Não toca no cadastro. */}
              <button onClick={apagarLancamentos} disabled={ocupado} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Apagar folha e plano (recomeçar)
              </button>
              {/* Token deste computador (cola/troca sem refazer o deploy) */}
              <div className="flex gap-2">
                <input type="password" value={token} onChange={(e) => setToken(e.target.value)}
                  placeholder={cfg.tokenManual ? "Token colado — trocar" : "Colar token (override do build)"}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                <button onClick={salvarToken} className="btn-outline px-3 text-sm"><KeyRound className="h-4 w-4" /> Token</button>
              </div>
              {configurado && (
                <div className="flex gap-2">
                  <input type="text" value={endpoint} onChange={(e) => setEndpoint(e.target.value)} placeholder="/.netlify/functions/sync"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100" />
                  <button onClick={salvarEndpoint} className="btn-outline px-3 text-sm">Salvar</button>
                </div>
              )}
              {MODO_JWT ? (
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-green-700">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Login real ativo: os dados na nuvem só são lidos/gravados com o seu crachá de acesso (JWT). As senhas são definidas no Painel de Controle › Usuários.
                </p>
              ) : (
                <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-700">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  A chave fica embutida no app (visível no DevTools): barra acesso casual/bots, mas não é segurança forte. Para dados sensíveis, login real com JWT — detalhes em SINCRONIZACAO.md.
                </p>
              )}
            </div>
          </details>
        </div>
      </Modal>
    </>
  );
}
