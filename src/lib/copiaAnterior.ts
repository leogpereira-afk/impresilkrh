// Preserva o cache sem autoria da versão anterior antes de liberar espaço para
// os retratos separados por conta. Nenhum registro é enviado ao servidor aqui.
type Copia = { id: string; criadaEm: string; valores: Record<string, string> };
const DB = "impresilk.rh.recuperacao";
const STORE = "copias";
let preparando: Promise<void> | null = null;

function valoresLegados(): Record<string, string> {
  const valores: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    if (k.includes(":conta:")) continue;
    if (k.startsWith("impresilk.rh.v1:col:") || k === "impresilk.rh.v1:config" || ["impresilk.sync.fila", "impresilk.sync.falhas", "impresilk.sync.massa"].includes(k)) {
      const valor = localStorage.getItem(k);
      if (valor != null) valores[k] = valor;
    }
  }
  return valores;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("Não foi possível guardar a cópia anterior deste aparelho. O conteúdo original foi preservado."));
    } catch { reject(new Error("Armazenamento de recuperação indisponível. O conteúdo original foi preservado.")); }
  });
}

async function copiar(): Promise<void> {
  if (typeof localStorage === "undefined") return;
  const valores = valoresLegados();
  if (!Object.keys(valores).length) return;
  const db = await abrir();
  try {
    const id = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const copia: Copia = { id, criadaEm: new Date().toISOString(), valores };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(copia);
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error("A cópia anterior não foi concluída. Nenhum conteúdo original foi removido."));
    });
    const conferida = await new Promise<Copia>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("Não foi possível conferir a cópia anterior."));
    });
    if (JSON.stringify(conferida?.valores) !== JSON.stringify(valores)) throw new Error("A cópia anterior não passou na conferência. O original foi preservado.");
    // Uma aba antiga pode ter editado enquanto a cópia era feita: nesse caso,
    // a edição mais recente permanece no localStorage para a próxima conferência.
    for (const [chave, valor] of Object.entries(valores)) if (localStorage.getItem(chave) === valor) localStorage.removeItem(chave);
  } finally { db.close(); }
}

export function prepararCopiaAnterior(): Promise<void> {
  if (!preparando) preparando = copiar().finally(() => { preparando = null; });
  return preparando;
}

export async function lerCopiaAnterior(): Promise<Record<string, string>> {
  const db = await abrir();
  try {
    const copias = await new Promise<Copia[]>((resolve, reject) => {
      const req = db.transaction(STORE).objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(new Error("Não foi possível ler a cópia anterior."));
    });
    const valores: Record<string, string> = {};
    for (const copia of copias.sort((a, b) => a.criadaEm.localeCompare(b.criadaEm))) Object.assign(valores, copia.valores);
    return { ...valores, ...valoresLegados() };
  } finally { db.close(); }
}
