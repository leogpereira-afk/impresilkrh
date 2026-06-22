import type { ClassificacaoConta } from "./types";

// Classificação padrão das contas de custo de colaboradores. EDITÁVEL na tela de
// Custos (seletor Individual/Rateio/Encargo por conta). Contas não listadas aqui
// são tratadas como "ignorar" (não são custo de colaborador).
const def: { codigo: string; nome: string; classe: ClassificacaoConta["classe"] }[] = [
  // --- Individual (vai para a ficha do colaborador / Pagamentos) ---
  { codigo: "2.1.1", nome: "Salário", classe: "individual" },
  { codigo: "2.1.2", nome: "Adiantamento", classe: "individual" },
  { codigo: "2.1.3", nome: "Férias", classe: "individual" },
  { codigo: "2.1.5", nome: "Vale Transporte", classe: "individual" },
  { codigo: "2.1.6", nome: "Rescisão", classe: "individual" },
  { codigo: "2.1.8", nome: "Uniforme", classe: "individual" },
  { codigo: "2.1.11", nome: "Horas Extras", classe: "individual" },
  { codigo: "2.1.12", nome: "Comissão Interna", classe: "individual" },
  { codigo: "2.1.13", nome: "Incentivo de Produtividade", classe: "individual" },
  { codigo: "2.1.16", nome: "Prestação de Serviços", classe: "individual" },
  { codigo: "2.1.18", nome: "Minas Brasil", classe: "individual" },
  { codigo: "2.1.19", nome: "Incentivo de Viagens", classe: "individual" },
  { codigo: "2.1.20", nome: "Plano de Saúde", classe: "individual" },
  // --- Rateio para todos (÷ colaboradores ativos) ---
  { codigo: "2.1.14", nome: "Alimentação", classe: "rateio" },
  { codigo: "2.1.15.4", nome: "Aniversário do mês", classe: "rateio" },
  { codigo: "2.1.15.5", nome: "Confraternização · Outros", classe: "rateio" },
  { codigo: "2.1.17", nome: "Treinamentos", classe: "rateio" },
  { codigo: "2.1.21", nome: "Divulgação de vagas", classe: "rateio" },
  { codigo: "2.2.2", nome: "Contribuição Sindical", classe: "rateio" },
  // --- Encargos (custo real, não rateado) ---
  { codigo: "2.1.9", nome: "FGTS", classe: "encargo" },
  { codigo: "2.1.9.1", nome: "FGTS Regular", classe: "encargo" },
  { codigo: "2.1.9.2", nome: "FGTS Empréstimo Trabalhador", classe: "encargo" },
  // --- Confidencial (só gestor master) — Card A: Arrendamento/Pedro ---
  { codigo: "2.14.1.1", nome: "Arrendamento · Plano de Saúde", classe: "confidencial" },
  { codigo: "2.14.1.2", nome: "Arrendamento · Pedro Ramos Pereira", classe: "confidencial" },
  // --- Confidencial — Card B: Retiradas Leonardo ---
  { codigo: "2.14.2.2", nome: "Retiradas Leonardo", classe: "confidencial" },
  { codigo: "2.14.2.3.1", nome: "Retiradas Leonardo · Combustível", classe: "confidencial" },
  { codigo: "2.14.2.4", nome: "Retiradas Leonardo · Plano de Saúde", classe: "confidencial" },
];

export const CLASSIFICACAO_CONTAS: ClassificacaoConta[] = def.map((c) => ({ id: `cls_${c.codigo}`, ...c }));

// Agrupamento dos cards confidenciais por prefixo de código.
export const CARDS_CONFIDENCIAIS: { id: string; titulo: string; prefixos: string[] }[] = [
  { id: "arrendamento", titulo: "Arrendamento (Pedro)", prefixos: ["2.14.1."] },
  { id: "leonardo", titulo: "Retiradas Leonardo", prefixos: ["2.14.2."] },
];
