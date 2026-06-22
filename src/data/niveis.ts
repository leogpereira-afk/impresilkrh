import type { Nivel } from "./types";

// Apêndice A — Régua de senioridade N1..N5
export const NIVEIS: Nivel[] = [
  { id: "N1", codigo: "N1", nome: "Júnior", senioridade: "Júnior", ordem: 1, descricao: "Até 2 anos na função. Execução supervisionada e domínio técnico em consolidação." },
  { id: "N2", codigo: "N2", nome: "Júnior", senioridade: "Júnior", ordem: 2, descricao: "Execução consistente e adaptação comprovada. Reduz erros básicos." },
  { id: "N3", codigo: "N3", nome: "Pleno", senioridade: "Pleno", ordem: 3, descricao: "2 a 5 anos. Autonomia operacional e baixo índice de retrabalho." },
  { id: "N4", codigo: "N4", nome: "Sênior", senioridade: "Sênior", ordem: 4, descricao: "Entrega acima da média e apoio ao time. Referência técnica em formação." },
  { id: "N5", codigo: "N5", nome: "Sênior", senioridade: "Sênior", ordem: 5, descricao: "Acima de 5 anos. Referência técnica da área e resolução de situações complexas." },
];
