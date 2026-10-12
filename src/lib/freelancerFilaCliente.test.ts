// F07 NA FILA DO APARELHO (12/10/2026): cliente REAL (sync.ts + store.ts)
// ligado ao handler REAL da function sync, como em idPessoaSyncCliente.test.ts.
// O caso ruim: o aparelho manda pela fila um contrato de instalador que a
// régua do CPF recusa (aba com o bundle antigo, cópia local diferente do
// banco). Antes a porta respondia 422: o envio voltava a cada ciclo, ia para
// a caixa de falhas depois de 25 tentativas, e o contrato digitado ficava só
// no aparelho. Agora a fila esvazia, o banco recebe tudo menos o que a régua
// recusa, o digitado não se perde, e o aparelho adota o que o servidor gravou.
// Dados, CPFs e IDs fictícios.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';
import { mapaPessoasPorId } from '../../supabase/functions/_shared/programacao';
import { contaApontadaAoSocio, lerVinculosSocioConta } from '../../supabase/functions/_shared/socioConta';
// A régua do ID da pessoa entra pela mesma porta (o import do servidor é apagado).
import * as reguaIdPessoa from '../../supabase/functions/_shared/idPessoa';
// A régua do CPF do contrato (F07) também entra pela mesma porta.
import { contratoNaPorta, cpfPendente, AVISO_CPF_PENDENTE, AVISO_CPF_RECUSADO_MANTIDO } from '../../supabase/functions/_shared/freelancerContrato';

vi.mock('./auth', () => ({ MODO_JWT: true, tokenAtual: () => 'teste' }));
vi.mock('./supabase', () => ({ FN_SYNC: 'http://rh-teste.local/sync' }));

const codigo = ts.transpileModule(readFileSync('supabase/functions/sync/index.ts', 'utf8').replace(/^import .*;\s*$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
type Linha = { id: string; colecao: string; registro: Record<string, unknown>; apagado: boolean; rh_versao: number };

function servidor(linhas: Linha[], durante?: (corpo: Record<string, unknown>) => void) {
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
  runInNewContext(codigo, { Deno: { env: { get: () => '' }, serve: (h: typeof handler) => { handler = h; } }, createClient: () => admin, ...reguaIdPessoa, contratoNaPorta, projetarOrdem, mapaPessoasPorId, contaApontadaAoSocio, lerVinculosSocioConta, preflight: () => null, json: (b: unknown, status = 200) => new Response(JSON.stringify(b), { status }), console: { ...console, warn: vi.fn(), error: vi.fn() }, crypto, Request, Response, Date, Set, Map, URL, Uint8Array, atob, btoa });
  const fetchRoteado = vi.fn(async (_url: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body));
    if (corpo.action === 'upsert') { enviados.push(structuredClone(corpo.registro)); durante?.(corpo); }
    return handler(new Request('https://rh.test/sync', { method: 'POST', headers: { authorization: 'Bearer teste' }, body: String(init.body) }));
  });
  return { rpc, enviados, fetchRoteado };
}
const esperar = async (n = 10) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

beforeEach(() => {
  vi.resetModules(); localStorage.clear();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  vi.spyOn(window, 'addEventListener').mockImplementation(() => {});
  vi.spyOn(document, 'addEventListener').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

const CPF_OK = '300.005.987-39';     // fictício, verificadores certos: ID 300005
const CPF_ERRADO = '300.005.987-38'; // fictício, verificador errado
const instalador = { id: 'fl-1', nome: 'Prestador Fictício', funcao: 'Instalador', situacao: 'ativo', contratoFim: '2099-12-31', cpf: CPF_OK, idPessoa: '300005', valor: 900 };

async function preparar(linhas: Linha[], durante?: (corpo: Record<string, unknown>) => void) {
  const srv = servidor(linhas, durante);
  vi.stubGlobal('fetch', srv.fetchRoteado);
  const sessao = await import('./session'); sessao.entrar('ADMIN_RH', 'pessoa-teste');
  const dados = await import('./store'); const sync = await import('./sync');
  await esperar(30); // o pull de quando o app abre termina antes do caso começar
  const avisos: string[] = [];
  vi.spyOn(window, 'dispatchEvent').mockImplementation((e: Event) => { if (e.type === 'impresilk:aviso-sync') avisos.push((e as CustomEvent).detail.mensagem); return true; });
  return { linhas, srv, dados, sync, avisos };
}
const contratoLocal = (dados: { obter: (n: 'freelancers') => unknown[] }, id: string) =>
  (dados.obter('freelancers') as Record<string, unknown>[]).find(r => r.id === id);
const noBanco = (linhas: Linha[], id: string) => linhas.find(l => l.colecao === 'freelancers' && l.id === id)?.registro;

it('CPF que não confere na fila: a fila esvazia, o resto do contrato chega ao banco e o digitado fica em cpfRecusado', async () => {
  const { linhas, dados, sync, avisos } = await preparar([{ id: 'fl-1', colecao: 'freelancers', registro: structuredClone(instalador), apagado: false, rh_versao: 3 }]);
  expect(contratoLocal(dados, 'fl-1')?.cpf).toBe(CPF_OK); // o pull de abertura trouxe o contrato
  // A aba com o bundle antigo grava sem conferir; atrás dele, outro contrato na fila.
  dados.atualizarEm('freelancers', 'fl-1', { cpf: CPF_ERRADO, valor: 1200 } as never);
  dados.criarEm('freelancers', { id: 'fl-2', nome: 'Montador Fictício', funcao: 'Montador', situacao: 'ativo', contratoFim: '2099-12-31' } as never);
  // O atualizarEm já disparou um envio; o criarEm entrou na fila com ele em
  // andamento e sobe no gatilho seguinte (como no app, a cada minuto).
  await esperar(30); await sync.trySync(); await esperar(30);

  // Nada preso: fila vazia, caixa de falhas vazia.
  expect(sync.pendentesSync()).toBe(0);
  expect(sync.falhasSync()).toEqual([]);
  // O banco: o valor novo entrou, o CPF que não confere não, e o ID não mudou.
  expect(noBanco(linhas, 'fl-1')).toMatchObject({ cpf: CPF_OK, cpfRecusado: CPF_ERRADO, valor: 1200, idPessoa: '300005' });
  expect(noBanco(linhas, 'fl-2')).toMatchObject({ nome: 'Montador Fictício' });
  // Quem está com o app aberto vê o aviso, e a cópia do aparelho é a do banco.
  expect(avisos).toContain(AVISO_CPF_RECUSADO_MANTIDO);
  expect(contratoLocal(dados, 'fl-1')).toMatchObject({ cpf: CPF_OK, cpfRecusado: CPF_ERRADO, valor: 1200 });
});

it('contrato novo de instalador sem CPF na fila: salvo como digitado, com CPF pendente e aviso', async () => {
  const { linhas, dados, sync, avisos } = await preparar([]);
  dados.criarEm('freelancers', { id: 'fl-9', nome: 'Instalador Novo Fictício', funcao: 'Instalador', situacao: 'ativo', contratoFim: '2099-12-31', valor: 650, observacoes: 'combinado por diária' } as never);
  await sync.trySync(); await esperar(30);
  expect(sync.pendentesSync()).toBe(0);
  expect(sync.falhasSync()).toEqual([]);
  const gravado = noBanco(linhas, 'fl-9')!;
  expect(gravado).toMatchObject({ nome: 'Instalador Novo Fictício', valor: 650, observacoes: 'combinado por diária' });
  expect(gravado).not.toHaveProperty('idPessoa');
  expect(cpfPendente(gravado)).toBe(true);
  expect(avisos).toContain(AVISO_CPF_PENDENTE);
  expect(contratoLocal(dados, 'fl-9')).toMatchObject({ valor: 650, observacoes: 'combinado por diária' });
});

it('outra edição do mesmo contrato feita durante o envio não é apagada pela resposta do servidor', async () => {
  let editou = false;
  let dadosRef: { atualizarEm: (n: 'freelancers', id: string, p: never) => void } | null = null;
  const { linhas, dados, sync } = await preparar(
    [{ id: 'fl-1', colecao: 'freelancers', registro: structuredClone(instalador), apagado: false, rh_versao: 3 }],
    (corpo) => {
      if (editou || corpo.colecao !== 'freelancers' || !dadosRef) return;
      editou = true; // com o primeiro envio no ar, a pessoa edita de novo
      dadosRef.atualizarEm('freelancers', 'fl-1', { observacoes: 'edição feita durante o envio' } as never);
    },
  );
  dadosRef = dados as never;
  dados.atualizarEm('freelancers', 'fl-1', { cpf: CPF_ERRADO, valor: 1200 } as never);
  await sync.trySync(); await esperar(30);
  // A segunda edição continua na cópia e na fila; sobe no ciclo seguinte.
  expect(contratoLocal(dados, 'fl-1')).toMatchObject({ observacoes: 'edição feita durante o envio' });
  expect(sync.pendentesSync()).toBe(1);
  await sync.trySync(); await esperar(30);
  expect(sync.pendentesSync()).toBe(0);
  expect(sync.falhasSync()).toEqual([]);
  expect(noBanco(linhas, 'fl-1')).toMatchObject({ cpf: CPF_OK, cpfRecusado: CPF_ERRADO, valor: 1200, observacoes: 'edição feita durante o envio' });
  expect(contratoLocal(dados, 'fl-1')).toMatchObject({ cpf: CPF_OK, observacoes: 'edição feita durante o envio' });
});
