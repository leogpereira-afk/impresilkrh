# Correções da auditoria e prévia da compactação

Estado: implementação local revisada e verificada, disponível para aprovação na prévia. Publicação não autorizada nesta etapa.

Escopo aprovado: A01 a A16 da auditoria, começando por acessos e salvamento, com prévia antes de publicar. Base funcional `7607baf`, ramo `codex/rh-correcoes-compactacao-20261024`. Dados de ensaio fictícios; nenhuma escrita em dados produtivos.

## Correções e evidências

| Auditoria | Comportamento corrigido | Evidência automatizada |
|---|---|---|
| A01 | Falha ao ler o mapa societário recusa leituras dependentes do plano com 503, preservando dados/revisão para retentar. Mapa vazio legítimo, master e coleções independentes têm controles próprios. | `acessoSocietarioFalha.test.ts`, `acessoSyncCliente.test.ts` |
| A02 | Permissões ausentes preservam o legado; lista vazia restringe módulos opcionais; `*` é explícito e permanece sujeito ao perfil. Editor, menu e rota direta usam o mesmo contrato. | `rbac.test.ts`, `usuariosPermissoes.test.tsx`, `permissoesServidor.test.ts`, `permissoesRota.test.tsx` |
| A03 | Clique duplo não duplica candidato. Cadastro reserva uma identidade antes de salvar; falha no currículo ou nos metadados permite retentar o mesmo registro. | `FormulariosValidacao.test.tsx` |
| A04 | Salário negativo não é convertido silenciosamente em positivo. | `FormulariosValidacao.test.tsx` |
| A05 | Faixas negativas, não finitas ou invertidas são recusadas. Zero continua representando faixa não definida. | `FormulariosValidacao.test.tsx` |
| A06 | Ausências recusam horas negativas/não finitas e data futura/inválida. | `FormulariosValidacao.test.tsx` |
| A07 | Viagem recusa término anterior ao início e datas inválidas; não redefine regra de diárias. | `FormulariosValidacao.test.tsx` |
| A08 | Certificado NR recusa carga negativa/não finita e data inválida. | `FormulariosValidacao.test.tsx` |
| A09 | Quantidade de vagas precisa ser inteira e maior ou igual a um. | `FormulariosValidacao.test.tsx` |
| A10 | Recuperação durável protege a janela anterior à confirmação do IndexedDB. Memória só aceita uma gravação protegida. | `armazemDurabilidade.test.ts`, `configDurabilidade.test.ts` |
| A11 | Falha de transação mantém o lote para nova tentativa; descarte só ocorre após confirmação. | `armazemDurabilidade.test.ts` |
| A12 | Retentativa preserva versão-base, identidade da operação e conteúdo enviado; operação posterior substitui a anterior. | `syncRetentativa.test.ts` |
| A13 | Shift+Tab no foco inicial fica dentro do diálogo, inclusive com campos desabilitados; Escape e retorno do foco preservados. | `modal.test.tsx` e navegador local |
| A14 | Interruptores anunciam nome e estado; foco visível e alvo mínimo de interação. | `controles-acessiveis.test.tsx`, tipos e testes de usuários |
| A15 | Edição inline associa rótulo, dica e erro ao campo, com estado inválido acessível. | `controles-acessiveis.test.tsx` |
| A16 | Data de abertura da vaga usa o dia local, sem antecipar o dia após 21h em São Paulo. | `FormulariosValidacao.test.tsx` |

## Compactação e conferência visual

- Cabeçalhos menores nas três telas piloto, preservando a identidade Silk e a preferência compacta/confortável.
- Treinamentos: busca por pessoa/título/tipo, contagem filtrada, inclusão de concluídos, detalhes recolhíveis e cartões móveis com nome/ID, tipo, estado, progresso, prazo e ações. Tabela preservada no desktop.
- Vagas: busca por título/área, filtro removível, limpar filtros e expansão/recolhimento do conjunto visível sem afetar vagas ocultas pela busca. Título e ações cabem no celular.
- Colaboradores: filtros em duas colunas no celular, identificação sem cortar o ID nos avisos, nomes acessíveis e menu de exportação legível.
- Comparação com a mesma amostra fictícia a 390 × 844: primeiro treinamento de y=724,7 para y=540,4, cerca de 184 px antes. A tabela móvel de 920 px passou a cartões de 348 px; largura total da página igual à área disponível.
- Navegador: busca de treinamento e área, mudança de estado e vaga fictícia persistidas após recarregar; expansão filtrada preserva as outras vagas; confirmação cancelada com Escape sem excluir; Shift+Tab e Tab permaneceram dentro do diálogo e o foco voltou ao botão original.

## Limites e publicação futura

A prévia tem dados fictícios, backend desativado e conexões externas bloqueadas. Ela permite conferir a interface e a persistência local; não comprova o servidor produtivo atualizado.

O diário usa uma base estável por chave/conta no IndexedDB e grava a menor representação exata disponível, completa ou por diferenças. A base é conferida por SHA-256; uma incompatibilidade preserva o diário e impede sobrescrevê-lo. Essa base local retém uma versão inicial, inclusive valores posteriormente removidos da coleção atual. O delta pode crescer com alterações acumuladas. Importação inteiramente nova ou quota insuficiente pode recusar a gravação com aviso; não promete espaço ilimitado. Configuração antiga cuja conta não pode ser determinada permanece protegida e com envio pausado.

Nenhuma métrica de quadro/ativos foi unificada: a diferença de regras permanece fora do escopo. Não foram alterados Educação, senhas, workflows, protocolos ou dependências.

Para publicação posterior, após autorização: validar novamente a main e a vez; publicar a function **sync antes da interface**, conferir o corpo/versão servido e depois a tela, o cache e os fluxos autenticados. `_shared` não mudou; não exige republicar outras functions por esta alteração. Cache local preparado como `impresilk-rh-v17`; produção continua com a versão anterior.

## Verificação integrada

- `npm run verificar`, Node 20.18.1: passou com saída 0. Lint e TypeScript aprovados; 2.266 testes em 161 arquivos, 22 testes do protocolo e sete conferências de ID no padrão.
- `npm run build`: passou com saída 0; compilação da versão final da interface e persistência concluída.
- Revisão independente dos acessos, dos formulários e da durabilidade, incluindo 14 cenários adicionais de armazenamento em uma cópia isolada, sem achados pendentes.
- O ensaio integrado identificou uma chamada automática de sincronização sobrevivendo ao encerramento de um teste. O preparo de `syncMassaRevisao.test.ts` passou a importar o módulo sem autenticação e ativar o token fictício somente antes das operações explicitamente aguardadas. A execução integrada final passou sem rejeições não tratadas.
- Prévia conferida em desktop, celular de 390 px e tema escuro. Mudança de treinamento confirmada após recarregar também na origem final da prévia. Nenhum ensaio usou cadastro real ou servidor produtivo.

A compactação desta entrega cobre Treinamentos, Vagas e Colaboradores. Os controles compartilhados de acessibilidade e persistência atendem às demais telas que os utilizam; isso não representa um redesenho de todos os módulos do RH.
