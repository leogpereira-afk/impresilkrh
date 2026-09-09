# Auditoria do RH — 09/09/2026

## Escopo e conclusão

Auditoria do código local, concentrada em Relatórios, Painel, Colaboradores, Férias, Ponto, Viagens, Integração, permissões e sincronização. Foram mapeadas as 31 páginas existentes e suas rotas/coleções. A revisão funcional foi ampliada aos 14 módulos inicialmente triados. Isso **não equivale a leitura integral de todas as páginas**: os fluxos e trechos efetivamente lidos estão discriminados abaixo, sem aprovação de caminhos não exercitados.

Os problemas prioritários estão nas fronteiras entre módulos: permissões de tela não aplicadas pelo servidor; cache que não acompanha mudança de equipe; reenvio de coleção capaz de sobrescrever versões mais novas; associação de ponto por nome; critérios divergentes para pagamentos e férias. Há também ações disponíveis na interface que o servidor recusa.

**Escopo desta revisão:** não alterei código, configuração, dados locais do aplicativo ou produção, nem criei agentes. As simulações usaram dados fictícios em memória, sem chamadas de rede. Minha única escrita foi este documento. **Entrega coletiva:** a equipe implementou correções de código em paralelo; elas não foram aplicadas por esta revisão documental. Não houve alteração de produção nesta auditoria; código implementado não significa implantação confirmada.

**Vínculo contratual:** esta auditoria não classifica ninguém como CLT, prestador ou freelancer a partir do status, nome, salário ou rubrica “Freelancer (Empreita)”. Regras contratuais exigem informação explícita e confirmada. As observações sobre férias são sobre a implementação; não constituem validação jurídica de direitos individuais.

## Base e confiabilidade

- Referência Git observada: `ee8f5daf922848bff3862ac871015c87a655eb49`.
- O checkout estava sem alterações na primeira consulta e recebeu alterações externas durante a auditoria, principalmente em Custos, tipos e testes financeiros. A coordenação da auditoria confirmou trabalho paralelo de outro agente financeiro. Na extensão da revisão, também havia alterações externas em Painel, Colaboradores e ColaboradorFicha; os achados anteriores nesses arquivos não foram novamente reproduzidos após essas alterações.
- As referências de linha correspondem às leituras desta sessão. Os trechos centrais fora de Custos foram reconferidos; arquivos em alteração paralela podem ter linhas deslocadas.
- “Confirmado em simulação” significa execução do código local com dependências falsas em memória, não reprodução em produção.
- “Confirmado por leitura” significa fluxo demonstrável no código, sem execução da interface.
- “Relatado pelo agente financeiro” significa informação recebida da coordenação da auditoria, ainda não validada independentemente nesta auditoria.
- Não foram apurados quantidade de pessoas afetadas, valores reais, migrações aplicadas ou versão efetivamente publicada.

## Achados P1 — corrigir primeiro

### A01. Restrição por módulo não é autorização no servidor

**Evidência:** `src/components/layout/app-shell.tsx:278-284`; `src/lib/rbac.ts:102-111`; `supabase/functions/sync/index.ts:294-336`.

**Cenário:** gestor cadastrado com `permissoes: ["painel"]` consulta ou envia registros de Ponto da própria equipe diretamente ao sync. O servidor verifica perfil/equipe, mas não os módulos liberados. A simulação retornou 200 tanto na leitura quanto no envio de Ponto.

**Impacto:** restringir o módulo na tela não restringe seus dados e operações. Além disso, `permissoes: []` é interpretado no cliente como acesso sem restrição adicional, embora a tela possa apresentar zero módulos.

**Ação:** definir autorização por operação e coleção no servidor, derivada do cadastro de acesso; tornar distintos “nenhum módulo”, “todos” e “cadastro ausente”. Testar perfil × módulo × equipe × operação. Não basta esconder menu.

**Estado:** confirmado em simulação; aberto.

### A02. Mudança de gestor não invalida o cache das coleções dependentes

**Evidência:** `src/lib/sync.ts:306-317,350-364`; `src/lib/armazenamentoUsuario.ts:4-10`; `supabase/functions/sync/index.ts:362-372`; `supabase/migrations/202609060001_integridade_rh.sql:30-40`.

**Cenário:** pessoa muda de gestor em `colaboradores`. O servidor passa a calcular outra equipe, mas a revisão das coleções de férias, documentos e ponto não muda. O cliente baixa apenas as coleções cujo contador aumentou; seu contexto é pessoa+perfil, sem revisão da equipe.

**Impacto:** o gestor anterior pode conservar dados anteriormente autorizados no armazenamento local; o novo pode não receber registros históricos da equipe até um download integral. Não se trata de o servidor continuar autorizando novas leituras: o problema está no cache não reavaliado.

**Ação:** incluir uma revisão de autorização/hierarquia e invalidar todas as coleções dependentes quando ela mudar. Remover também dados que deixaram de pertencer ao escopo.

**Estado:** confirmado por leitura; concorrência entre navegadores não executada.

### A03. Reenvio de coleção usa revisão nova com conteúdo local antigo

**Evidência:** `src/lib/sync.ts:440-469`; `supabase/migrations/202609060001_integridade_rh.sql:108-120`.

**Cenário:** um aparelho tem a coleção antiga; outro corrige um registro. `enviarColecao` obtém a revisão global atual, mas envia a coleção inteira de `obterDinamico(nome)`. Em conflito, obtém outra revisão e repete o mesmo retrato. A função SQL faz upsert de todos os itens sem conferir a versão individual de cada um.

**Impacto:** a revisão protege o intervalo após a consulta, mas não garante que o conteúdo enviado foi baseado nela. Uma importação/reenvio pode desfazer correções de outro aparelho em registros que o usuário nem pretendia alterar.

**Ação:** enviar somente as mutações aprovadas com suas versões-base; reservar substituição integral para restauração explicitamente revisada. Em conflito, comparar conteúdo e exigir nova decisão, sem apenas renovar o número da revisão.

**Estado:** confirmado por leitura; transação real não executada.

### A04. Ponto pode vincular ou remover a ficha de um homônimo

**Evidência:** `src/lib/pontoImport.ts:178-197`; `src/pages/Ponto.tsx:394-401`; contraste com a regra de identidade em `src/lib/identidade.ts:16-28`.

**Cenário:** o importador escolhe o cadastro cujos tokens aparecem no cabeçalho, usando `includes` e quantidade de tokens, sem recusar empate. Depois, ao importar B, considera uma ficha de A duplicada se o nome do PDF for igual, mesmo com `colaboradorId` diferente.

**Impacto:** horas/faltas podem ser atribuídas à pessoa errada e uma ficha válida pode receber exclusão. A condição de remoção foi reproduzida com IDs A/B diferentes e mesmo nome.

**Ação:** usar identificador estável do sistema de ponto ou vínculo explicitamente confirmado; nomes apenas sugerem candidatos. IDs distintos nunca devem ser deduplicados automaticamente por nome. Prévia deve mostrar exatamente os registros a substituir/remover.

**Estado:** condição de remoção reproduzida; extração de PDF real não executada.

### A05. Pago corrigido em Painel, Colaboradores e ficha; societário separado

**Evidência:** `src/pages/Painel.tsx:199-204,920-921`; `src/pages/Colaboradores.tsx:137-147`; `src/pages/ColaboradorFicha.tsx:1055-1057`; `src/lib/folha.ts:73`. Relatórios já aplica filtros diferentes em `src/pages/Relatorios.tsx:196-214`.

**Cenário original:** pagamento possui `statusErp` aberto ou cancelado. Na leitura inicial, as três primeiras telas retiravam FGTS/INSS, mas ainda somavam o valor. Relatórios excluía cancelados e separava aberto de caixa. As referências acima documentam o diagnóstico anterior à correção coletiva; não descrevem necessariamente as linhas atuais.

**Impacto original:** a mesma pessoa/competência apresentava totais diferentes; “pago”, “recebido” e demonstrativos podiam incluir dinheiro não pago. **Ponto separado a revisar:** na leitura inicial, o Painel não aplicava a exclusão de sócios usada em Relatórios, relevante para sessão master. Não foi reconferido após a correção; não se afirma persistência atual nem resolução desse recorte.

**Ação:** centralizar classificação de pago, aberto, cancelado, encargo e societário; aplicar em cards, tabelas, detalhamento e exportações. Separar competência de data efetiva de pagamento.

**Estado do pago: corrigido na entrega coletiva.** Implementação do Locke, revisada pela coordenação da auditoria, com quatro testes que executam os seletores reais em `src/pages/recebimentos-status.test.ts`. Esta confirmação foi recebida da coordenação; não executei novamente esses testes nem revisei o patch final nesta extensão documental. **Societário:** revisão separada pendente de confirmação, sem bloquear o reconhecimento da correção do pago.

### A06. Agendamento de férias não reserva corretamente saldo e frações do aquisitivo

**Evidência:** `src/pages/Ferias.tsx:363-399`; `src/lib/feriasAgenda.ts:93-96,139-165`; `src/lib/clt.ts:121-134,256-260`.

**Cenário:** a tela passa apenas `diasGozados` para a validação do saldo, deixando os dias futuros já agendados fora da conta. Em sentido oposto, passa todas as férias históricas da pessoa para contar frações, sem recortar o aquisitivo.

**Impacto:** agendamentos futuros podem ultrapassar o saldo do período; três registros antigos podem bloquear a primeira fração de um aquisitivo novo. Simulações confirmaram que 20 dias futuros + 20 novos passam na validação fornecida e que três frações históricas bloqueiam novo fracionamento.

**Ação:** selecionar explicitamente o aquisitivo, contabilizar gozos, reservas futuras e abonos dele; conferir sobreposição contra todos os períodos. Persistir abono em campo estruturado, pois hoje ele entra apenas em observação e no saldo do registro recém-criado.

**Estado:** confirmado em simulação e leitura; aberto.

### A07. Abrir Integração escreve tarefas e carimbos sem ação explícita

**Evidência:** `src/pages/Integracao.tsx:209-258`.

**Cenário:** ao montar a página, um `useEffect` cria documentos padrão para onboardings sem carimbo e atualiza `docsRhSemeadosEm` no colaborador. Mesmo a presença de documentos antigos pode provocar escrita do carimbo.

**Impacto:** uma visita para consulta pode alterar dados e gerar sincronização. Para gestor, tarefas e cadastro têm permissões distintas, permitindo resultado parcial. Foi por isso que a auditoria não abriu o aplicativo conectado para navegar pelas páginas.

**Ação:** transformar a inclusão dos documentos em ação explícita, com prévia e confirmação; aplicar tarefas e carimbo em operação consistente e autorizada.

**Estado:** confirmado por leitura; efeito não executado.

## Achados P2 — consistência e operações incompletas

### A08. Interface oferece alterações que o servidor recusa

**Evidência:** `src/pages/Integracao.tsx:829-835,872-883`; `src/pages/MeuPerfil.tsx:104-109`; `src/pages/Calendario.tsx:100,319,562-574`; `supabase/functions/sync/index.ts:320-333`.

**Cenário:** gestor define padrinho/arquiva integração ou cria evento; colaborador altera a própria foto. As ações gravam `colaboradores`/`eventos`, classificados como `todos` na leitura, porém restritos ao RH na escrita.

**Impacto:** interface confirma mudança local e a nuvem responde 403. No padrinho, a tarefa pode ser concluída enquanto o vínculo não persiste. Simulações confirmaram as recusas de cadastro, evento e foto no cadastro.

**Ação:** alinhar controles às capacidades reais; criar operações específicas e restritas por campo para foto/padrinho/arquivamento quando autorizadas. Não liberar escrita geral de cadastro para resolver isso. Distinguir “salvo no aparelho” de “confirmado na nuvem”.

**Estado:** confirmado em simulação; aberto.

### A09. Desenvolvimento e ciência de PDI ficam vazios no autoatendimento

**Evidência:** `supabase/functions/sync/index.ts:120-122,296-298`; `src/pages/MeuPerfil.tsx:335-345`; `src/pages/Painel.tsx:905-915`; `src/pages/Aceites.tsx:143-159`.

**Cenário:** colaborador possui avaliação/PDI, mas as coleções não estão entre as exceções de leitura própria. A simulação devolveu lista vazia para ambos.

**Impacto:** telas informam ausência de desenvolvimento e não oferecem o PDI para ciência, apesar de os registros existirem.

**Ação:** definir versão publicável da avaliação/PDI e liberar exclusivamente a leitura própria dessa versão. Preservar notas internas e registros ainda não compartilhados.

**Estado:** confirmado em simulação; aberto.

### A10. Turnover histórico depende do quadro de hoje

**Evidência:** `src/pages/Relatorios.tsx:163-176`; `src/pages/Painel.tsx:126-132`.

**Cenário:** selecionar janeiro de um ano anterior em Relatórios calcula o quadro inicial a partir de `ativos.length` de hoje, mais saídas e menos entradas apenas daquele janeiro. Admissões/saídas posteriores ao período não são desfeitas. Entradas/saídas também não aplicam necessariamente a mesma exclusão de Direção do denominador.

**Impacto:** indicador histórico muda quando o quadro atual muda, sem qualquer alteração no mês analisado. Exemplo ilustrativo: 2 saídas num período de 10 pessoas passam a ser divididas por um quadro próximo de 30 se a empresa cresceu depois.

**Ação:** reconstruir início/fim do período com admissões, desligamentos e histórico de vínculos; aplicar a mesma população no numerador e denominador. Explicitar fórmula e tratamento de readmissões/dados ausentes.

**Estado:** confirmado por leitura; valores reais não calculados.

### A11. Quadro, presença e disponibilidade usam critérios diferentes

**Evidência:** `src/lib/dominio.ts:56-88,126`; `src/lib/quadroPorSituacao.ts:85-119`; `src/pages/Integracao.tsx:864-869`.

**Cenário:** Colaboradores conta `noQuadro` sem Direção; Painel/Relatórios usam `contaComoAtivo`; candidatos a padrinho usam lista fixa `ativo/experiencia`. Status novo ou sem cadastro pode entrar num total e sumir de outro. `trabalhandoHoje` não recebe férias nem a configuração `ausenteHoje`.

**Impacto:** números não são comparáveis sem definição e a escolha de padrinho pode excluir quem está disponível ou incluir quem está de férias. Nenhuma dessas réguas identifica regime contratual.

**Ação:** definir separadamente “na empresa”, “conta no indicador” e “disponível para esta atividade”; compartilhar os predicados pertinentes e mostrar exclusões/pendências de cadastro. A disponibilidade deve considerar férias e ausências configuradas.

**Estado:** confirmado por leitura; impacto sobre o cadastro real não medido.

### A12. Ponto histórico muda com afastamento atual

**Evidência:** `src/pages/Ponto.tsx:418-440`.

**Cenário:** pessoa trabalhou em julho e foi afastada em setembro. Ao consultar julho, `naoBate` usa o `statusId` atual e retira o ponto inteiro dos totais. Alterar `naoBatePonto` tem efeito semelhante sobre meses antigos.

**Impacto:** horas extras e faltas históricas desaparecem do relatório sem mudança no ponto daquele mês.

**Ação:** usar vigência da dispensa/afastamento no período consultado e recorte por dia quando necessário; manter fechamento histórico reproduzível.

**Estado:** confirmado por leitura; aberto.

### A13. Há conclusões contratuais sem vínculo explícito

**Evidência:** `src/pages/Colaboradores.tsx:188-193`; `src/lib/clt.ts:99-114,317-337`; `src/pages/Ferias.tsx:141-145`; `src/data/types.ts:82-195`.

**Cenário:** cadastro recente, com admissão e sem decisão de experiência, recebe situação de experiência apenas pelas datas. A consulta não exige contrato de experiência confirmado. Férias também parte da admissão do quadro, sem uma classificação contratual explícita nesse fluxo.

**Impacto:** o sistema apresenta como fato uma condição contratual que os campos consultados não demonstram. Isso não permite concluir que qualquer pessoa específica esteja classificada incorretamente.

**Ação:** registrar vínculo e vigências explicitamente, com “não informado”; registrar contrato de experiência e seus marcos quando aplicável. Exibir “confirmar vínculo/contrato” onde faltar evidência. Nunca usar status ou verba Freelancer como substituto.

**Estado:** confirmado por leitura do fluxo; vínculos reais não auditados.

### A14. Datas possuem três fontes de erro independentes

**Evidência:** `src/data/_gen.ts:63`; `src/lib/clt.ts:113-114,140`; `src/pages/Viagens.tsx:20-23`.

**Cenários e impactos:**

- `HOJE` é criado uma vez ao carregar o módulo; aba aberta durante a virada do dia mantém prazos e contagens de ontem.
- O motor calcula meses por `floor(dias / 30.44)`. Com admissão em 09/09/2025, em 09/09/2026 a simulação retornou `null`, pois 365 dias ainda viram 11 meses na fórmula.
- `new Date("2026-09-01")` em São Paulo vira 31/08 às 21h; viagem importada no primeiro dia pode cair no mês anterior.

**Ação:** relógio de referência reativo por dia; aniversários calculados por calendário; parser de data civil compartilhado em Viagens. Testar primeiro dia, aniversário, ano bissexto e aba aberta na virada.

**Estado:** aniversário e fuso reproduzidos; virada de aba confirmada por leitura.

### A15. Avaliação e saldo de férias do Painel pessoal podem mostrar histórico antigo

**Evidência:** `src/pages/Painel.tsx:911-915`; `src/pages/MeuPerfil.tsx:335-345`; `src/pages/ColaboradorFicha.tsx:1872`; `src/lib/ciclo.ts:6-11`.

**Cenário:** a tela usa o nome do ciclo vigente, porém pega a primeira avaliação de gestor sem filtrar ciclo. O Painel pessoal usa o maior `saldoDias` de toda a vida, inclusive registros antigos, e escolhe férias por status textual.

**Impacto:** nota de outro ciclo aparece sob o ciclo atual; férias antigas podem manter saldo ou situação incorretos. A falha de leitura do A09 atualmente pode mascarar parte desses problemas para colaboradores.

**Ação:** compartilhar seleção do ciclo por ID, ordenar explicitamente e calcular saldo por aquisitivo. Reutilizar contagem por datas para férias em curso.

**Estado:** confirmado por leitura; aberto.

### A16. Configuração perde alterações concorrentes dentro do mesmo mapa e pode falhar sem sinalizar

**Evidência:** `src/pages/Ponto.tsx:325-336`; `src/lib/sync.ts:643-667,89-98`; `supabase/migrations/202609070002_mesclar_config.sql:12-15`.

**Cenário:** dois aparelhos alteram entradas diferentes de `vinculosPonto`. Cada um envia o mapa completo como valor da chave; o merge JSON é apenas no primeiro nível, e o segundo mapa substitui o primeiro. Além disso, falha em `setCfg` é capturada sem atualizar o estado de erro do sync; chaves sujas não entram na contagem normal de pendências.

**Impacto:** vínculos aprendidos podem desaparecer; indicador pode parecer em dia com configuração ainda não confirmada. Para gestor, o envio ainda encontra a restrição de `setCfg` a RH.

**Ação:** atualizar mapas por entrada com versão-base, definir quem pode salvar vínculos e incluir configuração pendente/falha no estado visível da sincronização.

**Estado:** confirmado por leitura; concorrência real não executada.

### A17. Viagens aceita dados incompatíveis e importação repetida

**Evidência:** `src/pages/Viagens.tsx:173-204,244-264`.

**Cenário:** importação resolve nome com `Map`, escolhendo um homônimo sem revisão; cada importação cria novos registros, sem identidade da origem. No formulário, início/fim não são comparados e `dias` aceita fração ou valor incoerente com o intervalo.

**Impacto:** repetição do arquivo pode duplicar gastos; datas invertidas e quantidades incorretas entram no total. Isso é independente do erro de fuso do A14.

**Ação:** prévia por linha, vínculo confirmado por ID, chave estável de origem e comparação de repetidos; validar datas e quantidade, permitindo exceções apenas quando explicitamente justificadas.

**Estado:** confirmado por leitura; importação não executada.

## Complemento funcional dos 14 módulos — achados adicionais

Todos os achados A18–A29 foram **confirmados por leitura do código local**, sem execução de interface, chamadas de rede ou escrita em produção. Os cenários são condições reproduzíveis a validar em ambiente isolado, não afirmações de incidentes ocorridos. P1 indica prioridade de autorização/acesso; P2 indica integridade funcional ou informação operacional incorreta.

### A18. P1 — Candidatura interna permite gravar campos de decisão do RH

**Evidência:** `supabase/functions/sync/index.ts:293,320-329`; `src/pages/MuralVagas.tsx:49-67`.

**Cenário:** a autorização de escrita de candidatos exige apenas o próprio `colaboradorId` e origem `Interno`. Não restringe os campos editáveis nem valida vaga aberta. Um colaborador pode enviar sua candidatura com etapa `Contratado`, em vez de se limitar à inscrição e à motivação oferecidas no Mural.

**Impacto:** o servidor aceita uma decisão de recrutamento produzida pelo candidato. Isso não equivale a promoção efetiva ou alteração salarial, mas compromete a integridade da seleção.

**Ação:** separar inscrição, atualização da motivação e decisão do RH; validar campos e transições no servidor, confirmar vaga disponível e impedir duplicidade pessoa/vaga. Testar tentativa de mudar etapa, nota e vaga com perfil colaborador.

### A19. P1 — Saída pode ficar concluída no cadastro com acesso ainda ativo

**Evidência:** `src/pages/Organograma.tsx:325-342`; `supabase/functions/sync/index.ts:44-55`.

**Cenário:** a saída atualiza cadastro e conta local antes de chamar a revogação remota. Se essa chamada falhar, há aviso de erro, mas não uma pendência durável de revogação nesse fluxo. A tentativa só ocorre quando existe uma conta local marcada ativa. O sync verifica `perfis.ativo`, não o status do colaborador.

**Impacto:** cadastro inativo não prova acesso revogado. A interface alerta a falha, porém a recuperação depende de ação manual no Painel de Controle; inconsistência entre conta local e perfil remoto também pode impedir a tentativa.

**Ação:** acompanhar a saída com estado persistente de revogação pendente/concluída, tentativa idempotente por identidade e confirmação remota. Testar queda de rede e conta local já inativa com perfil remoto ativo. O encerramento nos demais sistemas não foi verificado.

### A20. P2 — Exclusão de cargo confunde ocupação atual com ausência de referências

**Evidência:** `src/pages/Cargos.tsx:81-89,294-302`.

**Cenário:** a proteção de exclusão usa a ocupação que exclui Direção e pessoas fora do quadro. Cargo referenciado somente por ex-colaborador ou por vaga fica com zero ocupantes e passa por essa proteção.

**Impacto:** a tela pode solicitar exclusão de estrutura ainda necessária para ficha histórica e recrutamento. Não foi validada eventual proteção adicional do banco implantado.

**Ação:** distinguir contagem de ocupantes de inventário de dependências; preferir arquivamento do cargo referenciado, preservando nomes históricos. Validar dependências também no servidor.

### A21. P2 — Mural apresenta contagem parcial e perde acompanhamento de vaga encerrada

**Evidência:** `src/pages/MuralVagas.tsx:38-47`; `supabase/functions/sync/index.ts:293`.

**Cenário:** o Mural calcula inscritos sobre `candidatos`, mas para colaborador o servidor só entrega sua própria candidatura interna. O número não representa todos os inscritos. Quando a vaga deixa Aberta/Em triagem, sai da lista que contém o acompanhamento da candidatura.

**Impacto:** contagem varia por perfil e pode indicar nenhum concorrente apesar de haver outros; a pessoa deixa de acompanhar ali o resultado de vaga fechada.

**Ação:** fornecer agregado autorizado, sem expor candidatos, ou rotular apenas a própria inscrição; manter seção de minhas candidaturas, inclusive encerradas.

### A22. P2 — Abrir documento também dispara envio à nuvem

**Evidência:** `src/pages/Documentos.tsx:258-272,312-318`.

**Cenário:** ao abrir arquivo presente no armazenamento local e ainda sem marca de nuvem, `resolver` chama envio remoto e depois altera `arquivoNaNuvem`.

**Impacto:** uma ação percebida como consulta pode transmitir um arquivo e alterar metadados. Este é outro motivo para não usar navegação autenticada durante a auditoria somente leitura, além de Integração (A07).

**Ação:** expor explicitamente envio pendente e sua confirmação, ou oferecer modo de consulta que não acione essa recuperação. Separar resolução para leitura da operação de sincronização.

### A23. P2 — Metadados de anexo podem anunciar conteúdo que não foi preservado

**Evidência:** `src/pages/Documentos.tsx:280-289`; `src/pages/Vagas.tsx:400-406`.

**Cenário:** Documentos atualiza metadados antes de confirmar a gravação do novo blob; se ela falha, pode ficar nome novo com conteúdo antigo. Vagas ignora o resultado da gravação local do CV e marca `curriculoArquivo: true` mesmo quando o envio remoto falha. A orientação de reabrir e salvar depende de fornecer `arquivo` novamente, pois o envio está dentro dessa condição.

**Impacto:** anexo pode estar indisponível em outro aparelho ou não existir em nenhuma das duas camadas, apesar da marca de presença. Os avisos de erro não restauram consistência dos metadados.

**Ação:** confirmar conteúdo antes de promover a versão dos metadados; preservar versão anterior na falha; registrar estados local/pendente/remoto e uma retomada real por arquivo. Testar falha local, remota e simultânea.

### A24. P2 — Feedback não considera PDI aberto e pode reabrir preparação de outro autor

**Evidência:** `src/pages/Feedback.tsx:101-109,130-139,295-316`; `supabase/functions/sync/index.ts:324`.

**Cenário:** a cadência recebe `comPlanoAberto: false` fixo, embora a regra descreva 45 dias para plano aberto. Separadamente, a preparação é escolhida por pessoa, sem autor: após troca de gestor, a preparação recebida pode pertencer ao gestor anterior; a tela tenta atualizá-la preservando esse autor, enquanto o servidor exige autoria do gestor atual.

**Impacto:** fila deixa de antecipar conversas por PDI; uma preparação/combinado pode parecer salvo localmente e ser recusado na sincronização por autoria.

**Ação:** alimentar a cadência com PDI vigente; distinguir preparação própria de histórico compartilhado. Definir transferência explícita ou criação de nova preparação na troca de gestor, sem reescrever a autoria original.

### A25. P2 — Ação de renovar NR sobrescreve certificado anterior

**Evidência:** `src/pages/SST.tsx:703-709,741-750,777-782,790-801`.

**Cenário:** o pedido `renovarNr` abre edição do certificado existente. Ao salvar, `editId` leva a `atualizar`, substituindo treinamento e validade anteriores, embora a organização dos certificados vigentes pressuponha preservação do histórico.

**Impacto:** a coleção deixa de conservar a certificação anterior como registro próprio, dificultando demonstrar qual curso sustentava a validade em data passada. Não foi investigada recuperação por logs ou backups.

**Ação:** separar corrigir cadastro de renovar: renovação cria novo registro vinculado ao anterior; correção mantém trilha. Testar que os dois certificados continuam consultáveis e só o novo compõe a validade atual.

### A26. P2 — SST trata validade desconhecida como válida e filtra outra população que o card

**Evidência:** `src/pages/SST.tsx:36-41,708-721`.

**Cenário:** vencimento ausente/inválido resulta em `NaN` e retorna `Válido`. Os cards de NR usam apenas certificados vigentes, mas clicar em situação filtra todos os certificados, incluindo substituídos.

**Impacto:** dado incompleto recebe aparência de regularidade; card e lista podem divergir mesmo sem alteração dos registros.

**Ação:** distinguir validade desconhecida de documento explicitamente sem vencimento; usar a mesma população do card no detalhamento e oferecer histórico em filtro separado. Trata-se de semântica de dados, sem conclusão jurídica sobre cada certificado.

### A27. P2 — Ciclo entre gestores ocultos pode travar Organograma

**Evidência:** `src/pages/Organograma.tsx:244-254`.

**Cenário:** com “só ativos”, pessoa visível aponta para gestor oculto A, que aponta para B oculto, que volta a A. O `while` que sobe na cadeia não mantém conjunto de visitados e não termina.

**Impacto:** uma hierarquia inconsistente recebida de importação ou outro fluxo pode congelar a renderização. Não foi encontrado nem produzido esse ciclo em dados reais; proteções do editor não tornam a leitura tolerante a dados já inconsistentes.

**Ação:** detectar repetição de ID durante a subida, interromper com indicação de inconsistência e validar ciclos em toda escrita de hierarquia.

### A28. P2 — Contratação interna registra promoção sem atualizar posição efetiva

**Evidência:** `src/pages/Vagas.tsx:375-396`.

**Cenário:** mudar candidato interno para Contratado cria movimentação de tipo Promoção com cargo novo, mas esse handler não altera cargo, área ou nível do cadastro.

**Impacto:** histórico passa a registrar promoção enquanto Cargos, Carreira e Organograma continuam refletindo a posição anterior. Isso pode representar aprovação ainda não efetivada, mas não há distinção nessa movimentação.

**Ação:** separar aprovação da candidatura de efetivação, com data e revisão da mudança cadastral. Só registrar promoção efetiva quando a alteração correspondente estiver confirmada; não deduzir salário ou vínculo contratual da vaga.

### A29. P2 — Carreira conta pessoa sem nível que desaparece no detalhamento

**Evidência:** `src/pages/Carreira.tsx:500,561-562,587-603`.

**Cenário:** o grupo de cargo contém pessoa cujo nível não consta em `d.niveis`. O cabeçalho conta essa pessoa, mas as linhas expandidas são construídas apenas para níveis cadastrados.

**Impacto:** o total do cargo não se explica pela lista aberta, ocultando justamente o cadastro que precisa de correção.

**Ação:** incluir grupo “nível não informado/inválido”, com acesso à ficha, e manter total e detalhamento derivados do mesmo conjunto de pessoas.

## Conexões que exigem decisão de produto/permissão

- **Viagens:** a página é um painel embutido em Custos (`src/pages/Custos.tsx`, import e uso de `ViagensPainel`); não há rota própria em `src/App.tsx`. Embora o componente e o servidor admitam gestor, Custos é restrito ao RH. Decidir se gestor realmente deve ter acesso e, se sim, dar entrada compatível com esse perfil.
- **Agendamentos de mensagens:** `agendamentos` é gestão, mas não integra o conjunto de coleções pessoais limitado à equipe (`supabase/functions/sync/index.ts:128,235,298,333`). `src/pages/Mensagens.tsx:678-683` lista toda a coleção recebida. A simulação mostrou agendamento global na resposta ao gestor. Decidir se a fila é global; se não, adicionar proprietário/escopo e restringir leitura/escrita.
- **Pesquisas:** `src/pages/Desempenho.tsx:1742-1757` habilita gestão de pesquisas para gestor; `pesquisas` e `respostasPesquisa` são RH no servidor. Harmonizar as capacidades antes de oferecer criação/resposta ao gestor.
- **Folha Variável:** possui coleções próprias (`lancamentos`/`fechamentos`). O comentário em `src/pages/FolhaVariavel.tsx:119-121` esclarece que não soma ao custo até retornar como pagamento do ERP; outros textos prometem “vai no 1º pagamento”. Não foi encontrada nem demonstrada, nesta revisão, uma execução automática dessa promessa. Diferenciar aprovação para exportação de pagamento efetivamente realizado e conciliar a origem quando o ERP retornar.

## Consolidação com o agente financeiro

Informações recebidas da coordenação da auditoria no encerramento. Não são novas reproduções desta auditoria.

| Item informado | Prioridade | Estado comunicado | Ação restante |
| --- | --- | --- | --- |
| Aberto somado ao pago nos consumidores A05 | P1 original | Corrigido pelo Locke e revisado pela coordenação; quatro testes dos seletores reais | Não reabrir pago como pendente; confirmar separadamente o recorte societário e cobertura de consumidores/exportações além dos três corrigidos |
| CPF / nome vazio | P1 | Em correção pelo outro agente | Confirmar a descrição exata do defeito e validar associação/identificação no fluxo corrigido; não ampliar diagnóstico por suposição |
| `pagoEm` não concilia | P1 | Correção não confirmada | Confrontar data efetiva, competência, pagamentos parciais e comprovantes com a origem ERP |
| Reserva considera folha completa com 10 adiantamentos + 1 salário | P1 | Coordenação da auditoria informa que este item não está em correção | Completude por pessoa e competência; uma rubrica presente no mês não prova fechamento de toda a equipe |
| CPFs aprendidos independentemente da seleção | P1 | Coordenação da auditoria informa que este item não está em correção | A aprendizagem precisa respeitar exatamente as linhas aprovadas; rejeitadas/desmarcadas não podem produzir vínculo persistente |

Não marcar esses itens como resolvidos apenas porque há alterações em Custos. Reserva e aprendizagem de CPF permanecem explicitamente pendentes. O diagnóstico original de A05 foi verificado independentemente fora de Custos; sua correção foi confirmada pela coordenação, conforme estado acima. Os demais relatos conservam seus estados próprios e não são automaticamente resolvidos pela correção de A05.

## Inventário de cobertura

### Páginas efetivamente lidas em trechos de lógica

Leitura dos trechos de cálculo, seleção, ações ou integração relevantes; **não leitura integral linha a linha**:

| Página | O que foi lido/conferido |
| --- | --- |
| Relatorios | Filtro temporal, turnover, quadro, folha caixa/competência, áreas, ciclos e detalhamento |
| Painel | Escopo, quadro, turnover, alertas, folha, séries por área e autoatendimento |
| Colaboradores | Financeiro por pessoa, escopo, férias, experiência e fontes dos cards |
| Ferias | Escopo, agrupamento/saldo, contexto, validação e criação de agendamento |
| Ponto | Leitura/vínculo de PDF, importação/substituição, duplicidade, filtro mensal e exclusão de afastados |
| Viagens | Escopo, cards, ranking, importação, edição e gravação |
| Integracao | Escopo, contagens, efeito de criação automática, padrinho e arquivamento |
| MeuPerfil | Rotas de abas, envio de foto, dados e desenvolvimento |
| ColaboradorFicha | Permissões, consumidores de férias/desenvolvimento e início da agregação financeira |
| FolhaVariavel | Escopo, totais, abertura, criação, edição e aprovação por pessoa |
| PainelControle | Controles de usuário, permissões, ativação e provisionamento |
| Calendario | Permissões, fontes de eventos/prazos, disponibilidade de ações e gravação de evento |
| Mensagens | Fontes, contatos/escopo e listagem de agendamentos |
| Desempenho | Seleção de equipe/ciclo e trecho de pesquisas/respostas |
| Aceites | Fontes e fluxo de ciência de PDI |
| Comportamental | Arquivo de página completo; delega ao glossário, que não foi integralmente lido |
| Custos | Somente conexão de Viagens e trechos de erros do typecheck em alterações externas; fora da revisão principal |

### Extensão concluída: 14 páginas com revisão funcional dirigida

Além da triagem inicial, foram lidos os fluxos abaixo. Os intervalos indicam trechos consultados, **não certificação de leitura de cada linha entre o início e o fim do arquivo**. Formulários extensos foram amostrados pelos caminhos de seleção, gravação e retorno. Nenhuma dessas páginas foi operada no navegador nesta auditoria.

| Página | Trechos consultados e cobertura real | Resultado / limite específico |
| --- | --- | --- |
| Cargos | 55–145, 295–323, 330–477: ocupação, exclusão, formulário e atualização das faixas | A20; renderização/exportação não exercitadas |
| Carreira | 20–190, 450–641: escopo, seleção, trilha e agrupamento cargo/nível | A29; simulações salariais e todos os controles intermediários não percorridos |
| Comunicacao | Arquivo completo, 1–111: coleção, ordenação, canais, SLAs e conteúdo | Sem novo defeito específico demonstrado; canais/SLAs fixos não foram confrontados com operação real |
| Documentos | 20–105, 195–335, 568–686: fontes, permissões, repositório, abrir/adicionar/atualizar e formulário de arquivo | A22–A23; não ensaiados navegador, popup, storage e arquivos reais |
| Feedback | 78–255, 295–326, 515–584, 645–805: fila, preparação, autoria, salvar e etapas da conversa | A24; entrega de comunicação e todos os estados visuais não exercitados |
| Freelancers | Blocos 1–210, 210–284, 285–319: contrato, prazo, apelido, validação, edição e exclusão | Prazo e exclusão lidos; efeito prometido na Central/oito sistemas não comprovado. HOJE capturado ao carregar também merece o tratamento de A14 |
| LGPD | Arquivo completo, 1–175: acessos, consentimentos, busca e resumo; também `src/lib/lgpd.ts` e chamadas localizadas na ficha | A trilha lida depende de eventos emitidos pelo cliente; não comprova todos os acessos/exportações do servidor. Ausência de evento não comprova ausência de acesso; não houve avaliação legal de consentimentos |
| Login | Arquivo completo, 1–133: sessão, redirecionamento, envio, bloqueio durante login e lembrar sessão | Sem novo defeito específico demonstrado; login real, expiração e recuperação não executados |
| MuralVagas | Arquivo completo, 1–189: seleção, inscrição, duplicidade local, contagens e acompanhamento | A18 e A21; servidor confrontado por leitura, sem requisições reais |
| Organograma | 220–305, 314–351, 570–713: árvore, filtros, saída, reparentamento e editor de gestor | A19 e A27; não afirma cobertura completa de todas as exclusões/transferências da suíte |
| Pops | Arquivo completo, 1–131: coleção, ordenação, busca/expansão e conteúdo | Sem novo defeito material demonstrado; conteúdo dos procedimentos e sua leitura efetiva pelos funcionários não validados |
| SST | 1–157, 466–588, 680–810: fontes, situação, exames, formulário, certificados, validade, cards e renovação | A25–A26; entrega de avisos, anexos e regras de cada NR não validadas externamente |
| Treinamento | 50–190, 310–375, 440–563, 605–650, 748–780: escopo, progresso/status, turmas, lançamento e feedback coletivo | Acoplamento status/progresso lido nos dois sentidos; turma/feedback não comprovam presença ou certificação NR. Sem novo defeito material conclusivo; formulários/renderização restantes não integralmente lidos |
| Vagas | 38–148, 355–413, 480–650, 665–708: filtros, recrutamento, candidato, contratação interna, exclusão/banco e CV | A18, A23 e A28; parser/conteúdo real de currículo e processo externo de contratação não executados |

**Limites das conexões adicionais:** Freelancers promete expiração automática na Central, mas sincronização e revogação dos demais sistemas estão fora do código funcional aqui conferido; não se afirma que funcionam ou falham. Treinamento e SST possuem registros com propósitos distintos: concluir treinamento genérico não demonstra emissão de certificado NR. Comunicação e POPs mostram conteúdo, sem evidência nesta revisão de confirmação de leitura por destinatário. Esses pontos são dependências a comprovar, não defeitos presumidos nem inferência de vínculo CLT.

### Infraestrutura e regras lidas

- `supabase/functions/sync/index.ts`: autenticação, escopos, mascaramento, escrita, listagem, importação, configuração e arquivos.
- `supabase/functions/admin-users/index.ts`: autorização, provisionamento por usuário, remoção e atualização de perfil.
- `src/lib/sync.ts`: fila, falhas, pull incremental, substituição de cache, envio de coleção, configuração e gatilhos; leitura em blocos, sem cobertura integral das funções auxiliares de recuperação.
- `src/lib/store.ts`: fronteira de mutação, fila, auditoria e criação; leitura parcial.
- `src/lib/auth.ts`: inicialização de sessão, perfil e login; leitura parcial. `armazenamentoUsuario.ts`: contexto de armazenamento.
- `rbac.ts`, `dominio.ts`, `quadroPorSituacao.ts`, `identidade.ts`: regras de escopo, contagem e identidade.
- `clt.ts`, `ferias.ts`, `feriasAgenda.ts`, `feriasContagem.ts`, `ciclo.ts`, `_gen.ts`: trechos de referência temporal, férias, validação e ciclo; nem todos os helpers foram revisados integralmente.
- `pontoImport.ts`: estrutura do parser e associação de pessoa; `folha.ts` e trechos de `mubiPagamentos.ts`: agregação e classificação de status.
- Migrações `0001_init.sql`, `202609060001_integridade_rh.sql` e `202609070002_mesclar_config.sql`: leitura de esquema, restrições, versões, gravação e merge. A migração `202609070001_reviver_lapide.sql` foi inventariada, não revisada integralmente.
- `src/test/servidorRh.ts`: lido e usado como servidor simulado em memória.
- `package.json`, `tsconfig.json` e assinatura de componente relevante ao erro de tipos.

### Não verificado

- Produção: conteúdo do Supabase, perfis reais, status persistidos, valores de folha, vínculos, backups e logs.
- Paridade entre código local, funções implantadas, migrações aplicadas e site publicado.
- Navegação autenticada no navegador: evitada porque há efeitos e sincronização com escrita automática.
- PDFs/planilhas reais de ponto, exportações visuais, downloads, responsividade e acessibilidade.
- Todos os caminhos de transferência/exclusão de pessoa, recontratação, promoção, desligamento e provisionamento entre os sistemas da suíte.
- Implementação completa de `mubi-pagamentos`, backup, blobstore, testes de sessão/armazenamento, todas as migrações externas e todas as regras do banco real.
- Implantação e comportamento com vários navegadores reais. Não foi feita auditoria jurídica ou contábil externa. A validação final da aplicação está registrada no complemento da coordenação abaixo.

## Verificações executadas e limitações do resultado

1. Servidor local de sync executado em memória: leitura/escrita de Ponto com módulo restrito; exposição de agendamento global; recusa de alteração de cadastro/evento; ausência de avaliações/PDI próprios; recusa de foto no cadastro. Todas as chamadas foram capturadas pelo simulador, sem rede e sem gravação real.
2. Helpers locais de férias executados em memória: aniversário de 365 dias, contagem indevida de frações históricas e não abatimento de férias futuras na validação. Datas de Viagens reproduzidas em `America/Sao_Paulo`.
3. Condição de deduplicação de Ponto reproduzida com nomes iguais e IDs diferentes.
4. Typecheck sem emissão de arquivos executado duas vezes. A primeira execução encontrou três erros em alterações externas de Custos; essas linhas foram corrigidas externamente durante a própria leitura. A segunda encontrou dois erros em `src/pages/Custos.tsx:1013,1031`, uso de `status` em `Pagamento`. O diagnóstico é transitório de um checkout em movimento; **esse resultado intermediário não representa a validação final**, registrada abaixo. A investigação verificou a origem dos erros sem alterar código.
5. A extensão funcional A18–A29 foi validada por confronto de seletores/handlers com as regras do servidor e referências de arquivo/linha; não foram acrescentadas simulações executáveis nem repetido o typecheck para uma mudança exclusivamente documental.
6. Estado Git consultado no início e no encerramento da investigação. Alterações de aplicação/testes eram externas. A única escrita autorizada desta auditoria é este documento.

## Plano de ações proposto

1. **Permissões e confiança da persistência:** A01–A03 e A07–A09. Priorizar testes que atravessem tela → fila → autorização → resposta; validar redução de equipe e perfil.
2. **Identidade e decisão de importação:** A04, A17 e CPF aprendido. A prévia deve ser a fonte exata de criação, atualização, exclusão e aprendizagem. Conflitos entre IDs exigem revisão humana.
3. **Financeiro:** reconhecer pago corrigido nos três consumidores A05 e preservar os quatro testes dos seletores reais. Conferir societário separadamente e consumidores/exportações adicionais conforme cobertura da entrega coletiva. Tratar `pagoEm`, completude da reserva e aprendizagem de CPF como pendências independentes.
4. **Férias e contrato:** A06, A13–A15. Modelar aquisitivo, reservas e vínculo explícito; conferir o mesmo caso em Férias, ficha, Painel e Calendário.
5. **Histórico e configuração:** A10–A12 e A16. Garantir que mudanças de hoje não reescrevam a interpretação de meses fechados nem sobrescrevam vínculos de outro aparelho.
6. **Recrutamento e desligamento:** A18–A21 e A28. Priorizar campos autorizados da candidatura, confirmação de revogação, referências de cargos e efetivação da movimentação.
7. **Documentos, acompanhamento e estrutura:** A22–A27 e A29. Preservar conteúdo/histórico, ligar PDI à fila, reconciliar cards com listas e tolerar dados incompletos/ciclos.
8. **Cobertura funcional encerrada:** os 14 módulos inicialmente triados receberam a revisão dirigida acima, dentro da auditoria ampla já autorizada. Próxima etapa prática é corrigir e validar os cenários priorizados, não prolongar indefinidamente a leitura. A ordem não substitui revisão humana de decisões sobre pessoas.

Este relatório registra diagnóstico, recomendações e limites. O relatório não aplica alterações. A única escrita desta auditoria foi a criação/atualização deste documento; nenhuma alteração de código ou produção foi realizada por esta revisão. A equipe implementou código em paralelo, com o estado conhecido registrado em A05; não foi confirmada implantação por esta auditoria.

## Validação final da entrega coletiva

Após as correções e a consolidação desta revisão, a coordenação executou `npm run verificar`: lint, TypeScript, 92 arquivos de teste com 1.465 testes aprovados e conferência de IDs com zero inconsistências. `npm run build` também concluiu sem erros. Os erros transitórios citados acima foram resolvidos. O resumo financeiro, a opção fora RH e a prévia receberam testes; a nova aba também foi inspecionada localmente com dados fictícios. Isso não encerra os achados abertos nem comprova dados reais ou todas as permissões em produção.

As funcionalidades e correções entregues estão detalhadas em [Auditoria financeira](./AUDITORIA_FINANCEIRO_2026-09-09.md). A mudança de data de baixa em `pagoEm` foi corrigida na conciliação; completude histórica de datas, reservas e aprendizagem de CPF permanecem pendências distintas.
