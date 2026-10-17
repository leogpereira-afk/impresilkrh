-- Apenas agregados. Nunca gravar a nota vinculada à pessoa ou em registros.
create table public.rh_nps_ciclos (
 id uuid primary key default gen_random_uuid(), titulo text not null,
 criado_em timestamptz not null default now(), abertura timestamptz, fim timestamptz,
 dias integer not null check(dias between 7 and 90), versao integer not null default 1 check(versao=1),
 acoes jsonb not null default '[]'::jsonb
);
create table public.rh_nps_participacao (
 ciclo uuid references public.rh_nps_ciclos(id) not null,
 pessoa text not null, respondeu boolean not null default false,
 primary key(ciclo,pessoa)
);
create table public.rh_nps_totais (
 ciclo uuid primary key references public.rh_nps_ciclos(id),
 n integer not null default 0, promotores integer not null default 0,
 detratores integer not null default 0, passivos integer not null default 0,
 dimensoes jsonb not null default '{}', prioridades jsonb not null default '{}'
);
alter table public.rh_nps_ciclos enable row level security;
alter table public.rh_nps_participacao enable row level security;
alter table public.rh_nps_totais enable row level security;
revoke all on public.rh_nps_ciclos, public.rh_nps_participacao, public.rh_nps_totais from public, anon, authenticated;

create function public.rh_nps_operar(p_user uuid, p_op text, p_dados jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
 perfil text; pessoa text; c public.rh_nps_ciclos; t public.rh_nps_totais;
 saida jsonb := '[]'; item jsonb; resultados jsonb; dimensoes jsonb; prioridades jsonb;
 convidado boolean; respondeu boolean; elegiveis integer; nota integer; v integer; k text; atual jsonb;
 id uuid; titulo text; dias integer; acao jsonb; indice integer; novo jsonb;
 chaves text[] := array['clareza','recursos','lideranca','reconhecimento','desenvolvimento','respeito','seguranca','carga','comunicacao'];
begin
 select p.perfil,p.colaborador_id into perfil,pessoa from public.perfis p
 where p.user_id=p_user and p.ativo is distinct from false;
 if perfil is null or pessoa is null or perfil not in ('ADMIN_RH','GESTOR','COLABORADOR') then raise exception 'Acesso indisponível.'; end if;
 if p_op='criar' then
  if perfil<>'ADMIN_RH' then raise exception 'Somente o RH administra pesquisas.'; end if;
  titulo := btrim(p_dados->>'titulo'); dias := (p_dados->>'dias')::integer;
  if titulo is null or length(titulo) not between 3 and 100 or dias is null or dias not between 7 and 90 then raise exception 'Informe título e duração de 7 a 90 dias.'; end if;
  insert into public.rh_nps_ciclos(titulo,dias) values(titulo,dias) returning rh_nps_ciclos.id into id;
  insert into public.rh_nps_totais(ciclo) values(id);
  return jsonb_build_object('ok',true,'id',id);
 end if;
 if p_op='listar' then
  for c in select * from public.rh_nps_ciclos order by criado_em desc loop
   select exists(select 1 from public.rh_nps_participacao p where p.ciclo=c.id and p.pessoa=pessoa),
    exists(select 1 from public.rh_nps_participacao p where p.ciclo=c.id and p.pessoa=pessoa and p.respondeu)
    into convidado,respondeu;
   if perfil<>'ADMIN_RH' and not convidado then continue; end if;
   select count(*) into elegiveis from public.rh_nps_participacao where ciclo=c.id;
   select * into t from public.rh_nps_totais where ciclo=c.id;
   resultados := null;
   if perfil='ADMIN_RH' and c.fim<=now() and t.n>=5 then
    dimensoes := '{}'; prioridades := '{}';
    foreach k in array chaves loop
     atual := t.dimensoes->k;
     if coalesce((atual->>'n')::integer,0)>=5 then dimensoes:=dimensoes||jsonb_build_object(k,atual); end if;
     if coalesce((t.prioridades->>k)::integer,0)>=5 then prioridades:=prioridades||jsonb_build_object(k,(t.prioridades->>k)::integer); end if;
    end loop;
    resultados:=jsonb_build_object('n',t.n,'promotores',t.promotores,'detratores',t.detratores,'passivos',t.passivos,'dimensoes',dimensoes,'prioridades',prioridades);
   end if;
   item:=jsonb_build_object('id',c.id,'titulo',c.titulo,'dias',c.dias,'versao',c.versao,'abertura',c.abertura,'fim',c.fim,
    'convidado',convidado,'respondeu',respondeu,'elegiveis',elegiveis,
    'recebidas',case when perfil='ADMIN_RH' then t.n else null end,'resultados',resultados,
    'acoes',case when perfil='ADMIN_RH' or c.fim<=now() then c.acoes else '[]'::jsonb end);
   saida:=saida||jsonb_build_array(item);
  end loop;
  return jsonb_build_object('ok',true,'ciclos',saida);
 end if;
 if p_op='abrir' then perform pg_advisory_xact_lock(17617); end if;
 select * into c from public.rh_nps_ciclos where rh_nps_ciclos.id=(p_dados->>'id')::uuid for update;
 if not found then raise exception 'Pesquisa não encontrada.'; end if;
 if p_op='abrir' then
  if perfil<>'ADMIN_RH' or c.abertura is not null then raise exception 'Pesquisa não pode ser aberta.'; end if;
  if exists(select 1 from public.rh_nps_ciclos where fim>now()) then raise exception 'Já existe uma pesquisa em coleta. Aguarde o prazo.'; end if;
  insert into public.rh_nps_participacao(ciclo,pessoa)
   select c.id,p.colaborador_id from public.perfis p where p.ativo is distinct from false and p.perfil in ('ADMIN_RH','GESTOR','COLABORADOR') and coalesce(p.colaborador_id,'')<>'' group by p.colaborador_id;
  select count(*) into elegiveis from public.rh_nps_participacao where ciclo=c.id;
  if elegiveis<5 then raise exception 'São necessárias pelo menos cinco pessoas com conta ativa no RH.'; end if;
  update public.rh_nps_ciclos set abertura=now(),fim=now()+make_interval(days=>c.dias) where rh_nps_ciclos.id=c.id;
 elsif p_op='responder' then
  if c.abertura is null or c.fim<=now() then raise exception 'Pesquisa fora do período de coleta.'; end if;
  select p.respondeu into respondeu from public.rh_nps_participacao p where p.ciclo=c.id and p.pessoa=pessoa;
  if not found then raise exception 'Você não está no público desta pesquisa.'; end if;
  if respondeu then return jsonb_build_object('ok',true,'jaRespondida',true); end if;
  if jsonb_typeof(p_dados->'nota') is distinct from 'number' or (p_dados->>'nota') !~ '^(10|[0-9])$' then raise exception 'Escolha a nota de 0 a 10.'; end if;
  nota:=(p_dados->>'nota')::integer;
  if jsonb_typeof(p_dados->'dimensoes') is distinct from 'object' then raise exception 'Respostas inválidas.'; end if;
  select * into t from public.rh_nps_totais where ciclo=c.id;
  dimensoes:=t.dimensoes; prioridades:=t.prioridades;
  foreach k in array chaves loop
   if p_dados->'dimensoes'->k is not null and p_dados->'dimensoes'->k<>'null'::jsonb then
    if jsonb_typeof(p_dados->'dimensoes'->k)<>'number' or (p_dados->'dimensoes'->>k)!~ '^[1-5]$' then raise exception 'Escala inválida.'; end if;
    v:=(p_dados->'dimensoes'->>k)::integer; atual:=dimensoes->k;
    dimensoes:=dimensoes||jsonb_build_object(k,jsonb_build_object('n',coalesce((atual->>'n')::integer,0)+1,'soma',coalesce((atual->>'soma')::integer,0)+v));
   end if;
  end loop;
  k:=p_dados->>'prioridade';
  if coalesce(k,'')<>'' then
   if not k=any(chaves) then raise exception 'Prioridade inválida.'; end if;
   prioridades:=prioridades||jsonb_build_object(k,coalesce((prioridades->>k)::integer,0)+1);
  end if;
  update public.rh_nps_totais set n=n+1,promotores=promotores+case when nota>=9 then 1 else 0 end,
   detratores=detratores+case when nota<=6 then 1 else 0 end,passivos=passivos+case when nota in(7,8) then 1 else 0 end,
   dimensoes=dimensoes,prioridades=prioridades where ciclo=c.id;
  update public.rh_nps_participacao p set respondeu=true where p.ciclo=c.id and p.pessoa=pessoa;
 elsif p_op='acao' then
  if perfil<>'ADMIN_RH' or c.fim is null or c.fim>now() then raise exception 'A devolutiva é registrada pelo RH após a coleta.'; end if;
  acao:=p_dados->'acao'; titulo:=btrim(acao->>'titulo');
  if titulo is null or length(titulo) not between 3 and 300 or length(coalesce(acao->>'responsavel','')) not between 2 and 80 or (acao->>'prazo') is null or (acao->>'prazo')!~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Informe ação, área responsável e prazo.'; end if;
  perform (acao->>'prazo')::date;
  if jsonb_array_length(c.acoes)>=30 then raise exception 'Limite de trinta ações por ciclo.'; end if;
  novo:=jsonb_build_object('id',gen_random_uuid(),'titulo',titulo,'responsavel',acao->>'responsavel','prazo',acao->>'prazo','concluida',false);
  update public.rh_nps_ciclos set acoes=acoes||jsonb_build_array(novo) where rh_nps_ciclos.id=c.id;
 elsif p_op='concluir' then
  if perfil<>'ADMIN_RH' then raise exception 'Somente o RH conclui ações.'; end if;
  select ord::integer-1 into indice from jsonb_array_elements(c.acoes) with ordinality as a(obj,ord) where obj->>'id'=p_dados->>'acaoId';
  if indice is null then raise exception 'Ação não encontrada.'; end if;
  update public.rh_nps_ciclos set acoes=jsonb_set(acoes,array[indice::text,'concluida'],'true') where rh_nps_ciclos.id=c.id;
 else raise exception 'Operação inválida.';
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.rh_nps_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rh_nps_operar(uuid,text,jsonb) to service_role;
