// Executa o handler publicado, com banco e autenticação simulados.
// Nenhuma requisição de teste consulta pessoas ou O.S. reais.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { projetarOrdem } from '../../supabase/functions/_shared/performanceOS';

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
  runInNewContext(codigos[modo],{Deno:{env:{get:()=>''},serve:(h:typeof handler)=>{handler=h;}},createClient:()=>admin,projetarOrdem,preflight:()=>null,json:(b:unknown,status=200)=>new Response(JSON.stringify(b),{status}),console:{...console,warn:vi.fn()},crypto,Request,Response,Date,Set,Map,URL,Uint8Array,atob,btoa});
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
