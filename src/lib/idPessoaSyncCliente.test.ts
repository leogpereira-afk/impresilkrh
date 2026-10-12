// O ID DA PESSOA (D-004), de ponta a ponta: cliente REAL (sync.ts + store.ts)
// ligado ao handler REAL da function sync, como em performanceSyncCliente.test.ts.
// O caso ruim é o aparelho com a cópia de ANTES do ID gravado: ele corrige o CPF
// e manda a ficha sem o campo. Dados, CPFs e IDs fictícios.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';
import { mapaPessoasPorId } from '../../supabase/functions/_shared/programacao';
import { contaApontadaAoSocio, lerVinculosSocioConta } from '../../supabase/functions/_shared/socioConta';
// A régua do ID da pessoa entra pela mesma porta (o import do servidor é apagado).
import * as reguaIdPessoa from '../../supabase/functions/_shared/idPessoa';

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
  runInNewContext(codigo, { Deno: { env: { get: () => '' }, serve: (h: typeof handler) => { handler = h; } }, createClient: () => admin, ...reguaIdPessoa, projetarOrdem, mapaPessoasPorId, contaApontadaAoSocio, lerVinculosSocioConta, preflight: () => null, json: (b: unknown, status = 200) => new Response(JSON.stringify(b), { status }), console: { ...console, warn: vi.fn(), error: vi.fn() }, crypto, Request, Response, Date, Set, Map, URL, Uint8Array, atob, btoa });
  const fetchRoteado = vi.fn(async (_url: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body));
    if (corpo.action === 'upsert') enviados.push(structuredClone(corpo.registro));
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


const CPF_A = '123.456.789-09';           // fictício: ID 123456
const CPF_A_CORRIGIDO = '987.654.321-00'; // fictício
const CPF_OUTRO_123456 = '123.456.111-54'; // fictício: outra pessoa, mesmo começo

async function preparar(linhas: Linha[], local: Record<string, unknown>[] = []) {
  const srv = servidor(linhas);
  vi.stubGlobal('fetch', srv.fetchRoteado);
  const sessao = await import('./session'); sessao.entrar('ADMIN_RH', 'pessoa-teste');
  const dados = await import('./store'); const sync = await import('./sync');
  await esperar(30); // o pull de quando o app abre termina antes do caso começar
  dados.aplicarSemSync(() => dados.definirColecaoDinamica('colaboradores', local.map(r => structuredClone(r)) as never));
  const avisos: string[] = [];
  vi.spyOn(window, 'dispatchEvent').mockImplementation((e: Event) => { if (e.type === 'impresilk:aviso-sync') avisos.push((e as CustomEvent).detail.mensagem); return true; });
  return { linhas, srv, dados, sync, avisos };
}
const fichaLocal = (dados: { obter: (n: 'colaboradores') => unknown[] }, id: string) =>
  (dados.obter('colaboradores') as Record<string, unknown>[]).find(r => r.id === id);

it('aparelho com a cópia de antes corrige o CPF: o ID gravado fica no banco e volta para a cópia', async () => {
  const noBanco = { id: 'f1', nome: 'Pessoa Fictícia', cpf: CPF_A, idPessoa: '123456', idPessoaEm: '2026-10-12T12:00:00.000Z' };
  const { cpf: _c, idPessoa: _i, idPessoaEm: _e, ...semId } = noBanco;
  const { linhas, dados, sync, avisos, srv } = await preparar(
    [{ id: 'f1', colecao: 'colaboradores', registro: structuredClone(noBanco), apagado: false, rh_versao: 3 }],
    [{ ...semId, cpf: CPF_A, _rhRev: 3 }],
  );
  dados.atualizarEm('colaboradores', 'f1', { cpf: CPF_A_CORRIGIDO } as never);
  await sync.trySync(); await esperar();
  expect(srv.enviados[0]).not.toHaveProperty('idPessoa'); // o aparelho mandou mesmo sem o campo
  expect(linhas[0].registro).toMatchObject({ cpf: CPF_A_CORRIGIDO, idPessoa: '123456', idPessoaEm: '2026-10-12T12:00:00.000Z' });
  expect(sync.falhasSync()).toEqual([]);
  expect(avisos).toEqual([]);
  expect(fichaLocal(dados, 'f1')?.idPessoa).toBe('123456');
  // A edição seguinte já sai com o campo, e continua igual no banco.
  dados.atualizarEm('colaboradores', 'f1', { nome: 'Pessoa Fictícia Silva' } as never);
  await sync.trySync(); await esperar();
  expect(linhas[0].registro).toMatchObject({ nome: 'Pessoa Fictícia Silva', idPessoa: '123456' });
});

it('ficha nova: o ID nasce no servidor e a cópia do aparelho o recebe na resposta', async () => {
  const { linhas, dados, sync, srv } = await preparar([]);
  dados.criarEm('colaboradores', { id: 'f9', nome: 'Pessoa Nova Fictícia', cpf: CPF_A } as never);
  await sync.trySync(); await esperar();
  expect(linhas.find(l => l.id === 'f9')?.registro.idPessoa).toBe('123456');
  // Sem pull depois do envio: o ID chegou à cópia pela resposta do upsert.
  const acoes = srv.fetchRoteado.mock.calls.map(c => JSON.parse(String((c[1] as RequestInit).body)).action as string);
  expect(acoes.slice(acoes.indexOf('upsert'))).toEqual(['upsert']);
  expect(fichaLocal(dados, 'f9')?.idPessoa).toBe('123456');
  expect(sync.falhasSync()).toEqual([]);
});

it('ficha nova com o ID de outra pessoa: grava sem o ID, avisa, e nada fica preso na fila', async () => {
  const outro = { id: 'f1', nome: 'Outra Pessoa Fictícia', cpf: CPF_A, idPessoa: '123456' };
  const { linhas, dados, sync, avisos } = await preparar(
    [{ id: 'f1', colecao: 'colaboradores', registro: structuredClone(outro), apagado: false, rh_versao: 3 }],
    [{ ...outro, _rhRev: 3 }],
  );
  dados.criarEm('colaboradores', { id: 'f2', nome: 'Pessoa Nova Fictícia', cpf: CPF_OUTRO_123456 } as never);
  await sync.trySync(); await esperar();
  const nova = linhas.find(l => l.id === 'f2')!;
  expect(nova.registro.cpf).toBe(CPF_OUTRO_123456);
  expect(nova.registro).not.toHaveProperty('idPessoa');
  expect(avisos.some(m => /sem o ID da pessoa/.test(m))).toBe(true);
  expect(sync.falhasSync()).toEqual([]);
  expect(sync.pendentesSync()).toBe(0);
});
