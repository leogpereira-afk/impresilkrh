# Plantões e Performance — piloto para a instalação

## Onde usar

- **Calendário → Plantões:** escala de sábados, horas extras e empreitas, independente dos eventos do calendário. O mês abre no atual. Escolha um sábado ou crie uma escala em outra data.
- **Estrutura e financeiro → Performance:** apuração mensal individual, com O.S. concluídas no PCP e participação real de cada pessoa.
- Ambas as telas têm relatório mensal em PDF e são restritas ao perfil Administrador de RH.

## Equipes que mudam

A equipe habitual é um modelo para facilitar o preenchimento. Ao utilizá-la, seus integrantes são copiados para a escala. É possível retirar, substituir ou acrescentar pessoas antes de salvar. Alterar o modelo não reescreve escalas anteriores.

Na entrega, a equipe informada no PCP é uma referência. O RH escolhe os participantes pelo cadastro/ID e registra o percentual de cada um. Instalador e ajudante podem participar da mesma O.S.; a soma das participações nunca ultrapassa 100%. O sistema permite distribuir igualmente o saldo ou informar outra divisão, com evidência do trabalho realizado. Cada participação permanece ligada à O.S. e à pessoa daquele serviço.

## Régua inicial de bonificação (proposta ajustável)

| Critério | Peso inicial | Como conferir |
| --- | ---: | --- |
| Entrega | 35% | Pontos aceitos em relação à meta superior individual |
| Qualidade | 30% | Pontos sem retrabalho atribuído à execução / pontos com qualidade conferida |
| Prazo | 20% | Pontos no prazo / pontos cujo prazo estava sob controle da equipe |
| Colaboração | 15% | Comunicação, cooperação/organização e registros/cuidado de materiais, com fatos e datas |

**Pontos por entrega = complexidade × participação individual.** Uma O.S. de complexidade 4, dividida em 60% e 40%, gera 2,4 e 1,6 pontos. O total continua 4.

**Nota = soma das notas de cada critério × seu peso.** As notas vão de 0 a 100. A nota de entrega é limitada a 100 para que volume extraordinário não esconda qualidade ou prazo ruins.

**Proposta = teto individual × nota / 100.** Na configuração inicial, exige nota mínima 80, qualidade mínima 80 e superação da referência habitual. O teto e o orçamento começam em zero: o responsável define os valores. Uma aprovação não pode ultrapassar o orçamento restante do mês e exige justificativa.

Esses pesos e limites são uma proposta de gestão para teste, não uma tabela legal nem um benchmark comprovado do setor. Não atribuir notas retroativas com base apenas em memória.

### Como combinar a complexidade

Use uma régua documentada antes do período. Exemplos de referência para discutir com a equipe:

1. Serviço simples, pequeno, com preparação e acesso diretos.
2. Serviço pequeno com montagem/alinhamento adicional.
3. Instalação intermediária, com várias peças ou etapas.
4. Montagem complexa, com logística e coordenação relevantes.
5. Obra de grande complexidade, dividida em etapas e com evidência detalhada.

Calibre usando horas-padrão, preparação, quantidade de etapas, área e requisitos técnicos; o valor de venda sozinho não mede esforço. Trabalho em altura demanda planejamento, capacitação e proteção aplicáveis, e não justifica pressa ou exposição para ganhar pontos. Combine também como serviços excepcionalmente grandes serão separados e documentados para evitar distorção da escala de 1 a 5.

### O que não deve virar penalidade automática

- Problema de material, projeto ou alteração do cliente exige causa conferida. Retrabalho externo não é atribuído automaticamente ao instalador.
- Impedimento externo justificado fica fora do denominador de prazo. Se não houver evidência suficiente para o critério, a nota permanece pendente; não se inventa 100.
- Atestados, ausências protegidas e dados médicos não compõem a nota. Ajuste previamente metas à disponibilidade comparável.
- Relatar incidente, risco ou interromper trabalho inseguro não pode reduzir o reconhecimento. Não usar “zero acidentes relatados” como incentivo.
- Horas extras são registradas à parte. Escala e ponto não são somados entre si. Trabalhar mais horas não aumenta automaticamente a nota.

## Fluxo de fechamento

1. Definir critérios, referência habitual, metas superiores e orçamento antes do período.
2. Conferir as pessoas pelo ID e vincular O.S. concluídas no mês. Baixa automática do ERP exige conferência da execução e do aceite.
3. Registrar evidência de entrega, complexidade, participação, qualidade, prazo e colaboração.
4. Resolver as pendências; conferir ponto e horas extras separadamente.
5. Revisar a proposta individual e justificar o valor aprovado.
6. Exportar o PDF e encaminhar ao fluxo de folha conforme a política validada. Aprovar nesta tela não paga e não cria lançamento de folha.

Após aprovação, a avaliação fica travada; as regras mensais não podem ser alteradas enquanto houver proposta aprovada. Correção exige reabertura com motivo. A trilha registra o valor anterior. Alterações concorrentes são detectadas pelo sincronizador e pela tela para evitar sobrescrever uma apuração em edição.

Sugestão de implantação: simular um ou dois ciclos, discutir diferenças de complexidade e distribuição de participação, ouvir a equipe e só então consolidar a política. Tratar colaboradores, freelancers e empreitadas conforme seu vínculo e instrumento aplicável; não substituir pagamento devido por uma proposta de prêmio.

## Origem dos dados e limites

- Pessoas e ponto: cadastro do RH.
- O.S.: função independente `rh-performance`, somente leitura; a função central `sync` recebe apenas os nomes dos três novos cadastros restritos ao RH. Consulta autenticada e somente leitura à base do PCP, filtrada pela data local de conclusão. A tela informa a hora da consulta. Mudanças no Mubisys dependem primeiro da atualização do PCP.
- Cada vínculo guarda o retrato conferido da O.S.; uma aprovação não é recalculada silenciosamente por mudança posterior no ERP. Para corrigir, reabrir e conferir os vínculos.
- As três novas coleções são classificadas como exclusivas de ADMIN_RH. O sincronizador recebe somente essas três entradas na lista de coleções permitidas; sua autenticação, consultas e regras das coleções anteriores permanecem iguais.
- Plantões, equipes habituais e ciclos usam a sincronização versionada existente. O indicador Nuvem mostra pendências e falhas; “salvo” localmente não dispensa conferir esse indicador.
- Nenhum teste automático cria escala ou bonificação de uma pessoa real.

## Fontes consultadas em 12/09/2026

- [CLT — arts. 59 e 457](https://www.planalto.gov.br/ccivil_03/decreto-lei/del5452compilado.htm): horas extras e definição de prêmio por desempenho superior ao ordinariamente esperado. O nome dado ao pagamento não resolve seu enquadramento; validar política, vínculo e convenção coletiva com o responsável trabalhista/contábil.
- [Ministério do Trabalho — NR-35](https://www.gov.br/trabalho-e-emprego/pt-br/acesso-a-informacao/participacao-social/conselhos-e-orgaos-colegiados/comissao-tripartite-partitaria-permanente/normas-regulamentadora/normas-regulamentadoras-vigentes/norma-regulamentadora-no-35-nr-35): referência oficial de trabalho em altura. A proposta de pontuação é gerencial e não substitui os requisitos de segurança.
