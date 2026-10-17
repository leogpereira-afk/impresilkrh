// @vitest-environment node
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
let db:PGlite;
const uuid=(n:number)=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const call=async(op:string,dados={},u=1,fn='rh_escuta_operar')=>(await db.query<{r:any}>(`select public.${fn}($1::uuid,$2,$3::jsonb) r`,[uuid(u),op,JSON.stringify(dados)])).rows[0].r;
const nps=(op:string,dados={},u=1)=>call(op,dados,u,'rh_nps_operar');
const entrevista=(op:string,dados={})=>call(op,dados,1,'rh_entrevistas_operar');
beforeAll(async()=>{
 db=new PGlite();await db.exec('create role anon;create role authenticated;create role service_role;create table perfis(user_id uuid,perfil text,colaborador_id text,ativo boolean);create table registros(colecao text,id text,registro jsonb,apagado boolean);');
 for(let n=1;n<=8;n++){await db.query('insert into perfis values($1,$2,$3,true)',[uuid(n),n===1?'ADMIN_RH':n===2?'GESTOR':'COLABORADOR',`ficticia-${n}`]);await db.query('insert into registros values($1,$2,$3,false)',['colaboradores',`ficticia-${n}`,{nome:`Pessoa fictícia ${n}`,idPessoa:String(n).padStart(6,'0'),statusId:'ativo'}]);}
 await db.exec(`insert into registros values('candidatos','candidato-ficticio','{"nome":"Candidato fictício"}',false),('colaboradores','arquivada','{"nome":"Histórico fictício","idPessoa":"000099"}',true),('colaboradores','bloqueada','{"nome":"Bloqueio fictício","idPessoaBloqueado":"id-de-outra-pessoa"}',false),('feedbacks','feedback-ficticio','{"colaboradorId":"ficticia-3","tipo":"Ajuste"}',false),('tarefas','integracao-ficticia','{"colaboradorId":"ficticia-3","tipo":"Admissão","titulo":"Acolhimento fictício"}',false);`);
 for(const f of ['20261017132246_nps_confidencial.sql','20261017140000_entrevistas_rh.sql','20261017150000_modelos_escuta.sql','20261017151000_central_escuta.sql','20261017152000_pesquisas_separadas.sql'])await db.exec(fs.readFileSync(`supabase/migrations/${f}`,'utf8'));
},30000);
afterAll(async()=>{await db.close();});
describe.sequential('Central de escuta integrada: banco com dados fictícios',()=>{
 it('protege tabelas e todas as funções auxiliares contra navegador',async()=>{await db.exec('set role authenticated');try{for(const t of ['rh_escuta_individuais','rh_escuta_acoes','rh_entrevistas','rh_nps_totais'])await expect(db.query(`select * from ${t}`)).rejects.toThrow();await expect(call('listar')).rejects.toThrow();await expect(db.query('select public.rh_escuta_pessoas()')).rejects.toThrow();}finally{await db.exec('reset role');}});
 it('mantém identidade estável após CPF, respeita bloqueio e mostra arquivo sem permitir nova vinculação',async()=>{
  await db.exec(`update registros set registro=registro||'{"cpf":"00000900000","idPessoaAnteriores":[{"idPessoa":"000088"}]}' where id='ficticia-3'`);
  const r=await call('listar');expect(r.pessoas.find((p:any)=>p.id==='ficticia-3').idPessoa).toBe('000003');expect(r.pessoas.find((p:any)=>p.id==='arquivada').arquivado).toBe(true);expect(r.pessoas.find((p:any)=>p.id==='bloqueada').pendencia).toBeTruthy();
  for(const pessoa_id of ['arquivada','bloqueada','desconhecida'])await expect(call('individual_criar',{id:uuid(100),modelo:'entrada',pessoa_id,prazo:'2026-01-01'})).rejects.toThrow('Vínculo');
 });
 it('seleção usa candidatos, conversa congela modelo e respeita versões',async()=>{
  await entrevista('criar',{id:uuid(101),modelo:'selecao',pessoa_id:'candidato-ficticio',agendada:'2020-01-01'});
  const r=await entrevista('listar');expect(r.entrevistas[0].pessoa_colecao).toBe('candidatos');expect(r.entrevistas[0].roteiro.perguntas).toHaveLength(6);
  await entrevista('salvar',{id:uuid(101),versao:1,agendada:'2020-01-02',respostas:{q1:'Exemplo fictício'}});
  await expect(entrevista('salvar',{id:uuid(101),versao:1,agendada:'2020-01-03'})).rejects.toThrow('outra sessão');
 });
 it('individual: RH prepara, gestor não acessa outro, só titular envia; RH não forja resposta',async()=>{
  await call('individual_criar',{id:uuid(102),modelo:'entrada',pessoa_id:'ficticia-3',prazo:'2026-01-01'});
  await call('individual_criar',{id:uuid(102),modelo:'entrada',pessoa_id:'ficticia-3',prazo:'2026-01-01'});
  await expect(call('individual_criar',{id:uuid(103),modelo:'entrada',pessoa_id:'ficticia-3',prazo:'2026-01-01'})).rejects.toThrow('Já existe');
  expect((await call('listar',{},3)).individuais).toHaveLength(0);
  await call('individual_disponibilizar',{id:uuid(102),versao:1});
  expect((await call('listar',{},2)).individuais).toHaveLength(0);expect((await call('listar',{},3)).pessoas).toHaveLength(0);
  await expect(call('individual_responder',{id:uuid(102),versao:2,respostas:{q1:'forjada'}})).rejects.toThrow('Somente a pessoa');
  await call('individual_rascunho',{id:uuid(102),versao:2,respostas:{q1:'Texto fictício'}},3);
  expect((await call('listar')).individuais[0].respostas).toEqual({});
  expect((await call('listar',{},3)).individuais[0].respostas.q1).toBe('Texto fictício');
  await call('individual_responder',{id:uuid(102),versao:3,respostas:{q1:'Resposta da pessoa fictícia'}},3);
  const i=(await call('listar')).individuais[0];expect(i.respondido_por).toBe(uuid(3));expect(i.estado).toBe('Respondida');expect(i.historico).toHaveLength(3);
  await call('individual_concluir',{id:uuid(102),versao:4,sintese:'Síntese RH fictícia'});
  const visto=(await call('listar',{},3)).individuais[0];expect(visto).not.toHaveProperty('sintese');expect(visto).not.toHaveProperty('historico');expect(visto.respostas.q1).toContain('pessoa fictícia');
  await expect(call('individual_salvar',{id:uuid(102),versao:5})).rejects.toThrow('preservado');
 });
 it('ações derivam pessoa da origem, validam responsável, reagendam sem duplicar e exigem resultado',async()=>{
  const base={id:uuid(110),origem_tipo:'feedback',origem_id:'feedback-ficticio',responsavel_id:'ficticia-1',titulo:'Ação fictícia',prazo:'2026-01-01'};
  await expect(call('acao_criar',base,2)).rejects.toThrow('Somente o RH');
  await call('acao_criar',{...base,pessoa_id:'ficticia-7'});await call('acao_criar',base);
  let a=(await call('listar')).acoes[0];expect(a.pessoa_id).toBe('ficticia-3');expect((await call('listar',{},2)).acoes).toHaveLength(0);
  await call('acao_salvar',{...base,versao:1,prazo:'2026-02-01',estado:'Em andamento'});
  await expect(call('acao_salvar',{...base,versao:1})).rejects.toThrow('outra sessão');
  await expect(call('acao_salvar',{...base,versao:2,estado:'Concluída'})).rejects.toThrow('resultado');
  await call('acao_salvar',{...base,versao:2,estado:'Concluída',resultado:'Apoio realizado fictício',revisao:'2020-01-01'});
  a=(await call('listar')).acoes[0];expect(a.concluido_em).toBeTruthy();expect(a.historico).toHaveLength(2);expect((await call('listar')).origens.some((o:any)=>o.tipo==='integracao'&&o.id==='integracao-ficticia')).toBe(true);
 });
 it('revisão preserva resultado e histórico, baixa pendência e impede perda por concorrência',async()=>{
  await expect(call('acao_revisar',{id:uuid(110),versao:3,nota:'Verificado'},2)).rejects.toThrow('Somente o RH');
  await call('acao_revisar',{id:uuid(110),versao:3,nota:'Melhoria confirmada',revisao:''});
  const a=(await call('listar')).acoes[0];expect(a.revisao).toBeNull();expect(a.resultado).toBe('Apoio realizado fictício');expect(a.revisao_nota).toBe('Melhoria confirmada');expect(a.historico[2].revisao).toBe('2020-01-01');
  await expect(call('acao_revisar',{id:uuid(110),versao:3,nota:'Não sobrescrever'})).rejects.toThrow('outra sessão');
 });
 it('Clima e eNPS têm coleta e cálculo separados, público explícito e mínimo confidencial',async()=>{
  const publico=Array.from({length:6},(_,i)=>`ficticia-${i+1}`);
  await expect(nps('criar',{titulo:'Teste fictício',dias:7,instrumento:'clima',publico:[]})).rejects.toThrow('cinco');
  const clima=(await nps('criar',{titulo:'Clima fictício',dias:7,instrumento:'clima',publico})).id;
  const enps=(await nps('criar',{titulo:'eNPS fictício',dias:7,instrumento:'enps',publico})).id;
  await nps('abrir',{id:clima});await nps('abrir',{id:enps});
  await expect(nps('responder',{id:clima,dimensoes:{clareza:5}},7)).rejects.toThrow('público');
  await expect(nps('responder',{id:clima,nota:10,dimensoes:{clareza:5}},3)).rejects.toThrow('não coleta');
  await expect(nps('responder',{id:enps,nota:10,dimensoes:{clareza:5}},3)).rejects.toThrow('somente');
  for(let u=1;u<=5;u++){await nps('responder',{id:clima,dimensoes:{clareza:4}},u);await nps('responder',{id:enps,nota:u===1?0:10,dimensoes:{}},u);}
  expect((await nps('listar')).ciclos.every((c:any)=>c.resultados===null)).toBe(true);
  await db.exec("update rh_nps_ciclos set fim=now()-interval '1 second'");const cs=(await nps('listar')).ciclos;
  const c=cs.find((c:any)=>c.id===clima),e=cs.find((c:any)=>c.id===enps);expect(c.resultados.dimensoes.clareza).toEqual({n:5,soma:20});expect(c.resultados.promotores).toBe(0);expect(e.resultados.promotores).toBe(4);expect(e.resultados.detratores).toBe(1);expect(e.resultados.dimensoes).toEqual({});
  expect((await nps('listar',{},3)).ciclos.every((c:any)=>c.resultados===null&&c.publico.length===0)).toBe(true);
  const melhoria={id:uuid(120),titulo:'Melhoria fictícia',responsavel_id:'ficticia-1',responsavel:'Nome forjado',prazo:'2026-12-01'};
  await nps('acao',{id:clima,acao:melhoria});await nps('acao',{id:clima,acao:melhoria});
  const divulgado=(await nps('listar')).ciclos.find((c:any)=>c.id===clima).acoes;expect(divulgado).toHaveLength(1);expect(divulgado[0].responsavel).toBe('Pessoa fictícia 1');
  await nps('concluir',{id:clima,acaoId:uuid(120),resultado:'Melhoria realizada'});
  await expect(nps('concluir',{id:clima,acaoId:uuid(120),resultado:'Outra versão'})).rejects.toThrow('preservado');
  const novo=(await nps('criar',{titulo:'Novo clima fictício',dias:7,instrumento:'clima',publico})).id;await expect(nps('abrir',{id:novo})).rejects.toThrow('30 dias');
 });
});
