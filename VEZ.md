# De quem é a vez neste repositório

Só o agente desta linha, na sessão desta linha, faz commit ou push aqui, em
qualquer ramo. Vale o que está na origin/main (`git show origin/main:VEZ.md`),
não a cópia do disco. Este arquivo só muda pelo `node scripts/vez.cjs` (pegar,
passar, liberar, aceitar), que monta o commit em cima da origin/main; nunca à
mão num ramo de trabalho. Regra completa no AGENTS.md (igual ao CLAUDE.md),
seções 0, 5 e 6.

agente: ninguem
desde: 2026-10-24T14:27:56.166Z
ramo: HEAD
tarefa: Corrigir dezesseis achados da auditoria e compactar RH para previa local
sessao: -
versao_reservada: -
arquivos_em_uso: -
passou_por: codex
passou_em: 2026-10-24T16:10:14.877Z

## Passagem (o que o último agente deixou para o próximo)

Preencha TODOS os campos (no VEZ.md do disco) antes de
`node scripts/vez.cjs passar`. Uma linha cada; detalhe vai em docs/ e o campo
aponta para lá. "nenhum" é resposta válida; vazio ou "-" não é. Com a vez de
alguém, os campos podem estar em "-" enquanto ele trabalha; com a vez livre
(ninguem), têm de estar todos cheios. "sessao: -" quer dizer que nenhuma
sessão se registrou ainda: o primeiro `pegar` do mesmo agente a adota.

no_ar: main 41bb216 e ultimo Deploy verde 40102634462, head 41bb216, conferidos por git fetch e gh; CACHE v16 em origin/main. Functions sync, admin-users, backup-registros, mubi-pagamentos, rh-performance e rh-programacao nao alteradas nem reconsultadas nesta entrega; versoes historicas em docs/passagens/2026-10-17-codex-6.md nao sao verificacao atual. Nenhuma melhoria publicada.
ramos: codex/rh-correcoes-compactacao-20261024, commit local ebe2666, 1 a frente e 0 atras de 41bb216 antes desta devolucao; dono revisa previa e decide publicar. Preservado em /tmp/rh-correcoes-compactacao-20261024; ramo de auditoria anterior somente leitura, sem alteracoes nesta vez.
feito: A01 a A16 corrigidos e revisados no commit local ebe2666; compactacao em Treinamentos, Vagas e Colaboradores, acessibilidade compartilhada, diario duravel e retentativa consistente. Registro docs/2026-10-24-correcoes-auditoria-previa.md no ramo local; previa http://127.0.0.1:5574/treinamento.
pela_metade: nenhuma implementacao pendente nos dezesseis achados; publicacao e validacao autenticada em producao aguardam aprovacao. A compactacao visual desta entrega cobre as tres telas piloto, nao todos os modulos.
decisoes: nenhuma D nova; preservadas as regras vigentes, IDs estaveis e divergencia de quadro/ativos fora do escopo.
perguntas_ao_dono: aprovar a previa antes de publicar esta versao; nenhum P novo. Publicar sync antes da interface somente apos aprovacao e revalidacao da main e da vez.
nao_fazer: nao publicar o ramo sem aprovacao; nao testar com dados reais; nao unificar quadro/ativos; nao editar Educacao. Base local de recuperacao pode reter valores antigos e delta cresce; quota e importacao nova grande podem recusar com aviso. Configuracao antiga ambigua preservada e envio pausado. _shared nao mudou.
testes: Node 20.18.1: npm run verificar passou, lint e typecheck, 2266 testes em 161 arquivos, 22 testes da vez, 7 conferencias ID; npm run build passou; protocolo conferir origin/main..HEAD passou para 1 commit; diff check limpo. Revisao independente 14 cenarios extras passou; navegador local desktop, 390px e escuro, persistencia apos reload e foco de modal verificados.
dados: nenhum dado real tocado, nenhuma migration aplicada, nenhuma function publicada; ensaios com dados ficticios e previa sem backend.