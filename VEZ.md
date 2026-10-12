# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-12T21:20:42.138Z
ramo: ids-anteriores
tarefa: IDs anteriores da pessoa: guardar, não dar a outra pessoa, avisar a Central (auditoria de 12/10)
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: claude
passou_em: 2026-10-12T23:04:13.473Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 9c7cb95 (Deploy e Verificar verdes); sync v92, rh-programacao v14, rh-performance v15 publicadas do ramo ids-bloqueio em 12/10/2026
ramos: ids-anteriores e ids-bloqueio já juntos na main; nenhum ramo aberto
feito: IDs anteriores da pessoa (idPessoaAnteriores) e marca idPessoaBloqueado (D1), op devolverId e arquivosDaLinha só do admin (D2), lápide do mesmo CPF (D3), retrato não pisa na linha de arquivo (D4), CPF corrigido mantém o ID que valia, casamento do ERP pelo ID que vale; notas no docs D-004
pela_metade: nenhum no RH; o PCP ainda precisa ler a marca idPessoaBloqueado e os IDs anteriores (vai na v175 do PCP)
decisoes: ficha marcada não segura ID de ninguém (quem segura é o dono: ficha viva, lápide ou anteriores); contrato de freelancer só segura ID com CPF válido, como o PCP calcula
perguntas_ao_dono: nenhuma nova
nao_fazer: não gravar idPessoa, idPessoaAnteriores ou idPessoaBloqueado por script em produção: só pela tela do admin
testes: npm run verificar e build verdes no 9c7cb95 (138 arquivos, 2099 testes); três revisões independentes com provas em src/lib/idPessoaRevisao*.test.ts
dados: a ficha da Direção corrigida em 12/10 ganhou o ID anterior pela tela (conferido por SELECT); nenhuma outra escrita em produção