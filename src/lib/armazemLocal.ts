// Armazém local das coleções: memória + IndexedDB, com a MESMA interface
// síncrona que o localStorage oferecia.
//
// POR QUE ISTO EXISTE
// O localStorage é de ~5 MB **por origem** — e todos os sistemas da casa moram
// na mesma (leogpereira-afk.github.io/rh, /impresilk, /painel, /compras,
// /pops): eles dividem o mesmo cofre. Os dados do RH sozinhos já passam de
// 2 MB (colaboradores, pagamentos, alterações, plano de contas), e ainda são
// guardados por conta+perfil — dois perfis no mesmo aparelho dobram isso.
// Em 06/09/2026 o PCP estourou essa cota e abriu VAZIO para o dono; o RH
// estava a caminho do mesmo lugar (aqui a escrita já falhava com aviso, o que
// é melhor, mas continua sendo trabalho que não salva). O IndexedDB do mesmo
// aparelho oferece ~2,7 GB.
//
// COMO FUNCIONA
// A leitura precisa ser SÍNCRONA (o getSnapshot do useSyncExternalStore não
// aceita promessa), então a verdade em uso fica numa cópia em memória e o
// IndexedDB é o disco. Antes de aceitar cada alteração, uma cópia temporária
// síncrona no localStorage permite recuperá-la se a página fechar durante a
// espera de 200 ms. A cópia só sai após a transação confirmar. Se não couber,
// a escrita é recusada e a memória mantém o valor anterior.
// `prontoArmazem()` carrega o disco uma vez, no boot, e migra o que
// ainda estiver no localStorage — liberando aquele espaço.
//
// SEM IndexedDB (aba anônima, navegador antigo, jsdom dos testes) tudo segue
// exatamente como antes, direto no localStorage.

import { criarDiario, recuperarDiario, hashRecuperacao, type BaseRecuperacao } from "./armazemDiario";

// Os dois espaços de nome que guardam volume: as coleções do RH e a fila/estado
// do sync (que usa `impresilk.sync`). O PCP, na mesma origem, usa
// `impresilk_inst_*` (sublinhado) e não é tocado aqui.
const PREFIXOS = ["impresilk.rh", "impresilk.sync"];
const DB_NAME = "impresilk.rh.dados";
const STORE = "chaves";

// Marcador MINÚSCULO que fica no localStorage dizendo "os dados deste aparelho
// moram no IndexedDB". É lido de forma SÍNCRONA e serve para uma coisa vital:
// enquanto o disco não foi lido, o store NÃO pode achar que a coleção está
// vazia e cair nos dados de exemplo (o seed). Isso já aconteceu de verdade em
// 30/07/2026 — 514 pagamentos de exemplo subiram para a nuvem e dobraram o
// custo de pessoal. Com a leitura assíncrona essa janela existe de novo, e o
// marcador é o que a fecha.
const MARCADOR = "impresilk.rh.armazem";
const DIARIO = "impresilk.rh.recuperacao:";
const BASE = "impresilk.rh.base-recuperacao:";
const chaveDiario = (chave: string) => DIARIO + encodeURIComponent(chave);
const chaveBase = (chave: string) => BASE + encodeURIComponent(chave);
const bases = new Map<string, BaseRecuperacao>();
const recuperacoesBloqueadas = new Set<string>();
type Pendente = { valor: string | null; diario?: string; legado?: string };
export type EstadoArmazem = "ok" | "pendente" | "erro";
let estado: EstadoArmazem = "ok";
let escritaRecusada = false;
const ouvintesEstado = new Set<() => void>();
export function estadoArmazem(): EstadoArmazem { return estado; }
export function assinarArmazem(cb: () => void): () => void { ouvintesEstado.add(cb); return () => ouvintesEstado.delete(cb); }
function mudarEstado(proximo: EstadoArmazem) {
  if (recuperacoesBloqueadas.size) proximo = "erro";
  if (estado === proximo) return;
  estado = proximo;
  ouvintesEstado.forEach(cb => cb());
}

function lerDiario(chave: string): Pendente | null {
  const diario = localStorage.getItem(chaveDiario(chave));
  if (diario === null) return null;
  return { valor: recuperarDiario(diario, bases.get(chave)), diario };
}

/** Uma única base estável por chave/conta; não acumula um histórico de versões. */
async function prepararBases(db: IDBDatabase, valores: Map<string, string>) {
  for (const [chave, valor] of valores) {
    if (bases.has(chave)) continue;
    const hash = await hashRecuperacao(valor);
    if (!hash) continue;
    try {
      // O get e a criação estão na mesma transação: duas abas não substituem
      // a base que a outra acabou de estabelecer.
      const raw = await new Promise<string>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite"); const os = tx.objectStore(STORE);
        const req = os.get(chaveBase(chave)); let resultado = "";
        req.onsuccess = () => {
          resultado = typeof req.result === "string" ? req.result : JSON.stringify({ hash, valor });
          if (req.result === undefined) os.put(resultado, chaveBase(chave));
        };
        tx.oncomplete = () => resolve(resultado);
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("Base de recuperação indisponível"));
      });
      const base = JSON.parse(raw) as BaseRecuperacao;
      if (typeof base.valor === "string" && typeof base.hash === "string" && await hashRecuperacao(base.valor) === base.hash) bases.set(chave, base);
      else avisarCheio(chave);
    } catch { /* sem base confirmada, uma nova escrita só aceita retrato completo */ }
  }
}

// null = ainda não carregado (ou sem IndexedDB): a leitura vai ao localStorage.
let mem: Map<string, string> | null = null;
let hidratado = false;
const ouvintesHidratacao = new Set<() => void>();

/** Os dados deste aparelho já estão no IndexedDB? (síncrono, para o store) */
export function armazemEmIDB(): boolean {
  try { return localStorage.getItem(MARCADOR) === "idb"; } catch { return false; }
}

/** O disco já foi lido? Enquanto for false, coleção ausente NÃO é coleção vazia. */
export function armazemHidratado(): boolean {
  return hidratado;
}

/** Avisa quando o disco chegou, para a tela repintar com o conteúdo real. */
export function aoHidratar(cb: () => void): void {
  if (hidratado) { cb(); return; }
  ouvintesHidratacao.add(cb);
}

// Duas abas do RH abertas na mesma origem se enxergavam pelo evento "storage"
// do localStorage. O IndexedDB não emite nada parecido, então a conversa passa
// por aqui: quem grava anuncia a chave E o valor, e a outra aba atualiza a
// própria memória na hora (sem ida ao disco) antes de mandar a tela repintar.
const canal = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("impresilk.rh.armazem") : null;
if (canal) {
  canal.onmessage = (ev: MessageEvent) => {
    const dado = ev.data as { chave?: string; valor?: string | null } | null;
    if (!dado || typeof dado.chave !== "string") return;
    if (mem) {
      if (dado.valor == null) mem.delete(dado.chave);
      else mem.set(dado.chave, dado.valor);
    }
    // O store já escuta "storage" para largar o cache e reler — reaproveita.
    try { window.dispatchEvent(new StorageEvent("storage", { key: dado.chave })); } catch { /* ignora */ }
  };
}
const pendentes = new Map<string, Pendente>();
let timer: ReturnType<typeof setTimeout> | null = null;
let prontoP: Promise<void> | null = null;
let edicaoConfirmando = false;
let preparandoEdicao: Map<string, string | null> | null = null;
let transacaoEdicao: { tx: IDBTransaction; chaves: Set<string> } | null = null;
let ultimaEdicao: Promise<unknown> = Promise.resolve();
export function edicaoLocalEmCurso(): boolean { return edicaoConfirmando; }

/** Confirma coleção, fila e histórico na mesma transação antes de anunciar salvo.
 * O callback permanece síncrono; só a confirmação durável é assíncrona.
 */
export function executarEdicaoLocal<T>(editar: () => T, notificar = true): T | Promise<T> {
  if (!mem) return editar();
  const edicao = ultimaEdicao.then(() => confirmarEdicao(editar, notificar));
  ultimaEdicao = edicao.catch(() => undefined);
  return edicao;
}
async function confirmarEdicao<T>(editar: () => T, notificar: boolean): Promise<T> {
  if (edicaoConfirmando) throw new Error("Aguarde a gravação anterior terminar.");
  edicaoConfirmando = true;
  let db: IDBDatabase | null = null;
  const alteracoes = new Map<string, string | null>();
  try {
    if (!await confirmarArmazem()) throw new Error("Confira a gravação local pendente antes de continuar.");
    db = await abrir();
    if (!db) throw new Error("O armazenamento local não está disponível.");
    preparandoEdicao = alteracoes;
    let resultado: T;
    try { resultado = editar(); } finally { preparandoEdicao = null; }
    const anteriores = new Map([...alteracoes.keys()].map(chave => [chave, mem!.get(chave) ?? null]));
    // O store pode ter colocado o rascunho em seu cache síncrono. Releia a
    // memória confirmada até o commit; a tela mantém o editor e o rascunho.
    window.dispatchEvent(new StorageEvent("storage"));
    if (!alteracoes.size) return resultado;
    await new Promise<void>((resolve, reject) => {
      const tx = db!.transaction(STORE, "readwrite"); const os = tx.objectStore(STORE);
      transacaoEdicao = { tx, chaves: new Set(alteracoes.keys()) };
      let restantes = alteracoes.size;
      let divergente = false;
      for (const [chave, anterior] of anteriores) {
        if (recuperacoesBloqueadas.has(chave)) { tx.abort(); break; }
        const req = os.get(chave);
        req.onsuccess = () => {
          if ((req.result ?? null) !== anterior || (mem!.get(chave) ?? null) !== anterior || pendentes.has(chave) || localStorage.getItem(chaveDiario(chave)) !== null) divergente = true;
          if (--restantes) return;
          if (divergente) { tx.abort(); return; }
          for (const [k, valor] of alteracoes) { if (valor === null) os.delete(k); else os.put(valor, k); }
        };
      }
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error("Não foi possível confirmar a gravação. Seu rascunho foi mantido; confira e tente novamente."));
    });
    transacaoEdicao = null;
    for (const [chave, valor] of alteracoes) {
      if (valor === null) mem!.delete(chave); else mem!.set(chave, valor);
      try { canal?.postMessage({ chave, valor }); } catch { /* próximo pull confere */ }
    }
    escritaRecusada = false; mudarEstado(pendentes.size ? "pendente" : "ok");
    window.dispatchEvent(new StorageEvent("storage"));
    return resultado;
  } finally {
    preparandoEdicao = null; transacaoEdicao = null; edicaoConfirmando = false; db?.close();
    window.dispatchEvent(new StorageEvent("storage"));
    if (notificar) window.dispatchEvent(new Event("impresilk:edicao-confirmada"));
  }
}

function temIDB(): boolean {
  return typeof indexedDB !== "undefined" && typeof localStorage !== "undefined";
}

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

function avisarCheio(chave: string, recusada = false) {
  if (recusada) escritaRecusada = true;
  mudarEstado("erro");
  try {
    window.dispatchEvent(new CustomEvent("impresilk:armazenamento-cheio", { detail: { key: chave } }));
  } catch {
    /* ignora */
  }
}

// Grava no disco o que mudou desde a última descarga. Junta rajadas: o store
// grava coleção por coleção, e sem isto uma importação viraria dezenas de
// transações.
/** A gravação em voo: resolve true quando o disco confirmou, false se falhou. */
let emVoo: Promise<boolean> | null = null;
function descarregar() {
  if (timer || emVoo) return;
  timer = setTimeout(() => {
    timer = null;
    void confirmarArmazem();
  }, 200);
}
/** Confirma a cópia principal, inclusive para retentar uma falha temporária. */
export async function confirmarArmazem(): Promise<boolean> {
  if (timer) { clearTimeout(timer); timer = null; }
  if (emVoo) return emVoo;
  emVoo = gravarLote();
  const ok = await emVoo;
  emVoo = null;
  // Uma alteração feita durante a transação tem outra identidade e fica na fila.
  if (ok && pendentes.size) descarregar();
  return ok;
}
async function gravarLote(): Promise<boolean> {
    const lote = new Map(pendentes);
    if (!lote.size) return true;
    const db = await abrir();
    if (!db) {
      // O diário continua durável. Não descarta o lote nem anuncia IDB salvo.
      for (const chave of lote.keys()) avisarCheio(chave);
      return false;
    }
    try {
      await prepararBases(db, new Map([...lote].flatMap(([chave, entrada]) => entrada.valor === null ? [] : [[chave, entrada.valor] as [string, string]])));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const os = tx.objectStore(STORE);
        for (const [chave, entrada] of lote) {
          // Outra aba pode ter concluído uma edição posterior enquanto abrir()
          // aguardava. Sua transação não pode ser seguida por este valor antigo.
          if (entrada.diario && localStorage.getItem(chaveDiario(chave)) !== entrada.diario) continue;
          if (!entrada.diario && entrada.legado !== undefined && localStorage.getItem(chave) !== entrada.legado) continue;
          if (entrada.valor === null) os.delete(chave);
          else os.put(entrada.valor, chave);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("falha ao gravar"));
      });
      for (const [chave, entrada] of lote) {
        // Nem uma confirmação antiga nem outra aba apagam a versão mais nova.
        if (entrada.diario && localStorage.getItem(chaveDiario(chave)) === entrada.diario) localStorage.removeItem(chaveDiario(chave));
        if (entrada.legado !== undefined && localStorage.getItem(chave) === entrada.legado) localStorage.removeItem(chave);
        if (pendentes.get(chave) === entrada) pendentes.delete(chave);
      }
      mudarEstado(escritaRecusada ? "erro" : pendentes.size ? "pendente" : "ok");
      return true;
    } catch {
      // Disco cheio de verdade: a tela precisa saber, senão o trabalho some em
      // silêncio — que é exatamente o defeito que estamos consertando.
      for (const chave of lote.keys()) avisarCheio(chave);
      return false;
    } finally {
      db.close();
    }
}

function agendar(chave: string, entrada: Pendente) {
  pendentes.set(chave, entrada);
  mudarEstado("pendente");
  descarregar();
}

/**
 * Carrega o armazém do disco. Roda uma vez, antes do primeiro render.
 * Se ainda houver dados no localStorage (aparelho vindo da versão antiga),
 * eles são a fonte desta vez: migram para o IndexedDB e LIBERAM o espaço.
 */
export function prontoArmazem(): Promise<void> {
  if (prontoP) return prontoP;
  prontoP = (async () => {
    if (!temIDB()) { if (armazemEmIDB()) avisarCheio(MARCADOR); return; }
    const db = await abrir();
    if (!db) { if (armazemEmIDB()) avisarCheio(MARCADOR); return; }
    const carregado = new Map<string, string>();
    const basesNoDisco = new Map<string, string>();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const os = tx.objectStore(STORE);
        const rc = os.openCursor();
        rc.onsuccess = () => {
          const cur = rc.result;
          if (cur) {
            if (typeof cur.value === "string") {
              const chave = String(cur.key);
              if (chave.startsWith(BASE)) basesNoDisco.set(decodeURIComponent(chave.slice(BASE.length)), cur.value);
              else carregado.set(chave, cur.value);
            }
            cur.continue();
          } else resolve();
        };
        rc.onerror = () => reject(rc.error ?? new Error("falha ao ler"));
      });
    } catch {
      db.close();
      avisarCheio(MARCADOR);
      return; // sem disco legível: segue no localStorage
    }

    for (const [chave, raw] of basesNoDisco) {
      try {
        const base = JSON.parse(raw) as BaseRecuperacao;
        if (typeof base.valor === "string" && typeof base.hash === "string" && await hashRecuperacao(base.valor) === base.hash) bases.set(chave, base);
      } catch { /* um diário que dependa desta base será preservado e bloqueado */ }
    }
    await prepararBases(db, carregado);

    // Migração: o que está no localStorage é o mais recente deste aparelho.
    // Só as chaves JÁ separadas por conta entram, mais as flags de configuração
    // antigas: elas não podem sumir antes de o store conferir sua autoria.
    // As demais chaves sem conta pertencem à cópia anterior (copiaAnterior.ts).
    const migrar: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && PREFIXOS.some((p) => k.startsWith(p)) && (k.includes(":conta:") || k === "impresilk.rh.v1:config:sujas")) migrar.push(k);
      }
    } catch {
      /* sem acesso: nada a migrar */
    }
    for (const k of migrar) {
      try {
        const v = localStorage.getItem(k);
        if (v != null) {
          carregado.set(k, v);
          agendar(k, { valor: v, legado: v });
        }
      } catch {
        /* ignora a chave ilegível */
      }
    }

    // O diário é posterior ao disco e à migração, inclusive para exclusões.
    // Uma chave por coleção/conta evita regravar todas as contas a cada edição.
    const recuperar: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(DIARIO)) recuperar.push(decodeURIComponent(k.slice(DIARIO.length)));
      }
      for (const k of recuperar) {
        try {
          const entrada = lerDiario(k);
          if (!entrada) continue;
          if (entrada.valor === null) carregado.delete(k); else carregado.set(k, entrada.valor);
          // A recuperação também substitui eventual legado ainda não migrado.
          entrada.legado = localStorage.getItem(k) ?? undefined;
          agendar(k, entrada);
        } catch { recuperacoesBloqueadas.add(k); pendentes.delete(k); avisarCheio(k); }
      }
    } catch { avisarCheio(DIARIO); }

    mem = carregado;

    // Só libera o localStorage DEPOIS que o disco confirmou a gravação —
    // apagar antes trocaria um problema de espaço por perda de dado.
    if (migrar.length || recuperar.length) {
      // Espera a GRAVAÇÃO, não o relógio: o timer de 200 ms zerava a fila
      // antes de abrir o banco, o "não há pendência" aos 300 ms era verdade
      // vazia, e o localStorage era apagado com o disco ainda por confirmar
      // (auditoria de 07/09/2026).
      await confirmarArmazem();
    }

    // A partir daqui o disco é a fonte: liga o marcador para que uma próxima
    // abertura saiba esperar em vez de mostrar os dados de exemplo.
    try { localStorage.setItem(MARCADOR, "idb"); } catch { /* ignora */ }
    db.close();
    hidratado = true;
    for (const cb of ouvintesHidratacao) { try { cb(); } catch { /* ignora */ } }
    ouvintesHidratacao.clear();
  })();
  return prontoP;
}

export function lerArmazem(chave: string): string | null {
  if (preparandoEdicao?.has(chave)) return preparandoEdicao.get(chave) ?? null;
  if (mem) return mem.get(chave) ?? null;
  try { const entrada = lerDiario(chave); return entrada ? entrada.valor : localStorage.getItem(chave); } catch { return null; }
}

/** Inventário local para identificar migrações antigas sem atribuir outra conta. */
export function chavesArmazem(): string[] {
  if (mem) return [...mem.keys()];
  const chaves = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const chave = localStorage.key(i);
      if (!chave) continue;
      if (chave.startsWith(DIARIO)) {
        const original = decodeURIComponent(chave.slice(DIARIO.length));
        if (lerArmazem(original) !== null) chaves.add(original);
      } else if (lerArmazem(chave) !== null) chaves.add(chave);
    }
  } catch { /* inventário parcial nunca autoriza migração de IDB não hidratado */ }
  return [...chaves];
}

/** Retorna false quando não conseguiu guardar (o chamador avisa o usuário). */
export function gravarArmazem(chave: string, valor: string): boolean {
  if (preparandoEdicao) { preparandoEdicao.set(chave, valor); return true; }
  if (transacaoEdicao?.chaves.has(chave)) { try { transacaoEdicao.tx.abort(); } catch { /* já terminou */ } }
  if (mem || armazemEmIDB()) {
    let diario: string;
    try {
      if (recuperacoesBloqueadas.has(chave)) throw new Error("Recuperação pendente de conferência");
      // Sem disco legível, não substitui um delta cuja base não está disponível.
      lerDiario(chave);
      diario = criarDiario(valor, bases.get(chave));
      localStorage.setItem(chaveDiario(chave), diario);
    } catch { avisarCheio(chave, true); return false; }
    escritaRecusada = false;
    mem?.set(chave, valor);
    agendar(chave, { valor, diario, legado: localStorage.getItem(chave) ?? undefined });
    try { canal?.postMessage({ chave, valor }); } catch { /* ignora */ }
    return true;
  }
  try { localStorage.setItem(chave, valor); escritaRecusada = false; mudarEstado("ok"); return true; } catch { avisarCheio(chave, true); return false; }
}

/** Recebimento remoto: só publica na memória depois do commit, sem diário grande.
 * Uma edição feita enquanto o disco responde vence; o sincronizador refaz a mescla.
 * A cópia já existe na nuvem, portanto não precisa do diário síncrono das edições.
 */
export async function receberArmazem(chave: string, valor: string, podeAplicar: () => boolean): Promise<boolean> {
  const anterior = lerArmazem(chave);
  if (!mem) {
    if (!podeAplicar()) return false;
    if (!gravarArmazem(chave, valor)) throw new Error("Não foi possível guardar a alteração neste aparelho. Libere espaço antes de tentar novamente.");
    return true;
  }
  if (recuperacoesBloqueadas.has(chave)) throw new Error("Há uma recuperação local pendente de conferência. O conteúdo foi preservado.");
  if (!await confirmarArmazem()) throw new Error("Não foi possível confirmar as edições locais pendentes.");
  const db = await abrir();
  if (!db) throw new Error("O armazenamento local não está disponível. Tente sincronizar novamente.");
  const continuaAtual = () => !edicaoConfirmando && podeAplicar() && lerArmazem(chave) === anterior && !pendentes.has(chave) && localStorage.getItem(chaveDiario(chave)) === null;
  let gravou = false;
  let encontrado: string | null = anterior;
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"); const os = tx.objectStore(STORE);
      const req = os.get(chave);
      req.onsuccess = () => {
        encontrado = typeof req.result === "string" ? req.result : null;
        // Compara dentro da transação: uma aba atrasada não desfaz outra escrita.
        if (continuaAtual() && encontrado === anterior) { os.put(valor, chave); gravou = true; }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("A gravação local não foi concluída. Tente sincronizar novamente."));
    });
    if (gravou) await prepararBases(db, new Map([[chave, valor]]));
    if (!continuaAtual()) return false;
    // Se outra aba confirmou primeiro, adota o disco para refazer a mescla.
    const confirmado = gravou ? valor : encontrado;
    if (confirmado === null) mem.delete(chave); else mem.set(chave, confirmado);
    mudarEstado(escritaRecusada ? "erro" : pendentes.size ? "pendente" : "ok");
    try { window.dispatchEvent(new StorageEvent("storage", { key: chave })); } catch { /* cache será invalidado pelo chamador */ }
    if (gravou) { try { canal?.postMessage({ chave, valor }); } catch { /* a próxima leitura confere o disco */ } }
    return gravou;
  } catch (e) {
    avisarCheio(chave);
    throw e;
  } finally { db.close(); }
}

export function removerArmazem(chave: string): void {
  if (preparandoEdicao) { preparandoEdicao.set(chave, null); return; }
  if (transacaoEdicao?.chaves.has(chave)) { try { transacaoEdicao.tx.abort(); } catch { /* já terminou */ } }
  if (mem || armazemEmIDB()) {
    let diario: string;
    try {
      if (recuperacoesBloqueadas.has(chave)) throw new Error("Recuperação pendente de conferência");
      lerDiario(chave);
      diario = criarDiario(null);
      localStorage.setItem(chaveDiario(chave), diario);
    } catch {
      avisarCheio(chave, true);
      throw new Error("Não foi possível guardar a exclusão neste aparelho. Libere espaço e tente novamente.");
    }
    escritaRecusada = false;
    mem?.delete(chave);
    agendar(chave, { valor: null, diario, legado: localStorage.getItem(chave) ?? undefined });
    try { canal?.postMessage({ chave, valor: null }); } catch { /* ignora */ }
    return;
  }
  try { localStorage.removeItem(chave); } catch { /* ignora */ }
}
