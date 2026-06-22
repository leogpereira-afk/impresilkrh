// Armazenamento de blobs grandes (documentos) no IndexedDB, que tem cota MUITO
// maior que o localStorage (~5 MB). O localStorage passa a guardar só os metadados;
// o conteúdo do arquivo (data URL) fica aqui. Assim os uploads não estouram a cota
// e os dados deixam de "sumir" ao recarregar.
import { useEffect, useState } from "react";

const DB_NAME = "impresilk.rh.blobs";
const STORE = "blobs";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase | null> | null = null;

function abrir(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, VERSION);
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
  return dbPromise;
}

// Grava um data URL sob uma chave. Retorna true se conseguiu persistir.
export async function putBlob(key: string, dataUrl: string): Promise<boolean> {
  const db = await abrir();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getBlob(key: string): Promise<string | null> {
  const db = await abrir();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve((r.result as string) ?? null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function delBlob(key: string): Promise<void> {
  const db = await abrir();
  if (!db) return;
  try {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(key);
  } catch {
    /* ignora */
  }
}

// Hook reativo: carrega um blob de forma assíncrona. Retorna o data URL ou null.
export function useBlob(key: string | null | undefined): string | null {
  const [val, setVal] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    if (!key) {
      setVal(null);
      return;
    }
    getBlob(key).then((v) => {
      if (vivo) setVal(v);
    });
    return () => {
      vivo = false;
    };
  }, [key]);
  return val;
}
