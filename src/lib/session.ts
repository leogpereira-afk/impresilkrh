import { useCallback, useSyncExternalStore } from "react";
import type { Perfil } from "@/data/types";

export const SENHA_DEMO = "Impresilk@2026";
const SESSAO_KEY = "impresilk.rh.v1:sessao";

export interface Sessao {
  perfil: Perfil;
  colaboradorId: string;
}

const temWindow = typeof window !== "undefined";
let cache: Sessao | null | undefined = undefined;
const listeners = new Set<() => void>();

function ler(): Sessao | null {
  if (cache !== undefined) return cache;
  let val: Sessao | null = null;
  if (temWindow) {
    const raw = window.localStorage.getItem(SESSAO_KEY);
    if (raw) {
      try {
        val = JSON.parse(raw);
      } catch {
        val = null;
      }
    }
  }
  cache = val;
  return val;
}

function emit() {
  listeners.forEach((cb) => cb());
}

export function entrar(perfil: Perfil, colaboradorId: string): void {
  cache = { perfil, colaboradorId };
  if (temWindow) window.localStorage.setItem(SESSAO_KEY, JSON.stringify(cache));
  emit();
}

export function sair(): void {
  cache = null;
  if (temWindow) window.localStorage.removeItem(SESSAO_KEY);
  emit();
}

export function obterSessao(): Sessao | null {
  return ler();
}

export function useSessao(): Sessao | null {
  const subscribe = useCallback((cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, []);
  return useSyncExternalStore(subscribe, ler, ler);
}
