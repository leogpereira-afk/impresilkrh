# Auditoria financeira do RH — 09/09/2026

## Escopo e evidência

Revisão do código local, das três imagens fornecidas, dos caminhos de importação/seleção/aplicação/desfazer, agregações e nova aba Relatórios. Cenários sintéticos reproduziram falhas em helpers reais. Os resultados abaixo não medem valores incorretos em produção: não foi feita consulta ao banco ou ao ERP nesta rodada. Nenhuma correção de cadastro ou exclusão em produção foi aplicada.

A inspeção visual da nova aba usou dados fictícios em servidor local, com teste de filtro por estado. A revisão de código das demais telas não equivale a testar todas as telas com todas as permissões. Não houve validação jurídica ou contábil das taxas de provisão.

## Entregas implementadas

| Problema | Mudança | Evidência |
|---|---|---|
| Prévia dizia “Aplicar 0” com atualizações selecionadas | Contagem inclui atualizações de descrição, conta e identificação, inclusive na confirmação | `previa-folha.test.tsx` |
| Apenas vínculo disponível para título que não é RH | Decisão explícita “Não faz parte do RH”, por ID, com confirmação, persistência e desfazer | `foraRh.test.ts`, `foraRh-ui.test.tsx` |
| Decisão fora RH poderia parecer sumiço do ERP | Filtra os dois lados da conciliação; preserva pagamentos existentes | `conciliarDoRh` e teste de IDs legados |
| Título em aberto/cancelado entrava em resumos pagos | Régua de status aplicada à ficha, resumo mensal, série e composição por pessoa | `provisaoEquipe.test.ts`, `custosResumo.test.ts`, `recebimentos-status.test.ts` |
| “NÃO PAGO” podia ser aceito por conter “PAGO” | Negação e cancelamento prevalecem | `mubiPagamentos.test.ts` |
| CPF válido era ignorado com origem vazia | Resolve identidade pelo CPF independentemente do nome | `mubiPagamentos.test.ts` |
| Mudança apenas de data de baixa não aparecia | Campo de baixa entra no diff, seleção, visualização e aplicação/desfazer | `baixaPagamento.test.ts` |
| Prévia em reais ignorava mudança de aberto para pago | Totais usam a mesma classificação dos recebimentos; mudança de estado fica em grupo visível e respeita seleção | `previaFolha.test.ts` |
| Estado legado não era atualizado na conciliação | Preenchimento do estado recebido entra como alteração revisável | `previaFolha.test.ts` |
| Média por pessoa ignorava alternância pago/estimado | Média segue o total selecionado; indicadores restantes nomeiam sua base | `total-equipe.tsx` |

### Nova aba Relatórios em Custos

- Janelas de 1, 3, 6 e 12 meses terminando na competência da página.
- Filtro por área atual, com ressalva sobre transferências históricas.
- Pago à equipe separado de FGTS/INSS lançados e de valores em aberto.
- Legado sem estado declarado explicitamente; cancelados e estados desconhecidos não viram pagos.
- Evolução mensal, composição por verba, distribuição por área e comparação entre meses consecutivos.
- Decomposição da variação por verba e maiores valores pagos por pessoa, com acesso à ficha.
- Meses sem registros identificados como ausência de dados.
- Detalhes por pessoa, busca, filtros por verba/estado e paginação.
- Exportação CSV das mesmas linhas filtradas, com competência, vencimento e baixa em colunas distintas.
- Link para os relatórios gerais já existentes e para Sincronização.
- Sócios e verbas societárias fora da equipe; não soma plano de contas com pagamentos nem reservas, evitando misturar bases.

## Pendências prioritárias — não resolvidas por esta entrega

### P1 — Reservas podem parecer completas quando faltam salários

`reservaEncargos.ts` conta pessoas com base e a existência de algum salário no mês. Cenário reproduzido: dez adiantamentos e um único saldo salarial podem classificar o mês como folha. Próxima melhoria: fechamento por pessoa com exceções explícitas e cobertura de pagamentos. Não basta elevar um percentual global.

### P1 — Atualização de CPF é efeito separado da seleção financeira

`Custos.tsx` aplica `cpfsAprendidos` da busca, enquanto a seleção controla o diff de pagamentos. Recusar um pagamento não necessariamente recusa preencher o CPF identificado durante a busca. Próxima melhoria: confirmação específica por cadastro e proveniência por título, com histórico e desfazer próprios. A nova opção fora RH filtra títulos antes de aprender CPF, mas isso não resolve toda a seleção de CPF.

### P2 — Quadro operacional não equivale à população de provisão

Freelancers devem contar no quadro conforme decisão do Léo. Não se deve removê-los do headcount para melhorar a cobertura de uma reserva. Cadastro precisa distinguir participação operacional e elegibilidade de provisão por período, sem deduzir contrato por verba. Status atual também não prova vínculo histórico.

### P2 — Composição de encargos exige conciliação própria

A fórmula recompõe FGTS, mas INSS lançado não integra o estimado da mesma forma. FGTS estimado mais FGTS lançado pode duplicar a mesma base se o lançado for mensal em vez de rescisório. Próxima melhoria: natureza do encargo, competência de referência e separação entre despesa efetiva, retenção e reserva. A aba nova mostra encargos lançados separadamente; não apresenta estimado como custo patronal completo.

### P2 — Plano sem contas individuais pode gerar cards de zero

Os cards globais devem reutilizar `semIndividual`: exibir “individual indisponível” e “total parcial” quando só há rateio, como a série histórica já faz. Não interpretar ausência do plano como economia.

## Próximas melhorias de gestão

| Pergunta | Informação necessária | Proposta |
|---|---|---|
| Quanto saiu do caixa neste mês? | `pagoEm` confiável, cobertura de legado | Relatório de caixa separado do de competência; listar datas ausentes |
| Por que a folha mudou? | Mês fechado, mesma população, verbas comparáveis | Decomposição por verba entregue; evoluir para distinguir por pessoa, admissão, desligamento e eventos pontuais |
| Quanto reservar? | Elegibilidade e fechamento por pessoa | Reserva com cobertura, intervalo e aprovação de premissas |
| O que explica horas extras? | Vínculo entre ponto aprovado e lançamento | Exceções ponto × folha com ação na linha |
| Viagem foi paga duas vezes? | ID da viagem ligado ao pagamento do ERP | Conciliação de diárias, reembolsos e títulos, sem somar fontes redundantes |
| A importação está confiável? | Busca completa, títulos tratados, última leitura | Cobertura por competência e fila: vincular / fora RH / conferir conta / pendente |

## Limitações de interpretação

“Em aberto registrado” não é toda a dívida do ERP: a importação prioriza pagos e o histórico local pode conter somente parte dos títulos abertos. “Pessoas com recebimento” não é headcount. Distribuição por área usa o cadastro atual. Os títulos marcados fora RH permanecem no histórico se já foram gravados; a decisão impede importação e pendência futura, não apaga despesa retroativamente.

## Verificação final

`npm run verificar` concluído: lint, TypeScript, 92 arquivos de teste com 1.465 testes aprovados, conferência de IDs sem inconsistências. `npm run build` concluído. Inspeção visual local com dados fictícios e teste de filtro por estado. Não houve publicação, consulta ao banco/ERP nem alteração de produção.
