# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-24T22:27:33.952Z
ramo: main
tarefa: Restringir avisos do calendario ao acesso RH
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-24T22:43:59.862Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: rh-v19, main 648c526; Deploy 40139492761 aprovado; sync v102 ACTIVE com fonte igual ao teste.
ramos: codex/calendario-privado-rh integrado na main; cópia /tmp/rh-calendario-acesso-20261024.
feito: Calendário operacional só ADMIN_RH no menu, rota e sync; Painel valida perfil RH antes de consultar; mês branco conferido no site oficial.
pela_metade: nenhum no escopo autorizado.
decisoes: D-015; plano docs/planos/2026-10-24-calendario-privado.md.
perguntas_ao_dono: nenhuma.
nao_fazer: Não reabrir eventos privados para perfis gerais do Painel; não alterar registros reais em testes.
testes: 2297 testes RH, lint, typecheck, teste de vez, conferência de ID e build aprovados; cinco arquivos servidos iguais; fonte do sync igual; testes de Comercial e RH fictícios.
dados: Nenhum registro real alterado; teste por fixtures. Sessão real usada somente para leitura visual do calendário.