// Constantes de domínio do sistema de RH Impresilk

export const PERFIS = {
  ADMIN_RH: "ADMIN_RH",
  GESTOR: "GESTOR",
  COLABORADOR: "COLABORADOR",
} as const;

export type Perfil = (typeof PERFIS)[keyof typeof PERFIS];

export const PERFIL_LABEL: Record<string, string> = {
  ADMIN_RH: "Administrador de RH",
  GESTOR: "Gestor",
  COLABORADOR: "Colaborador",
};

export const COOKIE_SESSAO = "impresilk_session";

// Categorias de documentos por colaborador
export const CATEGORIAS_DOCUMENTO = [
  "Contrato",
  "ASO",
  "Exame Periódico",
  "Certificado",
  "Advertência",
  "Comprovante",
  "Outro",
] as const;

// Categorias de documentos institucionais
export const CATEGORIAS_INSTITUCIONAL = [
  "Código de Ética",
  "POP",
  "Comunicação",
  "Treinamento",
  "SST",
] as const;

// Posições de enquadramento salarial
export const POSICOES_FAIXA = ["Crítico", "Abaixo", "Dentro", "Acima"] as const;

export const COR_POSICAO_FAIXA: Record<string, string> = {
  Crítico: "#dc2626",
  Abaixo: "#d97706",
  Dentro: "#16a34a",
  Acima: "#2563eb",
};

export const NIVEIS_RISCO = ["Baixo", "Médio", "Alto"] as const;

export const COR_RISCO: Record<string, string> = {
  Baixo: "#16a34a",
  Médio: "#d97706",
  Alto: "#dc2626",
};

export const COR_POTENCIAL_DESEMPENHO: Record<string, string> = {
  Alto: "#16a34a",
  Médio: "#d97706",
  Baixo: "#dc2626",
};

// Status de desempenho (avaliação)
export const STATUS_DESEMPENHO = [
  "Apto",
  "Em desenvolvimento",
  "Não apto",
] as const;

// Tipos de movimentação (histórico)
export const TIPOS_MOVIMENTACAO = [
  "Admissão",
  "Promoção",
  "Mudança de Cargo",
  "Reajuste",
  "Afastamento",
  "Retorno",
] as const;

// Status de metas
export const STATUS_META = [
  "Não iniciada",
  "Em andamento",
  "Concluída",
  "Atrasada",
] as const;

// Status de PDI
export const STATUS_PDI = [
  "Pendente",
  "Em andamento",
  "Concluída",
  "Atrasada",
] as const;

// Tipos de feedback
export const TIPOS_FEEDBACK = ["Positivo", "Desenvolvimento", "Contínuo"] as const;

// Status de férias
export const STATUS_FERIAS = [
  "Em aberto",
  "Agendada",
  "Em andamento",
  "Concluída",
] as const;

// Mapa de senioridade (Plano de Carreira)
export const MAPA_SENIORIDADE: Record<string, string> = {
  N1: "Júnior",
  N2: "Júnior",
  N3: "Pleno",
  N4: "Sênior",
  N5: "Sênior",
};

// Janela (em dias) para alertas de vencimento de documentos/contratos
export const JANELA_ALERTA_DIAS = 60;

// Status de viagens / diárias
export const STATUS_VIAGEM = [
  "Planejada",
  "Aprovada",
  "Em andamento",
  "Concluída",
  "Cancelada",
] as const;

export const COR_STATUS_VIAGEM: Record<string, string> = {
  Planejada: "#64748b",
  Aprovada: "#2563eb",
  "Em andamento": "#d97706",
  Concluída: "#16a34a",
  Cancelada: "#dc2626",
};

// Modelo de checklist de integração (admissão)
export const MODELO_ONBOARDING: { titulo: string; responsavel: string }[] = [
  { titulo: "Assinatura do contrato de trabalho", responsavel: "RH" },
  { titulo: "Entrega e conferência de documentos (RG, CPF, CTPS)", responsavel: "RH" },
  { titulo: "Exame admissional (ASO)", responsavel: "SST" },
  { titulo: "Cadastro no eSocial", responsavel: "RH" },
  { titulo: "Abertura de conta salário / dados bancários", responsavel: "RH" },
  { titulo: "Entrega de uniforme e EPIs", responsavel: "SST" },
  { titulo: "Criação de e-mail e acessos", responsavel: "Gestor" },
  { titulo: "Apresentação à equipe e tour pela empresa", responsavel: "Gestor" },
  { titulo: "Leitura e aceite do Código de Ética", responsavel: "Colaborador" },
  { titulo: "Treinamento inicial do cargo", responsavel: "Gestor" },
];

// Modelo de checklist de desligamento (offboarding)
export const MODELO_OFFBOARDING: { titulo: string; responsavel: string }[] = [
  { titulo: "Comunicado e aviso prévio", responsavel: "RH" },
  { titulo: "Exame demissional (ASO)", responsavel: "SST" },
  { titulo: "Devolução de uniforme, EPIs e equipamentos", responsavel: "Gestor" },
  { titulo: "Revogação de acessos e e-mail", responsavel: "Gestor" },
  { titulo: "Cálculo das verbas rescisórias", responsavel: "RH" },
  { titulo: "Baixa na CTPS e eSocial", responsavel: "RH" },
  { titulo: "Entrevista de desligamento", responsavel: "RH" },
  { titulo: "Homologação e entrega de documentos", responsavel: "RH" },
];

// Categorias de documentos relacionados à saúde ocupacional (SST)
export const CATEGORIAS_SST = ["ASO", "Exame Periódico"] as const;

// Humor / engajamento (clima) — Base de Dados RH
export const HUMORES = ["Motivado", "Estável", "Desmotivado"] as const;
export const COR_HUMOR: Record<string, string> = {
  Motivado: "#16a34a",
  Estável: "#2563eb",
  Desmotivado: "#dc2626",
};

// Perfil comportamental (4 temperamentos)
export const PERFIS_COMPORTAMENTAIS = ["Colérico", "Sanguíneo", "Fleumático", "Melancólico"] as const;
export const COR_PERFIL_COMPORTAMENTAL: Record<string, string> = {
  Colérico: "#dc2626",
  Sanguíneo: "#f59e0b",
  Fleumático: "#16a34a",
  Melancólico: "#2563eb",
};
export const DESC_PERFIL_COMPORTAMENTAL: Record<string, string> = {
  Colérico: "Dominante, orientado a resultado e ação.",
  Sanguíneo: "Comunicativo, influente e entusiasmado.",
  Fleumático: "Estável, cooperativo e paciente.",
  Melancólico: "Analítico, detalhista e cauteloso.",
};

// Estilo de aprendizagem (VAK)
export const ESTILOS_APRENDIZAGEM = ["Visual", "Auditivo", "Cinestésico"] as const;

// Categorias de advertência (Módulo C)
export const TIPOS_ADVERTENCIA = ["Verbal", "Escrita", "Suspensão"] as const;

// Empresas do grupo
export const EMPRESAS = ["Impresilk", "Forte Mais"] as const;

// Categoria de CNH (carteira de motorista)
export const CATEGORIAS_CNH = ["Não possui", "A", "B", "AB", "C", "D", "E", "ACC"] as const;

// Treinamento (v3)
export const TIPOS_TREINAMENTO = ["Obrigatório", "Reciclagem", "Onboarding", "Técnico", "Segurança"] as const;
export const STATUS_TREINAMENTO = ["Pendente", "Em andamento", "Concluído"] as const;

// Módulos do sistema (para o controle de permissões por usuário)
export const MODULOS: { chave: string; label: string }[] = [
  { chave: "painel", label: "Painel" },
  { chave: "colaboradores", label: "Colaboradores" },
  { chave: "organograma", label: "Organograma" },
  { chave: "carreira", label: "Carreira e Salários" },
  { chave: "desempenho", label: "Desempenho" },
  { chave: "custos", label: "Custos de Colaboradores" },
  { chave: "treinamento", label: "Treinamento" },
  { chave: "ponto", label: "Frequência e Advertências" },
  { chave: "ferias", label: "Férias" },
  { chave: "integracao", label: "Integração / Desligamento" },
  { chave: "viagens", label: "Viagens e Diárias" },
  { chave: "comunicacao", label: "Comunicação" },
  { chave: "mensagens", label: "Comunicação em Massa" },
  { chave: "pops", label: "POPs e Procedimentos" },
  { chave: "documentos", label: "Documentos Institucionais" },
  { chave: "sst", label: "Saúde e Segurança (SST)" },
  { chave: "meu-perfil", label: "Meu perfil" },
  { chave: "aceites", label: "Termos e Aceites" },
  { chave: "relatorios", label: "Relatórios Gerenciais" },
  { chave: "painel-controle", label: "Painel de Controle" },
  { chave: "lgpd", label: "Registros de Acesso (LGPD)" },
];

// Indicador de motivação (rosto 0–100)
export interface FaixaMotivacao {
  min: number;
  max: number;
  label: string;
  cor: string;
  rosto: "muito-feliz" | "feliz" | "neutro" | "triste" | "muito-triste";
}
export const FAIXAS_MOTIVACAO: FaixaMotivacao[] = [
  { min: 80, max: 100, label: "Muito motivado", cor: "#16a34a", rosto: "muito-feliz" },
  { min: 60, max: 79, label: "Motivado", cor: "#65a30d", rosto: "feliz" },
  { min: 40, max: 59, label: "Neutro", cor: "#eab308", rosto: "neutro" },
  { min: 20, max: 39, label: "Desmotivado", cor: "#f97316", rosto: "triste" },
  { min: 0, max: 19, label: "Crítico (risco)", cor: "#dc2626", rosto: "muito-triste" },
];
export function faixaMotivacao(score: number): FaixaMotivacao {
  return FAIXAS_MOTIVACAO.find((f) => score >= f.min && score <= f.max) ?? FAIXAS_MOTIVACAO[2];
}

// Perfil comportamental completo (arquétipos) — conteúdo base, ajustável pelo gestor.
export interface Arquetipo {
  arquetipo: string;
  disc: string;
  explicacao: string;
  fortes: string[];
  atencao: string[];
  comoLidar: {
    comunicacao: string;
    motiva: string;
    feedback: string;
    delegacao: string;
    evite: string;
    situacoesCriticas: string;
    noticiasRuins: string;
  };
}
export const ARQUETIPOS: Record<string, Arquetipo> = {
  Colérico: {
    arquetipo: "O Executor",
    disc: "D (Dominância)",
    explicacao:
      "Pessoa direta, orientada a resultado e ação. Decide rápido, gosta de assumir o comando e busca vencer desafios.",
    fortes: ["Foco em resultado", "Decisão rápida", "Iniciativa e liderança", "Resiliência sob pressão"],
    atencao: ["Pode ser impaciente", "Tende ao autoritarismo", "Escuta pouco quando acelerado"],
    comoLidar: {
      comunicacao: "Direta, objetiva, focada em resultado e metas.",
      motiva: "Desafios, autonomia, poder de decisão, vencer.",
      feedback: "Rápido e factual, sem rodeios, focado no resultado.",
      delegacao: "Entregue o objetivo e a liberdade do como, depois cobre o resultado.",
      evite: "Microgerenciar, reuniões longas sem conclusão e ambiguidade.",
      situacoesCriticas: "Vá direto ao ponto, apresente o plano de ação e as opções de decisão. Mantenha o controle e foque na solução, não no problema.",
      noticiasRuins: "Seja franco e objetivo, sem rodeios. Explique o impacto e já traga o próximo passo, evitando emocionalizar.",
    },
  },
  Sanguíneo: {
    arquetipo: "O Comunicador",
    disc: "I (Influência)",
    explicacao:
      "Pessoa calorosa, entusiasmada e sociável. Conecta gente, vende ideias e traz energia para o time.",
    fortes: ["Comunicação e persuasão", "Entusiasmo e energia", "Relacionamento", "Criatividade"],
    atencao: ["Pode se dispersar", "Atenção a detalhes e prazos", "Sensível à crítica pública"],
    comoLidar: {
      comunicacao: "Calorosa, entusiasmada, com espaço para conversa.",
      motiva: "Reconhecimento público, relacionamento, novidade e variedade.",
      feedback: "Comece pelo positivo, mantenha o clima leve, reforce o reconhecimento.",
      delegacao: "Envolva e dê visibilidade, mas acompanhe prazos de perto.",
      evite: "Isolamento, excesso de detalhe técnico e crítica seca em público.",
      situacoesCriticas: "Mantenha a calma e a proximidade, fale olho no olho e reforce que vão resolver juntos. Evite expor a pessoa em público.",
      noticiasRuins: "Comece acolhendo, seja humano e transparente e mostre que há apoio. Faça em um momento reservado e com leveza.",
    },
  },
  Fleumático: {
    arquetipo: "O Harmonizador",
    disc: "S (Estabilidade)",
    explicacao:
      "Pessoa calma, paciente e cooperativa. Valoriza estabilidade, mantém a constância e evita conflitos.",
    fortes: ["Estabilidade e constância", "Cooperação", "Paciência", "Lealdade ao time"],
    atencao: ["Resistência a mudanças bruscas", "Evita confronto necessário", "Ritmo cai sob urgência constante"],
    comoLidar: {
      comunicacao: "Calma, paciente, previsível, sem pressão.",
      motiva: "Estabilidade, segurança, pertencimento e processos claros.",
      feedback: "Gentil e gradual, explique o porquê das mudanças, evite confronto.",
      delegacao: "Dê passos claros e tempo de adaptação, valorize a constância.",
      evite: "Mudanças bruscas, urgência constante e conflito aberto.",
      situacoesCriticas: "Traga estabilidade e passos claros, sem urgência exagerada. Reforce a segurança e dê tempo para absorver.",
      noticiasRuins: "Seja gentil e gradual, explique o porquê com calma e ofereça suporte e tempo de adaptação. Evite confronto.",
    },
  },
  Melancólico: {
    arquetipo: "O Analista",
    disc: "C (Conformidade)",
    explicacao:
      "Pessoa precisa, analítica e detalhista. Busca qualidade, trabalha com critérios e cuida para fazer certo.",
    fortes: ["Análise e precisão", "Qualidade e padrão", "Organização", "Especialização técnica"],
    atencao: ["Perfeccionismo", "Autocrítica", "Pode travar por excesso de detalhe"],
    comoLidar: {
      comunicacao: "Precisa, baseada em dados e fatos, com tempo para analisar.",
      motiva: "Qualidade, exatidão, fazer certo e especialização.",
      feedback: "Específico e lógico, com evidências, sem generalizações.",
      delegacao: "Dê critérios e padrões claros, respeite o cuidado com o detalhe.",
      evite: "Cobrança emocional, prazos irreais e falta de informação.",
      situacoesCriticas: "Traga dados e contexto, explique a causa e o plano com critérios claros. Dê tempo para analisar antes de decidir.",
      noticiasRuins: "Seja específico, lógico e baseado em fatos, com evidências. Antecipe as perguntas e evite generalizações.",
    },
  },
};
