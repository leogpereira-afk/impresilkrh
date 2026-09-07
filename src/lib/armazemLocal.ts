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
// IndexedDB é o disco, gravado logo depois com uma pequena espera para juntar
// rajadas. `prontoArmazem()` carrega o disco uma vez, no boot, e migra o que
// ainda estiver no localStorage — liberando aquele espaço.
//
// SEM IndexedDB (aba anônima, navegador antigo, jsdom dos testes) tudo segue
// exatamente como antes, direto no localStorage.

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
let pendentes: Map<string, string | null> = new Map();
let timer: ReturnType<typeof setTimeout> | null = null;
let prontoP: Promise<void> | null = null;

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

function avisarCheio(chave: string) {
  try {
    window.dispatchEvent(new CustomEvent("impresilk:armazenamento-cheio", { detail: { key: chave } }));
  } catch {
    /* ignora */
  }
}

// Grava no disco o que mudou desde a última descarga. Junta rajadas: o store
// grava coleção por coleção, e sem isto uma importação viraria dezenas de
// transações.
function descarregar() {
  if (timer) return;
  timer = setTimeout(async () => {
    timer = null;
    const lote = pendentes;
    pendentes = new Map();
    if (!lote.size) return;
    const db = await abrir();
    if (!db) {
      // Perdeu o disco no meio do caminho: devolve para o localStorage, que é
      // pequeno mas é o que resta — e avisa se nem ele aceitar.
      for (const [chave, valor] of lote) {
        try {
          if (valor === null) localStorage.removeItem(chave);
          else localStorage.setItem(chave, valor);
        } catch {
          avisarCheio(chave);
        }
      }
      return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readwrite");
        const os = tx.objectStore(STORE);
        for (const [chave, valor] of lote) {
          if (valor === null) os.delete(chave);
          else os.put(valor, chave);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error("falha ao gravar"));
      });
    } catch {
      // Disco cheio de verdade: a tela precisa saber, senão o trabalho some em
      // silêncio — que é exatamente o defeito que estamos consertando.
      for (const chave of lote.keys()) avisarCheio(chave);
    }
  }, 200);
}

function agendar(chave: string, valor: string | null) {
  pendentes.set(chave, valor);
  descarregar();
  try { canal?.postMessage({ chave, valor }); } catch { /* ignora */ }
}

/**
 * Carrega o armazém do disco. Roda uma vez, antes do primeiro render.
 * Se ainda houver dados no localStorage (aparelho vindo da versão antiga),
 * eles são a fonte desta vez: migram para o IndexedDB e LIBERAM o espaço.
 */
export function prontoArmazem(): Promise<void> {
  if (prontoP) return prontoP;
  prontoP = (async () => {
    if (!temIDB()) return; // segue no localStorage, como antes
    const db = await abrir();
    if (!db) return;
    const carregado = new Map<string, string>();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const os = tx.objectStore(STORE);
        const rc = os.openCursor();
        rc.onsuccess = () => {
          const cur = rc.result;
          if (cur) {
            if (typeof cur.value === "string") carregado.set(String(cur.key), cur.value);
            cur.continue();
          } else resolve();
        };
        rc.onerror = () => reject(rc.error ?? new Error("falha ao ler"));
      });
    } catch {
      return; // sem disco legível: segue no localStorage
    }

    // Migração: o que está no localStorage é o mais recente deste aparelho.
    // Só as chaves JÁ separadas por conta (":conta:") entram aqui — as antigas,
    // sem conta, são assunto da cópia de recuperação (copiaAnterior.ts).
    const migrar: string[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && PREFIXOS.some((p) => k.startsWith(p)) && k.includes(":conta:")) migrar.push(k);
      }
    } catch {
      /* sem acesso: nada a migrar */
    }
    for (const k of migrar) {
      try {
        const v = localStorage.getItem(k);
        if (v != null) {
          carregado.set(k, v);
          agendar(k, v);
        }
      } catch {
        /* ignora a chave ilegível */
      }
    }

    mem = carregado;

    // Só libera o localStorage DEPOIS que o disco confirmou a gravação —
    // apagar antes trocaria um problema de espaço por perda de dado.
    if (migrar.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
      if (!timer && !pendentes.size) {
        for (const k of migrar) {
          try { localStorage.removeItem(k); } catch { /* ignora */ }
        }
      }
    }

    // A partir daqui o disco é a fonte: liga o marcador para que uma próxima
    // abertura saiba esperar em vez de mostrar os dados de exemplo.
    try { localStorage.setItem(MARCADOR, "idb"); } catch { /* ignora */ }
    hidratado = true;
    for (const cb of ouvintesHidratacao) { try { cb(); } catch { /* ignora */ } }
    ouvintesHidratacao.clear();
  })();
  return prontoP;
}

export function lerArmazem(chave: string): string | null {
  if (mem) return mem.get(chave) ?? null;
  try { return localStorage.getItem(chave); } catch { return null; }
}

/** Retorna false quando não conseguiu guardar (o chamador avisa o usuário). */
export function gravarArmazem(chave: string, valor: string): boolean {
  if (mem) {
    mem.set(chave, valor);
    agendar(chave, valor);
    return true;
  }
  try { localStorage.setItem(chave, valor); return true; } catch { return false; }
}

export function removerArmazem(chave: string): void {
  if (mem) {
    mem.delete(chave);
    agendar(chave, null);
    return;
  }
  try { localStorage.removeItem(chave); } catch { /* ignora */ }
}
