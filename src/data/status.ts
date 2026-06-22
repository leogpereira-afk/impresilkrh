import type { StatusColaborador } from "./types";

// Apêndice G — Status do quadro (cada status tem uma cor e define o headcount)
export const STATUS: StatusColaborador[] = [
  { id: "ativo", nome: "Ativo", cor: "#16a34a", contaComoAtivo: true, ordem: 1 },
  { id: "experiencia", nome: "Em experiência", cor: "#2563eb", contaComoAtivo: true, ordem: 2 },
  { id: "aviso", nome: "Aviso prévio", cor: "#f59e0b", contaComoAtivo: true, ordem: 3 },
  { id: "afastado", nome: "Afastado", cor: "#d97706", contaComoAtivo: true, ordem: 4 },
  { id: "inativo", nome: "Inativo", cor: "#64748b", contaComoAtivo: false, ordem: 5 },
  { id: "direcao", nome: "Direção", cor: "#16334f", contaComoAtivo: false, ordem: 6 },
  { id: "externo", nome: "Externo", cor: "#8b5cf6", contaComoAtivo: false, ordem: 7 },
];
