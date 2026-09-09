import { expect, it } from 'vitest';
import { situacaoFerias } from './clt';
import { proximaFerias } from './feriasContagem';
import { feriasEmCurso } from './ferias';
import type { Ferias,Colaborador } from '@/data/types';
const hoje=new Date(2026,10,1);
const c={id:'ana',dataAdmissao:'2024-01-01'} as Colaborador;
const f=(patch:Partial<Ferias>={}):Ferias=>({id:'a',colaboradorId:'ana',periodoAquisitivoInicio:'2025-01-01',periodoAquisitivoFim:'2025-12-31',direitoDias:30,abonoDias:10,diasGozados:0,saldoDias:0,status:'Agendada',dataInicio:'2026-12-01',dataRetorno:'2026-12-21',...patch});
it('ficha reserva no aquisitivo explícito e desconta abono, sem quitar gozo futuro',()=>{
  const s=situacaoFerias(c,[f()],hoje)!;
  expect(s).toMatchObject({diasGozados:0,diasEmAberto:20,diasAgendados:20,jaGozou:false,situacao:'a-vencer'});
  expect(s.aquisitivoInicio.getFullYear()).toBe(2025);
});
it('direito não confirmado não se apresenta como dívida comprovada',()=>expect(situacaoFerias(c,[f({direitoDias:undefined})],hoje)?.situacao).toBe('sem-registro'));
it('concluída não é próxima nem em curso apesar de datas sobrepostas',()=>{
  const r=f({status:'Concluída',dataInicio:'2026-10-20',dataRetorno:'2026-11-10'});
  expect(proximaFerias([r],hoje).registro).toBeNull();expect(feriasEmCurso(r,hoje)).toBe(false);
});
it('datas incompletas não afirmam ausência atual na lista',()=>expect(proximaFerias([f({dataInicio:'2026-10-20',dataRetorno:null})],hoje).registro).toBeNull());
it('retorno impossível não conta pessoa como ausente',()=>expect(feriasEmCurso(f({dataInicio:'2026-02-01',dataRetorno:'2026-02-31'}),new Date(2026,1,20))).toBe(false));
it('no aniversário exato o primeiro aquisitivo já está completo',()=>expect(situacaoFerias({id:'ana',dataAdmissao:'2025-09-09'} as Colaborador,[],new Date(2026,8,9))).not.toBeNull());
