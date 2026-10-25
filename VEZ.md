# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-25T00:06:06.028Z
ramo: codex/rh-dados-auditoria
tarefa: Testar campos e chips entre dois acessos isolados sem dados reais
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-25T00:16:50.516Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main eedc01f e Deploy 40145390768 aprovado, conferidos por fetch e gh; aplicacao e4864f3, cache rh-v22. Functions inalteradas: sync v102 conforme passagem anterior; admin-users, backup-registros, mubi-pagamentos, rh-performance e rh-programacao nao reconsultadas nesta auditoria.
ramos: codex/rh-dados-sincronizacao, commit local 72eebbe, 1 a frente e 0 atras de eedc01f antes desta devolucao; somente testes e relatorio, nao publicado. Destino depende de autorizacao para publicar testes; demais ramos em docs/RAMOS.md.
feito: 47 testes novos passando: 39 editores e chips, envio/leitura em contextos separados, PGlite e handler reais, offline, recibo perdido, conflito, envio em andamento e cancelamento. Relatorio local docs/auditorias/2026-10-24-dados-sincronizacao.md no ramo 72eebbe.
pela_metade: nenhum trabalho de aplicacao pendente; login e gravacao no Supabase hospedado nao exercitados, conforme isolamento solicitado.
decisoes: nenhuma nova; pedido desta vez autoriza testar na copia isolada preservando cadastros reais, sem nova publicacao funcional.
perguntas_ao_dono: nenhuma para concluir a auditoria; novos testes ficam locais, sem publicacao solicitada.
nao_fazer: nao incluir os arquivos revisao-* nem fichas reais; conflito e por versao da ficha, sem mescla automatica. Nao confundir PostgreSQL isolado e transporte simulado com gravacao confirmada em producao.
testes: npm run verificar aprovado: lint, tsc, 2500 testes em 172 arquivos, 22 do protocolo e 7 IDs corretos; npm run build e git diff --check aprovados; vez conferir origin/main..HEAD aprovou 1 commit.
dados: nenhum cadastro real tocado. Duas migrations de integridade executadas apenas no PGlite descartavel com dados ficticios; nenhuma migration aplicada em producao.