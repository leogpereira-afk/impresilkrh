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

Verificação de código: 175 arquivos e 2460 testes aprovados; lint, TypeScript, 22 testes de protocolo e conferência de IDs aprovados. O ensaio isolado confirmou uma chamada de exclusão versionada, nenhum reenvio/importação integral e nenhuma mudança no outro cadastro, inclusive versão e timestamp. Os registros adicionais foram apenas trilhas de acesso do ensaio.
