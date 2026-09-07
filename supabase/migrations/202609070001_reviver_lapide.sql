-- Reviver lápide: quando a importação da folha é DESFEITA e depois refeita.
--
-- O problema (revisão adversarial de 07/09/2026): "Desfazer a última aplicação"
-- apaga os lançamentos que a aplicação criou, e apagar aqui grava lápide
-- (registros.apagado = true, versão sobe). Como o id de um título do ERP é
-- determinístico (`mubi-<id>`), buscar de novo o mesmo mês recria o MESMO id —
-- e o cliente, que não vê lápide, manda versão 0. As duas guardas abaixo
-- recusavam: o registro voltava a existir só no computador de quem aplicou, em
-- conflito permanente, e a nuvem nunca o recebia. O toast dizia "Folha
-- aplicada".
--
-- A regra nova, em uma frase: uma lápide não tem nada a perder; quem escreve
-- achando que está CRIANDO (versão 0) pode ocupá-la. Quem leu o registro vivo e
-- manda versão antiga continua em conflito.
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
  -- Lápide é vaga livre: um upsert que se acha o PRIMEIRO (versão 0) pode
  -- ocupá-la. Sem isto, desfazer uma importação e importar de novo o MESMO
  -- título (o id é `mubi-<id do ERP>`, determinístico) batia em conflito para
  -- sempre: o registro ficava só naquele computador e a nuvem nunca o recebia.
  -- Revisão adversarial de 07/09/2026, achado 1.
  if (atual.id is not null and not (atual.apagado and coalesce(p_versao,0)=0 and not p_apagar)
      and (p_versao is null or p_versao<>atual.rh_versao))
     or (atual.id is null and coalesce(p_versao,0)<>0) then
    return jsonb_build_object('conflito',true,'servidor',case when atual.id is null then null else jsonb_build_object('colecao',p_colecao,'registro',atual.registro||jsonb_build_object('_rhRev',atual.rh_versao)) end);
  end if;
  if p_apagar then
    if atual.id is null then return jsonb_build_object('ok',true); end if;
    conteudo := atual.registro||jsonb_build_object('_apagado',true,'atualizadoEm',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'));
  else
    if jsonb_typeof(p_registro)<>'object' or p_registro->>'id' is distinct from p_id then raise exception 'Conteúdo inválido'; end if;
    -- Reviver a lápide só quando quem escreve NÃO sabia que ela existia
    -- (versão 0 = "estou criando"). Quem leu o registro vivo e mandou uma
    -- versão antiga continua batendo em conflito, como antes.
    if atual.apagado and coalesce((p_registro->>'_apagado')::boolean,false)=false and coalesce(p_versao,0)<>0 then
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
