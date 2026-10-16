// Apenas pessoas e documentos fictícios. Store real, sem rede produtiva.
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { Colaborador } from '@/data/types';
const estado = vi.hoisted(() => ({ sessao: { perfil: 'ADMIN_RH', colaboradorId: 'rh-ficticio' } }));
vi.mock('@/lib/session', () => ({ useSessao: () => estado.sessao, obterSessao: () => estado.sessao }));
import { definirColecao, obter, registrarMutacao } from '@/lib/store';
import SST from './SST';
import { Calibrar9Box } from '@/components/Calibrar9Box';
import { useColecao } from '@/lib/store';
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let el: HTMLDivElement;
async function click(text: string) { const b = [...document.querySelectorAll('button')].find(x => x.textContent?.trim() === text || x.title === text); expect(b, text).toBeTruthy(); await act(async () => b!.click()); }
async function fill(input: HTMLInputElement, value: string) { await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value); input.dispatchEvent(new Event('input',{bubbles:true})); }); }
beforeEach(() => {
 localStorage.clear(); sessionStorage.clear();
 definirColecao('colaboradores',[{id:'p-ficticia',nome:'Pessoa Fictícia',idPessoa:'000001',statusId:'ativo'}] as Colaborador[]);
 definirColecao('documentos',[{id:'exame-ficticio',colaboradorId:'p-ficticia',categoria:'Exame Periódico',criadoEm:'2020-01-01',nome:'Exame fictício',dataEmissao:'2020-01-01',dataVencimento:'2020-12-31'}]);
 definirColecao('institucionais',[]); definirColecao('certificacoesNr',[]);
 registrarMutacao(() => {});
 el=document.createElement('div'); document.body.appendChild(el); root=createRoot(el);
});
afterEach(() => {act(() => root.unmount());el.remove();vi.restoreAllMocks();});
it('exame editado atualiza situação, fila e persistência sem recarregar',async()=>{
 const fila=vi.fn(); registrarMutacao(fila);
 const montar=()=>act(async()=>root.render(<MemoryRouter><SST/></MemoryRouter>));
 await montar();
 const edit=[...el.querySelectorAll('button')].find(b=>b.title === 'Corrigir datas deste exame');
 expect(edit).toBeTruthy(); await act(async()=>edit!.click());
 const dates=document.querySelectorAll<HTMLInputElement>('input[type=date]');
 await fill(dates[0],'2026-10-16'); await fill(dates[1],'2099-10-16'); await click('Salvar');
 expect(obter('documentos')[0].dataVencimento).toBe('2099-10-16');
 expect(fila).toHaveBeenCalledWith('documentos','upsert','exame-ficticio',undefined);
 expect(el.querySelector('tbody')?.textContent).toContain('Válido');
 await act(async()=>root.render(<div/>)); await montar();
 expect(el.querySelector('tbody')?.textContent).toContain('Válido');
});

it('calibra a matriz e persiste histórico sem reescrever notas ou promoção',async()=>{
 definirColecao('avaliacoes',[{id:'aval-ficticia',cicloId:'ciclo-ficticio',colaboradorId:'p-ficticia',tipo:'GESTOR',notaFinal:65,elegivelPromocao:false,status:'Concluída',criadoEm:'2026-01-01'}]);
 function Editor(){ const {items,atualizar}=useColecao('avaliacoes'); return <Calibrar9Box pessoa={obter('colaboradores')[0]} avaliacao={items[0]} desempenho="Alto" potencial="Alto" onSalvar={atualizar} onFechar={()=>{}}/>; }
 await act(async()=>root.render(<Editor/>));
 const motivo=document.querySelector('textarea')!;
 await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(motivo,'Calibração fictícia de teste');motivo.dispatchEvent(new Event('input',{bubbles:true}));});
 await click('Salvar posição');
 const aval=obter('avaliacoes')[0];
 expect(aval.calibracao9Box?.desempenho).toBe('Alto');
 expect(aval.notaFinal).toBe(65);expect(aval.elegivelPromocao).toBe(false);
 expect(aval.historico9Box).toHaveLength(1);
 await click('Usar avaliação calculada');
 expect(obter('avaliacoes')[0].calibracao9Box).toBeNull();
 expect(obter('avaliacoes')[0].historico9Box).toHaveLength(2);
});
it('filtro de NRs vencidas não volta a cobrar certificado substituído',async()=>{
 definirColecao('certificacoesNr',[
 {id:'nr-antiga-ficticia',colaboradorId:'p-ficticia',nr:'NR-35',dataTreinamento:'2020-01-01',dataValidade:'2022-01-01',instituicao:'Instituição antiga fictícia'},
 {id:'nr-nova-ficticia',colaboradorId:'p-ficticia',nr:'NR-35',dataTreinamento:'2026-01-01',dataValidade:'2099-01-01',instituicao:'Instituição nova fictícia'},
 ]);
 await act(async()=>root.render(<MemoryRouter><SST/></MemoryRouter>));
 await click('Certificações NR');
 expect(el.textContent).toContain('Instituição antiga fictícia');
 await click('Ver só as certificações vencidas');
 expect(el.textContent).toContain('Nenhuma certificação neste filtro');
 expect(el.textContent).not.toContain('Instituição antiga fictícia');
 await click('Mostrar todas as certificações');
 expect(el.textContent).toContain('Instituição antiga fictícia');
});
