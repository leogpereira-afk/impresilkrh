# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-24T22:52:30.485Z
ramo: codex/calendario-privado-rh
tarefa: Restringir notificacoes ao perfil RH
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-24T23:00:12.222Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 703f9e2, cache rh-v20; Deploy 40140569257 e Verificar 40140569444 aprovados. Index, SW e bundle publicados iguais ao build local; sessão RH recarregada com sino disponível. Functions inalteradas nesta vez, sync v102 na passagem anterior.
ramos: codex/notificacoes-privadas-rh integrado na main; cópia /tmp/rh-calendario-acesso-20261024.
feito: Alertas e sino exclusivos de ADMIN_RH, incluindo cache antigo e troca de sessão; docs/planos/2026-10-24-notificacoes-privadas.md.
pela_metade: nenhuma implementação pendente; Comercial testado com perfis fictícios, sem login comercial real.
decisoes: D-016, complementa D-015 para notificações.
perguntas_ao_dono: nenhuma.
nao_fazer: Não revogar documentos próprios e permissões de ficha para ocultar alertas derivados; não usar dados reais nos testes.
testes: npm run verificar aprovado, 2300 testes; build aprovado; 3 regressões de notificações; comparação pública de 3 arquivos e leitura visual do RH.
dados: Nenhum registro real alterado; nenhuma migration ou function alterada.