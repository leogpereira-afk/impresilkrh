/* Dados fictícios: o cache de outra sessão não pode gerar alertas do RH. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import { entrar, sair } from "@/lib/session";
import { aplicarSemSync, definirColecao } from "@/lib/store";
import { useNotificacoes } from "@/lib/notificacoes";
import { NotificacoesButton } from "@/components/layout/notificacoes-button";
import type { Colaborador, Documento, Perfil } from "@/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let el: HTMLDivElement;
afterEach(() => { if(root) act(()=>root.unmount()); el?.remove(); sair(); localStorage.clear(); });
function Prova() {
  const itens=useNotificacoes();
  return <><output>{itens.map(n=>n.id).join(',')}</output><NotificacoesButton /></>;
}
function montar(perfil: Perfil) {
  entrar(perfil, 'comercial-ficticio');
  aplicarSemSync(()=>{
    definirColecao('colaboradores', [
      {id:'comercial-ficticio',nome:'Pessoa fictícia',statusId:'ativo'},
      {id:'equipe-ficticia',nome:'Equipe fictícia',statusId:'ativo',gestorId:'comercial-ficticio'},
    ] as Colaborador[]);
    definirColecao('documentos', [
      {id:'doc-proprio',colaboradorId:'comercial-ficticio',nome:'Documento fictício',dataVencimento:'2000-01-01'},
      {id:'doc-equipe',colaboradorId:'equipe-ficticia',nome:'Documento fictício',dataVencimento:'2000-01-01'},
    ] as Documento[]);
  });
  el=document.createElement('div'); document.body.append(el); root=createRoot(el);
  act(()=>root.render(<MemoryRouter future={{v7_startTransition:true,v7_relativeSplatPath:true}}><Prova /></MemoryRouter>));
}
for(const perfil of ['COLABORADOR','GESTOR'] as Perfil[]) it(`Comercial ${perfil} não recebe alertas próprios nem da equipe no sino`,()=>{
  montar(perfil);
  expect(el.querySelector('output')?.textContent).toBe('');
  expect(el.querySelector('button[title="Notificações"]')).toBeNull();
});
it('RH mantém os alertas e troca para Comercial remove imediatamente o sino aberto',()=>{
  montar('ADMIN_RH');
  expect(el.querySelector('output')?.textContent).toContain('doc-doc-proprio');
  expect(el.querySelector('output')?.textContent).toContain('doc-doc-equipe');
  act(()=>el.querySelector<HTMLButtonElement>('button[title="Notificações"]')!.click());
  act(()=>entrar('GESTOR','comercial-ficticio'));
  expect(el.querySelector('output')?.textContent).toBe('');
  expect(el.querySelector('button[title="Notificações"]')).toBeNull();
  expect(el.textContent).not.toContain('Documento fictício');
});
it('revalidação pendente esconde alertas mesmo com perfil RH e cache carregado',async()=>{
  const {suspenderAcessoRH,confirmarAcessoRH,renovarSessao}=await import('@/lib/session');
  montar('ADMIN_RH');
  act(()=>suspenderAcessoRH());
  expect(el.querySelector('output')?.textContent).toBe('');
  expect(el.querySelector('button[title="Notificações"]')).toBeNull();
  act(()=>renovarSessao());
  expect(el.querySelector('output')?.textContent).toBe('');
  act(()=>confirmarAcessoRH({perfil:'ADMIN_RH',colaboradorId:'comercial-ficticio'}));
  expect(el.querySelector('output')?.textContent).toContain('doc-doc-proprio');
});
