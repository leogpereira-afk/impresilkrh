import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { it, expect, vi } from 'vitest';
import type { Colaborador, Pagamento } from '@/data/types';
import { ConferenciaAno } from './conferencia-ano';
(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
it('abre o ano exato, permite ver pagos sem alerta e mostra identificadores',()=>{
 const el=document.createElement('div');document.body.append(el);const root=createRoot(el);
 const ano=String(new Date().getFullYear());const onAno=vi.fn(),onMes=vi.fn();
 try {
  act(()=>root.render(<MemoryRouter><ConferenciaAno pessoas={[{id:'ana',nome:'Ana Silva',statusId:'ativo'} as Colaborador]} pagamentos={[{id:'mubi-123',idMubi:'123',colaboradorId:'ana',tipo:'Salário',valor:10,competencia:`${ano}-01`,statusErp:'PAGO',dataPagamento:`${ano}-02-05`,pagoEm:`${ano}-02-05`} as Pagamento]} ocupado={false} onBuscarAno={onAno} onBuscarMes={onMes}/></MemoryRouter>));
  act(()=>Array.from(el.querySelectorAll('button')).find(b=>b.textContent?.includes('inteiro no ERP'))!.click());
  expect(onAno).toHaveBeenCalledWith(ano);
  act(()=>(el.querySelector('input[aria-label="Somente com pontos para conferir"]') as HTMLInputElement).click());
  expect(el.querySelectorAll('table')[1].textContent).toContain('ERP: 123');
  act(()=>el.querySelector<HTMLButtonElement>('[aria-label^="Conferir Jan/"]')!.click());
  expect(onMes).toHaveBeenCalledWith(`${ano}-01`);
 }finally{act(()=>root.unmount());el.remove();}
});
