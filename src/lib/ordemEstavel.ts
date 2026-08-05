// ============================================================================
// ORDEM QUE NÃO MUDA DEBAIXO DO CLIQUE.
//
// O checklist de Integração ordenava os cartões por "mais pendências primeiro",
// recalculado a cada render. Marcar um item diminui as pendências daquela
// pessoa — e o cartão PULA de lugar no meio da interação.
//
// Medido em produção em 05/08/2026: Candida e Victor estavam empatados em 12
// pendências. Marcar UM documento na Candida a levava para 11, ela caía para
// baixo do Victor e os dois trocavam de posição na grade. Quem clicou continuava
// olhando para o mesmo ponto da tela — agora ocupado pelo cartão de OUTRA
// pessoa, onde aquele documento não está marcado. O relato foi exatamente esse:
// "você seleciona e ele não seleciona e retira os que estão selecionados".
//
// A regra "mais pendências primeiro" continua valendo: ela é boa para saber por
// onde começar. Só deixa de ser recalculada enquanto a pessoa trabalha — a
// ordem é decidida quando a LISTA muda (alguém entra ou sai), não quando um
// número dentro dela muda.
// ============================================================================

export interface ItemOrdenavel {
  id: string;
  /** Quanto falta — o critério de triagem. */
  abertas: number;
  /** Desempate estável. */
  nome: string;
}

/**
 * Devolve a ordem dos ids.
 *
 * `anterior` é a ordem que já estava na tela. Quem já estava fica onde estava
 * (na mesma ordem relativa); quem chegou entra ordenado pelo critério; quem
 * saiu some. Com `anterior` vazio — primeira renderização — tudo é ordenado
 * pelo critério, que é o comportamento desejado ao abrir a tela.
 */
export function ordemEstavel(itens: ItemOrdenavel[], anterior: string[] = []): string[] {
  const presentes = new Set(itens.map((i) => i.id));

  // Quem já estava, na ordem em que estava (descartando quem saiu).
  const mantidos = anterior.filter((id) => presentes.has(id));
  const jaTem = new Set(mantidos);

  // Quem chegou agora entra pelo critério de triagem.
  const novos = itens
    .filter((i) => !jaTem.has(i.id))
    .sort((a, b) => (b.abertas - a.abertas) || a.nome.localeCompare(b.nome))
    .map((i) => i.id);

  return [...mantidos, ...novos];
}

/** Aplica a ordem a uma lista de objetos que têm `id`. */
export function aplicarOrdem<T extends { id: string }>(itens: T[], ordem: string[]): T[] {
  const porId = new Map(itens.map((i) => [i.id, i]));
  const saida: T[] = [];
  for (const id of ordem) {
    const it = porId.get(id);
    if (it) {
      saida.push(it);
      porId.delete(id);
    }
  }
  // Rede de segurança: nada pode sumir da tela por causa da ordenação.
  for (const resto of porId.values()) saida.push(resto);
  return saida;
}
