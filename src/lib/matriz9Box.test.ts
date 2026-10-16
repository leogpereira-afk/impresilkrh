import { expect, it } from 'vitest';
import type { Avaliacao } from '@/data/types';
import { avaliacoesDoCiclo, posicao9Box } from './matriz9Box';
const antiga: Avaliacao = {id:'antiga-ficticia',colaboradorId:'pessoa-ficticia',tipo:'GESTOR',cicloId:'ciclo-ficticio',criadoEm:'2026-01-01',notaFinal:60,status:'Concluída'};
it('seleciona a avaliação mais recente mesmo que a store a coloque primeiro',()=>{
 const nova={...antiga,id:'nova-ficticia',criadoEm:'2026-02-01',notaFinal:95};
 expect(avaliacoesDoCiclo([nova,antiga],'ciclo-ficticio').get(antiga.colaboradorId)).toEqual(nova);
 expect(avaliacoesDoCiclo([antiga,nova],'ciclo-ficticio').get(antiga.colaboradorId)).toEqual(nova);
 expect(avaliacoesDoCiclo([nova],undefined).size).toBe(0);
});
it('classificação manual respeita ciclo e não altera nota',()=>{
 const aval={...antiga,calibracao9Box:{desempenho:'Alto' as const,potencial:'Médio' as const,motivo:'Exemplo fictício',em:'2026-10-16',por:null}};
 expect(posicao9Box(aval,'Baixo')).toEqual({desempenho:'Alto',potencial:'Médio'});
 expect(aval.notaFinal).toBe(60);
 expect(posicao9Box({...aval,calibracao9Box:null},'Baixo')).toEqual({desempenho:'Baixo',potencial:'Baixo'});
 expect(posicao9Box(undefined,null)).toEqual({desempenho:null,potencial:null});
});
