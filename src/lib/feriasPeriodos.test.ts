import { describe, expect, it } from 'vitest';
import type { Ferias, Colaborador } from '@/data/types';
import { aquisitivoDe, dataFerias, estadoFerias, periodosFerias, resumoFeriasPessoa, validarRegistroFerias, opcoesAquisitivos, prazoPeriodoFerias, prepararDireitoFerias, anosCompletosFerias } from './feriasPeriodos';
const hoje=new Date(2026,8,9,12);
const f=(patch:Partial<Ferias>={}):Ferias=>({id:'a',colaboradorId:'ana',periodoAquisitivoInicio:'2025-01-01',periodoAquisitivoFim:'2025-12-31',direitoDias:30,abonoDias:0,diasGozados:0,saldoDias:30,status:'Agendada',dataInicio:'2026-10-01',dataRetorno:'2026-10-21',...patch});
describe('saldo e agenda por aquisitivo',()=>{
  it('desconta reservas futuras e não soma fotografias de saldo',()=>{
    const p=periodosFerias([f(),f({id:'b',dataInicio:'2026-11-01',dataRetorno:'2026-11-11'})],hoje)[0];
    expect(p).toMatchObject({disponivel:0,agendados:30,gozados:0,aConceder:30});
  });
  it('bloqueia 40 dias futuros no mesmo aquisitivo',()=>expect(validarRegistroFerias(f({id:'b',dataInicio:'2026-11-01',dataRetorno:'2026-11-21'}),[f()],hoje).join(' ')).toContain('ultrapassam'));
  it('não usa frações de outro ano',()=>{
    const antigos=[1,2,3].map(n=>f({id:`antigo${n}`,periodoAquisitivoInicio:'2024-01-01',periodoAquisitivoFim:'2024-12-31',dataInicio:`2025-0${n}-01`,dataRetorno:`2025-0${n}-11`,status:'Concluída'}));
    expect(validarRegistroFerias(f(),antigos,hoje)).toEqual([]);
  });
  it('aceita 14 + 8 + 8 e rejeita 10 + 10 + 10',()=>{
    const a=f({dataRetorno:'2026-10-15'}),b=f({id:'b',dataInicio:'2026-11-01',dataRetorno:'2026-11-09'}),c=f({id:'c',dataInicio:'2026-12-01',dataRetorno:'2026-12-09'});
    expect(validarRegistroFerias(c,[a,b],hoje)).toEqual([]);
    expect(validarRegistroFerias({...c,dataRetorno:'2026-12-11'},[{...a,dataRetorno:'2026-10-11'},{...b,dataRetorno:'2026-11-11'}],hoje).join(' ')).toContain('14 dias');
  });
  it('aceita gozo integral de direito confirmado de 12 dias',()=>expect(validarRegistroFerias(f({direitoDias:12,dataRetorno:'2026-10-13'}),[],hoje)).toEqual([]));
  it('não deixa iniciar uma fração de três dias',()=>expect(validarRegistroFerias(f({dataRetorno:'2026-10-04'}),[],hoje).join(' ')).toContain('cinco dias'));
  it('não duplica o próprio registro durante edição',()=>expect(validarRegistroFerias(f(),[f()],hoje)).toEqual([]));
  it('cancela inclusive registro antigo incompleto',()=>expect(validarRegistroFerias(f({status:'Cancelada',periodoAquisitivoFim:null,direitoDias:undefined}),[f()],hoje)).toEqual([]));
  it('cancelados não reservam dias',()=>expect(periodosFerias([f(),f({id:'b',status:'Cancelada'})],hoje)[0].agendados).toBe(20));
  it('conflito de datas atravessa aquisitivos',()=>expect(validarRegistroFerias(f(),[f({id:'outro',periodoAquisitivoInicio:'2024-01-01',periodoAquisitivoFim:'2024-12-31'})],hoje).join(' ')).toContain('coincidem'));
  it('abono é campo explícito e é descontado uma vez',()=>{
    expect(periodosFerias([f({abonoDias:10})],hoje)[0].disponivel).toBe(0);
    expect(validarRegistroFerias(f({abonoDias:11}),[],hoje).join(' ')).toContain('um terço');
    expect(resumoFeriasPessoa([f({observacao:'Abono de 10 dias',abonoDias:undefined})],hoje).disponivel).toBeNull();
  });
  it('histórico sem aquisitivo não vira saldo conhecido',()=>expect(resumoFeriasPessoa([f({periodoAquisitivoInicio:null})],hoje).disponivel).toBeNull());
  it('sem lançamentos não significa saldo zero',()=>expect(resumoFeriasPessoa([],hoje).disponivel).toBeNull());
  it('não mistura pessoas no mesmo aquisitivo',()=>expect(periodosFerias([f(),f({colaboradorId:'bia'})],hoje)).toHaveLength(2));
  it('não aceita direitos divergentes entre frações',()=>expect(validarRegistroFerias(f({id:'b',direitoDias:24,dataInicio:null,dataRetorno:null,status:'Em aberto'}),[f()],hoje).join(' ')).toContain('diferente'));
  it('mantém concluído mesmo com datas futuras',()=>expect(estadoFerias(f({status:'Concluída'}),hoje)).toBe('Concluída'));
  it('atualiza andamento e retorno por calendário',()=>{
    const r=f({dataInicio:'2026-09-01',dataRetorno:'2026-09-10'});
    expect(estadoFerias(r,hoje)).toBe('Em andamento');
    expect(estadoFerias(r,new Date(2026,8,10))).toBe('Concluída');
  });
  it('agendamento não quita prazo e avisa último dia após o limite',()=>{
    const p=periodosFerias([f({dataInicio:'2026-12-20',dataRetorno:'2027-01-19'})],hoje)[0];
    expect(prazoPeriodoFerias(p,hoje)).toMatchObject({atencao:true,gozoAposLimite:true});
  });
  it('saldo parcial de gozo concluído continua com prazo',()=>{
    const p=periodosFerias([f({status:'Concluída',dataInicio:'2026-08-01',dataRetorno:'2026-08-15'})],hoje)[0];
    expect(p).toMatchObject({gozados:14,disponivel:16});
    expect(prazoPeriodoFerias(p,new Date(2026,11,1)).atencao).toBe(true);
  });
});
describe('datas civis',()=>{
  it.each(['2026-02-31','2026-13-01','não é data','2026-00-01'])('rejeita %s',d=>expect(dataFerias(d)).toBeNull());
  it('reconhece o aniversário exato sem média de 30,44 dias',()=>expect(anosCompletosFerias(new Date(2025,8,9),hoje)).toBe(1));
  it('compatibiliza o fim antigo sem reescrever dados',()=>{
    const a=f(),b=f({periodoAquisitivoFim:'2026-01-01'});
    expect(aquisitivoDe(a)?.chave).toBe(aquisitivoDe(b)?.chave);
    expect(b.periodoAquisitivoFim).toBe('2026-01-01');
  });
  it('calendário proposto não cria dívida nem registro',()=>{
    const registros:Ferias[]=[];
    const ps=opcoesAquisitivos({dataAdmissao:'2025-09-09'} as Colaborador,registros,hoje);
    expect(ps).toHaveLength(2);expect(ps.every(p=>p.referencia)).toBe(true);expect(registros).toEqual([]);
  });
});

describe('integrações do calendário e ficha',()=>{
  it('a referência de admissão em 29/02 preserva o último dia de fevereiro',()=>{
    const ps=opcoesAquisitivos({dataAdmissao:'2024-02-29'} as Colaborador,[],hoje);
    const p=ps.find(p=>p.inicio.getFullYear()===2024)!;
    expect(p.fim.getMonth()).toBe(1);expect(p.fim.getDate()).toBe(28);
  });
  it('conclusão sem quantidade exige conferência',()=>expect(resumoFeriasPessoa([f({status:'Concluída',dataInicio:null,dataRetorno:null})],hoje).disponivel).toBeNull());
});

it('duplicidade histórica de duas frações de 15 dias não se apresenta como saldo quitado',()=>{
  const a=f({status:'Concluída',dataInicio:'2026-08-01',dataRetorno:'2026-08-16',diasGozados:15});
  const r=resumoFeriasPessoa([a,{...a,id:'duplicado'}],hoje);
  expect(r.disponivel).toBeNull();expect(r.periodos[0].pendencias.join(' ')).toContain('sobrepostos');
});
it('quantidade concluída diferente das datas pede conferência',()=>expect(resumoFeriasPessoa([f({status:'Concluída',dataInicio:'2026-08-01',dataRetorno:'2026-08-16',diasGozados:30})],hoje).disponivel).toBeNull());


it('corrige o direito de todas as frações do aquisitivo sem alterar outro ano ou pessoa',()=>{
  const a=f({dataRetorno:'2026-10-15'}),b=f({id:'b',dataInicio:'2026-11-01',dataRetorno:'2026-11-06'});
  const outros=[f({id:'outra-pessoa',colaboradorId:'bia'}),f({id:'outro-ano',periodoAquisitivoInicio:'2024-01-01',periodoAquisitivoFim:'2024-12-31',dataInicio:'2025-10-01',dataRetorno:'2025-10-21'}),f({id:'cancelada',status:'Cancelada'})];
  const corrigido={...a,direitoDias:24};
  const proposta=prepararDireitoFerias(corrigido,[a,b,...outros]);
  expect(proposta.ajustes).toEqual([{id:'b',direitoDias:24}]);
  expect(validarRegistroFerias(corrigido,proposta.previstos,hoje)).toEqual([]);
  expect(proposta.previstos.find(f=>f.id==='b')).toEqual({...b,direitoDias:24});
  expect(proposta.previstos.slice(2)).toEqual(outros);
  expect(b.direitoDias).toBe(30);
});
it('cancelamento não altera direito de outras frações',()=>expect(prepararDireitoFerias(f({status:'Cancelada',direitoDias:24}),[f({id:'b'})]).ajustes).toEqual([]));
