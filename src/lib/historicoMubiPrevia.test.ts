import { describe, expect, it } from 'vitest';
import { respostaDoHistorico } from './historicoMubiPrevia';
import { resumoDaPrevia } from './previaFolha';
import type { LinhaMubi } from './mubiPagamentos';
import type { Pagamento } from '@/data/types';
describe('histórico preserva motivos de exclusão e proteção',()=>{
 it('não transforma aberto/fora da conta em título sumido removível',()=>{
  const r=respostaDoHistorico({linhas:[],buscadoEm:'agora',truncado:true,falhas:[],competenciasLidas:['2026-01'],contasForaDaFolha:[{plano:'9-Outra',quantos:1,total:20}],contasForaOmitidas:2,idsForaDaFolha:['2'],naoPagas:[{idMubi:'1'} as LinhaMubi]},['2026-01']);
  expect(r.contasForaOmitidas).toBe(2);expect(r.contasForaDaFolha).toHaveLength(1);expect(r.truncado).toBe(true);
  const ausentes=['1','2'].map(id=>({id:`mubi-${id}`,idMubi:id,competencia:'2026-01',tipo:'Salário',valor:10,colaboradorId:'ana'} as Pagamento));
  const resumo=resumoDaPrevia({diff:{iguais:[],novos:[],alterados:[],ausentes},gravados:ausentes,janela:new Set(['2026-01']),ausentesMarcados:new Set(ausentes.map(p=>p.id)),colaboradorPor:()=>undefined,tiposEncargo:[],emAberto:new Set(r.naoPagas?.map(p=>p.idMubi)),foraDaFolha:new Set(r.idsForaDaFolha)});
  expect(resumo.ausentes.comIdErp).toHaveLength(0);expect(resumo.podeAplicar).toBe(false);
 });
});
