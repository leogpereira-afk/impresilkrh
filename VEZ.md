# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T17:07:24.988Z
ramo: rh-fluxos-auditoria-20261016
tarefa: Modernizar RH conforme auditoria e publicar correcoes
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T17:26:40.502Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main cd612c05aca792cd16b2445e007c60d507d0add6, Deploy 38939185757 e Verificar 38939185554 success; Pages 38939493083 success. CACHE v12 servido; chunks Feedback, Desempenho, SST, Painel, Calendario e tabs iguais ao build local. Functions nao alteradas nem reconsultadas (sync 97 apenas segundo passagem anterior).
ramos: rh-modernizacao-20261016 incorporado na main (0 a frente e 0 atras antes da passagem). rh-fluxos-auditoria-20261016 antigo superado pela versao rebaseada baf4074; nao juntar novamente. Demais ramos preservados; docs/RAMOS.md atualizado.
feito: baf4074 correcoes de feedback, matriz, SST e lateral; cd612c0 modernizacao autorizada. Inventario e limites em docs/planos/2026-10-16-modernizacao-execucao.md. Producao navegada em feedback, desenvolvimento e SST, com dados carregados e Tudo sincronizado; nenhuma escrita real.
pela_metade: Nenhuma implementacao desta entrega pendente. Falha geral de persistencia SST na nuvem nao foi reproduzida; sem alegar teste de escrita real ponta a ponta. Substituicao automatica de exames depende de regra explicita.
decisoes: D-007: aplicar modernizacao da auditoria e publicar as correcoes, autorizado pelo dono.
perguntas_ao_dono: Se SST continuar falhando, identificar campo e momento em que a alteracao desaparece. Pendencias anteriores do documento de decisoes preservadas.
nao_fazer: Nao publicar fixtures endo-preview e rh-fluxos-preview. Nao inferir aptidao nem apagar exames por renovacao. Nao alterar notas ou promocao ao calibrar matriz. Nao afirmar envio real em Mensagens: funcionalidade de simulacao.
testes: npm run verificar: 143 arquivos e 2130 testes, 22 de protocolo, lint, TypeScript e IDs aprovados; build aprovado; conferencia da vez aprovada. UI ficticia local e mobile 390px, temas claro/escuro, favoritos, densidade, filtros e agenda conferidos; producao somente leitura.
dados: Nenhuma migration, function ou dado real alterado; apenas interface e preferencias visuais. Fixtures ficticias locais excluidas dos commits.