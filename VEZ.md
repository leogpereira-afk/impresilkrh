# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-17T14:03:09.907Z
ramo: rh-nps-20261017
tarefa: Feedback & Pesquisas: central, instrumentos separados e acompanhamento por ID RH
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-17T14:33:08.164Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: origin/main 3a3d3e2; Deploy e Verificar verdes consultados via gh; casco rh-v14. Functions não alteradas nem versões remotas consultadas nesta etapa local.
ramos: rh-nps-20261017 em /tmp/rh-nps-20261017: 3 commits à frente, 0 atrás antes da devolução; 45263b3, 33c4170, 86bfdef. Local, publicação depende do dono.
feito: Central Feedback & Pesquisas completa localmente em 86bfdef, instrumentos separados, individuais, ações e revisões; evidências em docs/revisoes/2026-10-17-feedback-pesquisas.md no ramo local.
pela_metade: Sem implantação: cinco migrations desta frente e sync aguardam publicação antes da interface. Limites e validação real após deploy no relatório do ramo local.
decisoes: D-010 no ramo local: central e sete áreas; preservação de feedback, IDs estáveis, confidencialidade e pesquisas individuais RH. Mantidas D-008 e D-009.
perguntas_ao_dono: Aprovação da prévia e autorização de publicação; não publicar por inferência.
nao_fazer: Não publicar só a tela. Migrações privadas antes de sync e interface; não criar notas individuais de eNPS; não misturar o ramo anterior ao rebase nem usar dados reais em testes.
testes: npm ci, npm run verificar: 2169 testes e 22 protocolo; conferir:id 7/7; testes finais dirigidos 17/17, build e lint verdes, diff check e vez conferir verdes; preview 390 e 1280 com dados fictícios.
dados: Nenhum dado real tocado; migrations somente em PGlite isolado. Prévia usa adapters fictícios em .review ignorado; nada aplicado no Supabase.