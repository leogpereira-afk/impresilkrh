import type { buscarHistoricoMubi, RespostaMubi } from './mubiPagamentos';

/** Não descarta os motivos pelos quais um título ficou fora da importação. */
export function respostaDoHistorico(r: Awaited<ReturnType<typeof buscarHistoricoMubi>>, competencias: string[]): RespostaMubi {
  return {
    competencia: competencias[competencias.length - 1] ?? '', buscadoEm: r.buscadoEm,
    totalTitulosNoMes: r.linhas.length, paginas: 0, truncado: r.truncado,
    linhas: r.linhas, idsForaDaFolha: r.idsForaDaFolha, naoPagas: r.naoPagas,
    contasForaDaFolha: r.contasForaDaFolha, contasForaOmitidas: r.contasForaOmitidas,
  };
}
