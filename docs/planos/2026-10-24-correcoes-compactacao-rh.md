# Correções da auditoria e compactação do RH

**Objetivo:** corrigir A01 a A16 da auditoria de 24/10/2026 e entregar prévia local da compactação, sem publicar código nem alterar dados produtivos.

**Autorização:** o dono pediu corrigir os 16 problemas, começando por acessos e salvamento, e mostrar a prévia antes de publicar. A auditoria anterior apresentou a abordagem e os critérios abaixo; esta etapa implementa esse desenho aprovado.

**Base:** 7607baf, acrescida apenas da reserva de vez 41bb216. React, TypeScript, Vite, IndexedDB, Supabase e Vitest. Trabalhar no ramo codex/rh-correcoes-compactacao-20261024, fora do iCloud. Preservar identidade, dados, cálculos e desenho Silk. Não editar Educação, protocolos, workflows ou senhas. Dados de testes exclusivamente fictícios.

## Entregas e verificação

### 1. Acessos, A01 e A02

Arquivos: `supabase/functions/sync/index.ts`, `supabase/functions/_shared/socioConta.ts`, `src/lib/rbac.ts`, `src/pages/PainelControle.tsx`, testes correlatos.

- [x] Reproduzir a falha do mapa societário com conta fictícia não literal; converter a prova em expectativa de recusa segura para leituras sensíveis. Coleções não dependentes continuam funcionando e ausência legítima do mapa é distinta de erro.
- [x] Distinguir lista de módulos ausente (legado), lista vazia explícita e lista preenchida. Cobrir editor, menu, URL direta e limite por papel. Não promover papel nem acrescentar permissão.
- [x] Revisar o servidor para a mesma garantia, conforme o contrato atual de módulos visíveis e máscara por coleção, sem alterar IDs.
- [x] Executar regressões e revisar compatibilidade; guardar comandos e resultados.

### 2. Salvamento, A10 a A12

Arquivos: `src/lib/armazemLocal.ts`, `src/lib/store.ts`, `src/lib/sync.ts`, indicador de persistência em `src/components/layout/app-shell.tsx`, testes correlatos.

- [x] Ensaiar encerramento antes da descarga, falha temporária de IDB e gravação posterior. Preservar recuperação durável sem prometer sucesso antes do disco; manter alterações pendentes até confirmação e não reverter versões mais novas.
- [x] Fazer a mesma leitura após reiniciar o armazenamento e demonstrar preservação, inclusive quando a transação falha.
- [x] Preservar baseVersao e a identidade adequada da operação na caixa de falhas e na retentativa. Testar 25 falhas transitórias, registro na versão 7, retentativa e conflito real.
- [x] Verificar isolamento entre contas, quotas, ausência de IDB e fila offline; sem conexão produtiva.

### 3. Formulários, A03 a A09 e A16

Arquivos: `src/pages/Vagas.tsx`, `Cargos.tsx`, `PainelControle.tsx` (somente cargo/faixas), `Ponto.tsx` (ausências), `Viagens.tsx`, `SST.tsx`, funções puras/testes conforme necessário.

- [x] Currículo: clique duplo enquanto envio está pendente cria um só candidato; retentativa após falha não duplica.
- [x] Salário: -1234,56 é recusado, não convertido em positivo. Faixas: valores negativos/não finitos e níveis invertidos são recusados; manter possibilidade explícita de faixa ainda não definida.
- [x] Ausências: -2 horas e data futura são recusadas; manter controles válidos.
- [x] Viagens: fim antes do início é recusado. Não presumir igualdade entre diárias e dias corridos.
- [x] NR: carga negativa/não finita é recusada; data futura continua recusada.
- [x] Vagas: quantidade inteira >= 1. Data de abertura local permanece no dia corrente às 22h em São Paulo.
- [x] Usar provas da auditoria como regressões com expectativa corrigida, executar falha antes e sucesso depois. Testar cancelar e entradas válidas.

### 4. Acessibilidade, A13 a A15

Arquivos: `src/components/ui/modal.tsx`, `form.tsx`, `campo-editavel.tsx` e usos de Toggle sem rótulo.

- [x] Shift+Tab a partir do próprio diálogo fica dentro do modal; Escape e retorno do foco continuam funcionando.
- [x] Toggle tem nome e estado acessíveis, foco visível e área de interação adequada. Revisar todos os usos sem label.
- [x] Campos em edição recebem rótulo e mensagens associados para input, select e data.
- [x] Executar regressões de componentes e navegar por teclado na prévia.

### 5. Compactação aprovada

Arquivos: componentes comuns de cabeçalho/indicador/filtro, `src/index.css` e páginas Treinamento, Vagas e Colaboradores.

- [x] Reduzir altura dos cabeçalhos mantendo título, busca e ação principal próximos, sem trocar a identidade Silk.
- [x] Resumir indicadores secundários, aplicar filtros ativos em chips removíveis e limpar filtros.
- [x] Adaptar Treinamentos para cartões essenciais no celular; manter acesso a nome/ID, estado e ações. Preservar tabela desktop e exportações.
- [x] Compactar Vagas e Colaboradores sem esconder operações frequentes; detalhes secundários recolhíveis. Aproveitar a densidade existente.
- [x] Conferir estados vazio, erro, filtro e edição; claro/escuro; desktop e 390 px. Não testar dados reais nem alterar métricas cuja regra está pendente.

### 6. Integração, revisão e prévia

- [x] Ler todos os diffs e conferir a lista A01-A16 contra testes e implementação. Revisão independente de acesso, durabilidade e interface.
- [x] Executar `npm run verificar` e `npm run build`; investigar qualquer falha antes de declarar sucesso.
- [x] Prévia local com dados fictícios, backend desativado e conexão externa bloqueada. Demonstrar vaga inválida recusada, cadastro válido persistido após reload, cancelamento e foco contido.
- [x] Registrar arquivos, testes, limitações e ordem futura de publicação: function antes da tela, após aprovação. Nenhum deploy nesta etapa.
- [x] Preservar ramo e prévia para revisão.
- Passagem de vez ao encerrar pelo script oficial; consultar a `origin/main:VEZ.md` para o estado atual, sem incorporar o ramo de trabalho nessa devolução.

## Critérios de aceite

Os dezesseis cenários originais devem deixar de produzir o defeito; controles válidos continuam funcionando. O salvamento não perde dados em transação temporariamente falha e não anuncia gravação durável inexistente. Restrições vazias não ampliam acesso. A interface principal é utilizável a 390 px, com rótulos, estados e foco acessíveis. Testes de backend local não são apresentados como validação da versão produtiva. Publicação depende de nova autorização.
