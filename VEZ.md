# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-17T13:34:46.412Z
ramo: rh-nps-20261017
tarefa: Central de pesquisas e entrevistas com categorias e modelos
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-17T13:48:10.689Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main cb24e80, Deploy 39037160062 e Verificar 39037160078 verdes consultados via gh; CACHE rh-v14; functions não consultadas nem alteradas nesta tarefa.
ramos: rh-nps-20261017 local 1cd084f, 2 commits à frente e 0 atrás de origin/main antes da devolução; aguarda aprovação para publicar NPS e central. Demais ramos sem alteração.
feito: 1cd084f amplia 2a99da9 com central colorida, dez roteiros, entrevistas identificadas RH, agenda, registro, conclusão e histórico; docs/planos/2026-10-17-central-escuta.md.
pela_metade: Implementação local concluída. Migrations de NPS e entrevistas, sync e interface ainda não publicadas. Prévia localhost 5395/.review/nps.html usa dados fictícios.
decisoes: D-009 autoriza entrevistas individuais identificadas restritas ao RH. D-008 mantém clima/eNPS confidenciais e agrupados. Registradas no ramo local.
perguntas_ao_dono: Aprovação da prévia e autorização específica para publicar. Nenhuma dependência de informação para concluir o código local.
nao_fazer: Não enviar respostas individuais para registros, cache, exportação geral ou logs. Não misturar acervo anterior com eNPS confidencial. Publicar migrations e sync antes da interface; não alterar dados reais.
testes: npm run verificar passou: 2156 testes, 22 testes de protocolo, lint, TypeScript e IDs. npm run build e git diff --check passaram; SQL em PGlite, UI desktop/mobile fictícia, RBAC e concorrência verificados.
dados: Nenhuma migration aplicada em produção, nenhum dado real alterado. Apenas testes fictícios locais; arquivos .review ignorados e fora do commit.