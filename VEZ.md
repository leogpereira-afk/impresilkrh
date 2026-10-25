# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: codex
desde: 2026-10-25T01:27:05.976Z
ramo: codex/rh-gravacao-local
tarefa: Corrigir aviso de gravacao local e validar exclusao em navegadores independentes
sessao: codex:47321f2f (rh-gravacao-local-20261024)
versao_reservada: rh-v24
arquivos_em_uso: src/lib/armazemLocal.ts src/lib/armazemDiario.ts src/lib/store.ts src/lib/sync.ts src/lib/*test.ts src/components docs public/sw.js package.json package-lock.json
passou_por: codex
passou_em: 2026-10-25T01:18:35.169Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: -
ramos: -
feito: -
pela_metade: -
decisoes: -
perguntas_ao_dono: -
nao_fazer: -
testes: -
dados: -