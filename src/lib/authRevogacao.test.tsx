/* Integração cliente Auth/canal/sessão/sino, somente dados fictícios. */
import { act } from 'react';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router-dom';
import {expect,it,vi} from 'vitest';
const fake=vi.hoisted(()=>({perfil:'ADMIN_RH',ativo:true,sinal:()=>{},status:(_s:string)=>{},filtro:'',auth:null as null|((ev:string,s:unknown)=>void)}));
vi.mock('@/lib/supabase',()=>({SUPABASE_CONFIGURADO:true,FN_ADMIN_USERS:'',FN_ACESSO_ENTRAR:'',ANON_PUBLICA:'',supabase:{auth:{onAuthStateChange:vi.fn(cb=>{fake.auth=cb}),getSession:vi.fn(async()=>({data:{session:{access_token:'ficticio',user:{id:'auth-ficticio'}}}})),signOut:vi.fn(async()=>({}))},from:vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{perfil:fake.perfil,ativo:fake.ativo,colaborador_id:'comercial-ficticio'},error:null})})})})),channel:vi.fn(()=>({on:(_t:string,filter:{filter:string},cb:()=>void)=>{fake.sinal=cb;fake.filtro=filter.filter;return {subscribe:(cb:(s:string)=>void)=>{fake.status=cb;return {}}};}})),removeChannel:vi.fn(async()=>{})}}));
import {entrar,obterSessao,sair} from '@/lib/session';
import {NotificacoesButton} from '@/components/layout/notificacoes-button';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
it('revogação remota remove o sino na sessão aberta, antes de outra renderização manual',async()=>{
 entrar('ADMIN_RH','comercial-ficticio');const el=document.createElement('div'),root=createRoot(el);document.body.append(el);
 try {
 act(()=>root.render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><NotificacoesButton/></MemoryRouter>));
 await act(async()=>{await import('@/lib/auth');await Promise.resolve();});
 expect(el.querySelector('button')).toBeNull(); // conexão ainda não validada
 expect(fake.filtro).toBe('user_id=eq.auth-ficticio');
 await act(async()=>{fake.status('SUBSCRIBED');});
 expect(el.querySelector('button[title="Notificações"]')).not.toBeNull();
 act(()=>el.querySelector<HTMLButtonElement>('button')!.click());
 fake.perfil='COLABORADOR';
 act(()=>fake.sinal());
 expect(el.querySelector('button')).toBeNull(); // oculta antes da resposta
 await act(async()=>{await Promise.resolve();});
 expect(obterSessao()?.perfil).toBe('COLABORADOR');
 expect(el.querySelector('button')).toBeNull();
 fake.ativo=false;await act(async()=>fake.sinal());
 expect(obterSessao()).toBeNull();
 } finally {act(()=>root.unmount());el.remove();sair();localStorage.clear();}
});
