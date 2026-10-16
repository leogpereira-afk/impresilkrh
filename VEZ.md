# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T09:31:57.643Z
ramo: endomarketing
tarefa: Endomarketing: lista lateral, anexos e centralização das celebrações
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T10:09:37.269Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main ce2fdfe, Deploy 38881180755 verde consultado via gh; cache v10, código anterior 93a3dce. Functions registradas na passagem anterior: sync96, admin-users71, backup-registros67, mubi-pagamentos89, rh-performance18, rh-programacao17; não republicadas nesta revisão.
ramos: endomarketing-lateral-anexos local 78e411b: 1 à frente e 0 atrás da main ce2fdfe antes desta passagem; não enviado. Publicar só após autorização. Ramos anteriores preservados.
feito: 78e411b: lista lateral, etapas compactas, anexos e centralização. Registro docs/2026-10-16-endomarketing-lateral.md.
pela_metade: Implementação concluída localmente. Envio do ramo e publicação pendentes: revisão automática bloqueou git push por falta de autorização desta revisão. Clone /tmp/rh-endomarketing-20261015; fixtures endo-preview não rastreadas não publicar.
decisoes: Nenhuma D nova; atende à reorganização pedida pelo dono preservando D-005 e permissões existentes.
perguntas_ao_dono: Autorizar envio e publicação da revisão 78e411b. Servidor sync antes da tela; sem migration.
nao_fazer: Não levar fixtures locais nem dados reais ao repo; não publicar tela antes de sync; anexo local sem nuvem permanece explicitamente marcado.
testes: npm run verificar: lint/typecheck, 141 arquivos e 2120 testes, 22 testes de vez, IDs sem desvios. Build e diff-check OK. Browser local CRUD, filtro, recarga de anexo, vínculo de data e mobile390 sem transbordar; nuvem validada só em harness.
dados: Nenhum dado real; nenhuma migration; testes fictícios apenas locais.