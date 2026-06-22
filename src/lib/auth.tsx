import { createContext, useContext, useState, type ReactNode } from "react";
import type { Colaborador, Perfil } from "@/data/seed";

const CHAVE = "impresilk_sessao_v2";

export interface Sessao {
  colaboradorId: string;
  perfil: Perfil;
  nome: string;
}

interface Ctx {
  sessao: Sessao | null;
  entrar: (s: Sessao) => void;
  sair: () => void;
}
const AuthCtx = createContext<Ctx | null>(null);

function carregarSessao(): Sessao | null {
  try {
    const raw = localStorage.getItem(CHAVE);
    return raw ? (JSON.parse(raw) as Sessao) : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null>(carregarSessao);
  function entrar(s: Sessao) {
    setSessao(s);
    localStorage.setItem(CHAVE, JSON.stringify(s));
  }
  function sair() {
    setSessao(null);
    localStorage.removeItem(CHAVE);
  }
  return <AuthCtx.Provider value={{ sessao, entrar, sair }}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth fora do AuthProvider");
  return c;
}

// IDs da equipe (subárvore) de um gestor, incluindo ele mesmo.
export function idsDaEquipe(colaboradorId: string, colaboradores: Colaborador[]): Set<string> {
  const filhos = new Map<string, string[]>();
  for (const c of colaboradores) {
    if (c.gestorId) {
      const l = filhos.get(c.gestorId) ?? [];
      l.push(c.id);
      filhos.set(c.gestorId, l);
    }
  }
  const res = new Set<string>([colaboradorId]);
  const fila = [colaboradorId];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const f of filhos.get(atual) ?? []) {
      if (!res.has(f)) { res.add(f); fila.push(f); }
    }
  }
  return res;
}

// Colaboradores visíveis para a sessão (RH = todos; Gestor = equipe; Colaborador = ele).
export function escopo(sessao: Sessao, colaboradores: Colaborador[]): Colaborador[] {
  if (sessao.perfil === "ADMIN_RH") return colaboradores;
  if (sessao.perfil === "GESTOR") {
    const ids = idsDaEquipe(sessao.colaboradorId, colaboradores);
    return colaboradores.filter((c) => ids.has(c.id));
  }
  return colaboradores.filter((c) => c.id === sessao.colaboradorId);
}

export function podeVerSensivel(sessao: Sessao, colaboradorId: string): boolean {
  return sessao.perfil === "ADMIN_RH" || sessao.colaboradorId === colaboradorId;
}
