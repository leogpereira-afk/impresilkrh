# Modernização do RH — execução autorizada

Autorização: “Aplicar a modernização da auditoria e publicar tudo”. Implementação sobre as correções do ramo rh-fluxos-auditoria-20261016; publicação da interface, sem alteração de servidor ou dados reais.

## Entregas

- Componentes comuns: abas em faixa com rolagem, alvos de toque maiores, avisos acessíveis por leitor de tela, densidade ajustável sem reduzir fonte e ícones consistentes.
- Navegação: favoritos locais respeitando permissões e opção de densidade no menu Mais opções. Documentos e procedimentos fora da lateral; rota e arquivos mantidos.
- Painel: resumos por pessoas e pendências, fila operacional antes das análises e gráficos secundários recolhidos com preferência persistida.
- Desenvolvimento: matriz antes da média por setor, ciclo e área explícitos, orientações recolhidas. Correções de edição, histórico e restauração incluídas.
- Feedback: data efetiva da conversa e fase de preparação/agendamento; espera desde admissão identificada quando não há conversa registrada.
- SST: busca por pessoa/exame, recorte visível, limpar filtros; correções de validade, NRs substituídas e validação de datas incluídas.
- Calendário: agenda primeiro no celular, grade opcional; filtros e navegação mensal preservados.
- Treinamentos: operação antes dos gráficos, análises recolhíveis.
- Cargos: lista mestre e detalhe com edição existente; Carreira: tabela antes do simulador recolhido e identificado como simulação.
- Colaboradores: exportações agrupadas; busca, áreas, inclusão de inativos e posição da lista lembradas na sessão por usuário.
- Vagas: currículo identificado e ações secundárias com texto. Nenhuma decisão de contratação automatizada.
- Organograma: busca, gestor e área nos resultados; abrir caminho até a pessoa e foco visível. A árvore já era uma lista hierárquica responsiva.
- Integração: próxima etapa no cabeçalho; jornadas concluídas recolhidas inicialmente, sem apagar checklists.
- Ponto: importação em expansão; prévia e confirmação preservadas.
- Relatórios: grupos Pessoas, Financeiro e Desenvolvimento, mantendo período, detalhes e exportações.
- Configurações: seletor de seção em vez de múltiplas linhas de abas; controles de backup e confirmação mantidos.
- Mensagens: Modelos no lugar de Templates; simulação explicitamente rotulada e confirmada, sem alegar entrega.
- Termos: pendentes antes dos aceites; Guia de pessoas: índice por assunto.

## Preservado e dependências

Férias já tem próximos movimentos, lista por pessoa, pendências e histórico. Endomarketing já centraliza agenda, ações, arquivos e lista lateral; Comunicação já aponta para ele. Ficha, freelancers, financeiro, Meu perfil, histórico de acessos e rotas legadas mantêm fluxos e passam a usar os componentes comuns modernizados. Não foram recriados módulos que já atendiam ao padrão.

A recomendação de renovação automática de exame continua condicionada a uma regra explícita de substituição; exames com finalidades diferentes não são apagados. A suspeita de falha geral de SST na nuvem não foi reproduzida. A revisão não autoriza lançamentos médicos ou correções de cadastro em produção pelo agente. O comportamento local e a fila são testados; confirmação ponta a ponta de uma alteração real depende da operação do usuário.

## Verificação

Registrar resultados finais e verificação de publicação no relatório de entrega. Testes utilizam apenas registros fictícios. Fixtures de prévia, imagens e dados de navegação não fazem parte do repositório público.

Validação local final: `npm run verificar` aprovado (143 arquivos, 2.130 testes, 22 testes do protocolo, lint, TypeScript e 7 conferências de IDs). `npm run build` aprovado. Navegador local com registros fictícios: favoritos após recarregar, densidade, filtros de ciclo, relatórios por grupo, agenda móvel e grade opcional, modal da matriz a 390 px, ausência de transbordamento horizontal nos cenários conferidos e temas claro/escuro. O salvamento de SST e matriz também foi verificado com store e fila locais. Nenhum dado real foi alterado.
