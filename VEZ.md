# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-24T23:49:11.237Z
ramo: codex/rh-dados-auditoria
tarefa: Publicar e conferir melhorias aprovadas da aba Dados
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-25T00:00:23.791Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main e4864f3, cache impresilk-rh-v22; Deploy 40144533217 e Verificar 40144533248 aprovados. Index, SW, ColaboradorFicha e formulario iguais ao build; sessao oficial sincronizada e campos/chips conferidos. Functions inalteradas; sync v102 conforme passagem anterior, demais versoes nao reconsultadas.
ramos: codex/rh-dados-auditoria integrado na main em e4864f3, 0 a frente e 0 atras antes desta devolucao. Versao local antiga 05ed4ef rebaseada como 587b189, nao juntar novamente. Outros ramos conforme docs/RAMOS.md.
feito: Publicadas as melhorias dos 39 editores da aba Dados, 7 grupos de chips, campos complementares e protecoes de edicao; commits 587b189 e e4864f3. Registro docs/auditorias/2026-10-24-aba-dados.md; validacao produtiva nesta Passagem.
pela_metade: Nenhuma implementacao ou publicacao pendente; persistencia com escrita foi testada somente em fixtures isoladas.
decisoes: D-018 autoriza esta publicacao e conferencia no site preservando dados reais.
perguntas_ao_dono: Nenhuma.
nao_fazer: Nao adicionar arquivos locais de previa ao repositorio nem salvar alteracoes ficticias nas fichas reais. Nao misturar com outras frentes.
testes: npm run verificar aprovado, 2453 testes em 171 arquivos, mais 22 testes do protocolo e 7 IDs no padrao; build, diff-check e conferir da vez aprovados. Producao: 39 editores abertos e cancelados, 7 grupos de chips conferidos, 32 valores da versao anterior preservados e todos os 39 inalterados apos recarga, nuvem sincronizada.
dados: Nenhuma escrita em cadastro real, nenhuma migration ou function publicada; preservados os dados reais. Testes de salvamento somente em copia isolada.