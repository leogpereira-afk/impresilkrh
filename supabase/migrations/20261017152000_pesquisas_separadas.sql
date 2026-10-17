alter table public.rh_nps_ciclos add column instrumento text not null default 'legado' check(instrumento in ('legado','clima','enps','pulso'));
alter table public.rh_nps_ciclos add column publico jsonb not null default '[]';
create or replace function public.rh_nps_operar(p_user uuid, p_op text, p_dados jsonb default '{}') returns jsonb
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
 perfil text; pessoa text; c public.rh_nps_ciclos; t public.rh_nps_totais;
 saida jsonb := '[]'; item jsonb; resultados jsonb; dimensoes jsonb; prioridades jsonb;
 convidado boolean; respondeu boolean; elegiveis integer; nota integer; v integer; k text; atual jsonb;
 id uuid; titulo text; dias integer; acao jsonb; indice integer; novo jsonb;
 instrumento text; publico jsonb; chaves text[] := array['clareza','recursos','lideranca','reconhecimento','desenvolvimento','respeito','seguranca','carga','comunicacao'];
begin
 select p.perfil,p.colaborador_id into perfil,pessoa from public.perfis p
 where p.user_id=p_user and p.ativo is distinct from false;
 if perfil is null or pessoa is null or perfil not in ('ADMIN_RH','GESTOR','COLABORADOR') then raise exception 'Acesso indisponível.'; end if;
 if p_op='criar' then
  if perfil<>'ADMIN_RH' then raise exception 'Somente o RH administra pesquisas.'; end if;
  titulo := btrim(p_dados->>'titulo'); dias := (p_dados->>'dias')::integer;
  if titulo is null or length(titulo) not between 3 and 100 or dias is null or dias not between 7 and 90 then raise exception 'Informe título e duração de 7 a 90 dias.'; end if;
  instrumento:=p_dados->>'instrumento';
  if instrumento not in ('clima','enps','pulso') or instrumento is null then raise exception 'Escolha Clima, eNPS ou Pulso.'; end if;
  publico:=p_dados->'publico';
  if jsonb_typeof(publico) is distinct from 'array' or jsonb_array_length(publico)<5 then raise exception 'Selecione pelo menos cinco pessoas elegíveis.'; end if;
  if exists(select 1 from jsonb_array_elements_text(publico) x where not exists(select 1 from public.rh_escuta_pessoas() r where r->>'id'=x and r->>'colecao'='colaboradores' and coalesce(r->>'pendencia','')='' and not (r->>'arquivado')::boolean and r->>'status' not in ('Desligado','Inativo'))) then raise exception 'Público com cadastro indisponível ou ID pendente.'; end if;
  if (select count(distinct x) from jsonb_array_elements_text(publico) x)<>jsonb_array_length(publico) then raise exception 'Público duplicado.'; end if;
  insert into public.rh_nps_ciclos(titulo,dias,instrumento,publico) values(titulo,dias,instrumento,publico) returning rh_nps_ciclos.id into id;
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
   item:=jsonb_build_object('instrumento',c.instrumento,'publico',case when perfil='ADMIN_RH' then c.publico else '[]'::jsonb end,'id',c.id,'titulo',c.titulo,'dias',c.dias,'versao',c.versao,'abertura',c.abertura,'fim',c.fim,
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
  if exists(select 1 from public.rh_nps_ciclos outro where outro.fim>now() and outro.instrumento=c.instrumento) then raise exception 'Já existe uma pesquisa em coleta. Aguarde o prazo.'; end if;
  if exists(select 1 from public.rh_nps_ciclos outro where outro.instrumento=c.instrumento and outro.abertura>now()-interval '30 days') then raise exception 'Aguarde 30 dias entre aberturas do mesmo instrumento.'; end if;
  if c.instrumento<>'legado' and exists(select 1 from jsonb_array_elements_text(c.publico) x where not exists(select 1 from public.perfis p where p.colaborador_id=x and p.ativo is distinct from false) or not exists(select 1 from public.rh_escuta_pessoas() r where r->>'id'=x and r->>'colecao'='colaboradores' and coalesce(r->>'pendencia','')='' and not (r->>'arquivado')::boolean and r->>'status' not in ('Desligado','Inativo'))) then raise exception 'Confira o público: há pessoa sem conta ativa ou cadastro elegível.'; end if;
  insert into public.rh_nps_participacao(ciclo,pessoa)
   select c.id,p.colaborador_id from public.perfis p where p.ativo is distinct from false and p.perfil in ('ADMIN_RH','GESTOR','COLABORADOR') and coalesce(p.colaborador_id,'')<>'' and (c.instrumento='legado' or c.publico ? p.colaborador_id) group by p.colaborador_id;
  select count(*) into elegiveis from public.rh_nps_participacao where ciclo=c.id;
  if elegiveis<5 then raise exception 'São necessárias pelo menos cinco pessoas com conta ativa no RH.'; end if;
  update public.rh_nps_ciclos set abertura=now(),fim=now()+make_interval(days=>c.dias) where rh_nps_ciclos.id=c.id;
 elsif p_op='responder' then
  if c.abertura is null or c.fim<=now() then raise exception 'Pesquisa fora do período de coleta.'; end if;
  select p.respondeu into respondeu from public.rh_nps_participacao p where p.ciclo=c.id and p.pessoa=pessoa;
  if not found then raise exception 'Você não está no público desta pesquisa.'; end if;
  if respondeu then return jsonb_build_object('ok',true,'jaRespondida',true); end if;
  if c.instrumento in ('enps','legado') and (jsonb_typeof(p_dados->'nota') is distinct from 'number' or (p_dados->>'nota') !~ '^(10|[0-9])$') then raise exception 'Escolha a nota de 0 a 10.'; end if;
  nota:=case when c.instrumento in ('enps','legado') then (p_dados->>'nota')::integer else null end;
  if c.instrumento='enps' and (coalesce(p_dados->'dimensoes','{}')<>'{}'::jsonb or coalesce(p_dados->>'prioridade','')<>'') then raise exception 'eNPS aceita somente a pergunta de recomendação.'; end if;
  if c.instrumento in ('clima','pulso') and p_dados->'nota' is not null and p_dados->'nota'<>'null'::jsonb then raise exception 'Este instrumento não coleta nota eNPS.'; end if;
  if jsonb_typeof(p_dados->'dimensoes') is distinct from 'object' then raise exception 'Respostas inválidas.'; end if;
  if c.instrumento='pulso' then chaves:=array['clareza','recursos','comunicacao']; end if;
  if exists(select 1 from jsonb_object_keys(p_dados->'dimensoes') x where not x=any(chaves)) then raise exception 'Pergunta fora do questionário.'; end if;
  if c.instrumento in ('clima','pulso') and not exists(select 1 from jsonb_each(p_dados->'dimensoes') x where x.value<>'null'::jsonb) then raise exception 'Responda pelo menos uma dimensão ou não envie a pesquisa.'; end if;
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
  acao:=p_dados->'acao';
  perform public.rh_escuta_validar_pessoa('colaboradores',acao->>'responsavel_id');
  if coalesce(acao->>'id','')='' then raise exception 'Identificador da ação obrigatório.'; end if;
  perform (acao->>'id')::uuid;
  if exists(select 1 from jsonb_array_elements(c.acoes) x where x->>'id'=acao->>'id') then return jsonb_build_object('ok',true); end if;
  acao:=acao||jsonb_build_object('responsavel',(select x->>'nome' from public.rh_escuta_pessoas() x where x->>'colecao'='colaboradores' and x->>'id'=acao->>'responsavel_id'));
  titulo:=btrim(acao->>'titulo');
  if titulo is null or length(titulo) not between 3 and 300 or length(coalesce(acao->>'responsavel','')) not between 2 and 80 or (acao->>'prazo') is null or (acao->>'prazo')!~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Informe ação, área responsável e prazo.'; end if;
  perform (acao->>'prazo')::date;
  if jsonb_array_length(c.acoes)>=30 then raise exception 'Limite de trinta ações por ciclo.'; end if;
  novo:=jsonb_build_object('id',acao->>'id','titulo',titulo,'responsavel',acao->>'responsavel','responsavel_id',acao->>'responsavel_id','prazo',acao->>'prazo','concluida',false);
  update public.rh_nps_ciclos set acoes=acoes||jsonb_build_array(novo) where rh_nps_ciclos.id=c.id;
 elsif p_op='concluir' then
  if perfil<>'ADMIN_RH' then raise exception 'Somente o RH conclui ações.'; end if;
  if length(btrim(coalesce(p_dados->>'resultado','')))<3 then raise exception 'Informe o resultado da ação antes de concluir.'; end if;
  select ord::integer-1 into indice from jsonb_array_elements(c.acoes) with ordinality as a(obj,ord) where obj->>'id'=p_dados->>'acaoId';
  if indice is null then raise exception 'Ação não encontrada.'; end if;
  if coalesce((c.acoes->indice->>'concluida')::boolean,false) then raise exception 'Resultado já concluído e preservado.'; end if;
  if length(p_dados->>'resultado')>4000 then raise exception 'Resultado limitado a 4.000 caracteres.'; end if;
  update public.rh_nps_ciclos set acoes=jsonb_set(acoes,array[indice::text],(acoes->indice)||jsonb_build_object('concluida',true,'resultado',p_dados->>'resultado','concluido_em',now())) where rh_nps_ciclos.id=c.id;
 else raise exception 'Operação inválida.';
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.rh_nps_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rh_nps_operar(uuid,text,jsonb) to service_role;
