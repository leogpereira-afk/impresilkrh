# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-16T02:13:52.126Z
ramo: HEAD
tarefa: Endomarketing na lateral com agenda, acoes de bem-estar e modelos pesquisados
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-16T08:08:17.105Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 93a3dce, Deploy verde 38868828692, cache impresilk-rh-v10; sync 96, admin-users 71, backup-registros 67, mubi-pagamentos 89, rh-performance 18, rh-programacao 17 ACTIVE. Functions workflow 38862258513; corpo sync e chunk Endomarketing-BJEZg7Qn.js idênticos ao código validado; UI autenticada conferida.
ramos: endomarketing 0 atrás/0 à frente, integrado. Sem trabalho próprio: agenda-so-gente 64/0; claude/admiring-noether-ly12p1 38/0; claude/funny-hypatia-d5uveb 331/0; f07-fila 15/0; id-pessoa 19/0; ids-anteriores 8/0; ids-bloqueio 4/0. Históricos superados: claude/lucid-clarke-pquyij 423/1; publicar 305/2; não juntar, ver docs/RAMOS.md. Nenhum ramo excluído.
feito: d5252d6 e 93a3dce: Endomarketing, agenda do cadastro, planejamento interno, 14 modelos e ações em linhas compactas. Registro docs/2026-10-15-endomarketing.md; plano concluído inclusive publicação e navegação em produção.
pela_metade: nenhum desenvolvimento pendente; gravação real em produção não executada pelo agente, conforme D-005. CRUD e persistência testados localmente com dados fictícios.
decisoes: D-006: Endomarketing no RH, acesso existente, modelos editoriais e publicação autorizada.
perguntas_ao_dono: nenhuma nova; pendências anteriores preservadas.
nao_fazer: Não ampliar permissões nem preencher ações automaticamente; não registrar saúde em campanhas. Não importar fixture local para produção. Não confundir presença com satisfação.
testes: npm run verificar: lint/typecheck, 140 arquivos/2112 testes e 22 testes do protocolo aprovados, conferir:id OK. Build OK. Chrome local: criar/concluir/reabrir/recarregar e 390px sem overflow. Produção: sidebar, agenda, 14 modelos, ações vazias corretas e console sem erros; sync e chunk verificados.
dados: nenhuma migration ou registro real alterado, nenhuma mensagem enviada; somente código publicado.