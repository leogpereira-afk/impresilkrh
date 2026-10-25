# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-25T04:52:07.150Z
ramo: codex/rh-exclusao-imediata
tarefa: Priorizar sinal de cadastros durante leituras grandes e gravacao segura
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-25T10:15:51.190Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 024a9ea; Deploy 40183657139, Verificar 40183657160 e Pages 40183842026 verdes; rh-v27. HTML, SW e chunks conferidos por SHA-256. Functions conferidas: sync 102, admin-users 73, backup-registros 69, mubi-pagamentos 91, rh-performance 20, rh-programacao 19.
ramos: codex/rh-exclusao-imediata igual a origin/main antes da passagem (0 atras / 0 a frente); implementacao integrada. Ramos antigos: manter destinos de docs/RAMOS.md, sem juntar nem apagar.
feito: d49e218, c376b68 e 024a9ea: eventos preservados durante ACK, reconexao do canal, formulario em transacao duravel e prioridade de cadastros sem esperar historico. Plano docs/planos/2026-10-25-exclusao-imediata.md. Site medido em dois navegadores: retirada em 4664 ms desde o clique, sem recarregar; inclui confirmacao de rede.
pela_metade: nenhum no escopo; latencia observada no site e de rede, sem espera do ciclo de vinte segundos. Evidencias privadas e arquivos de previa permanecem fora do repositorio publico.
decisoes: D-021 complementa D-019/D-020: exclusao por evento, teste isolado com dois navegadores e publicacao autorizados; dados reais preservados.
perguntas_ao_dono: nenhuma nova; perguntas P anteriores permanecem em docs/DECISOES.md.
nao_fazer: Nao enfileirar leitura de cadastros atras de paginas gerais; resposta antiga nao pode ressuscitar ficha. Nao gravar formulario completo pelo diario sincrono. Nao usar nem publicar previews locais. Nao limpar armazenamento ou cadastros reais para testar.
testes: npm run verificar e build aprovados: 177 arquivos / 2477 testes, 22 testes de protocolo, 7 conferencias de identidade, lint e TypeScript. Chrome e navegador integrado independentes, consulta de vinte segundos desligada no isolado; 20 ms apos servidor. Site conferido nos dois com o mesmo chunk publicado.
dados: Nenhuma migration nesta rodada. Somente fichas ficticias descartaveis criadas e excluidas pela tela autorizada; todas confirmadas como removidas. Integridade integral dos cadastros reais igual antes/depois, sem duplicacao nem reenvio de fichas no teste isolado. Trilhas de acesso mantidas.