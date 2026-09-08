// Quando a busca no Mubisys ACABOU — e quando ela só parece ter acabado.
//
// A régua antiga era "a página veio com menos que o pedido ⇒ era a última".
// Isso vale quando a API declara a paginação; sem declaração, é palpite — e o
// palpite encerrava a varredura em silêncio, com `truncado: false` na resposta.
//
// O estrago apareceu em 08/09/2026 no plano de contas: julho, agosto e
// setembro/2026 vieram com 120, 120 e 80 contas e NENHUMA conta de folha,
// enquanto os mesmos meses tinham ~110 títulos de salário, hora extra e diária
// vencendo. A tela mostrava "Individual R$ 0,00" como se a folha daqueles
// meses não tivesse custado nada.
//
// A régua nova: se o ERP declara `last_page`/`total_pages`, obedece. Se não
// declara, só uma página VAZIA encerra — o cliente pede a seguinte enquanto
// vier item, até o teto dele. Uma chamada a mais custa 25-40s; um mês de folha
// que some custa mais.

export interface EstadoPaginacao {
  /** Quantos itens vieram nesta página. */
  itens: number;
  /** `last_page` ou `total_pages` do ERP; 0 quando ele não declarou. */
  totalDeclarado: number;
  /** Página pedida (1 em diante). 0 quando o cliente não pediu página. */
  pagina: number;
}

export interface DecisaoPaginacao {
  totalPaginas: number;
  /** true quando o total é palpite nosso, não informação do ERP. */
  paginacaoInferida: boolean;
  /** Vale a pena pedir a próxima página? */
  temMais: boolean;
}

export function decidirPaginacao({ itens, totalDeclarado, pagina }: EstadoPaginacao): DecisaoPaginacao {
  const declarado = Number(totalDeclarado) || 0;
  const paginacaoInferida = declarado === 0;
  const totalPaginas = declarado || (itens > 0 ? Math.max(1, pagina) + 1 : Math.max(1, pagina));
  const temMais = paginacaoInferida ? itens > 0 : pagina < declarado;
  return { totalPaginas, paginacaoInferida, temMais };
}
