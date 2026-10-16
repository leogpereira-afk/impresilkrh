# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T18:15:39.026Z
ramo: rh-modernizacao-20261016
tarefa: Restaurar emojis coloridos da lateral
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T18:22:36.713Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 4a0b440; Deploy 38946240841 e Verificar 38946240838 success. sw.js v13 e index-CvoG70eX.js iguais ao build; emojis vistos na lateral produtiva. Functions nao alteradas nem reconsultadas.
ramos: rh-emojis-20261016 incorporado na main, 0 a frente e 0 atras antes da passagem; demais ramos preservados.
feito: 4a0b440 restaura emojis coloridos originais na lateral e favoritos, mantendo a modernizacao. Plano docs/planos/2026-10-16-emojis-lateral.md.
pela_metade: nenhuma pendencia deste ajuste; limites da entrega anterior permanecem.
decisoes: Pedido do dono para manter emojis coloridos na aba esquerda; nenhuma regra de negocio alterada.
perguntas_ao_dono: nenhuma nova; pendencias anteriores preservadas.
nao_fazer: Nao incluir fixtures locais de previa no repositorio. Nao confundir icones com permissoes de acesso.
testes: npm run verificar aprovado: 2130 testes, 22 protocolo, lint, TypeScript e IDs. Build aprovado; previa e producao com emojis conferidos.
dados: nenhum dado real, migration ou function alterado.