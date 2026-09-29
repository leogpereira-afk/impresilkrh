// Executa o handler publicado, com banco e autenticação simulados.
// Nenhuma requisição de teste consulta pessoas ou O.S. reais.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';
import { mapaPessoasPorId } from '../../supabase/functions/_shared/programacao';
import { contaApontadaAoSocio, lerVinculosSocioConta } from '../../supabase/functions/_shared/socioConta';

const compilar=(nome:string)=>ts.transpileModule(readFileSync(`supabase/functions/${nome}/index.ts`,'utf8').replace(/^import .*;\s*$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const codigos={leitura:compilar('rh-performance'),sync:compilar('sync')};
type Linha={id:string;colecao?:string;registro:Record<string,unknown>;apagado?:boolean;atualizado_em?:string};
function ambiente(perfil='ADMIN_RH',linhas:Linha[]=[],falhaPCP=false,ativo=true,modo:'leitura'|'sync'='leitura') {
  let handler!:(r:Request)=>Promise<Response>;
  const tabelas:string[]=[];
  const rpc=vi.fn(async()=>({data:{ok:true,versao:1},error:null}));
  const admin={auth:{getUser:async(token:string)=>({data:{user:token==='teste'?{id:'auth-teste'}:null},error:null})},rpc,from:(tabela:string)=>{
    tabelas.push(tabela);
    let lista=linhas;let limite=Infinity;let individual=false;
    const q={select:()=>q,eq:(campo:string,valor:unknown)=>{if(tabela!=='perfis')lista=lista.filter(l=>l[campo as keyof Linha]===valor);return q;},in:(campo:string,valores:unknown[])=>{lista=lista.filter(l=>valores.includes(l[campo as keyof Linha]));return q;},order:()=>q,limit:(n:number)=>{limite=n;return q;},range:()=>q,gt:(_campo:string,valor:string)=>{lista=lista.filter(l=>l.id>valor);return q;},maybeSingle:()=>{individual=true;return q;},then:(resolve:(r:unknown)=>unknown)=>Promise.resolve(resolve({data:tabela==='perfis'?{colaborador_id:'pessoa-teste',perfil,ativo}:tabela==='config_global'?{config:{}}:individual?lista[0]??null:lista.slice(0,limite),error:tabela==='pcp_registros'&&falhaPCP?{message:'erro de teste'}:null}))};
    return q;
  }};
  runInNewContext(codigos[modo],{Deno:{env:{get:()=>''},serve:(h:typeof handler)=>{handler=h;}},createClient:()=>admin,projetarOrdem,mapaPessoasPorId,contaApontadaAoSocio,lerVinculosSocioConta,preflight:()=>null,json:(b:unknown,status=200)=>new Response(JSON.stringify(b),{status}),console:{...console,warn:vi.fn()},crypto,Request,Response,Date,Set,Map,URL,Uint8Array,atob,btoa});
  return {rpc,tabelas,chamar:(body:unknown,token='teste')=>handler(new Request('https://rh.test/sync',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)}))};
}
const ordem=(id:string,data='2026-09-12T15:00:00Z'):Linha=>({id,colecao:'os',apagado:false,atualizado_em:data,registro:{numero:id,finalizadaEm:data,cliente:'Cliente de teste',equipe:['Equipe de teste'],cpf:'NÃO PUBLICAR',telefone:'NÃO PUBLICAR',checkout:{gps:{latitude:1}}}});
describe('porta de dados de Plantões e Performance',()=>{
  it('exige autenticação válida',async()=>{for(const token of ['','invalido']){const a=ambiente();expect((await a.chamar({action:'performanceOS',competencia:'2026-09'},token)).status).toBe(401);expect(a.tabelas).not.toContain('pcp_registros');}});
  it('recusa perfil inativo',async()=>{const a=ambiente('ADMIN_RH',[],false,false);expect((await a.chamar({action:'performanceOS',competencia:'2026-09'})).status).toBe(401);});
  it.each(['GESTOR','COLABORADOR'])('não entrega O.S. financeiras a %s',async perfil=>{const a=ambiente(perfil);expect((await a.chamar({action:'performanceOS',competencia:'2026-09'})).status).toBe(403);expect(a.tabelas).not.toContain('pcp_registros');});
  it('valida o mês antes de consultar',async()=>{const a=ambiente();expect((await a.chamar({action:'performanceOS',competencia:'2026-13'})).status).toBe(400);expect(a.tabelas).not.toContain('pcp_registros');});
  it('lê além de 500 O.S., filtra conclusão local e não expõe campos privados',async()=>{
    const linhas=Array.from({length:501},(_,i)=>ordem(String(i).padStart(4,'0')));
    linhas.push(ordem('fora','2026-10-01T15:00:00Z'),ordem('virada','2026-10-01T01:00:00Z'));
    const a=ambiente('ADMIN_RH',linhas);const r=await a.chamar({action:'performanceOS',competencia:'2026-09'});const body=await r.json();
    expect(r.status).toBe(200);expect(body.ordens).toHaveLength(502);expect(body.ordens.some((o:{id:string})=>o.id==='0500')).toBe(true);expect(body.ordens.find((o:{id:string})=>o.id==='virada').finalizadaEm).toBe('2026-09-30');expect(JSON.stringify(body)).not.toContain('NÃO PUBLICAR');expect(JSON.stringify(body)).not.toContain('latitude');expect(a.rpc).not.toHaveBeenCalled();
  });
  it('falha de banco não se apresenta como lista vazia',async()=>{const r=await ambiente('ADMIN_RH',[],true).chamar({action:'performanceOS',competencia:'2026-09'});expect(r.status).toBeGreaterThanOrEqual(400);expect((await r.json()).ordens).toBeUndefined();});
  for(const colecao of ['plantoes','equipesPlantoes','performanceCiclos']){
    it(`${colecao}: somente RH lê e grava`,async()=>{
      const linha={id:'registro-teste',colecao,apagado:false,registro:{id:'registro-teste',colaboradorId:'pessoa-teste',privado:'conteudo RH'}};
      for(const perfil of ['GESTOR','COLABORADOR']){
        const a=ambiente(perfil,[linha],false,true,'sync');const leitura=await a.chamar({action:'list',colecoes:[colecao]});expect((await leitura.json()).registros).toEqual([]);
        expect((await a.chamar({action:'upsert',colecao,registro:linha.registro,baseVersao:0,mutationId:'teste'})).status).toBe(403);expect(a.rpc).not.toHaveBeenCalled();
        expect((await a.chamar({action:'delete',colecao,id:linha.id,baseVersao:1,mutationId:'teste'})).status).toBe(403);
      }
      const a=ambiente('ADMIN_RH',[linha],false,true,'sync');expect((await (await a.chamar({action:'list',colecoes:[colecao]})).json()).registros).toHaveLength(1);
      expect((await a.chamar({action:'upsert',colecao,registro:linha.registro,baseVersao:1,mutationId:'teste'})).status).toBe(200);expect(a.rpc).toHaveBeenCalledWith('rh_gravar_seguro',expect.objectContaining({p_colecao:colecao,p_versao:1,p_apagar:false}));
    });
  }
});

/* F02 (29/09/2026): o percentual de cada pessoa na O.S. passa a morar só dentro
   da O.S., no PCP. A apuração do RH (performanceCiclos) continua lida e editável
   no resto (critérios, metas, aprovação), mas a lista `entregas` (vínculo de O.S.
   com participação) não muda mais por aqui: o servidor grava SEMPRE a lista
   guardada no banco e avisa quando descartou a enviada.
   Antes (primeira versão da F02) era 410, e o 410 recusava o registro inteiro:
   o vínculo recusado ficava na cópia local e prendia toda gravação seguinte do
   mês, inclusive aprovação de bonificação (prova no teste de cliente abaixo). */
describe('performanceCiclos: participação por O.S. fechada no RH', () => {
  const entrega = { id: 'e1', colaboradorId: 'pessoa-teste', os: { id: 'os-1', numero: 'TESTE-1', cliente: 'Cliente de teste' }, participacao: 60, complexidade: 2, aceite: true, qualidade: 'sem_retrabalho', prazo: 'no_prazo', evidencia: '', justificativa: '' };
  const ciclo = (entregas: unknown[] | undefined, extra: Record<string, unknown> = {}) => ({ id: 'ciclo-2026-09', competencia: '2026-09', regra: { orcamento: 0 }, pessoas: [], historico: [], ...(entregas === undefined ? {} : { entregas }), ...extra });
  const guardado = (entregas: unknown[]): Linha => ({ id: 'ciclo-2026-09', colecao: 'performanceCiclos', apagado: false, registro: ciclo(entregas) });
  const enviar = (linhas: Linha[], registro: unknown) => { const a = ambiente('ADMIN_RH', linhas, false, true, 'sync'); return { a, r: a.chamar({ action: 'upsert', colecao: 'performanceCiclos', registro, baseVersao: 1, mutationId: 'teste' }) }; };
  const gravado = (a: ReturnType<typeof ambiente>) => { const c = (a.rpc.mock.calls as unknown as [string, Record<string, unknown>][]).find(x => x[0] === 'rh_gravar_seguro'); expect(c).toBeTruthy(); return c![1].p_registro as Record<string, unknown>; };
  /* Descarta com aviso: grava o resto (regra muda para 500) com a lista guardada. */
  const descarta = async (linhas: Linha[], registro: Record<string, unknown>, guardadas: unknown[]) => {
    const { a, r } = enviar(linhas, { ...registro, regra: { orcamento: 500 } });
    const resp = await r; expect(resp.status).toBe(200);
    expect((await resp.json()).aviso).toMatch(/PCP/);
    const g = gravado(a); expect(g.entregas).toEqual(guardadas); expect(g.regra).toEqual({ orcamento: 500 });
  };
  it('incluir vínculo de O.S. numa apuração sem vínculos', () => descarta([guardado([])], ciclo([entrega]), []));
  it('mudar a participação de um vínculo existente', () => descarta([guardado([entrega])], ciclo([{ ...entrega, participacao: 100 }]), [entrega]));
  it('remover um vínculo existente', () => descarta([guardado([entrega])], ciclo([]), [entrega]));
  it('omitir o campo entregas quando o banco tem vínculos (não apaga em silêncio)', () => descarta([guardado([entrega])], ciclo(undefined), [entrega]));
  it('apuração nova já com vínculo', () => descarta([], ciclo([entrega]), []));
  it('entregas em formato estranho (objeto no lugar da lista)', () => descarta([guardado([])], ciclo(undefined, { entregas: { e1: entrega } }), []));
  it('o resto da apuração grava sem aviso: critérios mudam, vínculos iguais (mesmo em outra ordem de chaves)', async () => {
    const reordenada = Object.fromEntries(Object.entries(entrega).reverse());
    const { a, r } = enviar([guardado([entrega])], ciclo([reordenada], { regra: { orcamento: 500 } }));
    const resp = await r; expect(resp.status).toBe(200); expect((await resp.json()).aviso).toBeUndefined();
    expect(a.rpc).toHaveBeenCalledWith('rh_gravar_seguro', expect.objectContaining({ p_colecao: 'performanceCiclos' }));
  });
  it('apuração apagada (lápide com vínculos) recomeça vazia; vínculo novo é descartado', async () => {
    const lapide = { ...guardado([entrega]), apagado: true };
    const { a, r } = enviar([lapide], ciclo([]));
    const resp = await r; expect(resp.status).toBe(200); expect((await resp.json()).aviso).toBeUndefined();
    expect(gravado(a).entregas).toEqual([]);
    await descarta([lapide], ciclo([{ ...entrega, id: 'e2' }]), []);
  });
  it('apuração nova sem vínculos grava normalmente', async () => {
    const { a, r } = enviar([], ciclo([]));
    expect((await r).status).toBe(200);
    expect(gravado(a).entregas).toEqual([]);
  });
  it('conflito de versão responde conflito (não aviso) mesmo com vínculo diferente', async () => {
    const a = ambiente('ADMIN_RH', [guardado([])], false, true, 'sync');
    a.rpc.mockImplementationOnce((async () => ({ data: { conflito: true, servidor: { colecao: 'performanceCiclos', registro: ciclo([]) } }, error: null })) as never);
    const body = await (await a.chamar({ action: 'upsert', colecao: 'performanceCiclos', registro: ciclo([entrega]), baseVersao: 0, mutationId: 'teste' })).json();
    expect(body.conflito).toBe(true); expect(body.aviso).toBeUndefined(); expect(body.servidor).toBeTruthy();
  });
  it('"Enviar tudo" e importação (aplicarRetrato) levam a lista guardada, não a da cópia local', async () => {
    const outro = { ...guardado([]), id: 'ciclo-2026-08', registro: { ...ciclo([]), id: 'ciclo-2026-08' } };
    const a = ambiente('ADMIN_RH', [guardado([entrega]), outro], false, true, 'sync');
    const dados = { performanceCiclos: [
      { ...ciclo([{ ...entrega, participacao: 100 }, { ...entrega, id: 'e9' }]), regra: { orcamento: 700 } },
      { ...ciclo([entrega]), id: 'ciclo-2026-08' },
      { ...ciclo([entrega]), id: 'ciclo-2026-07' },
    ], plantoes: [{ id: 'p1' }] };
    const resp = await a.chamar({ action: 'aplicarRetrato', dados, rev: 1, substituir: true });
    expect(resp.status).toBe(200); expect((await resp.json()).aviso).toMatch(/PCP/);
    const c = (a.rpc.mock.calls as unknown as [string, Record<string, unknown>][]).find(x => x[0] === 'rh_aplicar_retrato')!;
    const p = c[1].p_dados as { performanceCiclos: { id: string; entregas: unknown[]; regra: unknown }[]; plantoes: unknown[] };
    expect(p.performanceCiclos.map(x => [x.id, x.entregas])).toEqual([['ciclo-2026-09', [entrega]], ['ciclo-2026-08', []], ['ciclo-2026-07', []]]);
    expect(p.performanceCiclos[0].regra).toEqual({ orcamento: 700 });
    expect(p.plantoes).toEqual([{ id: 'p1' }]);
  });
  it('aplicarRetrato sem performanceCiclos não consulta as apurações', async () => {
    const a = ambiente('ADMIN_RH', [guardado([entrega])], false, true, 'sync');
    const resp = await a.chamar({ action: 'aplicarRetrato', dados: { plantoes: [] }, rev: 1, substituir: false });
    expect(resp.status).toBe(200); expect((await resp.json()).aviso).toBeUndefined();
    const c = (a.rpc.mock.calls as unknown as [string, Record<string, unknown>][]).find(x => x[0] === 'rh_aplicar_retrato')!;
    expect(c[1].p_dados).toEqual({ plantoes: [] });
  });
  it('aplicarRetrato com performanceCiclos fora de lista é recusado antes do banco', async () => {
    const a = ambiente('ADMIN_RH', [], false, true, 'sync');
    expect((await a.chamar({ action: 'aplicarRetrato', dados: { performanceCiclos: { x: 1 } }, rev: 1 })).status).toBe(400);
    expect(a.rpc).not.toHaveBeenCalled();
  });
});
