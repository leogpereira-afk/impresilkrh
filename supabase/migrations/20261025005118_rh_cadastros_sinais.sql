-- Somente um contador de mudanças, sem ID de ficha ou qualquer dado pessoal.
create table public.rh_cadastros_sinais (
  id boolean primary key default true check (id),
  revisao bigint not null default 1
);
alter table public.rh_cadastros_sinais enable row level security;
revoke all on public.rh_cadastros_sinais from anon, authenticated;
grant select on public.rh_cadastros_sinais to authenticated;
create policy "RH ativo recebe sinal de cadastros"
  on public.rh_cadastros_sinais for select to authenticated
  using (exists (select 1 from public.perfis p
    where p.user_id = (select auth.uid()) and p.perfil = 'ADMIN_RH' and p.ativo));

create schema if not exists rh_privado;
revoke all on schema rh_privado from public, anon, authenticated;
create function rh_privado.sinalizar_cadastros()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if (TG_OP <> 'DELETE' and new.colecao = 'colaboradores')
    or (TG_OP <> 'INSERT' and old.colecao = 'colaboradores') then
    insert into public.rh_cadastros_sinais(id) values (true)
      on conflict (id) do update set revisao = public.rh_cadastros_sinais.revisao + 1;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function rh_privado.sinalizar_cadastros() from public, anon, authenticated;
create trigger rh_sinal_cadastros after insert or update or delete on public.registros
  for each row execute function rh_privado.sinalizar_cadastros();

-- Publicacao Realtime: nunca publicar a tabela registros com dados pessoais.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='rh_cadastros_sinais') then
    alter publication supabase_realtime add table public.rh_cadastros_sinais;
  end if;
end $$;
