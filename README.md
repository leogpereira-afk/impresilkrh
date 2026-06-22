# RH Impresilk — Sistema de Gestão de Pessoas

Aplicação web para centralizar a gestão de Recursos Humanos da **Impresilk Comunicação Visual**
(empresa com 40+ anos de mercado, ~30 colaboradores, Montes Claros/MG). Substitui o controle
disperso em planilhas por uma plataforma única, segura e em conformidade com a **LGPD**.

Identidade visual executiva e sóbria (azul-marinho institucional + dourado), responsiva para
desktop e dispositivos móveis. Interface 100% em **português do Brasil**.

---

## Módulos

| Módulo | Descrição |
| --- | --- |
| **Painel (Dashboard)** | Indicadores de gestão: headcount, turnover, documentos a vencer, avaliações pendentes, férias, aniversariantes, risco de saída, distribuições por área/nível/enquadramento salarial e alertas. Visão personalizada por perfil. |
| **Colaboradores e Documentos** | Lista com busca e filtros, ficha completa com abas (Dados, Documentos, Férias, Histórico), cadastro de novos colaboradores, organograma navegável e dados sensíveis mascarados conforme LGPD. |
| **Carreira e Cargos** | Régua de senioridade (N1–N5), tabela salarial por cargo/área, posição do colaborador na carreira e **simulador de progressão**. |
| **Desempenho e Retenção** | Ciclos de avaliação, **matriz 9-Box** (desempenho × potencial), metas, PDI e feedbacks. |
| **Documentos Institucionais** | Código de Ética, POPs, treinamentos e SST. |
| **Registros de Acesso (LGPD)** | Trilha de auditoria de acessos a dados pessoais/sensíveis (somente RH). |
| **Configurações** | Status do quadro, ciclos de avaliação e visão da estrutura organizacional (somente RH). |
| **Viagens e Diárias** | Módulo preparado na arquitetura para uma próxima etapa (controle de diárias da equipe de campo). |

## Perfis de acesso (RBAC)

- **Administrador de RH** — acesso completo a todos os módulos e dados.
- **Gestor** — acesso restrito à sua equipe (hierarquia recursiva).
- **Colaborador** — autoatendimento: seus próprios dados, documentos, carreira e desempenho.

---

## Stack técnica

- **Next.js 14** (App Router, Server Components e Server Actions)
- **TypeScript** (strict)
- **Prisma ORM** + **SQLite** (arquivo local, sem dependências externas para o MVP/demo)
- **Tailwind CSS** com paleta de marca customizada
- **jose** (JWT HS256, cookie httpOnly) + **bcryptjs** para autenticação
- **Edge Middleware** para proteção de rotas
- **Recharts** (gráficos) e **lucide-react** (ícones)

## Como executar

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# (opcional) gere um AUTH_SECRET forte: openssl rand -base64 48

# 3. Criar o banco e popular com dados de demonstração
npm run setup

# 4. Iniciar em desenvolvimento
npm run dev
# acesse http://localhost:3000
```

### Scripts úteis

| Script | Ação |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:seed` | Popula o banco com dados de exemplo |
| `npm run db:reset` | Recria o banco do zero e popula novamente |

## Credenciais de demonstração

Todos os usuários de demonstração usam a senha: **`Impresilk@2026`**

| Perfil | E-mail |
| --- | --- |
| Administrador de RH | `rh@impresilk.com.br` |
| Gestor — Operações | `pedro.goncalves@impresilk.com.br` |
| Gestor — Montagem | `saulo.ferreira@impresilk.com.br` |
| Colaborador | `bruno.nascimento@impresilk.com.br` |

> A tela de login possui atalhos que preenchem automaticamente as credenciais de cada perfil
> para facilitar a avaliação do sistema.

---

## Conformidade com a LGPD

- Dados sensíveis (CPF, salário, endereço, dados familiares) são **mascarados** para perfis sem
  autorização.
- Todo acesso a dados sensíveis é **registrado** em uma trilha de auditoria (`AccessLog`),
  consultável pelo RH no módulo *Registros de Acesso*.
- A senha é armazenada com hash **bcrypt**; a sessão usa **JWT assinado** em cookie httpOnly.

## Dados de exemplo

A base de demonstração inclui os colaboradores reais do plano de carreira da Impresilk, com a
estrutura de cargos, níveis e faixas salariais extraídos dos documentos da empresa. Dados
auxiliares (CPF, telefone, endereço) são fictícios e gerados de forma determinística apenas
para fins de demonstração.
