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
const CAMPOS_SENSIVEIS = ["cpf", "salario", "adicionais", "refMin", "refMax", "telefone", "matriculaEsocial", "enderecoRua", "enderecoNumero", "enderecoComplemento", "enderecoBairro", "enderecoCep", "conjugeNome", "conjugeTelefone", "filhos", "contatoEmergencia",
  /* PONTOS FORTES E DE MELHORIA sao AVALIACAO sobre a pessoa, escrita pelo RH.
     Sem entrar aqui, a colecao `colaboradores` (nivel "todos") entregaria a
     todos os 33 logados o que o RH escreveu sobre os pontos fracos de cada
     colega. Cada um continua vendo os SEUS -- a mascara so poda registro de
     outro. */
  "pontosFortes", "pontosMelhoria"];

interface Perfil { auth_id?: string; colaborador_id: string; perfil: "ADMIN_RH" | "GESTOR" | "COLABORADOR" }

// Identifica quem está chamando: valida o JWT do usuário (cliente com anon key,
// só para VERIFICAR o token) e busca o perfil dele (cliente de serviço, sem RLS).
async function sessaoDoPedido(req: Request): Promise<Perfil | null> {
  const auth = req.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const { data, error } = await admin.auth.getUser(m[1]); // valida o JWT do usuário
  if (error || !data?.user) return null;
  const { data: perfil } = await admin.from("perfis")
    .select("colaborador_id, perfil, ativo").eq("user_id", data.user.id).maybeSingle();
  if (!perfil || !["ADMIN_RH", "GESTOR", "COLABORADOR"].includes(perfil.perfil) || !perfil.colaborador_id) return null;
  /* DESLIGAR TEM DE FECHAR AQUI TAMBEM. Ate 17/08/2026 `perfis` nao tinha
     coluna de ativo, e o sync nunca consultava o quadro unico -- entao quem
     fosse desativado na tela de Acessos continuava entrando no RH digitando o
     nome completo, com a sessao do Supabase Auth que se renova sozinha. Era o
     unico dos oito que ficava aberto.

     A sessao do Auth ja emitida tambem morre: o desativar da tela derruba as
     sessoes (painel-acesso), mas esta trava e a que vale mesmo se sobrar
     alguma. */
  if ((perfil as { ativo?: boolean }).ativo === false) return null;
  return { ...perfil, auth_id: data.user.id } as Perfil;
}

// Revisões são mantidas em transação pelo banco, inclusive nas importações.

/* ============================================================================
   O ESCOPO, COLECAO POR COLECAO — LISTA BRANCA.
   ============================================================================
   Ate 17/08/2026 o `mascarar` conhecia SETE colecoes e tudo mais caia num
   `return env` no fim; o `podeEscrever` terminava em `return true`. Sao 40
   colecoes no banco: 33 escapavam. A maior delas e `planoContas`, 1.539 linhas
   de dinheiro (1.119 de folha), cuja TELA e restrita ao ADMIN_RH -- e o pull
   levava a colecao inteira para o disco de qualquer pessoa logada, e ainda
   aceitava que ela gravasse por cima.

   Esse desenho falha para o lado errado: colecao NOVA nasce aberta, e ninguem
   percebe. Agora e o contrario -- o que nao esta nesta tabela e negado, e a
   linha nova aparece no log do servidor pedindo classificacao.

   OS QUATRO NIVEIS
     "rh"     so ADMIN_RH le e escreve.
     "gestao" ADMIN_RH e GESTOR (quem lidera equipe). Ferias, ponto, treinamento
              e avaliacao sao ferramenta de gestao: fechar aqui cegaria o gestor
              no trabalho dele.
     "meu"    so o proprio registro da pessoa (por colaboradorId, ou por id em
              `colaboradores`).
     "todos"  estrutura e institucional: cargo, area, nivel, POP, comunicado.
              Nada aqui identifica dinheiro nem vida de ninguem.

   COMO ESTA TABELA FOI MONTADA (e como conferir de novo): cruzando cada
   `useColecao("x")` das telas com o guarda da rota em src/App.tsx --
   RH = ["ADMIN_RH"], GESTAO = ["ADMIN_RH","GESTOR"]. Colecao lida so por tela
   de RH virou "rh", e assim por diante. Onde a leitura vinha da ficha do
   colaborador (ColaboradorFicha, que cada um abre para SI), virou "meu".

   `campos` apaga campo a campo em vez de esconder a linha inteira -- serve para
   o caso do `cargos`, em que todo mundo precisa do NOME do cargo e ninguem
   precisa do salario praticado. */
const ESCOPO: Record<string, { nivel: "rh" | "gestao" | "meu" | "todos"; campos?: string[] }> = {
  // --- dinheiro e vida da pessoa: so o RH
  planoContas: { nivel: "rh" },
  recuperacoesFolha: { nivel: "rh" },   // retrato para desfazer a folha (tem valor)
  classificacaoCustos: { nivel: "rh" },
  alteracoes: { nivel: "rh" },          // historico com valor de campo
  usuarios: { nivel: "rh" },            // controle de acesso, com senhaHash
  /* FREELANCER e contrato: valor combinado, CPF, CNPJ e a data que fecha o
     acesso. Nivel "rh" e o mesmo dos outros contratos — gestor nao precisa ver
     quanto se paga a um prestador para tocar o time dele.
     Sem esta linha a colecao cairia no padrao de `escopoDe`, que TAMBEM e "rh"
     e portanto seguro; mas o padrao vem com um aviso no log e nao diz se foi
     decisao ou esquecimento. Classificar e a diferenca entre as duas. */
  freelancers: { nivel: "rh" },
  acessos: { nivel: "rh" },
  consentimentos: { nivel: "rh" },      // LGPD
  evolucao: { nivel: "rh" },
  candidatos: { nivel: "rh" },
  pesquisas: { nivel: "rh" },
  respostasPesquisa: { nivel: "rh" },
  _diagnostico: { nivel: "rh" },

  // --- ferramenta de quem lidera equipe
  ferias: { nivel: "gestao" },
  ausencias: { nivel: "gestao" },
  pontos: { nivel: "gestao" },
  treinamentos: { nivel: "gestao" },
  avaliacoes: { nivel: "gestao" },
  metas: { nivel: "gestao" },
  pdis: { nivel: "gestao" },
  advertencias: { nivel: "gestao" },
  certificacoesNr: { nivel: "gestao" },
  documentos: { nivel: "gestao" },
  contatos: { nivel: "gestao" },        // contato de emergencia
  tarefas: { nivel: "gestao" },
  agendamentos: { nivel: "gestao" },
  fechamentos: { nivel: "gestao" },     // folha variavel
  lancamentos: { nivel: "gestao" },
  templatesMensagem: { nivel: "gestao" },
  modelosChecklist: { nivel: "gestao" },
  viagens: { nivel: "gestao" },

  // --- so o proprio
  pagamentos: { nivel: "meu" },
  movimentacoes: { nivel: "meu" },      // carreira, e traz salario na descricao
  feedbacks: { nivel: "meu" },
  aceites: { nivel: "meu" },

  // --- estrutura e institucional
  colaboradores: { nivel: "todos", campos: CAMPOS_SENSIVEIS },
  cargos: { nivel: "todos", campos: ["salarioPraticado", "salarioPraticadoEm"] },
  areas: { nivel: "todos" },
  niveis: { nivel: "todos" },
  status: { nivel: "todos" },
  ciclos: { nivel: "todos" },
  eventos: { nivel: "todos" },
  vagas: { nivel: "todos" },            // tem mural publico
  pops: { nivel: "todos" },
  institucionais: { nivel: "todos" },
  repositorio: { nivel: "todos" },
  comunicacao: { nivel: "todos" },
};

// Colecao que ninguem classificou NAO passa. E ela se anuncia no log em vez de
// vazar calada -- foi o silencio que deixou 33 delas abertas por meses.
const desconhecidas = new Set<string>();
function escopoDe(colecao: string) {
  const e = ESCOPO[colecao];
  if (!e) {
    if (!desconhecidas.has(colecao)) {
      desconhecidas.add(colecao);
      console.warn(`[sync] colecao SEM ESCOPO, negada: ${colecao} — classifique em ESCOPO`);
    }
    return { nivel: "rh" as const };
  }
  return e;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  if (req.method !== "POST") return json({ erro: "Use POST." }, 405);

  const sessao = await sessaoDoPedido(req);
  if (!sessao) return json({ erro: "Não autorizado." }, 401);

  const ehAdmin = sessao.perfil === "ADMIN_RH";
  // Gestão = quem lidera equipe (gestor ou RH). Treinamento e feedback são
  // trabalho de gestão, não de colaborador comum.
  const ehGestao = ehAdmin || sessao.perfil === "GESTOR";
  const meuId = sessao.colaborador_id;
  const equipe = new Set<string>([meuId]);
  const areasEquipe = new Set<string>();
  const pessoaisGestao = new Set(["ferias", "ausencias", "pontos", "treinamentos", "avaliacoes", "metas", "pdis", "advertencias", "certificacoesNr", "documentos", "contatos", "tarefas", "fechamentos", "lancamentos", "viagens"]);
  const pertenceEquipe = (col: string, r: any) => r?.colaboradorId ? equipe.has(r.colaboradorId) : col === "metas" && !!r?.areaId && areasEquipe.has(r.areaId);
  const consulta = async (col: string, id: string) => {
    const { data, error } = await admin.from("registros").select("registro, apagado, rh_versao").eq("colecao", col).eq("id", id).maybeSingle();
    if (error) throw new Error("Não foi possível conferir o registro. Tente novamente.");
    return data;
  };

  /* LEITURA. A tabela ESCOPO manda; o que nao esta la e negado (escopoDe cai em
     "rh" e reclama no log). O ADMIN_RH continua vendo tudo -- e a unica excecao
     de nivel, e ela e a regra de sempre. */
  const meuRegistro = (colecao: string, r: any) =>
    colecao === "colaboradores" ? r?.id === meuId : r?.colaboradorId === meuId;

  const mascarar = (env: { colecao: string; registro: any } | null) => {
    if (!env) return null;
    /* LAPIDE PROPAGA PARA TODOS, MAS SO O ESSENCIAL. Ela precisa chegar em todo
       aparelho para o registro sumir de lá -- por isso escapa do escopo. Só que
       ela vinha INTEIRA, antes de qualquer verificação: uma lápide de `usuarios`
       ou de `candidatos` entregava o conteúdo do registro a quem não podia
       ver o registro vivo. Hoje as três que existem só têm id e data, mas o
       desenho é que estava errado -- apagar um registro não pode ser a forma de
       publicá-lo.

       O cliente só precisa saber QUAL id morreu e QUANDO. */
    if (env.registro?._apagado) {
      return { ...env, registro: {
        id: env.registro.id, _apagado: true, atualizadoEm: env.registro.atualizadoEm,
      } };
    }
    if (ehAdmin) return env;
    if (env.colecao === "usuarios") {
      if (env.registro?.colaboradorId !== meuId) return null;
      const { id, colaboradorId, perfil, permissoes, ativo, atualizadoEm } = env.registro;
      return { colecao: env.colecao, registro: { id, colaboradorId, perfil, permissoes, ativo, atualizadoEm } };
    }
    if (env.colecao === "colaboradores" && !equipe.has(env.registro?.id)) {
      // O organograma continua mostrando a equipe. Fora da própria hierarquia,
      // entrega apenas o diretório profissional, sem avaliações ou dados pessoais.
      const r = env.registro;
      if (r.statusId === "inativo") return null;
      return { colecao: env.colecao, registro: { id: r.id, nome: r.nome, cargoId: r.cargoId, nivelId: r.nivelId, areaId: r.areaId, gestorId: r.gestorId, statusId: "ativo", _rhRev: r._rhRev } };
    }
    if (env.colecao === "feedbacks" && ehGestao && pertenceEquipe("feedbacks", env.registro)) return env;
    const { nivel, campos } = escopoDe(env.colecao);
    if (nivel === "rh") return null;
    if (nivel === "gestao") {
      if (!ehGestao && (!["documentos", "treinamentos", "ferias", "ausencias", "tarefas"].includes(env.colecao) || !meuRegistro(env.colecao, env.registro))) return null;
      if (ehGestao && pessoaisGestao.has(env.colecao) && !pertenceEquipe(env.colecao, env.registro)) return null;
    }
    if (nivel === "meu" && !meuRegistro(env.colecao, env.registro)) return null;
    /* Campo a campo, e nao a linha inteira: todo mundo precisa do NOME do cargo
       e ninguem precisa do salario praticado; todo mundo precisa saber quem e
       colega e ninguem precisa do CPF e do endereco do colega. */
    if (campos) {
      const r = { ...env.registro };
      if (!meuRegistro(env.colecao, env.registro)) for (const k of campos) delete r[k];
      if (env.colecao === "colaboradores" && !ehGestao) {
        for (const k of ["riscoSaida", "potencial", "perfilComportamental", "pontosFortes", "pontosMelhoria", "humor", "estiloAprendizagem", "motivacao", "motivacaoAnterior", "enquadramento", "observacaoEnquadramento"]) delete r[k];
      }
      return { ...env, registro: r };
    }
    return env;
  };

  /* ESCRITA — espelha a leitura, com uma diferenca: nivel "todos" NAO e escrita
     livre. Cargo, area e nivel sao estrutura da empresa; quem lidera equipe le,
     quem administra e que muda. Sem isso, qualquer logado reescrevia a tabela
     de cargos pelo sync. */
  const podeEscrever = (colecao: string, reg: any): boolean => {
    if (ehAdmin) return true;
    if (["pagamentos", "movimentacoes"].includes(colecao)) return false;
    if (colecao === "feedbacks") return ehGestao && reg?.autorId === meuId && pertenceEquipe(colecao, reg);
    const { nivel } = escopoDe(colecao);
    if (nivel === "rh" || nivel === "todos") return false;
    if (nivel === "gestao") {
      return ehGestao && (!pessoaisGestao.has(colecao) || pertenceEquipe(colecao, reg));
    }
    // "meu": a propria linha, e so ela.
    return meuRegistro(colecao, reg);
  };

  /* O historico de alteracoes e o unico que TODO MUNDO escreve -- e o registro
     do que a pessoa fez --, mas so em nome de si mesma. Ele e nivel "rh" na
     leitura de proposito (diz o que mudou, com valor), e por isso precisa desta
     excecao explicita aqui. */
  const podeEscreverAlteracao = (reg: any) =>
    reg?.usuarioColaboradorId === meuId;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ erro: "JSON inválido." }, 400); }
  if (!body || Array.isArray(body) || typeof body !== "object") return json({ erro: "Requisição inválida." }, 400);
  const action = String(body.action ?? "");
  const versao = (r: any) => Number.isSafeInteger(r) && r >= 0 ? r : null;
  const validarColecao = (c: string) => Object.prototype.hasOwnProperty.call(ESCOPO, c);
  const validarId = (id: unknown): id is string => typeof id === "string" && /^[a-zA-Z0-9_.:-]{1,200}$/.test(id);
  const rpc = async (nome: string, args: Record<string, unknown>) => {
    const { data, error } = await admin.rpc(nome, args);
    if (error) throw new Error("Não foi possível aplicar a alteração com segurança. Tente novamente.");
    return data;
  };
  const mutacao = () => typeof body.mutationId === "string" && /^[a-zA-Z0-9_-]{1,120}$/.test(body.mutationId)
    ? `${sessao.auth_id}:${body.mutationId}` : null;

  try {
    if (sessao.perfil === "GESTOR" && ["list", "upsert", "delete", "getPhoto", "putPhoto"].includes(action)) {
      const pessoas: any[] = [];
      for (let inicio = 0; ; inicio += 500) {
        const { data, error } = await admin.from("registros").select("id, registro").eq("colecao", "colaboradores").eq("apagado", false).order("id").range(inicio, inicio + 499);
        if (error) throw new Error("Não foi possível conferir sua equipe. Tente novamente.");
        pessoas.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      let mudou = true;
      while (mudou) { mudou = false; for (const p of pessoas) if (equipe.has(p.registro?.gestorId) && !equipe.has(p.id)) { equipe.add(p.id); mudou = true; } }
      for (const p of pessoas) if (equipe.has(p.id) && p.registro?.areaId) areasEquipe.add(p.registro.areaId);
    }
    const autorizarArquivo = async (id: string, escrita: boolean) => {
      if (!/^(?:doc:|cv:)?[a-zA-Z0-9_.:-]{1,180}$/.test(id)) return false;
      if (ehAdmin) return true;
      if (id.startsWith("cv:")) return false;
      if (id.startsWith("doc:")) {
        const doc = await consulta("documentos", id.slice(4));
        if (doc) return !doc.apagado && (escrita ? podeEscrever("documentos", doc.registro) : !!mascarar({ colecao: "documentos", registro: doc.registro }));
        const institucional = await consulta("repositorio", id.slice(4));
        return !!institucional && !institucional.apagado && !escrita;
      }
      const pessoa = await consulta("colaboradores", id);
      return !!pessoa && !pessoa.apagado && (escrita ? id === meuId : equipe.has(id));
    };
    switch (action) {
      case "ping":
        return json({ ok: true, ts: new Date().toISOString() });

      // ---- versão dos dados (global + por coleção) ----
      case "rev": {
        const { data, error } = await admin.from("meta").select("valor").eq("chave", "rev").maybeSingle();
        if (error) throw new Error("Não foi possível consultar a revisão dos dados.");
        const v = (data?.valor as { rev?: number; porColecao?: Record<string, number> } | undefined) ?? {};
        return json({ rev: v.rev ?? null, porColecao: v.porColecao ?? {} });
      }

      // ---- listar (paginado, keyset por chave "colecao::id"; filtro por coleção) ----
      case "list": {
        const after = body.after != null ? String(body.after) : null;
        const offset = Math.max(0, Number(body.offset ?? 0) | 0);
        const colecoes = Array.isArray(body.colecoes) ? (body.colecoes as unknown[]).map(String).filter(Boolean) : null;
        let query = admin.from("registros").select("colecao, id, registro, rh_versao").order("colecao", { ascending: true }).order("id", { ascending: true }).limit(PAGINA);
        if (colecoes && colecoes.length) query = query.in("colecao", colecoes);
        if (after !== null) {
          if (!/^[a-zA-Z0-9_]{1,80}::[a-zA-Z0-9_.:-]{1,200}$/.test(after)) return json({ erro: "Página inválida." }, 400);
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
        const visiveis = linhas.map((l) => mascarar({ colecao: l.colecao, registro: { ...l.registro, _rhRev: l.rh_versao } })).filter(Boolean);
        const temMais = linhas.length === PAGINA;
        const ultima = linhas[linhas.length - 1];
        const nextAfter = temMais && ultima ? chave(ultima.colecao, ultima.id) : null;
        const nextOffset = temMais ? offset + PAGINA : null;
        // A página não faz uma contagem de toda a tabela a cada 150 registros.
        return json({ registros: visiveis, nextAfter, nextOffset });
      }

      // ---- upsert (1 registro, com detecção de conflito) ----
      case "upsert": {
        const colecao = String(body.colecao ?? "");
        const registro = body.registro as { id?: string; atualizadoEm?: string; _apagado?: boolean } | undefined;
        if (!registro || typeof registro !== "object" || Array.isArray(registro) || !validarColecao(colecao) || !validarId(registro.id)) return json({ erro: "colecao e registro.id obrigatórios." }, 400);
        /* `alteracoes` e `acessos` sao o RASTRO: todo mundo escreve (e o registro
           do que a pessoa fez), e ninguem le alem do RH. Por isso nao passam
           pelo podeEscrever normal, que os negaria pelo nivel de leitura -- mas
           cada um so escreve em nome de SI, senao da para forjar linha com o
           nome de outro. */
        const escritaOk = (colecao === "alteracoes" || colecao === "acessos")
          ? podeEscreverAlteracao(registro)
          : podeEscrever(colecao, registro);
        if (!escritaOk) return json({ erro: "Sem permissão para gravar este registro." }, 403);
        const atual = await consulta(colecao, registro.id);
        if (!ehAdmin && (registro._apagado || (atual && !(colecao === "alteracoes" || colecao === "acessos" ? podeEscreverAlteracao(atual.registro) : podeEscrever(colecao, atual.registro))))) return json({ erro: "Sem permissão para alterar este registro." }, 403);
        if (!ehAdmin && (colecao === "alteracoes" || colecao === "acessos") && atual) return json({ erro: "O histórico existente não pode ser reescrito." }, 403);
        const resultado = await rpc("rh_gravar_seguro", {
          p_colecao: colecao, p_id: registro.id, p_registro: registro,
          p_versao: versao(body.baseVersao), p_mutacao: mutacao(), p_apagar: false,
        });
        if (resultado?.conflito && resultado.servidor) resultado.servidor = mascarar(resultado.servidor);
        return json(resultado);
      }

      // Importação atômica: conserva cópia, confere a revisão e só então aplica.
      case "aplicarRetrato": {
        if (!ehAdmin) return json({ erro: "Importação restrita ao RH." }, 403);
        const dados = body.dados;
        if (!dados || typeof dados !== "object" || Array.isArray(dados) || Object.keys(dados).some(c => !validarColecao(c))) return json({ erro: "Coleções inválidas." }, 400);
        return json(await rpc("rh_aplicar_retrato", { p_dados: dados, p_rev: versao(body.rev), p_substituir: body.substituir === true, p_config: body.config ?? null }));
      }
      case "bulkUpsert":
        return json({ erro: "Atualize esta página para usar a importação protegida por cópia de segurança." }, 409);

      // ---- delete (lápide, igual ao Blobs: nunca remove a linha) ----
      case "delete": {
        const colecao = String(body.colecao ?? "");
        const id = String(body.id ?? "");
        if (!validarColecao(colecao) || !validarId(id)) return json({ erro: "colecao e id obrigatórios." }, 400);
        const atual = await consulta(colecao, id);
        if (!ehAdmin && (!atual || ["alteracoes", "acessos"].includes(colecao) || !podeEscrever(colecao, atual.registro))) return json({ erro: "Sem permissão para remover este registro." }, 403);
        if (!atual) return json({ ok: true });
        const resultado = await rpc("rh_gravar_seguro", { p_colecao: colecao, p_id: id, p_registro: null, p_versao: versao(body.baseVersao), p_mutacao: mutacao(), p_apagar: true });
        if (resultado?.conflito && resultado.servidor) resultado.servidor = mascarar(resultado.servidor);
        return json(resultado);
      }

      // ---- limpar coleção inteira ----
      case "limparColecao": {
        if (!ehAdmin) return json({ erro: "Limpar coleção é restrito ao RH." }, 403);
        const colecao = String(body.colecao ?? "");
        if (!validarColecao(colecao)) return json({ erro: "Coleção inválida." }, 400);
        const resultado = await rpc("rh_aplicar_retrato", { p_dados: { [colecao]: [] }, p_rev: versao(body.rev), p_substituir: true, p_config: null });
        return json(resultado);
      }

      // ---- resumo: contagem de registros ATIVOS por coleção (prévia do "oficial") ----
      case "resumo": {
        if (!ehAdmin) return json({ erro: "Resumo restrito ao RH." }, 403);
        const contagem: Record<string, number> = {};
        const ids: Record<string, string[]> = {};
        for (let inicio = 0; ; inicio += 500) {
          const { data, error } = await admin.from("registros").select("colecao, id").eq("apagado", false).order("colecao").order("id").range(inicio, inicio + 499);
          if (error) throw new Error("Não foi possível conferir a base.");
          for (const r of data ?? []) { contagem[r.colecao] = (contagem[r.colecao] ?? 0) + 1; (ids[r.colecao] ??= []).push(r.id); }
          if (!data || data.length < 500) break;
        }
        return json({ contagem, ids });
      }

      // Registros arquivados compõem a recuperação, não são lixo de cache.
      case "limparLapides":
        return json({ erro: "Os registros arquivados são preservados para recuperação. A limpeza automática foi desativada." }, 409);

      // ---- config global ----
      case "getCfg": {
        const { data, error } = await admin.from("config_global").select("config").eq("id", true).maybeSingle();
        if (error) throw new Error("Não foi possível consultar a configuração.");
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
        if (!await autorizarArquivo(id, true)) return json({ erro: "Sem permissão para enviar este arquivo." }, 403);
        const arquivo = String(body.dataUrl);
        if (arquivo.length > 15_000_000 || !/^data:(?:application\/(?:pdf|msword|vnd[.][a-zA-Z0-9.+-]+)|image\/(?:jpeg|png|webp));base64,[a-zA-Z0-9+/=\r\n]+$/.test(arquivo)) return json({ erro: "Use PDF, documento do Office ou imagem JPG, PNG ou WebP de até 10 MB." }, 400);
        const base64 = arquivo.slice(arquivo.indexOf(",") + 1).replace(/\s/g, "");
        const bytes = Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
        if (bytes > 10 * 1024 * 1024 || base64.length % 4 !== 0 || !/^[a-zA-Z0-9+/]+={0,2}$/.test(base64)) return json({ erro: "Arquivo inválido ou maior que 10 MB." }, 400);
        const { error } = await admin.storage.from("arquivos").upload(id, new Blob([String(body.dataUrl)], { type: "text/plain" }), { upsert: true });
        if (error) throw new Error(error.message);
        return json({ ok: true });
      }
      case "getPhoto": {
        const id = String(body.id ?? "");
        if (!await autorizarArquivo(id, false)) return json({ erro: "Sem permissão para consultar este arquivo." }, 403);
        const { data, error } = await admin.storage.from("arquivos").download(id);
        if (error || !data) return json({ erro: "Não foi possível carregar o arquivo. Tente novamente." }, 502);
        return json({ dataUrl: await data.text() });
      }

      default:
        return json({ erro: `Ação desconhecida: ${action}` }, 400);
    }
  } catch (e) {
    return json({ erro: e instanceof Error ? e.message : "Falha interna." }, 500);
  }
});
