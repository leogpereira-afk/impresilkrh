# Gravação local e exclusão em dois navegadores

Autorização: D-020. Corrigir o aviso, testar isoladamente, publicar e conferir no site; preservar os cadastros reais.

## Diagnóstico e ajuste

O pull aplicava todas as coleções no mesmo turno síncrono. A cópia temporária no localStorage precisava acomodar a soma dos retratos antes de a descarga de 200 ms alcançar o IndexedDB. Uma coleção que cabe individualmente podia falhar porque a anterior ainda ocupava o diário. A regressão sintética reproduziu a perda da segunda coleção no cache, com aviso de quota.

Confirmar cada coleção no IndexedDB antes de aplicar a seguinte e gravar o marco de sincronização somente após as confirmações. Reler a fila de edições a cada coleção; interromper se a sessão ou época dos dados mudar. Não limpar armazenamento, não descartar diários e não reenviar coleções à nuvem.

## Verificação

- Regressão de quota: falhou antes do ajuste, aprovada depois.
- Cópia isolada com PostgreSQL descartável e dados fictícios: Chrome e Safari, em origens diferentes, com espaço local ocupado por um preenchimento sintético. Os dois carregaram sem avisos. Exclusão no Chrome retirou a ficha do Safari sem recarga; o outro cadastro preservado integralmente.
- Conferir edição concorrente, testes completos, build, publicação e os arquivos servidos; repetir no site apenas com ficha fictícia e conferir integridade dos cadastros preexistentes.

Sem migration nem alteração das functions. Cache da interface: rh-v24.

O diálogo da nuvem também passa a mostrar a causa da falha e, quando local, a coleção afetada. Erros HTTP mostram apenas o código, sem o corpo da resposta; a informação fica separada por conta e desaparece após nova leitura bem-sucedida. Isso evita um aviso genérico sem orientação na conferência entre navegadores.

## Complemento após conferir o site

A sessão independente ainda recusava a coleção de colaboradores: uma coleção sozinha podia ultrapassar o espaço temporário disponível. A regressão adicional reproduziu esse caso e falhou antes do complemento.

O recebimento da nuvem agora confirma diretamente no IndexedDB antes de publicar na memória; o diário síncrono continua protegendo as edições do usuário. A transação compara o conteúdo anterior no disco e respeita alterações durante a espera. Se outra aba gravou primeiro, a leitura adota o disco e refaz a mescla. Recuperações bloqueadas são preservadas, sem limpeza forçada. A revisão da coleção só avança após confirmação.

2465 testes aprovados em 175 arquivos, lint, TypeScript, protocolo e IDs aprovados; build aprovado. Novo ensaio Chrome/Safari em origens independentes com 4,9 milhões de caracteres de preenchimento sintético e coleções de 600 mil caracteres: sem avisos, exclusão refletida sem recarga, uma chamada delete, nenhum reenvio de coleção e cadastro de controle integralmente preservado. Incluídos testes de transação abortada, edição concorrente, reabertura e aba atrasada.

Verificação de código: 175 arquivos e 2460 testes aprovados; lint, TypeScript, 22 testes de protocolo e conferência de IDs aprovados. O ensaio isolado confirmou uma chamada de exclusão versionada, nenhum reenvio/importação integral e nenhuma mudança no outro cadastro, inclusive versão e timestamp. Os registros adicionais foram apenas trilhas de acesso do ensaio.

## Edições após crescimento da coleção

A conferência da edição no site identificou também uma base de recuperação antiga: o diário pode crescer mesmo quando o campo alterado é pequeno. A regressão reproduziu coleção recebida após uma base vazia e edição recusada por quota. O diário grande agora usa compactação sem perdas quando há redução relevante; mantém a base estável, a confirmação síncrona e a leitura dos formatos anteriores. Uma falha real de armazenamento continua recusando a escrita, preservando o valor anterior.

2469 testes em 176 arquivos, lint, TypeScript, 22 verificações de protocolo, 7 verificações de IDs e build aprovados. Chrome e Safari isolados: edição refletida no outro acesso, exclusão refletida sem recarga, zero avisos e cadastro de controle integralmente preservado. Transporte enviou somente a ficha editada, sua exclusão e a trilha de acesso; nenhuma importação integral.

## Confirmação direta da edição

A conferência no site mostrou que a compactação ainda depende de alguma sobra no localStorage. A edição dos campos e a exclusão da ficha agora executam coleção, fila e histórico na mesma transação IndexedDB. A tela aguarda o commit antes do sucesso; uma transação abortada mantém o rascunho e o dado anterior. Confirmações do servidor também guardam revisão e retirada da fila juntas, sem um novo retrato no localStorage.

O sincronizador aguarda a transação; a leitura remota não substitui uma edição em confirmação. As gravações verificam o valor anterior no disco, recusam concorrência divergente e respeitam a conta de origem. Os fluxos síncronos anteriores continuam com diário recuperável.

Ensaio adicional com o diário de colaboradores explicitamente indisponível: navegador integrado e Safari independentes, edição refletida, exclusão sem recarga, zero avisos locais e cadastro de controle integralmente preservado. Regressões cobrem quota zero, aborto sem escrita parcial, reabertura, fila/revisão confirmadas e edição concorrente.
