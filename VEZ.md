# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-12T18:37:49.260Z
ramo: f07-fila
tarefa: contrato de instalador: a regra de CPF não responde 422 na gravação que passa pela fila (F07)
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: claude
passou_em: 2026-10-12T19:02:39.973Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: origin/main 5587c23 (F07 na fila), Deploy e verificar verdes em 12/10/2026; function sync v89 publicada pelo functions.yml do painel (rh_ref f07-fila, rh_funcoes sync); site responde 200
ramos: protocolo, id-pessoa e f07-fila já estão na main (apagar com o aval do dono); gh-pages é o site: não juntar nem apagar; o resto como em docs/RAMOS.md (P-001)
feito: 12/10/2026: protocolo da vez (8433035), ID da pessoa (059ee99 a 5d11b43) e F07 na fila (f4ddb55 e 5587c23): a regra de CPF do contrato de instalador não responde mais 422 na gravação que vem da fila; o contrato é salvo sem o que a regra recusa, com aviso; CPF que não confere vai para cpfRecusado (mascarado) e não vira o ID; envio sem CPF não apaga o CPF válido de contrato nenhum; o lembrete do CPF recusado só sai com um CPF válido novo; tela de Freelancers com o selo CPF recusado
pela_metade: o dono ainda não usou o botão "Gravar o ID nas fichas antigas" (57 fichas e 2 contratos sem o campo); a parte do RH do F25 (o sync do RH recusar a gravação do ciclo do bônus manual) não foi feita; limite: o ID vem dos 6 primeiros dígitos do CPF e uma pessoa nova pode receber o ID de quem saiu
decisoes: D-001 a D-005 (D-004, o ID nasce com a ficha e não muda com o CPF, aplicada nesta vez, com notas); nenhuma decisão nova
perguntas_ao_dono: P-001 (apagar ramos), P-002 (regra do check Deploy na main), P-003 (trava do functions.yml do painel para o RH), P-004 (nome real antigo em comentário); usar o botão das fichas antigas quando quiser; aplicar o patch do painel-acesso
nao_fazer: não trocar nem sugerir troca das senhas do RH (D-002); não voltar ao actions/deploy-pages nem apagar o site do Pages; function do RH não sobe no push (só pelo functions.yml do painel com rh_funcoes e rh_ref); não trabalhar no clone ~/Projetos/impresilkrh (atrasado, pode ter trabalho de outra sessão) nem na Dre/rh do iCloud; não gravar idPessoa por script ou SQL: só pelo upsert e pelo botão do admin; o ID vem dos 6 primeiros dígitos do CPF, então dois CPFs com o mesmo começo dão o mesmo ID: o RH recusa o de outra pessoa viva, mas uma pessoa nova pode receber o ID de alguém que saiu (lápide)
testes: PATH=~/apps/node20/bin:$PATH npm run verificar && npm run build em 12/10/2026, no 5587c23: lint e typecheck ok, vitest 132 arquivos e 2008 testes passam, test:vez 22 de 22, conferir:id ok, build ok
dados: nenhuma migration; nenhum dado real tocado (só SELECT de contagem)