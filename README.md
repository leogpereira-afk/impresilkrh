# RH Impresilk — Sistema de Gestão de Pessoas

Aplicação web **leve, rápida e fluida** para centralizar a gestão de Recursos Humanos da
**Impresilk Comunicação Visual** (empresa com 40+ anos de mercado, ~30 colaboradores,
Montes Claros/MG). Substitui o controle disperso em planilhas por uma plataforma única.

> **Offline-first.** Todos os dados reais já vêm embutidos no app; as edições ficam no
> **navegador** (`localStorage`) e sincronizam com o **Supabase** (Postgres + Auth + Storage +
> Edge Functions) quando há internet. Publicado como **site estático** no **GitHub Pages** — sem
> servidor próprio para manter. Interface 100% em **português do Brasil**.

Identidade visual executiva e sóbria (marinho `#16334f` + dourado `#c2a14d`), responsiva para
desktop e celular, tipografia Inter.

---

## Arquitetura

- **Vite + React + TypeScript** (SPA) com **React Router** (navegação client-side).
- **Tailwind CSS** para o estilo; **Recharts** (gráficos) e **lucide-react** (ícones).
- **Dados embutidos** em `src/data/*` (módulos TypeScript) com todos os dados reais da empresa.
- **Persistência local** via `localStorage` numa camada única: `src/lib/store.ts` expõe o hook
  `useColecao(nome)` (carrega o default na 1ª vez, salva edições, CRUD completo).
- **Nuvem (Supabase)**: Postgres (tabela genérica `registros`, espelhando o modelo local),
  Auth (login por nome+senha), Storage (fotos/anexos) e duas Edge Functions (`sync`,
  `admin-users`) — ver `SINCRONIZACAO.md` e `LOGIN.md`.
- **Backup/portabilidade**: botões **Exportar** e **Importar** (.json) para salvar, restaurar e
  transferir tudo entre navegadores. Há também **Restaurar padrão**.
- **RBAC e mascaramento LGPD**: aplicado tanto no cliente (`src/lib/rbac.ts`) quanto na Edge
  Function `sync` (defesa em profundidade — o navegador nunca é a única barreira).

## Perfis de acesso

Login real por **nome + senha**, verificado no Supabase Auth (ver `LOGIN.md`).

- **ADMIN_RH** — acesso total, incluindo o **Painel de Controle**.
- **GESTOR** — vê e gerencia apenas a sua equipe (hierarquia recursiva).
- **COLABORADOR** — autoatendimento dos próprios dados.

CPF, salário e dados familiares são mascarados para quem não é RH nem o próprio colaborador
(boa prática LGPD). O gestor **não** vê o salário individual de subordinado.

## Módulos

Painel (dashboard por perfil) · Colaboradores (ficha completa, documentos, férias,
desenvolvimento, histórico) · Organograma navegável com edição de hierarquia · Carreira e
Salários (régua N1–N5, tabela salarial, simulador de progressão) · Desempenho e Retenção
(notas, 9-Box, metas, PDI, feedback) · Férias (saldos e conformidade CLT) · Integração e
Desligamento (checklists) · Viagens e Diárias · Comunicação interna · POPs e Procedimentos ·
Documentos Institucionais e SST · Termos e Aceites (Código de Ética) · Relatórios Gerenciais ·
Registros de Acesso (LGPD) · **Painel de Controle** (edição de todo o conteúdo pelo RH).

## Como rodar

```bash
npm install
cp .env.example .env   # opcional: preencha para testar a nuvem em dev
npm run dev      # ambiente de desenvolvimento
npm run build    # gera a pasta estática dist/
npm run preview  # pré-visualiza o build
```

Sem `.env` (ou sem as duas variáveis `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
preenchidas), o app funciona 100% local, sem sincronização.

## Publicar (GitHub Pages + Supabase)

O deploy é automático via `.github/workflows/deploy.yml` a cada push na branch
configurada — builda com `npm run build` e publica `dist/` no GitHub Pages.
Passo a passo completo (schema do banco, Edge Functions, variáveis do Actions,
domínio próprio) em **`SINCRONIZACAO.md`**.

## Armazenamento de arquivos (uploads)

Os anexos (documentos do colaborador, advertências, fotos do organograma,
arquivos do repositório institucional) são lidos no navegador; localmente
ficam em **IndexedDB** (cota bem maior que o localStorage) e, com a
sincronização ligada, sobem para o **Supabase Storage** (bucket `arquivos`),
disponíveis em qualquer computador logado.

- **Limite:** ~2 MB por arquivo (1 MB para fotos do organograma) — o app avisa
  ao ultrapassar.
- **Backup local:** **Exportar dados (.json)** continua funcionando para levar
  tudo (dados + anexos) de um navegador para outro, com ou sem nuvem.
- **Abertura:** ao clicar em um documento, ele **abre em nova aba**.

## Estrutura

```
src/
  data/        # dados reais embutidos (áreas, cargos, colaboradores, POPs, etc.)
  lib/         # store (localStorage), sync, auth (Supabase), RBAC, domínio, formatação
  components/  # UI kit, layout, gráficos, formulários
  pages/       # uma página por módulo
supabase/
  migrations/  # schema do Postgres (registros, config_global, meta, perfis) + RLS
  functions/   # Edge Functions: sync (dados) e admin-users (contas)
scripts/
  migrate-from-netlify.mjs  # migração única dos dados do site antigo
.github/workflows/
  deploy.yml                    # build + deploy do site no GitHub Pages
  deploy-supabase-functions.yml # publica as Edge Functions (sync, admin-users)
```
