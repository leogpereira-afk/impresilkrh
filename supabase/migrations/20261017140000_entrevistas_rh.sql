-- Entrevistas identificadas ficam fora de registros, cache e exportação geral.
create table public.rh_entrevista_modelos(id text primary key, modelo jsonb not null);
create table public.rh_entrevistas(
 id uuid primary key, modelo text not null references public.rh_entrevista_modelos(id),
 pessoa_colecao text not null check(pessoa_colecao in ('colaboradores','candidatos')), pessoa_id text not null,
 agendada date not null, estado text not null default 'Agendada' check(estado in ('Agendada','Em andamento','Concluída')),
 respostas jsonb not null default '{}', sintese text not null default '', combinados text not null default '', revisao date,
 versao integer not null default 1, criado_por uuid not null, atualizado_por uuid not null,
 criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(), concluido_em timestamptz,
 historico jsonb not null default '[]'
);
alter table public.rh_entrevista_modelos enable row level security;
alter table public.rh_entrevistas enable row level security;
revoke all on public.rh_entrevista_modelos, public.rh_entrevistas from public, anon, authenticated;

create function public.rh_entrevistas_operar(p_user uuid,p_op text,p_dados jsonb default '{}') returns jsonb
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
 select m.modelo into modelo from public.rh_entrevista_modelos m where m.id=e.modelo;
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
revoke all on function public.rh_entrevistas_operar(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.rh_entrevistas_operar(uuid,text,jsonb) to service_role;

insert into public.rh_entrevista_modelos(id,modelo) values('selecao',$modelo${"id": "selecao", "titulo": "Entrevista de seleção", "categoria": "selecao", "momento": "Antes da contratação", "objetivo": "Entender experiências e expectativas relacionadas à vaga.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Quais experiências suas se relacionam com as atividades desta vaga?"}, {"id": "q2", "texto": "Conte uma situação de trabalho em que precisou resolver um problema. Como agiu e qual foi o resultado?"}, {"id": "q3", "texto": "Como você organiza prioridades quando há mais de uma entrega?"}, {"id": "q4", "texto": "Como costuma pedir ajuda ou lidar com uma orientação que não entendeu?"}, {"id": "q5", "texto": "Que condições e informações sobre a vaga você precisa esclarecer?"}, {"id": "q6", "texto": "Quais expectativas você tem sobre o trabalho e o desenvolvimento aqui?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('entrada',$modelo${"id": "entrada", "titulo": "Boas-vindas e entrada", "categoria": "entrada", "momento": "Primeira semana", "objetivo": "Alinhar expectativas e garantir apoio para começar.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Como foi sua chegada e o que ainda precisa ser explicado?"}, {"id": "q2", "texto": "Você entendeu suas atividades, horários e a quem recorrer?"}, {"id": "q3", "texto": "Os acessos, materiais e orientações necessários foram disponibilizados?"}, {"id": "q4", "texto": "Como prefere receber orientações e tirar dúvidas?"}, {"id": "q5", "texto": "Que experiência ou habilidade sua podemos aproveitar melhor?"}, {"id": "q6", "texto": "O que precisamos providenciar para facilitar seus primeiros dias?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('integracao30',$modelo${"id": "integracao30", "titulo": "Integração · 30 dias", "categoria": "entrada", "momento": "Após o primeiro mês", "objetivo": "Conferir adaptação e remover dificuldades iniciais.", "versao": 1, "perguntas": [{"id": "q1", "texto": "O trabalho está correspondendo ao que foi apresentado na entrada?"}, {"id": "q2", "texto": "Quais atividades já consegue realizar com segurança e quais precisam de apoio?"}, {"id": "q3", "texto": "As orientações e o treinamento inicial foram suficientes?"}, {"id": "q4", "texto": "Como está a convivência com a equipe e a liderança?"}, {"id": "q5", "texto": "Que dificuldade prática podemos resolver agora?"}, {"id": "q6", "texto": "Qual será o foco de aprendizado para o próximo mês?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('integracao60',$modelo${"id": "integracao60", "titulo": "Integração · 60 dias", "categoria": "entrada", "momento": "Após dois meses", "objetivo": "Acompanhar autonomia, feedback e aprendizado.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Em quais atividades ganhou autonomia desde a última conversa?"}, {"id": "q2", "texto": "Que orientações ainda geram dúvida ou retrabalho?"}, {"id": "q3", "texto": "Você recebe feedback claro sobre suas entregas?"}, {"id": "q4", "texto": "Como estão a carga de trabalho e a organização da rotina?"}, {"id": "q5", "texto": "Os apoios combinados anteriormente foram realizados?"}, {"id": "q6", "texto": "Qual apoio ou treinamento deve ser priorizado agora?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('integracao90',$modelo${"id": "integracao90", "titulo": "Integração · 90 dias", "categoria": "entrada", "momento": "Após três meses", "objetivo": "Consolidar a integração e combinar o desenvolvimento.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Como avalia sua adaptação ao trabalho e à equipe?"}, {"id": "q2", "texto": "Quais entregas e aprendizados considera mais importantes até aqui?"}, {"id": "q3", "texto": "O que ainda dificulta realizar bem suas atividades?"}, {"id": "q4", "texto": "As expectativas do cargo estão claras para você?"}, {"id": "q5", "texto": "Quais oportunidades de desenvolvimento gostaria de discutir?"}, {"id": "q6", "texto": "O que vamos manter ou ajustar nos próximos meses?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('acompanhamento',$modelo${"id": "acompanhamento", "titulo": "Conversa de acompanhamento", "categoria": "acompanhamento", "momento": "Conversa periódica", "objetivo": "Revisar a rotina, os apoios e os combinados.", "versao": 1, "perguntas": [{"id": "q1", "texto": "O que funcionou bem desde nossa última conversa?"}, {"id": "q2", "texto": "Qual é a principal dificuldade do seu dia a dia hoje?"}, {"id": "q3", "texto": "Como estão as prioridades e a distribuição das tarefas?"}, {"id": "q4", "texto": "Você tem recebido o apoio necessário da liderança e da equipe?"}, {"id": "q5", "texto": "O que aconteceu com os combinados da conversa anterior?"}, {"id": "q6", "texto": "Qual próximo passo ajudaria mais e de quem depende?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('permanencia',$modelo${"id": "permanencia", "titulo": "Permanência e motivação", "categoria": "acompanhamento", "momento": "Antes de haver intenção de saída", "objetivo": "Entender o que favorece a permanência e o que pode melhorar.", "versao": 1, "perguntas": [{"id": "q1", "texto": "O que faz você querer continuar trabalhando aqui?"}, {"id": "q2", "texto": "Em quais momentos se sente mais valorizado no trabalho?"}, {"id": "q3", "texto": "O que mais dificulta sua experiência hoje?"}, {"id": "q4", "texto": "Que mudança tornaria seu trabalho mais satisfatório?"}, {"id": "q5", "texto": "Como enxerga suas oportunidades de crescimento?"}, {"id": "q6", "texto": "Existe algo que poderia levar você a procurar outra oportunidade e que queira compartilhar?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('desenvolvimento',$modelo${"id": "desenvolvimento", "titulo": "Carreira e desenvolvimento", "categoria": "desenvolvimento", "momento": "Revisão do desenvolvimento", "objetivo": "Transformar interesses e necessidades em combinados.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Que competências gostaria de desenvolver?"}, {"id": "q2", "texto": "Que atividades ou responsabilidades gostaria de conhecer melhor?"}, {"id": "q3", "texto": "Que exemplos mostram seus avanços e dificuldades?"}, {"id": "q4", "texto": "Quais oportunidades de aprendizado seriam mais úteis?"}, {"id": "q5", "texto": "Como podemos observar a evolução na prática?"}, {"id": "q6", "texto": "Que ação de desenvolvimento vamos combinar e para quando?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('treinamento',$modelo${"id": "treinamento", "titulo": "Avaliação pós-treinamento", "categoria": "desenvolvimento", "momento": "Depois do treinamento", "objetivo": "Conferir aprendizado, aplicação e apoio necessário.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Qual treinamento foi realizado e o que esperava aprender?"}, {"id": "q2", "texto": "Quais aprendizados foram mais úteis?"}, {"id": "q3", "texto": "O que ainda ficou sem clareza ou precisa ser praticado?"}, {"id": "q4", "texto": "Onde conseguirá aplicar o aprendizado na rotina?"}, {"id": "q5", "texto": "Que apoio ou recurso falta para colocar isso em prática?"}, {"id": "q6", "texto": "Como e quando vamos conferir se o treinamento ajudou?"}]}$modelo$::jsonb);

insert into public.rh_entrevista_modelos(id,modelo) values('saida',$modelo${"id": "saida", "titulo": "Entrevista de saída", "categoria": "saida", "momento": "Próximo ao desligamento", "objetivo": "Aprender com a experiência e organizar a transição.", "versao": 1, "perguntas": [{"id": "q1", "texto": "Quais fatores contribuíram para sua decisão ou como percebe o encerramento do vínculo?"}, {"id": "q2", "texto": "O que foi positivo na sua experiência aqui?"}, {"id": "q3", "texto": "O que poderia ter sido melhor na organização do trabalho e no apoio recebido?"}, {"id": "q4", "texto": "Como avalia as oportunidades de aprendizado e reconhecimento?"}, {"id": "q5", "texto": "Que sugestão deixaria para melhorar a experiência de quem permanece?"}, {"id": "q6", "texto": "Quais informações ou pendências precisam ser repassadas na transição?"}]}$modelo$::jsonb);
