# RH Impresilk — Sistema de Gestão de Pessoas

Aplicação web **leve, rápida e fluida** para centralizar a gestão de Recursos Humanos da
**Impresilk Comunicação Visual** (empresa com 40+ anos de mercado, ~30 colaboradores,
Montes Claros/MG). Substitui o controle disperso em planilhas por uma plataforma única.

> **Sem banco de dados.** Todos os dados reais já vêm embutidos no app; as edições ficam no
> **navegador** (`localStorage`). É publicável como **site estático** (Netlify) — sem servidor,
> sem variáveis de ambiente, sem "cold start". Interface 100% em **português do Brasil**.

Identidade visual executiva e sóbria (marinho `#16334f` + dourado `#c2a14d`), responsiva para
desktop e celular, tipografia Inter.

---

## Arquitetura

- **Vite + React + TypeScript** (SPA) com **React Router** (navegação client-side).
- **Tailwind CSS** para o estilo; **Recharts** (gráficos) e **lucide-react** (ícones).
- **Dados embutidos** em `src/data/*` (módulos TypeScript) com todos os dados reais da empresa.
- **Persistência** via `localStorage` numa camada única: `src/lib/store.ts` expõe o hook
  `useColecao(nome)` (carrega o default na 1ª vez, salva edições, CRUD completo).
- **Backup/portabilidade**: botões **Exportar** e **Importar** (.json) para salvar, restaurar e
  transferir tudo entre navegadores. Há também **Restaurar padrão**.
- **RBAC e mascaramento LGPD** 100% client-side (`src/lib/rbac.ts`).

## Perfis de acesso

Login por **seleção de perfil + senha única de demonstração**: `Impresilk@2026`.

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
npm run dev      # ambiente de desenvolvimento
npm run build    # gera a pasta estática dist/
npm run preview  # pré-visualiza o build
```

## Publicar no Netlify

1. `npm run build` gera `dist/`.
2. Faça **drag-and-drop** da pasta `dist/` no Netlify **ou** conecte o repositório
   (o `netlify.toml` já define `command = npm run build`, `publish = dist` e o redirect SPA).

Nenhuma variável de ambiente é necessária.

## Armazenamento de arquivos (uploads)

Como o sistema é **estático e sem servidor**, todos os anexos (documentos do
colaborador, advertências, fotos do organograma, arquivos do repositório
institucional) são lidos no navegador e guardados como **data URL** dentro do
`localStorage`, junto com os demais dados. Implicações:

- **Limite:** ~2 MB por arquivo (1 MB para fotos do organograma) — o app avisa
  ao ultrapassar. O `localStorage` tem cota total (~5–10 MB por navegador), então
  os anexos devem ser usados com parcimônia.
- **Onde fica:** somente **no navegador** em que o upload foi feito. Para
  transferir/!fazer backup, use **Exportar dados (.json)** — os anexos vão junto.
- **Abertura:** ao clicar em um documento, ele **abre em nova aba** (o próprio
  arquivo, via data URL).
- **Evolução para nuvem:** caso uma versão futura passe a ter backend, os uploads
  poderiam migrar para **AWS S3** ou **Google Cloud Storage** (guardando apenas a
  URL do objeto no registro), com política de backup do bucket. Hoje isso não é
  necessário — não há servidor.

## Estrutura

```
src/
  data/        # dados reais embutidos (áreas, cargos, colaboradores, POPs, etc.)
  lib/         # store (localStorage), sessão, RBAC, domínio, formatação
  components/  # UI kit, layout, gráficos, formulários
  pages/       # uma página por módulo
```
