# Sincronização entre computadores

Este guia explica como ligar a **sincronização automática** do Sistema de RH da
Impresilk, para que uma alteração feita em um computador apareça nos outros.

---

## Como funciona (resumo)

- O app continua **rápido e funcionando offline**: tudo é salvo primeiro no
  navegador (localStorage) e a tela responde na hora.
- Cada alteração entra em uma **fila** e é enviada para a nuvem quando há
  internet. Quando o computador volta a ficar online, a fila esvazia sozinha.
- A nuvem é **uma única função no Netlify** (`/.netlify/functions/sync`) que
  guarda os dados no **Netlify Blobs** (armazenamento de objetos do Netlify).
- Conflitos (a mesma ficha editada em dois lugares) são detectados por
  **data/hora** (`atualizadoEm`) e você decide qual versão manter.
- **Sem senha:** a chave de acesso (`SYNC_TOKEN`) é **embutida no app no momento
  do build**. Assim, **todo computador que abrir o app já sincroniza sozinho** —
  ninguém precisa digitar nada.

> Enquanto o `SYNC_TOKEN` não existir no Netlify, **nada é enviado** — o sistema
> funciona 100% local, exatamente como antes.

---

## 🔎 "Atualizei aqui e não apareceu no outro PC" — solução rápida

1. Abra **Sincronizar** (topo da tela) → **Diagnóstico da sincronização**. Ele
   testa a nuvem e diz o problema exato:
   - **"Token no app: VAZIO"** → o `SYNC_TOKEN` não foi embutido no build. Crie a
     variável no Netlify e refaça o deploy (passo a passo abaixo) **ou**, para
     ligar na hora, **cole o token** no próprio painel de Sincronização (vale
     para aquele computador, sem refazer deploy).
   - **"401 — token diferente"** → o token do app não bate com o `SYNC_TOKEN` do
     Netlify. Use o mesmo valor nos dois.
   - **"500 — Blobs"** → ative o **Netlify Blobs** no site.
   - **"404 — função não publicada"** → confira o deploy (publish `dist`,
     funções em `netlify/functions`).
2. **Importante (modo login real / JWT):** se você tem `JWT_SECRET` no Netlify, o
   app exige **estar logado pelo servidor** para sincronizar. Se alguém usa o
   login local, fica **sem sincronizar**. Agora o app também aceita o **token
   compartilhado** — então basta ter o `SYNC_TOKEN` (no build ou colado no app)
   que **todo computador sincroniza, com ou sem login**.
3. No computador com os **dados mais completos**, rode **Sincronizar → Enviar
   tudo (oficial)** uma vez para semear a nuvem. Os outros recebem ao abrir.

---

## Passo a passo de configuração no painel do Netlify

> Faça uma vez só, na conta do Netlify onde o site está publicado.

1. **Conecte o repositório** (se ainda não estiver):
   - Netlify → **Add new site → Import an existing project** → GitHub →
     repositório `leogpereira-afk/impresilkrh`.
   - **Branch to deploy:** `main`.
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - As funções são detectadas automaticamente em `netlify/functions`
     (já configurado no `netlify.toml`). Não precisa mexer.

2. **Crie a variável `SYNC_TOKEN`** (a chave de acesso):
   - Site → **Site configuration → Environment variables → Add a variable**.
   - **Key:** `SYNC_TOKEN`
   - **Value:** uma senha forte à sua escolha (ex.: 20+ caracteres aleatórios).
   - Salve e clique em **Deploy / Trigger deploy**.
   - Importante: esse valor é **embutido no app durante o build** (é o que
     dispensa digitar senha). Se você **trocar** o `SYNC_TOKEN` depois, refaça o
     deploy para o app novo pegar a chave nova.

3. **Ative o Netlify Blobs:**
   - Em geral já vem habilitado para o site. Se o painel pedir, ative
     **Blobs** em **Site configuration → Blobs**. Nenhuma outra configuração
     é necessária — a função usa o contexto automático do Netlify.

4. **Pronto — já é automático:**
   - Cada computador que **abrir o app** passa a sincronizar sozinho: puxa o que
     mudou em outras máquinas ao abrir, ao voltar a ficar online e a cada minuto.
   - Ninguém digita senha. Se quiser conferir, abra **Sincronizar** (no topo) e
     use **Testar conexão**.

5. **Defina o computador “oficial” (uma vez):**
   - No computador que tem os **dados mais completos**, abra **Sincronizar →
     Enviar tudo (oficial)**. Isso sobe tudo para a nuvem como versão base.
   - Os demais recebem sozinhos ao abrir (ou use **Sincronizar agora**).

> A cada deploy que mude o “casco” do app, suba o número da versão do cache em
> `public/sw.js` (constante `CACHE`, ex.: `impresilk-rh-v1` → `v2`). Isso força
> os navegadores a baixarem a versão nova sem ficar presos a uma antiga.

---

## ⚠️ Aviso de segurança (importante)

Para a sincronização ser **automática (sem senha)**, o `SYNC_TOKEN` é **embutido
no app** durante o build. Ou seja, ele é **entregue a qualquer pessoa que abra o
site** e fica **visível nas ferramentas de desenvolvedor (DevTools)**.

- Serve para **barrar acesso casual e robôs** que achem a URL da função.
- **NÃO é segurança forte.** Quem conseguir abrir o site consegue ler a chave e,
  com ela, chamar a função diretamente.
- Como o sistema guarda dados sensíveis (CPF, salários, retiradas), o ideal para
  proteção real é o **login de verdade** (usuário e senha por pessoa, com **token
  JWT** emitido pelo servidor e verificado a cada requisição). **Isso já está
  pronto** — veja **`LOGIN.md`**. Ao ligá-lo e remover o `SYNC_TOKEN`, esta
  exposição da chave deixa de existir.

Enquanto isso, mantenha o **endereço do site restrito à equipe**, os computadores
**protegidos por senha do sistema operacional** e troque o `SYNC_TOKEN` (e
refaça o deploy) se desconfiar de vazamento.

---

## Comandos de verificação (após o deploy)

Troque `SEU-SITE` pelo domínio do Netlify e `SUA-SENHA` pela `SYNC_TOKEN`.

```bash
# 1) O site responde (200) na raiz:
curl -I https://SEU-SITE.netlify.app/ | head -n 1
# Esperado: HTTP/2 200

# 2) O Service Worker está publicado e mostra a versão do cache:
curl -s https://SEU-SITE.netlify.app/sw.js | grep "const CACHE"
# Esperado: const CACHE = "impresilk-rh-v1";  (ou a versão atual)

# 3) A função de sincronização responde ao "ping":
curl -s -X POST https://SEU-SITE.netlify.app/.netlify/functions/sync \
  -H "content-type: application/json" \
  -H "x-token: SUA-SENHA" \
  -d '{"action":"ping"}'
# Esperado: {"ok":true,"ts":"...."}

# 4) Token errado deve ser recusado (401):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://SEU-SITE.netlify.app/.netlify/functions/sync \
  -H "content-type: application/json" -H "x-token: errado" \
  -d '{"action":"ping"}'
# Esperado: 401
```

### Se algo der errado

- **404 na função:** confira se a pasta de funções é `netlify/functions` e se o
  deploy terminou. O diretório de publicação deve ser `dist`.
- **401 (Token inválido):** a `SYNC_TOKEN` do Netlify e a senha digitada no app
  estão diferentes. Refaça a variável e o deploy, e reconecte no app.
- **500 (SYNC_TOKEN não configurado):** a variável de ambiente não existe ou o
  deploy não rodou depois de criá-la.

---

## Contrato da função (referência técnica)

`POST /.netlify/functions/sync` com header `x-token: <SYNC_TOKEN>` e corpo JSON
`{ "action": "...", ... }`:

| action       | payload                          | resposta                                  |
|--------------|----------------------------------|-------------------------------------------|
| `ping`       | —                                | `{ ok, ts }`                              |
| `list`       | `{ offset }`                     | `{ registros, nextOffset, total }`        |
| `upsert`     | `{ colecao, registro }`          | `{ ok }` ou `{ conflito, servidor }`      |
| `bulkUpsert` | `{ registros: [...] }`           | `{ ok, gravados }`                        |
| `delete`     | `{ colecao, id }`                | `{ ok }`                                  |
| `getCfg`     | —                                | `{ config }`                              |
| `setCfg`     | `{ config }`                     | `{ ok }`                                  |
| `putPhoto`   | `{ id, dataUrl }`                | `{ ok }`                                  |
| `getPhoto`   | `{ id }`                         | `{ dataUrl }`                             |

O contrato é estável: o backend (Netlify Blobs) pode ser trocado depois sem
mudar o cliente.
