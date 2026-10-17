# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-17T15:43:42.799Z
ramo: rh-nps-20261017
tarefa: Publicar Feedback e Pesquisas autorizado pelo dono
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-17T15:56:57.749Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 4eae3f7, Deploy 39046733074 verde; arquivo servido CACHE rh-v15 e Nps-Bkg3FVlw.js conferidos; sync v98 corpo comparado, admin-users v71, backup-registros v67, mubi-pagamentos v89, rh-performance v18, rh-programacao v17 via MCP.
ramos: rh-nps-20261017 local 09ec15a, 1 a frente e 0 atras da main antes desta passagem: cabecalho do painel pronto para revisao, dono decide publicar; remoto rh-nps-20261017 f476d046 ja incluido na main.
feito: Central Feedback e Pesquisas publicada e conferida em sessao autorizada; cabecalho de entrada com Silk em previa local; docs/revisoes/2026-10-17-feedback-pesquisas.md.
pela_metade: Publicacao do novo cabecalho em src/pages/Painel.tsx e src/components/ui/silk-header.tsx pendente; central ja publicada.
decisoes: D-011 registrada, autorizacao de publicacao da central e schema.
perguntas_ao_dono: Publicar o novo cabecalho da entrada apos a previa; nenhum impedimento para uso da central.
nao_fazer: Nao reaplicar migrations pelo timestamp local: servidor registrou horarios diferentes; nao editar IDs de historicos automaticamente; nao inserir dados reais no repositorio.
testes: npm run verificar aprovado: 2169 testes em 151 arquivos, protocolo 22 testes, lint, tipos e IDs; npm run build aprovado; desktop e celular conferidos; sete abas publicadas e /feedback redirecionando sem alerta; anonimo sync 401.
dados: Cinco migrations de NPS, entrevistas, modelos, central e separacao aplicadas; biblioteca estatica de modelos criada; nenhum registro real de pessoa, resposta, entrevista ou acao alterado.