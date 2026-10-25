# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-25T00:48:02.049Z
ramo: codex/rh-exclusao-sincronizada
tarefa: Corrigir exclusao entre acessos sem reenviar cadastros; testar isolado e publicar
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-25T01:18:35.169Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: 8dae7c2, cache rh-v23; migration rh_cadastros_sinais aplicada; Deploy e Verificar aprovados e arquivos publicos conferidos.
ramos: codex/rh-exclusao-sincronizada, integrado; copia isolada fora do iCloud.
feito: Exclusao individual versionada, sem reenvio integral; sinal privado de cadastros; retrato continua por API; falhas locais por colecao e rascunho conflitante preservado.
pela_metade: Aviso intermitente de gravacao local preexistente continua; prova independente hospedada limitada pelo navegador interno sem resposta aos controles. Detalhes no plano.
decisoes: D-019; docs/planos/2026-10-24-exclusao-entre-acessos.md.
perguntas_ao_dono: nenhuma para esta publicacao.
nao_fazer: Nao limpar armazenamento nem reenviar colecoes para contornar alertas; nao editar cadastros reais nos testes.
testes: 2458 testes, lint, TypeScript, build, protocolo e IDs aprovados; dois acessos isolados e duas abas oficiais; exclusao confirmada no banco.
dados: Cadastros preexistentes intactos inclusive versoes; ficha ficticia criada e arquivada pela tela, sem vinculos operacionais; trilhas mantidas.