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

// Helper de loja: SEMPRE o contexto automático do Netlify (o runtime injeta o
// site-id e o token de Blobs). NÃO usar BLOBS_TOKEN/BLOBS_SITE_ID manual — um
// personal access token expira em ~7 dias e derruba o sync silenciosamente (foi
// exatamente o que aconteceu no PCP). Se um dia precisar rodar fora do Netlify,
// use `netlify blobs` local ou injete o contexto pelo próprio runtime.
function loja(nome: string, forte = false) {
  // consistency "strong": leitura sempre enxerga a última escrita. Usado só no
  // contador de versão (1 chave, lida a cada ciclo) — sem isso, a sobrescrita
  // da mesma chave pode demorar até ~1 min para aparecer e o app pularia pulls.
  const opts = forte ? ({ consistency: "strong" } as const) : {};
  return getStore({ name: nome, ...opts });
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
  // (x-token) ou ADMIN_RH escreve tudo — comportamento atual inalterado.
  // Para um crachá (JWT) que NÃO é ADMIN_RH a regra é LISTA DE PERMISSÃO (antes
  // era liberar por padrão, o que deixava um não-admin salvar o PRÓPRIO usuário
  // com perfil ADMIN_RH e virar administrador).
  const perfil = jwtPayload?.perfil ? String(jwtPayload.perfil) : null;
  // Credenciais e consentimento: só o RH mexe, em qualquer hipótese.
  const SO_ADMIN = new Set(["usuarios", "consentimentos"]);
  // Coleções que o próprio colaborador escreve — sempre limitado ao seu id.
  const DO_PROPRIO: Record<string, (r: any) => boolean> = {
    colaboradores: (r) => r?.id === meuId,
    pagamentos: (r) => r?.colaboradorId === meuId,
    candidatos: (r) => r?.colaboradorId === meuId, // candidatura no Mural de Vagas
    aceites: (r) => r?.colaboradorId === meuId,
    respostasPesquisa: (r) => r?.colaboradorId === meuId || r?.colaboradorId == null, // anônima
  };
  const podeEscrever = (colecao: string, reg: any): boolean => {
    if (ehAdmin) return true;
    if (SO_ADMIN.has(colecao)) return false;
    const regra = DO_PROPRIO[colecao];
    if (regra) return regra(reg);
    // Demais coleções operacionais: gestor sim, colaborador comum não.
    return perfil === "GESTOR";
  };

  // Arquivos (fotos, anexos "doc:", currículos "cv:") — quem não é admin só
  // acessa o que é seu. Antes putPhoto/getPhoto não checavam NADA: bastava
  // saber o id para ler ou sobrescrever o atestado de qualquer pessoa.
  const idArquivoValido = (id: string) => !!id && !id.includes("/") && !id.includes("..");
  const podeArquivo = async (id: string): Promise<boolean> => {
    if (ehAdmin) return true;
    if (!meuId) return false;
    if (id === meuId) return true; // a própria foto
    const m = /^(doc|cv):(.+)$/.exec(id);
    if (!m) return false;
    const col = m[1] === "doc" ? "documentos" : "candidatos";
    const env = (await registros.get(chave(col, m[2]), { type: "json" }).catch(() => null)) as any;
    return env?.registro?.colaboradorId === meuId;
  };

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  const action = String(body.action ?? "");

  const registros = loja("impresilk-registros");
  const configStore = loja("impresilk-config");
  const fotos = loja("impresilk-fotos");
  const meta = loja("impresilk-meta", true);

  // Contador de versão dos dados: muda a cada escrita. O app consulta só este
  // número (1 leitura) e pula o download completo quando nada mudou — em vez de
  // baixar todos os registros a cada ciclo. Best-effort: se falhar, o pior caso
  // é o app baixar tudo como antes.
  const marcarMudanca = () => meta.setJSON("rev", { rev: Date.now() }).catch(() => {});

  try {
    switch (action) {
      // ---- saúde ----
      case "ping":
        return json({ ok: true, ts: new Date().toISOString() });

      // ---- versão dos dados (pull econômico) ----
      case "rev":
        return json({ rev: ((await meta.get("rev", { type: "json" }).catch(() => null)) as { rev?: number } | null)?.rev ?? null });

      // ---- quantos itens existem por coleção (sem baixar nada) ----
      // Serve para o app avisar o que SUMIRIA da nuvem antes de sobrescrevê-la
      // com o conteúdo de um computador ("tornar oficial"). Conta chaves, então
      // inclui as lápides de exclusão — bom o bastante para o aviso.
      case "resumo": {
        const { blobs } = await registros.list();
        const contagem: Record<string, number> = {};
        for (const b of blobs) {
          const col = b.key.split("::")[0];
          if (col) contagem[col] = (contagem[col] ?? 0) + 1;
        }
        return json({ contagem, total: blobs.length });
      }

      // ---- listar (paginado) ----
      // Paginação por CHAVE (keyset): o cliente manda a última chave vista em
      // `after` e recebe a próxima página + `nextAfter`. Assim uma inserção entre
      // páginas nunca "pula" um registro (o que aconteceria com offset). Mantém
      // `offset`/`nextOffset` como fallback para clientes em cache antigo.
      case "list": {
        const { blobs } = await registros.list();
        // Filtro por coleção (as chaves são "colecao::id", então basta o prefixo).
        // Usado pelo app para baixar SÓ o necessário — por exemplo, antes do login
        // ele pede apenas `usuarios`, em vez de puxar a base inteira.
        const filtro = Array.isArray(body.colecoes)
          ? (body.colecoes as unknown[]).map(String)
          : body.colecao != null ? [String(body.colecao)] : null;
        const prefixos = filtro?.map((c) => `${c}::`) ?? null;
        const chaves = blobs
          .map((b) => b.key)
          .filter((k) => !prefixos || prefixos.some((p) => k.startsWith(p)))
          .sort();
        const after = body.after != null ? String(body.after) : null;
        // início da página: por chave (primeira > after) ou por offset (compat).
        let inicio: number;
        if (after !== null) {
          inicio = chaves.findIndex((k) => k > after);
          if (inicio < 0) inicio = chaves.length; // acabou
        } else {
          inicio = Math.max(0, Number(body.offset ?? 0) | 0);
        }
        const pagina = chaves.slice(inicio, inicio + PAGINA); // chaves cruas desta página
        const itens = await Promise.all(
          pagina.map((k) => registros.get(k, { type: "json" }).catch(() => null)),
        );
        const visiveis = itens.filter(Boolean).map(mascarar).filter(Boolean); // aplica escopo LGPD
        const temMais = inicio + PAGINA < chaves.length;
        // nextAfter = ÚLTIMA CHAVE CRUA da página (não a última visível), senão o
        // mascaramento LGPD poderia encurtar e repetir/pular registros.
        const nextAfter = temMais && pagina.length ? pagina[pagina.length - 1] : null;
        const nextOffset = temMais ? inicio + PAGINA : null;
        return json({ registros: visiveis, nextAfter, nextOffset, total: chaves.length });
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
        // Trilha LGPD é APPEND-ONLY para quem não é RH: pode registrar um acesso
        // novo, nunca reescrever um já gravado (senão dá para apagar o próprio rastro).
        if (!ehAdmin && colecao === "acessos" && atual) {
          return json({ erro: "A trilha de acessos não pode ser alterada." }, 403);
        }
        const servidorTs = atual?.registro?.atualizadoEm;
        const enviadoTs = registro.atualizadoEm;
        // Conflito: servidor mais novo que o enviado → não sobrescreve.
        if (servidorTs && enviadoTs && servidorTs > enviadoTs) {
          return json({ conflito: true, servidor: atual });
        }
        await registros.setJSON(k, { colecao, registro });
        await marcarMudanca();
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
        await marcarMudanca();
        return json({ ok: true, gravados: lote.length });
      }

      // ---- delete ----
      case "delete": {
        const colecao = String(body.colecao ?? "");
        const id = String(body.id ?? "");
        if (!colecao || !id) return json({ erro: "colecao e id obrigatórios." }, 400);
        // Escopo de exclusão: usa a MESMA lista de permissão da escrita. Credenciais,
        // consentimentos e a trilha de acessos não podem ser apagados por não-admin
        // (a trilha é append-only); folha alheia e ficha alheia idem.
        if (!ehAdmin) {
          if (SO_ADMIN.has(colecao) || colecao === "acessos") return json({ erro: "Sem permissão." }, 403);
          if (colecao === "colaboradores" && id !== meuId) return json({ erro: "Sem permissão." }, 403);
          if (colecao === "pagamentos") return json({ erro: "Sem permissão." }, 403);
          const regraDono = DO_PROPRIO[colecao];
          if (!regraDono && perfil !== "GESTOR") return json({ erro: "Sem permissão." }, 403);
        }
        // LÁPIDE (tombstone): em vez de remover o blob, grava um marcador apagado com
        // carimbo de tempo. Assim o pull em OUTROS computadores enxerga a exclusão e
        // remove o registro local. Sem isso, o pull preservava o local órfão e o dado
        // "ressuscitava" no próximo ciclo. Uma edição posterior (atualizadoEm > lápide)
        // ainda vence — exclusão e edição concorrentes resolvem por timestamp.
        await registros.setJSON(chave(colecao, id), { colecao, registro: { id, _apagado: true, atualizadoEm: new Date().toISOString() } });
        // limpeza best-effort de arquivos ligados ao registro (foto, anexo, currículo)
        await Promise.all([id, `doc:${id}`, `cv:${id}`].map((k) => fotos.delete(k).catch(() => {})));
        await marcarMudanca();
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
        await marcarMudanca();
        return json({ ok: true, apagados: blobs.length });
      }

      // ---- config global ----
      case "getCfg":
        return json({ config: (await configStore.get("config", { type: "json" }).catch(() => null)) ?? null });
      case "setCfg":
        if (!ehAdmin) return json({ erro: "Configuração global é restrita ao RH." }, 403);
        await configStore.setJSON("config", { config: body.config, atualizadoEm: new Date().toISOString() });
        return json({ ok: true });

      // ---- fotos / imagens / anexos ----
      // Guardam também anexos de documentos ("doc:<id>") e currículos ("cv:<id>"),
      // então o escopo vale aqui como vale para os registros.
      case "putPhoto": {
        const id = String(body.id ?? "");
        if (!idArquivoValido(id) || !body.dataUrl) return json({ erro: "id e dataUrl obrigatórios." }, 400);
        if (!(await podeArquivo(id))) return json({ erro: "Sem permissão para este arquivo." }, 403);
        await fotos.set(id, String(body.dataUrl));
        return json({ ok: true });
      }
      case "getPhoto": {
        const id = String(body.id ?? "");
        if (!idArquivoValido(id)) return json({ erro: "id inválido." }, 400);
        if (!(await podeArquivo(id))) return json({ erro: "Sem permissão para este arquivo." }, 403);
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
