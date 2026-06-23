// ============================================================================
// Login real (cliente). Em MODO_JWT, a senha é verificada NO SERVIDOR (função
// /auth), que devolve um crachá assinado (JWT). O crachá é guardado e usado
// para falar com a nuvem. A sessão do app (perfil + colaborador) é derivada do
// próprio crachá. Fora do MODO_JWT, o app usa o login local de sempre.
// ============================================================================
import { entrar, sair, type Sessao } from "@/lib/session";
import type { Perfil } from "@/data/types";

declare const __AUTH_JWT__: boolean;
export const MODO_JWT: boolean = typeof __AUTH_JWT__ === "boolean" ? __AUTH_JWT__ : false;

const K_TOKEN = "impresilk.auth.token";
const ENDPOINT = "/.netlify/functions/auth";
const temWindow = typeof window !== "undefined";

interface Payload { sub: string; perfil: Perfil; nome?: string; exp?: number; master?: boolean }

export class ErroAuth extends Error {
  constructor(public tipo: "indisponivel" | "credencial" | "rede", msg: string) { super(msg); }
}

// Decodifica o payload do JWT (sem verificar assinatura — quem verifica é o
// servidor a cada chamada). Trata base64url + UTF-8 (nomes com acento).
function decodificar(token: string): Payload | null {
  try {
    let s = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bytes = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch { return null; }
}

// Token guardado, se ainda válido (não expirado). Senão, null.
export function tokenAtual(): string | null {
  if (!temWindow) return null;
  const t = localStorage.getItem(K_TOKEN);
  if (!t) return null;
  const p = decodificar(t);
  if (!p || (typeof p.exp === "number" && p.exp < Date.now() / 1000)) return null;
  return t;
}

export function sessaoDoToken(): Sessao | null {
  const t = tokenAtual();
  const p = t ? decodificar(t) : null;
  return p ? { perfil: p.perfil, colaboradorId: p.sub } : null;
}

// Faz login no servidor. Sucesso → guarda o crachá, define a sessão e avisa o
// módulo de sync. Lança ErroAuth com `tipo` para o chamador decidir o caminho.
export async function loginServidor(usuario: string, senha: string): Promise<Sessao> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "login", usuario, senha }) });
  } catch { throw new ErroAuth("rede", "Sem conexão para entrar. Tente novamente com internet."); }
  const data = await res.json().catch(() => ({} as any));
  if (res.ok && data?.token) {
    if (temWindow) localStorage.setItem(K_TOKEN, data.token);
    const sess: Sessao = { perfil: data.perfil as Perfil, colaboradorId: data.colaboradorId };
    entrar(sess.perfil, sess.colaboradorId);
    if (temWindow) window.dispatchEvent(new CustomEvent("impresilk:autenticado"));
    return sess;
  }
  // 401 = credencial inválida (mostra o erro). Qualquer outra coisa (404/5xx/501
  // = função ausente/fora do ar) é tratada como "indisponível" → login local.
  if (res.status === 401) throw new ErroAuth("credencial", data?.erro || "Senha incorreta.");
  throw new ErroAuth("indisponivel", data?.erro || "Login indisponível no momento.");
}

export function logoutAuth(): void {
  if (temWindow) localStorage.removeItem(K_TOKEN);
  sair();
}

// ------- provisionamento (somente RH; usa o crachá do RH logado) -------
async function chamarAuth(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const t = tokenAtual();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.erro || `Erro ${res.status}`);
  return data;
}
export interface ContaServidor { usuario: string; colaboradorId: string; nome?: string; perfil: string; atualizadoEm: string }
export const definirSenhaUsuario = (p: { usuario: string; colaboradorId: string; perfil: string; nome?: string; senha: string }) => chamarAuth("definirSenha", p);
export const removerSenhaUsuario = (usuario: string) => chamarAuth("removerSenha", { usuario });
export const listarContasServidor = (): Promise<ContaServidor[]> => chamarAuth("listarContas").then((d) => d.contas ?? []);

// Na carga do app (MODO_JWT): sem crachá válido → garante que não há sessão
// pendurada (força ir ao login). Com crachá válido, mantém a sessão.
if (temWindow && MODO_JWT && !tokenAtual()) sair();
