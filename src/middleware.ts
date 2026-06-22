import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_SESSAO } from "@/lib/constants";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ?? "dev-secret-troque-em-producao",
);

// Rotas públicas (não exigem sessão)
const ROTAS_PUBLICAS = ["/login", "/api/auth/login"];

async function sessaoValida(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE_SESSAO)?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ehPublica = ROTAS_PUBLICAS.some((r) => pathname.startsWith(r));
  const autenticado = await sessaoValida(req);

  // Já logado tentando acessar /login → vai para o dashboard
  if (pathname === "/login" && autenticado) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Raiz → dashboard (se logado) ou login
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(autenticado ? "/dashboard" : "/login", req.url),
    );
  }

  if (!ehPublica && !autenticado) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Protege tudo, exceto assets estáticos e a logo
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo|.*\\.svg).*)"],
};
