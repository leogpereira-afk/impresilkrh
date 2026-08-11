// ============================================================================
// Login real (cliente) — via Supabase Auth. A senha é verificada pelo próprio
// Supabase (nunca no navegador); a sessão do app (perfil + colaborador) vem da
// tabela "perfis" logo após o login. Continua sendo login por NOME (não
// e-mail) — ver Login.tsx — através de um e-mail sintético interno.
//
// Compatibilidade: mantém a MESMA superfície de antes (loginServidor, ErroAuth,
// tokenAtual, definirSenhaUsuario, removerSenhaUsuario, listarContasServidor,
// trocarMinhaSenha, logadoNoServidor, MODO_JWT) para não quebrar Login.tsx,
// PainelControle.tsx, MeuPerfil.tsx nem o módulo de sync.
// ============================================================================
import type { Session } from "@supabase/supabase-js";
import { supabase, SUPABASE_CONFIGURADO, FN_ADMIN_USERS } from "@/lib/supabase";
import { entrar, sair, obterSessao, type Sessao } from "@/lib/session";
import type { Perfil } from "@/data/types";

export const MODO_JWT: boolean = SUPABASE_CONFIGURADO;

const temWindow = typeof window !== "undefined";
const DOMINIO_SINTETICO = "rh.impresilk.local";

export const normalizarUsuario = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const emailSintetico = (usuario: string) => `${normalizarUsuario(usuario).replace(/\s+/g, ".")}@${DOMINIO_SINTETICO}`;

export class ErroAuth extends Error {
  constructor(public tipo: "indisponivel" | "credencial" | "rede", msg: string) { super(msg); }
}

// Sessão do Supabase cacheada em memória: getSession() é assíncrono, mas várias
// partes do app (status de sync, cabeçalho das chamadas) precisam de uma leitura
// SÍNCRONA do token atual. Mantida em dia pelo listener + getSession inicial.
let sessaoAtual: Session | null = null;
if (temWindow && supabase) {
  supabase.auth.onAuthStateChange((_ev, s) => { sessaoAtual = s; });
  supabase.auth.getSession().then(async ({ data }) => {
    sessaoAtual = data.session ?? null;
    if (!data.session) { sair(); return; } // sem sessão válida → não deixa sessão pendurada

    /* QUEM DIZ O PERFIL É O SERVIDOR, NÃO O NAVEGADOR.
       A sessão do app é um JSON no localStorage: dá para abrir o console,
       trocar "COLABORADOR" por "ADMIN_RH" e recarregar — as telas são guardadas
       no cliente e passariam a aparecer. Os DADOS não vêm (o sync confere o
       perfil no servidor a cada chamada), mas a pessoa vê o que já está no
       aparelho e o menu inteiro, o que é confuso e ruim.
       Então, com sessão de verdade na mão, o perfil é relido de `perfis` e
       sobrescreve o que estiver gravado. */
    try {
      const real = await perfilDoUsuario(data.session.user.id);
      if (!real) { await supabase!.auth.signOut(); sair(); return; }
      const local = obterSessao();
      if (!local || local.perfil !== real.perfil || local.colaboradorId !== real.colaboradorId) {
        entrar(real.perfil, real.colaboradorId, true);
      }
    } catch { /* offline: fica com o que tem, e o sync recusa o que não puder */ }
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
// app e avisa o módulo de sync.
//
// Até 11/08/2026 QUALQUER falha virava ErroAuth("indisponivel") de propósito,
// para o Login.tsx cair no login local: nem todo mundo tinha conta no servidor,
// e travar essa gente seria pior. O preço era que senha errada TAMBÉM caía no
// local — e lá a senha geral do app (escrita no bundle público) abria a porta.
//
// Agora as SEIS pessoas do quadro têm conta de servidor, então senha errada é
// senha errada: lança "credencial" e o login para ali. "indisponivel" fica só
// para o que realmente é indisponibilidade — sem conta no servidor, sem perfil
// vinculado, ou Supabase fora do ar.
export async function loginServidor(nome: string, senha: string, lembrar = false): Promise<Sessao> {
  if (!supabase) throw new ErroAuth("indisponivel", "Login por servidor não configurado.");
  let auth: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;
  try {
    auth = await supabase.auth.signInWithPassword({ email: emailSintetico(nome), password: senha });
  } catch {
    throw new ErroAuth("rede", "Sem conexão para entrar. Tente novamente com internet.");
  }
  if (auth.error) {
    // O GoTrue devolve a MESMA mensagem para senha errada e para conta
    // inexistente ("Invalid login credentials"). Como todo mundo do quadro tem
    // conta, o caso comum é senha errada -- e dizer isso e PARAR e mais seguro
    // do que mandar a pessoa para a porta local.
    const cru = String(auth.error.message || "");
    const ehCredencial = /invalid login credentials|invalid_grant/i.test(cru);
    throw new ErroAuth(
      ehCredencial ? "credencial" : "indisponivel",
      ehCredencial ? "Senha incorreta." : (cru || "Login indisponível no momento."));
  }
  sessaoAtual = auth.data.session;
  const sess = await perfilDoUsuario(auth.data.user!.id);
  if (!sess) {
    await supabase.auth.signOut();
    sessaoAtual = null;
    throw new ErroAuth("indisponivel", "Conta sem perfil vinculado. Fale com o RH.");
  }
  entrar(sess.perfil, sess.colaboradorId, lembrar);
  if (temWindow) window.dispatchEvent(new CustomEvent("impresilk:autenticado"));
  return sess;
}

export function logoutAuth(): void {
  sair();
  void supabase?.auth.signOut();
}

/** Está logado pelo servidor (tem crachá válido)? Só aí dá para trocar a senha lá. */
export function logadoNoServidor(): boolean { return MODO_JWT && !!tokenAtual(); }

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
// de Edge Function.
export async function listarContasServidor(): Promise<ContaServidor[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("perfis").select("usuario, colaborador_id, nome, perfil, atualizado_em");
  if (error) throw new Error(error.message);
  return (data ?? []).map((d) => ({
    usuario: d.usuario, colaboradorId: d.colaborador_id, nome: d.nome ?? undefined, perfil: d.perfil, atualizadoEm: d.atualizado_em,
  }));
}

// ------- cada pessoa troca a PRÓPRIA senha (sem passar pelo RH) -------
// Confere a senha atual re-autenticando (o Supabase não exige a senha antiga
// para updateUser, mas conferir evita que uma sessão esquecida aberta troque a
// senha sem provar identidade) e então atualiza.
export async function trocarMinhaSenha(senhaAtual: string, novaSenha: string, _usuario?: string): Promise<{ ok: true }> {
  if (!supabase) throw new Error("Login por servidor não configurado.");
  const email = sessaoAtual?.user?.email;
  if (!email) throw new Error("Você precisa estar logado para trocar a senha.");
  const check = await supabase.auth.signInWithPassword({ email, password: senhaAtual });
  if (check.error) throw new Error("Senha atual incorreta.");
  sessaoAtual = check.data.session;
  const upd = await supabase.auth.updateUser({ password: novaSenha });
  if (upd.error) throw new Error(upd.error.message || "Não foi possível trocar a senha.");
  return { ok: true };
}
