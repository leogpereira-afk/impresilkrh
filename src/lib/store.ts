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

// ---- API por nome DINÂMICO (sincronização e migrações) ----
// A sincronização e as migrações percorrem as coleções em laço, então o nome é
// uma string comum — e o TypeScript exige um nome literal. A saída usada até
// aqui era `definirColecao(nome as never, itens as never)`, que desliga a
// checagem dos DOIS lados: um erro de nome ou um registro sem `id` passava
// batido (foi assim que o plano de contas ficou meses sem subir).
//
// Estas duas funções assumem a natureza dinâmica de forma honesta: o nome é
// conferido em tempo de execução e os registros têm o contrato mínimo (`id`).
export type RegistroGenerico = { id: string } & Record<string, unknown>;

const NOMES_VALIDOS = new Set<string>(NOMES_COLECOES);
/** O nome é mesmo de uma coleção conhecida? */
export function ehNomeColecao(nome: string): nome is NomeColecao {
  return NOMES_VALIDOS.has(nome);
}

/** Lê uma coleção pelo nome em tempo de execução. Nome inválido → lista vazia. */
export function obterDinamico(nome: string): RegistroGenerico[] {
  if (!ehNomeColecao(nome)) return [];
  return ler(nome) as unknown as RegistroGenerico[];
}

/** Grava uma coleção pelo nome em tempo de execução. Nome inválido → não faz nada. */
export function definirColecaoDinamica(nome: string, itens: RegistroGenerico[]): void {
  if (!ehNomeColecao(nome)) return;
  gravar(nome, itens as never);
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

// ---- Conferência do backup ANTES de restaurar ----
// Importar trocava tudo na hora, sem checar nada além de "tem a chave dados".
// Escolher o arquivo errado (backup velho, de outro sistema, ou pela metade)
// apagava a base inteira — e o resultado ainda subia para a nuvem. Agora dá
// para ver o que vai entrar, o que vai sair, e o que parece errado.
export interface LinhaBackup { colecao: NomeColecao; agora: number; noArquivo: number; diferenca: number }
export interface AnaliseBackup {
  linhas: LinhaBackup[];
  exportadoEm: string | null;
  /** Problemas que devem fazer a pessoa parar e pensar. */
  alertas: string[];
  /** Total de registros que somem se restaurar. */
  perdaTotal: number;
  ganhoTotal: number;
}

export function analisarBackup(json: string): AnaliseBackup {
  let parsed: { app?: string; versao?: number; exportadoEm?: string; dados?: Record<string, unknown[]> };
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Arquivo ilegível: não é um .json válido.");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.dados || typeof parsed.dados !== "object") {
    throw new Error("Arquivo inválido: não parece um backup do RH (falta a seção de dados).");
  }

  const alertas: string[] = [];
  if (parsed.app && parsed.app !== "impresilk-rh") {
    alertas.push(`Este backup é do sistema "${parsed.app}", não do RH. Restaurar vai misturar dados de sistemas diferentes.`);
  }
  if (parsed.exportadoEm) {
    const dias = Math.round((Date.now() - new Date(parsed.exportadoEm).getTime()) / 86_400_000);
    if (dias > 30) alertas.push(`O backup tem ${dias} dias. Tudo que foi feito depois dessa data será perdido.`);
  } else {
    alertas.push("O arquivo não diz quando foi gerado — não dá para saber se é recente.");
  }

  const linhas: LinhaBackup[] = [];
  let ausentes = 0;
  for (const nome of NOMES_COLECOES) {
    const v = parsed.dados[nome];
    const agora = (ler(nome) as unknown[]).length;
    if (!Array.isArray(v)) {
      if (agora > 0) ausentes++;
      continue; // coleção que o arquivo não traz fica intacta (importarDados a ignora)
    }
    const noArquivo = v.length;
    if (agora || noArquivo) linhas.push({ colecao: nome, agora, noArquivo, diferenca: noArquivo - agora });
  }
  if (ausentes > 0) {
    alertas.push(`${ausentes} coleção(ões) que existem aqui não vêm no arquivo — elas ficam como estão, sem serem tocadas.`);
  }

  const perdaTotal = linhas.reduce((s, l) => s + Math.max(0, -l.diferenca), 0);
  const ganhoTotal = linhas.reduce((s, l) => s + Math.max(0, l.diferenca), 0);
  const zerando = linhas.filter((l) => l.agora > 0 && l.noArquivo === 0);
  if (zerando.length) {
    alertas.push(`${zerando.length} coleção(ões) ficariam VAZIAS: ${zerando.slice(0, 4).map((l) => l.colecao).join(", ")}${zerando.length > 4 ? "…" : ""}.`);
  }

  return { linhas: linhas.sort((a, b) => a.diferenca - b.diferenca), exportadoEm: parsed.exportadoEm ?? null, alertas, perdaTotal, ganhoTotal };
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
