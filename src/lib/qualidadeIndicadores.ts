/** Ausência de informação não recebe uma classificação de desempenho ou risco. */
export type FaixaDesempenho = 'Baixo' | 'Médio' | 'Alto';
export function faixaDesempenho(nota: number | null | undefined): FaixaDesempenho | null {
  if (nota == null || !Number.isFinite(nota) || nota < 0 || nota > 100) return null;
  return nota >= 85 ? 'Alto' : nota >= 70 ? 'Médio' : 'Baixo';
}
export function faixaPotencial(valor?: string | null): FaixaDesempenho | null {
  return valor === 'Alto' || valor === 'Médio' || valor === 'Baixo' ? valor : null;
}
export function riscoInformado(valor?: string | null): FaixaDesempenho | 'Não informado' {
  return faixaPotencial(valor) ?? 'Não informado';
}
