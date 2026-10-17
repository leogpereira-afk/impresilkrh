# Ramos: o que juntar e o que NÃO juntar (só se acrescenta)

Quem pega a vez lê isto antes de juntar qualquer ramo. Se a memória de um
agente disser outra coisa, vale o que está aqui. Apagar ramo, tag ou worktree
só com o aval do dono (P-001 em docs/DECISOES.md). Contagens contra a main
89cc983 (o último Deploy verde antes do protocolo), medidas em 12/10/2026 com
`git rev-list --left-right --count origin/main...origin/<ramo>` (atrás / à
frente) e `git cherry origin/main origin/<ramo>`.

## O site: NÃO JUNTAR e NÃO APAGAR

| ramo | commit | atrás / à frente | o que é |
|---|---|---|---|
| gh-pages | 57df071 | 406 / 1 | o site no ar ("publicar 89cc983"). O deploy.yml o reescreve inteiro (push --force) a cada push na main; o Pages serve daqui (modo legacy, desde 10/08/2026). Não é ramo de trabalho: não mexer à mão |

## Superados: NÃO JUNTAR (o dono decide se apaga)

| ramo | commit | atrás / à frente | destino |
|---|---|---|---|
| claude/lucid-clarke-pquyij | f21f50a | 392 / 1 | 22/06/2026, "Reconstrói o sistema de RH como SPA leve, sem banco de dados": a versão velha para a qual a main já foi revertida uma vez, em junho, perdendo dezenas de commits. Superado pela main. Já foi o ramo padrão da origem (hoje é a main); um clone antigo ainda pode ter o origin/HEAD apontando para ele. Perigoso em rh_ref (o functions.yml do painel o recusa por não conter a main) |
| publicar | 9467e76 | 274 / 2 | 29/07/2026, a migração do Netlify para o Supabase e o config.toml das functions. Superado por ddb4219 (o mesmo trabalho rebaseado sobre a main em 29/07/2026); o supabase/config.toml já está na main |

## Sem nada próprio (0 à frente): apagar com o aval do dono

| ramo | commit | atrás | observação |
|---|---|---|---|
| agenda-so-gente | 4c42aeb | 33 | 13/09/2026, "Deixa o calendário do RH só com gente": já na main |
| claude/admiring-noether-ly12p1 | 015c169 | 7 | 28/09/2026, "Tirar os resquícios do Netlify": já na main |
| claude/funny-hypatia-d5uveb | 3be2e71 | 300 | 25/06/2026, Vagas: já na main |

## Para juntar (com o "pode publicar" do dono)

| ramo | commit | atrás / à frente | o que é |
|---|---|---|---|
| protocolo | sobre a main 89cc983 | 0 atrás | AGENTS.md (= CLAUDE.md), VEZ.md, docs/DECISOES.md, docs/RAMOS.md, scripts/vez.cjs, tests/agentes.test.cjs, tests/vez-git.test.cjs e os passos "Commits dentro da vez?" no deploy.yml e no verificar.yml. Só no Mac do dono (worktree ~/Projetos/impresilkrh-protocolo) até o push |

No clone ~/Projetos/impresilkrh há também o ramo local
claude/lucid-clarke-pquyij (o mesmo f21f50a acima) e a main local 1 commit
atrás da origem em 12/10/2026.

## Atualização de 16/10/2026

- `rh-fluxos-auditoria-20261016`: correções incorporadas por rebase em `rh-modernizacao-20261016`; não juntar novamente o ramo antigo.
- `rh-modernizacao-20261016`: correções e modernização autorizadas para publicação; escopo e verificação em `docs/planos/2026-10-16-modernizacao-execucao.md`.

## Atualização de 17/10/2026 — Feedback & Pesquisas

- `rh-nps-20261017`, clone isolado em `/tmp/rh-nps-20261017`: central e dados privados, incluindo os commits locais anteriores de NPS e entrevistas. Desenvolvimento e testes autorizados; publicação ainda depende do dono. Ver `docs/revisoes/2026-10-17-feedback-pesquisas.md`. Não misturar esta frente com o ramo antigo anterior ao rebase de 17/10.
