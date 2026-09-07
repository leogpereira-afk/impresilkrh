-- Config global: MESCLAR por chave, atomicamente, em vez de substituir a linha.
--
-- Por que (auditoria de 07/09/2026): a config subia inteira de cada aparelho e
-- o servidor gravava por cima. Um aparelho com a config de duas horas atrás
-- apagava os vínculos do ERP e os tipos de aviso que outro acabara de criar.
-- Agora o cliente manda só o que mudou e o banco funde num único comando.
create or replace function public.rh_mesclar_config(p_patch jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare resultado jsonb;
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception 'Patch inválido'; end if;
  insert into public.config_global (id, config, atualizado_em)
  values (true, p_patch, clock_timestamp())
  on conflict (id) do update
    set config = coalesce(public.config_global.config, '{}'::jsonb) || excluded.config,
        atualizado_em = clock_timestamp()
  returning config into resultado;
  return resultado;
end $$;
revoke all on function public.rh_mesclar_config(jsonb) from public, anon, authenticated;
grant execute on function public.rh_mesclar_config(jsonb) to service_role;
