-- Aditiva: não remove dados nem modifica tabelas dos outros sistemas.
alter table public.registros add column if not exists rh_versao bigint not null default 0;
create table if not exists public.rh_mutacoes (
  id text primary key, assinatura text not null, resultado jsonb not null,
  criada_em timestamptz not null default now()
);
create table if not exists public.rh_recuperacoes (
  id bigint generated always as identity primary key, motivo text not null,
  dados jsonb not null, config jsonb, colecoes text[] not null default '{}', criada_em timestamptz not null default now()
);
alter table public.rh_mutacoes enable row level security;
alter table public.rh_recuperacoes enable row level security;
revoke all on public.rh_mutacoes, public.rh_recuperacoes from public, anon, authenticated;
grant all on public.rh_mutacoes, public.rh_recuperacoes to service_role;
grant usage, select on sequence public.rh_recuperacoes_id_seq to service_role;

-- Cópia integral da base existente antes da ativação. Mantida privada no RH.
lock table public.registros in share row exclusive mode;
insert into public.rh_recuperacoes(motivo,dados,config,colecoes)
select 'antes-auditoria-20260906',jsonb_agg(to_jsonb(r)),(select config from public.config_global where id=true),array_agg(distinct colecao)
from public.registros r
having count(*)>0 and not exists(select 1 from public.rh_recuperacoes where motivo='antes-auditoria-20260906');

create or replace function public.rh_versionar_registro() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  new.rh_versao := case when TG_OP = 'UPDATE' then old.rh_versao + 1 else 1 end;
  return new;
end $$;
create or replace function public.rh_marcar_revisao() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare cols text[]; anterior jsonb; proxima bigint; mapa jsonb;
begin
  select array_agg(distinct colecao) into cols from linhas_alteradas;
  if cols is null then return null; end if;
  insert into public.meta(chave,valor) values('rev','{"rev":0,"porColecao":{}}') on conflict do nothing;
  select valor into anterior from public.meta where chave='rev' for update;
  proxima := greatest(coalesce((anterior->>'rev')::bigint,0)+1, floor(extract(epoch from clock_timestamp())*1000)::bigint);
  select jsonb_object_agg(c,proxima) into mapa from unnest(cols) c;
  update public.meta set valor=jsonb_build_object('rev',proxima,'porColecao',coalesce(anterior->'porColecao','{}'::jsonb)||mapa), atualizado_em=now() where chave='rev';
  return null;
end $$;
drop trigger if exists rh_versionar on public.registros;
create trigger rh_versionar before insert or update on public.registros for each row execute function public.rh_versionar_registro();
drop trigger if exists rh_rev_insert on public.registros;
create trigger rh_rev_insert after insert on public.registros referencing new table as linhas_alteradas for each statement execute function public.rh_marcar_revisao();
drop trigger if exists rh_rev_update on public.registros;
create trigger rh_rev_update after update on public.registros referencing new table as linhas_alteradas for each statement execute function public.rh_marcar_revisao();
drop trigger if exists rh_rev_delete on public.registros;
create trigger rh_rev_delete after delete on public.registros referencing old table as linhas_alteradas for each statement execute function public.rh_marcar_revisao();

-- Bloqueio + versão impedem que a autorização/leitura antiga sobrescreva uma
-- alteração concorrente. A mesma mutação confirmada pode ser reenviada sem repetir.
create or replace function public.rh_gravar_seguro(p_colecao text,p_id text,p_registro jsonb,p_versao bigint,p_mutacao text,p_apagar boolean default false)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare atual public.registros%rowtype; recibo public.rh_mutacoes%rowtype; assinatura text; conteudo jsonb; nova bigint; resultado jsonb;
begin
  if coalesce(p_colecao,'')='' or coalesce(p_id,'')='' or length(p_id)>200 then raise exception 'Registro inválido'; end if;
  lock table public.registros in row exclusive mode;
  assinatura := md5(jsonb_build_array(p_colecao,p_id,p_registro-'_rhRev',p_versao,p_apagar)::text);
  if p_mutacao is not null then
    perform pg_advisory_xact_lock(hashtextextended('rh:mutacao:'||p_mutacao,0));
    select * into recibo from public.rh_mutacoes where id=p_mutacao;
    if found then
      if recibo.assinatura <> assinatura then raise exception 'Identificação de envio reutilizada com outro conteúdo'; end if;
      return recibo.resultado;
    end if;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('rh:registro:'||p_colecao||'::'||p_id,0));
  select * into atual from public.registros where colecao=p_colecao and id=p_id for update;
  if (atual.id is not null and (p_versao is null or p_versao<>atual.rh_versao)) or (atual.id is null and coalesce(p_versao,0)<>0) then
    return jsonb_build_object('conflito',true,'servidor',case when atual.id is null then null else jsonb_build_object('colecao',p_colecao,'registro',atual.registro||jsonb_build_object('_rhRev',atual.rh_versao)) end);
  end if;
  if p_apagar then
    if atual.id is null then return jsonb_build_object('ok',true); end if;
    conteudo := atual.registro||jsonb_build_object('_apagado',true,'atualizadoEm',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  else
    if jsonb_typeof(p_registro)<>'object' or p_registro->>'id' is distinct from p_id then raise exception 'Conteúdo inválido'; end if;
    if atual.apagado and coalesce((p_registro->>'_apagado')::boolean,false)=false then
      return jsonb_build_object('conflito',true,'servidor',jsonb_build_object('colecao',p_colecao,'registro',atual.registro||jsonb_build_object('_rhRev',atual.rh_versao)));
    end if;
    conteudo := p_registro - '_rhRev';
  end if;
  insert into public.registros(colecao,id,registro,apagado,atualizado_em)
  values(p_colecao,p_id,conteudo,coalesce((conteudo->>'_apagado')::boolean,false),clock_timestamp())
  on conflict(colecao,id) do update set registro=excluded.registro,apagado=excluded.apagado,atualizado_em=excluded.atualizado_em
  returning rh_versao into nova;
  resultado:=jsonb_build_object('ok',true,'versao',nova);
  if p_mutacao is not null then insert into public.rh_mutacoes(id,assinatura,resultado) values(p_mutacao,assinatura,resultado); end if;
  return resultado;
end $$;

-- Restauração/importação por coleções: compara o estado visto, conserva uma
-- cópia e aplica tudo na mesma transação. Coleções ausentes ficam intactas.
create or replace function public.rh_aplicar_retrato(p_dados jsonb,p_rev bigint,p_substituir boolean default false,p_config jsonb default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare atual_rev bigint; cols text[]; c text; itens jsonb; item jsonb; copia jsonb; anterior_config jsonb; backup_id bigint; total bigint:=0;
begin
  if jsonb_typeof(p_dados)<>'object' or pg_column_size(p_dados)>20000000 then raise exception 'Retrato inválido ou maior que 20 MB'; end if;
  select array_agg(key) into cols from jsonb_object_keys(p_dados) key;
  if cols is null and p_config is null then raise exception 'Nada para aplicar'; end if;
  for c,itens in select * from jsonb_each(p_dados) loop
    if jsonb_typeof(itens)<>'array' then raise exception 'Coleção inválida'; end if;
    if exists(select 1 from jsonb_array_elements(itens) x where jsonb_typeof(x)<>'object' or coalesce(x->>'id','')='' or length(x->>'id')>200) then raise exception 'Registro inválido'; end if;
    if (select count(*) from jsonb_array_elements(itens))<>(select count(distinct x->>'id') from jsonb_array_elements(itens) x) then raise exception 'Identificação duplicada'; end if;
  end loop;
  lock table public.registros in share row exclusive mode;
  select coalesce((valor->>'rev')::bigint,0) into atual_rev from public.meta where chave='rev';
  if p_rev is null or p_rev<>coalesce(atual_rev,0) then return jsonb_build_object('conflito',true,'erro','Os dados mudaram em outro aparelho. Atualize e confira novamente.'); end if;
  select coalesce(jsonb_agg(to_jsonb(r)),'[]') into copia from public.registros r where colecao=any(cols);
  select config into anterior_config from public.config_global where id=true;
  insert into public.rh_recuperacoes(motivo,dados,config,colecoes) values(case when p_substituir then 'restauracao' else 'importacao' end,copia,anterior_config,coalesce(cols,'{}')) returning id into backup_id;
  for c,itens in select * from jsonb_each(p_dados) loop
    if p_substituir then
      update public.registros r set registro=registro||jsonb_build_object('_apagado',true,'atualizadoEm',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),apagado=true,atualizado_em=clock_timestamp()
      where colecao=c and not apagado and not exists(select 1 from jsonb_array_elements(itens) x where x->>'id'=r.id);
    end if;
    for item in select * from jsonb_array_elements(itens) loop
      insert into public.registros(colecao,id,registro,apagado,atualizado_em) values(c,item->>'id',item-'_rhRev',coalesce((item->>'_apagado')::boolean,false),clock_timestamp())
      on conflict(colecao,id) do update set registro=excluded.registro,apagado=excluded.apagado,atualizado_em=excluded.atualizado_em;
      total:=total+1;
    end loop;
  end loop;
  if p_config is not null then
    if jsonb_typeof(p_config)<>'object' then raise exception 'Configuração inválida'; end if;
    insert into public.config_global(id,config,atualizado_em) values(true,p_config,clock_timestamp()) on conflict(id) do update set config=excluded.config,atualizado_em=excluded.atualizado_em;
  end if;
  return jsonb_build_object('ok',true,'gravados',total,'copia',backup_id,'rev',(select (valor->>'rev')::bigint from public.meta where chave='rev'));
end $$;

revoke all on function public.rh_versionar_registro(), public.rh_marcar_revisao(), public.rh_gravar_seguro(text,text,jsonb,bigint,text,boolean), public.rh_aplicar_retrato(jsonb,bigint,boolean,jsonb) from public, anon, authenticated;
grant execute on function public.rh_gravar_seguro(text,text,jsonb,bigint,text,boolean), public.rh_aplicar_retrato(jsonb,bigint,boolean,jsonb) to service_role;
