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
// ele sai. Sem nada em foco, aparece TUDO.
//
// "Férias" já nasceu fora da vista padrão, por encher o quadro. Isso caiu: com
// o clique focando, um selo desligado em repouso parece travado — e foi
// exatamente assim que soou para quem usa ("o botão de férias está apertado").
// Num modelo em que o clique escolhe o que ver, todo selo tem de começar igual.
// ============================================================================

/** Está aparecendo no quadro agora? Sem foco, tudo aparece. */
export function visivel(tipo: string, foco: ReadonlySet<string>): boolean {
  return foco.size === 0 || foco.has(tipo);
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
