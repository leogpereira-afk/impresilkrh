# Auditoria de fluxos e modernização do RH — 16/10/2026

## Diagnóstico executivo

O RH já tem componentes consistentes, acesso por perfil, busca global, abas, detalhes recolhíveis e listas com filtros. A prioridade é tornar a próxima ação evidente e o resultado de salvar verificável. Diminuir fontes ou preencher a tela com mais cards não resolve esses problemas.

Revisão: código das rotas e componentes, imagens fornecidas pelo usuário, leitura do feedback e indicador de nuvem em produção; teste de edição local com registros exclusivamente fictícios. Não foram feitos lançamentos reais. A auditoria não equivale a um teste manual de cada formulário, exportação ou permissão em produção. Os pontos das demais telas abaixo são recomendações baseadas na estrutura do código, não falhas reproduzidas em todas as rotas.

## Correções preparadas nesta revisão

| Local | Evidência e impacto | Alteração |
|---|---|---|
| Feedback — `feedbackCadencia.ts`, `Feedback.tsx` | A cadência e a última conversa usavam `criadoEm`. Um roteiro antigo concluído hoje continuava vencido. Preparação e agendamento não apareciam como etiquetas na coluna de situação. | Data efetiva `ocorridoEm`, com fallback para legado. Etiquetas Preparada/Agendada sem declarar uma conversa pendente como realizada. Tipo do roteiro reaproveitado no registro e data futura impedida. |
| Desenvolvimento — `Desempenho.tsx` | Pessoas na matriz eram divs dentro de botão de consulta; não havia edição nem movimentação. Avaliações duplicadas eram escolhidas pela ordem de chegada. | Clique ou arraste abre ajuste explícito com motivo, histórico por ciclo e retorno à avaliação calculada. Não altera notas, cadastro de potencial nem elegibilidade. Avaliação mais recente prevalece. |
| SST — `SST.tsx` | Contadores de NRs olhavam vigentes; filtros olhavam também substituídas. Validade ausente entrava na subtração de “válidas”. Data de referência podia envelhecer com a aba aberta. “Salvar e avisar” não validava vencimento anterior à emissão. | Mesma base para contadores e filtros; validade ausente separada; relógio diário atualizado; validação nos dois caminhos. Histórico permanece consultável. Texto “apto” substituído por “registro”, pois um cadastro de certificado não comprova aptidão. |
| Salvamento | Exceções locais de gravação não tinham retorno específico nos formulários. | Feedback e edição de exames mantêm a janela aberta e mostram falha ao gravar. Não confundir salvamento local com confirmação da nuvem. |
| Lateral | Entrada Documentos e procedimentos, cuja remoção foi pedida. | Retirada apenas da navegação. Rota, arquivos e dados preservados. |

**Limite do diagnóstico de SST:** editar um exame isolado atualizou situação, fila e persistência local no teste. A falha geral relatada de atualização não foi reproduzida nessa operação. Exames antigos não foram apagados nem automaticamente substituídos: tipos e finalidades diferentes podem coexistir. Para encerrar uma suspeita de perda na nuvem, ainda é necessário reproduzir o registro afetado e conferir a resposta de sincronização durante a operação autorizada do usuário. A leitura de produção mostrou “Tudo sincronizado”, zero pendências, somente no instante da inspeção.

## Organização visual recomendada

- Uma barra de contexto por tela: título, período/ciclo, área e uma ação principal.
- Resumos compactos clicáveis, com filtro ativo visível e “Limpar filtro”. Estatísticas secundárias ficam em expansão.
- Lista de trabalho vem antes dos gráficos exploratórios. Cada linha responde quem, o quê, situação, prazo e próxima ação.
- Detalhe lateral ou modal para descrição, histórico e anexos. No celular, ocupa a largura disponível.
- Status operacionais sempre com texto: cinza pendente, azul em andamento, âmbar atenção, vermelho vencido/erro, verde concluído. Cor de categoria não deve se confundir com status.
- Área clicável confortável mesmo em uma linha compacta. Texto principal legível; evitar informações essenciais em 10–11px e cinza muito claro.
- Salvo localmente, enviando, sincronizado e falha são estados diferentes. A confirmação deve ficar perto da ação; preservar texto digitado em falhas.

## Inventário de revisão por tela

Referências abaixo correspondem a `src/pages/<arquivo>.tsx`, salvo indicação.

| Tela / referência | Manter | Melhoria proposta / motivo |
|---|---|---|
| Painel / Painel | Filtros, detalhes por indicador, comparativos de folha | Trocar a sequência extensa de resumos por três grupos: pessoas, pendências e financeiro. Priorizar uma fila “O que exige atenção hoje”. Gráficos secundários recolhidos. |
| Calendário / Calendario | Agenda ligada ao dia e tipos filtráveis | No celular, iniciar em agenda; a grade de sete colunas e textos de 10px dificultam a leitura. Mostrar quantidade no dia e títulos na lista. |
| Colaboradores / Colaboradores | Busca, exportação filtrada, resumo recolhível e escolha de colunas | Consolidar exportações em um menu. Fixar contexto dos filtros e preservar posição ao voltar da ficha. |
| Ficha / ColaboradorFicha | Informações segmentadas e acesso aos documentos | Resumo da pessoa com situação e pendências, navegação de seções e histórico por assunto. Auditar gravação das abas individualmente antes de ampliar edição rápida. |
| Desenvolvimento / Desempenho | Abas de avaliações, metas, PDI, feedbacks e pesquisas | Matriz precisa vir antes da média por setor para quem está na aba 9-Box. Explicações das nove células podem ficar recolhidas. Criar filtros por área/ciclo sem alterar o ciclo de referência silenciosamente. Ajuste de posição implementado nesta revisão. |
| Feedback / Feedback | Fluxo preparar → agendar → registrar e fila de espera | Separar visualmente fase da conversa de cadência. Mostrar “sem conversa registrada” junto da espera desde admissão; milhares de dias isolados parecem erro. Última conversa deve abrir o histórico. Correção de data e etiquetas implementada. |
| Treinamentos / Treinamento | Edição, turmas, histórico e prazos | Lista de treinamentos ativos antes dos dois gráficos de distribuição. Carga, prazo e situação na mesma linha; detalhes recolhidos. |
| Vagas / Vagas | Funil, banco de talentos e devolutivas | Agrupar ícones de candidato em ação principal e menu secundário; ícones pequenos com apenas title são difíceis de descobrir no toque. Não automatizar decisões sobre candidatos. |
| Freelancers / Freelancers | Contratos e filtros | Linha compacta com vigência, responsável e situação. Abrir documentos e histórico no detalhe, sem duplicar resumo em cada bloco. |
| Organograma / Organograma | Nós recolhíveis | Busca da pessoa com destaque e caminho hierárquico. Em telas pequenas, lista hierárquica como alternativa ao diagrama. |
| Ponto / Ponto | Separação de importação, ausências e advertências | Manter importação em expansão; mostrar competência e conferência como contexto fixo. Ranking de ausências exige contexto; não equiparar atestado a problema de desempenho. |
| Férias / Ferias | Agenda, saldos e histórico por aquisitivo | Consolidar alertas e lista, priorizando próximos prazos. Manter distinção entre saldo confirmado e histórico a conferir. |
| Integração / Integracao | Admissão, teste e desligamento separados; checklists | Etapas em chips curtos e próxima pendência por pessoa. Itens concluídos recolhidos. Evitar abrir vários checklists longos ao mesmo tempo. |
| SST / SST | Exames, NRs e programas separados | Resumo compacto, busca e pendências atuais na primeira vista; histórico identificado. Renovação explícita de exame precisa regra de substituição antes de automatizar. Correções de filtros nesta revisão. |
| Cargos / Cargos | Responsabilidades, faixas e quadro | Lista mestre à esquerda e detalhe à direita. “De onde vem esta tela” recolhido; manter edição administrativa identificada. |
| Carreira / Carreira | Tabela salarial e trilha | Tabela como visão principal; simulador sob demanda. Simulação não deve parecer alteração salarial efetiva. |
| Financeiro / Custos e FolhaVariavel | Competência, conferência e origem dos números | Uma barra de período, ações e exportações consistente. Manter salários cadastrados separados de pagamentos e de simulações. Nenhum cálculo foi alterado nesta revisão. |
| Endomarketing / Endomarketing | Agenda, lista lateral de ações e detalhe | Manter como destino central de celebrações e ações. Resumir metadados; mostrar responsável, data e situação antes de descrição. Anexos no detalhe da ação/data. |
| Comunicação / Comunicacao | Guias e instruções institucionais | Esclarecer que orienta como comunicar; link para organizar ações em Endomarketing. Evitar um segundo cadastro da mesma campanha. |
| Mensagens / Mensagens | Contatos, modelos e agendamentos | “Templates” pode virar “Modelos”. Distinguir registro manual “enviada” de entrega comprovada: o código contém ação descrita como simulação de disparo. É prioridade de conteúdo. |
| Guia de pessoas / Comportamental | Conteúdo de consulta | Índice por situação prática e busca. Texto longo recolhido, ações operacionais apontam para a tela correspondente. |
| Documentos / Documentos e Pops | Arquivos, consulta e links existentes | Removido o item da lateral conforme pedido; não apagar conteúdo. Reavaliar agrupamento documental em etapa própria. |
| Relatórios / Relatorios | Indicadores com origem, planilha e período | Agrupar em Pessoas, Financeiro e Desenvolvimento. Muitas análises seguidas aumentam rolagem; usar índice e comparação com contexto explícito. |
| Termos / Aceites | Confirmação e rastreabilidade | Lista de pendências primeiro, versões e histórico no detalhe. Não fazer aceite automático. |
| Configurações / PainelControle | Separação de acessos, cadastros, ciclos e backup | Subnavegação lateral para muitas abas; colocar operações de restauração em área claramente separada. Preservar prévia e confirmação. |
| Histórico / LGPD | Restrição e trilha | Filtro rápido por pessoa, período e tipo; mostrar o recorte exportado. Não misturar consentimento e log de acesso no mesmo indicador. |
| Meu perfil / MeuPerfil | Documentos, ganhos, férias e termos pessoais | Priorizar minhas pendências e próximos eventos; detalhes financeiros continuam por permissão. Não copiar o painel administrativo para o colaborador. |
| Legado / Performance, mural-vagas | Avisos de destino e consulta histórica | Manter redirecionamentos claros e não devolver funcionalidades antigas à navegação principal. |
| Casco / app-shell, tabs, form, toast, index.css | Busca global, grupos e menu móvel | Encurtar rótulos mantendo nome completo no destino; favoritos por usuário; feedback acessível de salvamento. Toast atual não tem região live, melhoria de acessibilidade pendente. |

## Priorização para avaliação

| Prioridade | Entrega | Benefício | Esforço | Risco |
|---|---|---|---|---|
| P1 — necessária | Datas e fases de feedback, edição da matriz, consistência SST | Alto: confiança no status | Médio | Médio: validar persistência e regra por ciclo |
| P1 — necessária | Reproduzir caso de SST que some após recarregar, se persistir | Alto: integridade | Depende do caso | Alto se houver intervenção em dados; diagnóstico somente leitura primeiro |
| P1 — necessária | Diferenciar envio real de marcação manual em Mensagens | Alto: não prometer entrega | Baixo no texto, maior na integração | Médio |
| P2 — recomendada | Painel com fila de prioridades e resumos agrupados | Alto: menos esforço diário | Médio | Baixo sem mudar cálculos |
| P2 — recomendada | Listas primeiro em Desenvolvimento/Treinamentos e detalhe sob demanda | Alto: operação mais rápida | Médio | Médio: preservar estado e filtros |
| P2 — recomendada | Padrão único de salvamento, erro, foco e confirmação acessível | Alto: retorno confiável | Médio | Médio: testar local e nuvem separadamente |
| P2 — recomendada | Agenda móvel e alvos de toque maiores | Alto no celular | Médio | Baixo |
| P3 — opcional | Favoritos, personalização da densidade e atalhos | Médio | Médio | Baixo |
| P3 — opcional | Unificar visual de relatórios, conteúdo e configurações | Médio | Médio/alto | Médio: fazer por ondas |

## Critérios para a próxima modernização

Primeiro validar uma tela de lista, uma de matriz e uma de formulário em desktop e celular. Depois aplicar componentes às demais. Medir tarefas: localizar uma pendência, atualizar e confirmar, voltar ao filtro anterior. Preservar todas as funções, dados, permissões e exportações. Evitar animação que atrase a operação; respeitar preferência por movimento reduzido.

## Verificação e limites

- Regressão do feedback: preparação antiga concluída hoje e conversa retroativa; data e ordenação corretas.
- Edição de exame: status imediato, fila local e reabertura da tela com datas mantidas.
- NRs: certificado substituído permanece no histórico, mas sai do filtro de pendências atuais.
- Matriz: ajuste, histórico e restauração sem alterar nota ou promoção; seleção da avaliação mais recente por ciclo.
- Navegador local: posição atualizada após salvar e recarregar, modal acessível em largura de 390px, sem transbordamento horizontal observado no cenário fictício.
- Produção: leitura do feedback e estado da nuvem; nenhuma edição real e nenhuma publicação desta revisão.
- Não afirmar validação ponta a ponta da nuvem, de todos os formulários nem conformidade integral de acessibilidade. A auditoria estrutural abrange as rotas; a validação interativa foi concentrada nos fluxos alterados.

Resultado dos comandos: `npm run verificar` passou com 143 arquivos / 2.127 testes e 22 testes do protocolo; lint, TypeScript e conferência de IDs aprovados. Depois do último ajuste de fechamento em erro no feedback: lint, 50 testes dos fluxos alterados e `npm run build` repetidos com sucesso. Navegador local confirmou preparar → agendar → registrar → Em dia, inclusive após recarregar.
