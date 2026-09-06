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
import { chaveLocal, contextoDoUsuario, lerLocal, removerLocal } from "./armazenamentoUsuario";
import { obterSessao } from "./session";
import { lerCopiaAnterior } from "./copiaAnterior";
import { exportarBlobsAnteriores } from "./blobstore";

const NS = "impresilk.rh.v1";
const keyCol = (nome: string) => `${NS}:col:${nome}`;
const CONFIG_KEY = `${NS}:config`;

const temWindow = typeof window !== "undefined";

// ---- cache em memória + assinaturas ----
const cache = new Map<string, unknown[]>();
let configCache: Config | null = null;
const listeners = new Map<string, Set<() => void>>();
let contextoCache: string | undefined;
function conferirContexto() {
  const atual = contextoDoUsuario();
  if (atual !== contextoCache) { cache.clear(); configCache = null; contextoCache = atual; return true; }
  return false;
}

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
  conferirContexto();
  if (cache.has(nome)) return cache.get(nome) as ColecaoMap[K][];
  let val: unknown[] | null = null;
  if (temWindow) {
    const raw = lerLocal(keyCol(nome));
    if (raw) {
      try {
        const dados = JSON.parse(raw);
        val = Array.isArray(dados) ? dados : null;
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
    window.localStorage.setItem(chaveLocal(key), valor);
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
  conferirContexto();
  if (!escrever(keyCol(nome), JSON.stringify(val))) throw new Error("Não foi possível guardar a alteração neste aparelho. Libere espaço antes de tentar novamente.");
  cache.set(nome, val);
  emit(nome);
}

function gravarEdicao<K extends NomeColecao>(nome: K, val: ColecaoMap[K][], tipo: "upsert" | "delete", id: string) {
  const anterior = ler(nome);
  gravar(nome, val);
  const registroAnterior = anterior.find(r => (r as { id: string }).id === id) as { _rhRev?: number } | undefined;
  try { notificar(nome, tipo, id, registroAnterior ? registroAnterior._rhRev : 0); }
  catch (e) { gravar(nome, anterior); throw e; }
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
type MutacaoCb = (colecao: NomeColecao, tipo: "upsert" | "delete", id: string, versao?: number) => void;
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
function notificar(nome: NomeColecao, tipo: "upsert" | "delete", id: string, versao?: number) {
  if (!suprimirSync && mutacaoCb) mutacaoCb(nome, tipo, id, versao);
}

// ---- API imperativa por coleção ----
export function obter<K extends NomeColecao>(nome: K): ColecaoMap[K][] {
  return ler(nome);
}

// ---- Auditoria (histórico de "quem mexeu no quê") ----
//
// O store não conhece o módulo de auditoria: ele apenas AVISA. Quem escuta é
// injetado no main.tsx. Assim não há ciclo de import (auditoria → store), e o
// store continua funcionando inteiro se ninguém estiver escutando.
//
// O aviso vai dentro de try/catch de propósito: este é o ponto por onde TODA
// escrita do sistema passa. Um erro no histórico não pode impedir alguém de
// salvar um cadastro — o log é testemunha, não porteiro.
type EventoStore = {
  colecao: string;
  acao: "criou" | "alterou" | "removeu";
  id: string;
  antes?: Record<string, unknown> | null;
  depois?: Record<string, unknown> | null;
};
let auditor: ((ev: EventoStore) => void) | null = null;
export function definirAuditor(fn: ((ev: EventoStore) => void) | null): void {
  auditor = fn;
}
function avisarAuditor(ev: EventoStore): void {
  if (!auditor) return;
  try {
    auditor(ev);
  } catch {
    /* histórico nunca derruba a escrita */
  }
}

/**
 * Cria um registro. Se o item já traz `id`, ele manda.
 *
 * NÃO faz upsert: telas que derivam o id de um nome ou e-mail contam com
 * `criar` sempre inserir, e transformá-lo em upsert em silêncio faria um
 * cadastro novo sobrescrever um homônimo já existente sem ninguém perceber.
 * Quem precisa de upsert usa `criarOuAtualizarEm`.
 */
export function criarEm<K extends NomeColecao>(
  nome: K,
  item: Partial<ColecaoMap[K]>,
): ColecaoMap[K] {
  const novo = { id: uid(nome), ...item, atualizadoEm: agora() } as unknown as ColecaoMap[K];
  gravarEdicao(nome, [novo, ...ler(nome)], "upsert", (novo as { id: string }).id);
  avisarAuditor({ colecao: nome, acao: "criou", id: (novo as { id: string }).id, depois: novo as unknown as Record<string, unknown> });
  return novo;
}

/**
 * Insere OU atualiza pelo id. Para importação de fonte externa (o ERP), em que
 * o mesmo registro pode chegar de novo e não pode virar uma segunda linha.
 */
export function criarOuAtualizarEm<K extends NomeColecao>(
  nome: K,
  item: Partial<ColecaoMap[K]>,
): ColecaoMap[K] {
  const novo = { id: uid(nome), ...item, atualizadoEm: agora() } as unknown as ColecaoMap[K];
  const id = (novo as { id: string }).id;
  const atuais = ler(nome);
  const anterior = atuais.find((it) => (it as { id: string }).id === id);
  const jaExiste = !!anterior;
  gravarEdicao(
    nome,
    jaExiste
      ? atuais.map((it) => ((it as { id: string }).id === id ? { ...it, ...novo } : it))
      : [novo, ...atuais],
    "upsert", id,
  );
  avisarAuditor({
    colecao: nome,
    acao: jaExiste ? "alterou" : "criou",
    id,
    antes: anterior as unknown as Record<string, unknown> | undefined,
    depois: (jaExiste ? { ...anterior, ...novo } : novo) as unknown as Record<string, unknown>,
  });
  return novo;
}

export function atualizarEm<K extends NomeColecao>(
  nome: K,
  id: string,
  patch: Partial<ColecaoMap[K]>,
): void {
  const carimbo = agora();
  const atuais = ler(nome);
  const anterior = atuais.find((it) => (it as { id: string }).id === id);
  gravarEdicao(
    nome,
    atuais.map((it) => ((it as { id: string }).id === id ? { ...it, ...patch, atualizadoEm: carimbo } : it)),
    "upsert", id,
  );
  if (anterior) {
    avisarAuditor({
      colecao: nome,
      acao: "alterou",
      id,
      antes: anterior as unknown as Record<string, unknown>,
      depois: { ...anterior, ...patch } as unknown as Record<string, unknown>,
    });
  }
}

export function removerEm<K extends NomeColecao>(nome: K, id: string): void {
  const anterior = ler(nome).find((it) => (it as { id: string }).id === id);
  gravarEdicao(nome, ler(nome).filter((it) => (it as { id: string }).id !== id), "delete", id);
  if (anterior) avisarAuditor({ colecao: nome, acao: "removeu", id, antes: anterior as unknown as Record<string, unknown> });
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
  const criarOuAtualizar = useCallback((item: Partial<ColecaoMap[K]>) => criarOuAtualizarEm(nome, item), [nome]);
  const atualizar = useCallback((id: string, patch: Partial<ColecaoMap[K]>) => atualizarEm(nome, id, patch), [nome]);
  const remover = useCallback((id: string) => removerEm(nome, id), [nome]);
  const definir = useCallback((itens: ColecaoMap[K][]) => definirColecao(nome, itens), [nome]);

  return { items, criar, criarOuAtualizar, atualizar, remover, definir };
}

// ---- Config (singleton) ----
export function obterConfig(): Config {
  conferirContexto();
  if (configCache) return configCache;
  let val: Config = { ...CONFIG_DEFAULT };
  if (temWindow) {
    const raw = lerLocal(CONFIG_KEY);
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
  if (!escrever(CONFIG_KEY, JSON.stringify(novo))) throw new Error("A configuração não foi salva. Libere espaço neste aparelho.");
  configCache = novo;
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
export interface LinhaBackup { colecao: NomeColecao; agora: number; noArquivo: number; diferenca: number; removidos: number; adicionados: number; alterados: number }
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
  if (parsed.app && parsed.app !== "impresilk-rh") throw new Error("Este arquivo pertence a outro sistema. Use um backup do RH.");
  if (Array.isArray(parsed.dados)) throw new Error("Estrutura de dados inválida.");
  if (parsed.versao != null && String(parsed.versao) !== String(VERSAO_DADOS)) alertas.push("A versão do arquivo é diferente da versão atual. Confira os campos antes de restaurar.");
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
      if (v !== undefined) throw new Error(`A coleção ${nome} não é uma lista válida.`);
      if (agora > 0) ausentes++;
      continue; // coleção que o arquivo não traz fica intacta (importarDados a ignora)
    }
    const noArquivo = v.length;
    const registros = v as { id?: unknown }[];
    if (registros.some(r => !r || typeof r !== "object" || Array.isArray(r) || typeof r.id !== "string" || !r.id)) throw new Error(`Há registros inválidos em ${nome}.`);
    if (new Set(registros.map(r => r.id)).size !== registros.length) throw new Error(`Há identificações duplicadas em ${nome}.`);
    const atuais = new Map((ler(nome) as unknown as { id: string }[]).map(r => [r.id, r]));
    const novos = new Map((v as { id: string }[]).map(r => [r.id, r]));
    const removidos = [...atuais.keys()].filter(id => !novos.has(id)).length;
    const adicionados = [...novos.keys()].filter(id => !atuais.has(id)).length;
    const alterados = [...novos].filter(([id, r]) => atuais.has(id) && JSON.stringify(atuais.get(id)) !== JSON.stringify(r)).length;
    if (agora || noArquivo) linhas.push({ colecao: nome, agora, noArquivo, diferenca: noArquivo - agora, removidos, adicionados, alterados });
  }
  if (ausentes > 0) {
    alertas.push(`${ausentes} coleção(ões) que existem aqui não vêm no arquivo — elas ficam como estão, sem serem tocadas.`);
  }

  const perdaTotal = linhas.reduce((s, l) => s + l.removidos, 0);
  const ganhoTotal = linhas.reduce((s, l) => s + l.adicionados, 0);
  const zerando = linhas.filter((l) => l.agora > 0 && l.noArquivo === 0);
  if (zerando.length) {
    alertas.push(`${zerando.length} coleção(ões) ficariam VAZIAS: ${zerando.slice(0, 4).map((l) => l.colecao).join(", ")}${zerando.length > 4 ? "…" : ""}.`);
  }

  return { linhas: linhas.sort((a, b) => a.diferenca - b.diferenca), exportadoEm: parsed.exportadoEm ?? null, alertas, perdaTotal, ganhoTotal };
}

export function importarDados(json: string): void {
  conferirContexto(); analisarBackup(json);
  const parsed = JSON.parse(json) as { dados: Record<string, unknown[]>; config?: Partial<Config> };
  if (parsed.config != null && (typeof parsed.config !== "object" || Array.isArray(parsed.config))) throw new Error("Configuração inválida no arquivo.");
  const importadas = NOMES_COLECOES.filter(nome => Array.isArray(parsed.dados[nome]));
  const escritas = new Map(importadas.map(nome => [keyCol(nome), JSON.stringify(parsed.dados[nome])]));
  const configAntes = configCache;
  const cacheAntes = new Map(cache);
  if (parsed.config) escritas.set(CONFIG_KEY, JSON.stringify({ ...obterConfig(), ...parsed.config }));
  const chavesRollback = [...escritas.keys(), "impresilk.sync.massa", "impresilk.sync.massa-revisao", "impresilk.sync.restauracoes"];
  const originais = new Map(chavesRollback.map(k => [k, lerLocal(k)]));
  try {
    for (const [k, v] of escritas) if (!escrever(k, v)) throw new Error("A importação não foi salva por falta de espaço. O estado anterior foi preservado.");
    for (const nome of importadas) cache.set(nome, parsed.dados[nome]);
    if (parsed.config) configCache = { ...obterConfig(), ...parsed.config };
    if (posImportCb) posImportCb(importadas);
  } catch (e) {
    // Primeiro devolve o espaço ocupado pela tentativa; depois repõe o original.
    for (const k of chavesRollback) removerLocal(k);
    for (const [k, v] of originais) if (v != null && !escrever(k, v)) throw new Error("Falha ao recuperar o armazenamento. Preserve o arquivo de backup e recarregue o RH.");
    cache.clear(); for (const [k, v] of cacheAntes) cache.set(k, v);
    configCache = configAntes;
    throw e;
  }
  emitTudo();
}

export function restaurarPadrao(): void {
  conferirContexto();
  const def = defaultsColecoes();
  for (const nome of NOMES_COLECOES) {
    cache.set(nome, def[nome]);
    if (temWindow) removerLocal(keyCol(nome));
  }
  configCache = { ...CONFIG_DEFAULT };
  if (temWindow) removerLocal(CONFIG_KEY);
  emitTudo();
}

/** Cópia anterior sem autoria comprovada: preservada para conferência, nunca reenvia sozinha. */
export async function exportarCopiaAnterior(): Promise<string | null> {
  if (!temWindow || obterSessao()?.perfil !== "ADMIN_RH") return null;
  const dados: Record<string, unknown[]> = {};
  try {
    const contexto = contextoDoUsuario();
    const copia = await lerCopiaAnterior();
    if (contexto !== contextoDoUsuario()) return null;
    for (const nome of NOMES_COLECOES) {
      const raw = copia[keyCol(nome)];
      if (!raw) continue;
      const valor = JSON.parse(raw);
      if (Array.isArray(valor)) dados[nome] = valor;
    }
    const arquivos = await exportarBlobsAnteriores();
    if (contexto !== contextoDoUsuario()) return null;
    if (!Object.keys(dados).length && !Object.keys(arquivos).length) return null;
    const pendencias = JSON.parse(copia["impresilk.sync.fila"] || "[]");
    const config = copia[CONFIG_KEY] ? JSON.parse(copia[CONFIG_KEY]) : undefined;
    const falhas = JSON.parse(copia["impresilk.sync.falhas"] || "[]");
    return JSON.stringify({ app: "impresilk-rh", versao: VERSAO_DADOS, origem: "copia-anterior-sem-autoria", exportadoEm: new Date().toISOString(), dados, config, arquivos, pendencias, falhas }, null, 2);
  } catch { throw new Error("Não foi possível ler a cópia anterior deste aparelho. Os dados foram preservados."); }
}

if (temWindow) {
  const trocar = () => { if (conferirContexto()) emitTudo(); };
  window.addEventListener("impresilk:autenticado", trocar);
  window.addEventListener("impresilk:sessao-encerrada", trocar);
  window.addEventListener("storage", () => { cache.clear(); configCache = null; contextoCache = contextoDoUsuario(); emitTudo(); });
}
