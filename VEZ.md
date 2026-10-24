# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-24T23:14:13.432Z
ramo: codex/notificacoes-privadas-rh
tarefa: Revogacao de acesso RH em tempo real
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-24T23:27:11.638Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main e49e34a, cache rh-v21; Deploy 40142445844 e Verificar 40142445790 aprovados; index, SW e bundle iguais ao build; sessão RH e calendário confirmados no site. Functions inalteradas, sync v102 conforme passagem anterior.
ramos: codex/rh-revogacao-tempo-real integrado na main; cópia /tmp/rh-calendario-acesso-20261024.
feito: a3cc6ba e e49e34a, sinal privado de revogação, suspensão de alertas durante validação, descarte de respostas antigas e reconexão; docs/planos/2026-10-24-revogacao-tempo-real.md.
pela_metade: nenhuma implementação; revogação real de contas de produção não exercitada, somente fixtures isoladas.
decisoes: D-017 complementa D-015 e D-016.
perguntas_ao_dono: nenhuma.
nao_fazer: Não remover RLS do sinal ou replicar dados de perfis; não revogar conta real para teste. Canal desconectado mantém calendário e sino ocultos.
testes: npm run verificar aprovado, 2309 testes, build aprovado; PGlite isolado para trigger/RLS; integração Auth/canal/sino e corridas; produção com canal autorizado e calendário/sino visíveis.
dados: Migration rh_acesso_sinais aplicada e schema conferido; contém somente user_id/revisao, próprio usuário lê, cliente não escreve; nenhuma conta ou registro real alterado para teste.