import type { Colaborador, Pagamento } from '@/data/types';
import { conciliarPagamentos, idMubiDe } from './custos';
import { paraRegistros, type LinhaMubi } from './mubiPagamentos';

/** Decisão explícita por título; nomes, contas e grupos nunca são critérios. */
export function linhasDoRh(linhas: LinhaMubi[], ids: readonly string[] = []) {
  const fora = new Set(ids);
  return linhas.filter(l => !fora.has(String(l.idMubi)));
}

export function paraRegistrosDoRh(linhas: LinhaMubi[], colaboradores: Colaborador[], vinculos: Record<string, string>, titulos: Record<string, string> = {}, ids: readonly string[] = []) {
  return paraRegistros(linhasDoRh(linhas, ids), colaboradores, vinculos, titulos);
}

/** Preserva lançamentos existentes: fora do RH não significa sumido do ERP. */
export function conciliarDoRh(existentes: Pagamento[], novos: Pagamento[], janela: Set<string>, ids: readonly string[] = []) {
  const fora = new Set(ids);
  const participa = (p: Pagamento) => !fora.has(idMubiDe(p) ?? '');
  return conciliarPagamentos(existentes.filter(participa), novos.filter(participa), janela);
}
