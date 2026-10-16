# Endomarketing: ações laterais, arquivos e centralização

## Alterações
- Ações em lista compacta à esquerda; detalhe à direita. No celular, seleção abre detalhe e há retorno à lista. Três chips e um seletor substituem a sequência de etapas grandes.
- Arquivos PDF, JPG, PNG, WebP, DOCX e XLSX, até 10 MB, vinculados a ações e às ações originadas de datas. Conteúdo no IndexedDB/storage do RH; coleção guarda somente referências. Estado local/nuvem e reenvio explícitos. Desvincular não apaga o arquivo remoto.
- Datas especiais podem ser criadas, editadas e removidas na central, respeitando o acesso de gestão do calendário. Ações existentes permanecem se a data for retirada.
- Aniversários, tempo de empresa e comemorações centralizados. Retiradas as repetições do Painel, Calendário e avisos da ficha; nascimento/admissão continuam no cadastro. Calendário mantém feriados, prazos e reuniões operacionais.
- Guias e modelos de celebração, reconhecimento, engajamento e bem-estar aparecem em Ideias e materiais. Classificação editorial pelo título, sem alterar os registros existentes; novos modelos criados aqui recebem a marca endomarketing. Envio de mensagens continua no fluxo existente.
- Arquivos com prefixo endo: restritos a ADMIN_RH no servidor, como as ações internas. Agenda e materiais preservam as permissões anteriores das coleções.

## Verificação
- `npm run build`: concluído; `git diff --check` sem problemas.
- `npm run verificar`: lint e typecheck sem erros; 141 arquivos / 2.120 testes Vitest; 22 testes do protocolo; conferência de IDs sem desvios.
- Testes de ciclo completo, recarga, concorrência, seleção lateral, data e persistência de referências.
- Testes de anexos: limite/formato, falha local, reenvio após falha na nuvem, desvinculação, autorização real da function para ADMIN_RH/GESTOR/COLABORADOR em harness com dados fictícios.
- Navegador local: lista/detalhe, criação, filtro, retorno no celular de 390 px sem transbordamento, arquivo PDF sintético anexado, salvo e mantido após recarga; abertura em nova aba. Sem erros de console.
- Envio real à nuvem não executado: a prévia não possui sessão produtiva. Teste de servidor simulado, não validação em produção.

## Entrega
Alteração preparada em ramo separado. Publicação desta revisão depende de autorização do dono. Publicar sync antes da tela; não exige migration. Não houve escrita em dados reais. Prévia de teste não integra o build.
