// @vitest-environment node
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { it, expect } from 'vitest';
it('sinaliza mudanças de ficha sem dados pessoais, com leitura só pelo RH ativo e sem escrita pelo cliente', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
      create table perfis(user_id uuid primary key,perfil text,ativo boolean);
      alter table perfis enable row level security; grant select on perfis to authenticated;
      create policy proprio on perfis for select using(user_id=auth.uid());
      create table registros(colecao text,id text,registro jsonb,apagado boolean default false);`);
    const sql = readFileSync('supabase/migrations/20261025005118_rh_cadastros_sinais.sql','utf8');
    // PGlite não oferece replicação lógica; executa aqui os triggers e RLS.
    await db.exec(sql.split('-- Publicacao Realtime')[0]);
    const a='00000000-0000-0000-0000-000000000001', b='00000000-0000-0000-0000-000000000002';
    await db.query("insert into perfis values($1,'ADMIN_RH',true),($2,'COLABORADOR',true)",[a,b]);
    await db.exec(`insert into registros values('colaboradores','ficticia','{"nome":"Pessoa Fictícia"}',false);
      update registros set apagado=true where id='ficticia';
      insert into registros values('acessos','log-ficticio','{}',false);`);
    await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
    expect((await db.query('select * from rh_cadastros_sinais')).rows).toEqual([{id:true,revisao:2}]);
    await expect(db.exec('update rh_cadastros_sinais set revisao=999')).rejects.toThrow();
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[b]);
    expect((await db.query('select * from rh_cadastros_sinais')).rows).toEqual([]);
    await db.exec('reset role'); await db.query('update perfis set ativo=false where user_id=$1',[a]);
    await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)",[a]);
    expect((await db.query('select * from rh_cadastros_sinais')).rows).toEqual([]);
    await db.exec('reset role; set role anon');
    await expect(db.exec('select * from rh_cadastros_sinais')).rejects.toThrow();
  } finally { await db.close(); }
},20000);
