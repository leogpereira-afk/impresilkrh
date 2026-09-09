import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { Tabs } from './tabs';
import { useAbaNaUrl } from '@/lib/useAbaNaUrl';
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
it('link direto prevalece sobre aba lembrada; teclado muda foco e painel sem perder o contexto', () => {
  sessionStorage.setItem('tabs:ensaio','a');
  const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
  function Tela(){const [ativa,mudar]=useAbaNaUrl('ensaio',['a','b'],'a');const local=useLocation();const nav=useNavigate();return <><Tabs ativa={ativa} aoMudar={mudar} abas={[{id:'a',label:'Resumo',conteudo:'Resumo da equipe'},{id:'b',label:'Conferência',conteudo:'Títulos para conferir'}]}/><output>{local.search}</output><button onClick={()=>nav('?aba=b&mes=2026-08')}>Abrir outro link</button></>;}
  try {
    act(()=>root.render(<MemoryRouter initialEntries={['/?aba=b&mes=2026-07']}><Tela/></MemoryRouter>));
    expect(el.querySelector('[role="tabpanel"]')?.textContent).toBe('Títulos para conferir');
    const tabs=el.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    act(()=>{tabs[1].focus();tabs[1].dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));});
    expect(document.activeElement).toBe(tabs[0]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(el.querySelector('[role="tabpanel"]')?.id).toBe(tabs[0].getAttribute('aria-controls'));
    expect(el.querySelector('output')?.textContent).toContain('mes=2026-07');
    act(()=>el.querySelectorAll<HTMLButtonElement>('button')[2].click());
    expect(el.querySelector('[role="tabpanel"]')?.textContent).toBe('Títulos para conferir');
  } finally {act(()=>root.unmount());el.remove();sessionStorage.clear();}
});
