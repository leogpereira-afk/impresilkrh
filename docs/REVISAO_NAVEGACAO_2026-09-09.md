# Revisão de navegação e informação — 09/09/2026

Implementação sobre `30eae72`, a partir da passagem pelos títulos, descrições, páginas e abas do RH. Esta entrega trata da experiência de uso; a auditoria financeira de 2026 e seus dados não foram refeitos por esta rodada visual.

## Mudanças

- Menu e títulos alinhados: Financeiro do RH, Ponto/ausências/advertências, Admissão e desligamento, Configurações do RH, Relatórios do RH e nomes das demais páginas. Ficha e Meu perfil passam a identificar seu contexto. A entrada tem título principal visível no celular.
- Busca expande as páginas permitidas em destinos de abas. Financeiro abre a visão geral; sincronização, viagens, relatórios financeiros e ponto chegam diretamente à função. Contratos de freelancer e freelancers no quadro são destinos distintos. A busca respeita módulos liberados e a restrição de pagamentos societários.
- Abas têm identificação acessível, associação ao conteúdo e navegação por setas, Home e End. Links diretos prevalecem sobre a aba lembrada; as trocas mantêm os demais parâmetros da URL.
- Cabeçalho móvel oferece menu de opções com perfil, impressão, tema e saída. Nomes longos não alargam o cabeçalho. Colaboradores recebe cartões no celular, com ordenação, situação e informações da visão selecionada.
- Financeiro começa na visão geral. A importação apresenta situação/cobertura antes das ações e do detalhe; a cobertura mensal fica recolhida e pode incluir meses vazios. Os períodos de cada bloco permanecem explícitos. Tabelas rolam no próprio bloco e os controles de consulta quebram linha em celulares estreitos.
- Avaliação/potencial ausentes não colocam a pessoa no meio da matriz. A cobertura e as pessoas sem classificação ficam visíveis. Risco não preenchido aparece separado, sem virar baixo. Nenhum treinamento ou lançamento conferível não produz mensagem de regularidade.
- Relatórios identificam salário cadastral atual e salário médio; risco sem informação aparece na distribuição por área. Pagamentos, reservas estimadas e salários do cadastro mantêm suas bases distintas.
- Painel destaca pendências e recolhe o detalhamento financeiro secundário. Salvamento na nuvem fica distinto da importação financeira; os textos de backup e contratos de freelancer acompanham o funcionamento atual.
- Abrir Admissão não cria documentos. A preparação padrão passa por prévia, inicialmente desmarcada, com seleção por pessoa. Documentos existentes e o marcador de preparação anterior impedem recriações indevidas. A operação segue o armazenamento e sincronização normais da aplicação.

## Validação

- `npm run verificar`: lint, tipos, **1.480 testes em 100 arquivos** e conferência de identificação aprovados.
- Build de produção concluído; revisão do diff sem erros de espaço.
- Regras puras verificadas para ausência de avaliação/risco e preparação de documentos; componentes testam destinos/teclado, conferência anual e cobertura vazia.
- Navegação final: **244 capturas** — 202 estados de rotas/abas/perfis em 1440 e 390 px, 40 estados financeiros em 320, 390, 768, 1024 e 1440 px, mais duas entradas. Nenhum erro JavaScript ou transbordamento do documento foi encontrado nesses estados. Tabelas largas preservam rolagem interna.
- No navegador isolado, foi lido o IndexedDB efetivo: a visita mantém as duas tarefas existentes; selecionar apenas uma das duas pessoas cria sete documentos para ela e nenhum para a outra. Cliques reais de busca, matriz sem avaliação e opções do celular foram conferidos.

As chamadas externas dos ensaios foram interceptadas; pessoas e pagamentos eram fictícios. Não foram alterados registros de produção. A revisão não certifica todos os estados possíveis, acessibilidade integral, cálculos trabalhistas ou completude do banco.

## Continuidade

Os achados funcionais anteriores sobre turnover, férias e cobertura de dados/permissões permanecem na auditoria própria: mudar os textos não resolve essas regras. Outras melhorias sugeridas por página, como novos resumos de acompanhamento e aprofundamento dos gráficos, continuam como evolução do produto; esta entrega conclui os ajustes de navegação, informação e apresentação descritos acima.
