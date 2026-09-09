# Revisão de férias — 09/09/2026

## Resultado

A agenda e a ficha usam um formulário e uma regra de validação comuns. O saldo é calculado por aquisitivo, com separação entre dias gozados, em curso, reservados e vendidos. Datas e decisões explícitas de conclusão/cancelamento determinam a presença atual.

A página de Férias lista as pessoas do quadro visível, inclusive quem ainda não tem histórico. Tem busca por nome, filtro por área, cartões clicáveis que contam pessoas, próximas saídas/retornos e detalhes com documentos. O filtro ativo fica destacado. Não há cartão de desligados.

## Problemas corrigidos

| Antes | Agora |
| --- | --- |
| Frações de anos diferentes interferiam no novo agendamento. | A contagem de frações pertence ao aquisitivo escolhido. |
| Uma reserva futura podia ser ignorada ao verificar o saldo. | Toda reserva válida consome disponibilidade. |
| Saldos gravados em cada fração eram somados ou era escolhido o maior. | O saldo é calculado uma vez por aquisitivo. |
| Abono ficava apenas em observação. | Campo explícito de dias vendidos; texto antigo pede conferência humana. |
| A ficha permitia gozos sem as verificações da agenda. | A mesma validação verifica saldo, sobreposição, divisão e datas nas duas entradas. |
| Concluído podia aparecer como próxima saída. | Conclusão e cancelamento explícitos prevalecem sobre as datas. |
| Sem histórico podia parecer saldo zero ou a pessoa nem aparecer. | Pessoa visível com “Saldo a conferir”. |
| Um ano completo podia ser calculado como 11 meses pela média de 30,44 dias. | A referência acompanha o aniversário de calendário. |
| A edição podia alterar o formato de uma data que não foi modificada. | O valor antigo é preservado quando o dia não mudou. |
| Desfazer uma data podia recriar uma reserva inválida. | Restauração passa pela validação; saldo calculado não é restaurado isoladamente. |

## Informações conectadas

- Férias, ficha, visão pessoal e Painel consultam a mesma conta de aquisitivos.
- A presença usada pelo quadro segue a mesma regra de datas civis; o retorno é o primeiro dia de volta ao trabalho.
- A ficha e os alertas usam o aquisitivo explícito quando ele está disponível. Não atribuem uma fração de outro aquisitivo à dívida mais antiga.
- Os alertas dos registros explícitos usam a mesma janela de 60 dias da página; gozo após o prazo também pede conferência.
- Calendário preserva eventos históricos, mas não apresenta como nova saída uma conclusão explícita com início futuro.
- Anexos continuam na coleção de documentos da pessoa. Observações e histórico de alterações continuam disponíveis.
- Cancelar preserva o lançamento e libera a reserva. Excluir exige confirmação na interface.

## Regras e limites

A referência de 30 dias não comprova o direito. Vínculo, aquisitivo e quantidade precisam ser conferidos pela pessoa responsável antes de salvar. Status, salário e verba avulsa não são usados para inferir regime de contratação.

Ao corrigir o direito, o formulário avisa quantas outras frações do mesmo aquisitivo receberão o novo valor. Datas, abono e aquisitivos de outras pessoas são preservados.

A divisão comum é validada em até três frações, com uma de pelo menos 14 dias e demais de pelo menos cinco; não é permitido reservar mais que o direito ou deixar um saldo incompatível com a próxima fração. Abono fica limitado a um terço do direito informado. Uma concessão integral de direito reduzido não é confundida com fracionamento.

O formulário lembra a conferência do pagamento até dois dias antes do gozo, do aviso, da concordância e dos feriados/descansos da escala. **Não afirma que houve pagamento nem cria obrigação financeira automática.** Antecipações e férias coletivas exigem tratamento específico; esta revisão não implementa esses fluxos.

Fontes consultadas: [CLT, arts. 130, 134, 135, 143 e 145](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm) e [explicação do TST sobre férias](https://www.tst.jus.br/en/ferias1). Não se deduz dívida trabalhista da simples ausência de lançamento.

### Histórico antigo

As duas convenções antigas para o fim do aquisitivo (aniversário ou véspera) são agrupadas em leitura, sem regravar o banco. A aplicação não distribui abono a partir de texto nem reconstitui gozos desconhecidos. Registros sem aquisitivo ou com informações conflitantes continuam sinalizados. A leitura legada de alertas para históricos inteiramente sem aquisitivo foi preservada; a regularização deve ser feita pela interface.

Não foi feita reconciliação dos recibos e direitos reais de cada funcionário nesta etapa. Não houve escrita direta em produção. Calendário, direitos e histórico demonstrados no ensaio de navegação são fictícios.

## Verificação

- Regras: reserva futura, anos distintos, saldo parcial, abono, sobreposição, edição, cancelamento, aniversário, datas impossíveis e integração com a ficha e a presença.
- Navegador isolado: a visita não grava; reserva inválida não grava; uma fração válida persiste; ficha lê o mesmo lançamento; cancelamento preserva os campos anteriores e libera os dias.
- Layout e navegação: 320, 390, 768 e 1440 px; formulário, detalhes e visão pessoal sem botões de gestão (390 e 1440 px).
- Ensaio reexecutável: `scripts/auditoria/ferias-ui.mjs`, com Playwright e prévia local; todas as chamadas externas são interceptadas. Nenhuma chamada usa dados ou escrita de produção.
