// Armazenamento de blobs grandes (documentos) no IndexedDB, que tem cota MUITO
// maior que o localStorage (~5 MB). O localStorage passa a guardar só os metadados;
// o conteúdo do arquivo (data URL) fica aqui. Assim os uploads não estouram a cota
// e os dados deixam de "sumir" ao recarregar.
import { useEffect, useState } from "react";
import { chaveLocal, contextoDoUsuario } from "./armazenamentoUsuario";
import { obterSessao, useSessao } from "./session";

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
  const contexto = contextoDoUsuario();
  const chave = chaveLocal(key);
  const db = await abrir();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(dataUrl, chave);
      tx.oncomplete = () => resolve(contexto === contextoDoUsuario());
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function getBlob(key: string): Promise<string | null> {
  const contexto = contextoDoUsuario();
  const chave = chaveLocal(key);
  const db = await abrir();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(chave);
      r.onsuccess = () => resolve(contexto === contextoDoUsuario() ? (r.result as string) ?? null : null);
      r.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function delBlob(key: string): Promise<void> {
  const contexto = contextoDoUsuario();
  const chave = chaveLocal(key);
  const db = await abrir();
  if (!db) return;
  if (contexto !== contextoDoUsuario()) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(chave);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

// Hook reativo: carrega um blob de forma assíncrona. Retorna o data URL ou null.
export function useBlob(key: string | null | undefined): string | null {
  useSessao();
  const contexto = contextoDoUsuario();
  const [estado, setEstado] = useState<{ contexto: string; key: string; val: string | null } | null>(null);
  useEffect(() => {
    let vivo = true;
    setEstado(null);
    if (!key) return;
    getBlob(key).then((v) => {
      if (vivo) setEstado({ contexto, key, val: v });
    });
    return () => {
      vivo = false;
    };
  }, [key, contexto]);
  return estado?.contexto === contexto && estado.key === key ? estado.val : null;
}

/** Exportação administrativa dos anexos anteriores, sem atribuí-los a uma conta. */
export async function exportarBlobsAnteriores(): Promise<Record<string, string>> {
  if (obterSessao()?.perfil !== "ADMIN_RH") return {};
  const contexto = contextoDoUsuario();
  const db = await abrir();
  if (!db) throw new Error("Não foi possível conferir os anexos anteriores.");
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE);
    const req = tx.objectStore(STORE).openCursor();
    const arquivos: Record<string, string> = {};
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(contexto === contextoDoUsuario() ? arquivos : {}); return; }
      const key = String(cursor.key);
      if (!key.includes(":conta:") && typeof cursor.value === "string") arquivos[key] = cursor.value;
      cursor.continue();
    };
    req.onerror = () => reject(new Error("Não foi possível recuperar os anexos anteriores."));
  });
}
