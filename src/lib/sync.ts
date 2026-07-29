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
import { obter, definirColecao, aplicarSemSync, registrarMutacao, registrarPosImport, obterConfig, salvarConfig } from "@/lib/store";
import { MODO_JWT, tokenAtual } from "@/lib/auth";
import { obterSessao } from "@/lib/session";

// Coleções que o app pode baixar ANTES de alguém entrar. Só o cadastro de acesso
// (com a senha em hash) — nada de folha, ficha, documento ou prontuário.
const COLECOES_PRE_LOGIN = ["usuarios"];

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
// Escrita resiliente: se a cota do navegador estourar, NÃO deixa a exceção subir
// (antes ela estourava dentro do salvar() do formulário, o toast de sucesso não
// aparecia e o usuário clicava de novo, duplicando o lançamento). Avisa a UI pelo
// mesmo evento que o store usa.
function guardar(chave: string, valor: string): boolean {
  if (!temWindow) return true;
  try { localStorage.setItem(chave, valor); return true; } catch {
    try { window.dispatchEvent(new CustomEvent("impresilk:armazenamento-cheio", { detail: { key: chave } })); } catch { /* ignora */ }
    return false;
  }
}
function gravarCfg(patch: Partial<CfgSync>) { guardar(K_CFG, JSON.stringify({ ...lerCfg(), ...patch })); }
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
  // Alteração que não subiu depois de todas as tentativas: precisa aparecer.
  if (falhasSync().length) return setStatus("erro");
  if (temWindow && !navigator.onLine) return setStatus("offline");
  setStatus(fila.length || lerMassa().length ? "pending" : "ok");
}

// -------------------------------- fila --------------------------------------
function lerFila(): Acao[] { if (!temWindow) return []; try { return JSON.parse(localStorage.getItem(K_FILA) || "[]"); } catch { return []; } }
function gravarFila(f: Acao[]) { guardar(K_FILA, JSON.stringify(f)); }
const mesma = (a: Acao, b: { colecao: string; id: string }) => a.colecao === b.colecao && a.id === b.id;
export function pendentesSync(): number { return lerFila().filter((a) => !a.conflito).length + lerMassa().length; }
export function conflitosSync(): Acao[] { return lerFila().filter((a) => a.conflito); }

// ---- fila de envios em massa que falharam ----
// enviarColecao era "best-effort": se a internet caísse na hora de uma importação,
// a coleção ficava só local e NINGUÉM ficava sabendo (foi assim que o plano de
// contas ficou meses sem subir). Agora a coleção que falhou entra nesta fila e é
// retentada a cada ciclo até subir — e o status mostra a pendência.
const K_MASSA = `${NS}.massa`;
function lerMassa(): string[] { if (!temWindow) return []; try { return JSON.parse(localStorage.getItem(K_MASSA) || "[]"); } catch { return []; } }
function gravarMassa(nomes: string[]) { guardar(K_MASSA, JSON.stringify([...new Set(nomes)])); }

// ---- caixa de falhas (o que não subiu depois de MAX_TENTATIVAS) ----
// Antes essas ações eram descartadas em silêncio. Agora ficam aqui, visíveis na
// tela de sincronização, com o erro — e podem ser recolocadas na fila.
export interface FalhaSync { tipo: Tipo; colecao: string; id: string; erro: string; em: string }
const K_FALHAS = `${NS}.falhas`;
export function falhasSync(): FalhaSync[] {
  if (!temWindow) return [];
  try { return JSON.parse(localStorage.getItem(K_FALHAS) || "[]"); } catch { return []; }
}
function registrarFalha(f: FalhaSync) {
  const atuais = falhasSync().filter((x) => !(x.colecao === f.colecao && x.id === f.id && x.tipo === f.tipo));
  guardar(K_FALHAS, JSON.stringify([f, ...atuais].slice(0, 200)));
  ouvintes.forEach((cb) => cb());
}
/** Recoloca as ações que falharam de volta na fila (botão "tentar de novo"). */
export function retentarFalhas(): number {
  const fs = falhasSync();
  if (!fs.length) return 0;
  const fila = lerFila();
  for (const f of fs) if (!fila.some((a) => mesma(a, { colecao: f.colecao, id: f.id }) && a.tipo === f.tipo)) fila.push({ tipo: f.tipo, colecao: f.colecao, id: f.id });
  gravarFila(fila);
  guardar(K_FALHAS, "[]");
  recalcStatus();
  void trySync();
  return fs.length;
}
export function limparFalhas(): void { guardar(K_FALHAS, "[]"); ouvintes.forEach((cb) => cb()); }
function marcarMassaPendente(nome: string) { gravarMassa([...lerMassa(), nome]); }

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
          const enviadoTs = registro.atualizadoEm; // versão que estamos mandando
          const resp = await chamar("upsert", { colecao: acao.colecao, registro });
          if (resp?.conflito) {
            gravarFila(lerFila().map((a) => (mesma(a, acao) && a.tipo === "upsert" ? { ...a, conflito: true, servidor: resp.servidor } : a)));
            continue;
          }
          // Sucesso → tira da fila SÓ se não houve edição durante o envio (atualizadoEm
          // ainda bate). Se o usuário salvou de novo "em voo", a versão nova permanece
          // na fila e sobe no próximo ciclo — nenhuma edição se perde.
          const atual = (obter(acao.colecao as never) as unknown as Reg[]).find((r) => r.id === acao.id);
          if (!atual || atual.atualizadoEm === enviadoTs) {
            gravarFila(lerFila().filter((a) => !mesma(a, acao)));
          }
        } else {
          await chamar("delete", { colecao: acao.colecao, id: acao.id });
          gravarFila(lerFila().filter((a) => !mesma(a, acao))); // delete é idempotente → remove
        }
      } catch (e) {
        if (eRede(e)) { setStatus("offline"); return; } // para o ciclo; retenta no próximo gatilho
        // Falha PERMANENTE (token errado, 403 de escopo, 500 do Blobs): conta a
        // tentativa. Ao bater o limite, NÃO descarta em silêncio (era assim antes,
        // e a alteração do usuário sumia sem ninguém saber): move para a caixa de
        // falhas, que fica visível e pode ser retentada à mão.
        const msg = e instanceof ErroHttp ? `HTTP ${e.status} — ${(e.message || "").slice(0, 120)}` : "Falha desconhecida";
        const fila = lerFila().map((a) => (mesma(a, acao) && a.tipo === acao.tipo ? { ...a, falhas: (a.falhas ?? 0) + 1 } : a));
        const estourou = fila.find((a) => mesma(a, acao) && a.tipo === acao.tipo && (a.falhas ?? 0) >= MAX_TENTATIVAS);
        if (estourou) {
          registrarFalha({ tipo: estourou.tipo, colecao: estourou.colecao, id: estourou.id, erro: msg, em: new Date().toISOString() });
          gravarFila(fila.filter((a) => !(mesma(a, acao) && a.tipo === acao.tipo)));
        } else {
          gravarFila(fila);
        }
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

// Versão dos dados vista no último pull completo. O servidor incrementa a cada
// escrita; se não mudou, o pull pula o download completo (1 chamada leve em vez
// de baixar TODOS os registros a cada ciclo — economia grande de créditos).
//
// GUARDADO NO NAVEGADOR: antes isto era só uma variável em memória, então TODA
// vez que a página abria (ou era recarregada) o app baixava os ~3.300 registros
// de novo, mesmo sem nada ter mudado. Agora ele lembra entre as sessões.
const K_REV = `${NS}.rev`;
interface RevGravada { rev: number | null; porColecao: Record<string, number> }
function lerRev(): RevGravada {
  if (!temWindow) return { rev: null, porColecao: {} };
  try {
    const r = JSON.parse(localStorage.getItem(K_REV) || "{}");
    return { rev: typeof r.rev === "number" ? r.rev : null, porColecao: r.porColecao ?? {} };
  } catch { return { rev: null, porColecao: {} }; }
}
function gravarRev(r: RevGravada) { guardar(K_REV, JSON.stringify(r)); }
/** Esquece o que já foi baixado — o próximo pull traz tudo de novo. */
function zerarRev() { if (temWindow) { try { localStorage.removeItem(K_REV); } catch { /* ignora */ } } }

export async function pull(): Promise<void> {
  if (!syncHabilitado()) return;
  if (temWindow && !navigator.onLine) { setStatus("offline"); return; }
  setStatus("syncing");
  const epocaInicio = epocaDados;
  // SEM NINGUÉM LOGADO o app não baixa a base: antes bastava abrir o endereço
  // para o navegador puxar folha, CPFs e prontuários inteiros para o disco, sem
  // digitar nada. Agora, deslogado, ele traz só `usuarios` — o mínimo para
  // conferir a senha num computador novo (e lá só existe o hash, não a senha).
  const restrito = !obterSessao();
  const conhecida = lerRev();
  try {
    let revAtual: number | null = null;
    let revPorColecao: Record<string, number> | null = null;
    // Quais coleções pedir. `null` = todas (primeiro pull, ou servidor antigo
    // que ainda não manda o mapa por coleção).
    let pedir: string[] | null = restrito ? [...COLECOES_PRE_LOGIN] : null;
    if (!restrito) {
      try {
        const r = (await chamar("rev")) as { rev?: number | null; porColecao?: Record<string, number> | null };
        revAtual = r?.rev ?? null;
        revPorColecao = r?.porColecao ?? null;
      } catch { revAtual = null; }
      if (revAtual !== null && conhecida.rev !== null && revAtual === conhecida.rev) { recalcStatus(); return; } // nada mudou
      // Baixa SÓ as coleções cujo contador mudou. Antes qualquer alteração —
      // até um log de acesso — obrigava a rebaixar a base inteira.
      if (revPorColecao && conhecida.rev !== null) {
        pedir = NOMES_COLECOES.filter((n) => (revPorColecao![n] ?? 0) > (conhecida.porColecao[n] ?? 0));
        if (pedir.length === 0) {
          // Nada de dados mudou (só o contador geral): apenas anota e sai.
          gravarRev({ rev: revAtual, porColecao: { ...conhecida.porColecao, ...revPorColecao } });
          recalcStatus();
          return;
        }
      }
    }
    const remoto = new Map<string, Envelope>();
    // Paginação por CHAVE (keyset): manda a última chave vista em `after`. Fallback
    // para offset se o servidor for antigo (só devolve nextOffset). Guard de páginas
    // evita laço infinito caso um servidor bugado nunca sinalize o fim.
    let after: string | null = null;
    let offset = 0;
    let usaKeyset = true;
    for (let pag = 0; pag < 500; pag++) {
      const resp = await chamar("list", { ...(usaKeyset ? { after } : { offset }), ...(pedir ? { colecoes: pedir } : {}) });
      for (const env of (resp.registros ?? []) as Envelope[]) if (env?.registro?.id) remoto.set(`${env.colecao}::${env.registro.id}`, env);
      if ("nextAfter" in resp) {
        if (resp.nextAfter == null) break; // keyset terminou
        after = String(resp.nextAfter);
      } else if (resp.nextOffset != null) {
        usaKeyset = false; offset = Number(resp.nextOffset); // servidor antigo → offset
      } else {
        break; // sem próxima página
      }
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
            if (remNovo) {
              // Servidor mais novo vence. Se for LÁPIDE (exclusão remota), o registro
              // some local — é o que impede o dado de "ressuscitar" no próximo pull.
              if (!rem._apagado) merged.push(rem);
            } else {
              merged.push(loc); // local mais novo vence (até uma edição posterior à exclusão)
            }
            remMap.delete(loc.id);
          } else {
            merged.push(loc); // sem par na nuvem → PRESERVA o local (pull nunca apaga às cegas)
            // (registro ausente ≠ apagado: ausência pode ser nuvem incompleta. Só uma
            //  lápide explícita remove — ver acima.)
          }
        }
        for (const rem of remMap.values()) if (!rem._apagado) merged.push(rem); // novos do servidor (ignora lápides)
        definirColecao(nome as never, merged as never);
      }
    });
    // Só memoriza a revisão quando o retrato foi COMPLETO — senão um pull restrito
    // (deslogado) faria o app achar que já tem tudo e nunca baixar o resto.
    if (!restrito) {
      const marcos = { ...conhecida.porColecao };
      // Marca como em dia apenas as coleções que ESTE pull trouxe.
      for (const n of pedir ?? NOMES_COLECOES) if (revPorColecao?.[n] != null) marcos[n] = revPorColecao[n];
      gravarRev({ rev: revAtual, porColecao: marcos });
    }
    recalcStatus();
  } catch (e) {
    // pull roda em segundo plano (ao abrir, online, a cada minuto): nunca propaga
    // a exceção — apenas reflete no status. Erro de rede → offline; HTTP → erro.
    setStatus(eRede(e) ? "offline" : "erro");
  }
}

// ---- prévia do "tornar este computador oficial" ----
// Sobrescrever a nuvem com o conteúdo daqui é a ação mais destrutiva do app: se
// este computador estiver com a base pela metade, o que falta some da nuvem para
// todo mundo. Antes só havia um aviso de texto. Aqui a gente compara de verdade.
export interface LinhaOficial { colecao: string; aqui: number; naNuvem: number; some: number }
export async function previaEnviarTudo(): Promise<{ linhas: LinhaOficial[]; someTotal: number }> {
  if (!syncHabilitado()) throw new Error("Configure a sincronização primeiro.");
  const resp = (await chamar("resumo")) as { contagem?: Record<string, number> };
  const contagem = resp?.contagem ?? {};
  const linhas: LinhaOficial[] = [];
  for (const nome of NOMES_COLECOES) {
    const aqui = (obter(nome) as unknown as Reg[]).filter((r) => r?.id).length;
    const naNuvem = contagem[nome] ?? 0;
    if (aqui || naNuvem) linhas.push({ colecao: nome, aqui, naNuvem, some: Math.max(0, naNuvem - aqui) });
  }
  return { linhas: linhas.sort((a, b) => b.some - a.some), someTotal: linhas.reduce((s, l) => s + l.some, 0) };
}

/**
 * Faxina das lápides antigas na nuvem (marcadores de exclusão que nunca saíam).
 * `simular` só conta, sem apagar nada.
 */
export async function limparLapides(dias = 180, simular = false): Promise<number> {
  if (!syncHabilitado()) throw new Error("Configure a sincronização primeiro.");
  const r = (await chamar("limparLapides", { dias, simular })) as { encontradas?: number; removidas?: number };
  return r?.removidas ?? r?.encontradas ?? 0;
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
// Carimba atualizadoEm onde faltar e nunca quebra o fluxo da tela. Se falhar
// (sem rede, servidor fora), a coleção entra na fila de massa e é retentada a
// cada ciclo — nada de falha silenciosa. Retorna true quando subiu.
export async function enviarColecao(nome: string): Promise<boolean> {
  if (!syncHabilitado()) return false;
  if (temWindow && !navigator.onLine) { marcarMassaPendente(nome); recalcStatus(); return false; }
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
    gravarMassa(lerMassa().filter((n) => n !== nome)); // subiu: sai da fila de retentativa
    return true;
  } catch {
    marcarMassaPendente(nome); // fica na fila e retenta no próximo ciclo (status mostra pendência)
    return false;
  } finally {
    recalcStatus();
  }
}

// Enfileira EXCLUSÕES (lápides) de registros específicos. Serve para as
// importações que SUBSTITUEM dados (folha, comissões, plano de contas): os
// registros antigos que saíram no `definir` precisam de lápide, senão continuam
// na nuvem com ids diferentes e VOLTAM no próximo pull — foi exatamente o que
// duplicou a folha de maio/junho. Sem sync ligado, não faz nada (fica só local).
export function apagarRegistrosNuvem(colecao: string, ids: string[]): void {
  if (!syncHabilitado()) return;
  for (const id of ids) if (id) enfileirar(colecao, "delete", id);
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
  zerarRev(); // o retrato que o app tinha ficou obsoleto: próximo pull vem completo
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
      if (env.registro._apagado) {
        definirColecao(colecao as never, arr.filter((r) => r.id !== id) as never); // servidor apagou → some local
        return;
      }
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

// --------------------- config global (nome/cores da empresa) -----------------
// Antes a config só subia no "Enviar tudo" e NUNCA descia — cada computador
// ficava com a sua. Agora: sobe quando o RH salva (com debounce, para não
// disparar a cada arrasto do seletor de cor) e desce uma vez ao abrir o app.
let cfgTimer: ReturnType<typeof setTimeout> | null = null;
export function enviarConfigNuvem(): void {
  if (!syncHabilitado()) return;
  if (cfgTimer) clearTimeout(cfgTimer);
  cfgTimer = setTimeout(() => { void chamar("setCfg", { config: obterConfig() }).catch(() => { /* retenta no próximo salvar */ }); }, 1500);
}
async function puxarConfig(): Promise<void> {
  if (!syncHabilitado()) return;
  try {
    const r = (await chamar("getCfg")) as { config?: { config?: Record<string, unknown> } | Record<string, unknown> | null };
    const c = ((r?.config as { config?: Record<string, unknown> })?.config ?? r?.config) as Record<string, unknown> | null;
    if (c && typeof c === "object" && !Array.isArray(c)) salvarConfig(c as never);
  } catch { /* offline ou sem config remota — segue com a local */ }
}

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
// Restaurar um backup (importarDados) grava direto no store, sem passar pelo gancho
// de mutação — então empurramos cada coleção importada para a nuvem aqui.
registrarPosImport((colecoes) => { if (syncHabilitado()) for (const nome of colecoes) void enviarColecao(nome); });
if (temWindow) {
  const ativo = () => syncHabilitado() && navigator.onLine;
  const ciclo = () => {
    if (!ativo()) return;
    for (const nome of lerMassa()) void enviarColecao(nome); // retenta importações que falharam
    void trySync();
    void pull();
  };
  ciclo(); // ao abrir
  void puxarConfig(); // config da empresa desce uma vez, ao abrir
  window.addEventListener("online", () => { recalcStatus(); ciclo(); });
  window.addEventListener("offline", () => recalcStatus());
  // Logou → baixa a base completa. Zera a revisão memorizada, senão o pull
  // restrito de antes do login faria o app achar que já está em dia.
  window.addEventListener("impresilk:autenticado", () => { zerarRev(); recalcStatus(); ciclo(); });
  window.addEventListener("focus", () => { if (ativo()) void pull(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ciclo(); });
  // Poll leve só com a aba visível (≈ a cada 20s) — sensação de tempo real sem gastar créditos à toa.
  setInterval(() => { if (ativo() && document.visibilityState === "visible") ciclo(); }, 20_000);
}
