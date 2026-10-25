# Exclusão imediata entre navegadores

Pedido D-021: receber a exclusão por evento, sem aguardar o ciclo de vinte segundos, testar em cópia isolada e publicar. Dados reais preservados.

## Investigação

O banco já publica um contador privado de cadastros, com trigger e RLS de RH ativo. O cliente assina o contador, mas ignora falhas do canal. O recebimento também pode descartar o sinal enquanto uma gravação local está confirmando (inclusive confirmação da fila que não emite o evento de edição). A observação anterior em cerca de vinte e um segundos não mediu a latência efetiva do canal.

## Execução

- Reproduzir a perda de atualização durante confirmação local e garantir retomada ao concluir a transação.
- Conferir a ligação e recuperação do canal real, sem transportar dados pessoais pelo sinal.
- Testar com navegadores independentes, sem armazenamento compartilhado e sem depender do timer periódico.
- Publicar somente após a suíte e o build. Medir a retirada da ficha fictícia no site e conferir integridade dos demais cadastros antes/depois.

## Verificação antes da publicação

- Regressões reproduzidas antes da correção: evento perdido durante confirmação local e ausência de reconexão do canal interrompido.
- `npm run verificar`: lint, TypeScript, 176 arquivos / 2475 testes, 22 testes do protocolo e 7 conferências de identidade aprovados. `npm run build` aprovado.
- Chrome e navegador integrado independentes, origens distintas, banco isolado com dados fictícios e cliente Supabase real conectado ao transporte de teste. Consulta periódica de vinte segundos desativada. A ficha desapareceu no segundo acesso 223 ms após a confirmação da exclusão no servidor, sem recarregar.
- Cadastro de controle integralmente preservado; somente a ficha descartável foi excluída, sem reenvio das demais fichas. Nenhum aviso de gravação local, inclusive com armazenamento local sob pressão de espaço.
- Evidências detalhadas ficam fora do repositório público. Conferência de produção será registrada na passagem após o deploy.

### Complemento encontrado na conferência

O formulário completo ainda gravava pelo diário síncrono, embora edição no lugar e exclusão já usassem transação durável. O teste de criação com quota cheia reproduziu a exceção não tratada. Criação e edição completas agora confirmam a mesma transação antes de fechar; falha mantém o rascunho e permite tentar novamente. Não altera acesso nem exige novos campos.

Nova regressão comprova criação sem duplicação, preservação da ficha de controle, falha do disco sem fechar o editor e nova tentativa bem-sucedida. Formulário exercitado na cópia isolada com armazenamento sob pressão e nenhum aviso local. Verificação completa: 177 arquivos / 2476 testes, 22 testes do protocolo, lint, TypeScript, 7 conferências de identidade e build aprovados. Cache rh-v26.

### Prioridade durante leitura de histórico

A medição contínua no site revelou que o sinal ainda aguardava a conclusão de uma leitura geral com muitas páginas. O sinal de cadastro agora pede somente colaboradores, em uma leitura independente. Ao aplicar a mudança, invalida a resposta geral anterior para impedir que uma ficha excluída reapareça. A fila de alterações locais e as máscaras de acesso continuam preservadas.

Regressão reproduzida mantendo a leitura geral suspensa: a ficha precisa sair antes de essa leitura terminar e não pode reaparecer quando a resposta antiga chega. Passou após a correção, sem gerar upsert dos demais cadastros. Repetição em Chrome e navegador integrado, origens distintas e consulta periódica desativada: retirada no receptor em 20 ms após a confirmação do servidor isolado (342 ms desde o clique), controle integralmente preservado e zero avisos locais.

Verificação completa final: 177 arquivos / 2477 testes, 22 testes do protocolo, lint, TypeScript, 7 conferências de identidade e build aprovados. Cache rh-v27. A latência do site depende da confirmação de rede e será registrada na passagem após a publicação.
