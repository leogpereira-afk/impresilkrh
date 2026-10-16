# Endomarketing no RH

## Entrega
Área na lateral e busca, com Agenda, Ações e bem-estar e Ideias e materiais. Meses em chips; calendário do cadastro, tempo de empresa, acolhimento e datas institucionais. Ações com título obrigatório e demais campos opcionais, responsável por ID, checklist, situação, conclusão, reabertura e histórico. Coleção privada ao ADMIN_RH, com fila e persistência existentes. Demais usuários mantêm o escopo de cadastro já autorizado.

14 modelos editoriais incluem acolhimento, reconhecimento específico, escuta com devolutiva, carga e prioridades, conexão entre áreas, aprendizagem, comunicação de mudanças, retorno ao trabalho, acessibilidade, benefícios, datas especiais e retorno mensal. Referências OMS e CIPD disponíveis na própria tela e no plano. Sugestões nunca viram registros automaticamente.

Auditoria de conteúdo: celebrações não mostram humor ou perfil comportamental; ingresso no ano é Boas-vindas, não primeiro aniversário. A agenda sinaliza datas ausentes e o tratamento de 29/02. Pendências antigas permanecem acessíveis em Todos os meses.

## Verificação local
- npm run verificar: lint, TypeScript, 140 arquivos e 2112 testes aprovados; 22 testes do protocolo; conferir:id aprovado.
- npm run build: aprovado.
- Testes novos: datas, aniversário/tempo de empresa, pessoas visíveis, afastamento/desligamento, autorização de leitura/escrita no handler sync, criação, edição, conclusão, reabertura, histórico, concorrência e persistência/fila.
- Chrome com cadastro fictício sem conexão ao servidor: criação por modelo, responsável, data, checklist, conclusão/reabertura, recarga e histórico.
- Mobile 390 × 844: sem transbordamento horizontal, cards em coluna e modal utilizável.

## Publicação e limites
Ordem obrigatória: sync via workflow do Painel, depois tela via Deploy do RH. Conferir corpo da function, arquivos públicos e navegação autenticada após publicar; os identificadores finais ficam na Passagem do VEZ.md.
Nenhuma migration, alteração de cadastro real ou mensagem enviada. Criação e edição em produção não são executadas pelo agente; essas operações foram verificadas com dados fictícios localmente. A área não calcula índices de satisfação ou saúde por inferência, nem promete anonimato de respostas.
