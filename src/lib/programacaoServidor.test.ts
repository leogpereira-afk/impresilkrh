// Handler real + banco simulado: nenhuma O.S. ou pessoa de produção é gravada.
// Desde 29/09/2026 (F02) a porta só LÊ: a programação mora no PCP, dentro da
// O.S. Os testes que fixavam a gravação (agenda, confirmação, remarcação,
// disputa de versão) viraram testes de porta fechada: qualquer 'salvar',
// válido ou forjado, recebe 410 sem ler nem gravar pcp_registros.
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe,it,expect,vi } from 'vitest';
import * as modelo from '../../supabase/functions/_shared/programacao';
const codigo=ts.transpileModule(readFileSync('supabase/functions/rh-programacao/index.ts','utf8').replace(/^import .*;\s*$/gm,''),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText;
const versao='2026-09-12T12:00:00+00:00';
const original=()=>({id:'os-a',colecao:'os',apagado:false,atualizado_em:versao,registro:{id:'os-a',numero:'TESTE',instalacao:{data:'2026-09-14',hora:'07:30',duracaoDias:1},equipe:['Apelido'],veiculo:'Carro',rev:3,cliente:'Cliente reservado',valor:920,finalizadaEm:'',fotosRetornoIds:['foto'],liberadoPCP:false,carroLiberado:false,confirmacao:''}});
function ambiente(op:{perfil?:string;ativo?:boolean;falha?:boolean;sumiu?:boolean;concorrente?:boolean;inativo?:boolean;fechada?:boolean}={}){
 let handler!:(r:Request)=>Promise<Response>;
 const linha=original();if(op.fechada)linha.registro.finalizadaEm='2026-09-12';
 const updates=vi.fn(),tabelas:string[]=[];
 const admin={auth:{getUser:async(t:string)=>({data:{user:t==='valido'?{id:'auth'}:null},error:null})},from:(t:string)=>{
  tabelas.push(t);
  let rows:Record<string,unknown>[]=t==='perfis'?[{user_id:'auth',colaborador_id:'rh',perfil:op.perfil??'ADMIN_RH',ativo:op.ativo??true}]:t==='pcp_config_global'?[{config:{instaladores:['Apelido'],veiculos:['Carro']}}]:t==='registros'?[{id:'p',colecao:'colaboradores',apagado:false,registro:{nome:'Pessoa Teste',statusId:op.inativo?'inativo':'ativo'}},{id:'rh',colecao:'colaboradores',apagado:false,registro:{nome:'Responsável',statusId:'ativo'}}]:op.sumiu?[]:[linha];
  let one=false,patch:Record<string,unknown>|null=null,limite=Infinity;
  const q={select:()=>q,eq:(k:string,v:unknown)=>{rows=rows.filter(r=>r[k]===v);return q;},in:(k:string,v:unknown[])=>{rows=rows.filter(r=>v.includes(r[k]));return q;},gt:(k:string,v:string)=>{rows=rows.filter(r=>String(r[k])>v);return q;},order:()=>q,limit:(n:number)=>{limite=n;return q;},maybeSingle:()=>{one=true;return q;},update:(v:Record<string,unknown>)=>{patch=v;return q;},then:(resolve:(r:unknown)=>unknown)=>{if(patch){updates(patch);rows=op.concorrente?[]:rows.map(r=>({...r,...patch}));}return Promise.resolve(resolve({data:one?rows[0]??null:rows.slice(0,limite),error:op.falha&&t==='pcp_registros'?{message:'falha'}:null}));}};return q;
 }};
 runInNewContext(codigo,{...modelo,createClient:()=>admin,Deno:{env:{get:()=>''},serve:(h:typeof handler)=>{handler=h;}},preflight:()=>null,json:(b:unknown,status=200)=>new Response(JSON.stringify(b),{status}),Request,Response,Date,JSON,Map,Set,Number,String,Array});
 return {updates,tabelas,chamar:(body:unknown,token='valido')=>handler(new Request('https://teste/rh-programacao',{method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body:JSON.stringify(body)}))};
}
const edicao=()=>({id:'os-a',versao,data:'2026-09-14',hora:'07:30',veiculo:'Carro',dados:{...modelo.dadosVazios(),participantes:[{colaboradorId:'p',nome:'NOME FORJADO',nomePCP:'Apelido'}],lugares:2,motoristaId:'p',gerenteId:'rh'}});
describe('Servidor da programação',()=>{
 it.each(['','errado'])('recusa token inválido %s',async token=>{const a=ambiente();expect((await a.chamar({action:'listar',mes:'2026-09'},token)).status).toBe(401);expect(a.updates).not.toHaveBeenCalled();});
 it.each(['COLABORADOR','GESTOR'])('recusa perfil %s',async perfil=>{const a=ambiente({perfil});expect((await a.chamar({action:'salvar',edicao:edicao()})).status).toBe(403);expect(a.updates).not.toHaveBeenCalled();});
 it('recusa conta inativa',async()=>expect((await ambiente({ativo:false}).chamar({action:'listar',mes:'2026-09'})).status).toBe(401));
 it('recusa exclusão e ação desconhecida',async()=>{const a=ambiente();expect((await a.chamar({action:'delete',id:'os-a'})).status).toBe(400);expect(a.updates).not.toHaveBeenCalled();});
 it('retorna projeção sem valor, documentos ou fotos',async()=>{const a=ambiente(),r=await a.chamar({action:'listar',mes:'2026-09'}),j=await r.json();expect(r.status).toBe(200);expect(j.ordens).toHaveLength(1);expect(j.ordens[0]).not.toHaveProperty('valor');expect(j.ordens[0]).not.toHaveProperty('fotosRetornoIds');expect(a.updates).not.toHaveBeenCalled();});
 const fechada=async(a:ReturnType<typeof ambiente>,body:unknown)=>{const r=await a.chamar(body);expect(r.status).toBe(410);expect((await r.json()).erro).toMatch(/PCP/);expect(a.updates).not.toHaveBeenCalled();expect(a.tabelas).not.toContain('pcp_registros');expect(a.tabelas).not.toContain('pcp_config_global');};
 it('salvar uma programação válida responde 410 e não toca o PCP',async()=>fechada(ambiente(),{action:'salvar',edicao:edicao()}));
 it('salvar com campos forjados (cliente, valor, carro liberado) também é recusado',async()=>fechada(ambiente(),{action:'salvar',edicao:{...edicao(),cliente:'FORJADO',carroLiberado:true,valor:0}}));
 it('confirmação do dia e desconfirmação não passam mais por aqui',async()=>{const e=edicao();e.data=modelo.diaSP();await fechada(ambiente(),{action:'salvar',edicao:{...e,confirmar:{canal:'WhatsApp',contato:'Cliente de teste'}}});await fechada(ambiente(),{action:'salvar',edicao:{...e,desconfirmar:true}});});
 it('remarcar, O.S. concluída, O.S. sumida e disputa de versão: todas 410, nenhuma chega ao banco',async()=>{const e=edicao();e.data='2026-09-15';await fechada(ambiente(),{action:'salvar',edicao:e});await fechada(ambiente({fechada:true}),{action:'salvar',edicao:edicao()});await fechada(ambiente({sumiu:true}),{action:'salvar',edicao:edicao()});await fechada(ambiente({concorrente:true}),{action:'salvar',edicao:{...edicao(),versao:'velha'}});});
 it('salvar sem edição ou com edição inválida também é 410 (não vira 400 de validação)',async()=>{await fechada(ambiente(),{action:'salvar'});await fechada(ambiente(),{action:'salvar',edicao:{id:'os-a'}});});
 it('listar continua depois do fechamento',async()=>{const a=ambiente(),r=await a.chamar({action:'listar',mes:'2026-09'});expect(r.status).toBe(200);expect((await r.json()).ordens[0].id).toBe('os-a');expect(a.updates).not.toHaveBeenCalled();});
 it('erro de consulta não vira lista vazia ou confirmação de salvamento',async()=>{const a=ambiente({falha:true});expect((await a.chamar({action:'listar',mes:'2026-09'})).status).toBe(500);expect(a.updates).not.toHaveBeenCalled();});
});
