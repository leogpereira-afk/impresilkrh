// ============================================================================
// Função única de sincronização — Supabase Edge Function (Deno).
// Substitui netlify/functions/sync.mts: MESMO contrato de ações (o cliente em
// src/lib/sync.ts não muda), agora sobre Postgres (tabela "registros") e
// Storage (bucket "arquivos") em vez de Netlify Blobs.
//
// Autorização: SEMPRE um usuário autenticado do Supabase Auth (Authorization:
// Bearer <access_token>). Não existe mais o "token compartilhado" (SYNC_TOKEN)
// — cada chamada é de uma pessoa logada de verdade, e o perfil dela (ADMIN_RH/
// GESTOR/COLABORADOR) vem da tabela "perfis".
// ============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { json, preflight } from "../_shared/cors.ts";

const PAGINA = 150;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cliente "de serviço": ignora RLS, é o único que toca em registros/config/meta/storage.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const chave = (colecao: string, id: string) => `${colecao}::${id}`;
const CAMPOS_SENSIVEIS = ["cpf", "salario", "adicionais", "refMin", "refMax", "telefone", "matriculaEsocial", "enderecoRua", "enderecoNumero", "enderecoComplemento", "enderecoBairro", "enderecoCep", "conjugeNome", "conjugeTelefone", "filhos", "contatoEmergencia"];

interface Perfil { colaborador_id: string; perfil: "ADMIN_RH" | "GESTOR" | "COLABORADOR" }

// Identifica quem está chamando: valida o JWT do usuário (cliente com anon key,
// só para VERIFICAR o token) e busca o perfil dele (cliente de serviço, sem RLS).
async function sessaoDoPedido(req: Request): Promise<Perfil | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const semRls = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: auth } } });
  const { data, error } = await semRls.auth.getUser(m[1]);
  if (error || !data?.user) return null;
  const { data: perfil } = await admin.from("perfis").select("colaborador_id, perfil").eq("user_id", data.user.id).maybeSingle();
  if (!perfil) return null;
  return perfil as Perfil;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const sessao = await sessaoDoPedido(req);
  if (!sessao) return json({ erro: "Não autorizado." }, 401);

  const ehAdmin = sessao.perfil === "ADMIN_RH";
  const meuId = sessao.colaborador_id;

  // Escopo LGPD de leitura: mesma regra de sempre — RH vê tudo; os demais não
  // veem dado sensível de terceiros nem a folha alheia.
  const mascarar = (env: { colecao: string; registro: any } | null) => {
    if (!env) return null;
    if (env.registro?._apagado) return env; // lápide propaga p/ todos
    if (ehAdmin) return env;
    if (env.colecao === "colaboradores" && env.registro.id !== meuId) {
      const r = { ...env.registro };
      for (const k of CAMPOS_SENSIVEIS) delete r[k];
      return { ...env, registro: r };
    }
    if (env.colecao === "pagamentos" && env.registro.colaboradorId !== meuId) return null;
    return env;
  };
  // Escopo de escrita: espelha o de leitura.
  const podeEscrever = (colecao: string, reg: any): boolean => {
    if (ehAdmin) return true;
    if (colecao === "colaboradores") return reg?.id === meuId;
    if (colecao === "pagamentos") return reg?.colaboradorId === meuId;
    return true;
  };

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");

  const marcarMudanca = () => admin.from("meta").upsert({ chave: "rev", valor: { rev: Date.now() } }).then(() => {}, () => {});

  try {
    switch (action) {
      case "ping":
        return json({ ok: true, ts: new Date().toISOString() });

      case "rev": {
        const { data } = await admin.from("meta").select("valor").eq("chave", "rev").maybeSingle();
        return json({ rev: (data?.valor as { rev?: number } | undefined)?.rev ?? null });
      }

      // ---- listar (paginado, keyset por chave "colecao::id") ----
      case "list": {
        const after = body.after != null ? String(body.after) : null;
        const offset = Math.max(0, Number(body.offset ?? 0) | 0);
        let query = admin.from("registros").select("colecao, id, registro").order("colecao", { ascending: true }).order("id", { ascending: true }).limit(PAGINA);
        if (after !== null) {
          const [c, ...resto] = after.split("::");
          const i = resto.join("::");
          // (colecao, id) > (after_colecao, after_id) — ordem lexicográfica composta.
          query = query.or(`colecao.gt.${c},and(colecao.eq.${c},id.gt.${i})`);
        } else if (offset > 0) {
          query = query.range(offset, offset + PAGINA - 1);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        const linhas = data ?? [];
        const visiveis = linhas.map((l) => mascarar({ colecao: l.colecao, registro: l.registro })).filter(Boolean);
        const temMais = linhas.length === PAGINA;
        const ultima = linhas[linhas.length - 1];
        const nextAfter = temMais && ultima ? chave(ultima.colecao, ultima.id) : null;
        const nextOffset = temMais ? offset + PAGINA : null;
        const { count } = await admin.from("registros").select("*", { count: "exact", head: true });
        return json({ registros: visiveis, nextAfter, nextOffset, total: count ?? linhas.length });
      }

      // ---- upsert (1 registro, com detecção de conflito) ----
      case "upsert": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as { id?: string; atualizadoEm?: string } | undefined;
        if (!colecao || !registro?.id) return json({ erro: "colecao e registro.id obrigatórios." }, 400);
        if (!podeEscrever(colecao, registro)) return json({ erro: "Sem permissão para gravar este registro." }, 403);
        const { data: atual } = await admin.from("registros").select("registro").eq("colecao", colecao).eq("id", registro.id).maybeSingle();
        const servidorTs = (atual?.registro as { atualizadoEm?: string } | undefined)?.atualizadoEm;
        const enviadoTs = registro.atualizadoEm;
        if (servidorTs && enviadoTs && servidorTs > enviadoTs) {
          return json({ conflito: true, servidor: { colecao, registro: atual!.registro } });
        }
        const { error } = await admin.from("registros").upsert({ colecao, id: registro.id, registro, atualizado_em: enviadoTs ? new Date(enviadoTs).toISOString() : new Date().toISOString() });
        if (error) throw new Error(error.message);
        await marcarMudanca();
        return json({ ok: true, atualizadoEm: enviadoTs ?? null });
      }

      // ---- upsert em lote (push autoritativo, sem conflito) ----
      case "bulkUpsert": {
        if (!ehAdmin) return json({ erro: "Operação em massa restrita ao RH." }, 403);
        const lote = (body.registros ?? []) as { colecao: string; registro: { id: string; atualizadoEm?: string } }[];
        const linhas = lote.filter((x) => x?.colecao && x?.registro?.id).map((x) => ({
          colecao: x.colecao, id: x.registro.id, registro: x.registro,
          atualizado_em: x.registro.atualizadoEm ? new Date(x.registro.atualizadoEm).toISOString() : new Date().toISOString(),
        }));
        if (linhas.length) { const { error } = await admin.from("registros").upsert(linhas); if (error) throw new Error(error.message); }
        await marcarMudanca();
        return json({ ok: true, gravados: linhas.length });
      }

      // ---- delete (lápide, igual ao Blobs: nunca remove a linha) ----
      case "delete": {
        const colecao = String(body.colecao ?? "");
        const id = String(body.id ?? "");
        if (!colecao || !id) return json({ erro: "colecao e id obrigatórios." }, 400);
        if (!ehAdmin) {
          if (colecao === "colaboradores" && id !== meuId) return json({ erro: "Sem permissão." }, 403);
          if (colecao === "pagamentos") return json({ erro: "Sem permissão." }, 403);
        }
        const agora = new Date().toISOString();
        const { error } = await admin.from("registros").upsert({ colecao, id, registro: { id, _apagado: true, atualizadoEm: agora }, atualizado_em: agora, apagado: true });
        if (error) throw new Error(error.message);
        await Promise.all([id, `doc:${id}`, `cv:${id}`].map((k) => admin.storage.from("arquivos").remove([k])));
        await marcarMudanca();
        return json({ ok: true });
      }

      // ---- limpar coleção inteira ----
      case "limparColecao": {
        if (!ehAdmin) return json({ erro: "Limpar coleção é restrito ao RH." }, 403);
        const colecao = String(body.colecao ?? "");
        if (!colecao) return json({ erro: "colecao obrigatória." }, 400);
        const { error, count } = await admin.from("registros").delete({ count: "exact" }).eq("colecao", colecao);
        if (error) throw new Error(error.message);
        await marcarMudanca();
        return json({ ok: true, apagados: count ?? 0 });
      }

      // ---- config global ----
      case "getCfg": {
        const { data } = await admin.from("config_global").select("config").eq("id", true).maybeSingle();
        return json({ config: data ? { config: data.config } : null });
      }
      case "setCfg": {
        if (!ehAdmin) return json({ erro: "Configuração global é restrita ao RH." }, 403);
        const { error } = await admin.from("config_global").upsert({ id: true, config: body.config, atualizado_em: new Date().toISOString() });
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }

      // ---- fotos / anexos (bucket "arquivos", conteúdo = data URL cru, igual ao Blobs) ----
      case "putPhoto": {
        const id = String(body.id ?? "");
        if (!id || !body.dataUrl) return json({ erro: "id e dataUrl obrigatórios." }, 400);
        const { error } = await admin.storage.from("arquivos").upload(id, new Blob([String(body.dataUrl)], { type: "text/plain" }), { upsert: true });
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "getPhoto": {
        const id = String(body.id ?? "");
        const { data, error } = await admin.storage.from("arquivos").download(id);
        if (error || !data) return json({ dataUrl: null });
        return json({ dataUrl: await data.text() });
      }

      default:
        return json({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
