import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { PreviaFolha } from '@/components/custos/previa-folha';
import { resumoDaPrevia } from './previaFolha';
import { idMubiDe } from './custos';
import type { Pagamento } from '@/data/types';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('o botão da linha persistida entrega exatamente o título legado e não aplica nem remove a folha', () => {
  const p = { id: 'mubi-42', colaboradorId: 'p1', competencia: '2026-07', tipo: 'Salário', valor: 100 } as Pagamento;
  const resumo = resumoDaPrevia({
    diff: { iguais: [], alterados: [], novos: [], ausentes: [p] },
    gravados: [p], janela: new Set(['2026-07']), ausentesMarcados: new Set(),
    colaboradorPor: () => undefined, tiposEncargo: [], semDono: new Set(['42']),
  });
  const fora = vi.fn();
  const aplicar = vi.fn();
  const remover = vi.fn();
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  try {
    act(() => root.render(<PreviaFolha resumo={resumo} iguais={0} nomeDe={() => 'Pessoa'}
      ausentesMarcados={new Set()} onMarcarAusente={remover} onMarcarBloco={remover}
      confirmados={new Set()} onConfirmar={() => {}} salarios={[]} salariosMarcados={new Set()}
      onMarcarSalario={() => {}} cpfs={[]} excluidos={new Set()} onExcluir={() => {}}
      onExcluirBloco={() => {}} onAplicar={aplicar} onCancelar={() => {}} onForaRh={fora}
      vincular={{ nomeErpDe: () => 'Origem ERP', pessoas: [], onVincular: () => {} }} />));
    const b = [...document.body.querySelectorAll('button')].find(b => b.textContent === 'Não faz parte do RH')!;
    expect(b.closest('tr')?.querySelector('select')).toBeTruthy();
    act(() => b.click());
    expect(fora).toHaveBeenCalledTimes(1);
    expect(fora).toHaveBeenCalledWith(p);
    expect(idMubiDe(fora.mock.calls[0][0])).toBe('42');
    expect(aplicar).not.toHaveBeenCalled();
    expect(remover).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    el.remove();
  }
});
