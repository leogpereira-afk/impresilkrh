import type { CicloAvaliacao } from '@/data/types';

/** A mesma referência no título, nos indicadores e na lista de avaliações. */
export function cicloVigente(ciclos: readonly CicloAvaliacao[]): CicloAvaliacao | undefined {
  const recentes = [...ciclos].sort((a, b) => b.dataInicio.localeCompare(a.dataInicio) || a.id.localeCompare(b.id));
  return recentes.find(c => c.status === 'Aberto') ?? recentes[0];
}
