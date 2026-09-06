// @vitest-environment node
// PostgreSQL real isolado em memória; não acessa Supabase nem dados da empresa.
import fs from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeEach, afterEach, expect, it } from 'vitest';
let db: PGlite;
beforeEach(async()=>{
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create table registros(colecao text not null,id text not null,registro jsonb not null,atualizado_em timestamptz not null default now(),apagado boolean not null default false,primary key(colecao,id));
    create table meta(chave text primary key,valor jsonb not null,atualizado_em timestamptz not null default now());
    create table config_global(id boolean primary key default true,config jsonb,atualizado_em timestamptz not null default now());`);
  await db.exec(fs.readFileSync('supabase/migrations/202609060001_integridade_rh.sql','utf8'));
},20000);
afterEach(async()=>{await db.close();});
async function gravar(id: string, rev: number|null, titulo: string, mutacao: string, apagar=false): Promise<any> {
  const r=await db.query<{r:any}>(`select rh_gravar_seguro('tarefas',$1,$2::jsonb,$3,$4,$5) r`,[id,JSON.stringify({id,titulo}),rev,mutacao,apagar]); return r.rows[0].r;
}
async function revisao():Promise<number>{return (await db.query<{rev:string}>(`select valor->>'rev' rev from meta where chave='rev'`)).rows[0]?.rev as unknown as number;}
async function retrato(dados:unknown,rev:number|null,substituir=true):Promise<any>{return (await db.query<{r:any}>(`select rh_aplicar_retrato($1::jsonb,$2,$3) r`,[JSON.stringify(dados),rev,substituir])).rows[0].r;}

it('edição baseada na versão antiga não sobrescreve a nova',async()=>{
  expect((await gravar('t1',0,'Primeira','m1')).versao).toBe(1);
  expect((await gravar('t1',1,'Segunda','m2')).versao).toBe(2);
  const antiga=await gravar('t1',1,'Atrasada','m3');
  expect(antiga.conflito).toBe(true);expect(antiga.servidor.registro.titulo).toBe('Segunda');
});
it('reenvio da confirmação perdida não grava nem incrementa novamente',async()=>{
  const a=await gravar('t1',0,'Uma vez','m1');const rev=await revisao();
  expect(await gravar('t1',0,'Uma vez','m1')).toEqual(a);expect(await revisao()).toBe(rev);
  const reenviado=await db.query<{r:any}>(`select rh_gravar_seguro('tarefas','t1','{"id":"t1","titulo":"Uma vez","_rhRev":1}',0,'m1',false) r`);
  expect(reenviado.rows[0].r).toEqual(a);
  await expect(gravar('t1',0,'Outro conteúdo','m1')).rejects.toThrow('reutilizada');
});
it('exclusão preserva o conteúdo e uma edição antiga não o ressuscita',async()=>{
  await gravar('t1',0,'Guardar histórico','m1');await gravar('t1',1,'','m2',true);
  const row=(await db.query<any>(`select * from registros where id='t1'`)).rows[0];
  expect(row.apagado).toBe(true);expect(row.registro.titulo).toBe('Guardar histórico');
  expect((await gravar('t1',2,'Reabrir sem restauração','m3')).conflito).toBe(true);
});
it('importação incompleta falha inteira sem apagar a base',async()=>{
  await gravar('t1',0,'Preservar','m1');const rev=await revisao();
  await expect(retrato({tarefas:[{id:'t2'},{id:'t2'}]},rev)).rejects.toThrow('duplicada');
  expect((await db.query<any>('select registro from registros')).rows[0].registro.titulo).toBe('Preservar');
  expect((await db.query('select * from rh_recuperacoes')).rows).toHaveLength(0);
});
it('restauração conserva cópia e coleções omitidas; ausentes viram arquivo',async()=>{
  await gravar('t1',0,'Versão anterior','m1');
  await db.exec(`insert into registros(colecao,id,registro) values('areas','a1','{"id":"a1","nome":"Intacta"}');`);
  const r=await retrato({tarefas:[{id:'t2',titulo:'Nova versão'}]},await revisao());expect(r.ok).toBe(true);
  const rows=(await db.query<any>('select colecao,id,apagado from registros order by colecao,id')).rows;
  expect(rows).toEqual([{colecao:'areas',id:'a1',apagado:false},{colecao:'tarefas',id:'t1',apagado:true},{colecao:'tarefas',id:'t2',apagado:false}]);
  const copia=(await db.query<any>('select dados from rh_recuperacoes')).rows[0].dados;
  expect(copia[0].registro.titulo).toBe('Versão anterior');
});
it('restauração com conferência vencida não aplica nem cria cópia enganosa',async()=>{
  await gravar('t1',0,'A','m1');const antiga=await revisao();await gravar('t1',1,'B','m2');
  expect((await retrato({tarefas:[]},antiga)).conflito).toBe(true);
  expect((await db.query<any>('select apagado from registros')).rows[0].apagado).toBe(false);
});
it('falha depois de iniciar a restauração reverte registros e cópia juntos',async()=>{
  await gravar('t1',0,'Original','m1');
  await expect(db.query(`select rh_aplicar_retrato($1::jsonb,$2,true,'[]'::jsonb)`,[JSON.stringify({tarefas:[{id:'t2'}]}),await revisao()])).rejects.toThrow('Configuração inválida');
  const rows=(await db.query<any>('select id,apagado from registros')).rows;
  expect(rows).toEqual([{id:'t1',apagado:false}]);expect((await db.query('select * from rh_recuperacoes')).rows).toHaveLength(0);
});
it('a revisão é crescente e guarda os contadores das duas coleções',async()=>{
  await gravar('t1',0,'A','m1');const rev=Number(await revisao());
  await db.exec(`insert into registros(colecao,id,registro) values('areas','a1','{"id":"a1"}');`);
  const v=(await db.query<any>(`select valor from meta where chave='rev'`)).rows[0].valor;
  expect(v.rev).toBeGreaterThan(rev);expect(Object.keys(v.porColecao).sort()).toEqual(['areas','tarefas']);
});
it('operações protegidas não estão abertas a visitantes ou usuários diretos',async()=>{
  const r=await db.query<any>(`select proname,has_function_privilege('anon',oid,'EXECUTE') a,has_function_privilege('authenticated',oid,'EXECUTE') u from pg_proc where proname in ('rh_gravar_seguro','rh_aplicar_retrato')`);
  expect(r.rows).toHaveLength(2);expect(r.rows.every(x=>!x.a&&!x.u)).toBe(true);
});
