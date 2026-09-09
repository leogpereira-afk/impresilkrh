import { expect, it } from 'vitest';
import { faixaDesempenho, faixaPotencial, riscoInformado } from './qualidadeIndicadores';
it('mantém pessoas sem informação fora de classificações favoráveis', () => {
  for (const nota of [undefined, null, NaN, -1, 101]) expect(faixaDesempenho(nota)).toBeNull();
  expect(faixaDesempenho(0)).toBe('Baixo');
  expect(faixaDesempenho(70)).toBe('Médio');
  expect(faixaDesempenho(85)).toBe('Alto');
  for (const v of [undefined, null, '', 'Não avaliado']) {
    expect(faixaPotencial(v)).toBeNull(); expect(riscoInformado(v)).toBe('Não informado');
  }
  expect(riscoInformado('Baixo')).toBe('Baixo');
});
