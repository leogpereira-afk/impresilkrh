// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
let db: PGlite;
const user = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
async function call(op: string, dados = {}, n = 1) {
  const r = await db.query<{ r: any }>("select public.rh_nps_operar($1::uuid,$2,$3::jsonb) r", [user(n), op, JSON.stringify(dados)]);
  return r.rows[0].r;
}
async function ciclo(titulo = "Pesquisa fictícia") { return (await call("criar", { titulo, dias: 7 })).id as string; }
async function fechar(id: string) { await db.query("update rh_nps_ciclos set fim=now()-interval '1 second' where id=$1", [id]); }
async function resposta(id: string,n: number,nota: number) { return call("responder", { id, nota, dimensoes: { clareza: 5 }, prioridade: "clareza" },n); }
beforeAll(async () => {
 db=new PGlite();
 await db.exec("create role anon; create role authenticated; create role service_role; create table perfis(user_id uuid, perfil text, colaborador_id text, ativo boolean);");
 for(let n=1;n<=7;n++) await db.query("insert into perfis values($1,$2,$3,true)",[user(n),n===1?'ADMIN_RH':n===2?'GESTOR':'COLABORADOR',`pessoa-ficticia-${n}`]);
 await db.exec(fs.readFileSync("supabase/migrations/20261017132246_nps_confidencial.sql","utf8"));
},30000);
afterAll(async () => { await db.close(); });
describe.sequential("NPS confidencial no banco (dados fictícios)", () => {
 it("recusa desativado e gestão por colaborador",async()=>{
  await expect(call("criar",{titulo:"Teste fictício",dias:14},2)).rejects.toThrow("Somente o RH");
  await expect(call("listar",{},99)).rejects.toThrow("Acesso indisponível");
 });
 it("não permite acesso direto às tabelas nem RPC pelo navegador",async()=>{
  await db.exec("set role authenticated");
  try { await expect(db.query("select * from rh_nps_totais")).rejects.toThrow(); await expect(call("listar")).rejects.toThrow(); }
  finally { await db.exec("reset role"); }
 });
 it("valida datas, rascunho, coleta única, nota e envio repetido",async()=>{
  await expect(call("criar",{titulo:"Teste fictício",dias:1})).rejects.toThrow();
  const id=await ciclo();
  expect((await call("listar",{},3)).ciclos).toHaveLength(0);
  await expect(resposta(id,3,8)).rejects.toThrow("fora do período");
  await call("abrir",{id});
  await expect(call("abrir",{id})).rejects.toThrow();
  const outro=await ciclo("Outra pesquisa fictícia");
  await expect(call("abrir",{id:outro})).rejects.toThrow("Já existe");
  await expect(resposta(id,3,11)).rejects.toThrow("nota");
  await resposta(id,3,0); await resposta(id,4,10); await resposta(id,5,8); await resposta(id,6,9);
  expect((await resposta(id,3,10)).jaRespondida).toBe(true);
  expect((await call("listar")).ciclos.find((c:any)=>c.id===id).resultados).toBeNull();
  await fechar(id);
  const c=(await call("listar")).ciclos.find((c:any)=>c.id===id);
  expect(c.recebidas).toBe(4); expect(c.resultados).toBeNull();
  await expect(resposta(id,7,9)).rejects.toThrow("fora do período");
  await expect(call("abrir",{id})).rejects.toThrow();
 });
 it("libera somente agregado final ao RH e devolutiva aos convidados",async()=>{
  const id=await ciclo(); await call("abrir",{id});
  for(let n=1;n<=5;n++) await resposta(id,n,[0,7,8,9,10][n-1]);
  expect((await call("listar")).ciclos.find((c:any)=>c.id===id).resultados).toBeNull();
  await fechar(id);
  const c=(await call("listar")).ciclos.find((c:any)=>c.id===id);
  expect(c.resultados).toMatchObject({n:5,promotores:2,detratores:1,passivos:2,dimensoes:{clareza:{n:5,soma:25}},prioridades:{clareza:5}});
  expect((await call("listar",{},2)).ciclos.find((c:any)=>c.id===id).resultados).toBeNull();
  await expect(call("acao",{id,acao:{titulo:"Melhoria teste",responsavel:"RH",prazo:"2027-01-01"}},2)).rejects.toThrow();
  await call("acao",{id,acao:{titulo:"Melhoria fictícia",responsavel:"RH",prazo:"2027-01-01"}});
  const a=(await call("listar",{},3)).ciclos.find((c:any)=>c.id===id).acoes[0];
  await call("concluir",{id,acaoId:a.id});
  expect((await call("listar",{},3)).ciclos.find((c:any)=>c.id===id).acoes[0].concluida).toBe(true);
  const cols=await db.query<{column_name:string}>("select column_name from information_schema.columns where table_name='rh_nps_participacao'");
  expect(cols.rows.map(r=>r.column_name).sort()).toEqual(['ciclo','pessoa','respondeu']);
 });
 it("suprime dimensões sem cinco respostas e conta N/A fora da média",async()=>{
  const id=await ciclo(); await call("abrir",{id});
  for(let n=1;n<=5;n++) await call("responder",{id,nota:10,dimensoes:n===5?{}:{clareza:1}},n);
  await fechar(id);
  expect((await call("listar")).ciclos.find((c:any)=>c.id===id).resultados.dimensoes).toEqual({});
 });
});
