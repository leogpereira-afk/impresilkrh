import { describe, it, expect } from 'vitest';
import { relatorioFinanceiro, csvFinanceiro } from './relatorioFinanceiro';
import type { Colaborador, Pagamento } from '@/data/types';
const pessoas = [{id:'a',nome:'Ana',areaId:'producao'},{id:'s',nome:'Sócio',ehDirecao:true}] as Colaborador[];
const p=(id:string,valor:number,extra:Partial<Pagamento>={}):Pagamento=>({id,valor,colaboradorId:'a',competencia:'2026-08',tipo:'Salário',dataPagamento:'2026-09-05',statusErp:'PAGO',...extra});
describe('relatórios financeiros: bases auditáveis',()=>{
  it('separa recebido, encargos, aberto, cancelado e legado sem somar provisões',()=>{
    const r=relatorioFinanceiro([p('1',100),p('2',8,{tipo:'FGTS'}),p('3',20,{statusErp:'ABERTO'}),p('4',40,{statusErp:'CANCELADO'}),p('5',10,{statusErp:undefined})],pessoas,'2026-08','2026-08');
    expect([r.pago,r.encargos,r.aberto,r.outros,r.legado]).toEqual([110,8,20,40,10]);
    expect(r.porTipo.reduce((s,t)=>s+t.valor,0)).toBe(r.pago);
  });
  it('não usa vencimento futuro como prova de pagamento nem status desconhecido como pago',()=>{
    const r=relatorioFinanceiro([p('1',100,{statusErp:'EM ANÁLISE',pagoEm:'2026-08-05'}),p('2',50,{statusErp:'A PAGAR'})],pessoas,'2026-08','2026-08');
    expect(r.pago).toBe(0);expect(r.aberto).toBe(50);expect(r.outros).toBe(100);
  });
  it('não inventa zero em mês sem registros e inclui lançamento órfão nos totais',()=>{
    const r=relatorioFinanceiro([p('1',100,{colaboradorId:'sumiu'})],pessoas,'2026-07','2026-08');
    expect(r.meses[0].pago).toBeNull();expect(r.pago).toBe(100);expect(r.semCadastro).toBe(1);expect(r.pessoasPagas).toBe(0);
  });
  it('exclui sócios e verbas societárias inclusive quando o cadastro sumiu',()=>{
    const r=relatorioFinanceiro([p('1',100,{colaboradorId:'s'}),p('2',90,{tipo:'Arrendamento',colaboradorId:'sumiu'}),p('3',50)],pessoas,'2026-08','2026-08');expect(r.pago).toBe(50);
  });
  it('filtra área atual e período sem perder precisão em centavos',()=>{
    const r=relatorioFinanceiro([p('1',.1),p('2',.2),p('3',500,{competencia:'2026-07'}),p('4',99,{colaboradorId:'sumiu'})],pessoas,'2026-08','2026-08','producao');expect(r.pago).toBe(.3);expect(r.linhas).toHaveLength(2);
  });
  it('sinaliza dados inválidos e não deixa NaN contaminar totais',()=>{
    const r=relatorioFinanceiro([p('1',NaN),p('2',10,{competencia:'2026-99'}),p('3',5)],pessoas,'2026-08','2026-08');expect(r.invalidos).toBe(2);expect(r.pago).toBe(5);
  });
  it('CSV mantém vencimento distinto de pagoEm e impede fórmulas em descrição',()=>{
    const r=relatorioFinanceiro([p('1',100,{descricao:'=1+1',pagoEm:'2026-09-06'})],pessoas,'2026-08','2026-08');const csv=csvFinanceiro(r.linhas);expect(csv).toContain("'=1+1");expect(csv).toContain('2026-09-05');expect(csv).toContain('2026-09-06');expect(csv).toContain('100,00');
  });
});

it('as causas por verba reconciliam a diferença mensal sem esconder compensações',()=>{
 const r=relatorioFinanceiro([p('a',100,{competencia:'2026-07'}),p('b',120),p('c',50,{competencia:'2026-07',tipo:'Diária'}),p('d',10,{tipo:'Diária'})],pessoas,'2026-07','2026-08');
 expect(r.variacoes.reduce((s,v)=>s+v.delta,0)).toBe(-20);
 expect(r.variacoes.map(v=>v.delta)).toEqual([-40,20]);
});

it('cancelamento prevalece sobre texto de aberto',()=>{
 const r=relatorioFinanceiro([p('x',100,{statusErp:'CANCELADO - ABERTO'})],pessoas,'2026-08','2026-08');expect(r.aberto).toBe(0);expect(r.pago).toBe(0);expect(r.outros).toBe(100);
});
