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

function gravar<K extends NomeColecao>(nome: K, val: ColecaoMap[K][]) {
  cache.set(nome, val);
  if (temWindow) window.localStorage.setItem(keyCol(nome), JSON.stringify(val));
  emit(nome);
}

function uid(prefixo = "id"): string {
  return `${prefixo}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

// ---- API imperativa por coleção ----
export function obter<K extends NomeColecao>(nome: K): ColecaoMap[K][] {
  return ler(nome);
}

export function criarEm<K extends NomeColecao>(
  nome: K,
  item: Partial<ColecaoMap[K]>,
): ColecaoMap[K] {
  const novo = { id: uid(nome), ...item } as unknown as ColecaoMap[K];
  gravar(nome, [novo, ...ler(nome)]);
  return novo;
}

export function atualizarEm<K extends NomeColecao>(
  nome: K,
  id: string,
  patch: Partial<ColecaoMap[K]>,
): void {
  gravar(
    nome,
    ler(nome).map((it) => ((it as { id: string }).id === id ? { ...it, ...patch } : it)),
  );
}

export function removerEm<K extends NomeColecao>(nome: K, id: string): void {
  gravar(nome, ler(nome).filter((it) => (it as { id: string }).id !== id));
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
  if (temWindow) window.localStorage.setItem(CONFIG_KEY, JSON.stringify(novo));
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
  for (const nome of NOMES_COLECOES) {
    const v = parsed.dados[nome];
    if (Array.isArray(v)) {
      cache.set(nome, v);
      if (temWindow) window.localStorage.setItem(keyCol(nome), JSON.stringify(v));
    }
  }
  if (parsed.config) {
    configCache = { ...CONFIG_DEFAULT, ...parsed.config };
    if (temWindow) window.localStorage.setItem(CONFIG_KEY, JSON.stringify(configCache));
  }
  emitTudo();
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
