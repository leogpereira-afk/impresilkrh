// F02 (29/09/2026): cliente REAL (sync.ts + store.ts) ligado ao handler REAL da
// function sync (compilado como no performanceServidor.test.ts). Dados fictícios.
// Prova de revisão: com o 410, um vínculo de O.S. salvo por uma aba presa na
// versão anterior ficava na cópia local e prendia toda gravação seguinte do mês
// (inclusive aprovação de bonificação); e "Enviar tudo" levava esse vínculo ao
// banco. Agora o servidor descarta o vínculo com aviso, grava o resto, e o pull
// repõe a lista do banco na cópia local.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';
import { mapaPessoasPorId } from '../../supabase/functions/_shared/programacao';
import { contaApontadaAoSocio, lerVinculosSocioConta } from '../../supabase/functions/_shared/socioConta';

vi.mock('./auth', () => ({ MODO_JWT: true, tokenAtual: () => 'teste' }));
vi.mock('./supabase', () => ({ FN_SYNC: 'http://rh-teste.local/sync' }));

const codigo = ts.transpileModule(readFileSync('supabase/functions/sync/index.ts', 'utf8').replace(/^import .*;\s*$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
type Linha = { id: string; colecao: string; registro: Record<string, unknown>; apagado: boolean; rh_versao: number };

function servidor(linhas: Linha[]) {
  let handler!: (r: Request) => Promise<Response>;
  const enviados: Record<string, unknown>[] = [];
  const rpc = vi.fn(async (nome: string, a: Record<string, unknown>) => {
    if (nome === 'rh_aplicar_retrato') return { data: { ok: true, rev: 99 }, error: null };
    const l = linhas.find(x => x.colecao === a.p_colecao && x.id === a.p_id);
    if (l && a.p_versao !== l.rh_versao) return { data: { conflito: true, servidor: { colecao: l.colecao, registro: { ...l.registro, _rhRev: l.rh_versao } } }, error: null };
    if (l) { l.registro = structuredClone(a.p_registro) as Record<string, unknown>; l.rh_versao++; } else linhas.push({ id: String(a.p_id), colecao: String(a.p_colecao), registro: structuredClone(a.p_registro) as Record<string, unknown>, apagado: false, rh_versao: 1 });
    return { data: { ok: true, versao: l?.rh_versao ?? 1 }, error: null };
  });
  const admin = { auth: { getUser: async (t: string) => ({ data: { user: t === 'teste' ? { id: 'auth-teste' } : null }, error: null }) }, rpc, from: (tabela: string) => {
    let lista: Linha[] = tabela === 'registros' ? linhas : []; let limite = Infinity; let individual = false;
    const q = { select: () => q, eq: (c: string, v: unknown) => { if (tabela !== 'perfis') lista = lista.filter(l => (l as unknown as Record<string, unknown>)[c] === v); return q; }, in: (c: string, vs: unknown[]) => { lista = lista.filter(l => vs.includes((l as unknown as Record<string, unknown>)[c])); return q; }, order: () => q, limit: (n: number) => { limite = n; return q; }, range: () => q, or: () => q, gt: () => q, maybeSingle: () => { individual = true; return q; },
      then: (resolve: (r: unknown) => unknown) => Promise.resolve(resolve({ data: tabela === 'perfis' ? { colaborador_id: 'pessoa-teste', perfil: 'ADMIN_RH', ativo: true } : tabela === 'config_global' ? { config: {} } : individual ? (lista[0] ? structuredClone(lista[0]) : null) : structuredClone(lista.slice(0, limite)), error: null })) };
    return q;
  } };
  runInNewContext(codigo, { Deno: { env: { get: () => '' }, serve: (h: typeof handler) => { handler = h; } }, createClient: () => admin, projetarOrdem, mapaPessoasPorId, contaApontadaAoSocio, lerVinculosSocioConta, preflight: () => null, json: (b: unknown, status = 200) => new Response(JSON.stringify(b), { status }), console: { ...console, warn: vi.fn(), error: vi.fn() }, crypto, Request, Response, Date, Set, Map, URL, Uint8Array, atob, btoa });
  const fetchRoteado = vi.fn(async (_url: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body));
    if (corpo.action === 'upsert' && corpo.colecao === 'performanceCiclos') enviados.push(structuredClone(corpo.registro));
    return handler(new Request('https://rh.test/sync', { method: 'POST', headers: { authorization: 'Bearer teste' }, body: String(init.body) }));
  });
  return { rpc, enviados, fetchRoteado };
}
const esperar = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };
const fantasma = { id: 'e1', colaboradorId: 'pessoa-a', os: { id: 'os-1', numero: 'TESTE-1', cliente: 'Cliente de teste' }, participacao: 100, complexidade: 2, aceite: true, qualidade: 'sem_retrabalho', prazo: 'no_prazo', evidencia: 'teste', justificativa: '' };

beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
  vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function preparar(noBanco: Record<string, unknown>) {
  const linhas: Linha[] = [{ id: String(noBanco.id), colecao: 'performanceCiclos', registro: structuredClone(noBanco), apagado: false, rh_versao: 3 }];
  const srv = servidor(linhas);
  vi.stubGlobal('fetch', srv.fetchRoteado);
  const sessao = await import('./session'); sessao.entrar('ADMIN_RH', 'pessoa-teste');
  const dados = await import('./store'); const sync = await import('./sync');
  dados.aplicarSemSync(() => dados.definirColecaoDinamica('performanceCiclos', [{ ...structuredClone(noBanco), _rhRev: 3 } as never]));
  return { linhas, srv, dados, sync };
}

it('vínculo salvo por aba velha é descartado com aviso e não prende a aprovação feita depois', async () => {
  const pessoa = { colaboradorId: 'pessoa-a', habitual: 1, meta: 2, colaboracao: [100, 100, 100] };
  const noBanco = { id: 'performance-2026-09', competencia: '2026-09', regra: { orcamento: 1000 }, pessoas: [pessoa], entregas: [], historico: [] };
  const { linhas, srv, dados, sync } = await preparar(noBanco);
  const avisos: string[] = [];
  vi.spyOn(window, 'dispatchEvent').mockImplementation((e: Event) => { if (e.type === 'impresilk:aviso-sync') avisos.push((e as CustomEvent).detail.mensagem); return true; });

  // 1) Aba com o bundle antigo salva um vínculo junto com uma mudança de regra.
  dados.atualizarEm('performanceCiclos', 'performance-2026-09', { entregas: [fantasma], regra: { orcamento: 1200 } } as never);
  await sync.trySync(); await esperar();
  // A regra chegou ao banco, o vínculo não; a tela recebeu o aviso; nada na caixa de falhas.
  expect(linhas[0].registro.regra).toEqual({ orcamento: 1200 });
  expect(linhas[0].registro.entregas).toEqual([]);
  expect(avisos.some(m => /PCP/.test(m))).toBe(true);
  expect(sync.falhasSync()).toEqual([]);
  // 2) O pull que o próprio envio dispara repõe a lista do banco na cópia local.
  await sync.pull();
  expect((dados.obter('performanceCiclos')[0] as unknown as { entregas: unknown[] }).entregas).toEqual([]);

  // 3) Tela nova, mesmo navegador: aprovação da proposta chega ao banco.
  dados.atualizarEm('performanceCiclos', 'performance-2026-09', { pessoas: [{ ...pessoa, aprovacao: { valor: 300, nota: 80, em: '2026-10-01T12:00:00Z', por: 'pessoa-teste', justificativa: 'teste', regra: { orcamento: 1200 } } }] } as never);
  await sync.trySync(); await esperar();
  expect((linhas[0].registro.pessoas as { aprovacao?: { valor: number } }[])[0].aprovacao?.valor).toBe(300);
  expect(linhas[0].registro.entregas).toEqual([]);
  expect((srv.enviados[srv.enviados.length - 1] as { entregas: unknown[] }).entregas).toEqual([]);
  expect(sync.falhasSync()).toEqual([]);
});

it('"Enviar tudo (computador oficial)" com vínculo na cópia local grava a lista do banco', async () => {
  const noBanco = { id: 'performance-2026-09', competencia: '2026-09', regra: { orcamento: 1000 }, pessoas: [], entregas: [], historico: [] };
  const { srv, dados, sync } = await preparar(noBanco);
  // Cópia local com vínculo (aba velha, ou cópia antiga), sem passar pelo upsert.
  dados.aplicarSemSync(() => dados.definirColecaoDinamica('performanceCiclos', [{ ...structuredClone(noBanco), entregas: [fantasma], _rhRev: 3 } as never]));
  await sync.previaEnviarTudo();
  await sync.enviarTudo();
  const retrato = srv.rpc.mock.calls.find(c => c[0] === 'rh_aplicar_retrato');
  const ciclos = (retrato![1].p_dados as Record<string, { entregas: unknown[] }[]>).performanceCiclos;
  expect(ciclos[0].entregas).toEqual([]);
});
