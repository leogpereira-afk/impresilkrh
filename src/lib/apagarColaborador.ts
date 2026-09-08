// Apagar um cadastro e TUDO que está pendurado nele.
//
// Pedido do Léo (07/09/2026): "adicionar botão apagar cadastro e eliminar todos
// os dados do sistema, e colocar um botão antes: certo que vai apagar?".
//
// O perigo aqui não é o clique — é o clique sem saber o tamanho. Uma ficha do
// RH carrega folha, documentos, férias, ponto, feedbacks, advertências,
// treinamentos, avaliações. Apagar "um cadastro" pode ser apagar 73 lançamentos
// de dinheiro e o histórico inteiro de uma pessoa. Por isso este arquivo existe:
// ele CONTA antes, para a pergunta "certo que vai apagar?" vir com o número na
// frente em vez de um "tem certeza?" que ninguém lê.
//
// A lição que está por trás: em outra tela, "limpar o não-ativo" apagou 387
// registros arquivados e o dono só descobriu quando abriu o histórico e não
// achou nada. Contar antes é o que impede isso.
//
// Nada aqui apaga. Este módulo só INVENTARIA e diz o que fazer; quem executa é
// a tela, com o clique da pessoa.

// A LISTA NÃO MORA MAIS AQUI (07/09/2026). A cópia à mão que ficava neste
// arquivo divergia das outras duas em três pontos, e cada um era um defeito:
//
//   - listava `agendamentos`, que NÃO tem `colaboradorId` — item morto, nunca
//     contou nada;
//   - não conhecia `usuarios` nem `candidatos` — apagar pela ficha deixava a
//     CONTA DE LOGIN viva apontando para um id morto (login que entra e tela
//     que não acha o nome) e a candidatura interna órfã;
//   - listava `acessos` como registro DA PESSOA, então o botão apagava a
//     trilha de auditoria — append-only por desenho — e ainda mandava lápide
//     para a nuvem. De quebra, as 3 a 10 linhas de trilha de uma ficha
//     repetida entravam no total e faziam uma ficha VAZIA exigir digitar o
//     nome, com o aviso "Somem 10 registro(s)" — número falso.
//
// Agora vem de lib/cadastrosDuplicados.ts, conferida contra data/types.ts por
// teste. Aqui ficam só os rótulos e as regras de aviso.
export { COLECOES_DA_PESSOA, COLECOES_TRILHA, COLECOES_CONTA } from "./cadastrosDuplicados";
import { COLECOES_DA_PESSOA, COLECOES_TRILHA, COLECOES_CONTA } from "./cadastrosDuplicados";

/** Nome que a pessoa lê, por coleção. "pdis" não diz nada a ninguém. */
export const ROTULO_COLECAO: Record<string, string> = {
  pagamentos: "lançamentos de folha",
  documentos: "documentos",
  movimentacoes: "movimentações de carreira",
  ferias: "períodos de férias",
  ausencias: "ausências",
  pontos: "registros de ponto",
  treinamentos: "treinamentos",
  avaliacoes: "avaliações",
  metas: "metas",
  pdis: "planos de desenvolvimento",
  advertencias: "advertências",
  certificacoesNr: "certificações de NR",
  feedbacks: "feedbacks",
  aceites: "aceites de política e código de ética",
  consentimentos: "consentimentos (LGPD)",
  evolucao: "etapas de evolução",
  tarefas: "tarefas",
  fechamentos: "fechamentos de folha variável",
  lancamentos: "lançamentos de folha variável",
  viagens: "viagens",
  contatos: "contatos de emergência",
  respostasPesquisa: "respostas de pesquisa",
  candidatos: "candidaturas a vaga",
  usuarios: "contas de acesso ao sistema",
  acessos: "registros de acesso (trilha)",
  alteracoes: "linhas de histórico (trilha)",
};

export interface LinhaDoInventario {
  colecao: string;
  rotulo: string;
  quantidade: number;
  /** Registros que carregam VALOR em R$ — o que dói mais perder. */
  temDinheiro: boolean;
}

export interface QuemAponta {
  id: string;
  nome: string;
  /** Como esta pessoa aponta para quem vai ser apagado. */
  papel: "gestor" | "padrinho";
}

export interface InventarioDaPessoa {
  colaboradorId: string;
  nome: string;
  linhas: LinhaDoInventario[];
  total: number;
  /** Quantos registros carregam dinheiro (folha, folha variável, viagens). */
  totalComDinheiro: number;
  /**
   * Gente que aponta para esta pessoa como gestor ou padrinho. Apagar sem
   * tratar deixa essas fichas com um chefe que não existe — e o <select> da
   * tela passa a exibir a PRIMEIRA opção da lista enquanto o dado gravado
   * continua o id morto: a ficha mostrando um chefe e o cadastro guardando
   * outro.
   */
  apontamPraEla: QuemAponta[];
  /**
   * Trilha (auditoria e histórico): NÃO é apagada. Fica apontando para o id
   * que saiu — é assim que se guarda o que aconteceu. Aparece no aviso como
   * "fica", nunca como "some", e não entra no `total`.
   */
  trilha: LinhaDoInventario[];
  /**
   * Contas de login desta pessoa. Impedimento, não aviso: apagar a ficha
   * deixaria a conta apontando para um id morto.
   */
  contas: LinhaDoInventario[];
}

/** Coleções cujos registros têm valor em dinheiro. */
const COM_DINHEIRO = new Set(["pagamentos", "lancamentos", "fechamentos", "viagens"]);

type Registro = { colaboradorId?: string | null; ativo?: boolean };
type Pessoa = { id: string; nome: string; gestorId?: string | null; padrinhoId?: string | null };

/**
 * O que some junto com a ficha. Só CONTA — não apaga nada.
 *
 * `porColecao` é o que a tela já tem em memória: nome da coleção → registros.
 * Coleção que não vier no mapa simplesmente não entra no inventário (some da
 * lista em vez de aparecer com zero, que é ruído).
 */
export function inventarioDaPessoa(
  colaboradorId: string,
  nome: string,
  porColecao: Record<string, Registro[] | undefined>,
  colaboradores: Pessoa[] = [],
): InventarioDaPessoa {
  const linhas: LinhaDoInventario[] = [];
  for (const colecao of COLECOES_DA_PESSOA) {
    const itens = porColecao[colecao];
    if (!itens) continue;
    const quantidade = itens.filter((r) => r?.colaboradorId === colaboradorId).length;
    if (quantidade === 0) continue;
    linhas.push({
      colecao,
      rotulo: ROTULO_COLECAO[colecao] ?? colecao,
      quantidade,
      temDinheiro: COM_DINHEIRO.has(colecao),
    });
  }
  // Do maior para o menor: o número que assusta tem de estar no topo.
  linhas.sort((a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo, "pt-BR"));

  // Trilha e conta de login contadas à parte — nem somem nem entram no total.
  const contarFora = (colecoes: readonly string[]): LinhaDoInventario[] => {
    const fora: LinhaDoInventario[] = [];
    for (const colecao of colecoes) {
      // Conta DESATIVADA não entra: senão o aviso "desative a conta antes"
      // vira beco sem saída — desativar marca `ativo: false` e não apaga a
      // linha, e a ficha nunca mais poderia ser apagada.
      const quantidade = (porColecao[colecao] ?? [])
        .filter((r) => r?.colaboradorId === colaboradorId && r?.ativo !== false).length;
      if (quantidade > 0) fora.push({ colecao, rotulo: ROTULO_COLECAO[colecao] ?? colecao, quantidade, temDinheiro: false });
    }
    return fora;
  };

  const apontamPraEla: QuemAponta[] = [];
  for (const c of colaboradores) {
    if (c.id === colaboradorId) continue;
    if (c.gestorId === colaboradorId) apontamPraEla.push({ id: c.id, nome: c.nome, papel: "gestor" });
    if (c.padrinhoId === colaboradorId) apontamPraEla.push({ id: c.id, nome: c.nome, papel: "padrinho" });
  }
  apontamPraEla.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    colaboradorId,
    nome,
    linhas,
    total: linhas.reduce((s, l) => s + l.quantidade, 0),
    totalComDinheiro: linhas.filter((l) => l.temDinheiro).reduce((s, l) => s + l.quantidade, 0),
    apontamPraEla,
    trilha: contarFora(COLECOES_TRILHA),
    contas: contarFora(COLECOES_CONTA),
  };
}

/**
 * A frase que o diálogo mostra. Sai daqui, e não da tela, para poder ser testada
 * — é o texto que decide se a pessoa entende o tamanho do que está fazendo.
 */
export function resumoDoQueSome(inv: InventarioDaPessoa): string {
  if (inv.total === 0) return "Esta ficha não tem nenhum registro pendurado nela — some só o cadastro.";
  const maiores = inv.linhas.slice(0, 3).map((l) => `${l.quantidade} ${l.rotulo}`);
  const resto = inv.linhas.length - maiores.length;
  const lista = maiores.join(", ") + (resto > 0 ? ` e mais ${resto} tipo(s)` : "");
  const dinheiro = inv.totalComDinheiro > 0
    ? ` ${inv.totalComDinheiro} desses registros carregam valor em dinheiro.`
    : "";
  return `Somem ${inv.total} registro(s): ${lista}.${dinheiro}`;
}

/**
 * A conta de login segura a exclusão.
 *
 * Sem isto, apagar a ficha deixava a linha de `usuarios` apontando para um id
 * morto: a pessoa continua entrando no sistema e nenhuma tela acha o nome
 * dela. A aba Cadastros já barrava; a ficha ignorava. Duas portas para o mesmo
 * ato davam respostas diferentes.
 */
export function impedimentoParaApagar(inv: InventarioDaPessoa): string | null {
  const contas = inv.contas.reduce((s, l) => s + l.quantidade, 0);
  if (contas === 0) return null;
  return `${contas} conta(s) de acesso ao sistema apontam para esta ficha — desative em Painel de Controle → Usuários e Permissões antes de apagar.`;
}

/** Vale exigir que a pessoa digite algo para confirmar? */
export function exigeDigitarProva(inv: InventarioDaPessoa): boolean {
  // Ficha com dinheiro ou com histórico grande não pode sair num clique de
  // reflexo. Ficha vazia (recadastro duplicado) não merece esse atrito.
  return inv.totalComDinheiro > 0 || inv.total >= 10;
}

/**
 * A prova que se digita para apagar é o ID, não o nome.
 *
 * Era o nome, e o nome NÃO PROVA NADA justamente no caso em que este botão mais
 * é usado: ficha repetida. Há três fichas "José Adilando Pereira" e três
 * "Dermeval Vieira" no cadastro — quem abre a errada e digita o nome passa na
 * conferência igualzinho, e o clique apaga os 31 pagamentos da ficha boa. O id
 * é o que distingue uma da outra ("jose-adilando-pereira" ×
 * "jose-adilando-pereira-2"), e é a regra da casa: id manda, nome só exibe.
 *
 * Continua tolerante com espaço sobrando e caixa — o que não dá é aceitar uma
 * coisa por outra.
 */
export function provaConfere(digitado: string, colaboradorId: string): boolean {
  const n = (s: string) => String(s ?? "").trim().toLowerCase();
  return n(digitado) !== "" && n(digitado) === n(colaboradorId);
}
