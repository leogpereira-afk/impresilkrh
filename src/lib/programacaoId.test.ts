// Equipe do PCP pelo ID do RH (ordem do Leonardo, 29/09/2026: "vamos usar o ID
// em todo o sistema e padrão pra não ter erro"). Handler real + banco simulado,
// dados fictícios: nenhuma O.S. ou pessoa de produção é lida ou gravada.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, it, expect, vi } from 'vitest';
import * as modelo from '../../supabase/functions/_shared/programacao';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';

const codigo = ts.transpileModule(readFileSync('supabase/functions/rh-programacao/index.ts', 'utf8').replace(/^import .*;\s*$/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
const versao = '2026-09-12T12:00:00+00:00';
const FICHAS = [
  { id: 'p', colecao: 'colaboradores', apagado: false, registro: { nome: 'Pessoa Teste', apelido: 'pessoa', cpf: '200001.123-45', statusId: 'ativo' } },
  { id: 'q', colecao: 'colaboradores', apagado: false, registro: { nome: 'Outra Pessoa', cpf: '20000298765', statusId: 'ativo' } },
  { id: 'sem-cpf', colecao: 'colaboradores', apagado: false, registro: { nome: 'Sem Documento', statusId: 'ativo' } },
  { id: 'rh', colecao: 'colaboradores', apagado: false, registro: { nome: 'Responsável', cpf: '20000311111', statusId: 'ativo' } },
];
function ambiente(os: Record<string, unknown>) {
  let handler!: (r: Request) => Promise<Response>;
  const linha = { id: 'os-a', colecao: 'os', apagado: false, atualizado_em: versao, registro: { id: 'os-a', numero: 'TESTE', instalacao: { data: '2026-09-14', hora: '07:30', duracaoDias: 1 }, veiculo: 'Carro', rev: 3, cliente: 'Cliente', finalizadaEm: '', liberadoPCP: false, carroLiberado: false, confirmacao: '', ...os } };
  const updates = vi.fn();
  const admin = { auth: { getUser: async (t: string) => ({ data: { user: t === 'valido' ? { id: 'auth' } : null }, error: null }) }, from: (t: string) => {
    let rows: Record<string, unknown>[] = t === 'perfis' ? [{ user_id: 'auth', colaborador_id: 'rh', perfil: 'ADMIN_RH', ativo: true }] : t === 'pcp_config_global' ? [{ config: { instaladores: ['Apelido', 'Carla'], veiculos: ['Carro'], vinculosRH: [{ apelido: 'Apelido', id: '200001', chave: 'p', nome: 'Pessoa Teste' }] } }] : t === 'registros' ? FICHAS.map(f => ({ ...f })) : [linha, ...(os._outras as Record<string, unknown>[] ?? [])];
    let one = false, patch: Record<string, unknown> | null = null, limite = Infinity;
    const q = { select: () => q, eq: (k: string, v: unknown) => { rows = rows.filter(r => r[k] === v); return q; }, in: (k: string, v: unknown[]) => { rows = rows.filter(r => v.includes(r[k])); return q; }, gt: (k: string, v: string) => { rows = rows.filter(r => String(r[k]) > v); return q; }, order: () => q, limit: (n: number) => { limite = n; return q; }, maybeSingle: () => { one = true; return q; }, update: (v: Record<string, unknown>) => { patch = v; return q; }, then: (resolve: (r: unknown) => unknown) => { if (patch) { updates(patch); rows = rows.map(r => ({ ...r, ...patch })); } return Promise.resolve(resolve({ data: one ? rows[0] ?? null : rows.slice(0, limite), error: null })); } };
    return q;
  } };
  runInNewContext(codigo, { ...modelo, createClient: () => admin, Deno: { env: { get: () => '' }, serve: (h: typeof handler) => { handler = h; } }, preflight: () => null, json: (b: unknown, status = 200) => new Response(JSON.stringify(b), { status }), Request, Response, Date, JSON, Map, Set, Number, String, Array });
  return { updates, chamar: (body: unknown) => handler(new Request('https://teste/rh-programacao', { method: 'POST', headers: { authorization: 'Bearer valido' }, body: JSON.stringify(body) })) };
}
const edicao = (participantes: { colaboradorId: string; nome: string; nomePCP: string }[]) => ({ id: 'os-a', versao, data: '2026-09-14', hora: '07:30', veiculo: 'Carro', dados: { ...modelo.dadosVazios(), participantes, lugares: 3, motoristaId: participantes[0]?.colaboradorId ?? '', gerenteId: 'rh' } });

describe('Equipe do PCP pelo ID do RH', () => {
  it('mapa de IDs: CPF repetido não liga ninguém; ficha sem CPF fica de fora', () => {
    const m = modelo.mapaPessoasPorId([...FICHAS, { id: 'gemeo', registro: { nome: 'Mesmo Começo', cpf: '20000199999' } }]);
    expect(m.has('200001')).toBe(false);
    expect(m.get('200002')).toEqual({ colaboradorId: 'q', nome: 'Outra Pessoa', desligado: false });
    expect([...m.values()].some(p => p.colaboradorId === 'sem-cpf')).toBe(false);
  });

  it('O.S. gravada por ID já chega ligada: sem "Conferir vínculo", com o nome da ficha', async () => {
    const r = await ambiente({ equipe: ['200001', 'Apelido'] }).chamar({ action: 'listar', mes: '2026-09' });
    expect(r.status).toBe(200);
    const o = (await r.json()).ordens[0];
    expect(o.dados.participantes).toEqual([{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: '200001' }]);
    // "Apelido" é a mesma pessoa pelo vínculo que o PCP salvou: mostra o nome dela.
    expect(modelo.nomesDaEquipe(o)).toEqual(['Pessoa Teste', 'Pessoa Teste']);
    expect(modelo.vinculosConferidos(o)).toBe(false);
    const soId = (await (await ambiente({ equipe: ['200001', '200002'] }).chamar({ action: 'listar', mes: '2026-09' })).json()).ordens[0];
    expect(modelo.vinculosConferidos(soId)).toBe(true);
  });

  it('salvar grava o ID de quem tem CPF, mesmo que a tela mande o apelido', async () => {
    const a = ambiente({ equipe: ['Apelido'] });
    const r = await a.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: 'Apelido' }, { colaboradorId: 'q', nome: 'Outra Pessoa', nomePCP: '' }]) });
    expect(r.status).toBe(200);
    const gravado = a.updates.mock.calls[0][0].registro;
    expect(gravado.equipe).toEqual(['200001', '200002']);
    expect(gravado.programacaoRH.participantes.map((p: { nomePCP: string }) => p.nomePCP)).toEqual(['200001', '200002']);
  });

  it('trocar o nome antigo pelo ID da mesma pessoa não é remarcar (O.S. já na rua não trava)', async () => {
    const a = ambiente({ equipe: ['Apelido'], carroLiberado: true, programacaoRH: { participantes: [{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: 'Apelido' }] } });
    const r = await a.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: 'Apelido' }]) });
    expect(r.status).toBe(200);
    expect(a.updates.mock.calls[0][0].registro.equipe).toEqual(['200001']);
    const b = ambiente({ equipe: ['Apelido'], carroLiberado: true, programacaoRH: { participantes: [{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: 'Apelido' }] } });
    expect((await b.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'q', nome: 'Outra Pessoa', nomePCP: '' }]) })).status).toBe(409);
  });

  it('Performance do RH: a pessoa gravada por ID conta, com o nome da ficha', () => {
    const porId = modelo.mapaPessoasPorId(FICHAS);
    const o = projetarOrdem({ id: 'os-a', equipe: ['200002', 'Apelido'], finalizadaEm: '2026-09-10' }, versao, porId);
    expect(o.participantesRH).toEqual(['q']);
    expect(o.equipe).toEqual(['Outra Pessoa', 'Apelido']);
  });
});

describe('Régua de pessoa igual à do PCP (mesmos casos de tests/pessoas-id.test.cjs)', () => {
  const F = [
    { chave: 'bruno-alves', id: '100001', nome: 'Bruno Alves Costa', apelido: 'bruno', desligado: false },
    { chave: 'bruno-martins', id: '100002', nome: 'Bruno Martins Dias', apelido: '', desligado: false },
    { chave: 'carla-lima', id: '100003', nome: 'Carla Souza Lima', apelido: '', desligado: false },
    { chave: 'carla-neves', id: '100004', nome: 'Carla Souza Neves', apelido: '', desligado: false },
    { chave: 'diego-ramos', id: '100005', nome: 'Diego Ramos', apelido: 'diego', desligado: false },
    { chave: 'elias-nunes', id: '100007', nome: 'Elias Nunes', apelido: '', desligado: false },
    { chave: 'elias-prado', id: '100006', nome: 'Elias Prado', apelido: '', desligado: true },
  ];
  const idDe = modelo.resolverIdPCP(F, [{ apelido: 'Diegão', id: '100005', chave: 'diego-ramos', nome: 'Diego Ramos' }]);
  it.each([['100002', '100002'], ['Bruno', '100001'], [' bruno ', '100001'], ['Bruno Martins', '100002'], ['Carla', ''], ['Carla Souza', ''], ['Carla Souza Lima', '100003'], ['Diegão', '100005'], ['Pantera', ''], ['Elias', ''], ['Elias Prado', ''], ['Elias Nunes', '100007']])('%s -> %s', (entrada, esperado) => {
    expect(idDe(entrada)).toBe(esperado);
  });
  it('"terceiro, sem ficha" salvo não casa com o xará', () => {
    expect(modelo.resolverIdPCP(F, [{ apelido: 'Diego', semFicha: true }])('Diego')).toBe('');
  });
});

describe('Revisão de 29/09: nome antigo e ID da mesma pessoa', () => {
  it('primeira gravação de O.S. programada pelo PCP (nome, sem participantes) não é remarcação', async () => {
    const a = ambiente({ equipe: ['Pessoa'], carroLiberado: true, confirmacao: 'Confirmado', confPor: 'PCP' });
    const r = await a.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: '' }]) });
    expect(r.status).toBe(200);
    const g = a.updates.mock.calls[0][0].registro;
    expect(g.equipe).toEqual(['200001']);
    expect(g.confirmacao).toBe('Confirmado');
  });
  it('conflito: a mesma pessoa por nome numa O.S. e por ID na outra', async () => {
    const outra = { id: 'os-b', colecao: 'os', apagado: false, atualizado_em: versao, registro: { id: 'os-b', numero: 'B', instalacao: { data: '2026-09-14', hora: '07:30', duracaoDias: 1 }, equipe: ['Apelido'], veiculo: 'Outro', finalizadaEm: '' } };
    const a = ambiente({ equipe: ['200002'], _outras: [outra] });
    const r = await a.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'p', nome: 'Pessoa Teste', nomePCP: '' }]) });
    expect(r.status).toBe(409);
    expect(a.updates).not.toHaveBeenCalled();
  });
  it('nome da lista que não leva a ninguém do RH fica como nome (o celular dele entra por ele)', async () => {
    const a = ambiente({ equipe: ['Carla'] });
    const r = await a.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'q', nome: 'Outra Pessoa', nomePCP: 'Carla' }]) });
    expect(r.status).toBe(200);
    expect(a.updates.mock.calls[0][0].registro.equipe).toEqual(['Carla']);
  });
  it('nome da lista que é de outra pessoa é recusado', async () => {
    const a = ambiente({ equipe: [] });
    const r = await a.chamar({ action: 'salvar', edicao: edicao([{ colaboradorId: 'q', nome: 'Outra Pessoa', nomePCP: 'Apelido' }]) });
    expect(r.status).toBe(400);
  });
});

describe('Confirmação do RH e a troca de nome pelo ID', () => {
  it('o PCP trocar o nome pelo ID da mesma pessoa não desfaz a confirmação; trocar a pessoa desfaz', () => {
    const porId = modelo.mapaPessoasPorId(FICHAS);
    const fichas = FICHAS.map(f => ({ id: String((f.registro as { cpf?: string }).cpf ?? '').replace(/\D/g, '').slice(0, 6), chave: f.id, nome: f.registro.nome, apelido: String((f.registro as { apelido?: string }).apelido ?? ''), desligado: false }));
    const ctx = { porId, idDe: modelo.resolverIdPCP(fichas, [{ apelido: 'Apelido', id: '200001', chave: 'p', nome: 'Pessoa Teste' }]) };
    const confirmado = { dia: '2026-09-14', em: '2026-09-14T10:00:00Z', por: 'rh', canal: 'Telefone', contato: 'Cliente' };
    const base = (equipe: string[]) => ({ id: 'os-a', instalacao: { data: '2026-09-14', hora: '07:30' }, veiculo: 'Carro', equipe, programacaoRH: { participantes: [], confirmado, referenciaAgenda: JSON.stringify(['2026-09-14', '07:30', ['Apelido'], 'Carro']) } });
    expect(modelo.projetarProgramacao(base(['200001']), versao, ctx).dados.confirmado?.contato).toBe('Cliente');
    expect(modelo.projetarProgramacao(base(['200002']), versao, ctx).dados.confirmado).toBeUndefined();
  });
});
