// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { expect,it } from 'vitest';
it('sinaliza revogação/remoção sem expor dados e cada usuário lê só seu sinal',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table perfis(user_id uuid primary key,perfil text,ativo boolean,colaborador_id text,nome text);`);
 const sql=readFileSync('supabase/migrations/20261024233000_rh_acesso_sinais.sql','utf8');
 // PGlite não oferece replicação lógica; testa trigger e RLS reais abaixo.
 await db.exec(sql.slice(0,sql.indexOf('do $$ begin')));
 const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
 await db.query("insert into perfis values($1,'ADMIN_RH',true,'ficticio-a','Pessoa fictícia'),($2,'ADMIN_RH',true,'ficticio-b','Outra fictícia')",[a,b]);
 await db.query("update perfis set ativo=false where user_id=$1",[a]);
 await db.query("delete from perfis where user_id=$1",[a]);
 await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
 const rows=(await db.query('select * from rh_acesso_sinais')).rows;
 expect(rows).toEqual([{user_id:a,revisao:3}]);
 await expect(db.query('insert into rh_acesso_sinais values($1,10)',[b])).rejects.toThrow();
 await expect(db.query('select rh_privado.sinalizar_acesso()')).rejects.toThrow();
 expect(sql).toContain('alter publication supabase_realtime add table public.rh_acesso_sinais');
 } finally {await db.close();}
});
