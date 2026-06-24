// ============================================================================
// Função única de sincronização (Netlify Functions v2 + Netlify Blobs).
// Recebe POST { action, ...payload } com header x-token == env SYNC_TOKEN.
// Cada registro é 1 blob (chave = "colecao::id") com { colecao, registro }.
// O contrato de ações é estável — o backend pode ser trocado depois.
//
// Por que UMA função só? Cada função conta como uso (créditos). Centralizar
// todas as operações em um único endpoint, com um campo "action", mantém o
// consumo previsível e o contrato simples de versionar.
// ============================================================================
import { getStore } from "@netlify/blobs";
import { verificarJwt } from "../lib/cripto.mts";

const PAGINA = 150; // registros por resposta no list

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

const chave = (colecao: string, id: string) => `${colecao}::${id}`;

// Helper de loja: usa o contexto automático do Netlify (em produção/CI o
// site-id e o token de Blobs já vêm injetados). Se não houver contexto
// automático (ex.: deploy manual ou ambiente atípico), cai para as variáveis
// BLOBS_SITE_ID / BLOBS_TOKEN. Assim a mesma função roda em qualquer cenário.
function loja(nome: string) {
  const siteID = process.env.BLOBS_SITE_ID;
  const token = process.env.BLOBS_TOKEN;
  if (siteID && token) return getStore({ name: nome, siteID, token });
  return getStore(nome); // contexto automático (caso normal no Netlify)
}

export default async (req: Request) => {
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  // Autorização: aceita o crachá do login real (JWT, preferido) e/ou o token
  // embutido (SYNC_TOKEN, modo automático/transição). Basta um válido.
  const secret = process.env.JWT_SECRET;
  const syncToken = process.env.SYNC_TOKEN || process.env.TOKEN;
  if (!secret && !syncToken) return json({ erro: "Sincronização não configurada (defina JWT_SECRET ou SYNC_TOKEN)." }, 500);

  let autorizado = false;
  if (secret) {
    const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (m && (await verificarJwt(m[1], secret))) autorizado = true; // crachá válido
  }
  if (!autorizado && syncToken && req.headers.get("x-token") === syncToken) autorizado = true; // token embutido
  if (!autorizado) return json({ erro: "Não autorizado." }, 401);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");

  const registros = loja("impresilk-registros");
  const configStore = loja("impresilk-config");
  const fotos = loja("impresilk-fotos");

  try {
    switch (action) {
      // ---- saúde ----
      case "ping":
        return json({ ok: true, ts: new Date().toISOString() });

      // ---- listar (paginado) ----
      case "list": {
        const offset = Math.max(0, Number(body.offset ?? 0) | 0);
        const { blobs } = await registros.list();
        const chaves = blobs.map((b) => b.key).sort();
        const pagina = chaves.slice(offset, offset + PAGINA);
        const itens = await Promise.all(
          pagina.map((k) => registros.get(k, { type: "json" }).catch(() => null)),
        );
        const nextOffset = offset + PAGINA < chaves.length ? offset + PAGINA : null;
        return json({ registros: itens.filter(Boolean), nextOffset, total: chaves.length });
      }

      // ---- upsert (1 registro, com detecção de conflito) ----
      case "upsert": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as { id?: string; atualizadoEm?: string } | undefined;
        if (!colecao || !registro?.id) return json({ erro: "colecao e registro.id obrigatórios." }, 400);
        const k = chave(colecao, registro.id);
        const atual = (await registros.get(k, { type: "json" }).catch(() => null)) as
          | { registro?: { atualizadoEm?: string } }
          | null;
        const servidorTs = atual?.registro?.atualizadoEm;
        const enviadoTs = registro.atualizadoEm;
        // Conflito: servidor mais novo que o enviado → não sobrescreve.
        if (servidorTs && enviadoTs && servidorTs > enviadoTs) {
          return json({ conflito: true, servidor: atual });
        }
        await registros.setJSON(k, { colecao, registro });
        return json({ ok: true, atualizadoEm: enviadoTs ?? null });
      }

      // ---- upsert em lote (push autoritativo, sem conflito) ----
      case "bulkUpsert": {
        const lote = (body.registros ?? []) as { colecao: string; registro: { id: string } }[];
        await Promise.all(
          lote
            .filter((x) => x?.colecao && x?.registro?.id)
            .map((x) => registros.setJSON(chave(x.colecao, x.registro.id), { colecao: x.colecao, registro: x.registro })),
        );
        return json({ ok: true, gravados: lote.length });
      }

      // ---- delete ----
      case "delete": {
        const colecao = String(body.colecao ?? "");
        const id = String(body.id ?? "");
        if (!colecao || !id) return json({ erro: "colecao e id obrigatórios." }, 400);
        await registros.delete(chave(colecao, id));
        // limpeza best-effort de foto ligada (mesmo id)
        await fotos.delete(id).catch(() => {});
        return json({ ok: true });
      }

      // ---- limpar coleção inteira (apaga TODOS os registros de uma coleção) ----
      // Usado para "recomeçar do zero" um conjunto de lançamentos (ex.: folha,
      // plano de contas) sem mexer nas demais coleções. Apaga só a coleção pedida.
      case "limparColecao": {
        const colecao = String(body.colecao ?? "");
        if (!colecao) return json({ erro: "colecao obrigatória." }, 400);
        const { blobs } = await registros.list({ prefix: `${colecao}::` });
        await Promise.all(blobs.map((b) => registros.delete(b.key)));
        return json({ ok: true, apagados: blobs.length });
      }

      // ---- config global ----
      case "getCfg":
        return json({ config: (await configStore.get("config", { type: "json" }).catch(() => null)) ?? null });
      case "setCfg":
        await configStore.setJSON("config", { config: body.config, atualizadoEm: new Date().toISOString() });
        return json({ ok: true });

      // ---- fotos / imagens ----
      case "putPhoto": {
        const id = String(body.id ?? "");
        if (!id || !body.dataUrl) return json({ erro: "id e dataUrl obrigatórios." }, 400);
        await fotos.set(id, String(body.dataUrl));
        return json({ ok: true });
      }
      case "getPhoto": {
        const id = String(body.id ?? "");
        const dataUrl = await fotos.get(id, { type: "text" }).catch(() => null);
        return json({ dataUrl: dataUrl ?? null });
      }

      default:
        return json({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
};
