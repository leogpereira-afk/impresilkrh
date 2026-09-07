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

/** Coleções que guardam registros de UMA pessoa, por `colaboradorId`. */
export const COLECOES_DA_PESSOA = [
  "pagamentos", "documentos", "movimentacoes", "ferias", "ausencias", "pontos",
  "treinamentos", "avaliacoes", "metas", "pdis", "advertencias", "certificacoesNr",
  "feedbacks", "aceites", "consentimentos", "evolucao", "tarefas", "agendamentos",
  "fechamentos", "lancamentos", "viagens", "contatos", "respostasPesquisa", "acessos",
] as const;
export type ColecaoDaPessoa = (typeof COLECOES_DA_PESSOA)[number];

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
  agendamentos: "agendamentos",
  fechamentos: "fechamentos de folha variável",
  lancamentos: "lançamentos de folha variável",
  viagens: "viagens",
  contatos: "contatos de emergência",
  respostasPesquisa: "respostas de pesquisa",
  acessos: "registros de acesso",
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
}

/** Coleções cujos registros têm valor em dinheiro. */
const COM_DINHEIRO = new Set(["pagamentos", "lancamentos", "fechamentos", "viagens"]);

type Registro = { colaboradorId?: string | null };
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

/** Vale exigir que a pessoa digite o nome para confirmar? */
export function exigeDigitarNome(inv: InventarioDaPessoa): boolean {
  // Ficha com dinheiro ou com histórico grande não pode sair num clique de
  // reflexo. Ficha vazia (recadastro duplicado) não merece esse atrito.
  return inv.totalComDinheiro > 0 || inv.total >= 10;
}

/** Confere o que a pessoa digitou contra o nome, sem implicar com acento e caixa. */
export function nomeConfere(digitado: string, nome: string): boolean {
  const n = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  return n(digitado) !== "" && n(digitado) === n(nome);
}
