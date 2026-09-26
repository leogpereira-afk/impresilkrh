/* O que a agenda lateral do Calendário mostra.
 *
 * Pedido do Léo (26/09/2026): "ir só ficando do dia atual pra frente, a que
 * for passando vai subindo". No MÊS ATUAL a lista começa hoje; o que já passou
 * sai do topo -- mas não some: a tela oferece "ver os que já passaram".
 *
 * Fora do mês atual não há "hoje" para cortar: quem navega para outro mês quer
 * ver aquele mês inteiro. E dia clicado no quadro mostra aquele dia, mesmo que
 * já tenha passado -- clicar num dia é pedir exatamente ele.
 */
export interface Separada<T> {
  /** O que aparece de cara: de hoje em diante (ou tudo, fora do mês atual). */
  aVista: T[];
  /** O que já passou neste mês, guardado atrás de um botão. */
  passados: T[];
}

export function separarAgenda<T extends { dia: number }>(
  itens: T[],
  ano: number,
  mes: number,
  diaSelecionado: number | null,
  hoje: Date,
): Separada<T> {
  if (diaSelecionado !== null) return { aVista: itens.filter((i) => i.dia === diaSelecionado), passados: [] };
  const ehMesAtual = ano === hoje.getFullYear() && mes === hoje.getMonth();
  if (!ehMesAtual) return { aVista: itens, passados: [] };
  const d = hoje.getDate();
  return { aVista: itens.filter((i) => i.dia >= d), passados: itens.filter((i) => i.dia < d) };
}
