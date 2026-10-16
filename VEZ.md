# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T18:27:22.389Z
ramo: rh-emojis-20261016
tarefa: Explicitar tipo de feedback e retirar termos da lateral
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T18:34:49.870Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 98e9739, Deploy 38947836931 success; sw.js v14 servido e chunks Feedback e index iguais ao build local. Functions nao alteradas nem reconsultadas.
ramos: rh-feedback-tipo-20261016 incorporado na main, 0 a frente e 0 atras antes da passagem. Demais ramos preservados.
feito: Escolha visivel Positivo ou Corretivo no formulario de feedback; troca preserva texto; valores internos Reconhecimento e Ajuste preservados. Termos e confirmacoes removido somente da lateral. Plano docs/planos/2026-10-16-feedback-tipo.md.
pela_metade: Nenhuma pendencia deste ajuste. Nao houve migracao de termos para POPs, apenas retirada da lateral conforme pedido.
decisoes: Pedido do dono: escolha positivo/corretivo e retirada de Termos da lateral para uso no POPs.
perguntas_ao_dono: nenhuma nova; pendencias anteriores preservadas.
nao_fazer: Nao reclassificar feedbacks antigos automaticamente; nao apagar termos nem rota aceites. Nao publicar fixtures locais.
testes: npm run verificar aprovado: 2131 testes, 22 protocolo, lint, TypeScript e IDs; build aprovado. Teste de troca corretivo para positivo preserva roteiro e grava Reconhecimento. Arquivos produtivos conferidos por hash.
dados: Nenhum dado real, migration ou function alterado.