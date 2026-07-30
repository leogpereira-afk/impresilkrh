// ============================================================================
// Provisionamento de contas — Supabase Edge Function (Deno).
// Substitui as ações definirSenha/removerSenha de netlify/functions/auth.mts.
// O login em si NÃO passa mais por aqui: o app chama
// supabase.auth.signInWithPassword() direto (login nativo do Supabase Auth).
// Esta função só existe porque criar/apagar a conta de OUTRA pessoa exige a
// service_role key — algo que nunca pode rodar no navegador.
//
// E-mail sintético: o login continua sendo por NOME (como sempre foi — ver
// src/pages/Login.tsx). O Supabase Auth exige um e-mail único por conta, então
// usamos "<nome-normalizado>@rh.impresilk.local" como identificador interno;
// ninguém precisa ter e-mail de verdade cadastrado.
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DOMINIO_SINTETICO = "rh.impresilk.local";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

export const normalizarUsuario = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const emailSintetico = (usuario: string) => `${usuario.replace(/\s+/g, ".")}@${DOMINIO_SINTETICO}`;

// Só ADMIN_RH chega aqui. Reaproveita a mesma checagem da função "sync": JWT
// válido do Supabase Auth + linha correspondente em "perfis".
async function ehAdminRH(req: Request): Promise<boolean> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  const semRls = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await semRls.auth.getUser(m[1]);
  if (error || !data?.user) return false;
  const { data: perfil } = await admin.from("perfis").select("perfil").eq("user_id", data.user.id).maybeSingle();
  return perfil?.perfil === "ADMIN_RH";
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);
  if (!(await ehAdminRH(req))) return json({ erro: "Apenas o RH pode gerenciar acessos." }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");

  try {
    switch (action) {
      // -------- criar conta / redefinir senha --------
      case "provisionar": {
        const usuario = normalizarUsuario(String(body.usuario ?? ""));
        const senha = String(body.senha ?? "");
        const colaboradorId = String(body.colaboradorId ?? "");
        const perfil = String(body.perfil ?? "COLABORADOR");
        const nome = body.nome ? String(body.nome) : undefined;
        if (!usuario || !senha || !colaboradorId) return json({ erro: "usuario, colaboradorId e senha são obrigatórios." }, 400);
        if (senha.length < 4) return json({ erro: "Senha muito curta (mínimo 4 caracteres)." }, 400);
        if (!["ADMIN_RH", "GESTOR", "COLABORADOR"].includes(perfil)) return json({ erro: "Perfil inválido." }, 400);

        const { data: existente } = await admin.from("perfis").select("user_id").eq("usuario", usuario).maybeSingle();
        const email = emailSintetico(usuario);

        let userId: string;
        if (existente) {
          userId = existente.user_id;
          const { error } = await admin.auth.admin.updateUserById(userId, { password: senha, email, user_metadata: { nome } });
          if (error) throw new Error(error.message);
        } else {
          const { data, error } = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome } });
          if (error) throw new Error(error.message);
          userId = data.user!.id;
        }

        const { error: erroPerfil } = await admin.from("perfis").upsert({
          user_id: userId, usuario, colaborador_id: colaboradorId, nome, perfil, atualizado_em: new Date().toISOString(),
        });
        if (erroPerfil) throw new Error(erroPerfil.message);
        return json({ ok: true });
      }

      // -------- remover acesso (apaga a conta inteira) --------
      case "removerAcesso": {
        const usuario = normalizarUsuario(String(body.usuario ?? ""));
        if (!usuario) return json({ erro: "usuario obrigatório." }, 400);
        const { data: existente } = await admin.from("perfis").select("user_id").eq("usuario", usuario).maybeSingle();
        if (!existente) return json({ ok: true }); // já não existe: idempotente
        const { error } = await admin.auth.admin.deleteUser(existente.user_id); // cascade apaga a linha em "perfis"
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }

      default:
        return json({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
