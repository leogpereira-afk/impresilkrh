import type { AccessLog, Aceite, ConsentimentoLGPD } from "./types";
import { COLABORADORES } from "./colaboradores";

// Consentimento LGPD registrado na admissão de cada colaborador.
export const CONSENTIMENTOS: ConsentimentoLGPD[] = COLABORADORES.filter(
  (c) => !c.ehDirecao,
).map((c) => ({
  id: `consent-${c.id}`,
  colaboradorId: c.id,
  finalidade: "Tratamento de dados pessoais e sensíveis para gestão de RH",
  consentido: true,
  data: c.dataAdmissao ?? "2024-01-01",
}));

// Trilha de acessos a dados sensíveis — começa vazia e é alimentada em tempo de execução.
export const ACESSOS: AccessLog[] = [];

// Aceites eletrônicos — começam vazios; registrados pelo colaborador no app.
export const ACEITES: Aceite[] = [];
