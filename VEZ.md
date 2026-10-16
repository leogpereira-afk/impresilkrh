# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T10:12:43.060Z
ramo: endomarketing-lateral-anexos
tarefa: Publicar Endomarketing com lista lateral e anexos
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T11:30:38.733Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 450e54a, Deploy 38893637614 verde; impresilk-rh-v11. sync 97, admin-users 71, backup-registros 67, mubi-pagamentos 89, rh-performance 18, rh-programacao 17. Listagem e corpo de sync conferidos; sw.js, index e chunk Endomarketing servidos identicos ao build local.
ramos: endomarketing-lateral-anexos: 0 a frente e 0 atras da main antes desta passagem; implementacao integrada. Demais ramos sem alteracao nesta vez.
feito: Publicada a revisao 450e54a autorizada pelo dono: lista lateral compacta, anexos e centralizacao. Servidor primeiro via functions 38893231439 verde; tela depois. Detalhes da implementacao em docs/2026-10-16-endomarketing-lateral.md; a autorizacao e publicacao pendentes naquele registro foram concluidas nesta vez.
pela_metade: Nenhuma implementacao pendente. Upload real em producao nao executado para evitar escrita de dados; envio, falhas e autorizacoes cobertos por testes locais.
decisoes: Nenhuma nova D-NNN. Dono autorizou publicacao desta revisao no chat.
perguntas_ao_dono: Nenhuma para esta entrega.
nao_fazer: Nao commitar endo-preview.html nem endo-preview.tsx: fixtures locais. Nao inserir dados ficticios em producao. Arquivos privados endo: exclusivos ADMIN_RH; desvincular nao apaga blob remoto.
testes: npm run verificar: 141 arquivos, 2120 testes Vitest e 22 testes de protocolo passaram; lint/typecheck e IDs sem desvios. npm run build passou; conferir origin/main..HEAD passou. Producao: filtros etapa/mes e formulario com anexos conferidos, console sem erros e Tudo sincronizado. Nenhum registro salvo na verificacao.
dados: Nenhuma migration nem escrita em registros reais. Publicacao de codigo apenas.