// ============================================================================
// DADOS EMBUTIDOS (sem banco de dados). Carregados na 1ª vez no localStorage.
// Edições do RH (Painel de Controle) sobrescrevem esta base no navegador.
// ============================================================================

export type Perfil = "ADMIN_RH" | "GESTOR" | "COLABORADOR";

export interface Area { id: string; nome: string }
export interface Nivel { codigo: string; senioridade: string; ordem: number }
export interface StatusColab { nome: string; cor: string; ativo: boolean }
export interface Cargo {
  id: string; nome: string; areaId: string;
  faixas: Record<string, number>; // N1..N5
}
export interface Colaborador {
  id: string; nome: string; email: string;
  cargoId: string | null; areaId: string | null; nivel: string | null;
  salario: number | null; gestorId: string | null; status: string;
  cpf?: string; telefone?: string; dataAdmissao?: string; dataNascimento?: string;
  riscoSaida?: "Baixo" | "Médio" | "Alto"; potencial?: "Baixo" | "Médio" | "Alto";
}
export interface Documento {
  id: string; titulo: string; categoria: string; descricao: string;
  conteudo: string; versao: string; atualizadoEm: string;
}

export const SENHA_DEMO = "Impresilk@2026";

export const AREAS: Area[] = [
  { id: "direcao", nome: "Direção" },
  { id: "admin", nome: "Administrativo e Gestão" },
  { id: "comercial", nome: "Comercial e Atendimento" },
  { id: "producao", nome: "Produção e Comunicação Visual" },
  { id: "montagem", nome: "Montagem e Instalação" },
  { id: "serralheria", nome: "Serralheria e Metalurgia" },
];

export const NIVEIS: Nivel[] = [
  { codigo: "N1", senioridade: "Júnior", ordem: 1 },
  { codigo: "N2", senioridade: "Júnior", ordem: 2 },
  { codigo: "N3", senioridade: "Pleno", ordem: 3 },
  { codigo: "N4", senioridade: "Sênior", ordem: 4 },
  { codigo: "N5", senioridade: "Sênior", ordem: 5 },
];

export const STATUSES: StatusColab[] = [
  { nome: "Ativo", cor: "#16a34a", ativo: true },
  { nome: "Em experiência", cor: "#2563eb", ativo: true },
  { nome: "Inativo", cor: "#64748b", ativo: false },
  { nome: "Direção", cor: "#16334f", ativo: false },
  { nome: "Externo", cor: "#94a3b8", ativo: false },
];

const f = (n1: number, n2: number, n3: number, n4: number, n5: number) => ({ N1: n1, N2: n2, N3: n3, N4: n4, N5: n5 });

export const CARGOS: Cargo[] = [
  // Direção (sem faixa)
  { id: "fundadora", nome: "Fundadora", areaId: "direcao", faixas: {} },
  { id: "fundador", nome: "Fundador", areaId: "direcao", faixas: {} },
  { id: "diretor", nome: "Diretor Geral", areaId: "direcao", faixas: {} },
  { id: "consultoria", nome: "Consultoria", areaId: "direcao", faixas: {} },
  { id: "contabilidade", nome: "Contabilidade", areaId: "direcao", faixas: {} },
  { id: "juridico", nome: "Jurídico", areaId: "direcao", faixas: {} },
  // Administrativo
  { id: "analista-pcp", nome: "Analista de PCP", areaId: "admin", faixas: f(2500, 2875, 3250, 3625, 4000) },
  { id: "assist-suprimentos", nome: "Assistente de Suprimentos", areaId: "admin", faixas: f(2800, 2875, 2950, 3025, 3100) },
  { id: "coord-admin", nome: "Coordenador Administrativo", areaId: "admin", faixas: f(2800, 3225, 3650, 4075, 4500) },
  { id: "ger-admin", nome: "Gerente Administrativo", areaId: "admin", faixas: f(3000, 3625, 4250, 4875, 5500) },
  { id: "ger-operacoes", nome: "Gerente de Operações", areaId: "admin", faixas: f(3500, 4000, 4500, 5000, 5500) },
  { id: "rh-dp", nome: "RH / DP", areaId: "admin", faixas: f(1900, 2175, 2450, 2725, 3000) },
  // Comercial
  { id: "atendente-com", nome: "Atendente Comercial", areaId: "comercial", faixas: f(1621, 1716, 1811, 1905, 2000) },
  { id: "consultor-vendas", nome: "Consultor de Vendas", areaId: "comercial", faixas: f(1621, 1766, 1911, 2055, 2200) },
  // Montagem
  { id: "ger-montagem", nome: "Gerente de Montagem de Portas", areaId: "montagem", faixas: f(2200, 2400, 2600, 2800, 3000) },
  { id: "instalador-assist", nome: "Instalador Assistente", areaId: "montagem", faixas: f(1621, 1666, 1711, 1755, 1800) },
  { id: "instalador-cv", nome: "Instalador de Comunicação Visual", areaId: "montagem", faixas: f(1800, 1975, 2150, 2325, 2500) },
  { id: "lider-montagem", nome: "Líder de Montagem de Portas", areaId: "montagem", faixas: f(2200, 2400, 2600, 2800, 3000) },
  // Produção
  { id: "designer", nome: "Designer Gráfico", areaId: "producao", faixas: f(1800, 1925, 2050, 2175, 2300) },
  { id: "impressor", nome: "Impressor", areaId: "producao", faixas: f(1800, 1950, 2100, 2250, 2400) },
  { id: "lider-producao", nome: "Líder de Produção", areaId: "producao", faixas: f(2200, 2400, 2600, 2800, 3000) },
  { id: "op-cnc", nome: "Operador de CNC", areaId: "producao", faixas: f(1621, 1766, 1911, 2055, 2200) },
  { id: "op-cv", nome: "Operador de Comunicação Visual", areaId: "producao", faixas: f(1621, 1766, 1911, 2055, 2200) },
  { id: "pintor-cv", nome: "Pintor de Comunicação Visual", areaId: "producao", faixas: f(2000, 2050, 2100, 2150, 2200) },
  { id: "projetista", nome: "Projetista", areaId: "producao", faixas: f(2200, 2525, 2850, 3175, 3500) },
  // Serralheria
  { id: "serralheiro", nome: "Serralheiro", areaId: "serralheria", faixas: f(1800, 1975, 2150, 2325, 2500) },
  { id: "soldador", nome: "Soldador", areaId: "serralheria", faixas: f(1800, 1975, 2150, 2325, 2500) },
];

// Pessoas: [nome, cargoId, nivel|null, salario|null, gestorId|null, status]
type LinhaColab = [string, string | null, string | null, number | null, string | null, string];
const P: LinhaColab[] = [
  ["Maria Inês", "fundadora", null, null, null, "Direção"],
  ["Pedro Ramos", "fundador", null, null, null, "Direção"],
  ["Leonardo Gonçalves", "diretor", null, null, "pedro-ramos", "Direção"],
  ["Consultorias", "consultoria", null, null, "leonardo-goncalves", "Externo"],
  ["Contabilidade", "contabilidade", null, null, "leonardo-goncalves", "Externo"],
  ["Jurídico", "juridico", null, null, "leonardo-goncalves", "Externo"],
  ["Pedro Henrique Gonçalves", "ger-operacoes", "N1", 2900, "leonardo-goncalves", "Ativo"],
  ["Jéssica Fernanda S. Sampaio", "ger-admin", "N1", 2600, "leonardo-goncalves", "Ativo"],
  ["Saulo Rodrigues Ferreira", "ger-montagem", "N2", 2400, "pedro-henrique-goncalves", "Ativo"],
  ["Camila Cristina R. Sampaio", "coord-admin", "N1", 2300, "jessica-fernanda-s-sampaio", "Ativo"],
  ["Larissa Andrade Souza", "rh-dp", "N3", 2450, "jessica-fernanda-s-sampaio", "Ativo"],
  ["Rodrigo Moreira Silva", "analista-pcp", "N1", 2500, "pedro-henrique-goncalves", "Ativo"],
  ["Raphael Terra Alves", "assist-suprimentos", "N1", 2650, "pedro-henrique-goncalves", "Ativo"],
  ["Adriano Nunes Araújo", "lider-montagem", "N2", 2400, "saulo-rodrigues-ferreira", "Ativo"],
  ["Adriano Pinheiro Lima", "instalador-cv", "N3", 2150, "adriano-nunes-araujo", "Ativo"],
  ["Douglas Thiago Silva", "instalador-cv", "N3", 2150, "adriano-nunes-araujo", "Ativo"],
  ["Lucas Natalino Ferreira", "instalador-cv", "N4", 2325, "adriano-nunes-araujo", "Ativo"],
  ["Ronivon Cardoso dos Santos", "instalador-cv", "N4", 2325, "adriano-nunes-araujo", "Ativo"],
  ["José Adilando Pereira", "instalador-assist", "N5", 1900, "adriano-nunes-araujo", "Ativo"],
  ["Tiago Mendes Rocha", "instalador-assist", "N2", 1666, "adriano-nunes-araujo", "Inativo"],
  ["André Maia Costa", "impressor", "N1", 1800, "pedro-henrique-goncalves", "Ativo"],
  ["Ewerton Duarte Amaral", "impressor", "N2", 1950, "pedro-henrique-goncalves", "Ativo"],
  ["Bruno Dias do Nascimento", "op-cv", "N4", 2055, "pedro-henrique-goncalves", "Ativo"],
  ["Charles Alves Dias", "op-cv", "N3", 1911, "pedro-henrique-goncalves", "Ativo"],
  ["Elnata Pereira dos Santos", "op-cv", "N3", 1911, "pedro-henrique-goncalves", "Ativo"],
  ["Osmané Vinicius Neponuceno", "op-cv", "N3", 1911, "pedro-henrique-goncalves", "Ativo"],
  ["Sidney Nunes da Silva", "op-cv", "N3", 1911, "pedro-henrique-goncalves", "Em experiência"],
  ["Daniel Pereira de Oliveira", "pintor-cv", "N1", 1850, "pedro-henrique-goncalves", "Ativo"],
  ["Demerval Vieira", "designer", "N4", 2175, "pedro-henrique-goncalves", "Ativo"],
  ["Eberth Soares Santos", "designer", "N5", 2450, "pedro-henrique-goncalves", "Ativo"],
  ["Vinicius Aguiar Rodrigues", "op-cnc", "N5", 2350, "pedro-henrique-goncalves", "Ativo"],
  ["Vinicius Silva Lins", "projetista", "N1", 2050, "pedro-henrique-goncalves", "Ativo"],
  ["Nailton Antunes da Silva", "serralheiro", "N5", 2650, "pedro-henrique-goncalves", "Ativo"],
  ["Paulo Alves Cordeiro", "soldador", "N5", 2650, "pedro-henrique-goncalves", "Ativo"],
  ["Adilson Barbosa", "atendente-com", "N5", 2100, "jessica-fernanda-s-sampaio", "Ativo"],
  ["Marcella Laiara Rocha", "atendente-com", "N3", 1811, "jessica-fernanda-s-sampaio", "Ativo"],
  ["Patrícia Gomes Lopes", "atendente-com", "N2", 1716, "jessica-fernanda-s-sampaio", "Inativo"],
  ["Barbara Patricia Ferreira", "consultor-vendas", "N2", 1766, "jessica-fernanda-s-sampaio", "Ativo"],
  ["Candida Elia David Barros", "consultor-vendas", "N1", 1621, "jessica-fernanda-s-sampaio", "Ativo"],
];

export function slug(nome: string): string {
  return nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
function emailDe(nome: string): string {
  const p = slug(nome).split("-");
  return `${p[0]}.${p[p.length - 1]}@impresilk.com.br`;
}
const cargoArea = (cargoId: string | null) => CARGOS.find((c) => c.id === cargoId)?.areaId ?? null;

export const COLABORADORES: Colaborador[] = P.map(([nome, cargoId, nivel, salario, gestorId, status]) => ({
  id: slug(nome),
  nome,
  email: nome === "Larissa Andrade Souza" ? "rh@impresilk.com.br" : emailDe(nome),
  cargoId,
  areaId: cargoArea(cargoId),
  nivel,
  salario,
  gestorId,
  status,
  riscoSaida: "Baixo",
  potencial: "Médio",
}));

// Usuários demo (perfil de acesso). Larissa = RH; gerentes = GESTOR; demais = COLABORADOR.
export const USUARIOS: { colaboradorId: string; perfil: Perfil }[] = COLABORADORES.map((c) => {
  let perfil: Perfil = "COLABORADOR";
  if (c.id === "larissa-andrade-souza") perfil = "ADMIN_RH";
  else if (["pedro-henrique-goncalves", "jessica-fernanda-s-sampaio", "saulo-rodrigues-ferreira", "adriano-nunes-araujo"].includes(c.id)) perfil = "GESTOR";
  return { colaboradorId: c.id, perfil };
});

export const DOCUMENTOS: Documento[] = [
  {
    id: "guia-comunicacao", titulo: "Guia de Comunicação — Fluxos Claros", categoria: "Comunicação", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Como nos comunicamos na Impresilk: canais, SLAs e princípios.",
    conteudo: `COMO NOS COMUNICAMOS NA IMPRESILK
Comunicação boa evita retrabalho, respeita o fluxo e chega clara para quem executa. Aqui não é sobre pessoas, é sobre fluxo.
Antes de falar, pedir ou decidir: Isso está claro? Está no fluxo? Está no canal certo?

CANAIS OFICIAIS
• Pedidos e demandas → canal oficial definido
• Urgências → canal exclusivo de urgência
• Decisões → dentro do fluxo
• Informações importantes → nada de conversa paralela
Mensagem fora do canal não orienta execução.

PRAZOS DE RESPOSTA (SLA)
• Validação de pedido no PCP: até 24h
• Revisão técnica: até 12h úteis
• Retorno sobre urgência: até 4h úteis

QUEM ACIONAR EM CADA CASO
• Pedido incompleto → PCP
• Dúvida técnica → Design / PCP
• Urgência → PCP + Liderança
• Produção → PCP
• Decisão fora do padrão → Liderança

FAQ
• Posso pedir direto para a produção? Não. Tudo passa pelo fluxo.
• Mensagem no WhatsApp pessoal vale? Não. Só canal oficial.
• Se for urgente, posso pular etapa? Não. Urgência também tem fluxo.`,
  },
  {
    id: "plano-comunicacao", titulo: "Plano de Comunicação Interna", categoria: "Comunicação", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Estrutura da comunicação interna: objetivo, diagnóstico, princípios e fluxo.",
    conteudo: `OBJETIVO
Padronizar a comunicação entre áreas, definir fluxos e responsabilidades, garantir previsibilidade e eficiência.

DIAGNÓSTICO
Comunicação descentralizada e informal; pedidos incompletos chegando à produção; uso indevido de canais (WhatsApp pessoal); falta de clareza nos fluxos; retrabalho e urgências desnecessárias.

PRINCÍPIOS
Clareza · Fluxo · Canal correto. Comunicação fora desses princípios não orienta execução.

FLUXO PADRÃO
Comercial → PCP → Produção. Pedido só entra completo; PCP valida antes; produção recebe só pedidos liberados; mudança de prioridade exige autorização.

RESULTADO ESPERADO
Redução de retrabalho; menos urgências; mais organização entre setores; aumento da produtividade; melhoria no clima.`,
  },
  {
    id: "endomarketing", titulo: "Plano de Endomarketing — Campanhas Internas", categoria: "Comunicação", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Campanhas de engajamento e reconhecimento interno.",
    conteudo: `OBJETIVO
Fortalecer o engajamento, o reconhecimento e o pertencimento.

CAMPANHA 1 — ORGULHO DE FAZER PARTE (mensal)
"Cada projeto entregue carrega o trabalho de muitas mãos." Seleção do projeto do mês (PCP + liderança) → coleta de informações (cliente, serviço, desafio, setores) → registro visual (fotos) → montagem do material (Admin/Design) → divulgação (mural + reunião) → fechamento na reunião mensal.

CAMPANHA 2 — BASTIDORES DA PRODUÇÃO (quinzenal/mensal)
"Por trás de cada entrega, existe processo, cuidado e dedicação." Mostrar a execução real (impressão, corte, montagem, instalação) e a equipe envolvida.

CAMPANHA 3 — RESULTADO DO MÊS (mensal)
"Resultado é consequência de processo bem feito." Levantar dados (pedidos, entregas, destaques), organizar de forma simples e visual, divulgar na reunião mensal e no mural.`,
  },
  {
    id: "pop-pedido", titulo: "POP — Fluxo de Pedido (Comercial → PCP → Produção)", categoria: "POP", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Procedimento padrão para entrada e validação de pedidos.",
    conteudo: `OBJETIVO: garantir que todo pedido entre no fluxo de forma completa e rastreável.
FLUXO: Comercial → PCP → Produção.

ANTES DE O PCP ASSUMIR O PEDIDO, CONFERIR:
1. O que será feito está claro
2. Medidas informadas
3. Material definido
4. Arquivos enviados
5. Prazo informado

REGRAS:
❌ Pedido incompleto não entra no fluxo.
✔ Pedido completo segue normalmente.
SLA de validação no PCP: até 24h.`,
  },
  {
    id: "pop-design", titulo: "POP — Fluxo de Design e Revisão", categoria: "POP", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Procedimento de revisão técnica antes da produção.",
    conteudo: `OBJETIVO: o design só trabalha com pedido validado; proteger contra retrabalho.

ANTES DE LIBERAR PARA PRODUÇÃO, CONFERIR:
1. Arte final conferida
2. Medidas corretas
3. Material certo
4. Nenhum ajuste pendente

REGRAS:
❌ Sem revisão → não produz.
✔ Revisado → produção liberada.
SLA de revisão técnica: até 12h úteis.`,
  },
  {
    id: "pop-producao", titulo: "POP — Fluxo de Produção", categoria: "POP", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Procedimento padrão da produção com previsibilidade.",
    conteudo: `OBJETIVO: produção trabalha com previsibilidade e ordem.

REGRAS BÁSICAS:
• Produção só recebe pedido liberado
• Ordem de produção é respeitada
• Mudança de prioridade é controlada
• Produção recebe tudo via PCP

A produção executa. Não corrige erro de entrada.`,
  },
  {
    id: "pop-urgencia", titulo: "POP — Fluxo de Urgência", categoria: "POP", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Critérios e tratamento de urgências.",
    conteudo: `NEM TUDO É URGENTE. Para algo ser urgente:
1. Impacta o prazo do cliente agora
2. PCP avaliou o impacto
3. Liderança está ciente

REGRAS:
❌ Sem validação → pedido normal.
✔ Urgência validada segue fluxo especial.
SLA de retorno sobre urgência: até 4h úteis.`,
  },
  {
    id: "pop-rotinas", titulo: "POP — Rotinas de Comunicação e Alinhamento", categoria: "POP", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Reuniões e rotinas que mantêm o fluxo previsível.",
    conteudo: `REUNIÃO SEMANAL OPERACIONAL
Periodicidade: semanal · Duração: até 15 min · Participantes: PCP, Comercial, Produção.
Pauta: pedidos em andamento, prioridades da semana, pontos críticos, ajustes necessários.

REUNIÃO MENSAL DE ALINHAMENTO
Periodicidade: mensal · Duração: 30–60 min · Participantes: lideranças e responsáveis de setor.
Pauta: resultados do período, erros e aprendizados, ajustes de processo, melhorias no fluxo.

ROTINAS DIÁRIAS
• Validação de pedidos (PCP, diária)
• Revisão técnica (Design, conforme demanda)
• Controle de urgência (PCP + liderança)`,
  },
  {
    id: "codigo-etica", titulo: "Código de Ética e Conduta", categoria: "Código de Ética", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Valores e normas de conduta da Impresilk.",
    conteudo: `A Impresilk Comunicação Visual orienta-se por respeito, ética e segurança.
• Respeito e cordialidade com colegas, clientes e parceiros.
• Uso obrigatório de EPIs e cumprimento das normas de segurança (SST).
• Zelo pelo patrimônio e pelos equipamentos da empresa.
• Confidencialidade das informações de clientes e da empresa.
• Honestidade, pontualidade e compromisso com a qualidade das entregas.
• Combate a qualquer forma de discriminação ou assédio.
A violação deste código está sujeita às medidas disciplinares cabíveis.`,
  },
  {
    id: "pgr", titulo: "PGR — Programa de Gerenciamento de Riscos", categoria: "SST", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Identificação e controle de riscos ocupacionais.",
    conteudo: `Identifica perigos e avalia riscos ocupacionais nos setores de produção, impressão/sublimação, CNC, serralheria e montagem em campo, definindo plano de ação e uso obrigatório de EPIs.`,
  },
  {
    id: "pcmso", titulo: "PCMSO — Programa de Controle Médico de Saúde Ocupacional", categoria: "SST", versao: "1.0", atualizadoEm: "2026-01-01",
    descricao: "Exames ocupacionais (admissional, periódico, demissional).",
    conteudo: `Define a realização dos exames ocupacionais (ASO admissional, periódico, de retorno ao trabalho e demissional) e o acompanhamento da saúde dos colaboradores conforme as Normas Regulamentadoras.`,
  },
];
