// ============================================================================
// O QUE A LEGENDA DO CALENDÁRIO FAZ AO SER CLICADA.
//
// Era o avesso do que se espera: tudo aparecia e clicar ESCONDIA aquele tipo.
// Para ver só os aniversários era preciso clicar em onze selos, um por um — e
// depois clicar nos mesmos onze para voltar. Ninguém faz isso; na prática o
// filtro não era usado.
//
// Agora clicar é FOCAR: clicou em "Aniversário", vê só aniversário. Clicou
// também em "Pagamento", vê os dois. Clicou de novo num que já está em foco,
// ele sai. Sem nada em foco, volta a vista padrão.
//
// A vista padrão não é "tudo": "Férias" (o período de gozo) nasce fora, porque
// com ~90 pessoas ele enche o quadro e some com o resto. Focar nele continua
// possível — e agora é até mais fácil do que era.
// ============================================================================

/** Está aparecendo no quadro agora? */
export function visivel(
  tipo: string,
  foco: ReadonlySet<string>,
  ocultosPorPadrao: ReadonlySet<string> = new Set(),
): boolean {
  // Com foco, só o que está em foco — inclusive um tipo oculto por padrão, que
  // é justamente o jeito de enxergá-lo.
  if (foco.size > 0) return foco.has(tipo);
  return !ocultosPorPadrao.has(tipo);
}

/**
 * O clique num selo. Devolve SEMPRE um Set novo — o React compara por
 * identidade, e mutar o antigo não redesenha a tela.
 */
export function alternarFoco(foco: ReadonlySet<string>, tipo: string): Set<string> {
  const novo = new Set(foco);
  if (novo.has(tipo)) novo.delete(tipo);
  else novo.add(tipo);
  return novo;
}

/**
 * Tira do foco um tipo que deixou de existir (foi apagado da configuração).
 *
 * Sem isto, apagar um tipo que estava em foco deixava o quadro filtrado por um
 * nome que não está mais em selo nenhum: nada aparecia e não havia onde clicar
 * para desfazer.
 */
export function esquecerTipo(foco: ReadonlySet<string>, tipo: string): Set<string> {
  if (!foco.has(tipo)) return foco as Set<string>;
  const novo = new Set(foco);
  novo.delete(tipo);
  return novo;
}
