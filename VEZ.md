# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: claude
desde: 2026-10-12T11:59:41.000Z
ramo: protocolo
tarefa: protocolo da vez no RH (liberado pelo dono em 12/10/2026: "pode fazer"); em seguida, o ID da pessoa na ficha (D-004, item 5 da fila do PCP de 11/10/2026)
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: -
passou_em: -

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: antes do protocolo, main 89cc983 = último Deploy verde (run 37082002619, 03/10/2026; gh run list -R leogpereira-afk/impresilkrh -w deploy.yml), Verificar verde no mesmo commit, public/sw.js CACHE impresilk-rh-v9; functions do RH no ar em 12/10/2026 (list_edge_functions): sync v87, admin-users v67, mubi-pagamentos v85, backup-registros v63, rh-performance v12, rh-programacao v11
ramos: protocolo (só local, à frente da main, 0 atrás: juntar com o pode publicar); gh-pages é o site; claude/lucid-clarke-pquyij e publicar superados; agenda-so-gente, claude/admiring-noether-ly12p1 e claude/funny-hypatia-d5uveb sem nada próprio; destino em docs/RAMOS.md (o dono decide o que apagar, P-001)
feito: o protocolo da vez copiado do PCP e adaptado (AGENTS.md = CLAUDE.md, VEZ.md, docs/DECISOES.md D-001 a D-005, docs/RAMOS.md, scripts/vez.cjs, tests/agentes.test.cjs, tests/vez-git.test.cjs, passo "Commits dentro da vez?" no deploy.yml e no verificar.yml), no ramo protocolo
pela_metade: o ID da pessoa nasce com a ficha e não muda com o CPF corrigido (D-004): ainda não começou; é a próxima tarefa desta vez
decisoes: D-001 a D-005 (copiadas das memórias do Claude e da fila do PCP de 11/10/2026; nenhuma decisão nova do dono)
perguntas_ao_dono: P-001 (apagar ramos), P-002 (regra do check Deploy na main), P-003 (trava do functions.yml do painel no rh_ref sem a vez nem o último Deploy verde do RH), P-004 (nome real em comentário antigo)
nao_fazer: não trocar nem sugerir troca das senhas do RH (D-002); não voltar ao actions/deploy-pages nem apagar o site do Pages; function do RH não sobe no push (só pelo functions.yml do painel com rh_funcoes e rh_ref); não trabalhar no clone ~/Projetos/impresilkrh (atrasado, pode ter trabalho de outra sessão) nem na Dre/rh do iCloud
testes: npm run verificar com Node 20.18 em 12/10/2026: lint e typecheck ok, vitest 127 arquivos e 1952 testes passam, test:vez 22 passam (0 pulados), conferir:id 7 no padrão e 0 fora; npm run build ok
dados: nenhum (só leitura: list_edge_functions e gh run list)
