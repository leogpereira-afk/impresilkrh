// Dados sintéticos; duas coleções cabem isoladamente, mas não simultaneamente no diário.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { webcrypto } from 'node:crypto';
vi.mock('./auth', () => ({ MODO_JWT: true, tokenAtual: () => 'ficticio' }));
vi.mock('./supabase', () => ({ FN_SYNC: 'http://teste.local/sync' }));
beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  vi.stubGlobal('indexedDB', new IDBFactory()); vi.stubGlobal('BroadcastChannel', undefined); vi.stubGlobal('crypto', webcrypto);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
  vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each([130_000, 40_000])('recebe e confirma coleções mesmo com apenas %i caracteres livres no diário', async (limite) => {
  const armazem = await import('./armazemLocal'); await armazem.prontoArmazem();
  (await import('./session')).entrar('ADMIN_RH', 'ficticio');
  const store = await import('./store'); const sync = await import('./sync');
  const itens = ['areas', 'colaboradores'].map(colecao => ({ colecao, registro: { id: colecao + '-ficticio', nome: 'Fictício', conteudo: 'x'.repeat(80_000) } }));
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
    const soma = Object.keys(this).filter(k => k !== key).reduce((s, k) => s + this.getItem(k)!.length, 0);
    if (soma + value.length > limite) throw new DOMException('Quota compartilhada fictícia', 'QuotaExceededError');
    original.call(this, key, value);
  });
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    const p = JSON.parse(String(options?.body));
    return new Response(JSON.stringify(p.action === 'rev' ? { rev: 2, porColecao: { areas: 2, colaboradores: 2 } } : { registros: itens, nextAfter: null }));
  }));
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await sync.pull();
  expect(store.obterDinamico('areas')).toEqual([itens[0].registro]);
  expect(store.obterDinamico('colaboradores')).toEqual([itens[1].registro]);
  expect(armazem.estadoArmazem()).toBe('ok');
  expect(sync.statusSync()).toBe('ok');
  expect(await armazem.confirmarArmazem()).toBe(true);
  vi.resetModules(); const reaberto = await import('./armazemLocal'); await reaberto.prontoArmazem();
  expect(JSON.parse((await import('./armazenamentoUsuario')).lerLocal('impresilk.rh.v1:col:colaboradores')!)).toEqual([itens[1].registro]);
});
it('preserva uma edição feita enquanto confirma a coleção anterior', async () => {
  const armazem = await import('./armazemLocal'); await armazem.prontoArmazem();
  (await import('./session')).entrar('ADMIN_RH', 'ficticio');
  const store = await import('./store'); const sync = await import('./sync');
  store.definirColecaoDinamica('colaboradores', [{ id: 'pessoa-ficticia', nome: 'Antes', _rhRev: 1 }]);
  await armazem.confirmarArmazem();
  const original = IDBObjectStore.prototype.put; let editou = false;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = original.apply(this, args);
    if (!editou && String(args[1]).includes(':col:areas')) {
      editou = true;
      queueMicrotask(() => store.atualizarEm('colaboradores', 'pessoa-ficticia', { nome: 'Edição durante leitura' }));
    }
    return request;
  });
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    const p = JSON.parse(String(options?.body));
    if (p.action === 'upsert') return new Response(JSON.stringify({ erro: 'Conexão fictícia interrompida' }), { status: 503 });
    return new Response(JSON.stringify(p.action === 'rev' ? { rev: 2, porColecao: { areas: 2, colaboradores: 2 } } : { registros: [
      { colecao: 'areas', registro: { id: 'area-ficticia', nome: 'Área' } },
      { colecao: 'colaboradores', registro: { id: 'pessoa-ficticia', nome: 'Antes', _rhRev: 1 } },
    ], nextAfter: null }));
  }));
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await sync.pull();
  expect(editou).toBe(true);
  expect(store.obterDinamico('colaboradores')[0].nome).toBe('Edição durante leitura');
  expect(armazem.estadoArmazem()).toBe('ok');
});

it('edita, confirma a revisão e esvazia a fila sem depender de espaço no localStorage', async () => {
  const armazem = await import('./armazemLocal'); await armazem.prontoArmazem();
  (await import('./session')).entrar('ADMIN_RH', 'ficticio');
  const store = await import('./store'); const sync = await import('./sync');
  store.definirColecaoDinamica('colaboradores', [{ id: 'pessoa-ficticia', nome: 'Antes', _rhRev: 1 }, { id: 'preservar', nome: 'Controle', _rhRev: 1 }]);
  await armazem.confirmarArmazem();
  const pedidos: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    pedidos.push(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify({ ok: true, versao: 2 }));
  }));
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Quota fictícia', 'QuotaExceededError'); });
  await armazem.executarEdicaoLocal(() => store.atualizarEm('colaboradores', 'pessoa-ficticia', { nome: 'Depois' }));
  expect(sync.pendentesSync()).toBe(1);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  await sync.trySync();
  expect(pedidos).toHaveLength(1); expect(pedidos[0].action).toBe('upsert');
  expect(sync.pendentesSync()).toBe(0); expect(sync.statusSync()).toBe('ok'); expect(armazem.estadoArmazem()).toBe('ok');
  expect(store.obterDinamico('colaboradores')).toEqual([{ id: 'pessoa-ficticia', nome: 'Depois', _rhRev: 2, atualizadoEm: expect.any(String) }, { id: 'preservar', nome: 'Controle', _rhRev: 1 }]);
});
