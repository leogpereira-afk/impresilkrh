// ============================================================================
// Sincronização offline-first (cliente). Escreve local na hora; enfileira a
// ação; tenta sincronizar com a nuvem (Netlify Function) quando online.
// Reconcilia por timestamp (atualizadoEm). Backend trocável (contrato estável).
// É OPT-IN: enquanto não houver token configurado, nada é enviado e o app
// funciona 100% local, como antes.
// ============================================================================
import { NOMES_COLECOES } from "@/data";
import { obter, definirColecao, aplicarSemSync, registrarMutacao, obterConfig } from "@/lib/store";

const temWindow = typeof window !== "undefined";
const NS = "impresilk.sync";
const K_FILA = `${NS}.fila`;
const K_CFG = `${NS}.cfg`;
const ENDPOINT_PADRAO = "/.netlify/functions/sync";
const MAX_TENTATIVAS = 25; // descarta a ação após N falhas permanentes
const LOTE_PUSH = 100; // registros por chamada no envio em massa

type Tipo = "upsert" | "delete";
interface Acao { tipo: Tipo; colecao: string; id: string; falhas?: number; conflito?: boolean; servidor?: Envelope | null }
interface Envelope { colecao: string; registro: Reg }
type Reg = { id: string; atualizadoEm?: string } & Record<string, unknown>;
export type StatusSync = "off" | "ok" | "pending" | "offline" | "syncing" | "conflito" | "erro";

// ---------------------------- configuração ----------------------------------
interface CfgSync { endpoint: string; token: string; habilitado: boolean }
function lerCfg(): CfgSync {
  const base: CfgSync = { endpoint: ENDPOINT_PADRAO, token: "", habilitado: false };
  if (!temWindow) return base;
  try { return { ...base, ...JSON.parse(localStorage.getItem(K_CFG) || "{}") }; } catch { return base; }
}
function gravarCfg(c: CfgSync) { if (temWindow) localStorage.setItem(K_CFG, JSON.stringify(c)); }
export function configSync(): CfgSync { return lerCfg(); }
export function syncHabilitado(): boolean { const c = lerCfg(); return c.habilitado && !!c.token; }

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
  const { endpoint, token } = lerCfg();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json", "x-token": token },
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
export async function pull(): Promise<void> {
  if (!syncHabilitado()) return;
  setStatus("syncing");
  try {
    const remoto = new Map<string, Envelope>();
    let offset: number | null = 0;
    while (offset !== null) {
      const resp = await chamar("list", { offset });
      for (const env of (resp.registros ?? []) as Envelope[]) if (env?.registro?.id) remoto.set(`${env.colecao}::${env.registro.id}`, env);
      offset = resp.nextOffset ?? null;
    }
    const porColecao = new Map<string, Reg[]>();
    for (const { colecao, registro } of remoto.values()) { const arr = porColecao.get(colecao) ?? []; arr.push(registro); porColecao.set(colecao, arr); }
    const naFila = new Set(lerFila().map((a) => `${a.colecao}::${a.id}`));

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
          } else if (naFila.has(`${nome}::${loc.id}`)) {
            merged.push(loc); // pendente local → preserva
          } // senão: sumiu do servidor → remove
        }
        for (const rem of remMap.values()) merged.push(rem); // novos do servidor
        definirColecao(nome as never, merged as never);
      }
    });
  } finally {
    recalcStatus();
  }
}

// ----------------- envio em massa (computador "oficial") --------------------
export async function enviarTudo(): Promise<void> {
  if (!syncHabilitado()) throw new Error("Configure a sincronização primeiro.");
  setStatus("syncing");
  try {
    const agora = new Date().toISOString();
    const lote: Envelope[] = [];
    aplicarSemSync(() => {
      for (const nome of NOMES_COLECOES) {
        const carimbados = (obter(nome) as unknown as Reg[]).map((r) => (r.atualizadoEm ? r : { ...r, atualizadoEm: agora }));
        definirColecao(nome as never, carimbados as never); // grava o carimbo local também
        for (const r of carimbados) lote.push({ colecao: nome, registro: r });
      }
    });
    for (let i = 0; i < lote.length; i += LOTE_PUSH) await chamar("bulkUpsert", { registros: lote.slice(i, i + LOTE_PUSH) });
    await chamar("setCfg", { config: obterConfig() });
    gravarFila([]); // tudo já está no servidor
  } finally {
    recalcStatus();
  }
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
export async function testarConexao(endpoint: string, token: string): Promise<boolean> {
  const res = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-token": token }, body: JSON.stringify({ action: "ping" }) });
  return res.ok;
}
export function configurarSync(patch: Partial<CfgSync>) {
  gravarCfg({ ...lerCfg(), ...patch });
  recalcStatus();
  if (syncHabilitado()) { void trySync(); void pull(); }
}
export async function sincronizarAgora(): Promise<void> { await trySync(); await pull(); }

// --------------------------- gatilhos ---------------------------------------
// Hook chamado pelo store em cada mutação do usuário (só enfileira se ligado).
registrarMutacao((colecao, tipo, id) => { if (syncHabilitado()) enfileirar(colecao, tipo, id); });
if (temWindow) {
  window.addEventListener("online", () => { recalcStatus(); void trySync(); });
  window.addEventListener("offline", () => recalcStatus());
  // Tentativa periódica leve enquanto houver pendências/online (puxa updates de outras máquinas).
  setInterval(() => { if (syncHabilitado() && navigator.onLine) { void trySync(); } }, 60_000);
}
