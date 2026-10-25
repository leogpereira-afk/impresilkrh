# Exclusão entre acessos do RH

Autorização: D-019. Cópia isolada, dados fictícios e publicação após verificação.

## Correção

1. O formulário usa a fila individual e a versão de cada ficha/dependência. Retira os reenvios das coleções completas e a exclusão duplicada da ficha.
2. Um contador privado sinaliza alterações de colaboradores pelo Realtime. Só RH ativo pode lê-lo; não contém nome, ID de ficha ou dados pessoais. O retrato continua vindo da API autenticada, com as permissões existentes.
3. Falha ao gravar uma coleção local não impede aplicar as demais. O marco da coleção com falha não avança.
4. Exclusão remota prevalece sobre edição pendente: a ficha sai da tela e o rascunho é conservado no conflito, sem restaurar o cadastro. Sinal durante leitura provoca uma nova leitura ao terminar.

## Evidência local

- Regressões primeiro reproduzidas e depois aprovadas: reenvio em massa, dependência sem versão, aplicação interrompida por outra coleção e ficha excluída mantida por rascunho pendente.
- Verificação completa: 174 arquivos, 2458 testes; lint, TypeScript, 22 testes do protocolo e IDs nas conferências aprovados. Build aprovado.
- Banco PostgreSQL descartável: trigger, leitura por RH ativo, bloqueio para colaborador/inativo/anônimo e bloqueio de escrita pelo cliente aprovados.
- Dois acessos em origens locais independentes: exclusão pela tela A; tela B passou a “Colaborador não encontrado” em 446 ms sem recarga. Transporte externo simulado com sinal SSE; cliente, formulário, armazenamento, handler de sync e RPC de versão reais.
- Uma chamada delete da ficha fictícia, nenhuma importação/reenvio da coleção. Segundo cadastro byte a byte igual, incluindo versão e timestamp. Registros de auditoria preservados.

## Publicação e retorno

Ordem: migration `rh_cadastros_sinais`, tela com cache rh-v23, CI, arquivos servidos e conferência no site. Functions não mudam. Se necessário reverter o cliente, o contador continua inofensivo; não reverter/excluir dados.

A conferência ao vivo será registrada na Passagem. A prova de atualização por evento na cópia isolada não substitui a conferência do Realtime hospedado.

## Conferência publicada

Deploy e Verificar do commit 8dae7c2 aprovados; Pages atualizado. Arquivos públicos iguais aos da publicação, incluindo o chunk da ficha e cache rh-v23. Ficha fictícia criada e excluída pela tela: banco confirmou a lápide e outra aba do site retirou a ficha sem recarga; cadastros preexistentes íntegros, inclusive versões e timestamps, e nenhum vínculo operacional do teste ficou ativo. Trilha de auditoria preservada.

Limites: a prova independente entre origens é a isolada; as duas abas oficiais compartilham armazenamento e não isolam Realtime de BroadcastChannel. O navegador interno não respondeu aos controles de conferência; não se declara aprovado o ensaio hospedado entre navegadores independentes. Persistiu aviso intermitente de gravação local já observado antes da correção; não houve limpeza geral do armazenamento.
