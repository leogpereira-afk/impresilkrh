// ===================== Camada única de dados (store) =====================
// Sem banco: os dados vivem em memória + localStorage. Carrega os defaults
// embutidos na 1ª vez; persiste cada edição; expõe CRUD por coleção e
// utilidades de backup (exportar/importar JSON) e restauração.

import { useCallback, useSyncExternalStore } from "react";
import {
  CONFIG_DEFAULT,
  ColecaoMap,
  NomeColecao,
  NOMES_COLECOES,
  VERSAO_DADOS,
  defaultsColecoes,
} from "@/data";
import type { Config } from "@/data/types";

const NS = "impresilk.rh.v1";
const keyCol = (nome: string) => `${NS}:col:${nome}`;
const CONFIG_KEY = `${NS}:config`;

const temWindow = typeof window !== "undefined";

// ---- cache em memória + assinaturas ----
const cache = new Map<string, unknown[]>();
let configCache: Config | null = null;
const listeners = new Map<string, Set<() => void>>();

// Defaults memoizados (uma cópia). As mutações são sempre imutáveis (novos arrays),
// então é seguro entregar a referência sem clonar a cada leitura.
let defaultsMemo: ReturnType<typeof defaultsColecoes> | null = null;
function defaults() {
  if (!defaultsMemo) defaultsMemo = defaultsColecoes();
  return defaultsMemo;
}

function subscribers(nome: string): Set<() => void> {
  let s = listeners.get(nome);
  if (!s) {
    s = new Set();
    listeners.set(nome, s);
  }
  return s;
}
function emit(nome: string) {
  subscribers(nome).forEach((cb) => cb());
}
function emitTudo() {
  for (const nome of listeners.keys()) emit(nome);
  emit("__config__");
}

// Leitura pura (sem efeitos): usada pelo getSnapshot do useSyncExternalStore.
function ler<K extends NomeColecao>(nome: K): ColecaoMap[K][] {
  if (cache.has(nome)) return cache.get(nome) as ColecaoMap[K][];
  let val: unknown[] | null = null;
  if (temWindow) {
    const raw = window.localStorage.getItem(keyCol(nome));
    if (raw) {
      try {
        val = JSON.parse(raw);
      } catch {
        val = null;
      }
    }
  }
  if (!val) val = defaults()[nome] as unknown[];
  cache.set(nome, val);
  return val as ColecaoMap[K][];
}

// Escrita resiliente no localStorage. Se a cota estourar (ou o storage estiver
// indisponível), NÃO perde a sessão: o cache em memória continua válido e a UI
// é avisada (evento) para o usuário liberar espaço / exportar backup. Retorna
// false quando não conseguiu persistir em disco.
function escrever(key: string, valor: string): boolean {
  if (!temWindow) return true;
  try {
    window.localStorage.setItem(key, valor);
    return true;
  } catch {
    try {
      window.dispatchEvent(new CustomEvent("impresilk:armazenamento-cheio", { detail: { key } }));
    } catch {
      /* ignora */
    }
    return false;
  }
}

function gravar<K extends NomeColecao>(nome: K, val: ColecaoMap[K][]) {
  cache.set(nome, val);
  escrever(keyCol(nome), JSON.stringify(val));
  emit(nome);
}

function uid(prefixo = "id"): string {
  return `${prefixo}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

const agora = () => new Date().toISOString();

// ---- Gancho de sincronização (desacoplado) ----
// O módulo de sync (src/lib/sync.ts) se registra aqui para ser avisado de cada
// mutação do usuário. O store NÃO depende do sync: se ninguém registrar, tudo
// funciona 100% local, como antes. `aplicarSemSync` roda um bloco sem disparar
// o gancho — usado pelo próprio sync ao aplicar dados vindos do servidor, para
// não criar um eco (servidor → local → fila → servidor).
type MutacaoCb = (colecao: NomeColecao, tipo: "upsert" | "delete", id: string) => void;
let mutacaoCb: MutacaoCb | null = null;
let suprimirSync = false;
export function registrarMutacao(fn: MutacaoCb): void {
  mutacaoCb = fn;
}

// Gancho de pós-importação: o sync se registra para EMPURRAR para a nuvem as
// coleções recém-importadas de um backup. Sem isso, restaurar um backup só
// gravava local — o dado nunca subia (importarDados usa cache/escrever direto,
// não passa pelo gancho de mutação) e "sumia" ao trocar de computador.
type PosImportCb = (colecoes: NomeColecao[]) => void;
let posImportCb: PosImportCb | null = null;
export function registrarPosImport(fn: PosImportCb): void {
  posImportCb = fn;
}
export function aplicarSemSync<T>(fn: () => T): T {
  const antes = suprimirSync;
  suprimirSync = true;
  try {
    return fn();
  } finally {
    suprimirSync = antes;
  }
}
function notificar(nome: NomeColecao, tipo: "upsert" | "delete", id: string) {
  if (!suprimirSync && mutacaoCb) mutacaoCb(nome, tipo, id);
}

// ---- API imperativa por coleção ----
export function obter<K extends NomeColecao>(nome: K): ColecaoMap[K][] {
  return ler(nome);
}

export function criarEm<K extends NomeColecao>(
  nome: K,
  item: Partial<ColecaoMap[K]>,
): ColecaoMap[K] {
  const novo = { id: uid(nome), ...item, atualizadoEm: agora() } as unknown as ColecaoMap[K];
  gravar(nome, [novo, ...ler(nome)]);
  notificar(nome, "upsert", (novo as { id: string }).id);
  return novo;
}

export function atualizarEm<K extends NomeColecao>(
  nome: K,
  id: string,
  patch: Partial<ColecaoMap[K]>,
): void {
  const carimbo = agora();
  gravar(
    nome,
    ler(nome).map((it) => ((it as { id: string }).id === id ? { ...it, ...patch, atualizadoEm: carimbo } : it)),
  );
  notificar(nome, "upsert", id);
}

export function removerEm<K extends NomeColecao>(nome: K, id: string): void {
  gravar(nome, ler(nome).filter((it) => (it as { id: string }).id !== id));
  notificar(nome, "delete", id);
}

export function definirColecao<K extends NomeColecao>(nome: K, itens: ColecaoMap[K][]): void {
  gravar(nome, itens);
}

// ---- Hook reativo ----
export function useColecao<K extends NomeColecao>(nome: K) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const s = subscribers(nome);
      s.add(cb);
      return () => s.delete(cb);
    },
    [nome],
  );
  const getSnapshot = useCallback(() => ler(nome), [nome]);
  const items = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const criar = useCallback((item: Partial<ColecaoMap[K]>) => criarEm(nome, item), [nome]);
  const atualizar = useCallback((id: string, patch: Partial<ColecaoMap[K]>) => atualizarEm(nome, id, patch), [nome]);
  const remover = useCallback((id: string) => removerEm(nome, id), [nome]);
  const definir = useCallback((itens: ColecaoMap[K][]) => definirColecao(nome, itens), [nome]);

  return { items, criar, atualizar, remover, definir };
}

// ---- Config (singleton) ----
export function obterConfig(): Config {
  if (configCache) return configCache;
  let val: Config = { ...CONFIG_DEFAULT };
  if (temWindow) {
    const raw = window.localStorage.getItem(CONFIG_KEY);
    if (raw) {
      try {
        val = { ...CONFIG_DEFAULT, ...JSON.parse(raw) };
      } catch {
        /* ignora */
      }
    }
  }
  configCache = val;
  return val;
}

export function salvarConfig(patch: Partial<Config>): void {
  const novo = { ...obterConfig(), ...patch };
  configCache = novo;
  escrever(CONFIG_KEY, JSON.stringify(novo));
  emit("__config__");
}

export function useConfig(): Config {
  const subscribe = useCallback((cb: () => void) => {
    const s = subscribers("__config__");
    s.add(cb);
    return () => s.delete(cb);
  }, []);
  return useSyncExternalStore(subscribe, obterConfig, obterConfig);
}

// ---- Backup / portabilidade ----
export function exportarDados(): string {
  const dados: Record<string, unknown> = {};
  for (const nome of NOMES_COLECOES) dados[nome] = ler(nome);
  return JSON.stringify(
    {
      app: "impresilk-rh",
      versao: VERSAO_DADOS,
      exportadoEm: new Date().toISOString(),
      config: obterConfig(),
      dados,
    },
    null,
    2,
  );
}

export function importarDados(json: string): void {
  const parsed = JSON.parse(json) as { dados?: Record<string, unknown[]>; config?: Partial<Config> };
  if (!parsed || typeof parsed !== "object" || !parsed.dados) {
    throw new Error("Arquivo inválido: estrutura de dados não reconhecida.");
  }
  const importadas: NomeColecao[] = [];
  for (const nome of NOMES_COLECOES) {
    const v = parsed.dados[nome];
    if (Array.isArray(v)) {
      cache.set(nome, v);
      escrever(keyCol(nome), JSON.stringify(v));
      importadas.push(nome);
    }
  }
  if (parsed.config) {
    configCache = { ...CONFIG_DEFAULT, ...parsed.config };
    escrever(CONFIG_KEY, JSON.stringify(configCache));
  }
  emitTudo();
  // Sobe o backup importado para a nuvem (best-effort; se o sync estiver desligado
  // ou offline, fica local e sobe depois). Sem isso o restore não se propagava.
  if (posImportCb) posImportCb(importadas);
}

export function restaurarPadrao(): void {
  const def = defaultsColecoes();
  for (const nome of NOMES_COLECOES) {
    cache.set(nome, def[nome]);
    if (temWindow) window.localStorage.removeItem(keyCol(nome));
  }
  configCache = { ...CONFIG_DEFAULT };
  if (temWindow) window.localStorage.removeItem(CONFIG_KEY);
  emitTudo();
}
