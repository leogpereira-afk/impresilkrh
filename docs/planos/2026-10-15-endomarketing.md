# Endomarketing: implementação aprovada

Objetivo: área compacta na lateral do RH para agenda de pessoas, ações e modelos de acolhimento, reconhecimento, escuta e bem-estar. Autorização no chat: publicar e ampliar as ações com pesquisa. Escopo: usuários existentes do RH; respeitar as permissões atuais.

Arquitetura: rota sob login, agenda derivada do cadastro visível e dos eventos institucionais; coleção endomarketing separada, privada ao ADMIN_RH, com store/fila/revisão existentes. Modelos são conteúdo estático, nunca registros reais automáticos. Nenhuma mensagem enviada ou dado de produção alterado pelo agente.

Tecnologia: React, TypeScript, Tailwind, Vitest, sync Supabase existente.

## Execução e verificação
- [x] Modelo puro: datas válidas, aniversário sem idade, vínculo por id do cadastro, tempo de empresa, acolhimento, prazo, histórico.
- [x] Coleção vazia e escopo servidor ADMIN_RH; testes de leitura/escrita e persistência.
- [x] Agenda, ações e ideias compactas, busca, filtros, detalhes recolhidos, acesso por menu/busca/configuração.
- [x] Modelos com objetivo, público, frequência, checklist e avaliação. Referências OMS e CIPD.
- [x] Testar criação, edição, conclusão/reabertura, datas, escopo, navegação, celular e recarga com dados fictícios.
- [ ] Rodar verificar/build, publicar sync antes da tela, conferir CI e arquivos servidos, verificar UI de produção somente em leitura.
- [ ] Registrar evidências e devolver a vez.

## Fontes e critérios
- OMS, Guidelines on mental health at work: https://www.who.int/publications/i/item/9789240053052
- OMS, Mental health at work: https://www.who.int/news-room/fact-sheets/detail/mental-health-at-work
- CIPD, Employee wellbeing: https://www.cipd.org/uk/knowledge/factsheets/well-being-factsheet/
- CIPD, Employee voice: https://www.cipd.org/uk/knowledge/factsheets/voice-factsheet/

Aplicação: participação voluntária, escuta seguida de retorno, reconhecimento específico e ações sobre condições de trabalho. Não coletar diagnósticos/saúde nos campos de campanha; encaminhar questões individuais por canal privado adequado. Não prometer anonimato ou resultados medidos sem base. Datas especiais aproveitam o calendário existente; o RH decide quais planejar.
