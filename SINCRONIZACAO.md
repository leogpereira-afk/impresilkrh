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

> Sem token configurado, **nada é enviado** — o sistema funciona 100% local,
> exatamente como antes. A sincronização é **opcional** e ligada por você.

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

2. **Crie a senha de sincronização** (variável de ambiente):
   - Site → **Site configuration → Environment variables → Add a variable**.
   - **Key:** `SYNC_TOKEN`
   - **Value:** uma senha forte à sua escolha (ex.: 20+ caracteres aleatórios).
     Guarde-a — você vai digitá-la em cada computador.
   - Salve e clique em **Deploy / Trigger deploy** para a variável valer.

3. **Ative o Netlify Blobs:**
   - Em geral já vem habilitado para o site. Se o painel pedir, ative
     **Blobs** em **Site configuration → Blobs**. Nenhuma outra configuração
     é necessária — a função usa o contexto automático do Netlify.

4. **Conecte cada computador no app:**
   - Abra o sistema, faça login como RH e clique em **Sincronizar** (no topo).
   - Em **Conectar à nuvem**, digite a mesma `SYNC_TOKEN` e clique em
     **Conectar este computador**. O app testa a conexão e liga a sincronização.

5. **Defina o computador “oficial” (uma vez):**
   - No computador que tem os **dados mais completos**, abra **Sincronizar →
     Enviar tudo (oficial)**. Isso sobe tudo para a nuvem como versão base.
   - Nos demais computadores, basta **Conectar** e usar **Sincronizar agora**
     (ou esperar — ele sincroniza sozinho a cada minuto quando online).

> A cada deploy que mude o “casco” do app, suba o número da versão do cache em
> `public/sw.js` (constante `CACHE`, ex.: `impresilk-rh-v1` → `v2`). Isso força
> os navegadores a baixarem a versão nova sem ficar presos a uma antiga.

---

## ⚠️ Aviso de segurança (importante)

A `SYNC_TOKEN` digitada no app fica **guardada no navegador** e é enviada à
função a cada chamada. Como o app roda no navegador, **esse token é visível nas
ferramentas de desenvolvedor (DevTools)** de quem usa o computador.

- Serve para **barrar acesso casual e robôs** que achem a URL da função.
- **NÃO é segurança forte.** Quem tiver acesso ao computador logado pode ler o
  token.
- Para dados realmente sensíveis, o ideal é um **login de verdade** (usuário e
  senha por pessoa, com **token JWT** emitido pelo servidor e verificado a cada
  requisição). Posso evoluir para esse modelo quando quiser.

Mantenha os computadores com sessão de RH **protegidos por senha do sistema
operacional** e não compartilhe a `SYNC_TOKEN` fora da equipe.

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
