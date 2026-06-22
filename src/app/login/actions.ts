"use server";

import { redirect } from "next/navigation";
import { autenticar } from "@/lib/auth";
import { criarSessaoCookie } from "@/lib/session";
import { db } from "@/lib/db";
import { registrarAcesso } from "@/lib/lgpd";

export interface LoginState {
  erro?: string;
}

export async function entrar(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const senha = String(formData.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Informe e-mail e senha." };
  }

  const user = await autenticar(email, senha);
  if (!user) {
    return { erro: "E-mail ou senha inválidos." };
  }

  await db.user.update({
    where: { id: user.id },
    data: { ultimoLogin: new Date() },
  });

  await criarSessaoCookie({
    sub: user.id,
    email: user.email,
    perfil: user.perfil,
    nome: user.colaborador?.nome ?? user.email,
    colaboradorId: user.colaboradorId,
  });

  await registrarAcesso({
    usuarioId: user.id,
    acao: "LOGIN",
    recurso: "Sessão",
    detalhe: `Login realizado (${user.perfil}).`,
  });

  redirect("/dashboard");
}
