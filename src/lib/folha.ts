// Agregações da folha real (coleção "pagamentos"). Mantém a regra de competência
// e centraliza os rótulos/cores por tipo para uso no Painel e na ficha.
import type { Pagamento } from "@/data/types";
import { MESES_PT } from "@/lib/format";

// Ordem de exibição e cor por tipo de pagamento (do mais estrutural ao eventual).
export const TIPOS_PAGAMENTO: { tipo: string; cor: string }[] = [
  { tipo: "Salário", cor: "#16334f" },
  { tipo: "Adiantamento", cor: "#2563eb" },
  { tipo: "Horas Extras", cor: "#0891b2" },
  { tipo: "Comissão", cor: "#7c3aed" },
  { tipo: "Incentivo de Produtividade", cor: "#c2a14d" },
  { tipo: "Incentivo de Viagens", cor: "#d97706" },
  { tipo: "Férias", cor: "#16a34a" },
  { tipo: "Vale Transporte", cor: "#059669" },
  { tipo: "Plano de Saúde", cor: "#db2777" },
  { tipo: "Freelancer (Empreita)", cor: "#9333ea" },
  { tipo: "Limpeza/Faxina", cor: "#65a30d" },
  { tipo: "Prestação de Serviços", cor: "#0d9488" },
  { tipo: "Rescisão", cor: "#dc2626" },
  { tipo: "Outros", cor: "#64748b" },
];
const ORDEM = new Map(TIPOS_PAGAMENTO.map((t, i) => [t.tipo, i]));
export const corDoTipo = (tipo: string) => TIPOS_PAGAMENTO.find((t) => t.tipo === tipo)?.cor ?? "#64748b";
export const ordemDoTipo = (tipo: string) => ORDEM.get(tipo) ?? 99;

// "2026-01" -> "Jan/2026"
export function competenciaLabel(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  return `${MESES_PT[(m - 1 + 12) % 12].slice(0, 3)}/${y}`;
}
// "2026-01" -> "Janeiro/2026"
export function competenciaLabelLongo(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  return `${MESES_PT[(m - 1 + 12) % 12]}/${y}`;
}

export function competenciasDisponiveis(pags: Pagamento[]): string[] {
  return [...new Set(pags.map((p) => p.competencia))].sort();
}

// Soma por tipo dentro de uma lista de pagamentos, já ordenada para exibição.
export function somaPorTipo(pags: Pagamento[]): { tipo: string; valor: number }[] {
  const m = new Map<string, number>();
  for (const p of pags) m.set(p.tipo, (m.get(p.tipo) ?? 0) + p.valor);
  return [...m.entries()]
    .map(([tipo, valor]) => ({ tipo, valor }))
    .sort((a, b) => ordemDoTipo(a.tipo) - ordemDoTipo(b.tipo));
}

export const totalDe = (pags: Pagamento[]): number => pags.reduce((a, p) => a + p.valor, 0);

// Total por colaborador numa competência (para a tabela do Painel).
export function totalPorColaborador(pags: Pagamento[], competencia: string) {
  const m = new Map<string, number>();
  for (const p of pags) {
    if (p.competencia !== competencia) continue;
    m.set(p.colaboradorId, (m.get(p.colaboradorId) ?? 0) + p.valor);
  }
  return m;
}

// Série histórica do total geral por competência (comparativo mês a mês).
export function serieMensal(pags: Pagamento[]): { competencia: string; nome: string; valor: number }[] {
  const m = new Map<string, number>();
  for (const p of pags) m.set(p.competencia, (m.get(p.competencia) ?? 0) + p.valor);
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([competencia, valor]) => ({ competencia, nome: competenciaLabel(competencia), valor }));
}
