# Feedback & Pesquisas — implementação e verificação local

## Entrega

Central em Pessoas com sete chips que substituem o conteúdo principal: Visão geral, Feedbacks, Clima, eNPS, Individuais, Entrevistas e Ações e histórico. Não publicada nesta etapa.

- Feedback reutiliza a coleção, a tela, a cadência e as permissões existentes. A rota `/feedback` e a aba antiga em Desempenho encaminham à central. A implementação concorrente de feedback em Desempenho foi removida; nenhum registro foi apagado. Acervo antigo de pesquisas continua consultável, com suas regras anteriores explicitadas.
- Feedback ganhou finalidades de reconhecimento, alinhamento, melhoria e desenvolvimento, perspectiva anotada pelo condutor e apoio necessário. Réplica do colaborador continua separada. Não altera advertências nem avaliações automaticamente.
- Clima geral tem nove dimensões; Pulso tem clareza, recursos e comunicação; eNPS tem coleta e índice separados. Ciclos anteriores combinados permanecem identificados como legado. Público escolhido explicitamente, validado pelo servidor antes da abertura; limite mínimo de cinco e intervalo de 30 dias entre aberturas do mesmo instrumento.
- Resultados coletivos só após encerramento e base mínima. Cada dimensão também exige cinco respostas. Não há nota individual, lista nominal de respondentes nem filtros por pessoa no resultado. Comparações exigem mesmo instrumento, versão e público convidado; as bases de respondentes são informadas e não se afirma causalidade.
- Quatorze modelos de entrevista: seleção, entrada, integração 7/30/60/90, rotina, liderança/comunicação, reconhecimento, permanência, carreira, pós-treinamento, mudança e saída. Treze podem ser usados como questionários individuais (seleção usa candidato). Finalidade, público, momento, acesso, duração e aplicação do resultado aparecem na biblioteca.
- Questionário individual é preparado pelo RH e respondido somente pelo titular. Rascunho não enviado fica oculto para outro RH. Notas do RH não aparecem ao respondente. Entrevista é anotação do condutor e só ADMIN_RH recebe seus dados. Roteiros ficam congelados na criação.
- Ações referenciam feedback, entrevista, individual, PDI, treinamento ou tarefa de integração. Pessoa é derivada da origem no servidor; responsável usa o cadastro canônico. Prazo, andamento, resultado obrigatório para concluir, revisão e histórico. Revisar conserva a conclusão original e encerra ou remarca a pendência.
- ID estável não depende de CPF novo. Projeção mínima sem CPF, aliases preservados, IDs bloqueados/ausentes/ambíguos sinalizados. Arquivados continuam no histórico; criação não aceita vínculo arquivado ou pendente. Seleção usa candidatos, sem criar colaborador.
- Versão otimista e locks evitam sobrescrita silenciosa. Reagendamento atualiza o mesmo registro. Criação e participação têm proteção contra duplicidade. Chips mantêm painéis visitados; anotações individuais resistem a atualização externa e usam a versão original para detectar conflito. Há avisos de saída sem salvar. Os novos instrumentos e ações não entram no cache ou fila offline geral; feedbacks existentes mantêm seu fluxo anterior.

## Verificações realizadas

- `npm ci`: concluído.
- `npm run verificar`: lint, TypeScript, 151 arquivos / 2.169 testes, 22 testes de protocolo e conferência de ID passaram.
- Banco PGlite com todas as cinco migrations novas desta frente, dados fictícios, testes de acesso direto, papel, identidade, bloqueio, arquivados, candidato, congelamento de roteiro, autoria, histórico, conflitos, reagendamento, resultado, revisão, público, confidencialidade, cadência e idempotência.
- Testes do servidor confirmam que `escuta`, `entrevistas` e `nps` usam a identidade autenticada, ignorando identidade forjada no corpo.
- Build de produção e `git diff --check` conferidos. Após o ajuste final de retenção de filtros de ações, testes direcionados e build repetidos.
- Prévia visual em 1280×900 e 390×844. Visão geral, Clima, eNPS, Individuais e Ações sem transbordamento horizontal. Conferidos abertura de indicador/agenda, biblioteca com 14 modelos, troca de chip preservando anotação, salvar/retomar e atualização preservando anotação individual.
- Prévia com adapters fictícios: demonstra interface e estados, não comprova publicação nem conexão produtiva. Persistência/segurança foram exercitadas separadamente no banco isolado.

## Dependências e limites

1. Publicação depende de autorização: aplicar as cinco migrations desta frente em ordem (132246, 140000, 150000, 151000, 152000 de 17/10), publicar `sync` pelo fluxo do Painel com `rh_ref` correto e depois a interface. Não publicar a interface antes do servidor. Fazer leitura de produção e conferir permissões com os perfis reais após implantação.
2. Nenhuma migration aplicada em produção, nenhuma pessoa real alterada e nenhuma pesquisa/convite real disparado.
3. Participação ocorre dentro da conta do RH. Não há disparo de e-mail/WhatsApp nem sincronização externa de calendário. É uma agenda interna de acompanhamento.
4. Não há exportação nominal nova de respostas. A central não amplia permissões de relatórios e anexos antigos. A linha do tempo inicial reúne entrevistas, individuais e ações; feedbacks e PDI mantêm seus históricos e referências nas áreas existentes.
5. Anotações não salvas ficam na memória da tela, com alerta antes de fechar; não é armazenamento offline garantido. Publicação não deve ser descrita como backup automático de rascunhos ainda não salvos.
6. A frequência de 30 dias e o mínimo de cinco são regras iniciais explícitas desta entrega, não índices universais de RH. Grupos menores permanecem sem resultado agregado.

## Referências consultadas

Perguntas próprias, linguagem neutra e uso de acompanhamento, sem diagnóstico ou classificação automática da pessoa.

- CIPD, integração: https://www.cipd.org/en/knowledge/guides/employee-induction/
- CIPD, voz dos colaboradores: https://www.cipd.org/uk/views-and-insights/thought-leadership/people-profession/employee-voice/
- CCL, feedback por situação/comportamento/impacto: https://www.ccl.org/categories/feedback-sbi/
- Qualtrics, eNPS: https://marketing-prod.qualtrics.com/articles/employee-experience/employee-net-promoter-score-enps-good-measure-engagement/
- Culture Amp, confidencialidade: https://support.cultureamp.com/en/articles/7048386-confidentiality-protections-in-reporting
