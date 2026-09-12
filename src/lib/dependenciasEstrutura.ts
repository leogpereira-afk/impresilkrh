import type { Colaborador, Cargo, Vaga, Meta } from '@/data/types';

/** O histórico também mantém referências: sair do quadro não libera a exclusão. */
export function dependentesCargo(id: string, pessoas: readonly Pick<Colaborador, 'cargoId'>[], vagas: readonly Pick<Vaga, 'cargoId'>[]) {
  return pessoas.filter(c => c.cargoId === id).length + vagas.filter(v => v.cargoId === id).length;
}
export function dependentesArea(id: string, pessoas: readonly Pick<Colaborador, 'areaId'>[], cargos: readonly Pick<Cargo, 'areaId'>[], vagas: readonly Pick<Vaga, 'areaId'>[], metas: readonly Pick<Meta, 'areaId'>[]) {
  return [...pessoas, ...cargos, ...vagas, ...metas].filter(r => r.areaId === id).length;
}
