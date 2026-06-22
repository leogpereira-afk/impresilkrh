# Impresilk RH — Sistema de Gestão de Pessoas

Sistema de RH da **Impresilk Comunicação Visual** (Montes Claros/MG · 40+ anos).
Versão **leve, rápida e sem banco de dados**: roda 100% no navegador como site
estático. Todos os dados ficam embutidos no código e podem ser editados pelo
**Painel de Controle**, sendo salvos no `localStorage` do navegador (com
exportação/importação em JSON para backup e transferência).

> Sem servidor de banco, sem cold start, sem custo de hospedagem dinâmica.
> Faz deploy em qualquer host estático (Netlify, Vercel, GitHub Pages…).

## Tecnologias

- **Vite 5** + **React 18** + **TypeScript**
- **Tailwind CSS 3** (identidade visual: azul-marinho `#16334f` + dourado `#c2a14d`)
- **React Router 6** (navegação SPA)
- **Recharts** (gráficos) · **lucide-react** (ícones)

## Como rodar localmente

```bash
npm install      # instala as dependências
npm run dev      # ambiente de desenvolvimento (http://localhost:5173)
npm run build    # gera a versão de produção em /dist
npm run preview  # serve a versão de produção localmente
```

## Acesso (demonstração)

Na tela de login, escolha um perfil. A senha de demonstração é exibida na
própria tela:

```
Impresilk@2026
```

| Perfil               | Vê                                                            |
|----------------------|--------------------------------------------------------------|
| **RH (Administrador)** | Tudo: todos os colaboradores, salários, painel de controle |
| **Gestor**           | Apenas a própria equipe (e a árvore abaixo dele)             |
| **Colaborador**      | Apenas a própria ficha, carreira, comunicação e POPs         |

Salários individuais são ocultos para quem não é RH nem o próprio colaborador
(conforme LGPD). As **faixas salariais por cargo** (tabela de carreira) são
visíveis a todos como transparência — sem expor o salário de cada pessoa.

## Módulos

- **Painel (Dashboard)** — headcount, gráficos por área/nível, enquadramento salarial.
- **Colaboradores** — lista com busca e filtros + ficha individual.
- **Organograma** — estrutura hierárquica (Fundadores → Diretor → Assessorias →
  Gerências → Equipes), com painel para redefinir quem se reporta a quem.
- **Carreira e Salários** — régua N1–N5, tabela de faixas por cargo e simulador de progressão.
- **Desempenho e Retenção** — matriz 9-box (potencial × risco de saída).
- **Comunicação** — princípios, canais, SLAs e os guias/planos completos.
- **POPs e Procedimentos** — procedimentos operacionais padrão (passo a passo).
- **Documentos** — Código de Ética, POPs, Comunicação e SST.
- **Painel de Controle** (só RH) — editar conteúdo, colaboradores, faixas e
  fazer backup/restauração dos dados.

## Onde ficam os dados

- A base inicial está em [`src/data/seed.ts`](src/data/seed.ts) (áreas, cargos,
  faixas, colaboradores, documentos).
- Edições feitas no **Painel de Controle** são salvas no `localStorage` do
  navegador (chave `impresilk_rh_v2`) e **sobrescrevem** a base inicial naquele
  navegador.
- Use **Exportar dados (.json)** para backup ou para levar os dados a outro
  navegador/computador, e **Importar dados** para restaurar. **Restaurar padrão**
  volta à base do `seed.ts`.

## Deploy no Netlify

O repositório já inclui `netlify.toml` e `public/_redirects` com a configuração
de SPA (todas as rotas caem no `index.html`).

**Opção A — conectar o repositório (recomendado):**
1. No Netlify: *Add new site → Import an existing project* e selecione este repositório.
2. Build command: `npm run build` · Publish directory: `dist` (já definidos no `netlify.toml`).
3. *Deploy*.

**Opção B — upload manual:** rode `npm run build` e arraste a pasta `dist/`
para o Netlify (*Deploys → Drag and drop*).

> Como não há banco de dados, não é preciso configurar variáveis de ambiente
> nem connection strings.
