# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-17T13:21:02.506Z
ramo: main
tarefa: NPS confidencial em Pessoas com pesquisas estruturadas
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-17T13:32:17.968Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main b842e40, Deploy 39036208470 success; tela anterior preservada (cache v14); functions nao alteradas nem reconsultadas.
ramos: rh-nps-20261017 local em /tmp/rh-nps-20261017, commit a015242, 1 a frente e 0 atras antes desta passagem; aguarda autorizacao para publicar. Demais ramos preservados.
feito: NPS confidencial em Pessoas, questionario v1 com onze itens, coleta transacional, agregados protegidos e devolutivas. Registro docs/planos/2026-10-17-nps.md no ramo local.
pela_metade: Publicacao pendente: migration 20261017132246_nps_confidencial.sql, function sync e tela (cache v15). Previa local porta 5395 com dados ficticios.
decisoes: D-008 no ramo local: respostas confidenciais com resultados agrupados, conforme escolha do dono.
perguntas_ao_dono: Autorizar publicacao da migration, sync e tela; nenhuma pesquisa real sera aberta automaticamente.
nao_fazer: Nao colocar respostas em registros, fila offline ou backups genericos; nao expor totais durante a coleta, recortes pequenos ou notas individuais; nao publicar a pasta .review.
testes: npm run verificar passou com 2142 testes, 22 de protocolo, lint, TypeScript e IDs; build passou; SQL executado em PGlite; UI revisada; conferir origin/main..HEAD passou.
dados: Nenhum dado real alterado. Migration somente local, nenhuma function publicada.