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
  let jwtPayload: Record<string, any> | null = null;
  if (secret) {
    const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
    if (m) { jwtPayload = await verificarJwt(m[1], secret); if (jwtPayload) autorizado = true; } // crachá válido
  }
  if (!autorizado && syncToken && req.headers.get("x-token") === syncToken) autorizado = true; // token embutido
  if (!autorizado) return json({ erro: "Não autorizado." }, 401);

  // Escopo LGPD: quem entra com crachá (JWT) e NÃO é ADMIN_RH não recebe dados
  // sensíveis de terceiros (salário, CPF, dados familiares) nem a folha alheia.
  // Acesso por token compartilhado (x-token) ou ADMIN_RH segue com tudo — o
  // comportamento atual fica inalterado.
  const ehAdmin = !jwtPayload || jwtPayload.perfil === "ADMIN_RH";
  const meuId = jwtPayload?.sub ? String(jwtPayload.sub) : null;
  const CAMPOS_SENSIVEIS = ["cpf", "salario", "adicionais", "refMin", "refMax", "telefone", "matriculaEsocial", "enderecoRua", "enderecoNumero", "enderecoComplemento", "enderecoBairro", "enderecoCep", "conjugeNome", "conjugeTelefone", "filhos", "contatoEmergencia"];
  const mascarar = (env: any) => {
    if (env?.registro?._apagado) return env; // lápide (exclusão): sem dado sensível, propaga p/ todos
    if (ehAdmin || !env?.registro) return env;
    if (env.colecao === "colaboradores" && env.registro.id !== meuId) {
      const r = { ...env.registro };
      for (const k of CAMPOS_SENSIVEIS) delete r[k];
      return { ...env, registro: r };
    }
    if (env.colecao === "pagamentos" && env.registro.colaboradorId !== meuId) return null; // folha alheia
    return env;
  };

  // Escopo de ESCRITA (espelha o de leitura). Acesso por token compartilhado
  // (x-token) ou ADMIN_RH escreve tudo — comportamento atual inalterado. Um
  // crachá (JWT) que NÃO é ADMIN_RH só pode mexer na PRÓPRIA ficha e na PRÓPRIA
  // folha; operações em massa/destrutivas (bulkUpsert, limparColecao) são só de
  // admin. Defesa no servidor: o cliente nunca é a única barreira.
  const podeEscrever = (colecao: string, reg: any): boolean => {
    if (ehAdmin) return true;
    if (colecao === "colaboradores") return reg?.id === meuId; // só a própria ficha
    if (colecao === "pagamentos") return reg?.colaboradorId === meuId; // só a própria folha
    return true; // demais coleções operacionais
  };

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
        const visiveis = itens.filter(Boolean).map(mascarar).filter(Boolean); // aplica escopo LGPD
        const nextOffset = offset + PAGINA < chaves.length ? offset + PAGINA : null;
        return json({ registros: visiveis, nextOffset, total: chaves.length });
      }

      // ---- upsert (1 registro, com detecção de conflito) ----
      case "upsert": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as { id?: string; atualizadoEm?: string } | undefined;
        if (!colecao || !registro?.id) return json({ erro: "colecao e registro.id obrigatórios." }, 400);
        if (!podeEscrever(colecao, registro)) return json({ erro: "Sem permissão para gravar este registro." }, 403);
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
        if (!ehAdmin) return json({ erro: "Operação em massa restrita ao RH." }, 403); // só admin/token
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
        // Escopo de escrita: não-admin (JWT) só apaga a própria ficha; folha alheia
        // e exclusões fora do próprio escopo ficam bloqueadas.
        if (!ehAdmin) {
          if (colecao === "colaboradores" && id !== meuId) return json({ erro: "Sem permissão." }, 403);
          if (colecao === "pagamentos") return json({ erro: "Sem permissão." }, 403);
        }
        // LÁPIDE (tombstone): em vez de remover o blob, grava um marcador apagado com
        // carimbo de tempo. Assim o pull em OUTROS computadores enxerga a exclusão e
        // remove o registro local. Sem isso, o pull preservava o local órfão e o dado
        // "ressuscitava" no próximo ciclo. Uma edição posterior (atualizadoEm > lápide)
        // ainda vence — exclusão e edição concorrentes resolvem por timestamp.
        await registros.setJSON(chave(colecao, id), { colecao, registro: { id, _apagado: true, atualizadoEm: new Date().toISOString() } });
        // limpeza best-effort de foto ligada (mesmo id)
        await fotos.delete(id).catch(() => {});
        return json({ ok: true });
      }

      // ---- limpar coleção inteira (apaga TODOS os registros de uma coleção) ----
      // Usado para "recomeçar do zero" um conjunto de lançamentos (ex.: folha,
      // plano de contas) sem mexer nas demais coleções. Apaga só a coleção pedida.
      case "limparColecao": {
        if (!ehAdmin) return json({ erro: "Limpar coleção é restrito ao RH." }, 403); // destrutivo: só admin/token
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
        if (!ehAdmin) return json({ erro: "Configuração global é restrita ao RH." }, 403);
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
