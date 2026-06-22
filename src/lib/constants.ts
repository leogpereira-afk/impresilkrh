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
