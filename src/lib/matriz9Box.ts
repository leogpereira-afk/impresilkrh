import type { Avaliacao } from '@/data/types';
import { faixaDesempenho, faixaPotencial } from './qualidadeIndicadores';
export function posicao9Box(avaliacao: Avaliacao | undefined, potencial?: string | null) {
  const manual = avaliacao?.calibracao9Box;
  return {
    desempenho: faixaPotencial(manual?.desempenho) ?? faixaDesempenho(avaliacao?.notaFinal),
    potencial: faixaPotencial(manual?.potencial) ?? faixaPotencial(potencial),
  };
}
export function avaliacoesDoCiclo(items: Avaliacao[], cicloId?: string) {
  const result = new Map<string, Avaliacao>();
  if (!cicloId) return result;
  for (const item of items) {
    if (item.tipo !== 'GESTOR' || item.cicloId !== cicloId) continue;
    const anterior = result.get(item.colaboradorId);
    if (!anterior || item.criadoEm > anterior.criadoEm) result.set(item.colaboradorId, item);
  }
  return result;
}
