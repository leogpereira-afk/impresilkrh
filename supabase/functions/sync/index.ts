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
import { contaApontadaAoSocio, lerVinculosSocioConta } from "../_shared/socioConta.ts";
import { contratoNaPorta } from "../_shared/freelancerContrato.ts";
// Numa linha só: o harness dos testes (src/test/servidorRh.ts) apaga as linhas de import e injeta os símbolos.
import { AVISO_CENTRAL_ID_NOVO, AVISO_ID_ANTIGO, AVISO_ID_MANTIDO, CAMPOS_DO_ID, MOTIVO_SEM_ID, anterioresDe, anterioresDoCpf, avisoSemId, comAnteriores, comBloqueio, comCamposDoId, cpfDoCadastro, ehLinhaDeArquivo, semBloqueioComId, cpf11, enviouOutroId, idBloqueado, idDoArquivoDaLapide, idGravado, idParaCadastro, idQueVale, idQueValiaNoCpfCorrigido, comIdQueValia, idValido, idsAnteriores, juntarAnteriores, cpfMascarado, guardaIdGravado, lapideGuardaId, mesmaPessoaDaLapide, outraPessoaComId, temIdGravavel, type CadastroComId, type IdAnterior } from "../_shared/idPessoa.ts";

const PAGINA = 150;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Cliente "de serviço": ignora RLS, é o único que toca em registros/config/meta/storage.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const chave = (colecao: string, id: string) => `${colecao}::${id}`;

/* PARTICIPACAO POR O.S. MORA NA O.S. (F02, 29/09/2026).
   A apuracao `performanceCiclos` guardava em `entregas` o vinculo de cada O.S.
   com o percentual de cada pessoa. Esse percentual passou a ser lancado so
   dentro da O.S., no PCP (divisao com log). Aqui a lista `entregas` fica
   congelada: o servidor SEMPRE grava a lista guardada (sem linha viva = lista
   vazia; a lapide nao prende o mes), qualquer que seja a enviada.
   DESCARTA COM AVISO, NAO RECUSA (revisao F02): um 410 recusava o registro
   inteiro. O vinculo recusado ficava na copia local (o pull nao rebaixa o que
   esta na fila ou nas falhas) e toda gravacao seguinte daquele mes, inclusive
   aprovacao de bonificacao, levava 410 junto. Agora o resto grava pelo
   rh_gravar_seguro (a conferencia de versao responde conflito primeiro), a
   resposta traz `aviso`, e o pull seguinte repoe a lista do banco na copia.
   O aplicarRetrato ("Enviar tudo", importacao) faz o mesmo por ciclo.
   A comparacao ignora a ordem das chaves: o jsonb do Postgres reordena. */
const canonico = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(canonico)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, canonico((v as Record<string, unknown>)[k])]))
  : v;
const mesmasEntregas = (enviada: unknown, guardada: unknown) =>
  JSON.stringify(canonico(enviada ?? [])) === JSON.stringify(canonico(guardada ?? []));
const entregasGuardadas = (linha: { apagado?: boolean; registro?: Record<string, unknown> } | null | undefined): unknown[] =>
  linha && !linha.apagado && Array.isArray(linha.registro?.entregas) ? linha.registro!.entregas as unknown[] : [];
const AVISO_ENTREGAS = "Os vínculos de O.S. enviados foram descartados: a participação é lançada dentro da O.S., no PCP. O restante foi salvo.";
const CAMPOS_SENSIVEIS = ["cpf", "cpfRecusado", "salario", "adicionais", "refMin", "refMax", "telefone", "matriculaEsocial", "enderecoRua", "enderecoNumero", "enderecoComplemento", "enderecoBairro", "enderecoCep", "conjugeNome", "conjugeTelefone", "filhos", "contatoEmergencia",
  /* PONTOS FORTES E DE MELHORIA sao AVALIACAO sobre a pessoa, escrita pelo RH.
     Sem entrar aqui, a colecao `colaboradores` (nivel "todos") entregaria a
     todos os 33 logados o que o RH escreveu sobre os pontos fracos de cada
     colega. Cada um continua vendo os SEUS -- a mascara so poda registro de
     outro. */
  "pontosFortes", "pontosMelhoria",
  /* O ID DA PESSOA GRAVADO (D-004) são os 6 primeiros dígitos do CPF: segue a
     mesma régua do CPF (o RH e a própria pessoa). Antes de gravado, quem não
     via o CPF também não via o ID calculado; gravar não pode abrir mais. */
  ...CAMPOS_DO_ID];

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
  equipesPlantoes: { nivel: "rh" },
  plantoes: { nivel: "rh" },
  performanceCiclos: { nivel: "rh" },
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
  endomarketing: { nivel: "rh" }, // planejamento e observações internos do RH
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
  // O diretor master é o ÚNICO que vê as contas societárias (2.14 —
  // arrendamento, retiradas). "Nem o RH vê" é a regra do cliente (rbac.ts),
  // mas a porta de dados entregava o planoContas inteiro a qualquer ADMIN_RH
  // e ele saía pelo Exportar (auditoria de 07/09/2026). Agora corta aqui.
  const MASTER_COLAB_ID = Deno.env.get("RH_MASTER_COLAB_ID") || "leonardo-goncalves";
  const ehMaster = sessao.colaborador_id === MASTER_COLAB_ID;
  /* O apontamento de conta ao sócio, feito à mão na tela de Societárias. Só é
     lido para quem NÃO é master — quem é master vê tudo mesmo, e uma consulta
     a menos por pedido.

     FALHA DE LEITURA AQUI ABRE UMA FRESTA, e a escolha é consciente: sem o
     mapa vale só o literal 2.14, então uma conta apontada à mão passaria
     enquanto o config estiver fora do ar. Derrubar TODA a sincronização do RH
     por uma leitura de config é pior, e a fresta é estreita e registrada. A
     porta do ERP (`mubi-pagamentos`) escolhe o contrário — lá uma tela que não
     carrega é barulho, e o pedido é recusado. */
  let vinculosSocioConta: Record<string, string> = {};
  if (!ehMaster) {
    const r = await lerVinculosSocioConta(admin);
    if (r.falhou) console.error("sync: sigo sem o mapa de vínculos societários — vale só o literal 2.14");
    vinculosSocioConta = r.vinculos;
  }
  /* O DINHEIRO DO SÓCIO SÓ SAI PARA O MASTER — em TODA resposta que carrega a
     config, não só no `getCfg`.
     Eu tinha fechado o `getCfg` e deixado o `setCfg` responder `{ config }`
     com a linha inteira depois da mesclagem (`rh_mesclar_config` faz
     `returning config`): qualquer ADMIN_RH que gravasse uma cor recebia os
     lançamentos societários de volta na resposta. Uma régua, um lugar — e
     `podarConfig` é chamada em toda saída. */
  const podarConfig = (cfg: unknown) => {
    if (!cfg || typeof cfg !== "object" || Array.isArray(cfg) || ehMaster) return cfg;
    const { lancamentosSocio: _fora, ...resto } = cfg as Record<string, unknown>;
    return resto;
  };
  const contaConfidencial = (r: any) => {
    const bate = (c: unknown) => typeof c === "string" && (c === "2.14" || c.startsWith("2.14."));
    if (bate(r?.codigo) || bate(r?.equivaleA)) return true;
    /* O CONTADOR RENUMEROU E O 2.14 SUMIU (auditoria de fechamento, 08/09/2026).
       As retiradas e o arrendamento passaram a viver em 2.11.x, e o dono
       apontou essas contas ao sócio à mão — `config.vinculosSocioConta`, com a
       chave "codigo|nome". A porta só conhecia o literal e entregava
       R$ 157.314,37 a qualquer ADMIN_RH. Agora ela consulta o apontamento. */
    /* A régua do apontamento mora em `_shared/socioConta.ts`. Ela ESTAVA
       copiada aqui, e a cópia é o defeito: a porta do ERP respondia outra
       coisa sobre a mesma conta. Duas formas da chave convivem na config real
       (só código, e código|nome) e a régua compartilhada aceita as duas. */
    return contaApontadaAoSocio({ codigo: r?.codigo, nome: r?.nome, equivaleA: r?.equivaleA }, vinculosSocioConta);
  };
  /* Societária também virou LANÇAMENTO (tipo Arrendamento/Retirada), e a porta
     só olhava o plano de contas: R$ 54.544,69 de retirada e arrendamento saíam
     para qualquer ADMIN_RH pela coleção `pagamentos`. */
  const TIPOS_SOCIETARIOS = ["Arrendamento", "Retirada"];
  const lancamentoSocietario = (r: any) => TIPOS_SOCIETARIOS.includes(String(r?.tipo ?? ""));
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
  const agoraIso = () => new Date().toISOString();

  /* O ID DA PESSOA (D-004): as fichas e os contratos vivos, para decidir o ID
     de quem nasce e conferir que ele não é de outra pessoa. Falha de leitura é
     500 (a fila tenta de novo), nunca gravação sem a conferência. */
  const cadastrosVivos = async (): Promise<(CadastroComId & { versao: number | null })[]> => {
    const out: (CadastroComId & { versao: number | null })[] = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await admin.from("registros").select("colecao, id, registro, rh_versao").in("colecao", ["colaboradores", "freelancers"]).eq("apagado", false).order("colecao").order("id").range(inicio, inicio + 499);
      if (error) throw new Error("Não foi possível conferir o ID da pessoa nos cadastros. Tente novamente.");
      for (const l of data ?? []) out.push({ colecao: l.colecao, id: l.id, registro: (l.registro ?? {}) as Record<string, unknown>, versao: Number.isSafeInteger(l.rh_versao) ? l.rh_versao : null });
      if (!data || data.length < 500) break;
    }
    return out;
  };
  /* As LÁPIDES que guardam ID (auditoria de 12/10/2026, P1, e a verificação
     do conserto): o ID gravado e os IDs anteriores de quem saiu continuam
     sendo dessa pessoa no histórico do PCP e não são dados a ninguém. */
  const lapidesQueGuardamId = async (): Promise<CadastroComId[]> => {
    const out: CadastroComId[] = [];
    for (let inicio = 0; ; inicio += 500) {
      const { data, error } = await admin.from("registros").select("colecao, id, registro").in("colecao", ["colaboradores", "freelancers"]).eq("apagado", true).order("colecao").order("id").range(inicio, inicio + 499);
      if (error) throw new Error("Não foi possível conferir o ID da pessoa nos cadastros. Tente novamente.");
      for (const l of data ?? []) {
        if (lapideGuardaId(l.registro, l.colecao)) out.push({ colecao: l.colecao, id: l.id, registro: (l.registro ?? {}) as Record<string, unknown>, apagado: true });
      }
      if (!data || data.length < 500) break;
    }
    return out;
  };
  /** A régua inteira: os vivos e as lápides que guardam ID. */
  const cadastrosDaRegua = async (vivos?: CadastroComId[]): Promise<CadastroComId[]> =>
    [...(vivos ?? await cadastrosVivos()), ...await lapidesQueGuardamId()];
  /** A lápide que guarda ID e vai ser ocupada por OUTRA pessoa (outro CPF, ou
      sem CPF) é guardada inteira numa linha apagada própria antes: o ID e os
      IDs anteriores de quem saiu nunca se perdem e continuam na régua, e a
      pessoa nova não herda nada dela. Como linha apagada, ela não aparece na
      tela nem no PCP. */
  const arquivoDaLapide = (colecao: string, lapide: Record<string, unknown>, versao: number | null | undefined) => {
    const id = idDoArquivoDaLapide(String(lapide.id ?? ""), versao);
    return { colecao, id, registro: { ...lapide, id, _apagado: true, arquivadaDe: lapide.id } as Record<string, unknown> };
  };

  /* O QUE A GRAVAÇÃO DE UMA FICHA OU CONTRATO FAZ COM O ID. Nunca recusa: a
     gravação passa pela fila do aparelho, e um 4xx prenderia a ficha inteira
     (o mesmo princípio do F02 acima, e o do PCP): o que não pode entrar é
     DESCARTADO, o resto grava, e a resposta traz o `aviso`.
       · cadastro VIVO com ID gravado: o ID fica, venha o que vier (ausente
         não apaga; outro valor é descartado com aviso);
       · cadastro que nasce agora, o que revive a lápide e o que ganha o
         primeiro CPF: o ID nasce aqui, pela régua de idParaCadastro. A lápide
         NÃO entrega o ID dela a quem ocupa a mesma vaga: o id da linha pode
         ser de outra pessoa (o Organograma cria a ficha com id = slug do nome,
         e um homônimo revive a lápide de quem saiu). O ID da lápide só volta
         com o mesmo CPF da lápide e passando pela conferência contra os vivos;
         sem CPF, o cadastro revivido fica sem ID;
       · cadastro antigo, com CPF e sem o campo: fica como está, até o botão do
         admin (Configurações do RH › Cadastros) gravar com a conferência;
       · os IDs ANTERIORES (`idPessoaAnteriores`) só o servidor escreve: o
         cadastro vivo fica com a lista gravada, venha o que vier no envio, e
         o que nasce recebe a lista dos outros cadastros do mesmo CPF (ficha
         e contrato dividem a lista; a lápide do CPF também entra);
       · a marca `idPessoaBloqueado` (cadastro sem ID porque o ID do CPF é ou
         foi de outra pessoa) também só o servidor escreve: nasce com a
         decisão da régua, o cadastro vivo fica com a gravada, e ela some
         quando o cadastro ganha ID (pelo admin). */
  const idNaGravacao = async (colecao: string, registro: Record<string, unknown>, atual: { registro?: unknown; apagado?: boolean; rh_versao?: number } | null) => {
    const gravado = (atual?.registro ?? null) as Record<string, unknown> | null;
    const lapide = atual?.apagado ? gravado : null;
    // Lápide sobre lápide: nada revive, o ID guardado fica como estava.
    if (lapide && registro._apagado) return { registro: comCamposDoId(registro, lapide), idPessoa: "", aviso: null };
    const guardado = lapide ? "" : idGravado(gravado);
    if (guardado) {
      return { registro: comCamposDoId(registro, gravado), idPessoa: guardado, aviso: enviouOutroId(registro, guardado) ? AVISO_ID_MANTIDO : null };
    }
    const nasce = !atual || !!lapide || (!cpfDoCadastro(colecao, gravado) && !!cpfDoCadastro(colecao, registro));
    // Aqui `lapide` só existe quando nasce: a lista que fica é a do cadastro vivo gravado.
    const daLinha = lapide ? [] : anterioresDe(gravado);
    if (!nasce || registro._apagado) {
      /* Cadastro VIVO que continua sem ID (o antigo, que espera o botão do
         admin, e o marcado): a régua de hoje decide a marca. Se o ID do CPF é
         de outra pessoa, marca (a ficha salva sem ID antes da marca existir,
         e a que teve o CPF corrigido para o começo de outra pessoa; revisão do
         80e7d8f). Se a régua já liberaria, a marca gravada fica: ela só some
         quando o admin dá o ID (a tela mostra "sem ID: conferir"). */
      let marca: string = lapide ? "" : idBloqueado(gravado);
      // CPF corrigido em cadastro sem ID gravado: o ID que valia fica (D-004).
      if (!lapide && !registro._apagado) {
        const valia = idQueValiaNoCpfCorrigido(colecao, gravado, registro, await cadastrosDaRegua());
        if (valia) {
          const reg = comIdQueValia(comCamposDoId(registro, null), valia, daLinha, agoraIso());
          return {
            registro: reg, idPessoa: valia.outro ? "" : valia.idPessoa,
            aviso: valia.outro ? avisoSemId("id-de-outra-pessoa", String(valia.outro.registro.nome ?? ""), true) : null,
          };
        }
      }
      if (!lapide && !registro._apagado && cpfDoCadastro(colecao, registro)) {
        const d = idParaCadastro({ colecao, id: String(registro.id), registro }, await cadastrosDaRegua());
        if ("motivo" in d && d.motivo !== "sem-cpf") marca = d.motivo;
      }
      return { registro: comBloqueio(comAnteriores(comCamposDoId(registro, null), daLinha), marca), idPessoa: "", aviso: enviouOutroId(registro, "") ? AVISO_ID_ANTIGO : null };
    }
    const alvo = { colecao, id: String(registro.id), registro };
    const regua = await cadastrosDaRegua();
    // Outra pessoa ocupa a vaga da lápide que guarda ID: a lápide vai inteira
    // para a linha de arquivo antes (e continua na régua, que já a tem pela
    // linha de hoje). Falha aqui é 500: a fila tenta de novo, nada se perde.
    if (lapide && !mesmaPessoaDaLapide(colecao, lapide, registro) && lapideGuardaId(lapide, colecao)) {
      const arq = arquivoDaLapide(colecao, lapide, atual?.rh_versao);
      const r = await rpc("rh_gravar_seguro", { p_colecao: colecao, p_id: arq.id, p_registro: arq.registro, p_versao: 0, p_mutacao: null, p_apagar: false });
      if (!r?.ok) throw new Error("Não foi possível guardar o cadastro apagado antes de ocupar a vaga dele. Tente novamente.");
      console.warn(`[sync] ${colecao}/${String(registro.id)}: a lápide com ID foi guardada em ${arq.id} (outra pessoa ocupa a vaga)`);
    }
    const doCpf = juntarAnteriores(daLinha, anterioresDoCpf(cpfDoCadastro(colecao, registro), alvo, regua));
    const decisao = idParaCadastro(alvo, regua, lapide);
    if ("motivo" in decisao) { // sem ID (só a decisão sem ID traz o motivo)
      const aviso = decisao.motivo !== "sem-cpf" || enviouOutroId(registro, "") ? avisoSemId(decisao.motivo, decisao.outro?.nome, !!(decisao.outro?.anterior || decisao.outro?.apagado)) : null;
      if (decisao.motivo !== "sem-cpf") console.warn(`[sync] ${colecao}/${String(registro.id)} salvo sem o ID da pessoa: ${MOTIVO_SEM_ID[decisao.motivo]}${decisao.outro?.anterior ? " (ID anterior de outra pessoa)" : decisao.outro?.apagado ? " (ID de um cadastro apagado)" : ""}`);
      // A marca diz a quem calcula pelo CPF (o PCP) que este cadastro não tem esse ID.
      return { registro: comBloqueio(comAnteriores(comCamposDoId(registro, null), doCpf), decisao.motivo), idPessoa: "", aviso };
    }
    // A mesma pessoa voltou (mesmo CPF da lápide, conferida): fica o carimbo de antes.
    // Outro CPF com o mesmo começo dá o mesmo ID, mas o carimbo (quem, quando, motivo) é da
    // pessoa apagada e não passa adiante (verificação da correção, 12/10/2026).
    if (lapide && decisao.idPessoa === idGravado(lapide) && mesmaPessoaDaLapide(colecao, lapide, registro)) {
      const r = comCamposDoId(registro, lapide);
      return { registro: comAnteriores(r, juntarAnteriores(anterioresDe(r), doCpf)), idPessoa: decisao.idPessoa, aviso: enviouOutroId(registro, decisao.idPessoa) ? AVISO_ID_MANTIDO : null };
    }
    return {
      registro: comAnteriores({ ...comCamposDoId(registro, null), idPessoa: decisao.idPessoa, idPessoaEm: agoraIso() }, doCpf),
      idPessoa: decisao.idPessoa,
      aviso: enviouOutroId(registro, decisao.idPessoa) ? AVISO_ID_MANTIDO : null,
    };
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
    if (env.colecao === "planoContas" && !ehMaster && contaConfidencial(env.registro)) return null;
    if (env.colecao === "pagamentos" && !ehMaster && lancamentoSocietario(env.registro)) return null;
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
    // Feedback da EQUIPE, para quem lidera — nunca o feedback sobre si mesmo
    // (a equipe começa pela própria pessoa; aqui ela não conta).
    if (env.colecao === "feedbacks" && ehGestao && pertenceEquipe("feedbacks", env.registro) && env.registro?.colaboradorId !== meuId) return env;
    if (env.colecao === "feedbacks" && env.registro?.colaboradorId === meuId) {
      // A própria pessoa: feedback EM PREPARO (preparado ou agendado, ainda não
      // dado) não sai — o roteiro do gestor não é dela até a conversa
      // acontecer. O que sai, sai sem o roteiro (auditoria de 07/09/2026).
      const r = env.registro;
      if (!r.ocorridoEm && (r.preparadoEm || r.agendadaPara)) return null;
      const { roteiro: _roteiro, preparadoEm: _preparadoEm, ...semRoteiro } = r;
      return { ...env, registro: semRoteiro };
    }
    // Candidatura INTERNA: a própria pessoa vê a sua (o resto continua sendo do RH).
    if (env.colecao === "candidatos") return env.registro?.colaboradorId === meuId && env.registro?.origem === "Interno" ? env : null;
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
      // Dados de gestão nunca para a própria pessoa — nem quando ela é gestora.
      if (env.colecao === "colaboradores" && (!ehGestao || meuRegistro(env.colecao, env.registro))) {
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
    if (colecao === "planoContas" && contaConfidencial(reg) && !ehMaster) return false;
    if (ehAdmin) return true;
    if (["pagamentos", "movimentacoes"].includes(colecao)) return false;
    if (colecao === "feedbacks") return ehGestao && reg?.autorId === meuId && pertenceEquipe(colecao, reg);
    // Verba variável e aprovação de folha: gestor não lança nem aprova para si.
    if ((colecao === "lancamentos" || colecao === "fechamentos") && reg?.colaboradorId === meuId) return false;
    // Mural de vagas: o colaborador grava a PRÓPRIA candidatura interna e só
    // ela — antes a porta recusava com 403 e a tela dizia "enviada".
    if (colecao === "candidatos") return reg?.colaboradorId === meuId && reg?.origem === "Interno";
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
      if (id.startsWith("cv:") || id.startsWith("endo:")) return false;
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
      // Respostas nunca passam por registros, exportação ou fila local.
      case "escuta":
      case "entrevistas":
      case "nps": {
        const { data, error } = await admin.rpc(action === "escuta" ? "rh_escuta_operar" : action === "entrevistas" ? "rh_entrevistas_operar" : "rh_nps_operar", {
          p_user: sessao.auth_id, p_op: String(body.op ?? ""), p_dados: body.dados ?? {},
        });
        if (error) return json({ erro: error.code === "P0001" ? error.message : "Pesquisa indisponível. Peça ao RH para conferir a implantação e tente novamente." }, 400);
        return json(data);
      }

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
        /* CONTRATO DE INSTALADOR PRECISA DE CPF (F07 do PCP, 29/09/2026): o
           PCP lê esta coleção e a pessoa lá é o ID que sai do CPF. A mesma
           régua da tela (Freelancers.tsx), comparando com o contrato gravado
           (`atual`). A tela recusa antes de enfileirar; aqui a gravação vem
           da fila do aparelho e NÃO é recusada (o 422 prendia a fila e deixava
           o contrato digitado só no aparelho): o contrato é salvo sem o que a
           régua recusa (CPF que não confere vai para `cpfRecusado`; envio sem
           CPF não apaga o CPF válido), com aviso, e a resposta traz o registro
           gravado para o aparelho adotar. Ver contratoNaPorta em
           _shared/freelancerContrato.ts. A importação de retrato não passa por
           aqui. Lápide não tem o que conferir. */
        let gravar: Record<string, unknown> = registro;
        let aviso: string | null = null;
        let devolverRegistro = false;
        if (colecao === "freelancers" && !registro._apagado) {
          const gravado = atual && !atual.apagado ? (atual.registro as Record<string, unknown>) : null;
          const r = contratoNaPorta(registro as Record<string, unknown>, gravado);
          gravar = r.registro; aviso = r.aviso; devolverRegistro = !!r.aviso;
        }
        let idDoCadastro: string | null = null;
        if (temIdGravavel(colecao)) {
          const r = await idNaGravacao(colecao, gravar, atual);
          gravar = r.registro; idDoCadastro = r.idPessoa;
          if (r.aviso) aviso = [aviso, r.aviso].filter(Boolean).join(" ");
        }
        if (colecao === "performanceCiclos") {
          const guardadas = entregasGuardadas(atual);
          if (!mesmasEntregas((registro as { entregas?: unknown }).entregas, guardadas)) aviso = AVISO_ENTREGAS;
          gravar = { ...registro, entregas: guardadas };
        }
        const resultado = await rpc("rh_gravar_seguro", {
          p_colecao: colecao, p_id: registro.id, p_registro: gravar,
          p_versao: versao(body.baseVersao), p_mutacao: mutacao(), p_apagar: false,
        });
        if (resultado?.conflito && resultado.servidor) resultado.servidor = mascarar(resultado.servidor);
        if (aviso && resultado && !resultado.conflito) resultado.aviso = aviso;
        // O ID que ficou gravado volta na resposta: a cópia do aparelho o recebe
        // sem esperar o próximo pull (só quem grava ficha e contrato é o RH).
        if (idDoCadastro && resultado && !resultado.conflito) resultado.idPessoa = idDoCadastro;
        // O contrato ajustado pela régua da F07 volta inteiro: o aparelho troca a
        // cópia dele pelo que ficou no banco (sem o CPF recusado), sem esperar o pull.
        if (devolverRegistro && resultado && !resultado.conflito) resultado.registro = gravar;
        return json(resultado);
      }

      // Importação atômica: conserva cópia, confere a revisão e só então aplica.
      case "aplicarRetrato": {
        if (!ehAdmin) return json({ erro: "Importação restrita ao RH." }, 403);
        const dados = body.dados;
        if (!dados || typeof dados !== "object" || Array.isArray(dados) || Object.keys(dados).some(c => !validarColecao(c))) return json({ erro: "Coleções inválidas." }, 400);
        /* QUEM NÃO LÊ TAMBÉM NÃO APAGA (14/09/2026).
           `rh_aplicar_retrato` SUBSTITUI a linha `config_global` pela que o
           cliente manda — e o cliente manda a config LOCAL dele, que desde a
           poda do `getCfg` já vem sem `lancamentosSocio`. Ou seja: um ADMIN_RH
           que não é o master clicando "Enviar tudo" apagaria os lançamentos
           societários do dono, em silêncio, e a prévia do envio só conta
           registros por coleção — nada avisaria.
           Aqui a chave do banco é reposta antes de gravar: quem não pode ver
           não pode sobrescrever com o vazio que recebeu. */
        let configDoRetrato = body.config ?? null;
        if (configDoRetrato && typeof configDoRetrato === "object" && !Array.isArray(configDoRetrato) && !ehMaster) {
          const { data: guardada } = await admin.from("config_global").select("config").eq("id", true).maybeSingle();
          const doBanco = (guardada?.config as Record<string, unknown> | null) ?? {};
          configDoRetrato = "lancamentosSocio" in doBanco
            ? { ...(configDoRetrato as Record<string, unknown>), lancamentosSocio: doBanco.lancamentosSocio }
            : (({ lancamentosSocio: _fora, ...resto }) => resto)(configDoRetrato as Record<string, unknown>);
        }
        /* O MESMO CONGELAMENTO DO UPSERT (F02): "Enviar tudo" e a importacao por
           colecao mandam a copia local inteira. Sem isto, um vinculo de O.S. que
           o upsert descartou (ou uma copia velha) entrava no banco por aqui.
           Cada ciclo do retrato leva a lista guardada no banco; ciclo sem linha
           viva entra com lista vazia. A restauracao nao inclui, nao troca e nao
           remove vinculo. */
        let dadosDoRetrato = dados as Record<string, unknown>;
        let avisoRetrato: string | null = null;
        if ("performanceCiclos" in dadosDoRetrato) {
          const ciclos = dadosDoRetrato.performanceCiclos;
          if (!Array.isArray(ciclos)) return json({ erro: "Coleções inválidas." }, 400);
          const vivos = new Map<string, unknown[]>();
          for (let inicio = 0; ; inicio += 500) {
            const { data, error } = await admin.from("registros").select("id, registro, apagado").eq("colecao", "performanceCiclos").eq("apagado", false).order("id").range(inicio, inicio + 499);
            if (error) throw new Error("Não foi possível conferir as apurações de performance.");
            for (const l of data ?? []) vivos.set(l.id, entregasGuardadas(l));
            if (!data || data.length < 500) break;
          }
          const repostos: unknown[] = [];
          for (const c of ciclos) {
            if (!c || typeof c !== "object" || Array.isArray(c)) { repostos.push(c); continue; }
            const guardadas = vivos.get(String((c as { id?: unknown }).id)) ?? [];
            if (!mesmasEntregas((c as { entregas?: unknown }).entregas, guardadas)) avisoRetrato = AVISO_ENTREGAS;
            repostos.push({ ...(c as Record<string, unknown>), entregas: guardadas });
          }
          dadosDoRetrato = { ...dadosDoRetrato, performanceCiclos: repostos };
        }
        /* O ID DA PESSOA NÃO ANDA PELO RETRATO (D-004). "Enviar tudo", a
           importação e a restauração mandam a cópia do aparelho, que pode ser de
           antes do ID gravado: sem isto, restaurar um backup apagaria o ID de
           todo mundo. Cada ficha e contrato do retrato leva os campos do ID da
           linha VIVA do banco; quem não tem ID no banco entra sem ele, e o botão
           do admin grava depois, com a conferência. A lápide é a régua do
           upsert: o item de mesmo id só leva o ID dela com o mesmo CPF da
           lápide e se o ID não for de outra pessoa, entre os vivos do banco e
           os do próprio retrato (o id da linha pode ser de outra pessoa). */
        const juntarAviso = (msg: string) => { if (!avisoRetrato?.includes(msg)) avisoRetrato = [avisoRetrato, msg].filter(Boolean).join(" "); };
        const lapidesComId: { col: string; indice: number; reg: Record<string, unknown>; lapide: Record<string, unknown> }[] = [];
        // Os vivos sem ID gravado no banco: se o retrato traz o CPF corrigido, o ID que valia fica (D-004).
        const semIdNoBanco: { col: string; indice: number; antes: Record<string, unknown> }[] = [];
        for (const col of ["colaboradores", "freelancers"]) {
          if (!(col in dadosDoRetrato)) continue;
          const itens = dadosDoRetrato[col];
          if (!Array.isArray(itens)) return json({ erro: "Coleções inválidas." }, 400);
          const guardados = new Map<string, Record<string, unknown>>();
          const lapides = new Map<string, { registro: Record<string, unknown>; versao: number | null }>();
          const arquivosNoBanco = new Set<string>();
          for (let inicio = 0; ; inicio += 500) {
            const { data, error } = await admin.from("registros").select("id, registro, apagado, rh_versao").eq("colecao", col).order("id").range(inicio, inicio + 499);
            if (error) throw new Error("Não foi possível conferir o ID da pessoa nos cadastros.");
            // Quem tem ID, IDs anteriores ou a marca de bloqueio no banco: o retrato leva de lá.
            for (const l of data ?? []) {
              if (l.apagado && ehLinhaDeArquivo(l.id, l.registro)) arquivosNoBanco.add(l.id);
              // Os vivos sem ID com CPF também: o ID que valia no banco fica quando o CPF é corrigido.
              if (l.apagado ? !lapideGuardaId(l.registro, col) : !(guardaIdGravado(l.registro) || idBloqueado(l.registro) || cpfDoCadastro(col, l.registro))) continue;
              if (l.apagado) lapides.set(l.id, { registro: l.registro as Record<string, unknown>, versao: Number.isSafeInteger(l.rh_versao) ? l.rh_versao : null });
              else guardados.set(l.id, l.registro as Record<string, unknown>);
            }
            if (!data || data.length < 500) break;
          }
          /* A LINHA DE ARQUIVO NÃO ANDA PELO RETRATO (verificação de 12/10/2026,
             D4): um item com o id de uma linha de arquivo (a do banco ou o nome
             que ela teria) é deixado de fora, e a linha do banco fica como
             está. As lápides que outra pessoa ocupa pelo retrato vão inteiras
             para a linha de arquivo, no mesmo retrato (a régua do upsert). */
          const itensValidos = itens.filter((item: unknown) => {
            const reg = item && typeof item === "object" && !Array.isArray(item) ? item as Record<string, unknown> : null;
            if (!reg || !(arquivosNoBanco.has(String(reg.id)) || ehLinhaDeArquivo(String(reg.id), reg))) return true;
            console.warn(`[sync] retrato: ${col}/${String(reg.id)} é linha de arquivo de lápide: fica como está no banco`);
            return false;
          });
          const arquivadas = new Map<string, Record<string, unknown>>();
          const repostos = itensValidos.map((item: unknown, indice: number) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) return item;
            const reg = item as Record<string, unknown>;
            const doBanco = guardados.get(String(reg.id)) ?? null;
            const lapide = doBanco ? null : lapides.get(String(reg.id))?.registro ?? null;
            // Lápide sobre lápide: o ID e a lista da lápide ficam como estavam.
            if (lapide && reg._apagado) return comCamposDoId(reg, lapide);
            const reposto = comCamposDoId(reg, doBanco);
            if (doBanco && !idGravado(doBanco) && !reg._apagado) semIdNoBanco.push({ col, indice, antes: doBanco });
            if (lapide && !mesmaPessoaDaLapide(col, lapide, reg)) {
              const arq = arquivoDaLapide(col, lapide, lapides.get(String(reg.id))?.versao);
              arquivadas.set(arq.id, arq.registro);
              console.warn(`[sync] retrato: ${col}/${String(reg.id)}: a lápide com ID vai para ${arq.id} (outra pessoa ocupa a vaga)`);
            }
            if (lapide && idGravado(lapide) && mesmaPessoaDaLapide(col, lapide, reg)) lapidesComId.push({ col, indice, reg: reposto, lapide });
            else if (enviouOutroId(reg, idGravado(doBanco))) juntarAviso(doBanco ? AVISO_ID_MANTIDO : AVISO_ID_ANTIGO);
            return reposto;
          });
          dadosDoRetrato = { ...dadosDoRetrato, [col]: [...repostos, ...arquivadas.values()] };
        }
        const doRetrato: (CadastroComId & { indice: number })[] = [];
        for (const col of ["colaboradores", "freelancers"]) {
          ((dadosDoRetrato[col] as unknown[] | undefined) ?? []).forEach((item, indice) => {
            if (item && typeof item === "object" && !Array.isArray(item)) doRetrato.push({ colecao: col, id: String((item as { id?: unknown }).id), registro: item as Record<string, unknown>, apagado: !!(item as { _apagado?: unknown })._apagado, indice });
          });
        }
        // A marca de bloqueio no retrato: quem entra sem ID e com CPF passa pela régua.
        const semIdComCpf = doRetrato.filter((c) => !c.apagado && !idGravado(c.registro) && cpfDoCadastro(c.colecao, c.registro));
        const vivos: CadastroComId[] = lapidesComId.length || semIdComCpf.length || semIdNoBanco.length ? [...await cadastrosDaRegua(), ...doRetrato] : [];
        if (lapidesComId.length) {
          for (const { col, indice, reg, lapide } of lapidesComId) {
            const id = idGravado(lapide);
            // A mesma régua do upsert (verificação da correção, 12/10/2026): o retrato só leva o ID da
            // lápide quando a decisão de quem nasce daria esse mesmo ID, com o mesmo CPF; outro cadastro
            // vivo do mesmo CPF com outro ID deixa sem ID, como no upsert.
            const decisao = idParaCadastro({ colecao: col, id: String(reg.id), registro: reg }, vivos, lapide);
            if (decisao.idPessoa !== id || !mesmaPessoaDaLapide(col, lapide, reg)) {
              console.warn(`[sync] retrato: ${col}/${String(reg.id)} entra sem o ID da lápide: ${MOTIVO_SEM_ID[decisao.motivo ?? "id-de-outra-pessoa"]}`);
              if (enviouOutroId(reg, "")) juntarAviso(AVISO_ID_ANTIGO);
              continue;
            }
            (dadosDoRetrato[col] as unknown[])[indice] = comCamposDoId(reg, lapide);
            // Quem vem depois na conferência já vê este ID com o dono dele.
            const naLista = vivos.find((v) => !v.apagado && v.colecao === col && v.id === String(reg.id));
            if (naLista) naLista.registro = comCamposDoId(reg, lapide);
          }
        }
        const agoraRetrato = agoraIso();
        for (const { col, indice, antes } of semIdNoBanco) {
          const atual = (dadosDoRetrato[col] as Record<string, unknown>[])[indice];
          const valia = idQueValiaNoCpfCorrigido(col, antes, atual, vivos);
          if (!valia) continue;
          const novo = comIdQueValia(atual, valia, anterioresDe(atual), agoraRetrato);
          (dadosDoRetrato[col] as Record<string, unknown>[])[indice] = novo;
          const naLista = vivos.find((v) => !v.apagado && v.colecao === col && v.id === String(atual.id));
          if (naLista) naLista.registro = novo;
          console.warn(`[sync] retrato: ${col}/${String(atual.id)}: CPF corrigido, ${valia.outro ? "o ID que valia é de outra pessoa: vai para os anteriores, com a marca" : "o ID que valia fica gravado"}`);
        }
        for (const c of semIdComCpf) {
          const atual = (dadosDoRetrato[c.colecao] as Record<string, unknown>[])[c.indice];
          if (idGravado(atual) || idBloqueado(atual)) continue; // ganhou o ID da lápide, ou a marca veio do banco
          const decisao = idParaCadastro({ colecao: c.colecao, id: c.id, registro: atual }, vivos);
          if (!("motivo" in decisao)) continue;
          const marcado = comBloqueio(atual, decisao.motivo);
          (dadosDoRetrato[c.colecao] as Record<string, unknown>[])[c.indice] = marcado;
          const naLista = vivos.find((v) => !v.apagado && v.colecao === c.colecao && v.id === c.id);
          if (naLista) naLista.registro = marcado;
        }
        const aplicado = await rpc("rh_aplicar_retrato", { p_dados: dadosDoRetrato, p_rev: versao(body.rev), p_substituir: body.substituir === true, p_config: configDoRetrato });
        if (avisoRetrato && aplicado && !aplicado.conflito) aplicado.aviso = avisoRetrato;
        return json(aplicado);
      }
      /* O ID DA PESSOA, PELO ADMIN (D-004; escrita em produção só pela tela,
         D-005). Chamado na hora, pela tela, FORA da fila do aparelho: aqui o
         4xx volta para quem clicou, com o motivo, e nada fica preso na fila.
           previa    o que o botão "Gravar o ID nas fichas antigas" vai gravar;
           preencher grava só o que a prévia mostrou e o admin confirmou, só em
                     quem continua sem o ID e só se o ID ainda é o mesmo;
           trocar    troca o ID de um cadastro (erro de cadastro), com motivo,
                     carimbo do servidor e linha no histórico; o ID que sai
                     vai para os IDs anteriores da pessoa;
           devolverId  devolve à MESMA pessoa que voltou nesta linha (o admin
                     confirma "é a mesma pessoa"; ex.: CPF corrigido nos últimos
                     dígitos) o ID guardado na linha de arquivo DESTA linha;
                     nunca o ID de outra linha. Motivo, carimbo e histórico;
           registrarAnterior  guarda um ID que a pessoa já teve e que nenhum
                     campo guardou (troca feita antes dos IDs anteriores), com
                     motivo, carimbo do servidor e linha no histórico.
         Toda decisão confere também os IDs anteriores de todo mundo, vivos e
         lápides (auditoria de 12/10/2026, P1). */
      case "idPessoa": {
        if (!ehAdmin) return json({ erro: "O ID da pessoa é gravado só pelo admin do RH." }, 403);
        const op = String(body.op ?? "");
        const cadastros = await cadastrosVivos();
        const regua = await cadastrosDaRegua(cadastros);
        const nomeDe = (c: CadastroComId) => String(c.registro.nome ?? "");
        const desligado = (c: CadastroComId) => c.colecao === "freelancers"
          ? c.registro.situacao === "encerrado"
          : c.registro.statusId === "inativo" || !!c.registro.dataDesligamento;
        const planejar = () => cadastros.filter((c) => !idGravado(c.registro)).map((c) => {
          const d = idParaCadastro(c, regua);
          return {
            colecao: c.colecao, id: c.id, nome: nomeDe(c), desligado: desligado(c),
            idPessoa: d.idPessoa, herdado: "herdadoDe" in d && !!d.herdadoDe,
            motivo: "motivo" in d
              ? ("outro" in d && d.outro?.anterior ? "o ID do CPF já foi de outra pessoa (é um ID anterior dela)"
                : "outro" in d && d.outro?.apagado ? "o ID do CPF já foi de outra pessoa (cadastro apagado)"
                : MOTIVO_SEM_ID[d.motivo])
              : null,
            outro: "outro" in d && d.outro ? d.outro.nome : null,
            // O motivo da régua que bloqueia (vira a marca idPessoaBloqueado no preencher).
            bloqueio: "motivo" in d && d.motivo !== "sem-cpf" ? d.motivo : null,
            marcado: !!idBloqueado(c.registro),
          };
        });
        const registrarNoHistorico = async (linha: Record<string, unknown>): Promise<boolean> => {
          const quem = cadastros.find((c) => c.colecao === "colaboradores" && c.id === meuId);
          const id = `idpessoa-${crypto.randomUUID()}`;
          const agora = agoraIso();
          try {
            await rpc("rh_gravar_seguro", {
              p_colecao: "alteracoes", p_id: id, p_versao: 0, p_mutacao: null, p_apagar: false,
              p_registro: { id, usuarioColaboradorId: meuId, usuarioNome: quem ? nomeDe(quem) : meuId, perfil: sessao.perfil, criadoEm: agora, atualizadoEm: agora, ...linha },
            });
            return true;
          } catch (e) {
            console.error("sync: o ID foi gravado e o histórico não", e);
            return false;
          }
        };
        const AVISO_SEM_HISTORICO = "O ID foi gravado, mas a linha do histórico não. Anote o motivo e avise o suporte.";
        /* Ficha e contrato do mesmo CPF dividem os IDs anteriores: a lista nova
           vai também para os outros cadastros vivos do CPF. Devolve os que não
           foram gravados (mudaram em outro aparelho). */
        const espalharAnteriores = async (c: CadastroComId, lista: IdAnterior[]): Promise<string[]> => {
          const cpf = cpf11(c.registro.cpf);
          if (!cpf) return [];
          const falhas: string[] = [];
          for (const o of cadastros) {
            if ((o.colecao === c.colecao && o.id === c.id) || cpf11(o.registro.cpf) !== cpf) continue;
            // A lista do irmão nunca traz o ID de hoje dele (comAnteriores tira).
            const novo = comAnteriores({ ...o.registro }, juntarAnteriores(anterioresDe(o.registro), lista));
            if (idsAnteriores(novo).join() === idsAnteriores(o.registro).join()) continue;
            const r = await rpc("rh_gravar_seguro", {
              p_colecao: o.colecao, p_id: o.id, p_versao: o.versao, p_mutacao: null, p_apagar: false,
              p_registro: novo,
            });
            if (!r?.ok) falhas.push(`${o.colecao === "freelancers" ? "o contrato" : "a ficha"} de ${nomeDe(o)}`);
          }
          return falhas;
        };
        const avisoEspalhar = (falhas: string[]) => falhas.length
          ? `Os IDs anteriores não foram copiados para ${falhas.join(" e ")} (mudou em outro aparelho): faça de novo depois de atualizar a tela.`
          : "";
        const pedidoDoCadastro = () => {
          const colecao = String(body.colecao ?? ""), id = String(body.id ?? "");
          const valor = String(body.idPessoa ?? "").trim(), motivo = String(body.motivo ?? "").trim();
          if (!temIdGravavel(colecao) || !validarId(id)) return { erro: json({ erro: "Cadastro inválido." }, 400) };
          if (!idValido(valor)) return { erro: json({ erro: "O ID da pessoa tem exatamente 6 dígitos." }, 400) };
          if (motivo.length < 10 || motivo.length > 500) return { erro: json({ erro: `Escreva o motivo ${op === "trocar" ? "da troca" : op === "devolverId" ? "da devolução" : "do registro"} (de 10 a 500 letras): ele fica no histórico.` }, 400) };
          const c = cadastros.find((x) => x.colecao === colecao && x.id === id);
          if (!c) return { erro: json({ erro: "Cadastro não encontrado (ou apagado). Atualize a tela." }, 404) };
          return { colecao, id, valor, motivo, c };
        };
        const quemTemOId = (outro: CadastroComId & { anterior?: boolean }, id: string) =>
          `O ID ${id} ${outro.anterior || outro.apagado ? "já foi" : "já é"} de outra pessoa (${nomeDe(outro)}${outro.apagado ? ", cadastro apagado" : ""}${outro.anterior ? ", ID anterior dela" : ""}). Confira os dois cadastros antes.`;

        if (op === "previa") {
          return json({ itens: planejar(), total: cadastros.length, comId: cadastros.filter((c) => idGravado(c.registro)).length });
        }

        if (op === "preencher") {
          const pedidos = Array.isArray(body.itens) ? body.itens as Record<string, unknown>[] : null;
          const planoTodo = planejar();
          /* Quem a régua bloqueia (aparece na prévia como "pedem decisão") ganha a
             marca idPessoaBloqueado aqui, com a mesma confirmação: sem ela, o PCP
             calcularia pelo CPF o ID de outra pessoa (revisão do 80e7d8f). */
          const marcaveis = planoTodo.filter((p) => p.bloqueio && !p.idPessoa);
          if (!pedidos || (!pedidos.length && !marcaveis.length) || pedidos.length > 2000) return json({ erro: "Confira a lista antes de gravar." }, 400);
          const plano = new Map(planoTodo.filter((p) => p.idPessoa).map((p) => [`${p.colecao}::${p.id}`, p]));
          let gravados = 0;
          const pulados: { colecao: string; id: string; nome: string; motivo: string }[] = [];
          for (const ped of pedidos) {
            const colecao = String(ped?.colecao ?? ""), id = String(ped?.id ?? ""), idp = String(ped?.idPessoa ?? "");
            const p = plano.get(`${colecao}::${id}`);
            const c = cadastros.find((x) => x.colecao === colecao && x.id === id);
            if (!p || !c || p.idPessoa !== idp) {
              pulados.push({ colecao, id, nome: c ? nomeDe(c) : "", motivo: "o cadastro mudou depois da conferência" });
              continue;
            }
            const r = await rpc("rh_gravar_seguro", {
              p_colecao: colecao, p_id: id, p_versao: c.versao, p_mutacao: null, p_apagar: false,
              p_registro: semBloqueioComId({ ...c.registro, idPessoa: idp, idPessoaEm: agoraIso(), idPessoaPor: meuId, idPessoaMotivo: "Gravado pelo botão do admin (cadastros antigos)" }),
            });
            if (!r?.ok) { pulados.push({ colecao, id, nome: nomeDe(c), motivo: "o cadastro mudou em outro aparelho" }); continue; }
            gravados++;
          }
          let marcados = 0;
          for (const p of marcaveis) {
            const c = cadastros.find((x) => x.colecao === p.colecao && x.id === p.id);
            if (!c || idGravado(c.registro) || idBloqueado(c.registro) === p.bloqueio) continue;
            const r = await rpc("rh_gravar_seguro", {
              p_colecao: c.colecao, p_id: c.id, p_versao: c.versao, p_mutacao: null, p_apagar: false,
              p_registro: comBloqueio({ ...c.registro }, String(p.bloqueio)),
            });
            if (!r?.ok) { pulados.push({ colecao: c.colecao, id: c.id, nome: nomeDe(c), motivo: "o cadastro mudou em outro aparelho" }); continue; }
            marcados++;
          }
          const historico = gravados + marcados === 0 || await registrarNoHistorico({
            acao: "LOTE", recurso: "ID da pessoa", qtd: gravados + marcados,
            detalhe: `Gravou o ID da pessoa em ${gravados} cadastro${gravados === 1 ? "" : "s"} antigo${gravados === 1 ? "" : "s"} (fichas e contratos de freelancer), pelo botão do admin.${marcados ? ` Marcou ${marcados} sem ID (o ID do CPF é ou foi de outra pessoa).` : ""}`,
          });
          return json({ ok: true, gravados, marcados, pulados, ...(historico ? {} : { aviso: AVISO_SEM_HISTORICO }) });
        }

        if (op === "trocar") {
          const p = pedidoDoCadastro();
          if ("erro" in p) return p.erro;
          const { colecao, id, valor: novo, motivo, c } = p;
          const antes = idGravado(c.registro);
          if (antes === novo) return json({ erro: `O ID gravado já é ${novo}.` }, 409);
          const outro = outraPessoaComId(novo, cpf11(c.registro.cpf), c, regua);
          if (outro) return json({ erro: quemTemOId(outro, novo) }, 409);
          // O ID que sai fica com a pessoa: vai para os IDs anteriores (com a
          // data; o motivo fica só no histórico) e não é dado a mais ninguém.
          const agora = agoraIso();
          // A lista nunca traz o ID de hoje (voltar a um ID anterior o tira dela).
          // Sem ID gravado, o que sai é o ID que valia (o do CPF, sem a marca): o PCP
          // já usava esse ID nas O.S. (segunda revisão do 36a7427).
          const queValia = antes || idQueVale(colecao, c.registro);
          const anteriores = (queValia
            ? juntarAnteriores(anterioresDe(c.registro), [{ idPessoa: queValia, em: agora, por: meuId, como: "troca" }])
            : anterioresDe(c.registro)).filter((a) => a.idPessoa !== novo);
          const r = await rpc("rh_gravar_seguro", {
            p_colecao: colecao, p_id: id, p_versao: c.versao, p_mutacao: null, p_apagar: false,
            p_registro: comAnteriores({ ...c.registro, idPessoa: novo, idPessoaEm: agora, idPessoaPor: meuId, idPessoaMotivo: motivo }, anteriores),
          });
          if (!r?.ok) return json({ erro: "O cadastro mudou em outro aparelho. Atualize a tela e tente de novo." }, 409);
          const falhasIrmaos = queValia ? await espalharAnteriores(c, anteriores) : [];
          const historico = await registrarNoHistorico({
            acao: "ALTEROU", recurso: `${colecao === "freelancers" ? "Contrato de freelancer" : "Colaborador"}: ${nomeDe(c)}`,
            colecao, registroId: id, colaboradorId: colecao === "colaboradores" ? id : null,
            // Sem os valores (o ID sai do CPF, e o histórico chega a mais gente
            // que o CPF): fica que o ID foi trocado, quem, quando e o motivo.
            mudancas: [{ campo: "ID da pessoa", de: "•••", para: "•••" }], totalCampos: 1,
            detalhe: `ID da pessoa trocado pelo admin. Motivo: ${motivo}`,
          });
          // Ficha e contrato do mesmo CPF com IDs diferentes: o PCP avisa a
          // gestão até sobrar um só. A troca não mexe no outro sozinha.
          const cpf = cpf11(c.registro.cpf);
          const irmaos = cpf ? cadastros.filter((o) => !(o.colecao === colecao && o.id === id) && cpf11(o.registro.cpf) === cpf && idGravado(o.registro) && idGravado(o.registro) !== novo) : [];
          const avisos = [
            // A conta da Central (acesso_conta.id_pessoa) é gravada pelo Painel
            // a partir da ficha: ela só pega o ID novo quando a conta é salva de novo.
            colecao === "colaboradores" ? AVISO_CENTRAL_ID_NOVO : "",
            irmaos.length ? `${irmaos.map((o) => `${o.colecao === "freelancers" ? "O contrato" : "A ficha"} de ${nomeDe(o)}`).join(" e ")} tem o mesmo CPF e continua com outro ID: troque também, para a pessoa ter um ID só.` : "",
            avisoEspalhar(falhasIrmaos),
            historico ? "" : AVISO_SEM_HISTORICO,
          ].filter(Boolean);
          return json({ ok: true, idPessoa: novo, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) });
        }

        // O ID que a linha de arquivo segura: o gravado; sem ele, o do CPF (quem saiu antes do ID gravado).
        const idDoArquivo = (o: CadastroComId) => idGravado(o.registro) || cpfDoCadastro(o.colecao, o.registro).slice(0, 6);
        const arquivosDaLinha = (colecao: string, id: string) =>
          regua.filter((o) => o.apagado && o.colecao === colecao && o.registro.arquivadaDe === id && idDoArquivo(o));

        /* Quem estava na linha de arquivo desta ficha, para o admin comparar
           antes de devolver: nome, CPF mascarado e o ID (só o admin chama). */
        if (op === "arquivosDaLinha") {
          const colecao = String(body.colecao ?? ""), id = String(body.id ?? "");
          if (!temIdGravavel(colecao) || !validarId(id)) return json({ erro: "Cadastro inválido." }, 400);
          return json({ itens: arquivosDaLinha(colecao, id).map((o) => ({
            id: o.id, nome: nomeDe(o), cpf: cpfMascarado(o.registro.cpf), idPessoa: idDoArquivo(o),
            devolvido: !!o.registro.devolvidoA, saiuEm: String(o.registro.atualizadoEm ?? ""),
          })) });
        }

        if (op === "devolverId") {
          const p = pedidoDoCadastro();
          if ("erro" in p) return p.erro;
          if (body.mesmaPessoa !== true) return json({ erro: "Confirme que é a mesma pessoa do cadastro apagado desta linha." }, 400);
          const { colecao, id, valor, motivo, c } = p;
          // Só a linha de arquivo desta linha (a lápide que a pessoa ocupou ao voltar), com este ID.
          const daLinha = arquivosDaLinha(colecao, id).filter((o) => idDoArquivo(o) === valor);
          const pendentes = daLinha.filter((o) => !o.registro.devolvidoA);
          if (!daLinha.length) return json({ erro: `O ID ${valor} não está no cadastro apagado desta linha. Só o ID de quem saiu desta mesma linha pode ser devolvido.` }, 409);
          const antes = idGravado(c.registro);
          const jaDevolvido = antes === valor;
          if (jaDevolvido && !pendentes.length) return json({ erro: `O ID gravado já é ${valor}.` }, 409);
          /* Só para o cadastro que está SEM ID e marcado (a mesma pessoa que voltou
             e a régua não reconheceu): quem já tem o próprio ID não recebe o de
             quem saiu (revisão do 80e7d8f). A única exceção é repetir a devolução
             que gravou o ID e não marcou a linha de arquivo. */
          if (!jaDevolvido && (antes || !idBloqueado(c.registro))) {
            return json({ erro: antes
              ? `Este cadastro já tem o ID ${antes}: a devolução é só para quem voltou e ficou sem ID. Para trocar, use "trocar ID".`
              : "A devolução é só para o cadastro que ficou sem ID porque o ID do CPF era de outra pessoa. Grave o ID pelo botão das fichas antigas." }, 409);
          }
          // Quem mais tem (ou teve) o ID, fora as linhas de arquivo desta linha: recusa.
          const outro = outraPessoaComId(valor, cpf11(c.registro.cpf), c, regua.filter((o) => !daLinha.includes(o)));
          if (outro) return json({ erro: quemTemOId(outro, valor) }, 409);
          const agora = agoraIso();
          if (!jaDevolvido) {
            const anteriores = juntarAnteriores(
              anterioresDe(c.registro), ...daLinha.map((o) => anterioresDe(o.registro)),
              antes ? [{ idPessoa: antes, em: agora, por: meuId, como: "troca" }] : [],
            ).filter((a) => a.idPessoa !== valor);
            const r = await rpc("rh_gravar_seguro", {
              p_colecao: colecao, p_id: id, p_versao: c.versao, p_mutacao: null, p_apagar: false,
              p_registro: comAnteriores({ ...c.registro, idPessoa: valor, idPessoaEm: agora, idPessoaPor: meuId, idPessoaMotivo: motivo }, anteriores),
            });
            if (!r?.ok) return json({ erro: "O cadastro mudou em outro aparelho. Atualize a tela e tente de novo." }, 409);
          }
          // Depois do cadastro (nunca antes: o ID ficaria livre): a linha de arquivo
          // sai da régua, porque o ID e a lista dela moram agora no cadastro vivo.
          const falhasArquivo: string[] = [];
          for (const o of pendentes) {
            const r = await rpc("rh_gravar_seguro", {
              p_colecao: o.colecao, p_id: o.id, p_versao: 0, p_mutacao: null, p_apagar: false,
              p_registro: { ...o.registro, _apagado: true, devolvidoA: id, devolvidoEm: agora },
            });
            if (!r?.ok) falhasArquivo.push(o.id);
          }
          const historico = jaDevolvido || await registrarNoHistorico({
            acao: "ALTEROU", recurso: `${colecao === "freelancers" ? "Contrato de freelancer" : "Colaborador"}: ${nomeDe(c)}`,
            colecao, registroId: id, colaboradorId: colecao === "colaboradores" ? id : null,
            mudancas: [{ campo: "ID da pessoa", de: "•••", para: "•••" }], totalCampos: 1,
            detalhe: `ID da pessoa devolvido pelo admin: é a mesma pessoa do cadastro apagado desta linha. Motivo: ${motivo}`,
          });
          const avisos = [
            colecao === "colaboradores" && !jaDevolvido ? AVISO_CENTRAL_ID_NOVO : "",
            falhasArquivo.length ? "O ID foi devolvido, mas o cadastro apagado desta linha não foi marcado: faça a devolução de novo depois de atualizar a tela." : "",
            historico ? "" : AVISO_SEM_HISTORICO,
          ].filter(Boolean);
          return json({ ok: true, idPessoa: valor, ...(avisos.length ? { aviso: avisos.join(" ") } : {}) });
        }

        if (op === "registrarAnterior") {
          const p = pedidoDoCadastro();
          if ("erro" in p) return p.erro;
          const { colecao, id, valor: anterior, motivo, c } = p;
          const hoje = idGravado(c.registro);
          if (!hoje) return json({ erro: "Grave primeiro o ID de hoje deste cadastro; depois registre o anterior." }, 409);
          if (anterior === hoje) return json({ erro: `${anterior} é o ID de hoje deste cadastro, não um anterior.` }, 409);
          if (idsAnteriores(c.registro).includes(anterior)) return json({ erro: `O ID ${anterior} já está entre os IDs anteriores deste cadastro.` }, 409);
          const outro = outraPessoaComId(anterior, cpf11(c.registro.cpf), c, regua);
          if (outro) return json({ erro: quemTemOId(outro, anterior) }, 409);
          const anteriores = juntarAnteriores(anterioresDe(c.registro), [{ idPessoa: anterior, em: agoraIso(), por: meuId, como: "registro" }]);
          const r = await rpc("rh_gravar_seguro", {
            p_colecao: colecao, p_id: id, p_versao: c.versao, p_mutacao: null, p_apagar: false,
            p_registro: comAnteriores({ ...c.registro }, anteriores),
          });
          if (!r?.ok) return json({ erro: "O cadastro mudou em outro aparelho. Atualize a tela e tente de novo." }, 409);
          const falhasIrmaos = await espalharAnteriores(c, anteriores);
          const historico = await registrarNoHistorico({
            acao: "ALTEROU", recurso: `${colecao === "freelancers" ? "Contrato de freelancer" : "Colaborador"}: ${nomeDe(c)}`,
            colecao, registroId: id, colaboradorId: colecao === "colaboradores" ? id : null,
            // Como na troca: sem os valores do ID, só o fato, quem, quando e o motivo.
            mudancas: [{ campo: "IDs anteriores da pessoa", de: "•••", para: "•••" }], totalCampos: 1,
            detalhe: `ID anterior da pessoa registrado pelo admin. Motivo: ${motivo}`,
          });
          const avisos = [avisoEspalhar(falhasIrmaos), historico ? "" : AVISO_SEM_HISTORICO].filter(Boolean);
          return json({ ok: true, idPessoaAnteriores: anteriores.map((a) => a.idPessoa), ...(avisos.length ? { aviso: avisos.join(" ") } : {}) });
        }

        return json({ erro: "Operação desconhecida." }, 400);
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
        /* A CONFIG GLOBAL É LIDA POR QUALQUER UM QUE ENTRE — `getCfg` não
           confere papel, de propósito: nome da empresa, cores e vínculos
           precisam chegar em toda tela. Mas `lancamentosSocio` é DINHEIRO do
           sócio escrito à mão (rótulo, competência e valor), e ele saía inteiro
           para qualquer colaborador logado, junto com o resto.
           Contagem pode, dinheiro não: a chave sai da resposta para quem não é
           o master. Não é "esconder da tela" — a tela de Societárias já é só do
           master; é fechar a porta de dados, que é por onde se pega tudo. */
        return json({ config: data ? { config: podarConfig(data.config) } : null });
      }
      case "setCfg": {
        if (!ehAdmin) return json({ erro: "Configuração global é restrita ao RH." }, 403);
        // MESCLA por chave, nunca substitui a linha: cliente novo manda só o que
        // mudou (`patch`); cliente antigo ainda manda `config` inteira, e mesmo
        // ela entra mesclada — nunca apaga uma chave que só outro aparelho tem.
        const patch = (body.patch ?? body.config ?? null) as Record<string, unknown> | null;
        if (!patch || typeof patch !== "object" || Array.isArray(patch)) return json({ erro: "Patch de configuração inválido." }, 400);
        /* QUEM NÃO PODE LER TAMBÉM NÃO PODE GRAVAR. Como a leitura passou a
           omitir `lancamentosSocio`, um cliente antigo que devolvesse a config
           inteira APAGARIA os lançamentos do sócio sem querer — e um ADMIN_RH
           qualquer podia reescrevê-los de propósito. A chave é recusada em vez
           de descartada em silêncio: gravar "ok" sobre um pedido que não foi
           cumprido é como a tela passou a mentir das outras vezes. */
        if (!ehMaster && "lancamentosSocio" in patch) {
          return json({ erro: "Os lançamentos societários são do gestor master." }, 403);
        }
        const merged = await admin.rpc("rh_mesclar_config", { p_patch: patch });
        // `rh_mesclar_config` devolve a linha INTEIRA depois da mesclagem — por
        // isso a poda vale aqui também, nos dois caminhos.
        if (!merged.error) return json({ ok: true, config: podarConfig(merged.data) });
        // Sem a função no banco (migração ainda não aplicada): lê, mescla e grava.
        const { data: atual } = await admin.from("config_global").select("config").eq("id", true).maybeSingle();
        const config = { ...((atual?.config as Record<string, unknown> | null) ?? {}), ...patch };
        const { error } = await admin.from("config_global").upsert({ id: true, config, atualizado_em: new Date().toISOString() });
        if (error) throw new Error(error.message);
        return json({ ok: true, config: podarConfig(config) });
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
