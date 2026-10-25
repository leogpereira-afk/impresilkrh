import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { IDBFactory, IDBDatabase } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
vi.mock('@/lib/sync', () => ({ enviarColecao: vi.fn(), enviarConfigNuvem: vi.fn(), apagarRegistrosNuvem: vi.fn() }));
import { ColaboradorForm } from './colaborador-form';
import { ToastProvider } from '@/components/ui/toast';
import { prontoArmazem, confirmarArmazem, estadoArmazem, aguardarEdicaoLocal } from '@/lib/armazemLocal';
import { definirColecao, obter } from '@/lib/store';
import { entrar } from '@/lib/session';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('cria pelo formulário completo com quota cheia e só fecha depois da confirmação durável', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('crypto', webcrypto);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Teste sem rede'); }));
  localStorage.clear(); await prontoArmazem(); entrar('ADMIN_RH', 'ficticio');
  const controle = { id: 'controle-ficticio', nome: 'Controle Fictício', statusId: 'inativo' };
  definirColecao('colaboradores', [controle]); await confirmarArmazem();
  const el = document.createElement('div'); document.body.append(el); const root = createRoot(el);
  const fechar = vi.fn();
  try {
    await act(async () => root.render(<MemoryRouter><ToastProvider><ColaboradorForm aberto onFechar={fechar} /></ToastProvider></MemoryRouter>));
    const campo = document.querySelector<HTMLInputElement>('input[required]') ?? [...document.querySelectorAll<HTMLInputElement>('input')].find(e => e.labels?.[0]?.textContent?.includes('Nome completo'))!;
    expect(campo).toBeTruthy();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(campo, 'Nova Ficha Fictícia');
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota fictícia', 'QuotaExceededError'); });
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Salvar')!.click();
      await vi.waitFor(() => expect(fechar).toHaveBeenCalledOnce());
    });
    expect(obter('colaboradores')).toHaveLength(2);
    expect(obter('colaboradores').find(c => c.id === controle.id)).toEqual(controle);
    expect(obter('colaboradores').filter(c => c.nome === 'Nova Ficha Fictícia')).toHaveLength(1);
    expect(estadoArmazem()).toBe('ok');
    expect(await confirmarArmazem()).toBe(true);
    const nova = obter('colaboradores').find(c => c.nome === 'Nova Ficha Fictícia')!;
    await act(async () => root.render(<MemoryRouter><ToastProvider><ColaboradorForm key="editar" aberto editar={nova} onFechar={fechar} /></ToastProvider></MemoryRouter>));
    const nome = [...document.querySelectorAll<HTMLInputElement>('input')].find(e => e.labels?.[0]?.textContent?.includes('Nome completo'))!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(nome, 'Rascunho Fictício');
      nome.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const transacao = vi.spyOn(IDBDatabase.prototype, 'transaction').mockImplementation(() => { throw new Error('Disco fictício indisponível'); });
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Salvar')!.click();
      await aguardarEdicaoLocal();
    });
    expect(document.body.textContent).toContain('Disco fictício indisponível');
    expect(fechar).toHaveBeenCalledOnce();
    expect(nome.value).toBe('Rascunho Fictício');
    expect(obter('colaboradores').find(c => c.id === nova.id)?.nome).toBe('Nova Ficha Fictícia');
    transacao.mockRestore();
    await act(async () => {
      [...document.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Salvar')!.click();
      await vi.waitFor(() => expect(fechar).toHaveBeenCalledTimes(2));
    });
    expect(obter('colaboradores')).toHaveLength(2);
    expect(obter('colaboradores').find(c => c.id === nova.id)?.nome).toBe('Rascunho Fictício');
    expect(obter('colaboradores').find(c => c.id === controle.id)).toEqual(controle);
  } finally { await act(async () => root.unmount()); el.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals(); }
});
