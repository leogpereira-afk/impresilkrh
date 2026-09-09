import { describe, it, expect } from 'vitest';
import type { Colaborador, Pagamento } from '@/data/types';
import { conferirAno, competenciasDoAno, csvConferencia } from './conferenciaSincronizacao';
const pessoa = {id:'ana',nome:'Ana',statusId:'ativo'} as Colaborador;
const pg = (id:string, extras:Partial<Pagamento>={}) => ({id,colaboradorId:'ana',competencia:'2026-01',valor:10,tipo:'Salário',dataPagamento:'2026-02-05',...extras});
describe('conferência anual',()=>{
 it('consulta o ano exato inclusive competências vazias, sem puxar 2025',()=>{
  expect(competenciasDoAno('2026')).toHaveLength(12);
  expect(competenciasDoAno('2026')[11]).toBe('2026-01');
  expect(competenciasDoAno('inválido')).toEqual([]);
  const r=conferirAno([pg('mubi-1'),pg('fora',{competencia:'2025-12'})],[pessoa],'2026');
  expect(r.linhas).toHaveLength(1); expect(r.meses[11].registros).toBe(0);
 });
 it('separa legado, pago e pendente, reconhece ID legado e mantém todas as linhas',()=>{
  const r=conferirAno([pg('mubi-1'),pg('manual',{statusErp:'PAGO',pagoEm:'2026-02-06'}),pg('mubi-3',{statusErp:'PENDENTE'})],[pessoa],'2026');
  expect(r.meses[0]).toMatchObject({registros:3,confirmados:1,semEstado:1,naoPagos:1,semId:1});
  expect(r.linhas.find(l=>l.pagamento.id==='mubi-1')?.motivos).toContain('Estado do pagamento não informado');
  expect(r.linhas.find(l=>l.pagamento.id==='mubi-3')?.motivos).toContain('Pagamento não confirmado');
 });
 it('pendente após desligamento não vira evidência de que a pessoa recebeu',()=>{
  const saiu={...pessoa,statusId:'inativo',dataAdmissao:'2025-01-01',dataDesligamento:'2026-01-31'};
  const r=conferirAno([pg('mubi-1',{competencia:'2026-03',statusErp:'PENDENTE'})],[saiu],'2026');
  expect(r.auditoria.achados.filter(a=>a.regra==='cadastro')).toEqual([]);
  expect(r.linhas).toHaveLength(1);
 });
 it('exporta somente o recorte fornecido, com IDs e proteção de fórmula',()=>{
  const linhas=conferirAno([pg('mubi-1'),pg('mubi-2')],[{...pessoa,nome:'=perigoso'}],'2026').linhas;
  const csv=csvConferencia(linhas.slice(0,1));
  expect(csv).toContain("'=perigoso"); expect(csv).toContain('mubi-1'); expect(csv).not.toContain('mubi-2');
 });
});
