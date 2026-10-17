-- Projeção mínima do cadastro, sem CPF, salário ou criação de uma pessoa paralela.
create function public.rh_escuta_pessoas() returns setof jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',r.id,'colecao',r.colecao,'nome',coalesce(r.registro->>'nome',r.registro->>'nomeCompleto','Cadastro sem nome'),
 'idPessoa',case when r.registro->>'idPessoa' ~ '^\d{6}$' then r.registro->>'idPessoa' else null end,
 'anteriores',coalesce(r.registro->'idPessoaAnteriores','[]'),'arquivado',r.apagado,
 'status',case when coalesce(r.registro->>'dataDesligamento','')<>'' or r.registro->>'statusId'='inativo' then 'Desligado' else 'Ativo' end,'devolvidoA',r.registro->>'devolvidoA',
 'pendencia',case when r.colecao='candidatos' then '' when coalesce(r.registro->>'idPessoaBloqueado','')<>'' then 'ID bloqueado: conferir ficha no RH'
 when coalesce(r.registro->>'idPessoa','') !~ '^\d{6}$' then 'ID estável ausente: conferir ficha no RH'
 when exists(select 1 from public.registros o where o.colecao='colaboradores' and o.id<>r.id and not o.apagado and
  (o.registro->>'idPessoa'=r.registro->>'idPessoa' or exists(select 1 from jsonb_array_elements(coalesce(o.registro->'idPessoaAnteriores','[]')) a where coalesce(a->>'idPessoa',a#>>'{}')=r.registro->>'idPessoa'))) then 'ID ambíguo: conferir consolidação no RH' else '' end)
 from public.registros r where r.colecao in ('colaboradores','candidatos');
$$;
create function public.rh_escuta_validar_pessoa(p_colecao text,p_id text) returns void language plpgsql security definer set search_path='' as $$
declare p jsonb;
begin
 select x into p from public.rh_escuta_pessoas() x where x->>'colecao'=p_colecao and x->>'id'=p_id;
 if p is null or (p->>'arquivado')::boolean or coalesce(p->>'pendencia','')<>'' then raise exception 'Vínculo indisponível ou ID pendente. Confira o cadastro no RH.'; end if;
end $$;
revoke all on function public.rh_escuta_pessoas(),public.rh_escuta_validar_pessoa(text,text) from public,anon,authenticated;

-- Congela o roteiro utilizado; alteração futura do modelo não reescreve a conversa.
alter table public.rh_entrevistas add column roteiro jsonb;
update public.rh_entrevistas e set roteiro=m.modelo from public.rh_entrevista_modelos m where m.id=e.modelo;
alter function public.rh_entrevistas_operar(uuid,text,jsonb) rename to rh_entrevistas_v1;
create function public.rh_entrevistas_operar(p_user uuid,p_op text,p_dados jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; m jsonb; c text;
begin
 if not exists(select 1 from public.perfis where user_id=p_user and perfil='ADMIN_RH' and ativo is distinct from false) then raise exception 'Somente o RH pode acessar entrevistas individuais.'; end if;
 if p_op='criar' then
  select modelo into m from public.rh_entrevista_modelos where id=p_dados->>'modelo';
  c:=case when m->>'categoria'='selecao' then 'candidatos' else 'colaboradores' end;
  perform public.rh_escuta_validar_pessoa(c,p_dados->>'pessoa_id');
 end if;
 r:=public.rh_entrevistas_v1(p_user,p_op,p_dados);
 if p_op='criar' then update public.rh_entrevistas set roteiro=m where id=(r->>'id')::uuid and roteiro is null; end if;
 if p_op='listar' then r:=jsonb_set(r,'{pessoas}',(select coalesce(jsonb_agg(x),'[]') from public.rh_escuta_pessoas() x)); end if;
 return r;
end $$;
revoke all on function public.rh_entrevistas_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rh_entrevistas_operar(uuid,text,jsonb) to service_role;

create table public.rh_escuta_individuais(
 id uuid primary key, pessoa_id text not null, modelo text not null references public.rh_entrevista_modelos(id), roteiro jsonb not null,
 prazo date not null, estado text not null default 'Rascunho' check(estado in ('Rascunho','Disponível','Respondida','Concluída')),
 respostas jsonb not null default '{}', sintese text not null default '', revisao date,
 criado_por uuid not null, atualizado_por uuid not null, respondido_por uuid, respondido_em timestamptz,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), concluido_em timestamptz,
 versao integer not null default 1, historico jsonb not null default '[]'
);
create table public.rh_escuta_acoes(
 id uuid primary key, origem_tipo text not null check(origem_tipo in ('entrevista','individual','feedback','pdi','treinamento','integracao')),
 origem_id text not null, pessoa_id text not null, responsavel_id text not null, titulo text not null, prazo date not null,
 estado text not null default 'Pendente' check(estado in ('Pendente','Em andamento','Concluída')),
 resultado text not null default '', revisao date, concluido_em timestamptz, revisao_nota text not null default '', revisado_em timestamptz,
 criado_por uuid not null, atualizado_por uuid not null, criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
 versao integer not null default 1,historico jsonb not null default '[]'
);
alter table public.rh_escuta_individuais enable row level security;
alter table public.rh_escuta_acoes enable row level security;
revoke all on public.rh_escuta_individuais,public.rh_escuta_acoes from public,anon,authenticated;
create function public.rh_escuta_operar(p_user uuid,p_op text,p_dados jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare perfil text; pessoa text; rh boolean; r public.rh_escuta_individuais; a public.rh_escuta_acoes; id uuid; m jsonb; respostas jsonb; k text; v jsonb; origem jsonb; colecao text; op text; prazo date; titulo text; resultado text; estado text; revisao date;
begin
 select p.perfil,p.colaborador_id into perfil,pessoa from public.perfis p where p.user_id=p_user and p.ativo is distinct from false;
 if perfil is null or pessoa is null or perfil not in ('ADMIN_RH','GESTOR','COLABORADOR') then raise exception 'Acesso indisponível.'; end if;
 rh:=perfil='ADMIN_RH';
 if p_op='listar' then
  return jsonb_build_object('ok',true,
   'pessoas',case when rh then (select coalesce(jsonb_agg(x),'[]') from public.rh_escuta_pessoas() x) else '[]'::jsonb end,
   'individuais',(select coalesce(jsonb_agg(case when rh then to_jsonb(i)||jsonb_build_object('respostas',case when i.respondido_em is null and i.pessoa_id<>pessoa then '{}'::jsonb else i.respostas end,'historico',(select coalesce(jsonb_agg(h||jsonb_build_object('respostas',case when h->>'respondido_em' is null and i.pessoa_id<>pessoa then '{}'::jsonb else h->'respostas' end)),'[]') from jsonb_array_elements(i.historico) h)) else jsonb_build_object('id',i.id,'pessoa_id',i.pessoa_id,'modelo',i.modelo,'roteiro',i.roteiro,'prazo',i.prazo,'estado',i.estado,'respostas',i.respostas,'versao',i.versao,'atualizado_em',i.atualizado_em,'respondido_em',i.respondido_em) end order by i.prazo),'[]') from public.rh_escuta_individuais i where rh or (i.pessoa_id=pessoa and i.estado<>'Rascunho')),
   'acoes',case when rh then (select coalesce(jsonb_agg(to_jsonb(ac) order by ac.prazo),'[]') from public.rh_escuta_acoes ac) else '[]'::jsonb end,
   'origens',case when rh then (select coalesce(jsonb_agg(jsonb_build_object('id',orig.id,'tipo',case orig.colecao when 'feedbacks' then 'feedback' when 'pdis' then 'pdi' when 'treinamentos' then 'treinamento' else 'integracao' end,'pessoa_id',orig.registro->>'colaboradorId','titulo',coalesce(orig.registro->>'titulo',orig.registro->>'tipo',orig.colecao))),'[]') from public.registros orig where orig.colecao in ('feedbacks','pdis','treinamentos','tarefas') and not orig.apagado) else '[]'::jsonb end);
 end if;
 id:=(p_dados->>'id')::uuid;
 if id is null then raise exception 'Identificador obrigatório.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(id::text,0));
 if p_op='individual_criar' then
  if not rh then raise exception 'Somente o RH prepara questionários.'; end if;
  if exists(select 1 from public.rh_escuta_individuais where rh_escuta_individuais.id=id) then return jsonb_build_object('ok',true,'id',id); end if;
  perform public.rh_escuta_validar_pessoa('colaboradores',p_dados->>'pessoa_id');
  select modelo into m from public.rh_entrevista_modelos where rh_entrevista_modelos.id=p_dados->>'modelo' and modelo->>'categoria'<>'selecao';
  if m is null then raise exception 'Escolha um modelo individual.'; end if;
  prazo:=(p_dados->>'prazo')::date;
  if prazo is null then raise exception 'Informe a data de acompanhamento.'; end if;
  if exists(select 1 from public.rh_escuta_individuais i where i.pessoa_id=p_dados->>'pessoa_id' and i.modelo=m->>'id' and i.estado<>'Concluída') then raise exception 'Já existe questionário deste tipo em aberto para essa pessoa.'; end if;
  insert into public.rh_escuta_individuais(id,pessoa_id,modelo,roteiro,prazo,criado_por,atualizado_por) values(id,p_dados->>'pessoa_id',m->>'id',m,prazo,p_user,p_user);
 elsif p_op in ('individual_salvar','individual_disponibilizar','individual_responder','individual_rascunho','individual_concluir') then
  select * into r from public.rh_escuta_individuais i where i.id=id for update;
  if not found or (not rh and (r.pessoa_id<>pessoa or r.estado='Rascunho')) then raise exception 'Questionário indisponível.'; end if;
  if (p_dados->>'versao')::integer is distinct from r.versao then raise exception 'Registro atualizado em outra sessão. Atualize antes de editar.'; end if;
  if r.estado='Concluída' then raise exception 'Registro concluído e preservado.'; end if;
  if p_op in ('individual_responder','individual_rascunho') then
   if r.pessoa_id<>pessoa or r.estado<>'Disponível' then raise exception 'Somente a pessoa convidada pode enviar suas respostas.'; end if;
   respostas:=p_dados->'respostas';
   if jsonb_typeof(respostas) is distinct from 'object' then raise exception 'Respostas inválidas.'; end if;
   for k,v in select key,value from jsonb_each(respostas) loop
    if jsonb_typeof(v)<>'string' or length(v#>>'{}')>4000 or not exists(select 1 from jsonb_array_elements(r.roteiro->'perguntas') q where q->>'id'=k) then raise exception 'Resposta inválida para este questionário.'; end if;
   end loop;
   update public.rh_escuta_individuais i set respostas=respostas,estado=case when p_op='individual_responder' then 'Respondida' else r.estado end,respondido_por=case when p_op='individual_responder' then p_user else null end,respondido_em=case when p_op='individual_responder' then now() else null end,versao=r.versao+1,atualizado_em=now(),atualizado_por=p_user,historico=r.historico||jsonb_build_array(to_jsonb(r)-'historico') where i.id=id;
  else
   if not rh then raise exception 'Somente o RH administra o acompanhamento.'; end if;
   prazo:=coalesce((p_dados->>'prazo')::date,r.prazo);revisao:=nullif(p_dados->>'revisao','')::date;
   titulo:=coalesce(p_dados->>'sintese',r.sintese);
   if length(titulo)>4000 then raise exception 'Síntese limitada a 4.000 caracteres.'; end if;
   if p_op='individual_concluir' and length(btrim(titulo))<3 then raise exception 'Registre a síntese do acompanhamento.'; end if;
   if p_op='individual_disponibilizar' then
    if r.estado<>'Rascunho' then raise exception 'Questionário já disponibilizado.'; end if;
    if not exists(select 1 from public.perfis where colaborador_id=r.pessoa_id and ativo is distinct from false) then raise exception 'A pessoa precisa de conta ativa no RH para responder.'; end if;
    if exists(select 1 from public.rh_escuta_individuais i where i.pessoa_id=r.pessoa_id and i.id<>r.id and i.estado='Disponível') then raise exception 'A pessoa já tem questionário disponível. Aguarde a participação.'; end if;
   end if;
   update public.rh_escuta_individuais i set prazo=prazo,sintese=titulo,revisao=revisao,estado=case p_op when 'individual_disponibilizar' then 'Disponível' when 'individual_concluir' then 'Concluída' else r.estado end,concluido_em=case when p_op='individual_concluir' then now() else null end,versao=r.versao+1,atualizado_em=now(),atualizado_por=p_user,historico=r.historico||jsonb_build_array(to_jsonb(r)-'historico') where i.id=id;
  end if;
 elsif p_op='acao_revisar' then
  if not rh then raise exception 'Somente o RH revisa ações identificadas.'; end if;
  select * into a from public.rh_escuta_acoes x where x.id=id for update;
  if not found or (p_dados->>'versao')::integer is distinct from a.versao then raise exception 'Ação indisponível ou atualizada em outra sessão.'; end if;
  if a.estado<>'Concluída' then raise exception 'Conclua a ação antes de revisar o resultado.'; end if;
  titulo:=btrim(coalesce(p_dados->>'nota',''));revisao:=nullif(p_dados->>'revisao','')::date;
  if length(titulo) not between 3 and 4000 or revisao<current_date then raise exception 'Informe o resultado da revisão e uma próxima data válida, se necessária.'; end if;
  update public.rh_escuta_acoes x set revisao_nota=titulo,revisado_em=now(),revisao=revisao,versao=a.versao+1,atualizado_em=now(),atualizado_por=p_user,historico=a.historico||jsonb_build_array(to_jsonb(a)-'historico') where x.id=id;
 elsif p_op in ('acao_criar','acao_salvar') then
  if not rh then raise exception 'Somente o RH administra ações identificadas.'; end if;
  select * into a from public.rh_escuta_acoes x where x.id=id for update;
  if p_op='acao_criar' and found then return jsonb_build_object('ok',true,'id',id); end if;
  if p_op='acao_salvar' and (a.id is null or (p_dados->>'versao')::integer is distinct from a.versao) then raise exception 'Ação indisponível ou atualizada em outra sessão.'; end if;
  if a.estado='Concluída' then raise exception 'Ação concluída: histórico preservado.'; end if;
  perform public.rh_escuta_validar_pessoa('colaboradores',p_dados->>'responsavel_id');
  titulo:=btrim(p_dados->>'titulo');prazo:=(p_dados->>'prazo')::date;estado:=coalesce(p_dados->>'estado','Pendente');resultado:=btrim(coalesce(p_dados->>'resultado',''));revisao:=nullif(p_dados->>'revisao','')::date;
  if titulo is null or length(titulo) not between 3 and 300 or prazo is null or estado not in ('Pendente','Em andamento','Concluída') or length(resultado)>4000 then raise exception 'Confira ação, prazo, situação e resultado.'; end if;
  if estado='Concluída' and length(resultado)<3 then raise exception 'Informe o resultado antes de concluir a ação.'; end if;
  if p_op='acao_criar' then
   op:=p_dados->>'origem_tipo';
   if op='entrevista' then select jsonb_build_object('colaboradorId',e.pessoa_id) into origem from public.rh_entrevistas e where e.id::text=p_dados->>'origem_id' and e.pessoa_colecao='colaboradores';
   elsif op='individual' then select jsonb_build_object('colaboradorId',i.pessoa_id) into origem from public.rh_escuta_individuais i where i.id::text=p_dados->>'origem_id';
   else
    colecao:=case op when 'feedback' then 'feedbacks' when 'pdi' then 'pdis' when 'treinamento' then 'treinamentos' when 'integracao' then 'tarefas' end;
    select registro into origem from public.registros where registros.colecao=colecao and registros.id=p_dados->>'origem_id' and not apagado;
   end if;
   if origem is null or coalesce(origem->>'colaboradorId','')='' then raise exception 'Selecione uma origem vinculada à pessoa.'; end if;
   perform public.rh_escuta_validar_pessoa('colaboradores',origem->>'colaboradorId');
   insert into public.rh_escuta_acoes(id,origem_tipo,origem_id,pessoa_id,responsavel_id,titulo,prazo,estado,resultado,revisao,concluido_em,criado_por,atualizado_por) values(id,op,p_dados->>'origem_id',origem->>'colaboradorId',p_dados->>'responsavel_id',titulo,prazo,estado,resultado,revisao,case when estado='Concluída' then now() else null end,p_user,p_user);
  else
   update public.rh_escuta_acoes x set responsavel_id=p_dados->>'responsavel_id',titulo=titulo,prazo=prazo,estado=estado,resultado=resultado,revisao=revisao,concluido_em=case when estado='Concluída' then now() else null end,versao=a.versao+1,atualizado_em=now(),atualizado_por=p_user,historico=a.historico||jsonb_build_array(to_jsonb(a)-'historico') where x.id=id;
  end if;
 else raise exception 'Operação inválida.';
 end if;
 return jsonb_build_object('ok',true,'id',id);
end $$;
revoke all on function public.rh_escuta_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rh_escuta_operar(uuid,text,jsonb) to service_role;

-- Validação usa a cópia do roteiro preservada ao iniciar.
create or replace function public.rh_entrevistas_v1(p_user uuid,p_op text,p_dados jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare
 e public.rh_entrevistas; modelo jsonb; v_id uuid; v_colecao text; v_pessoa text;
 v_agendada date; v_revisao date; v_respostas jsonb; v_sintese text; v_combinados text;
 v_estado text; k text; v text; item jsonb; pessoas jsonb; entrevistas jsonb;
begin
 if not exists(select 1 from public.perfis p where p.user_id=p_user and p.ativo is distinct from false and p.perfil='ADMIN_RH') then
  raise exception 'Somente o RH pode acessar entrevistas individuais.';
 end if;
 if p_op='listar' then
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'colecao',r.colecao,'nome',coalesce(r.registro->>'nome',r.registro->>'nomeCompleto','Cadastro sem nome'),'idPessoa',case when coalesce(r.registro->>'idPessoaBloqueado','')<>'' then null else r.registro->>'idPessoa' end) order by r.registro->>'nome'),'[]') into pessoas
  from public.registros r where r.colecao in ('colaboradores','candidatos') and not r.apagado;
  select coalesce(jsonb_agg(to_jsonb(t) order by t.agendada desc,t.criado_em desc),'[]') into entrevistas from public.rh_entrevistas t;
  return jsonb_build_object('ok',true,'pessoas',pessoas,'entrevistas',entrevistas);
 end if;
 v_id := (p_dados->>'id')::uuid;
 if v_id is null then raise exception 'Identificador da entrevista obrigatório.'; end if;
 -- Serializa novas tentativas com a mesma chave sem criar entrevistas duplicadas.
 perform pg_advisory_xact_lock(hashtextextended(v_id::text,0));
 if p_op='criar' then
  select * into e from public.rh_entrevistas where id=v_id;
  if found then return jsonb_build_object('ok',true,'id',e.id); end if;
  select m.modelo into modelo from public.rh_entrevista_modelos m where m.id=p_dados->>'modelo';
  if modelo is null then raise exception 'Modelo não encontrado.'; end if;
  v_colecao:=case when modelo->>'categoria'='selecao' then 'candidatos' else 'colaboradores' end;
  v_pessoa:=p_dados->>'pessoa_id'; v_agendada:=(p_dados->>'agendada')::date;
  if v_agendada is null or not exists(select 1 from public.registros r where r.colecao=v_colecao and r.id=v_pessoa and not r.apagado) then
   raise exception 'Selecione uma pessoa cadastrada e a data da entrevista.';
  end if;
  insert into public.rh_entrevistas(id,modelo,pessoa_colecao,pessoa_id,agendada,criado_por,atualizado_por)
   values(v_id,modelo->>'id',v_colecao,v_pessoa,v_agendada,p_user,p_user);
  return jsonb_build_object('ok',true,'id',v_id);
 end if;
 select * into e from public.rh_entrevistas where id=v_id for update;
 if not found then raise exception 'Entrevista não encontrada.'; end if;
 if p_op not in ('salvar','concluir') then raise exception 'Operação inválida.'; end if;
 if e.estado='Concluída' then raise exception 'Entrevista concluída. O registro está preservado no histórico.'; end if;
 if (p_dados->>'versao')::integer is distinct from e.versao then raise exception 'Esta entrevista foi atualizada em outra sessão. Atualize a lista antes de editar.'; end if;
 v_agendada:=(p_dados->>'agendada')::date;
 v_respostas:=coalesce(p_dados->'respostas','{}');
 v_sintese:=btrim(coalesce(p_dados->>'sintese',''));
 v_combinados:=btrim(coalesce(p_dados->>'combinados',''));
 v_revisao:=nullif(p_dados->>'revisao','')::date;
 if v_agendada is null or jsonb_typeof(v_respostas)<>'object' or length(v_sintese)>4000 or length(v_combinados)>4000 then raise exception 'Confira data e tamanho dos textos (até 4.000 caracteres).'; end if;
 modelo:=e.roteiro;
 for k,v in select key,value from jsonb_each_text(v_respostas) loop
  if not exists(select 1 from jsonb_array_elements(modelo->'perguntas') q where q->>'id'=k) or jsonb_typeof(v_respostas->k)<>'string' or length(v)>4000 then raise exception 'Resposta inválida para este roteiro.'; end if;
 end loop;
 if p_op='concluir' and length(v_sintese)<3 then raise exception 'Registre a síntese da conversa antes de concluir.'; end if;
 if p_op='concluir' and v_agendada>(now() at time zone 'America/Sao_Paulo')::date then raise exception 'A data da conversa não pode estar no futuro ao concluir.'; end if;
 if v_combinados<>'' and v_revisao is null then raise exception 'Informe quando os combinados serão revistos.'; end if;
 if v_revisao is not null and v_revisao<v_agendada then raise exception 'A revisão deve ser na data da conversa ou depois.'; end if;
 v_estado:=case when p_op='concluir' then 'Concluída' when v_sintese<>'' or v_combinados<>'' or v_respostas<>'{}'::jsonb then 'Em andamento' else 'Agendada' end;
 item:=to_jsonb(e)-'historico';
 update public.rh_entrevistas set agendada=v_agendada,respostas=v_respostas,sintese=v_sintese,combinados=v_combinados,revisao=v_revisao,
  estado=v_estado,versao=e.versao+1,atualizado_por=p_user,atualizado_em=now(),
  concluido_em=case when p_op='concluir' then now() else null end,historico=e.historico||jsonb_build_array(item)
  where id=e.id;
 return jsonb_build_object('ok',true,'id',e.id);
end;
$$;
revoke all on function public.rh_entrevistas_v1(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rh_entrevistas_v1(uuid,text,jsonb) to service_role;
