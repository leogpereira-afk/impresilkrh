# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-17T15:36:05.019Z
ramo: rh-nps-20261017
tarefa: Emojis e Silk na central Feedback & Pesquisas, apenas prévia
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-17T15:40:33.617Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main e ultimo Deploy verde 0cd1f862 (gh run list conferido); cache de producao v14 conforme passagem anterior; functions sync, admin-users, backup-registros, mubi-pagamentos, rh-performance e rh-programacao nao alteradas nem reconsultadas nesta vez.
ramos: rh-nps-20261017 local 4 commits a frente, 0 atras da main antes da devolucao; aguarda autorizacao de publicacao.
feito: Silk transparente e emojis na central, commit local 144ab68; central anterior preservada. Registro docs/revisoes/2026-10-17-feedback-pesquisas.md.
pela_metade: Nenhum ajuste visual pendente. Central completa continua local; cinco migrations, sync e tela aguardam publicacao. Previa localhost 5395/.review/nps.html com dados ficticios.
decisoes: Nenhuma nova; preservar confidencialidade e IDs conforme decisoes anteriores.
perguntas_ao_dono: Aprovacao da previa e autorizacao especifica para publicar migrations, sync e tela.
nao_fazer: Nao publicar tela antes do servidor; nao misturar pesquisas coletivas e individuais nem cachear respostas privadas; nao recriar o mascote.
testes: npm run verificar aprovado: 2169 testes em 151 arquivos, 22 do protocolo, IDs sem falhas; build aprovado; visual 390 e 1280 pixels e navegacao dos chips conferidos; conferir origin/main..HEAD aprovado.
dados: Nenhum dado real tocado; nenhuma migration aplicada; somente dados ficticios na previa e testes.