// ============================================================================
// Sincronização offline-first (cliente). Escreve local na hora; enfileira a
// ação; tenta sincronizar com a nuvem (Supabase Edge Function) quando online.
// Reconcilia por timestamp (atualizadoEm). Backend trocável (contrato estável).
//
// Exige login real (Supabase Auth) — não há mais token compartilhado embutido
// no build. Sem sessão válida, a sincronização fica desligada e o app funciona
// 100% local (como antes).
// ============================================================================
import { NOMES_COLECOES } from "@/data";
import { obter, definirColecao, obterDinamico, definirColecaoDinamica, aplicarSemSync, registrarMutacao, registrarPosImport, obterConfig, chavesSujasDaConfig, confirmarChavesEnviadas, aplicarConfigDaNuvem, type RegistroGenerico } from "@/lib/store";
import type { Config } from "@/data/types";
import { MODO_JWT, tokenAtual } from "@/lib/auth";
import { FN_SYNC } from "@/lib/supabase";
import { obterSessao } from "@/lib/session";
import { chaveLocal, contextoDoUsuario, lerLocal, removerLocal } from "./armazenamentoUsuario";
import { gravarArmazem } from "./armazemLocal";
import { prepararCopiaAnterior } from "./copiaAnterior";

// Coleções que o app pode baixar ANTES de alguém entrar. Como o Supabase exige
// sessão para responder, na prática este pull restrito não roda deslogado
// (syncHabilitado() é falso sem sessão) — fica aqui só como intenção/contrato.
const COLECOES_PRE_LOGIN = ["usuarios"];

const temWindow = typeof window !== "undefined";
const NS = "impresilk.sync";
const K_FILA = `${NS}.fila`;
const K_CFG = `${NS}.cfg`;
const MAX_TENTATIVAS = 25; // descarta a ação após N falhas permanentes

// Cabeçalho de autorização: o crachá (JWT) da sessão do Supabase Auth.
function cabecalhoAuth(): Record<string, string> {
  const t = tokenAtual();
  return t ? { authorization: `Bearer ${t}` } : {};
}

type Tipo = "upsert" | "delete";
interface Acao { mutationId?: string; baseVersao?: number; tipo: Tipo; colecao: string; id: string; falhas?: number; conflito?: boolean; servidor?: Envelope | null }
interface Envelope { colecao: string; registro: Reg }
type Reg = { id: string; atualizadoEm?: string } & Record<string, unknown>;
export type StatusSync = "off" | "ok" | "pending" | "offline" | "syncing" | "conflito" | "erro";

// ---------------------------- configuração ----------------------------------
// O usuário só pode (opcionalmente) DESLIGAR a sincronização neste computador.
interface CfgSync { desligado: boolean }
function lerCfg(): CfgSync {
  const base: CfgSync = { desligado: false };
  if (!temWindow) return base;
  try { return { ...base, ...JSON.parse(lerLocal(K_CFG) || "{}") }; } catch { return base; }
}
// Escrita resiliente: se a cota do navegador estourar, NÃO deixa a exceção subir
// (antes ela estourava dentro do salvar() do formulário, o toast de sucesso não
// aparecia e o usuário clicava de novo, duplicando o lançamento). Avisa a UI pelo
// mesmo evento que o store usa.
function guardar(chave: string, valor: string): boolean {
  if (!temWindow) return true;
  try { if (!gravarArmazem(chaveLocal(chave), valor)) throw new Error("sem espaço"); return true; } catch {
    try { window.dispatchEvent(new CustomEvent("impresilk:armazenamento-cheio", { detail: { key: chave } })); } catch { /* ignora */ }
    return false;
  }
}
function gravarCfg(patch: Partial<CfgSync>) { guardar(K_CFG, JSON.stringify({ ...lerCfg(), ...patch })); }
// A nuvem está configurada? Basta o Supabase estar presente no build (login real).
export function syncConfigurado(): boolean { return MODO_JWT; }
export function configSync(): CfgSync & { configurado: boolean; modoJwt: boolean } {
  return { ...lerCfg(), configurado: syncConfigurado(), modoJwt: MODO_JWT };
}
// Habilitado para sincronizar agora? Só com login real (crachá válido).
export function syncHabilitado(): boolean {
  if (lerCfg().desligado) return false;
  return MODO_JWT ? !!tokenAtual() : false;
}
export function ligarSync(): void { gravarCfg({ desligado: false }); recalcStatus(); if (syncHabilitado()) { void trySync(); void pull(); } }
export function desligarSync(): void { gravarCfg({ desligado: true }); recalcStatus(); }

// ------------------------------- status -------------------------------------
let status: StatusSync = syncHabilitado() ? "pending" : "off";
const erros = new Map<string, { leitura?: StatusSync; envio?: StatusSync }>();
function marcarErro(tipo: "leitura" | "envio", erro?: unknown) {
  const contexto = contextoDoUsuario();
  const atual = erros.get(contexto) ?? {};
  atual[tipo] = erro == null ? undefined : eRede(erro) ? "offline" : "erro";
  erros.set(contexto, atual);
}
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
  const falha = erros.get(contextoDoUsuario());
  if (falha?.leitura || falha?.envio) return setStatus(falha.leitura ?? falha.envio!);
  setStatus(fila.length || lerMassa().length ? "pending" : "ok");
}

// -------------------------------- fila --------------------------------------
function lerFila(): Acao[] { if (!temWindow) return []; try { return JSON.parse(lerLocal(K_FILA) || "[]"); } catch { return []; } }
function gravarFila(f: Acao[]) { if (!guardar(K_FILA, JSON.stringify(f))) throw new Error("Não foi possível guardar a fila de alterações. Libere espaço neste aparelho."); }
const novaMutacao = () => crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, "0")).join("");
const mesma = (a: Acao, b: { colecao: string; id: string }) => a.colecao === b.colecao && a.id === b.id;
export function pendentesSync(): number { return lerFila().filter((a) => !a.conflito).length + lerMassa().length; }
export function conflitosSync(): Acao[] { return lerFila().filter((a) => a.conflito); }

// ---- fila de envios em massa que falharam ----
// enviarColecao era "best-effort": se a internet caísse na hora de uma importação,
// a coleção ficava só local e NINGUÉM ficava sabendo (foi assim que o plano de
// contas ficou meses sem subir). Agora a coleção que falhou entra nesta fila e é
// retentada a cada ciclo até subir — e o status mostra a pendência.
const K_MASSA = `${NS}.massa`;
const K_RESTAURACOES = `${NS}.restauracoes`;
function restauracoesPendentes(): string[] { try { return JSON.parse(lerLocal(K_RESTAURACOES) || "[]"); } catch { return []; } }
function lerMassa(): string[] { if (!temWindow) return []; try { return JSON.parse(lerLocal(K_MASSA) || "[]"); } catch { return []; } }
function gravarMassa(nomes: string[]) { if (!guardar(K_MASSA, JSON.stringify([...new Set(nomes)]))) throw new Error("Não foi possível guardar a importação pendente."); }

// ---- caixa de falhas (o que não subiu depois de MAX_TENTATIVAS) ----
// Antes essas ações eram descartadas em silêncio. Agora ficam aqui, visíveis na
// tela de sincronização, com o erro — e podem ser recolocadas na fila.
export interface FalhaSync { tipo: Tipo; colecao: string; id: string; erro: string; em: string }
const K_FALHAS = `${NS}.falhas`;
export function falhasSync(): FalhaSync[] {
  if (!temWindow) return [];
  try { return JSON.parse(lerLocal(K_FALHAS) || "[]"); } catch { return []; }
}
function registrarFalha(f: FalhaSync) {
  const atuais = falhasSync().filter((x) => !(x.colecao === f.colecao && x.id === f.id && x.tipo === f.tipo));
  if (!guardar(K_FALHAS, JSON.stringify([f, ...atuais]))) throw new Error("Não foi possível preservar a alteração que falhou.");
  ouvintes.forEach((cb) => cb());
}
/** Recoloca as ações que falharam de volta na fila (botão "tentar de novo"). */
export function retentarFalhas(): number {
  const fs = falhasSync();
  if (!fs.length) return 0;
  const fila = lerFila();
  for (const f of fs) if (!fila.some((a) => mesma(a, { colecao: f.colecao, id: f.id }) && a.tipo === f.tipo)) fila.push({ mutationId: novaMutacao(), tipo: f.tipo, colecao: f.colecao, id: f.id });
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
function enfileirar(colecao: string, tipo: Tipo, id: string, baseVersao?: number) {
  let fila = lerFila();
  if (tipo === "delete") {
    fila = fila.filter((a) => !(mesma(a, { colecao, id }) && a.tipo === "upsert"));
    if (!fila.some((a) => mesma(a, { colecao, id }) && a.tipo === "delete")) fila.push({ mutationId: novaMutacao(), baseVersao, tipo: "delete", colecao, id });
  } else {
    fila = fila.filter((a) => !(mesma(a, { colecao, id }) && a.tipo === "upsert" && !a.conflito));
    fila.push({ mutationId: novaMutacao(), baseVersao, tipo: "upsert", colecao, id });
  }
  gravarFila(fila);
  recalcStatus();
  void trySync();
}

// ------------------------------- HTTP ---------------------------------------
class ErroHttp extends Error { constructor(public status: number, msg: string) { super(msg); } }
class SessaoAlterada extends Error {}
async function chamar(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const contexto = contextoDoUsuario();
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), 30_000);
  try {
    const res = await fetch(FN_SYNC, {
      method: "POST", signal: controle.signal,
      headers: { "content-type": "application/json", ...cabecalhoAuth() },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await res.json();
    if (contexto !== contextoDoUsuario()) throw new SessaoAlterada("A sessão mudou.");
    if (!res.ok || data?.ok === false || data?.erro || data?.error) throw new ErroHttp(res.ok ? 422 : res.status, data?.erro || data?.error || "O servidor recusou a operação.");
    return data;
  } finally { clearTimeout(timer); }
}
const eRede = (e: unknown) => e instanceof TypeError || (e instanceof Error && e.name === "AbortError");

// --------------------------- envio (push) -----------------------------------
let _syncing = false;
export async function trySync(): Promise<void> {
  if (!syncHabilitado() || _syncing) return;
  if (temWindow && !navigator.onLine) { setStatus("offline"); return; }
  _syncing = true;
  marcarErro("envio");
  setStatus("syncing");
  try {
    for (const acao of lerFila().filter((a) => !a.conflito)) {
      try {
        if (acao.tipo === "upsert") {
          const registro = (obterDinamico(acao.colecao) as unknown as Reg[]).find((r) => r.id === acao.id);
          if (!registro) { gravarFila(lerFila().filter((a) => !mesma(a, acao))); continue; } // sumiu local
          const resp = await chamar("upsert", { colecao: acao.colecao, registro, baseVersao: acao.baseVersao, mutationId: acao.mutationId });
          if (resp?.conflito) {
            gravarFila(lerFila().map((a) => (mesma(a, acao) && a.mutationId === acao.mutationId ? { ...a, conflito: true, servidor: resp.servidor } : a)));
            continue;
          }
          // A confirmação pertence ao envio A. Uma edição B, mesmo no mesmo
          // milissegundo, tem outra identificação e continua aguardando envio.
          if (Number.isSafeInteger(resp.versao)) {
            aplicarSemSync(() => definirColecaoDinamica(acao.colecao, obterDinamico(acao.colecao).map(r => r.id === acao.id ? { ...r, _rhRev: resp.versao } : r)));
          }
          gravarFila(lerFila().filter(a => !(mesma(a, acao) && a.mutationId === acao.mutationId)).map(a => mesma(a, acao) && Number.isSafeInteger(resp.versao) ? { ...a, baseVersao: resp.versao } : a));

        } else {
          const resp = await chamar("delete", { colecao: acao.colecao, id: acao.id, baseVersao: acao.baseVersao, mutationId: acao.mutationId });
          if (resp?.conflito) {
            gravarFila(lerFila().map(a => mesma(a, acao) && a.mutationId === acao.mutationId ? { ...a, conflito: true, servidor: resp.servidor } : a));
            continue;
          }
          gravarFila(lerFila().filter((a) => !(mesma(a, acao) && a.mutationId === acao.mutationId))); // delete é idempotente → remove
        }
      } catch (e) {
        if (e instanceof SessaoAlterada) return;
        marcarErro("envio", e);
        if (eRede(e)) { setStatus("offline"); return; } // para o ciclo; retenta no próximo gatilho
        // Falha PERMANENTE (token errado, 403 de escopo, 500 do Blobs): conta a
        // tentativa. Ao bater o limite, NÃO descarta em silêncio (era assim antes,
        // e a alteração do usuário sumia sem ninguém saber): move para a caixa de
        // falhas, que fica visível e pode ser retentada à mão.
        const msg = e instanceof ErroHttp ? `HTTP ${e.status} — ${(e.message || "").slice(0, 120)}` : "Falha desconhecida";
        const fila = lerFila().map((a) => (mesma(a, acao) && a.mutationId === acao.mutationId ? { ...a, falhas: (a.falhas ?? 0) + 1 } : a));
        const estourou = fila.find((a) => mesma(a, acao) && a.mutationId === acao.mutationId && (a.falhas ?? 0) >= MAX_TENTATIVAS);
        if (estourou) {
          registrarFalha({ tipo: estourou.tipo, colecao: estourou.colecao, id: estourou.id, erro: msg, em: new Date().toISOString() });
          gravarFila(fila.filter((a) => !(mesma(a, acao) && a.mutationId === acao.mutationId)));
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
    const r = JSON.parse(lerLocal(K_REV) || "{}");
    return { rev: typeof r.rev === "number" ? r.rev : null, porColecao: r.porColecao ?? {} };
  } catch { return { rev: null, porColecao: {} }; }
}
function gravarRev(r: RevGravada) { guardar(K_REV, JSON.stringify(r)); }
/** Esquece o que já foi baixado — o próximo pull traz tudo de novo. */
function zerarRev() { if (temWindow) { try { removerLocal(K_REV); } catch { /* ignora */ } } }
/**
 * Depois de "Restaurar padrão": a base local foi trocada pelos defaults, mas a
 * revisão memorizada dizia que estava em dia — o pull não repunha nada e a tela
 * ficava vazia. Zera a revisão e baixa a base da nuvem de novo.
 */
export function rebaixarTudo(): void { epocaDados++; zerarRev(); if (temWindow) void pull(); }

let puxando = false;
export async function pull(): Promise<void> {
  if (!syncHabilitado() || puxando) return;
  if (temWindow && !navigator.onLine) { setStatus("offline"); return; }
  setStatus("syncing");
  const epocaInicio = epocaDados;
  puxando = true;
  // SEM NINGUÉM LOGADO o app não baixa a base: antes bastava abrir o endereço
  // para o navegador puxar folha, CPFs e prontuários inteiros para o disco, sem
  // digitar nada. Agora, deslogado, ele traz só `usuarios` — o mínimo para
  // conferir a senha num computador novo (e lá só existe o hash, não a senha).
  const restrito = !obterSessao();
  const conhecida = lerRev();
  try {
    // Libera o espaço legado somente depois de guardar e conferir a cópia.
    // Sem isso, manter o retrato antigo e o novo podia estourar a cota do navegador.
    await prepararCopiaAnterior();
    if (epocaInicio !== epocaDados) return;
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
      } catch (e) { if (e instanceof SessaoAlterada) throw e; revAtual = null; }
      if (revAtual !== null && conhecida.rev !== null && revAtual === conhecida.rev) { marcarErro("leitura"); recalcStatus(); return; }
      // Baixa SÓ as coleções cujo contador mudou. Antes qualquer alteração —
      // até um log de acesso — obrigava a rebaixar a base inteira.
      if (revPorColecao && conhecida.rev !== null) {
        pedir = NOMES_COLECOES.filter((n) => (revPorColecao![n] ?? 0) > (conhecida.porColecao[n] ?? 0));
        if (pedir.length === 0) {
          // Nada de dados mudou (só o contador geral): apenas anota e sai.
          gravarRev({ rev: revAtual, porColecao: { ...conhecida.porColecao, ...revPorColecao } });
          marcarErro("leitura");
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
    const paginasVistas = new Set<string>();
    for (;;) {
      const cursor = usaKeyset ? String(after) : String(offset);
      if (paginasVistas.has(cursor)) throw new Error("A paginação repetiu uma página. Os dados anteriores foram preservados.");
      paginasVistas.add(cursor);
      const resp = await chamar("list", { ...(usaKeyset ? { after } : { offset }), ...(pedir ? { colecoes: pedir } : {}) });
      if (!Array.isArray(resp.registros)) throw new Error("Resposta incompleta. Os dados anteriores foram preservados.");
      for (const env of resp.registros as Envelope[]) if (env?.registro?.id) remoto.set(`${env.colecao}::${env.registro.id}`, env);
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
      const fila = [...lerFila(), ...falhasSync()];
      const importacoes = new Set(lerMassa());
      for (const nome of pedir ?? NOMES_COLECOES) {
        if (importacoes.has(nome)) continue;
        const remotos = porColecao.get(nome) ?? [];
        const atuais = new Map((obterDinamico(nome) as Reg[]).map(r => [r.id, r]));
        const porId = new Map(remotos.filter(r => !r._apagado).map(r => [r.id, r]));
        // O retrato completo substitui o cache, incluindo campos removidos por
        // permissão. Apenas alterações explicitamente pendentes ficam por cima.
        for (const acao of fila.filter(a => a.colecao === nome)) {
          if (acao.tipo === "delete") porId.delete(acao.id);
          else if (atuais.has(acao.id)) porId.set(acao.id, atuais.get(acao.id)!);
        }
        definirColecaoDinamica(nome, [...porId.values()] as RegistroGenerico[]);
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
    marcarErro("leitura");
    recalcStatus();
  } catch (e) {
    // pull roda em segundo plano (ao abrir, online, a cada minuto): nunca propaga
    // a exceção — apenas reflete no status. Erro de rede → offline; HTTP → erro.
    if (!(e instanceof SessaoAlterada)) { marcarErro("leitura", e); recalcStatus(); }
  } finally { puxando = false; }
}

// ---- prévia do "tornar este computador oficial" ----
// Sobrescrever a nuvem com o conteúdo daqui é a ação mais destrutiva do app: se
// este computador estiver com a base pela metade, o que falta some da nuvem para
// todo mundo. Antes só havia um aviso de texto. Aqui a gente compara de verdade.
let revisaoConferida: number | null = null;
export interface LinhaOficial { colecao: string; aqui: number; naNuvem: number; some: number }
export async function previaEnviarTudo(): Promise<{ linhas: LinhaOficial[]; someTotal: number }> {
  if (!syncHabilitado()) throw new Error("Configure a sincronização primeiro.");
  const antes = await chamar("rev");
  const resp = (await chamar("resumo")) as { contagem?: Record<string, number>; ids?: Record<string, string[]> };
  const depois = await chamar("rev");
  if (antes.rev !== depois.rev) throw new Error("A base mudou durante a conferência. Compare novamente.");
  revisaoConferida = depois.rev ?? 0;
  const contagem = resp?.contagem ?? {};
  const linhas: LinhaOficial[] = [];
  for (const nome of NOMES_COLECOES) {
    const aqui = (obter(nome) as unknown as Reg[]).filter((r) => r?.id).length;
    const naNuvem = contagem[nome] ?? 0;
    if (aqui || naNuvem) linhas.push({ colecao: nome, aqui, naNuvem, some: (resp.ids?.[nome] ?? []).filter(id => !(obter(nome) as unknown as Reg[]).some(r => r.id === id)).length });
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
  if (!syncHabilitado() || revisaoConferida === null) throw new Error("Compare com a nuvem antes de restaurar.");
  const dados = Object.fromEntries(NOMES_COLECOES.map(nome => [nome, obter(nome)]));
  const filaInicial = new Set(lerFila().map(a => a.mutationId));
  epocaDados++; setStatus("syncing");
  try {
    await chamar("aplicarRetrato", { dados, rev: revisaoConferida, substituir: true, config: obterConfig() });
    revisaoConferida = null;
    gravarFila(lerFila().filter(a => !filaInicial.has(a.mutationId)));
    gravarMassa([]); guardar(K_MASSA_REV, "{}");
    zerarRev(); await pull();
  } finally { recalcStatus(); }
}

// Importação atômica, com revisão preservada entre tentativas e cópia no servidor.
const K_MASSA_REV = "impresilk.sync.massa-revisao";
let enviandoMassa = false;
function basesMassa(): Record<string, number> { try { return JSON.parse(lerLocal(K_MASSA_REV) || "{}"); } catch { return {}; } }
export async function enviarColecao(nome: string): Promise<boolean> {
  marcarMassaPendente(nome);
  if (!syncHabilitado() || !navigator.onLine || enviandoMassa) { recalcStatus(); return false; }
  enviandoMassa = true;
  setStatus("syncing");
  try {
    const bases = basesMassa();
    const substituir = restauracoesPendentes().includes(nome);
    // A revisão congelada entre tentativas protege a RESTAURAÇÃO (substituir):
    // ela apaga o que não vier, então tem de partir da base que o RH conferiu.
    // Para importação comum (só grava o que vier) o congelamento era um
    // defeito: o servidor confere a revisão GLOBAL, e ela anda a cada linha de
    // histórico — 1,3 s depois do congelamento já estava vencida. Resultado
    // real (07/09/2026): o plano de contas de jul/ago puxado do Mubisys ficou
    // meses "pendente" e nunca chegou à nuvem. Importação comum parte sempre
    // da revisão fresca, e em conflito tenta mais uma vez com outra fresca.
    let rev: number | null = substituir ? (bases[nome] ?? lerRev().rev) : await revisaoFresca();
    if (rev == null) throw new Error("Atualize e confira a base antes de importar.");
    if (!guardar(K_MASSA_REV, JSON.stringify({ ...bases, [nome]: rev }))) throw new Error("Não foi possível preservar a importação pendente.");
    const dados = { [nome]: obterDinamico(nome) };
    const antes = JSON.stringify(dados[nome]);
    const filaInicial = new Set(lerFila().filter(a => a.colecao === nome).map(a => a.mutationId));
    let r: { rev?: number };
    try {
      r = await chamar("aplicarRetrato", { dados, rev, substituir });
    } catch (e) {
      if (substituir || !ehConflitoDeRevisao(e)) throw e;
      rev = await revisaoFresca();
      if (rev == null) throw e;
      r = await chamar("aplicarRetrato", { dados, rev, substituir });
    }
    const seguintes = basesMassa(); delete seguintes[nome];
    for (const n of lerMassa()) if (n !== nome && (seguintes[n] ?? rev) === rev) seguintes[n] = r.rev ?? rev;
    guardar(K_MASSA_REV, JSON.stringify(seguintes));
    gravarFila(lerFila().filter(a => !filaInicial.has(a.mutationId)));
    if (JSON.stringify(obterDinamico(nome)) === antes) {
      gravarMassa(lerMassa().filter(n => n !== nome));
      guardar(K_RESTAURACOES, JSON.stringify(restauracoesPendentes().filter(n => n !== nome)));
    }
    zerarRev();
    return true;
  } catch (e) {
    // Conflito de revisão numa importação comum não pode ficar congelado: a
    // próxima volta do ciclo pede outra revisão fresca.
    if (ehConflitoDeRevisao(e) && !restauracoesPendentes().includes(nome)) {
      const seguintes = basesMassa(); delete seguintes[nome]; guardar(K_MASSA_REV, JSON.stringify(seguintes));
    }
    if (!(e instanceof SessaoAlterada)) marcarErro("envio", e);
    return false;
  } finally { enviandoMassa = false; recalcStatus(); }
}

/** A revisão global do servidor, agora — não a última que este aparelho viu. */
async function revisaoFresca(): Promise<number | null> {
  try {
    const r = (await chamar("rev")) as { rev?: number | null };
    return r?.rev ?? lerRev().rev;
  } catch {
    return lerRev().rev;
  }
}

/** O servidor recusou porque a revisão andou (rh_aplicar_retrato devolve `conflito`). */
const ehConflitoDeRevisao = (e: unknown): boolean =>
  e instanceof ErroHttp && /os dados mudaram em outro aparelho/i.test(e.message);

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
  if (!syncHabilitado() || !navigator.onLine) throw new Error("Conecte o RH à nuvem antes de limpar os lançamentos.");
  const escolhidas = [...new Set(nomes)];
  if (!escolhidas.length || escolhidas.some(nome => !(NOMES_COLECOES as readonly string[]).includes(nome))) throw new Error("Selecione coleções válidas para arquivar.");
  epocaDados++;
  setStatus("syncing");
  try {
    let contagem: Record<string, number>;
    try {
      const revisao = await chamar("rev");
      const resumo = await chamar("resumo");
      if (!resumo.contagem || typeof resumo.contagem !== "object" || escolhidas.some(nome => !Number.isSafeInteger(resumo.contagem[nome] ?? 0) || (resumo.contagem[nome] ?? 0) < 0)) throw new Error("Não foi possível conferir os lançamentos.");
      contagem = resumo.contagem;
      // Uma única transação: folha e plano não podem ficar pela metade.
      await chamar("aplicarRetrato", { dados: Object.fromEntries(escolhidas.map(nome => [nome, []])), rev: revisao.rev ?? 0, substituir: true });
    } catch (e) {
      if (e instanceof SessaoAlterada) throw e;
      marcarErro("envio", e);
      return escolhidas.map(nome => ({ nome, apagadosNuvem: 0, erroNuvem: true }));
    }
    zerarRev();
    try {
      for (const nome of escolhidas) aplicarSemSync(() => definirColecaoDinamica(nome, [] as RegistroGenerico[]));
      gravarFila(lerFila().filter(a => !escolhidas.includes(a.colecao)));
      gravarMassa(lerMassa().filter(nome => !escolhidas.includes(nome)));
    } catch {
      throw new Error("A nuvem confirmou o arquivamento, mas este aparelho não terminou de atualizar. Não importe ainda; libere espaço e sincronize novamente.");
    }
    marcarErro("envio");
    return escolhidas.map(nome => ({ nome, apagadosNuvem: contagem[nome] ?? 0, erroNuvem: false }));
  } finally { recalcStatus(); }
}

// --------------------------- conflitos --------------------------------------
export function aceitarServidor(colecao: string, id: string) {
  const acao = lerFila().find((a) => mesma(a, { colecao, id }) && a.conflito);
  const env = acao?.servidor;
  if (env?.registro) {
    aplicarSemSync(() => {
      const arr = obterDinamico(colecao) as unknown as Reg[];
      if (env.registro._apagado) {
        definirColecaoDinamica(colecao, arr.filter((r) => r.id !== id) as RegistroGenerico[]); // servidor apagou → some local
        return;
      }
      const existe = arr.some((r) => r.id === id);
      definirColecaoDinamica(colecao, (existe ? arr.map((r) => (r.id === id ? env.registro : r)) : [env.registro, ...arr]) as RegistroGenerico[]);
    });
  }
  gravarFila(lerFila().filter((a) => !mesma(a, { colecao, id })));
  recalcStatus();
}
export function sobrescreverServidor(colecao: string, id: string) {
  const fila = lerFila();
  const conflito = fila.find(a => mesma(a, { colecao, id }) && a.conflito);
  if (!conflito) return;
  const ultima = fila.filter(a => mesma(a, { colecao, id })).slice(-1)[0]!;
  if (conflito.servidor?.registro._apagado && ultima.tipo !== "delete") throw new Error("Este registro foi arquivado na nuvem. Confira uma restauração antes de recuperá-lo.");
  const baseVersao = conflito.servidor?.registro._rhRev ?? 0;
  if (!Number.isSafeInteger(baseVersao) || Number(baseVersao) < 0) throw new Error("Atualize o conflito antes de escolher a versão local.");
  // Resolver o conflito é uma nova decisão sobre a versão que acabou de chegar.
  // Mantém inclusive uma exclusão pendente; nunca transforma delete em upsert.
  gravarFila([...fila.filter(a => !mesma(a, { colecao, id })), {
    tipo: ultima.tipo, colecao, id, mutationId: novaMutacao(), baseVersao: Number(baseVersao),
  }]);
  recalcStatus();
  void trySync();
}

// --------------------------- ativação / setup -------------------------------
// Testa a conexão com a Edge Function (ping) usando a sessão atual.
export async function testarConexao(): Promise<boolean> {
  if (!syncConfigurado()) return false;
  try {
    const res = await fetch(FN_SYNC, { method: "POST", headers: { "content-type": "application/json", ...cabecalhoAuth() }, body: JSON.stringify({ action: "ping" }) });
    return res.ok;
  } catch { return false; }
}
export async function sincronizarAgora(): Promise<void> {
  if (!syncHabilitado()) throw new Error("Entre e ative a sincronização para continuar.");
  const contexto = contextoDoUsuario();
  await trySync();
  if (contexto !== contextoDoUsuario()) throw new SessaoAlterada("A sessão mudou.");
  await pull();
  if (contexto !== contextoDoUsuario() || statusSync() !== "ok") throw new Error("A sincronização ainda não foi concluída. Confira as pendências e tente novamente.");
}

// --------------------- config global (nome/cores da empresa) -----------------
// Antes a config só subia no "Enviar tudo" e NUNCA descia — cada computador
// ficava com a sua. Agora: sobe quando o RH salva (com debounce, para não
// disparar a cada arrasto do seletor de cor) e desce uma vez ao abrir o app.
let cfgTimer: ReturnType<typeof setTimeout> | null = null;
/**
 * Sobe para a nuvem SÓ as chaves da config que mudaram neste aparelho.
 *
 * Antes subia obterConfig() inteira, e o servidor gravava por cima: um
 * aparelho com a config de duas horas atrás apagava os 40 vínculos do ERP
 * que outro acabara de fazer (auditoria de 07/09/2026). Agora: as chaves
 * sujas ficam guardadas até a nuvem confirmar; falha (offline, aba fechada)
 * não engole nada — o ciclo de 20 s tenta de novo.
 */
export function enviarConfigNuvem(): void {
  if (!syncHabilitado()) return;
  if (cfgTimer) clearTimeout(cfgTimer);
  const contexto = contextoDoUsuario();
  cfgTimer = setTimeout(() => { cfgTimer = null; if (contexto !== contextoDoUsuario()) return; void subirConfigSuja(); }, 1500);
}
let subindoCfg = false;
async function subirConfigSuja(): Promise<void> {
  if (subindoCfg || !syncHabilitado()) return;
  const chaves = chavesSujasDaConfig();
  if (chaves.length === 0) return;
  const tudo = obterConfig() as unknown as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  for (const k of chaves) patch[k] = tudo[k] ?? null;
  subindoCfg = true;
  try {
    await chamar("setCfg", { patch });
    confirmarChavesEnviadas(patch as Partial<Config>);
  } catch {
    /* fica sujo; o ciclo tenta de novo */
  } finally {
    subindoCfg = false;
  }
}
async function puxarConfig(): Promise<void> {
  if (!syncHabilitado()) return;
  try {
    const r = (await chamar("getCfg")) as { config?: { config?: Record<string, unknown> } | Record<string, unknown> | null };
    const c = ((r?.config as { config?: Record<string, unknown> })?.config ?? r?.config) as Record<string, unknown> | null;
    // Entra por cima da local, menos nas chaves que mudaram aqui e ainda não subiram.
    if (c && typeof c === "object" && !Array.isArray(c)) aplicarConfigDaNuvem(c as Partial<Config>);
  } catch { /* offline ou sem config remota — segue com a local */ }
}

// --------------------------- diagnóstico ------------------------------------
// Transforma falha silenciosa em mensagem clara. Roda ping → list → grava/apaga
// um registro de teste, e descreve o erro exato de cada etapa. É o que faltava
// para enxergar por que a sincronização "não funciona" sem mexer no Supabase às cegas.
export interface PassoDiag { etapa: string; ok: boolean; detalhe: string }
function descreverErro(e: unknown): string {
  if (e instanceof ErroHttp) {
    if (e.status === 401) return "401 Não autorizado — sessão expirada ou sem perfil vinculado. Faça login novamente.";
    if (e.status === 500) return `500 no servidor — falha na Edge Function/Postgres do Supabase. (${(e.message || "").slice(0, 140)})`;
    if (e.status === 404) return "404 — a Edge Function \"sync\" não foi publicada (confira o deploy no Supabase).";
    return `HTTP ${e.status} — ${(e.message || "").slice(0, 140)}`;
  }
  return "Sem resposta do servidor — offline, função fora do ar ou endereço do Supabase errado.";
}
export async function diagnosticar(): Promise<PassoDiag[]> {
  const out: PassoDiag[] = [];
  out.push({ etapa: "Modo", ok: MODO_JWT, detalhe: MODO_JWT ? (tokenAtual() ? "Login real — logado" : "Login real — sem crachá (faça login)") : "Supabase não configurado neste build (faltam VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)." });
  if (!MODO_JWT || !tokenAtual()) return out;
  try { const r = await chamar("ping"); out.push({ etapa: "Conexão (ping)", ok: !!r?.ok, detalhe: r?.ok ? "Servidor respondeu OK" : JSON.stringify(r).slice(0, 140) }); }
  catch (e) { out.push({ etapa: "Conexão (ping)", ok: false, detalhe: descreverErro(e) }); return out; }
  try { const r = await chamar("list", {}); out.push({ etapa: "Leitura (list)", ok: true, detalhe: `${r?.total ?? 0} registro(s) na nuvem` }); }
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
//  • Um poll leve roda só ENQUANTO a aba está visível (economiza chamadas à
//    Edge Function; nada de requisições com a aba em segundo plano).
registrarMutacao((colecao, tipo, id, versao) => { if (obterSessao()) enfileirar(colecao, tipo, id, versao); });
// Restaurar um backup (importarDados) grava direto no store, sem passar pelo gancho
// de mutação — então empurramos cada coleção importada para a nuvem aqui.
registrarPosImport((colecoes) => {
  if (!obterSessao()) return;
  if (!guardar(K_RESTAURACOES, JSON.stringify([...new Set([...restauracoesPendentes(), ...colecoes])]))) throw new Error("Não foi possível guardar a restauração pendente.");
  const bases = basesMassa(), rev = lerRev().rev;
  if (rev != null) for (const nome of colecoes) if (bases[nome] == null) bases[nome] = rev;
  if (!guardar(K_MASSA_REV, JSON.stringify(bases))) throw new Error("Não foi possível guardar a conferência da restauração.");
  for (const nome of colecoes) marcarMassaPendente(nome);
  void (async () => { for (const nome of colecoes) await enviarColecao(nome); })();
});
if (temWindow) {
  const ativo = () => syncHabilitado() && navigator.onLine;
  const ciclo = () => {
    if (!ativo()) return;
    void (async () => { for (const nome of lerMassa()) await enviarColecao(nome); })();
    void trySync();
    void pull();
    // A config também anda no ciclo: o que ficou sujo sobe (offline, aba
    // fechada cedo) e o que outro aparelho mudou desce — antes só descia ao
    // abrir, e um aparelho aberto o dia inteiro nunca via o tipo novo.
    void subirConfigSuja().then(() => puxarConfig());
  };
  ciclo(); // ao abrir
  void puxarConfig(); // config da empresa desce uma vez, ao abrir
  window.addEventListener("online", () => { recalcStatus(); ciclo(); });
  window.addEventListener("offline", () => recalcStatus());
  // Logou → baixa a base completa. Zera a revisão memorizada, senão o pull
  // restrito de antes do login faria o app achar que já está em dia.
  window.addEventListener("impresilk:autenticado", () => { epocaDados++; zerarRev(); recalcStatus(); ciclo(); void puxarConfig(); });
  window.addEventListener("impresilk:sessao-encerrada", () => { epocaDados++; if (cfgTimer) clearTimeout(cfgTimer); recalcStatus(); });
  window.addEventListener("focus", () => { if (ativo()) void pull(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") ciclo(); });
  // Poll leve só com a aba visível (≈ a cada 20s) — sensação de tempo real sem gastar créditos à toa.
  setInterval(() => { if (ativo() && document.visibilityState === "visible") ciclo(); }, 20_000);
}
