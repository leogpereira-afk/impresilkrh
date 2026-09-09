import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { ConferenciaTipos } from './conferencia-tipos';
import type { Pagamento } from '@/data/types';
it('zero conferíveis informa falta de cobertura, sem afirmar que a classificação está correta', () => {
  for (const pagamentos of [[], [{id:'manual',colaboradorId:'a',competencia:'2026-01',tipo:'Salário',valor:10} as Pagamento]]) {
    const html = renderToStaticMarkup(<ConferenciaTipos pagamentos={pagamentos} nomeDe={()=>'Pessoa'} onCorrigir={vi.fn()} />);
    expect(html).toContain('Sem dados suficientes para conferir a classificação');
    expect(html).not.toContain('Todos os 0');
    expect(html).not.toContain('border-green-200');
  }
});
