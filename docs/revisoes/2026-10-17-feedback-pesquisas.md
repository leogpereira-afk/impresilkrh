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

## Ajuste visual solicitado após a prévia

Emojis decorativos nos sete chips e nas categorias de entrevista; títulos continuam acessíveis por texto. Rosto transparente do Silk reutilizado do ativo já existente do Painel, sem recorte adicional, recoloração ou círculo. Cabeçalho responsivo com 64 px no celular e 96 px no desktop. Ajuste somente local, sem alteração de dados ou permissões.

Verificação deste ajuste: `npm run verificar` aprovado (2.169 testes, protocolo e IDs), `npm run build` aprovado e conferência visual em 390 e 1280 pixels. Navegação das entrevistas conferida com os emojis decorativos.

## Publicação autorizada em 17/10/2026

O dono autorizou “subir” após conferir a prévia com Silk e emojis. Migrações aplicadas via MCP em ordem: nps_confidencial (20261017154435), entrevistas_rh (20261017154439), modelos_escuta (20261017154444), central_escuta (20261017154448), pesquisas_separadas (20261017154457). As versões são as atribuídas pelo ambiente remoto; o SQL corresponde aos cinco arquivos desta frente. Não reaplicar os arquivos só pela diferença de timestamp.

Conferência no banco produtivo: sete tabelas com RLS e sem SELECT para anon/authenticated; seis funções sem EXECUTE para esses papéis. Funções de operação restritas ao servidor e com validação do perfil ativo. Os avisos de RLS sem políticas nestas tabelas são esperados: acesso direto intencionalmente fechado. Quatorze modelos presentes, nenhum ciclo, entrevista, resposta individual ou ação criado pela publicação. Leitura administrativa das três operações retornou ok. Uma chamada sem sessão à sync foi recusada com HTTP 401. Nenhum registro existente de colaborador foi alterado.

Verificações frescas antes da publicação: 2.169 testes em 151 arquivos, 22 testes do protocolo, lint, TypeScript, IDs e build aprovados. Workflow de servidor: painel-impresilk/actions/runs/39046536332, rh_ref=rh-nps-20261017, rh_funcoes=sync.

Servidor publicado: workflow 39046536332 concluído com sucesso. `sync` v98 ACTIVE; corpo index.ts no ar idêntico ao arquivo do ramo (84.197 caracteres). Outras funções do RH permaneceram nas versões admin-users 71, backup-registros 67, mubi-pagamentos 89, rh-performance 18 e rh-programacao 17.
