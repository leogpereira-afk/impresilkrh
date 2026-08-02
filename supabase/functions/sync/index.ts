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
  const { data, error } = await admin.auth.getUser(m[1]); // valida o JWT do usuário
  if (error || !data?.user) return null;
  const { data: perfil } = await admin.from("perfis").select("colaborador_id, perfil").eq("user_id", data.user.id).maybeSingle();
  if (!perfil) return null;
  return perfil as Perfil;
}

// Contador de versão dos dados: um número global (rev) + um mapa por coleção
// (porColecao). O cliente consulta e baixa SÓ as coleções cujo número mudou —
// em vez de rebaixar tudo a cada ciclo. Best-effort (read-modify-write): se
// duas escritas correrem juntas, o pior caso é um pull completo a mais.
async function marcarMudanca(colecoes: string | string[]): Promise<void> {
  const lista = (Array.isArray(colecoes) ? colecoes : [colecoes]).filter(Boolean);
  const agora = Date.now();
  try {
    const { data } = await admin.from("meta").select("valor").eq("chave", "rev").maybeSingle();
    const atual = (data?.valor as { rev?: number; porColecao?: Record<string, number> } | undefined) ?? {};
    const porColecao = { ...(atual.porColecao ?? {}) };
    for (const c of lista) porColecao[c] = agora;
    await admin.from("meta").upsert({ chave: "rev", valor: { rev: agora, porColecao } });
  } catch { /* best-effort: rev é só uma dica de cache */ }
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
    // Histórico de alterações: SÓ o RH baixa.
    //
    // Sem esta linha o histórico vira a porta dos fundos da folha: ele diz
    // "Fulano alterou o Colaborador X", cita cargo, status e admissão, e chega
    // ao disco de qualquer pessoa logada pelo pull — contornando o mascaramento
    // que existe logo acima para `colaboradores` e `pagamentos`. Descoberto na
    // revisão de 02/08/2026, antes de ir para produção.
    if (env.colecao === "alteracoes") return null;
    return env;
  };
  // Escopo de escrita: espelha o de leitura.
  const podeEscrever = (colecao: string, reg: any): boolean => {
    if (ehAdmin) return true;
    if (colecao === "colaboradores") return reg?.id === meuId;
    if (colecao === "pagamentos") return reg?.colaboradorId === meuId;
    // Todo mundo ESCREVE no histórico (é o registro do que a pessoa fez), mas
    // só em nome de si mesmo — senão dá para forjar linha com o nome de outro.
    if (colecao === "alteracoes") return reg?.usuarioColaboradorId === meuId;
    return true;
  };

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");

  try {
    switch (action) {
      case "ping":
        return json({ ok: true, ts: new Date().toISOString() });

      // ---- versão dos dados (global + por coleção) ----
      case "rev": {
        const { data } = await admin.from("meta").select("valor").eq("chave", "rev").maybeSingle();
        const v = (data?.valor as { rev?: number; porColecao?: Record<string, number> } | undefined) ?? {};
        return json({ rev: v.rev ?? null, porColecao: v.porColecao ?? {} });
      }

      // ---- listar (paginado, keyset por chave "colecao::id"; filtro por coleção) ----
      case "list": {
        const after = body.after != null ? String(body.after) : null;
        const offset = Math.max(0, Number(body.offset ?? 0) | 0);
        const colecoes = Array.isArray(body.colecoes) ? (body.colecoes as unknown[]).map(String).filter(Boolean) : null;
        let query = admin.from("registros").select("colecao, id, registro").order("colecao", { ascending: true }).order("id", { ascending: true }).limit(PAGINA);
        if (colecoes && colecoes.length) query = query.in("colecao", colecoes);
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
        let contagem = admin.from("registros").select("*", { count: "exact", head: true });
        if (colecoes && colecoes.length) contagem = contagem.in("colecao", colecoes);
        const { count } = await contagem;
        return json({ registros: visiveis, nextAfter, nextOffset, total: count ?? linhas.length });
      }

      // ---- upsert (1 registro, com detecção de conflito) ----
      case "upsert": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as { id?: string; atualizadoEm?: string; _apagado?: boolean } | undefined;
        if (!colecao || !registro?.id) return json({ erro: "colecao e registro.id obrigatórios." }, 400);
        if (!podeEscrever(colecao, registro)) return json({ erro: "Sem permissão para gravar este registro." }, 403);
        const { data: atual } = await admin.from("registros").select("registro").eq("colecao", colecao).eq("id", registro.id).maybeSingle();
        const servidorTs = (atual?.registro as { atualizadoEm?: string } | undefined)?.atualizadoEm;
        const enviadoTs = registro.atualizadoEm;
        if (servidorTs && enviadoTs && servidorTs > enviadoTs) {
          return json({ conflito: true, servidor: { colecao, registro: atual!.registro } });
        }
        // apagado reflete o registro: um upsert normal "ressuscita" (apagado=false),
        // senão uma edição depois de uma exclusão ficaria presa como lápide.
        const { error } = await admin.from("registros").upsert({ colecao, id: registro.id, registro, apagado: !!registro._apagado, atualizado_em: enviadoTs ? new Date(enviadoTs).toISOString() : new Date().toISOString() });
        if (error) throw new Error(error.message);
        await marcarMudanca(colecao);
        return json({ ok: true, atualizadoEm: enviadoTs ?? null });
      }

      // ---- upsert em lote (push autoritativo, sem conflito) ----
      case "bulkUpsert": {
        if (!ehAdmin) return json({ erro: "Operação em massa restrita ao RH." }, 403);
        const lote = (body.registros ?? []) as { colecao: string; registro: { id: string; atualizadoEm?: string; _apagado?: boolean } }[];
        const linhas = lote.filter((x) => x?.colecao && x?.registro?.id).map((x) => ({
          colecao: x.colecao, id: x.registro.id, registro: x.registro, apagado: !!x.registro._apagado,
          atualizado_em: x.registro.atualizadoEm ? new Date(x.registro.atualizadoEm).toISOString() : new Date().toISOString(),
        }));
        if (linhas.length) { const { error } = await admin.from("registros").upsert(linhas); if (error) throw new Error(error.message); }
        await marcarMudanca([...new Set(linhas.map((l) => l.colecao))]);
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
          // Trilha de auditoria não se apaga: quem pode apagar o próprio rastro
          // não deixa rastro. Só o RH poda o histórico.
          if (colecao === "alteracoes" || colecao === "acessos") return json({ erro: "Sem permissão." }, 403);
        }
        const agora = new Date().toISOString();
        const { error } = await admin.from("registros").upsert({ colecao, id, registro: { id, _apagado: true, atualizadoEm: agora }, apagado: true, atualizado_em: agora });
        if (error) throw new Error(error.message);
        await Promise.all([id, `doc:${id}`, `cv:${id}`].map((k) => admin.storage.from("arquivos").remove([k])));
        await marcarMudanca(colecao);
        return json({ ok: true });
      }

      // ---- limpar coleção inteira ----
      case "limparColecao": {
        if (!ehAdmin) return json({ erro: "Limpar coleção é restrito ao RH." }, 403);
        const colecao = String(body.colecao ?? "");
        if (!colecao) return json({ erro: "colecao obrigatória." }, 400);
        const { error, count } = await admin.from("registros").delete({ count: "exact" }).eq("colecao", colecao);
        if (error) throw new Error(error.message);
        await marcarMudanca(colecao);
        return json({ ok: true, apagados: count ?? 0 });
      }

      // ---- resumo: contagem de registros ATIVOS por coleção (prévia do "oficial") ----
      case "resumo": {
        if (!ehAdmin) return json({ erro: "Resumo restrito ao RH." }, 403);
        const { data, error } = await admin.from("registros").select("colecao").eq("apagado", false);
        if (error) throw new Error(error.message);
        const contagem: Record<string, number> = {};
        for (const r of data ?? []) contagem[r.colecao] = (contagem[r.colecao] ?? 0) + 1;
        return json({ contagem });
      }

      // ---- faxina de lápides antigas (marcadores de exclusão já vistos por todos) ----
      case "limparLapides": {
        if (!ehAdmin) return json({ erro: "Faxina restrita ao RH." }, 403);
        const dias = Math.max(0, Number(body.dias ?? 180) | 0);
        const simular = !!body.simular;
        const corte = new Date(Date.now() - dias * 86_400_000).toISOString();
        if (simular) {
          const { count } = await admin.from("registros").select("*", { count: "exact", head: true }).eq("apagado", true).lt("atualizado_em", corte);
          return json({ encontradas: count ?? 0 });
        }
        const { error, count } = await admin.from("registros").delete({ count: "exact" }).eq("apagado", true).lt("atualizado_em", corte);
        if (error) throw new Error(error.message);
        return json({ removidas: count ?? 0 }); // não mexe no rev: remover lápide é invisível para os clientes
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
