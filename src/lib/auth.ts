// ============================================================================
// Login real (cliente) — via Supabase Auth. A senha é verificada pelo próprio
// Supabase (nunca no navegador); a sessão do app (perfil + colaborador) vem da
// tabela "perfis" logo após o login. Continua sendo login por NOME (não
// e-mail) — ver Login.tsx — através de um e-mail sintético interno.
// ============================================================================
import type { Session } from "@supabase/supabase-js";
import { supabase, SUPABASE_CONFIGURADO, FN_ADMIN_USERS } from "@/lib/supabase";
import { entrar, sair, type Sessao } from "@/lib/session";
import type { Perfil } from "@/data/types";

export const MODO_JWT: boolean = SUPABASE_CONFIGURADO;

const temWindow = typeof window !== "undefined";
const DOMINIO_SINTETICO = "rh.impresilk.local";

export const normalizarUsuario = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const emailSintetico = (usuario: string) => `${usuario.replace(/\s+/g, ".")}@${DOMINIO_SINTETICO}`;

export class ErroAuth extends Error {
  constructor(public tipo: "indisponivel" | "credencial" | "rede", msg: string) { super(msg); }
}

// Sessão do Supabase cacheada em memória: getSession() é assíncrono, mas várias
// partes do app (status de sincronização, cabeçalho das chamadas de sync)
// precisam de uma leitura SÍNCRONA do token atual. Mantida em dia pelo listener.
let sessaoAtual: Session | null = null;
if (temWindow && supabase) {
  supabase.auth.onAuthStateChange((_ev, s) => { sessaoAtual = s; });
  supabase.auth.getSession().then(({ data }) => {
    sessaoAtual = data.session ?? null;
    if (!data.session) sair(); // sem sessão válida no Supabase → garante que não há sessão pendurada
  });
}

// Token guardado, se ainda válido (o supabase-js já cuida do refresh sozinho).
export function tokenAtual(): string | null {
  return sessaoAtual?.access_token ?? null;
}

async function perfilDoUsuario(userId: string): Promise<Sessao | null> {
  if (!supabase) return null;
  const { data } = await supabase.from("perfis").select("perfil, colaborador_id").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { perfil: data.perfil as Perfil, colaboradorId: data.colaborador_id };
}

// Faz login no Supabase Auth. Sucesso → guarda a sessão, define a sessão do
// app e avisa o módulo de sync. Lança ErroAuth com `tipo` para o chamador decidir.
export async function loginServidor(nome: string, senha: string): Promise<Sessao> {
  if (!supabase) throw new ErroAuth("indisponivel", "Login por servidor não configurado.");
  const usuario = normalizarUsuario(nome);
  let auth: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    auth = await supabase.auth.signInWithPassword({ email: emailSintetico(usuario), password: senha });
  } catch {
    throw new ErroAuth("rede", "Sem conexão para entrar. Tente novamente com internet.");
  }
  if (auth.error) {
    // O Supabase devolve o mesmo erro para "usuário não existe" e "senha errada"
    // (não vaza qual dos dois foi) — tratamos ambos como credencial incorreta.
    if (auth.error.status === 400 || auth.error.status === 401) throw new ErroAuth("credencial", "Senha incorreta.");
    throw new ErroAuth("indisponivel", auth.error.message || "Login indisponível no momento.");
  }
  sessaoAtual = auth.data.session;
  const sess = await perfilDoUsuario(auth.data.user!.id);
  if (!sess) {
    await supabase.auth.signOut();
    throw new ErroAuth("credencial", "Conta sem perfil vinculado. Fale com o RH.");
  }
  entrar(sess.perfil, sess.colaboradorId);
  if (temWindow) window.dispatchEvent(new CustomEvent("impresilk:autenticado"));
  return sess;
}

export function logoutAuth(): void {
  sair();
  void supabase?.auth.signOut();
}

// ------- provisionamento (somente RH; via Edge Function admin-users) -------
async function chamarAdmin(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const t = tokenAtual();
  const res = await fetch(FN_ADMIN_USERS, {
    method: "POST",
    headers: { "content-type": "application/json", ...(t ? { authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({} as any));
  if (!res.ok) throw new Error(data?.erro || `Erro ${res.status}`);
  return data;
}
export interface ContaServidor { usuario: string; colaboradorId: string; nome?: string; perfil: string; atualizadoEm: string }
export const definirSenhaUsuario = (p: { usuario: string; colaboradorId: string; perfil: string; nome?: string; senha: string }) =>
  chamarAdmin("provisionar", p);
export const removerSenhaUsuario = (usuario: string) => chamarAdmin("removerAcesso", { usuario });

// Lê direto da tabela "perfis" (RLS: ADMIN_RH vê todas as linhas) — não precisa
// de Edge Function, é uma leitura simples.
export async function listarContasServidor(): Promise<ContaServidor[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("perfis").select("usuario, colaborador_id, nome, perfil, atualizado_em");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    usuario: d.usuario, colaboradorId: d.colaborador_id, nome: d.nome ?? undefined, perfil: d.perfil, atualizadoEm: d.atualizado_em,
  }));
}
