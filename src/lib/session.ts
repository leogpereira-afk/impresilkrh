import { useCallback, useSyncExternalStore } from "react";
import type { Perfil } from "@/data/types";

export const SENHA_DEMO = "Impresilk@2026";
const SESSAO_KEY = "impresilk.rh.v1:sessao";
const TOKEN_KEY = "impresilk.auth.token"; // espelha K_TOKEN de lib/auth.ts

// A sessão ficava gravada PARA SEMPRE: um computador do escritório continuava
// logado como RH meses depois, e quem sentasse ali via a folha inteira. Agora ela
// vale por um tempo de inatividade — cada uso renova; parado além disso, volta
// para a tela de login. Não apaga NENHUM dado, só exige entrar de novo.
const VALIDADE_MS = 12 * 60 * 60 * 1000; // 12 horas paradas

export interface Sessao {
  perfil: Perfil;
  colaboradorId: string;
}
interface SessaoGravada extends Sessao {
  visto?: number; // instante do último uso (ms)
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
        const g = JSON.parse(raw) as SessaoGravada;
        // Sessão antiga (sem carimbo) ganha um carimbo agora em vez de derrubar
        // quem já estava logado no momento da atualização.
        const visto = typeof g?.visto === "number" ? g.visto : Date.now();
        if (g?.perfil && g?.colaboradorId && Date.now() - visto <= VALIDADE_MS) {
          val = { perfil: g.perfil, colaboradorId: g.colaboradorId };
          gravar(val, visto);
        } else if (g?.perfil) {
          window.localStorage.removeItem(SESSAO_KEY); // expirou
        }
      } catch {
        val = null;
      }
    }
  }
  cache = val;
  return val;
}

function gravar(s: Sessao, visto: number) {
  if (!temWindow) return;
  try { window.localStorage.setItem(SESSAO_KEY, JSON.stringify({ ...s, visto } satisfies SessaoGravada)); } catch { /* cota: segue em memória */ }
}

function emit() {
  listeners.forEach((cb) => cb());
}

export function entrar(perfil: Perfil, colaboradorId: string): void {
  cache = { perfil, colaboradorId };
  gravar(cache, Date.now());
  emit();
  // Avisa o sync: agora pode baixar a base completa (deslogado ele só traz o
  // cadastro de acesso). O login por servidor dispara o mesmo evento.
  if (temWindow) { try { window.dispatchEvent(new CustomEvent("impresilk:autenticado")); } catch { /* ignora */ } }
}

/** Marca atividade: adia a expiração. Chamado a cada navegação/interação. */
export function renovarSessao(): void {
  const s = cache ?? ler();
  if (s) gravar(s, Date.now());
}

export function sair(): void {
  cache = null;
  if (temWindow) {
    window.localStorage.removeItem(SESSAO_KEY);
    // O crachá do servidor (JWT) também precisa sumir — senão o computador
    // continuava falando com a nuvem como o usuário anterior depois do "Sair".
    try { window.localStorage.removeItem(TOKEN_KEY); } catch { /* ignora */ }
  }
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

// Vigia da expiração: revalida ao voltar para a aba e a cada 5 min. Quem estourou
// o tempo cai no login sem precisar recarregar a página na mão.
if (temWindow) {
  const conferir = () => {
    const antes = cache;
    cache = undefined;
    if (antes && !ler()) emit(); // estava logado e expirou
  };
  window.addEventListener("focus", conferir);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") conferir(); });
  setInterval(conferir, 5 * 60 * 1000);
  // Qualquer uso real do sistema adia a expiração (sem gravar a cada tecla).
  let ultima = 0;
  const marcar = () => { const t = Date.now(); if (t - ultima > 60_000) { ultima = t; renovarSessao(); } };
  window.addEventListener("click", marcar, true);
  window.addEventListener("keydown", marcar, true);
}
