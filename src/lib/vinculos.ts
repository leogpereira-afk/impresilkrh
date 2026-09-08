// ============================================================================
// O que está pendurado numa pessoa.
//
// Excluir um colaborador apagava só a ficha dele — a folha, os documentos, as
// férias, as avaliações e o resto continuavam no sistema apontando para um id
// que não existe mais. Esses registros órfãos não aparecem em tela nenhuma
// (todas buscam o nome pelo id), mas seguem contando nos totais e ocupando a
// nuvem. E o aviso de exclusão dizia só "remover do organograma", sem informar
// que a pessoa inteira seria apagada.
//
// Aqui a gente conta tudo que depende de uma pessoa, para a tela poder mostrar
// antes de apagar — e para oferecer o caminho certo: DESLIGAR quem tem
// histórico, em vez de apagar.
//
// A LISTA NÃO MORA MAIS AQUI (07/09/2026). Havia três cópias à mão do "que
// está pendurado numa pessoa" — esta, a de apagarColaborador.ts e a de
// cadastrosDuplicados.ts — e as três divergiam em silêncio, que é o defeito
// da "lista copiada". Esta não conhecia `pontos`, `lancamentos`, `fechamentos`
// nem `alteracoes`: alguém cujo histórico fosse só ponto do Secullum e verba
// de folha variável (dinheiro!) aparecia no Organograma como ficha VAZIA, com
// o aviso "não tem nenhum registro no sistema", e o clique apagava de vez.
// Agora a lista vem de lib/cadastrosDuplicados.ts, que é conferida contra
// data/types.ts por teste. Aqui ficam só os rótulos e a contagem.
// ============================================================================
import { obter } from "@/lib/store";
import { COLECOES_DA_PESSOA, COLECOES_TRILHA, COLECOES_CONTA } from "@/lib/cadastrosDuplicados";
import type { NomeColecao } from "@/data";

/** Nome que a pessoa lê. Coleção sem rótulo aqui aparece pelo próprio nome. */
const ROTULO: Record<string, string> = {
  pagamentos: "pagamento(s) da folha",
  lancamentos: "lançamento(s) de folha variável",
  fechamentos: "fechamento(s) de folha variável",
  pontos: "mês(es) de ponto",
  documentos: "documento(s)",
  ferias: "período(s) de férias",
  movimentacoes: "movimentação(ões) de carreira",
  avaliacoes: "avaliação(ões)",
  metas: "meta(s)",
  pdis: "PDI(s)",
  feedbacks: "feedback(s)",
  viagens: "viagem(ns)",
  tarefas: "tarefa(s)",
  aceites: "aceite(s) de termo",
  consentimentos: "consentimento(s) LGPD",
  advertencias: "advertência(s)",
  ausencias: "falta(s)/ausência(s)",
  contatos: "contato(s)",
  treinamentos: "treinamento(s)",
  evolucao: "etapa(s) de evolução",
  certificacoesNr: "certificação(ões) de NR",
  respostasPesquisa: "resposta(s) de pesquisa",
  candidatos: "candidatura(s) a vaga",
  acessos: "registro(s) de auditoria",
  alteracoes: "linha(s) de histórico",
  usuarios: "acesso(s) ao sistema",
};

export interface Vinculo { colecao: NomeColecao; rotulo: string; quantidade: number }
export interface Vinculos {
  itens: Vinculo[];
  /**
   * Registros DA PESSOA (folha, documentos, férias…). É o número que decide
   * entre desligar e apagar: é o trabalho que se perde.
   *
   * NÃO inclui trilha. Uma ficha repetida criada por engano tem 3 a 10 linhas
   * em `acessos` só porque alguém abriu a ficha uma vez — contar isso como
   * "histórico" trancava a limpeza das duplicatas do José Adilando e do
   * Demerval, que não têm mais nada.
   */
  total: number;
  /** Trilha (auditoria e histórico): append-only, não se apaga nem se transfere. */
  trilha: number;
  /** Contas de login apontando para esta ficha. */
  contas: number;
  /** Pessoas que apontam para esta como gestor. */
  subordinados: number;
  /** Pessoas que apontam para esta como padrinho na integração. */
  afilhados: number;
}

function contar(colecoes: readonly string[], id: string): Vinculo[] {
  const itens: Vinculo[] = [];
  for (const colecao of colecoes) {
    const regs = obter(colecao as NomeColecao) as unknown as { colaboradorId?: string | null }[];
    const quantidade = Array.isArray(regs) ? regs.filter((r) => r?.colaboradorId === id).length : 0;
    if (quantidade > 0) itens.push({ colecao: colecao as NomeColecao, rotulo: ROTULO[colecao] ?? colecao, quantidade });
  }
  return itens;
}

/** Tudo que depende desta pessoa hoje. */
export function vinculosDoColaborador(id: string): Vinculos {
  const daPessoa = contar(COLECOES_DA_PESSOA, id);
  const trilha = contar(COLECOES_TRILHA, id);
  const contas = contar(COLECOES_CONTA, id);
  const colabs = obter("colaboradores") as unknown as { gestorId?: string | null; padrinhoId?: string | null }[];
  const soma = (v: Vinculo[]) => v.reduce((s, i) => s + i.quantidade, 0);
  return {
    // A lista mostrada traz tudo — inclusive a trilha, que a pessoa tem o
    // direito de ver antes de decidir; o que muda é o que ENTRA no `total`.
    itens: [...daPessoa, ...contas, ...trilha],
    total: soma(daPessoa),
    trilha: soma(trilha),
    contas: soma(contas),
    subordinados: colabs.filter((c) => c?.gestorId === id).length,
    afilhados: colabs.filter((c) => c?.padrinhoId === id).length,
  };
}

/** Frase curta para o aviso: "593 pagamentos da folha, 12 documentos e mais 3 tipos". */
export function resumirVinculos(v: Vinculos, maxTipos = 3): string {
  if (v.itens.length === 0) return "";
  const ordenados = [...v.itens].sort((a, b) => b.quantidade - a.quantidade);
  const mostra = ordenados.slice(0, maxTipos).map((i) => `${i.quantidade} ${i.rotulo}`);
  const resto = ordenados.length - mostra.length;
  return resto > 0 ? `${mostra.join(", ")} e mais ${resto} tipo(s) de registro` : mostra.join(", ");
}
