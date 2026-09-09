import { it, expect } from 'vitest';
import { conciliarPagamentos } from './custos';
import { diffAplicavel, patchDeAplicacao, patchDeDesfazer } from './previaFolha';
import type { Pagamento } from '@/data/types';
it('corrigir só a baixa exige seleção e preserva desfazer',()=>{
 const a:Pagamento={id:'mubi-1',idMubi:'1',colaboradorId:'ana',tipo:'Salário',valor:100,competencia:'2026-08',dataPagamento:'2026-09-05',pagoEm:'2026-09-06',statusErp:'PAGO'};
 const b={...a,pagoEm:'2026-09-07'};const diff=conciliarPagamentos([a],[b],new Set(['2026-08']));
 expect(diff.iguais).toHaveLength(0);expect(diff.alterados).toHaveLength(1);
 expect(diffAplicavel(diff,new Set([a.id])).alterados).toHaveLength(0);
 expect(patchDeAplicacao(b,a).pagoEm).toBe('2026-09-07');expect(patchDeDesfazer(a).pagoEm).toBe('2026-09-06');
});
