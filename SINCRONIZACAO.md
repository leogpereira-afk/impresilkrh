# Sincronização entre computadores

Este guia explica como a **sincronização automática** do Sistema de RH da
Impresilk funciona hoje, com o **Supabase** como nuvem (Postgres + Storage +
Edge Functions) e o app publicado como site estático no **GitHub Pages**.

> **Estado atual (no ar):** o sistema roda em
> **`https://leogpereira-afk.github.io/impresilkrh/`**, com o projeto Supabase
> `heveemylixartyijxewh` (banco, RLS, Storage e as Edge Functions `sync` e
> `admin-users` publicados). Os dados foram migrados e a conta ADMIN_RH do
> diretor já existe. **O Netlify foi desativado** (site apagado) — o histórico
> abaixo sobre o Netlify fica só como referência do que foi feito.

---

## Como funciona (resumo)

- O app continua **rápido e funcionando offline**: tudo é salvo primeiro no
  navegador (localStorage) e a tela responde na hora.
- Cada alteração entra em uma **fila** e é enviada para a nuvem quando há
  internet. Quando o computador volta a ficar online, a fila esvazia sozinha.
- A nuvem é a Edge Function **`sync`** do Supabase, que guarda os dados na
  tabela `registros` do Postgres (1 linha por `colecao`+`id`, o mesmo modelo
  que antes era 1 blob por registro).
- Conflitos (a mesma ficha editada em dois lugares) são detectados por
  **data/hora** (`atualizadoEm`) e você decide qual versão manter.
- **Exige login** (ver `LOGIN.md`) — não existe mais token embutido no build.
  Sem sessão válida, a sincronização fica desligada e o app funciona 100% local.

---

## 🔎 "Atualizei aqui e não apareceu no outro PC" — solução rápida

1. Abra **Sincronizar** (topo da tela) → **Diagnóstico da sincronização**. Ele
   testa a nuvem e diz o problema exato:
   - **"Modo: Supabase não configurado neste build"** → faltam
     `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` no deploy (ver seção
     "GitHub Pages" abaixo).
   - **"Login real — sem crachá"** → a pessoa não está logada; faça login.
   - **"401"** → sessão expirada ou a conta não tem linha em `perfis`
     (fale com o RH para reprovisionar).
   - **"500"** → falha na Edge Function ou no Postgres (confira os logs no
     Supabase Dashboard → Edge Functions → sync → Logs).
   - **"404"** → a Edge Function `sync` não foi publicada.
2. No computador com os **dados mais completos**, rode **Sincronizar → Enviar
   tudo (oficial)** uma vez para semear a nuvem. Os outros recebem ao abrir.

---

## Configuração do Supabase (uma vez só)

1. **Schema e Edge Functions**: com o projeto conectado ao repositório no
   GitHub (Project Settings → Integrations → GitHub — feito), o Supabase
   aplica sozinho, a cada push:
   - o arquivo [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
     — cria as tabelas `registros`, `config_global`, `meta`, `perfis`, o RLS e
     o bucket de Storage `arquivos`;
   - as duas Edge Functions, porque estão declaradas em
     [`supabase/config.toml`](supabase/config.toml) (`[functions.sync]` e
     `[functions.admin-users]`) — sem essa declaração, a integração aplica só
     o banco e ignora as functions.

   Nenhuma secret precisa ser configurada no GitHub pra isso — é tudo feito
   pela própria integração Supabase↔GitHub. Sem essa integração, rode a
   migration à mão no SQL Editor e publique as functions com
   `supabase functions deploy sync` / `supabase functions deploy admin-users`
   (CLI instalada e logada), ou colando cada `index.ts` no editor de Functions
   do Dashboard.
2. **Bootstrap da primeira conta**: veja "Bootstrap da primeira conta ADMIN_RH"
   em `LOGIN.md` — precisa ser feito manualmente uma vez (é a única conta que
   não dá pra criar via app, porque ainda não existe nenhum ADMIN_RH).
3. **Chaves do projeto** (Settings → API): guarde a **Project URL** e a
   **anon key** — são as duas variáveis que o build do app precisa
   (`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, ver seção GitHub Pages
   abaixo).

## GitHub Pages (deploy do site)

1. No repositório → **Settings → Pages**: em "Build and deployment", escolha
   **Source: GitHub Actions** (uma vez só).
2. **Settings → Secrets and variables → Actions → Variables** (aba
   *Variables*, não *Secrets* — a anon key é pública por design): crie
   `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com os valores do passo
   anterior.
3. Dê push na branch configurada no workflow (`.github/workflows/deploy.yml`,
   hoje `main`) ou rode o workflow manualmente (aba **Actions**). Isso builda e
   publica `dist/` no Pages, disponível em
   `https://SEU-USUARIO.github.io/impresilkrh/`.

> **Domínio final (`impresilk.com.br/rh`):** o plano combinado é ter um
> repositório "hub" que builda este app (e os demais sistemas da Impresilk —
> PCP, Produção etc.) e publica todos juntos em `impresilk.com.br`, cada um no
> seu caminho. Esse hub é um projeto à parte, ainda não construído. Este repo
> já sai pronto para ser encaixado nele: `vite.config.ts` lê `BASE_PATH` do
> ambiente (o hub builda este app com `BASE_PATH=/rh/`); sem essa variável, o
> build usa `/impresilkrh/` (a própria URL do GitHub Pages deste repo).

## Migrar os dados do site antigo (Netlify)

Rode uma vez, com o site antigo ainda no ar:

```bash
NETLIFY_SITE_URL=https://impresilkrh.netlify.app \
NETLIFY_ADMIN_USUARIO="leonardo goncalves" \
NETLIFY_ADMIN_SENHA="senha-do-master-no-site-antigo" \
SUPABASE_URL=https://SEU-PROJETO.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key \
node scripts/migrate-from-netlify.mjs
```

Isso copia todos os registros e a config global para o Supabase e lista as
contas atuais — as **senhas em si não são migráveis** (o Supabase guarda o
hash de um jeito diferente), então recrie cada conta em **Painel de Controle
› Usuários** depois do deploy.

> A cada deploy que mude o "casco" do app, suba o número da versão do cache em
> `public/sw.js` (constante `CACHE`, ex.: `impresilk-rh-v6` → `v7`). Isso força
> os navegadores a baixarem a versão nova sem ficar presos a uma antiga.

---

## ⚠️ O que mudou de segurança em relação ao modelo antigo

O modelo anterior (Netlify) tinha um `SYNC_TOKEN` **embutido no app**, visível
no DevTools de qualquer pessoa que abrisse o site — servia só para barrar
acesso casual. Esse modelo **não existe mais**: hoje **toda** sincronização
exige uma sessão de login válida (Supabase Auth), e o único segredo com poder
de escrita irrestrita (a **service_role key**) nunca sai do Supabase.

---

## Comandos de verificação (após configurar)

Troque `SEU-PROJETO` e `TOKEN` pelo access_token de uma sessão logada (ver
`LOGIN.md` para como obter um).

```bash
# 1) O site responde (200) na raiz:
curl -I https://SEU-DOMINIO/ | head -n 1
# Esperado: HTTP/2 200

# 2) O Service Worker está publicado e mostra a versão do cache:
curl -s https://SEU-DOMINIO/sw.js | grep "const CACHE"
# Esperado: const CACHE = "impresilk-rh-v6";  (ou a versão atual)

# 3) A Edge Function de sincronização responde ao "ping":
curl -s -X POST "https://SEU-PROJETO.supabase.co/functions/v1/sync" \
  -H "content-type: application/json" -H "authorization: Bearer TOKEN" \
  -d '{"action":"ping"}'
# Esperado: {"ok":true,"ts":"...."}

# 4) Sem crachá deve ser recusado (401):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  "https://SEU-PROJETO.supabase.co/functions/v1/sync" \
  -H "content-type: application/json" -d '{"action":"ping"}'
# Esperado: 401
```

### Se algo der errado

- **404 na função:** confira se `supabase functions deploy sync` foi
  publicado (Dashboard → Edge Functions).
- **401:** sessão expirada, ou a conta não tem linha em `perfis` — refaça o
  login ou reprovisione em Painel de Controle › Usuários.
- **500:** veja os logs da função no Dashboard — geralmente é uma tabela/RLS
  que ainda não foi criada (rode a migration) ou uma variável de ambiente
  ausente (`SUPABASE_URL`/`SUPABASE_ANON_KEY`/`SUPABASE_SERVICE_ROLE_KEY` são
  injetadas automaticamente pelo Supabase em toda Edge Function — não precisa
  configurar à mão).

---

## Contrato da função (referência técnica)

`POST https://SEU-PROJETO.supabase.co/functions/v1/sync` com header
`authorization: Bearer <access_token>` e corpo JSON `{ "action": "...", ... }`:

| action       | payload                          | resposta                                       |
|--------------|-----------------------------------|-------------------------------------------------|
| `ping`       | —                                | `{ ok, ts }`                                    |
| `rev`        | —                                | `{ rev }`                                       |
| `list`       | `{ after }` (ou `{ offset }`)    | `{ registros, nextAfter, nextOffset, total }`   |
| `upsert`     | `{ colecao, registro }`          | `{ ok }` ou `{ conflito, servidor }`            |
| `bulkUpsert` | `{ registros: [...] }`           | `{ ok, gravados }`                              |
| `delete`     | `{ colecao, id }`                | `{ ok }`                                        |
| `limparColecao` | `{ colecao }`                | `{ ok, apagados }`                              |
| `getCfg`     | —                                | `{ config }`                                    |
| `setCfg`     | `{ config }`                     | `{ ok }`                                        |
| `putPhoto`   | `{ id, dataUrl }`                | `{ ok }`                                        |
| `getPhoto`   | `{ id }`                         | `{ dataUrl }`                                   |

`POST https://SEU-PROJETO.supabase.co/functions/v1/admin-users` (só ADMIN_RH):

| action           | payload                                                          | resposta   |
|------------------|-------------------------------------------------------------------|------------|
| `provisionar`    | `{ usuario, colaboradorId, perfil, nome?, senha }`                | `{ ok }`   |
| `removerAcesso`  | `{ usuario }`                                                      | `{ ok }`   |

O contrato é estável: o backend (hoje Supabase) pode ser trocado depois sem
mudar o cliente.
