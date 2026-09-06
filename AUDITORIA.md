# RH — auditoria de 6 de setembro de 2026

Primeira etapa: acesso, integridade, recuperação e componentes visuais compartilhados.
A revisão funcional detalhada das páginas continua. Este documento não certifica 100% do sistema nem regras trabalhistas.

## Achados corrigidos nesta etapa

| Prioridade | Problema confirmado | Tratamento |
|---|---|---|
| Crítica | A versão pública incluía cadastros e movimentos financeiros no código inicial. | Cadastros, usuários e lançamentos iniciais vazios; dados passam a vir da sessão autenticada. As cópias anteriores permanecem privadas. |
| Crítica | Exclusões não conferiam o escopo do registro; a troca do dono permitia tentar tomar um registro; anexos não conferiam a pessoa vinculada. | Autorização do conteúdo atual e do novo, hierarquia dos gestores, acesso pessoal aos documentos e proteção do histórico. |
| Alta | Consultas ao relógio renovavam sessões inativas; um clique tardio podia reabrir a sessão. | Prazo de inatividade efetivo; saída interrompe as chamadas; sem entrada por senha local. |
| Alta | Cache, anexos e fila se misturavam entre contas. | Separação por usuário e perfil; respostas antigas descartadas. Cópia conferida do cache legado antes de liberar espaço. |
| Alta | Uma confirmação antiga podia apagar uma edição nova da fila. | Identificação de cada envio, revisão da base e confirmação específica. |
| Alta | O banco fazia leitura e escrita separadas para conflitos e revisões. | Conferência da versão dentro de transação; reenvio idempotente; revisões geradas pelo banco. |
| Alta | Restaurar apagava a coleção antes de terminar o envio. | Retrato aplicado em transação após conferir a revisão; cópia anterior preservada; ausentes arquivados; coleções omitidas preservadas. |
| Alta | Falha no meio da importação ou falta de espaço podia deixar uma base parcial. | Validação prévia, recusa de outro sistema/IDs duplicados e reversão local em caso de erro. |
| Média | Mesma quantidade de linhas era apresentada como “nada muda”. | Comparação de identificadores e conteúdo: entradas, saídas e registros alterados. |
| Média | Resumo podia parar no limite do banco; cada página fazia uma contagem completa. | Resumo paginado, cursor validado e retirada da contagem repetida. |
| Média | Sincronização podia anunciar sucesso com leitura recusada. | Estado de erro preservado e confirmação apenas quando não restam falhas ou pendências. |
| Média | Nove combinações de tela ultrapassavam a largura do celular. | Cards com largura flexível, ações distribuídas e títulos que quebram linha. |
| Visual | Menu compacto, pouco contraste nos grupos e links escondidos ao retornar. | Menu claro, emojis, fonte maior, títulos azuis, grupos abertos ao entrar e opção de recolher. |

## Evidências

- Antes: 653 testes existentes passaram. Novos casos reproduziram falhas de autorização, sessão, fila e restauração antes das correções.
- Primeira navegação: 96 combinações de rota, perfil e largura; nove estouros de largura, sem erro de execução.
- Segunda navegação: as mesmas 96 combinações, sem estouro de largura ou erro de execução. Dados fictícios e todas as chamadas externas interceptadas.
- Banco testado em PostgreSQL isolado: conflito de edição, repetição de envio, preservação ao arquivar, restauração, falha intermediária, revisão e privilégios.
- Cópia de dados do GitHub: 5.652 registros, conferidos em PostgreSQL local. Assinatura lógica idêntica à base: `c89f48df91d8c3e32f867a8b80dab387`.
- O SHA-256 da cópia local é `95ae4300e5bd1afef4e289a2590186225c819e72fed264f3a811f0410fbcdc12`.
- O arquivo de dados não contém anexos. Os três objetos do bucket privado foram conferidos apenas por metadados nesta etapa; a restauração dos binários ainda precisa ser testada.

## Continuação da auditoria

1. Conferir operações de cada página com dados fictícios: cadastro, ponto, custos, folha variável, férias, desempenho, integração, documentos, recrutamento e demais rotas.
2. Conferir vínculos e regras dos indicadores com a origem, sem inventar ou corrigir dados de pessoas por suposição.
3. Completar recuperação de anexos e revisão das configurações concorrentes.
4. Revisar a atomicidade do cache offline entre abas e falhas abruptas do navegador. A transação do servidor não equivale a uma transação de todo o armazenamento local.
5. Conferir os acessos por módulo e dependências externas, além dos perfis de RH, gestor e colaborador.

Nenhum funcionário real foi criado, excluído, associado a uma conta ou teve a senha alterada durante os testes. Não foram enviadas mensagens a pessoas.

## Publicação

Atualização do banco autorizada e aplicada em 06/09/2026: `rh_integridade_e_recuperacao_20260906`. Função `sync` publicada na versão 65. Publicação da interface em andamento.

Conferência desta publicação:
- 701 testes em 51 arquivos aprovados; lint, tipos, build e diferenças conferidos.
- 96 combinações de rota, perfil e largura conferidas novamente: nenhum erro de execução ou transbordamento horizontal, com dados fictícios.
- Base antes/depois: 5.652 registros, 5.063 ativos, 41 coleções. Assinatura de conteúdo preservada: `ad40e243134fe67280debfb4db94c4c2`.
- Cópia privada no próprio banco: `rh_recuperacoes`, identificação 1, com os mesmos 5.652 registros e a mesma assinatura. Acesso direto de visitantes e usuários comuns negado.
- As funções de gravação e recuperação permitem execução somente pelo serviço autorizado; quatro gatilhos de integridade instalados.
- Corrigidos dois impedimentos da geração final: acesso ao último item compatível com ES2020 e nome de campo de documento no teste.

Esta publicação conclui a primeira etapa preparada. A revisão detalhada por página, a recuperação dos binários dos anexos e os demais itens listados acima continuam como etapas posteriores.
