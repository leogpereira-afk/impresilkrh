# Login real (verificado no servidor)

Este é o modo **seguro** de acesso: a senha é conferida **no servidor**, que
emite um crachá assinado (JWT). A nuvem (dados de RH: CPF, salários, etc.) só
aceita ler/gravar para quem tem um crachá válido. É a forma correta para a LGPD.

Enquanto o login real **não** estiver ligado, o app usa o login local de sempre
(a senha é conferida no navegador) — útil, mas não protege os dados na nuvem.

---

## Como funciona

1. A pessoa digita **nome + senha** na tela de entrada (a mesma de hoje).
2. O app chama a função **`/.netlify/functions/auth`**, que confere a senha
   (guardada com **hash PBKDF2**, nunca em texto puro) e devolve um **JWT**.
3. O app guarda o crachá e o envia (`Authorization: Bearer …`) em **toda**
   conversa com a nuvem. A função de dados **rejeita** quem não tem crachá válido.
4. O crachá vale **30 dias**: dentro desse prazo, abrir o app **não** exige
   internet de novo (funciona offline). Depois disso, pede login outra vez.

> O **diretor master** entra sempre (variável `AUTH_MASTER_SENHA`), com perfil de
> RH e acesso total — assim o RH nunca fica trancado para fora.

---

## Passo a passo para ligar (no painel do Netlify)

1. **Crie as variáveis de ambiente** (Site configuration → Environment variables):
   - `JWT_SECRET` — um segredo forte e aleatório (ex.: 40+ caracteres). **Fica só
     no servidor**; nunca vai para o app. É o que liga o login real.
   - `AUTH_MASTER_SENHA` — a senha do diretor master (Leonardo).
   - `AUTH_MASTER_USUARIO` — *(opcional)* nome de usuário do master (padrão `leonardo`).
2. **Republique** (Trigger deploy). A partir daí o app entra em **modo login real**.
3. **Entre como master** (nome do master + `AUTH_MASTER_SENHA`).
4. Vá em **Painel de Controle → Usuários e Permissões**:
   - Para cada pessoa, defina a senha (campo **Senha de acesso**) e salve — a
     senha é ativada no servidor automaticamente.
   - Ou clique em **“Migrar senhas”** para enviar de uma vez todas as senhas já
     cadastradas dos usuários ativos.
5. **Feche a brecha antiga:** quando todos já tiverem senha, **remova a variável
   `SYNC_TOKEN`** do Netlify e republique. Assim a nuvem passa a aceitar **apenas**
   o crachá do login (some a chave que ficava visível no DevTools).

> Os dois modos convivem na transição: enquanto `SYNC_TOKEN` existir, a
> sincronização automática continua funcionando; ao removê-lo, vale só o login real.

---

## Comandos de verificação (após o deploy)

Troque `SEU-SITE`, `NOME` e `SENHA`.

```bash
# 1) Login devolve um token (JWT):
curl -s -X POST https://SEU-SITE.netlify.app/.netlify/functions/auth \
  -H "content-type: application/json" \
  -d '{"action":"login","usuario":"NOME","senha":"SENHA"}'
# Esperado: {"token":"xxxxx.yyyyy.zzzzz","perfil":"...","colaboradorId":"..."}

# 2) Senha errada é recusada (401):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://SEU-SITE.netlify.app/.netlify/functions/auth \
  -H "content-type: application/json" \
  -d '{"action":"login","usuario":"NOME","senha":"errada"}'
# Esperado: 401

# 3) A nuvem aceita o crachá (use o token do passo 1):
TOKEN="cole-o-token-aqui"
curl -s -X POST https://SEU-SITE.netlify.app/.netlify/functions/sync \
  -H "content-type: application/json" -H "authorization: Bearer $TOKEN" \
  -d '{"action":"ping"}'
# Esperado: {"ok":true,"ts":"..."}

# 4) Sem crachá, a nuvem recusa (401):
curl -s -o /dev/null -w "%{http_code}\n" -X POST \
  https://SEU-SITE.netlify.app/.netlify/functions/sync \
  -H "content-type: application/json" -d '{"action":"ping"}'
# Esperado: 401
```

---

## Observações de segurança

- As senhas ficam no servidor como **hash PBKDF2-SHA256 com sal** — não dá para
  “ler” a senha de volta a partir do que está guardado.
- O `JWT_SECRET` **nunca** é embutido no app (só um booleano indicando que o login
  real está ligado). Guarde-o bem; se trocá-lo, todos os crachás existentes deixam
  de valer (todo mundo refaz o login).
- Para revogar o acesso de alguém: em **Usuários**, exclua o usuário (remove a
  senha do servidor) ou troque a senha.
- O primeiro login de cada pessoa precisa de **internet**. Depois, o app abre
  offline por até 30 dias (validade do crachá).
