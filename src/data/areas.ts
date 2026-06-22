import type { Area } from "./types";

// Apêndice A — Áreas
export const AREAS: Area[] = [
  { id: "direcao", nome: "Direção", descricao: "Sócios-fundadores, diretoria e assessorias externas.", ordem: 0 },
  { id: "adm", nome: "Administrativo e Gestão", descricao: "Administração, suprimentos, PCP, RH/DP e gestão.", ordem: 1 },
  { id: "comercial", nome: "Comercial e Atendimento", descricao: "Vendas consultivas, atendimento e relacionamento.", ordem: 2 },
  { id: "producao", nome: "Produção e Comunicação Visual", descricao: "Impressão, CNC, pintura, design e projetos.", ordem: 3 },
  { id: "montagem", nome: "Montagem e Instalação", descricao: "Equipe de campo: montagem e instalação na região.", ordem: 4 },
  { id: "serralheria", nome: "Serralheria e Metalurgia", descricao: "Produção de estruturas metálicas e solda.", ordem: 5 },
];
