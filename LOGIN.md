# Login real (Supabase Auth)

O login é sempre verificado **no servidor** (Supabase Auth) — não existe mais o
modo "local" com senha conferida só no navegador nem token compartilhado. A
nuvem (dados de RH: CPF, salários etc.) só aceita ler/gravar para quem tem uma
sessão válida.

---

## Como funciona

1. A pessoa digita **nome + senha** na tela de entrada (igual a sempre — não é
   e-mail).
2. O app normaliza o nome (`normalizarUsuario`, em `src/lib/auth.ts`) e chama
   `supabase.auth.signInWithPassword({ email: "<nome-normalizado>@rh.impresilk.local", password })`.
   O "e-mail" é só um identificador interno do Supabase Auth — ninguém precisa
   ter e-mail de verdade cadastrado, e ninguém recebe e-mail nenhum.
3. Login OK → o app lê o perfil (ADMIN_RH/GESTOR/COLABORADOR) e o
   `colaboradorId` na tabela `perfis` (Postgres) e guarda a sessão.
4. Toda chamada com a nuvem (Edge Functions `sync` e `admin-users`) vai com
   `Authorization: Bearer <access_token>` da sessão do Supabase. Sem sessão
   válida, a nuvem recusa (401).
5. A sessão é renovada sozinha pelo `supabase-js` enquanto o navegador ficar
   aberto; expirando, pede login de novo.

> O **acesso fixo do dono** (nome "leonardo"/"leonardo goncalves" + a senha
> curta cadastrada em `src/pages/Login.tsx`) continua existindo, **fora** do
> Supabase — é a rede de segurança para o dono nunca ficar trancado para fora,
> mesmo que o Supabase esteja fora do ar ou mal configurado.

---

## Provisionar contas (Painel de Controle › Usuários)

Criar/atualizar a senha de alguém chama a Edge Function `admin-users` (ação
`provisionar`), que só um usuário com perfil **ADMIN_RH** pode acionar. Ela usa
a **service_role key** do Supabase (nunca exposta no navegador) para criar ou
atualizar a conta no Supabase Auth e gravar o vínculo em `perfis`.

- Definir a senha de cada pessoa no formulário ativa a conta na hora.
- **"Migrar senhas"** envia de uma vez as senhas já cadastradas dos usuários
  ativos (útil na primeira migração de dados).
- Excluir um usuário (perfil "Usuários") apaga a conta inteira no Supabase Auth
  (`admin-users` / `removerAcesso`) — revoga o acesso imediatamente.

## Bootstrap da primeira conta ADMIN_RH

A Edge Function `admin-users` só aceita chamadas de quem **já é** ADMIN_RH —
então a toda primeira conta precisa ser criada manualmente, uma única vez:

1. Supabase Dashboard → **Authentication → Users → Add user**: e-mail
   `leonardo.goncalves@rh.impresilk.local` (ajuste ao nome normalizado do
   master), senha à sua escolha, **Auto Confirm User** marcado.
2. Copie o `User UID` gerado e rode no **SQL Editor** do Supabase:
   ```sql
   insert into public.perfis (user_id, usuario, colaborador_id, nome, perfil)
   values ('COLE-O-USER-UID-AQUI', 'leonardo goncalves', 'leonardo-goncalves', 'Leonardo Gonçalves', 'ADMIN_RH');
   ```
3. Pronto — esse usuário já consegue entrar pelo app e usar "Migrar senhas" /
   provisionar todo o resto da equipe pela própria tela.

---

## Comandos de verificação (após configurar)

Troque `SEU-PROJETO`, `NOME`, `SENHA` e o e-mail sintético correspondente.

```bash
# 1) Login devolve uma sessão (access_token):
curl -s -X POST "https://SEU-PROJETO.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: SUA-ANON-KEY" -H "content-type: application/json" \
  -d '{"email":"nome.normalizado@rh.impresilk.local","password":"SENHA"}'
# Esperado: {"access_token":"...", "user": {...}, ...}

# 2) Senha errada é recusada (400):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://SEU-PROJETO.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: SUA-ANON-KEY" -H "content-type: application/json" \
  -d '{"email":"nome.normalizado@rh.impresilk.local","password":"errada"}'
# Esperado: 400

# 3) A nuvem aceita o crachá (use o access_token do passo 1):
TOKEN="cole-o-access-token-aqui"
curl -s -X POST "https://SEU-PROJETO.supabase.co/functions/v1/sync" \
  -H "content-type: application/json" -H "authorization: Bearer $TOKEN" \
  -d '{"action":"ping"}'
# Esperado: {"ok":true,"ts":"..."}

# 4) Sem crachá, a nuvem recusa (401):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://SEU-PROJETO.supabase.co/functions/v1/sync" \
  -H "content-type: application/json" -d '{"action":"ping"}'
# Esperado: 401
```

---

## Observações de segurança

- As senhas ficam guardadas pelo próprio Supabase Auth (padrão da indústria,
  fora do nosso código) — este app nunca vê nem guarda a senha em texto puro.
- A **service_role key** (usada pelas Edge Functions para criar/apagar contas e
  ler/gravar os dados) **nunca** sai do Supabase — não vai para o GitHub, não
  vai para o bundle do app. Só a **anon key** (pública, protegida por RLS) fica
  no app.
- Para revogar o acesso de alguém: em **Usuários**, exclua o usuário.
- O primeiro login de cada pessoa precisa de internet; depois, o
  `supabase-js` mantém a sessão viva localmente até expirar.
