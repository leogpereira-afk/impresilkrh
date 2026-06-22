import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { COOKIE_SESSAO } from "./constants";

export interface SessionPayload {
  sub: string; // userId
  email: string;
  perfil: string;
  nome: string;
  colaboradorId: string | null;
  [key: string]: unknown;
}

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-troque-em-producao",
);

const DURACAO = 60 * 60 * 8; // 8 horas

export async function assinarSessao(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO}s`)
    .sign(secret);
}

export async function verificarSessao(
  token: string | undefined,
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export async function criarSessaoCookie(payload: SessionPayload) {
  const token = await assinarSessao(payload);
  cookies().set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: DURACAO,
    path: "/",
  });
}

export async function lerSessao(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_SESSAO)?.value;
  return verificarSessao(token);
}

export function destruirSessaoCookie() {
  cookies().delete(COOKIE_SESSAO);
}
