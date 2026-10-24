# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-24T23:30:13.509Z
ramo: codex/rh-revogacao-tempo-real
tarefa: Auditar e melhorar campos da aba Dados na copia isolada
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-24T23:47:40.861Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 33d5319, ultimo Deploy verde 33d5319 consultado via gh; codigo da aplicacao e49e34a e cache impresilk-rh-v21 preservados. Functions inalteradas; sync v102 conforme passagem anterior, versoes das demais nao reconsultadas nesta tarefa.
ramos: codex/rh-dados-auditoria no clone /tmp/rh-calendario-acesso-20261024, commit local 05ed4ef, 1 a frente e 0 atras da main antes desta devolucao; aguarda autorizacao do dono para publicar. Demais ramos conforme docs/RAMOS.md.
feito: Auditoria e melhorias dos 39 editores da aba Dados; chips, campos complementares, validacao e protecao de cancelamento, conflitos e permissoes; docs/auditorias/2026-10-24-aba-dados.md no ramo local. Previa isolada na porta 5530.
pela_metade: Nenhuma correcao pendente dentro do escopo; publicacao da implementacao nao autorizada nem realizada. Sincronizacao entre contas reais nao exercitada.
decisoes: Nenhuma nova decisao; mantidas as permissoes existentes no servidor, com alinhamento e protecao da interface.
perguntas_ao_dono: Aprovacao da previa para publicar a aba Dados; nao misturar com outras frentes.
nao_fazer: Nao publicar o ramo automaticamente. Nao incluir os arquivos revisao-dados ou revisao-calendario nem usar fichas reais para testes. Rebase sobre a reserva vigente antes de eventual publicacao.
testes: npm run verificar aprovado, 2453 testes em 171 arquivos, mais 22 testes do protocolo e 7 IDs no padrao; build e diff-check aprovados; 39 editores abertos no Chrome, salvamento e recarga, cancelamento por teclado, CEP invalido e viewport 390 px conferidos.
dados: Nenhum dado real alterado; nenhuma migration ou function publicada. Apenas fixtures locais isoladas sem acesso ao banco produtivo.