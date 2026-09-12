import { tituloPago } from './mubiPagamentos';
import { TIPOS_ENCARGO } from './folha';
/** Caixa e competência agrupam os mesmos pagamentos confirmados de formas diferentes. */
export function pagamentoNaFolhaReal(p: { colaboradorId: string; tipo: string; statusErp?: string }, ids: ReadonlySet<string>) {
  return ids.has(p.colaboradorId) && !TIPOS_ENCARGO.includes(p.tipo) && tituloPago(p.statusErp);
}
