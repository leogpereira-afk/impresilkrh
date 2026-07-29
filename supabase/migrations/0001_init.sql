-- ============================================================================
-- Schema do RH no Supabase (substitui o Netlify Blobs). Um único cofre
-- genérico (colecao/id/registro jsonb) espelha exatamente o que hoje é 1 blob
-- por registro em "impresilk-registros" — o contrato do cliente (src/lib/sync.ts)
-- não muda, só troca o backend por trás da Edge Function "sync".
--
-- Tudo fica com RLS ligado e SEM policy de escrita/leitura direta: só a Edge
-- Function (que usa a service_role key, e por isso ignora RLS) acessa estas
-- tabelas. Isso reproduz a barreira que hoje é "só o Netlify Function fala com
-- o Blobs" — ninguém no navegador consegue ler o Postgres direto com a anon key.
-- ============================================================================

-- ---- registros: 1 linha por (colecao, id), mesmo modelo do Blobs ----------
create table if not exists public.registros (
  colecao      text not null,
  id           text not null,
  registro     jsonb not null,
  atualizado_em timestamptz not null default now(),
  apagado      boolean not null default false,
  primary key (colecao, id)
);
create index if not exists registros_colecao_idx on public.registros (colecao);

alter table public.registros enable row level security;

-- ---- config_global: 1 linha só (config da empresa: nome, cores etc.) -----
create table if not exists public.config_global (
  id           boolean primary key default true check (id),
  config       jsonb,
  atualizado_em timestamptz not null default now()
);
alter table public.config_global enable row level security;

-- ---- meta: contador de versão (rev) para o pull econômico -----------------
create table if not exists public.meta (
  chave        text primary key,
  valor        jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table public.meta enable row level security;

-- ---- perfis: liga um usuário do Supabase Auth a um colaborador + perfil ---
-- (substitui o antigo cofre "impresilk-auth"; a senha em si mora no
-- auth.users do Supabase, não aqui — aqui só guardamos o mapeamento.)
create table if not exists public.perfis (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  usuario      text not null unique, -- nome normalizado (sem acento/minúsculo), chave de login
  colaborador_id text not null,
  nome         text,
  perfil       text not null check (perfil in ('ADMIN_RH', 'GESTOR', 'COLABORADOR')),
  atualizado_em timestamptz not null default now()
);
alter table public.perfis enable row level security;

-- Login só precisa descobrir o PRÓPRIO perfil (perfil+colaboradorId) depois de
-- autenticar — não passa pela Edge Function, é uma leitura direta do cliente.
create policy "usuario le o proprio perfil" on public.perfis
  for select
  using (auth.uid() = user_id);

-- ADMIN_RH lê todos os perfis (tela Painel de Controle › Usuários lista as
-- contas provisionadas). Subquery em vez de recursão direta na mesma linha.
create policy "admin le todos os perfis" on public.perfis
  for select
  using (
    exists (
      select 1 from public.perfis p2
      where p2.user_id = auth.uid() and p2.perfil = 'ADMIN_RH'
    )
  );

-- ---- Storage: fotos, currículos e anexos (substitui o Blob "impresilk-fotos") ----
-- Bucket privado: assim como as tabelas acima, só a Edge Function (service_role)
-- lê/grava. Chave do objeto = id do registro (mesmo padrão de hoje: "<id>",
-- "doc:<id>", "cv:<id>").
insert into storage.buckets (id, name, public)
values ('arquivos', 'arquivos', false)
on conflict (id) do nothing;
