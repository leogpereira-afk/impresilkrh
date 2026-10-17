# Central de pesquisas e entrevistas

Escopo autorizado: modernizar e organizar NPS em Pessoas; biblioteca por fase, pesquisas coletivas confidenciais e entrevistas individuais identificadas exclusivas do RH (D-009). Sem publicação nesta etapa.

- Manter eNPS e cálculo existente, mínimo de cinco e resultados somente após fechamento.
- Modelos originais de seleção, entrada, integração 30/60/90, acompanhamento, permanência, desenvolvimento, pós-treinamento e saída.
- Entrevistas reutilizam referências de colaboradores/candidatos. Banco separado do cache/exportação geral para notas restritas. RLS fechado, RPC somente service_role, identidade real obtida pela function sync; todos os verbos exigem ADMIN_RH.
- Agendar, salvar rascunho, reagendar no mesmo registro, concluir com síntese e combinados; histórico de revisões e controle concorrente. Texto livre opcional em cada pergunta. Não misturar notas individuais com eNPS.
- Interface por categorias com cor, biblioteca, agenda/histórico e clima. Dados anteriores preservados no acervo existente; acesso explícito.
- Testar SQL real em PGlite, papéis, vínculo, duplicidade, concorrência, conclusão e histórico; componente e mobile; verificar e build completos.

Fontes de apoio (perguntas redigidas para a Impresilk, sem reproduzir instrumentos proprietários):
- CIPD, Employee induction: https://www.cipd.org/en/knowledge/guides/employee-induction/
- CIPD, Employee voice: https://www.cipd.org/uk/views-and-insights/thought-leadership/people-profession/employee-voice/
- Gallup, Exit interview: https://www.gallup.com/workplace/236051/real-value-getting-exit-interview-right.aspx

## Verificação local concluída

- `npm run verificar`: 2.156 testes, 22 testes de protocolo, lint, TypeScript e conferência de IDs passaram. O teste do índice de busca identificou um apelido com acento; corrigido e suíte completa repetida com sucesso.
- `npm run build`: aprovado. `git diff --check`: aprovado.
- Banco executado em PGlite com dados fictícios: autorização RH, proibição de acesso direto, identidade autenticada na function, cadastro por coleção, idempotência, validações, concorrência e histórico.
- Interface testada: filtros e modelos, isolamento de gestor/colaborador, erro sem falso vazio, anotações conservadas em falha e conclusão com síntese. Prévia visual desktop e mobile (sem rolagem lateral), roteiro e salvamento simulado.
- Nenhum dado real usado, nenhuma alteração de banco/entrevista em produção. Prévia usa mocks locais, não prova operação produtiva.

## Para publicar após autorização específica

Publicar as migrations `20261017132246_nps_confidencial.sql` e `20261017140000_entrevistas_rh.sql`, publicar a function sync pelo fluxo autorizado e depois a interface. Verificar acesso e operações com sessão real. Sem enviar convites automaticamente. As entrevistas novas não entram na exportação/cache genérico de registros; dependem do backup do banco. O acervo anterior não foi migrado nem apagado. A agenda de entrevistas é desta central, sem criar eventos no calendário geral.
