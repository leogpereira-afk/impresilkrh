# Programação de serviços — RH e PCP

Acesse **Calendário → Programação de serviços**. A aba é separada de Calendário e Plantões. Destinada à administração do RH.

1. Escolha um dia e clique em **Programar O.S.**. Busque número, cliente ou serviço entre as ordens ativas do PCP.
2. Confira a equipe da O.S. Vincule cada integrante ao cadastro do RH pelo ID e escolha o nome usado no PCP. Uma equipe habitual é só o ponto de partida: pessoas podem entrar e sair a cada serviço.
3. Informe horário, previsão de retorno quando conhecida, veículo, lugares (incluindo motorista), motorista e gerente responsável.
4. **Salvar no RH e PCP** atualiza a mesma O.S. Dados comerciais, valores, fotos e execução são preservados. Uma O.S. concluída ou com saída registrada não é remarcada por esta aba.
5. Confira os requisitos comerciais com referência da comprovação. No dia, registre quem confirmou pelo cliente e o canal (telefone ou WhatsApp). A confirmação atualiza o PCP. Remarcar a agenda invalida a confirmação anterior. A liberação física do carro continua no PCP.
6. Use **Mensagem para equipe** para ver a agenda completa ou só os serviços de uma pessoa. Copie o texto ou abra o WhatsApp, escolha o destinatário e confirme o envio no aplicativo.
7. Os PDFs do dia e do mês respeitam o filtro por pessoa e trazem equipe, veículo, orientações e pendências.

## Vínculos e dados

- Fonte única: `pcp_registros`, coleção `os`, ID existente da O.S.
- Agenda: campos `instalacao.data`, `instalacao.hora`, `instalacao.periodo`, `equipe` e `veiculo`.
- Conferência: `programacaoRH`, com IDs do RH, motorista, lugares, gerente, orientações, requisitos e data/autor da conferência. Campos adicionais são projetados somente para a administração do RH.
- Confirmação do dia: `programacaoRH.confirmado` e os campos já existentes `confirmacao`, `confCanal`, `confHora`, `confPor`, `confObs`.
- O serviço de consulta da Performance oferece os IDs dos participantes previstos quando a O.S. for concluída. O RH pode trazê-los e repartir a participação, mas precisa conferir quem executou. Não há pontuação, aprovação ou pagamento automático.
- Cadastros de equipe habitual são compartilhados com Plantões. Escalas anteriores permanecem com sua própria composição.
- O.S. com duração maior que um dia aparecem em todos os dias do período; equipe e veículo seguem a composição única que o PCP usa para essa O.S.

## Proteções

A função `rh-programacao` verifica o token no Supabase Auth e o perfil ADMIN_RH ativo em cada chamada. O servidor resolve nomes pelos IDs existentes, permite somente os campos da programação e grava por atualização condicional sobre `atualizado_em`. Não há criação/exclusão de O.S., alteração de permissões, migração, acesso público aos dados ou execução de pagamentos.

Conflitos certos de horário são bloqueados. Quando falta previsão de retorno, a tela pede conferência e não inventa duração. A capacidade informada do veículo é verificada. Apelidos não são associados automaticamente: nomes semelhantes ou duplicados exigem escolha humana pelo ID.

A informação compartilhada vem da última consulta, com horário visível. Use Atualizar PCP antes de divulgar alterações feitas por outra pessoa. Alterações no PCP que mudem equipe/veículo invalidam o retrato correspondente do RH; confirme os vínculos novamente.

## Limites operacionais

- O envio é assistido. Abrir WhatsApp ou copiar texto não comprova envio, leitura ou recebimento. Grupos são escolhidos no WhatsApp, sem automação de disparos.
- Se um integrante não tiver apelido no PCP, pode-se usar o nome completo, mas isso não cria seu acesso ao aplicativo de campo. Confira o cadastro do PCP.
- Um veículo informado fora da lista é sinalizado; conferir a identificação evita nomes diferentes para o mesmo carro.
- A programação não substitui a conferência de EPIs, habilitação, materiais, descanso ou a liberação da saída no PCP.
- A versão condicional protege as gravações desta nova aba; o PCP mantém seu próprio fluxo de versionamento e sincronização.

Referência para links de conversa: [Central de Ajuda do WhatsApp](https://faq.whatsapp.com/5913398998672934/?locale=pt_BR).
