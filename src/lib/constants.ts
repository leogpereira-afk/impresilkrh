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
