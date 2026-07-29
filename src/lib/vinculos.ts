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
// ============================================================================
import { obter } from "@/lib/store";
import type { NomeColecao } from "@/data";

/** Coleções ligadas a uma pessoa por `colaboradorId`, com rótulo de gente. */
const POR_COLABORADOR: { colecao: NomeColecao; rotulo: string }[] = [
  { colecao: "pagamentos", rotulo: "pagamento(s) da folha" },
  { colecao: "documentos", rotulo: "documento(s)" },
  { colecao: "ferias", rotulo: "período(s) de férias" },
  { colecao: "movimentacoes", rotulo: "movimentação(ões) de carreira" },
  { colecao: "avaliacoes", rotulo: "avaliação(ões)" },
  { colecao: "metas", rotulo: "meta(s)" },
  { colecao: "pdis", rotulo: "PDI(s)" },
  { colecao: "feedbacks", rotulo: "feedback(s)" },
  { colecao: "viagens", rotulo: "viagem(ns)" },
  { colecao: "tarefas", rotulo: "tarefa(s)" },
  { colecao: "aceites", rotulo: "aceite(s) de termo" },
  { colecao: "consentimentos", rotulo: "consentimento(s) LGPD" },
  { colecao: "advertencias", rotulo: "advertência(s)" },
  { colecao: "ausencias", rotulo: "falta(s)/ausência(s)" },
  { colecao: "contatos", rotulo: "contato(s)" },
  { colecao: "treinamentos", rotulo: "treinamento(s)" },
  { colecao: "evolucao", rotulo: "etapa(s) de evolução" },
  { colecao: "certificacoesNr", rotulo: "certificação(ões) de NR" },
  { colecao: "usuarios", rotulo: "acesso(s) ao sistema" },
  { colecao: "respostasPesquisa", rotulo: "resposta(s) de pesquisa" },
  { colecao: "candidatos", rotulo: "candidatura(s) a vaga" },
  { colecao: "acessos", rotulo: "registro(s) de auditoria" },
];

export interface Vinculo { colecao: NomeColecao; rotulo: string; quantidade: number }
export interface Vinculos {
  itens: Vinculo[];
  total: number;
  /** Pessoas que apontam para esta como gestor. */
  subordinados: number;
  /** Pessoas que apontam para esta como padrinho na integração. */
  afilhados: number;
}

/** Tudo que depende desta pessoa hoje. */
export function vinculosDoColaborador(id: string): Vinculos {
  const itens: Vinculo[] = [];
  for (const { colecao, rotulo } of POR_COLABORADOR) {
    const regs = obter(colecao) as unknown as { colaboradorId?: string | null }[];
    const quantidade = Array.isArray(regs) ? regs.filter((r) => r?.colaboradorId === id).length : 0;
    if (quantidade > 0) itens.push({ colecao, rotulo, quantidade });
  }
  const colabs = obter("colaboradores") as unknown as { gestorId?: string | null; padrinhoId?: string | null }[];
  return {
    itens,
    total: itens.reduce((s, i) => s + i.quantidade, 0),
    subordinados: colabs.filter((c) => c?.gestorId === id).length,
    afilhados: colabs.filter((c) => c?.padrinhoId === id).length,
  };
}

/** Frase curta para o aviso: "593 pagamentos da folha, 12 documentos e mais 3 tipos". */
export function resumirVinculos(v: Vinculos, maxTipos = 3): string {
  if (v.total === 0) return "";
  const ordenados = [...v.itens].sort((a, b) => b.quantidade - a.quantidade);
  const mostra = ordenados.slice(0, maxTipos).map((i) => `${i.quantidade} ${i.rotulo}`);
  const resto = ordenados.length - mostra.length;
  return resto > 0 ? `${mostra.join(", ")} e mais ${resto} tipo(s) de registro` : mostra.join(", ");
}
