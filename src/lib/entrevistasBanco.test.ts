// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import modelos from "@/data/modelosEntrevista.json";
let db:PGlite;
const uuid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,"0")}`;
const call=async(op:string,dados={},u=1)=>(await db.query<{r:any}>("select public.rh_entrevistas_operar($1::uuid,$2,$3::jsonb) r",[uuid(u),op,JSON.stringify(dados)])).rows[0].r;
const criar=(n:number,modelo="entrada",pessoa="pessoa-ficticia")=>call("criar",{id:uuid(n),modelo,pessoa_id:pessoa,agendada:"2020-01-01"});
const salvar=(n:number,extra={},op="salvar")=>call(op,{id:uuid(n),versao:1,agendada:"2020-01-02",respostas:{q1:"Resposta fictícia"},sintese:"Síntese fictícia",combinados:"",...extra});
beforeAll(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create table perfis(user_id uuid,perfil text,ativo boolean);create table registros(colecao text,id text,registro jsonb,apagado boolean);");
 for(let n=1;n<=4;n++)await db.query("insert into perfis values($1,$2,$3)",[uuid(n),n===1||n===4?"ADMIN_RH":n===2?"GESTOR":"COLABORADOR",n!==4]);
 await db.exec(`insert into registros values('colaboradores','pessoa-ficticia','{"nome":"Pessoa fictícia","idPessoa":"000001"}',false),('candidatos','candidato-ficticio','{"nome":"Candidato fictício"}',false),('colaboradores','apagada','{}',true);`);
 await db.exec(fs.readFileSync("supabase/migrations/20261017140000_entrevistas_rh.sql","utf8"));
 await db.exec(fs.readFileSync("supabase/migrations/20261017150000_modelos_escuta.sql","utf8"));
},30000);
afterAll(async()=>{await db.close();});
describe.sequential("Entrevistas individuais restritas ao RH",()=>{
 it("nega todos os verbos a gestor, colaborador, desativado e desconhecido",async()=>{
  for(const u of [2,3,4,99])for(const op of ["listar","criar","salvar","concluir"])await expect(call(op,{},u)).rejects.toThrow("Somente o RH");
 });
 it("nega acesso direto a tabela e função pelo navegador",async()=>{
  await db.exec("set role authenticated");try{await expect(db.query("select * from rh_entrevistas")).rejects.toThrow();await expect(call("listar")).rejects.toThrow();}finally{await db.exec("reset role");}
 });
 it("mantém exatamente os roteiros versionados da interface",async()=>{
  const r=await db.query<{modelo:unknown}>("select modelo from rh_entrevista_modelos order by id");
  expect(r.rows.map(r=>r.modelo)).toEqual([...modelos].sort((a,b)=>a.id.localeCompare(b.id)));
 });
 it("vincula somente cadastros existentes e coleção adequada",async()=>{
  for(const p of ["inexistente","apagada","candidato-ficticio"])await expect(criar(10,"entrada",p)).rejects.toThrow("pessoa cadastrada");
  await expect(criar(10,"selecao")).rejects.toThrow("pessoa cadastrada");
  await criar(10,"selecao","candidato-ficticio");await criar(11);
  const r=await call("listar");expect(r.pessoas).toHaveLength(2);expect(r.entrevistas.find((e:any)=>e.id===uuid(11))).toMatchObject({pessoa_id:"pessoa-ficticia",pessoa_colecao:"colaboradores"});
 });
 it("repetir agendamento com mesma chave não duplica; reagendar preserva versão",async()=>{
  await criar(12);await criar(12);expect((await call("listar")).entrevistas.filter((e:any)=>e.id===uuid(12))).toHaveLength(1);
  await salvar(12);const e=(await call("listar")).entrevistas.find((e:any)=>e.id===uuid(12));
  expect(e.agendada).toBe("2020-01-02");expect(e.versao).toBe(2);expect(e.historico[0].agendada).toBe("2020-01-01");
  await expect(salvar(12)).rejects.toThrow("outra sessão");
 });
 it("valida roteiro, datas, combinados e tamanho antes de gravar",async()=>{
  await criar(13);
  await expect(salvar(13,{respostas:{intruso:"x"}})).rejects.toThrow("Resposta inválida");
  await expect(salvar(13,{respostas:{q1:3}})).rejects.toThrow("Resposta inválida");
  await expect(salvar(13,{respostas:{q1:"a".repeat(4001)}})).rejects.toThrow("Resposta inválida");
  await expect(salvar(13,{combinados:"Ação fictícia"})).rejects.toThrow("revistos");
  await expect(salvar(13,{revisao:"2019-01-01"})).rejects.toThrow("depois");
  await expect(salvar(13,{sintese:""},"concluir")).rejects.toThrow("síntese");
  await expect(salvar(13,{agendada:"2099-01-01"},"concluir")).rejects.toThrow("futuro");
  expect((await call("listar")).entrevistas.find((e:any)=>e.id===uuid(13)).versao).toBe(1);
 });
 it("conclusão conserva respostas e impede edição posterior",async()=>{
  await criar(14);await salvar(14,{combinados:"Ação fictícia",revisao:"2020-02-01"},"concluir");
  const e=(await call("listar")).entrevistas.find((e:any)=>e.id===uuid(14));expect(e.estado).toBe("Concluída");expect(e.respostas.q1).toBe("Resposta fictícia");expect(e.concluido_em).toBeTruthy();
  await expect(salvar(14,{versao:2})).rejects.toThrow("concluída");
 });
});
