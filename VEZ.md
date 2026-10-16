# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T16:47:34.250Z
ramo: endomarketing-lateral-anexos
tarefa: Corrigir feedback desenvolvimento SST e auditar design do RH
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T17:03:32.299Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 7a8ec49, Deploy 38934727730 success; site v11. Functions nao alteradas nem reconsultadas nesta vez; sync 97 segundo passagem anterior.
ramos: rh-fluxos-auditoria-20261016 em origin, 1 a frente e 0 atras antes da passagem; commit 1bd5913 pronto para revisao e publicacao somente com aval. Demais ramos preservados.
feito: Feedback pela data efetiva e fases; calibracao manual 9-Box; filtros SST; retirada de Documentos somente da lateral. Auditoria em docs/planos/2026-10-16-auditoria-design-rh.md no ramo.
pela_metade: Publicacao nao autorizada nesta solicitacao. Perda geral de SST nao reproduzida na edicao local; confirmar caso exato se persistir. Melhorias visuais amplas sao propostas, nao implementadas.
decisoes: nenhuma nova regra global; escopo do pedido registrado no plano do ramo.
perguntas_ao_dono: Avaliar auditoria e autorizar publicacao da revisao. Se SST ainda falhar, informar campo e se some ao recarregar.
nao_fazer: Nao publicar fixtures locais endo-preview nem rh-fluxos-preview. Nao inferir aptidao ou substituir exames antigos automaticamente. Calibracao nao altera notas nem promocao.
testes: npm run verificar: 143 arquivos, 2127 testes e 22 protocolo passaram. Apos ultimo ajuste: lint, 50 testes direcionados e build passaram. UI local feedback completo e 9-Box persistidos; largura 390px; nuvem produtiva lida sem gravacao.
dados: nenhum dado real alterado; nenhuma migration; fixtures ficticias locais sem sync.