import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock=vi.hoisted(()=>({perfil:'ADMIN_RH',api:vi.fn(),entrevistas:vi.fn(),usuarios:[] as any[]}));
vi.mock('@/lib/session',()=>({useSessao:()=>({perfil:mock.perfil,colaboradorId:'ficticia'})}));
vi.mock('@/lib/store',()=>({useColecao:()=>({items:mock.usuarios})}));
vi.mock('@/lib/escuta',async original=>({...await original<typeof import('@/lib/escuta')>(),chamarEscuta:mock.api}));
vi.mock('@/lib/entrevistas',async original=>({...await original<typeof import('@/lib/entrevistas')>(),chamarEntrevistas:mock.entrevistas}));
vi.mock('./Feedback',()=>({default:()=> <div>Feedback existente<input aria-label="Filtro persistente"/></div>}));
vi.mock('@/components/pesquisas/ClimaPesquisa',()=>({default:({instrumento}:{instrumento:string})=><div>Instrumento: {instrumento}</div>}));
vi.mock('@/components/pesquisas/EntrevistasCentral',()=>({default:()=> <div>Agenda de entrevistas protegida</div>}));
import Nps from './Nps';
(globalThis as Record<string,unknown>).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,el:HTMLDivElement;
const montar=(url='/nps')=>act(async()=>root.render(<MemoryRouter initialEntries={[url]}><Nps/></MemoryRouter>));
const click=async(label:string)=>act(async()=>{Array.from(el.querySelectorAll('button')).find(b=>b.textContent?.trim()===label)!.click();});
beforeEach(()=>{mock.perfil='ADMIN_RH';mock.usuarios=[];mock.api.mockReset();mock.api.mockResolvedValue({ok:true,pessoas:[],individuais:[],acoes:[],origens:[]});mock.entrevistas.mockReset();mock.entrevistas.mockResolvedValue({ok:true,pessoas:[],entrevistas:[]});el=document.createElement('div');document.body.appendChild(el);root=createRoot(el);});
afterEach(()=>{act(()=>root.unmount());el.remove();});
it('tem sete chips, separa instrumentos e preserva painel ao trocar de área',async()=>{
 await montar();expect(el.querySelector('nav')?.querySelectorAll('button')).toHaveLength(7);
 await click('Feedbacks');const input=el.querySelector('input[aria-label="Filtro persistente"]') as HTMLInputElement;input.value='Filtro fictício';
 await click('Clima');expect(el.textContent).toContain('Instrumento: clima');expect(input.closest('[hidden]')).not.toBeNull();
 await click('eNPS');expect(el.textContent).toContain('Instrumento: enps');
 await click('Feedbacks');expect(input.closest('[hidden]')).toBeNull();expect(input.value).toBe('Filtro fictício');
});
it('colaborador não pede entrevistas e não tem gestão nem feedbacks',async()=>{
 mock.perfil='COLABORADOR';await montar('/nps?aba=entrevistas');expect(mock.entrevistas).not.toHaveBeenCalled();expect(el.querySelector('nav')?.textContent).not.toContain('Feedbacks');expect(el.querySelector('nav')?.textContent).not.toContain('Entrevistas');expect(el.textContent).not.toContain('Agenda de entrevistas protegida');
});
it('gestor só tem feedback se módulo autorizado e nunca recebe entrevistas',async()=>{
 mock.perfil='GESTOR';mock.usuarios=[{colaboradorId:'ficticia',ativo:true,permissoes:['treinamento']}];await montar('/nps?aba=feedbacks');expect(mock.entrevistas).not.toHaveBeenCalled();expect(el.querySelector('nav')?.textContent).not.toContain('Feedbacks');
});
it('indisponibilidade não aparece como contagem zero e consulta traz indicação de origem',async()=>{
 mock.api.mockRejectedValue(new Error('Conexão indisponível'));await montar();expect(el.querySelector('[role="alert"]')?.textContent).toContain('Conexão indisponível');expect(el.textContent).not.toContain('Nenhuma entrevista pendente');
});
it('indicador usa mesma lista de ações atrasadas e abre filtro correspondente',async()=>{
 mock.api.mockResolvedValue({ok:true,pessoas:[],individuais:[],origens:[],acoes:[{id:'ficticia',origem_tipo:'feedback',origem_id:'ficticio',pessoa_id:'ficticia',responsavel_id:'ficticia',titulo:'Ação vencida fictícia',prazo:'2020-01-01',estado:'Pendente',historico:[],versao:1}]});await montar();await act(async()=>{Array.from(el.querySelectorAll('button')).find(b=>b.textContent?.includes('Ações para revisar'))!.click();});expect(el.textContent).toContain('Ação vencida fictícia');expect((el.querySelector('select') as HTMLSelectElement).value).toBe('Revisar');
});
