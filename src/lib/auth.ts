import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "./db";
import { lerSessao, type SessionPayload } from "./session";
import { PERFIS } from "./constants";

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}

// Valida credenciais e retorna o usuário (ou null)
export async function autenticar(email: string, senha: string) {
  const user = await db.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { colaborador: true },
  });
  if (!user || !user.ativo) return null;
  const ok = await verificarSenha(senha, user.senhaHash);
  if (!ok) return null;
  return user;
}

// Retorna a sessão atual ou redireciona para o login
export async function exigirSessao(): Promise<SessionPayload> {
  const sessao = await lerSessao();
  if (!sessao) redirect("/login");
  return sessao;
}

// Garante que o usuário tenha um dos perfis informados
export async function exigirPerfil(
  ...perfis: string[]
): Promise<SessionPayload> {
  const sessao = await exigirSessao();
  if (!perfis.includes(sessao.perfil)) redirect("/dashboard");
  return sessao;
}

export function ehAdmin(perfil: string) {
  return perfil === PERFIS.ADMIN_RH;
}

export function ehGestor(perfil: string) {
  return perfil === PERFIS.GESTOR;
}

export function ehColaborador(perfil: string) {
  return perfil === PERFIS.COLABORADOR;
}
