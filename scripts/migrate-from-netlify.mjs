#!/usr/bin/env node
// ============================================================================
// Migração ÚNICA: lê todos os registros do site atual (Netlify + Blobs) e grava
// na tabela "registros" do Supabase. Também lista as contas de login atuais
// (usuário/colaborador/perfil) para você recriar no novo sistema — a SENHA em
// si não é migrável (o Supabase guarda o hash de um jeito diferente do app
// antigo), então cada pessoa recebe uma senha nova via Painel de Controle ›
// Usuários (ou "Migrar senhas", se já houver senha cadastrada no cadastro).
//
// Uso:
//   node scripts/migrate-from-netlify.mjs
//
// Variáveis de ambiente (todas obrigatórias):
//   NETLIFY_SITE_URL              ex.: https://impresilkrh.netlify.app
//   NETLIFY_ADMIN_USUARIO         nome do master (ex.: "leonardo goncalves")
//   NETLIFY_ADMIN_SENHA           senha do master no site atual
//   SUPABASE_URL                  Project URL do Supabase
//   SUPABASE_SERVICE_ROLE_KEY     service_role key (Settings › API) — NUNCA
//                                 exponha esta chave fora deste script local.
// ============================================================================

const env = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Falta a variável de ambiente ${k}.`); process.exit(1); }
  return v;
};

const NETLIFY_SITE_URL = env("NETLIFY_SITE_URL").replace(/\/+$/, "");
const NETLIFY_ADMIN_USUARIO = env("NETLIFY_ADMIN_USUARIO");
const NETLIFY_ADMIN_SENHA = env("NETLIFY_ADMIN_SENHA");
const SUPABASE_URL = env("SUPABASE_URL").replace(/\/+$/, "");
const SERVICE_ROLE = env("SUPABASE_SERVICE_ROLE_KEY");

async function chamarNetlify(fn, action, payload, token) {
  const res = await fetch(`${NETLIFY_SITE_URL}/.netlify/functions/${fn}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${fn}/${action}: HTTP ${res.status} — ${data?.erro ?? res.statusText}`);
  return data;
}

async function main() {
  console.log(`→ Login como master em ${NETLIFY_SITE_URL} …`);
  const login = await chamarNetlify("auth", "login", { usuario: NETLIFY_ADMIN_USUARIO, senha: NETLIFY_ADMIN_SENHA });
  const token = login.token;
  console.log(`  ok — perfil ${login.perfil}`);

  console.log("→ Baixando todos os registros (paginado)…");
  const registros = [];
  let after = null;
  for (let pagina = 0; pagina < 2000; pagina++) {
    const resp = await chamarNetlify("sync", "list", after != null ? { after } : {}, token);
    for (const env of resp.registros ?? []) if (env?.registro?.id) registros.push(env);
    if (resp.nextAfter == null) break;
    after = resp.nextAfter;
  }
  console.log(`  ${registros.length} registro(s) baixados (${resp_total(registros)} coleções).`);

  console.log("→ Baixando config global…");
  const cfg = await chamarNetlify("sync", "getCfg", {}, token);

  console.log("→ Gravando no Supabase (tabela \"registros\")…");
  const LOTE = 500;
  for (let i = 0; i < registros.length; i += LOTE) {
    const lote = registros.slice(i, i + LOTE).map((e) => ({
      colecao: e.colecao,
      id: e.registro.id,
      registro: e.registro,
      atualizado_em: e.registro.atualizadoEm ? new Date(e.registro.atualizadoEm).toISOString() : new Date().toISOString(),
      apagado: !!e.registro._apagado,
    }));
    const res = await fetch(`${SUPABASE_URL}/rest/v1/registros?on_conflict=colecao,id`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        apikey: SERVICE_ROLE,
        authorization: `Bearer ${SERVICE_ROLE}`,
        prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(lote),
    });
    if (!res.ok) throw new Error(`Supabase upsert falhou: HTTP ${res.status} — ${await res.text()}`);
    console.log(`  ${Math.min(i + LOTE, registros.length)}/${registros.length}`);
  }

  if (cfg?.config) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/config_global?on_conflict=id`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: SERVICE_ROLE, authorization: `Bearer ${SERVICE_ROLE}`, prefer: "resolution=merge-duplicates" },
      body: JSON.stringify([{ id: true, config: cfg.config?.config ?? cfg.config, atualizado_em: new Date().toISOString() }]),
    });
    if (!res.ok) throw new Error(`Supabase config falhou: HTTP ${res.status} — ${await res.text()}`);
    console.log("  config global gravada.");
  }

  console.log("\n→ Contas de login atuais (para recriar no Supabase — senha é sempre NOVA):");
  try {
    const contas = await chamarNetlify("auth", "listarContas", {}, token);
    for (const c of contas.contas ?? []) console.log(`  - ${c.nome ?? c.usuario} · colaboradorId=${c.colaboradorId} · perfil=${c.perfil}`);
    console.log(`\nTotal: ${(contas.contas ?? []).length} conta(s). Recrie cada uma em Painel de Controle › Usuários (defina a senha) depois do deploy no novo site.`);
  } catch (e) {
    console.log(`  (não consegui listar: ${e.message})`);
  }

  console.log("\nMigração concluída.");
}

function resp_total(registros) { return new Set(registros.map((r) => r.colecao)).size; }

main().catch((e) => { console.error("Falhou:", e.message); process.exit(1); });
