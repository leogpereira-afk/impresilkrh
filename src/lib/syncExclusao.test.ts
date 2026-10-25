// Servidor sintético; exercita o sincronizador e o armazenamento reais.
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
vi.mock('./auth', () => ({ MODO_JWT: true, tokenAtual: () => 'ficticio' }));
vi.mock('./supabase', () => ({ FN_SYNC: 'http://teste.local/sync' }));
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  vi.stubGlobal('indexedDB', undefined);
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
  vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function acesso() {
  (await import('./session')).entrar('ADMIN_RH', 'ficticio');
  const store = await import('./store'), sync = await import('./sync');
  store.definirColecaoDinamica('colaboradores', [{ id: 'ficha-teste', nome: 'Pessoa Fictícia', _rhRev: 1 }]);
  return { store, sync };
}
function servidor(registros: unknown[], rev = 2) {
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    const p = JSON.parse(String(options?.body));
    return new Response(JSON.stringify(p.action === 'rev' ? { rev, porColecao: { colaboradores: rev, areas: rev } } : { registros, nextAfter: null }));
  }));
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
}
it('aplica a exclusão mesmo quando outra coleção falha e retenta a coleção que falhou', async () => {
  const { store, sync } = await acesso();
  store.definirColecaoDinamica('areas', [{ id: 'area-teste', nome: 'Antes' }]);
  servidor([{ colecao: 'areas', registro: { id: 'area-teste', nome: 'Depois' } }, { colecao: 'colaboradores', registro: { id: 'ficha-teste', _rhRev: 2, _apagado: true } }]);
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function(this: Storage, key, value) {
    if (key.includes(':col:areas')) throw new Error('Cota fictícia');
    original.call(this, key, value);
  });
  await sync.pull();
  expect(store.obterDinamico('colaboradores')).toEqual([]);
  expect(store.obterDinamico('areas')[0].nome).toBe('Antes');
  expect(sync.statusSync()).toBe('erro');
  expect(sync.detalheErroSync()).toContain('areas');
  expect(sync.detalheErroSync()).toContain('guardar');
  quota.mockRestore(); await sync.pull();
  expect(store.obterDinamico('areas')[0].nome).toBe('Depois');
  expect(sync.statusSync()).toBe('ok');
  expect(sync.detalheErroSync()).toBeNull();
});
it('retira a ficha excluída mesmo com edição pendente, preservando o rascunho no conflito', async () => {
  const { store, sync } = await acesso();
  store.atualizarEm('colaboradores', 'ficha-teste', { email: 'rascunho@example.invalid' });
  servidor([{ colecao: 'colaboradores', registro: { id: 'ficha-teste', _rhRev: 2, _apagado: true } }]);
  await sync.pull();
  expect(store.obterDinamico('colaboradores')).toEqual([]);
  expect(sync.conflitosSync()[0]).toMatchObject({ registro: { email: 'rascunho@example.invalid' }, servidor: { registro: { _apagado: true } } });
  expect(() => sync.sobrescreverServidor('colaboradores', 'ficha-teste')).toThrow(/arquivado/);
});
