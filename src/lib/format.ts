export function formatBRL(v: number | null | undefined): string {
  if (v == null) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}
export function iniciais(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean);
  if (p.length === 0) return "?";
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

// Enquadramento salarial frente à faixa do cargo (N1..N5).
export function enquadrar(salario: number | null, faixas: Record<string, number>): string {
  if (salario == null || !faixas?.N1) return "—";
  const n1 = faixas.N1, n5 = faixas.N5 ?? faixas.N1;
  if (salario < n1 * 0.9) return "Crítico";
  if (salario < n1) return "Abaixo";
  if (salario > n5) return "Acima";
  return "Dentro";
}
export const COR_ENQUADRAMENTO: Record<string, string> = {
  "Crítico": "#dc2626", "Abaixo": "#d97706", "Dentro": "#16a34a", "Acima": "#2563eb", "—": "#94a3b8",
};
