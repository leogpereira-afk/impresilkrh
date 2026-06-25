// ============================================================================
// Sincronização offline-first (cliente). Escreve local na hora; enfileira a
// ação; tenta sincronizar com a nuvem (Netlify Function) quando online.
// Reconcilia por timestamp (atualizadoEm). Backend trocável (contrato estável).
//
// AUTOMÁTICA, SEM SENHA: o token vem embutido no build (env SYNC_TOKEN do
// Netlify). Todo computador que abre o app já sincroniza sozinho. Se o site
// ainda não foi configurado (token vazio), tudo funciona 100% local, como antes.
// ============================================================================
import { NOMES_COLECOES } from "@/data";
import { obter, definirColecao, aplicarSemSync, registrarMutacao, obterConfig } from "@/lib/store";
import { MODO_JWT, tokenAtual } from "@/lib/auth";

const temWindow = typeof window !== "undefined";
const NS = "impresilk.sync";
const K_FILA = `${NS}.fila`;
const K_CFG = `${NS}.cfg`;
const ENDPOINT_PADRAO = "/.netlify/functions/sync";
const MAX_TENTATIVAS = 25; // descarta a ação após N falhas permanentes
const LOTE_PUSH = 100; // registros por chamada no envio em massa

// Dois modos de acesso à nuvem:
//  • LOGIN REAL (MODO_JWT): cada chamada vai com o crachá do usuário logado
//    (Authorization: Bearer <jwt>). Mais seguro — sem chave exposta no app.
//  • AUTOMÁTICO (sem login): usa o token embutido no build (SYNC_TOKEN), enviado
//    no header x-token. Conveniente, porém o token fica visível no app.
declare const __SYNC_TOKEN__: string;
const TOKEN_BUILD = typeof __SYNC_TOKEN__ === "string" ? __SYNC_TOKEN__ : "";
const K_TOKEN_MANUAL = `${NS}.token`;

// Token compartilhado = o embutido no build (env SYNC_TOKEN) OU um colado no app
// (override por computador, sem refazer o deploy). É o modelo "automático" do
// guia: todo computador que tem o token sincroniza — SEM depender de login.
function tokenManual(): string { if (!temWindow) return ""; try { return localStorage.getItem(K_TOKEN_MANUAL) || ""; } catch { return ""; } }
function tokenCompartilhado(): string { return tokenManual() || TOKEN_BUILD; }
export function temTokenManual(): boolean { return !!tokenManual(); }
export function tokenEmbutidoPresente(): boolean { return !!TOKEN_BUILD; }
export function definirTokenSync(token: string): void {
  if (temWindow) { try { localStorage.setItem(K_TOKEN_MANUAL, token.trim()); } catch { /* ignora */ } }
  recalcStatus();
  if (syncHabilitado()) void sincronizarAgora();
}

// Cabeçalho de autorização: SEMPRE manda o token compartilhado (x-token) quando
// existe — assim sincroniza sem depender de login. Se houver crachá (JWT) válido,
// manda também; o servidor aceita qualquer um dos dois.
function cabecalhoAuth(): Record<string, string> {
  const h: Record<string, string> = {};
  const tok = tokenCompartilhado();
  if (tok) h["x-token"] = tok;
  if (MODO_JWT) { const t = tokenAtual(); if (t) h["authorization"] = `Bearer ${t}`; }
  return h;
}

type Tipo = "upsert" | "delete";
interface Acao { tipo: Tipo; colecao: string; id: string; falhas?: number; conflito?: boolean; servidor?: Envelope | null }
interface Envelope { colecao: string; registro: Reg }
type Reg = { id: string; atualizadoEm?: string } & Record<string, unknown>;
export type StatusSync = "off" | "ok" | "pending" | "offline" | "syncing" | "conflito" | "erro";

// ---------------------------- configuração ----------------------------------
// Sem senha: o token vem do build. O usuário só pode (opcionalmente) DESLIGAR a
// sincronização neste computador, ou ajustar o endpoint (avançado).
interface CfgSync { endpoint: string; desligado: boolean }
function lerCfg(): CfgSync {
  const base: CfgSync = { endpoint: ENDPOINT_PADRAO, desligado: false };
  if (!temWindow) return base;
  try { return { ...base, ...JSON.parse(localStorage.getItem(K_CFG) || "{}") }; } catch { return base; }
}
function gravarCfg(patch: Partial<CfgSync>) { if (temWindow) localStorage.setItem(K_CFG, JSON.stringify({ ...lerCfg(), ...patch })); }
// A nuvem está configurada? Basta ter um token compartilhado (build ou colado no
// app). No modo JWT também conta como configurado (login real fala com a função).
export function syncConfigurado(): boolean { return !!tokenCompartilhado() || MODO_JWT; }
export function configSync(): CfgSync & { configurado: boolean; modoJwt: boolean; temToken: boolean; tokenManual: boolean } {
  return { ...lerCfg(), configurado: syncConfigurado(), modoJwt: MODO_JWT, temToken: !!tokenCompartilhado(), tokenManual: temTokenManual() };
}
// Habilitado para sincronizar agora? Com token compartilhado, sincroniza
// automaticamente (modelo do guia). Sem token, só no modo JWT com crachá válido.
export function syncHabilitado(): boolean {
  if (lerCfg().desligado) return false;
  if (tokenCompartilhado()) return true;
  return MODO_JWT ? !!tokenAtual() : false;
}
export function ligarSync(): void { gravarCfg({ desligado: false }); recalcStatus(); if (syncHabilitado()) { void trySync(); void pull(); } }
export function desligarSync(): void { gravarCfg({ desligado: true }); recalcStatus(); }

// ------------------------------- status -------------------------------------
let status: StatusSync = syncHabilitado() ? "pending" : "off";
const ouvintes = new Set<() => void>();
export function statusSync(): StatusSync { return status; }
export function assinarSync(cb: () => void): () => void { ouvintes.add(cb); return () => ouvintes.delete(cb); }
function setStatus(s: StatusSync) { if (s !== status) { status = s; ouvintes.forEach((cb) => cb()); } }
function recalcStatus() {
  if (!syncHabilitado()) return setStatus("off");
  const fila = lerFila();
  if (fila.some((a) => a.conflito)) return setStatus("conflito");
  if (temWindow && !navigator.onLine) return setStatus("offline");
  setStatus(fila.length ? "pending" : "ok");
}

// -------------------------------- fila --------------------------------------
function lerFila(): Acao[] { if (!temWindow) return []; try { return JSON.parse(localStorage.getItem(K_FILA) || "[]"); } catch { return []; } }
function gravarFila(f: Acao[]) { if (temWindow) localStorage.setItem(K_FILA, JSON.stringify(f)); }
const mesma = (a: Acao, b: { colecao: string; id: string }) => a.colecao === b.colecao && a.id === b.id;
export function pendentesSync(): number { return lerFila().filter((a) => !a.conflito).length; }
export function conflitosSync(): Acao[] { return lerFila().filter((a) => a.conflito); }

// Deduplicação: upsert do mesmo id substitui o anterior; delete descarta upserts
// pendentes do mesmo id e não duplica deletes.
function enfileirar(colecao: string, tipo: Tipo, id: string) {
  let fila = lerFila();
  if (tipo === "delete") {
    fila = fila.filter((a) => !(mesma(a, { colecao, id }) && a.tipo === "upsert"));
    if (!fila.some((a) => mesma(a, { colecao, id }) && a.tipo === "delete")) fila.push({ tipo: "delete", colecao, id });
  } else {
    fila = fila.filter((a) => !(mesma(a, { colecao, id }) && a.tipo === "upsert" && !a.conflito));
    fila.push({ tipo: "upsert", colecao, id });
  }
  gravarFila(fila);
  recalcStatus();
  void trySync();
}

// ------------------------------- HTTP ---------------------------------------
class ErroHttp extends Error { constructor(public status: number, msg: string) { super(msg); } }
async function chamar(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const { endpoint } = lerCfg();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", ...cabecalhoAuth() },
    body: JSON.stringify({ action, ...payload }),
  });
  if (!res.ok) throw new ErroHttp(res.status, await res.text().catch(() => res.statusText));
  return res.json();
}
const eRede = (e: unknown) => !(e instanceof ErroHttp); // fetch falhou (offline/DNS) → erro de rede

// --------------------------- envio (push) -----------------------------------
let _syncing = false;
export async function trySync(): Promise<void> {
  if (!syncHabilitado() || _syncing) return;
  if (temWindow && !navigator.onLine) { setStatus("offline"); return; }
  _syncing = true;
  setStatus("syncing");
  try {
    for (const acao of lerFila().filter((a) => !a.conflito)) {
      try {
        if (acao.tipo === "upsert") {
          const registro = (obter(acao.colecao as never) as unknown as Reg[]).find((r) => r.id === acao.id);
          if (!registro) { gravarFila(lerFila().filter((a) => !mesma(a, acao))); continue; } // sumiu local
          const resp = await chamar("upsert", { colecao: acao.colecao, registro });
          if (resp?.conflito) {
            gravarFila(lerFila().map((a) => (mesma(a, acao) && a.tipo === "upsert" ? { ...a, conflito: true, servidor: resp.servidor } : a)));
            continue;
          }
        } else {
          await chamar("delete", { colecao: acao.colecao, id: acao.id });
        }
        gravarFila(lerFila().filter((a) => !mesma(a, acao))); // sucesso → remove
      } catch (e) {
        if (eRede(e)) { setStatus("offline"); return; } // para o ciclo; retenta no próximo gatilho
        // falha permanente (token, 4xx/5xx): conta e descarta após o limite
        gravarFila(
          lerFila()
            .map((a) => (mesma(a, acao) && a.tipo === acao.tipo ? { ...a, falhas: (a.falhas ?? 0) + 1 } : a))
            .filter((a) => !(mesma(a, acao) && a.tipo === acao.tipo && (a.falhas ?? 0) >= MAX_TENTATIVAS)),
        );
      }
    }
  } finally {
    _syncing = false;
    recalcStatus();
  }
}

// --------------------------- baixar (pull) ----------------------------------
// Época dos dados: incrementada por apagarColecoes(). Um pull que começou ANTES de
// uma limpeza não pode reaplicar o que acabou de ser apagado — ele confere a época
// antes de gravar e desiste se mudou (senão a "folha apagada" voltaria na hora).
let epocaDados = 0;

export async function pull(): Promise<void> {
  if (!syncHabilitado()) return;
  if (temWindow && !navigator.onLine) { setStatus("offline"); return; }
  setStatus("syncing");
  const epocaInicio = epocaDados;
  try {
    const remoto = new Map<string, Envelope>();
    let offset: number | null = 0;
    while (offset !== null) {
      const resp = await chamar("list", { offset });
      for (const env of (resp.registros ?? []) as Envelope[]) if (env?.registro?.id) remoto.set(`${env.colecao}::${env.registro.id}`, env);
      offset = resp.nextOffset ?? null;
    }
    // Houve uma limpeza (apagarColecoes) enquanto líamos a nuvem → este retrato está
    // velho; descarta para não ressuscitar o que foi apagado.
    if (epocaInicio !== epocaDados) { recalcStatus(); return; }
    const porColecao = new Map<string, Reg[]>();
    for (const { colecao, registro } of remoto.values()) { const arr = porColecao.get(colecao) ?? []; arr.push(registro); porColecao.set(colecao, arr); }

    aplicarSemSync(() => {
      for (const nome of NOMES_COLECOES) {
        const remotos = porColecao.get(nome);
        if (!remotos || remotos.length === 0) continue; // coleção vazia no servidor → preserva o local (segurança)
        const locais = obter(nome) as unknown as Reg[];
        const remMap = new Map(remotos.map((r) => [r.id, r]));
        const merged: Reg[] = [];
        for (const loc of locais) {
          const rem = remMap.get(loc.id);
          if (rem) {
            const remNovo = !!rem.atualizadoEm && (!loc.atualizadoEm || rem.atualizadoEm > loc.atualizadoEm);
            merged.push(remNovo ? rem : loc); // mais novo vence
            remMap.delete(loc.id);
          } else {
            merged.push(loc); // PRESERVA SEMPRE o local — o pull nunca apaga dados
            // (antes: registro ausente na nuvem era removido; isso zerava importações
            //  e o cadastro base quando a nuvem ainda estava incompleta).
          }
        }
        for (const rem of remMap.values()) merged.push(rem); // novos do servidor
        definirColecao(nome as never, merged as never);
      }
    });
    recalcStatus();
  } catch (e) {
    // pull roda em segundo plano (ao abrir, online, a cada minuto): nunca propaga
    // a exceção — apenas reflete no status. Erro de rede → offline; HTTP → erro.
    setStatus(eRede(e) ? "offline" : "erro");
  }
}

// ----------------- envio em massa (computador "oficial") --------------------
// AUTORITATIVO: a nuvem passa a refletir EXATAMENTE este computador. Para cada
// coleção, limpa a nuvem e regrava — assim registros antigos (ids que não existem
// mais aqui) NÃO sobrevivem. É o que impede dados velhos de voltarem ao sincronizar.
// Use só no computador oficial, com os dados mais completos.
export async function enviarTudo(): Promise<void> {
  if (!syncHabilitado()) throw new Error("Configure a sincronização primeiro.");
  epocaDados++; // invalida pulls em voo (não deixa o que vamos regravar se misturar)
  setStatus("syncing");
  try {
    const agora = new Date().toISOString();
    const porColecao = new Map<string, Envelope[]>();
    aplicarSemSync(() => {
      for (const nome of NOMES_COLECOES) {
        const carimbados = (obter(nome) as unknown as Reg[]).map((r) => (r.atualizadoEm ? r : { ...r, atualizadoEm: agora }));
        definirColecao(nome as never, carimbados as never); // grava o carimbo local também
        porColecao.set(nome, carimbados.filter((r) => r.id).map((r) => ({ colecao: nome, registro: r })));
      }
    });
    for (const nome of NOMES_COLECOES) {
      await chamar("limparColecao", { colecao: nome }); // zera a coleção na nuvem
      const lote = porColecao.get(nome) ?? [];
      for (let i = 0; i < lote.length; i += LOTE_PUSH) await chamar("bulkUpsert", { registros: lote.slice(i, i + LOTE_PUSH) });
    }
    await chamar("setCfg", { config: obterConfig() });
    gravarFila([]); // tudo já está no servidor
  } finally {
    recalcStatus();
  }
}

// Envia (bulkUpsert) TODOS os registros de UMA coleção para a nuvem. Usado após
// importações em massa (que gravam com definirColecao e por isso NÃO passam pelo
// gancho de mutação) — assim o dado sobe na hora, sem depender de "Enviar tudo".
// Best-effort: carimba atualizadoEm onde faltar e nunca quebra o fluxo da tela.
export async function enviarColecao(nome: string): Promise<void> {
  if (!syncHabilitado()) return;
  if (temWindow && !navigator.onLine) { recalcStatus(); return; }
  setStatus("syncing");
  try {
    const agora = new Date().toISOString();
    let lote: Envelope[] = [];
    aplicarSemSync(() => {
      const carimbados = (obter(nome as never) as unknown as Reg[]).map((r) => (r.atualizadoEm ? r : { ...r, atualizadoEm: agora }));
      definirColecao(nome as never, carimbados as never);
      lote = carimbados.filter((r) => r.id).map((r) => ({ colecao: nome, registro: r }));
    });
    for (let i = 0; i < lote.length; i += LOTE_PUSH) await chamar("bulkUpsert", { registros: lote.slice(i, i + LOTE_PUSH) });
  } catch {
    /* fica local (o pull não apaga); o usuário pode usar "Enviar tudo" depois */
  } finally {
    recalcStatus();
  }
}

// Arquivos grandes (currículos, anexos) NÃO cabem no localStorage e não entram no
// registro (inflaria a sincronização). Vão para o store de blobs da nuvem (mesmo
// canal das fotos), com chave própria — assim ficam disponíveis em TODOS os
// computadores. Localmente são cacheados no IndexedDB. Best-effort: precisa de rede.
export async function enviarArquivoNuvem(id: string, dataUrl: string): Promise<boolean> {
  if (!syncConfigurado()) return false;
  if (temWindow && !navigator.onLine) return false;
  try { const r = await chamar("putPhoto", { id, dataUrl }); return !!r?.ok; }
  catch { return false; }
}
export async function buscarArquivoNuvem(id: string): Promise<string | null> {
  if (!syncConfigurado()) return null;
  try { const r = await chamar("getPhoto", { id }); return (r?.dataUrl as string | null) ?? null; }
  catch { return null; }
}

// Apaga TODOS os registros de uma ou mais coleções — LOCAL e na NUVEM. É o
// "recomeçar do zero" de um conjunto de lançamentos (ex.: folha + plano de contas)
// sem tocar no resto (cadastro etc.). Também limpa a fila pendente dessas coleções
// para não re-subir nada. Sem isso, dados antigos na nuvem voltavam ao importar.
export async function apagarColecoes(nomes: string[]): Promise<{ nome: string; apagadosNuvem: number; erroNuvem: boolean }[]> {
  const resultado: { nome: string; apagadosNuvem: number; erroNuvem: boolean }[] = [];
  epocaDados++; // invalida qualquer pull em voo (não deixa o apagado voltar)
  setStatus("syncing");
  try {
    for (const nome of nomes) {
      // 1) zera local (sem disparar push)
      aplicarSemSync(() => definirColecao(nome as never, [] as never));
      // 2) descarta pendências locais dessa coleção
      gravarFila(lerFila().filter((a) => a.colecao !== nome));
      // 3) zera na nuvem (apaga todos os blobs da coleção de uma vez)
      let apagados = 0;
      let erroNuvem = false;
      if (syncConfigurado()) {
        try { const r = await chamar("limparColecao", { colecao: nome }); apagados = Number(r?.apagados ?? 0); }
        catch { erroNuvem = true; } // nuvem não respondeu: local zerado, mas avisamos o usuário
      }
      resultado.push({ nome, apagadosNuvem: apagados, erroNuvem });
    }
  } finally {
    recalcStatus();
  }
  return resultado;
}

// --------------------------- conflitos --------------------------------------
export function aceitarServidor(colecao: string, id: string) {
  const acao = lerFila().find((a) => mesma(a, { colecao, id }) && a.conflito);
  const env = acao?.servidor;
  if (env?.registro) {
    aplicarSemSync(() => {
      const arr = obter(colecao as never) as unknown as Reg[];
      const existe = arr.some((r) => r.id === id);
      definirColecao(colecao as never, (existe ? arr.map((r) => (r.id === id ? env.registro : r)) : [env.registro, ...arr]) as never);
    });
  }
  gravarFila(lerFila().filter((a) => !mesma(a, { colecao, id })));
  recalcStatus();
}
export function sobrescreverServidor(colecao: string, id: string) {
  aplicarSemSync(() => {
    definirColecao(colecao as never, (obter(colecao as never) as unknown as Reg[]).map((r) => (r.id === id ? { ...r, atualizadoEm: new Date().toISOString() } : r)) as never);
  });
  gravarFila(lerFila().map((a) => (mesma(a, { colecao, id }) ? { tipo: "upsert" as Tipo, colecao, id } : a)));
  void trySync();
}

// --------------------------- ativação / setup -------------------------------
// Testa a conexão com o endpoint atual (ping) usando o modo de auth vigente.
export async function testarConexao(): Promise<boolean> {
  if (!syncConfigurado()) return false;
  try {
    const { endpoint } = lerCfg();
    const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", ...cabecalhoAuth() }, body: JSON.stringify({ action: "ping" }) });
    return res.ok;
  } catch { return false; }
}
export function definirEndpoint(endpoint: string) { gravarCfg({ endpoint: endpoint.trim() || ENDPOINT_PADRAO }); recalcStatus(); if (syncHabilitado()) void sincronizarAgora(); }
export async function sincronizarAgora(): Promise<void> { await trySync(); await pull(); }

// --------------------------- diagnóstico ------------------------------------
// Transforma falha silenciosa em mensagem clara. Roda ping → list → grava/apaga
// um registro de teste, e descreve o erro exato de cada etapa (token vazio, 401
// por token diferente, 500 do Blobs, rede). É o que faltava para enxergar por
// que a sincronização "não funciona" sem mexer no Netlify às cegas.
export interface PassoDiag { etapa: string; ok: boolean; detalhe: string }
function descreverErro(e: unknown): string {
  if (e instanceof ErroHttp) {
    if (e.status === 401) return "401 Não autorizado — o token do app é DIFERENTE do SYNC_TOKEN do Netlify (ou faltou login).";
    if (e.status === 500) return `500 no servidor — provável Netlify Blobs não ativo/sem permissão. (${(e.message || "").slice(0, 140)})`;
    if (e.status === 404) return "404 — a função /sync não foi publicada (confira o deploy do Netlify).";
    return `HTTP ${e.status} — ${(e.message || "").slice(0, 140)}`;
  }
  return "Sem resposta do servidor — offline, função fora do ar ou endpoint errado.";
}
export async function diagnosticar(): Promise<PassoDiag[]> {
  const out: PassoDiag[] = [];
  const tok = tokenCompartilhado();
  out.push({ etapa: "Modo", ok: true, detalhe: MODO_JWT ? (tokenAtual() ? "Login real (JWT) — logado" : "Login real (JWT) — sem crachá; usando token compartilhado") : "Token compartilhado (automático)" });
  out.push({ etapa: "Token no app", ok: !!tok, detalhe: tok ? `Presente (${temTokenManual() ? "colado no app" : "embutido no build"})` : "VAZIO — defina SYNC_TOKEN no Netlify (e publique) ou cole o token abaixo." });
  if (!tok && !MODO_JWT) return out; // sem token nem JWT: nada a testar
  try { const r = await chamar("ping"); out.push({ etapa: "Conexão (ping)", ok: !!r?.ok, detalhe: r?.ok ? "Servidor respondeu OK" : JSON.stringify(r).slice(0, 140) }); }
  catch (e) { out.push({ etapa: "Conexão (ping)", ok: false, detalhe: descreverErro(e) }); return out; }
  try { const r = await chamar("list", { offset: 0 }); out.push({ etapa: "Leitura (list)", ok: true, detalhe: `${r?.total ?? 0} registro(s) na nuvem` }); }
  catch (e) { out.push({ etapa: "Leitura (list)", ok: false, detalhe: descreverErro(e) }); return out; }
  try {
    const id = `diag_${Math.random().toString(36).slice(2, 10)}`;
    await chamar("upsert", { colecao: "_diagnostico", registro: { id, atualizadoEm: new Date().toISOString() } });
    await chamar("delete", { colecao: "_diagnostico", id });
    out.push({ etapa: "Gravação (ida e volta)", ok: true, detalhe: "Gravou e apagou um registro de teste na nuvem" });
  } catch (e) { out.push({ etapa: "Gravação (ida e volta)", ok: false, detalhe: descreverErro(e) }); }
  return out;
}

// --------------------------- gatilhos ---------------------------------------
// Tempo real, na prática:
//  • ENVIO é imediato — cada alteração do usuário chama enfileirar()→trySync() na
//    hora (hook abaixo), então o que você edita sobe assim que é salvo.
//  • RECEBIMENTO é "na hora de olhar" — puxa ao abrir, ao voltar a ficar online,
//    e principalmente ao FOCAR a janela / a aba ficar visível. Assim, quando você
//    olha a tela, ela já está atualizada, sem ficar consultando o servidor à toa.
//  • Um poll leve roda só ENQUANTO a aba está visível (economiza créditos do
//    Netlify; nada de chamadas com a aba em segundo plano).
registrarMutacao((colecao, tipo, id) => { if (syncHabilitado()) enfileirar(colecao, tipo, id); });
if (temWindow) {
  const ativo = () => syncHabilitado() && navigator.onLine;
  const ciclo = () => { if (ativo()) { void trySync(); void pull(); } };
  ciclo(); // ao abrir
  window.addEventListener("online", () => { recalcStatus(); ciclo(); });
  window.addEventListener("offline", () => recalcStatus());
  window.addEventListener("impresilk:autenticado", () => { recalcStatus(); ciclo(); }); // logou → já sincroniza
  window.addEventListener("focus", () => { if (ativo()) void pull(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ciclo(); });
  // Poll leve só com a aba visível (≈ a cada 20s) — sensação de tempo real sem gastar créditos à toa.
  setInterval(() => { if (ativo() && document.visibilityState === "visible") ciclo(); }, 20_000);
}
