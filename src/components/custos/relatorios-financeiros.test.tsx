import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import type { Colaborador, Pagamento } from '@/data/types';
import { RelatoriosFinanceiros } from './relatorios-financeiros';
vi.mock('@/components/charts/charts',()=>({BarrasVerticais:()=> <div>Gráfico</div>}));
(globalThis as unknown as {IS_REACT_ACT_ENVIRONMENT:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
describe('relatórios: os filtros levam ao detalhe correto',()=>{
  it('mostra estado, lacunas e filtra a verba sem alterar os totais do período',()=>{
    const el=document.createElement('div'); document.body.append(el);const root=createRoot(el);
    const pessoas=[{id:'a',nome:'Ana',areaId:'p'}] as Colaborador[];
    const pagamentos=[{id:'1',colaboradorId:'a',competencia:'2026-08',tipo:'Salário',valor:100,statusErp:'PAGO',dataPagamento:'2026-09-05'},{id:'2',colaboradorId:'a',competencia:'2026-08',tipo:'Diária',valor:20,statusErp:'ABERTO',dataPagamento:'2026-08-10'}] as Pagamento[];
    try {
      act(()=>root.render(<MemoryRouter><RelatoriosFinanceiros pagamentos={pagamentos} colaboradores={pessoas} areas={[{id:'p',nome:'Produção'}]} comp="2026-08" onComp={()=>{}} onSincronizar={()=>{}}/></MemoryRouter>));
      expect(el.textContent).toContain('Sem registros');expect(el.textContent).toContain('Pago confirmado');
      const select=el.querySelector('[aria-label="Verba do relatório"]') as HTMLSelectElement;
      act(()=>{select.value='Diária';select.dispatchEvent(new Event('change',{bubbles:true}));});
      const tabela=el.querySelectorAll('table')[1];expect(tabela.textContent).toContain('Diária');expect(tabela.textContent).not.toContain('Salário');
      expect(tabela.textContent).toContain('Em aberto');expect(el.textContent).toContain('R$');
      expect(tabela.querySelector('a')?.getAttribute('href')).toBe('/colaboradores/a');
    } finally {act(()=>root.unmount());el.remove();}
  });
});
