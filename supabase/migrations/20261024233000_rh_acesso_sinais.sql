-- Sinal privado de revogação. Não replica perfis, nomes ou documentos.
create table if not exists public.rh_acesso_sinais (
  user_id uuid primary key,
  revisao bigint not null default 1
);
alter table public.rh_acesso_sinais enable row level security;
revoke all on public.rh_acesso_sinais from anon, authenticated;
grant select on public.rh_acesso_sinais to authenticated;
create policy "usuario recebe apenas seu sinal de acesso"
  on public.rh_acesso_sinais for select to authenticated
  using ((select auth.uid()) = user_id);

create schema if not exists rh_privado;
revoke all on schema rh_privado from public, anon, authenticated;
create or replace function rh_privado.sinalizar_acesso()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if TG_OP = 'UPDATE' and old.perfil is not distinct from new.perfil
    and old.ativo is not distinct from new.ativo
    and old.colaborador_id is not distinct from new.colaborador_id
    and old.user_id is not distinct from new.user_id then
    return new;
  end if;
  if TG_OP <> 'INSERT' then
    insert into public.rh_acesso_sinais(user_id) values (old.user_id)
      on conflict (user_id) do update set revisao = public.rh_acesso_sinais.revisao + 1;
  end if;
  if TG_OP = 'INSERT' or (TG_OP = 'UPDATE' and old.user_id is distinct from new.user_id) then
    insert into public.rh_acesso_sinais(user_id) values (new.user_id)
      on conflict (user_id) do update set revisao = public.rh_acesso_sinais.revisao + 1;
  end if;
  if TG_OP = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function rh_privado.sinalizar_acesso() from public, anon, authenticated;
create trigger rh_perfil_sinal_acesso after insert or update or delete on public.perfis
  for each row execute function rh_privado.sinalizar_acesso();
-- A linha do sinal sobrevive à remoção do perfil para avisar a sessão aberta.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime'
    and schemaname='public' and tablename='rh_acesso_sinais') then
    alter publication supabase_realtime add table public.rh_acesso_sinais;
  end if;
end $$;
