// ============================================================================
// Função de autenticação (login real). Verifica a senha NO SERVIDOR e emite um
// crachá assinado (JWT). A função de dados (sync) só aceita quem tem JWT válido.
//
// Variáveis no Netlify:
//   JWT_SECRET          (obrigatória) segredo para assinar/verificar o crachá.
//   AUTH_MASTER_USUARIO (opcional, padrão "leonardo") usuário do diretor master.
//   AUTH_MASTER_SENHA   (obrigatória p/ o master entrar) senha do master.
//
// Enquanto JWT_SECRET não existir, devolve 501 — e o app cai no login local
// antigo, sem travar ninguém (transição suave).
// ============================================================================
import { getStore } from "@netlify/blobs";
import { assinarJwt, verificarJwt, hashSenha, conferirSenha, normalizarUsuario, type RegistroSenha } from "../lib/cripto.mts";

const MASTER_COLAB_ID = "leonardo-goncalves"; // espelha src/lib/rbac.ts
const EXP_SEG = 60 * 60 * 24 * 30; // crachá válido por 30 dias

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

function loja(nome: string) {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: nome, siteID, token });
  return getStore(nome);
}

interface Conta extends RegistroSenha { usuario: string; colaboradorId: string; nome?: string; perfil: string; atualizadoEm: string }

// Extrai e valida o crachá do header Authorization: Bearer <jwt>.
async function sessaoDoPedido(req: Request, secret: string): Promise<Record<string, any> | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return verificarJwt(m[1], secret);
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const secret = process.env.JWT_SECRET;
  if (!secret) return json({ erro: "Login por servidor não configurado (defina JWT_SECRET)." }, 501);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");
  const contas = loja("impresilk-auth");

  try {
    switch (action) {
      // -------- login: confere a senha e emite o crachá --------
      case "login": {
        const usuario = normalizarUsuario(String(body.usuario ?? ""));
        const senha = String(body.senha ?? "");
        if (!usuario || !senha) return json({ erro: "Informe usuário e senha." }, 400);

        // Master via variável de ambiente (sempre ADMIN_RH; nunca fica em Blob).
        const masterUsuario = normalizarUsuario(process.env.AUTH_MASTER_USUARIO || "leonardo");
        const masterSenha = process.env.AUTH_MASTER_SENHA || "";
        if (usuario === masterUsuario) {
          if (!masterSenha || senha !== masterSenha) return json({ erro: "Senha incorreta." }, 401);
          const token = await assinarJwt({ sub: MASTER_COLAB_ID, perfil: "ADMIN_RH", master: true }, secret, EXP_SEG);
          return json({ token, perfil: "ADMIN_RH", colaboradorId: MASTER_COLAB_ID });
        }

        const conta = (await contas.get(usuario, { type: "json" }).catch(() => null)) as Conta | null;
        if (!conta) return json({ erro: "Usuário não encontrado ou sem senha cadastrada." }, 401);
        if (!(await conferirSenha(senha, conta))) return json({ erro: "Senha incorreta." }, 401);
        const token = await assinarJwt({ sub: conta.colaboradorId, perfil: conta.perfil, nome: conta.nome }, secret, EXP_SEG);
        return json({ token, perfil: conta.perfil, colaboradorId: conta.colaboradorId, nome: conta.nome });
      }

      // -------- definir/atualizar senha (somente ADMIN_RH) --------
      case "definirSenha": {
        const sess = await sessaoDoPedido(req, secret);
        if (sess?.perfil !== "ADMIN_RH") return json({ erro: "Apenas o RH pode definir senhas." }, 403);
        const usuario = normalizarUsuario(String(body.usuario ?? ""));
        const senha = String(body.senha ?? "");
        const colaboradorId = String(body.colaboradorId ?? "");
        const perfil = String(body.perfil ?? "COLABORADOR");
        const nome = body.nome ? String(body.nome) : undefined;
        if (!usuario || !senha || !colaboradorId) return json({ erro: "usuario, colaboradorId e senha são obrigatórios." }, 400);
        const masterUsuario = normalizarUsuario(process.env.AUTH_MASTER_USUARIO || "leonardo");
        if (usuario === masterUsuario) return json({ erro: "O master é definido pela variável AUTH_MASTER_SENHA no Netlify." }, 400);
        if (senha.length < 4) return json({ erro: "Senha muito curta (mínimo 4 caracteres)." }, 400);
        const reg = await hashSenha(senha);
        const conta: Conta = { usuario, colaboradorId, nome, perfil, ...reg, atualizadoEm: new Date().toISOString() };
        await contas.setJSON(usuario, conta);
        return json({ ok: true });
      }

      // -------- remover acesso (somente ADMIN_RH) --------
      case "removerSenha": {
        const sess = await sessaoDoPedido(req, secret);
        if (sess?.perfil !== "ADMIN_RH") return json({ erro: "Apenas o RH pode remover acessos." }, 403);
        const usuario = normalizarUsuario(String(body.usuario ?? ""));
        if (!usuario) return json({ erro: "usuario obrigatório." }, 400);
        await contas.delete(usuario);
        return json({ ok: true });
      }

      // -------- listar contas provisionadas (somente ADMIN_RH; sem segredos) --------
      case "listarContas": {
        const sess = await sessaoDoPedido(req, secret);
        if (sess?.perfil !== "ADMIN_RH") return json({ erro: "Apenas o RH." }, 403);
        const { blobs } = await contas.list();
        const itens = await Promise.all(blobs.map((b) => contas.get(b.key, { type: "json" }).catch(() => null)));
        const contasPublicas = (itens.filter(Boolean) as Conta[]).map((c) => ({ usuario: c.usuario, colaboradorId: c.colaboradorId, nome: c.nome, perfil: c.perfil, atualizadoEm: c.atualizadoEm }));
        return json({ contas: contasPublicas });
      }

      default:
        return json({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
};
