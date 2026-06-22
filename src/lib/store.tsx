import { createContext, useContext, useState, type ReactNode } from "react";
import {
  AREAS, NIVEIS, STATUSES, CARGOS, COLABORADORES, DOCUMENTOS, USUARIOS,
  type Area, type Nivel, type StatusColab, type Cargo, type Colaborador, type Documento, type Perfil,
} from "@/data/seed";

const CHAVE = "impresilk_rh_v2";

export interface BancoLocal {
  areas: Area[];
  niveis: Nivel[];
  statuses: StatusColab[];
  cargos: Cargo[];
  colaboradores: Colaborador[];
  documentos: Documento[];
  usuarios: { colaboradorId: string; perfil: Perfil }[];
}

function padrao(): BancoLocal {
  return {
    areas: AREAS, niveis: NIVEIS, statuses: STATUSES, cargos: CARGOS,
    colaboradores: COLABORADORES, documentos: DOCUMENTOS, usuarios: USUARIOS,
  };
}

function carregar(): BancoLocal {
  try {
    const raw = localStorage.getItem(CHAVE);
    if (raw) return { ...padrao(), ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return padrao();
}

interface Ctx {
  db: BancoLocal;
  setColecao: <K extends keyof BancoLocal>(chave: K, valor: BancoLocal[K]) => void;
  resetar: () => void;
  exportar: () => void;
  importar: (json: string) => boolean;
}

const StoreCtx = createContext<Ctx | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<BancoLocal>(carregar);

  function persistir(novo: BancoLocal) {
    setDb(novo);
    try { localStorage.setItem(CHAVE, JSON.stringify(novo)); } catch { /* quota */ }
  }
  function setColecao<K extends keyof BancoLocal>(chave: K, valor: BancoLocal[K]) {
    persistir({ ...db, [chave]: valor });
  }
  function resetar() {
    localStorage.removeItem(CHAVE);
    setDb(padrao());
  }
  function exportar() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `impresilk-rh-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importar(json: string): boolean {
    try {
      const obj = JSON.parse(json);
      persistir({ ...padrao(), ...obj });
      return true;
    } catch { return false; }
  }

  return (
    <StoreCtx.Provider value={{ db, setColecao, resetar, exportar, importar }}>
      {children}
    </StoreCtx.Provider>
  );
}

export function useStore() {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore fora do StoreProvider");
  return c;
}
