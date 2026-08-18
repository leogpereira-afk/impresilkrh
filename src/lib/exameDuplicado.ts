// ============================================================================
// DOIS EXAMES IGUAIS PARA A MESMA PESSOA.
//
// Medido em 10/08/2026: uma pessoa tinha TRÊS "Exame Periódico" com o mesmo
// vencimento (16/01/2027). Ninguém criou registro duplicado — eles convergiram:
// um era ASO e virou "Exame Periódico" numa edição, e outro teve a data movida
// para a mesma. O log de auditoria mostra as duas edições, com hora e autor.
//
// O sistema aceitou as duas caladas. Quem edita não vê a lista inteira daquela
// pessoa na hora de salvar, então não tem como perceber que acabou de criar uma
// terceira linha idêntica — e depois a tela parece "duplicada por bug".
//
// Esta função não impede nada: ela devolve o conflito para a tela AVISAR. Há
// motivo legítimo para duas linhas parecidas (2ª via, exame refeito), então
// quem decide é quem está olhando.
// ============================================================================

export interface ExameLike {
  id: string;
  colaboradorId?: string | null;
  categoria?: string | null;
  dataVencimento?: string | null;
}

const dia = (v?: string | null) => (v ?? "").slice(0, 10);

/**
 * Já existe outro exame da MESMA pessoa, com a MESMA categoria e o MESMO
 * vencimento? Devolve o primeiro encontrado, ou null.
 *
 * `alvo.id` é ignorado na busca: editar um registro não pode acusar conflito
 * consigo mesmo, senão salvar duas vezes seguidas passa a reclamar.
 */
export function exameDuplicado<T extends ExameLike>(
  existentes: readonly T[],
  alvo: ExameLike,
): T | null {
  const colab = alvo.colaboradorId;
  const cat = (alvo.categoria ?? "").trim();
  const venc = dia(alvo.dataVencimento);
  // Sem os três não há como afirmar que é o mesmo exame.
  if (!colab || !cat || !venc) return null;
  return existentes.find((e) =>
    e.id !== alvo.id
    && e.colaboradorId === colab
    && (e.categoria ?? "").trim() === cat
    && dia(e.dataVencimento) === venc,
  ) ?? null;
}

/** Quantos exames iguais a pessoa já tem, contando o alvo. */
export function quantosIguais<T extends ExameLike>(
  existentes: readonly T[],
  alvo: ExameLike,
): number {
  const colab = alvo.colaboradorId;
  const cat = (alvo.categoria ?? "").trim();
  const venc = dia(alvo.dataVencimento);
  if (!colab || !cat || !venc) return 0;
  const outros = existentes.filter((e) =>
    e.id !== alvo.id
    && e.colaboradorId === colab
    && (e.categoria ?? "").trim() === cat
    && dia(e.dataVencimento) === venc,
  ).length;
  return outros + 1;
}

// ============================================================================
// QUEM NÃO TEM EXAME NENHUM.
//
// A tela de SST contava EXAMES — total, válidos, a vencer, vencidos — e nunca
// contava PESSOAS. Quem não tem exame não tem linha, então não aparecia em
// nenhum dos quatro números: ficava invisível justamente por estar no pior
// estado possível.
//
// Medido na base real em 18/08/2026: 9 das 33 pessoas do quadro não tinham
// nenhum ASO nem exame periódico. Nada na tela dizia isso.
//
// É o mesmo erro que a tela de Feedback tinha: contar o que existe e deixar a
// ausência fora da conta. A ausência é a informação.
// ============================================================================

/** As categorias que valem como exame ocupacional. */
export const CATEGORIAS_EXAME = ["ASO", "Exame Periódico"] as const;

export interface PessoaLike { id: string }

/**
 * Do grupo informado, quem não tem NENHUM exame ocupacional.
 *
 * Recebe as pessoas já filtradas por quem chama (quadro, escopo do gestor):
 * decidir aqui quem "conta" esconderia a regra num canto onde ninguém procura.
 */
export function semExameOcupacional<P extends PessoaLike, D extends ExameLike>(
  pessoas: readonly P[],
  documentos: readonly D[],
): P[] {
  const cats = new Set<string>(CATEGORIAS_EXAME);
  const comExame = new Set(
    documentos
      .filter((x) => cats.has((x.categoria ?? "").trim()) && x.colaboradorId)
      .map((x) => x.colaboradorId as string),
  );
  return pessoas.filter((p) => !comExame.has(p.id));
}
