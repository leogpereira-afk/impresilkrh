// Helpers de formatação (pt-BR)

// Parser de datas robusto a fuso horário. Strings "YYYY-MM-DD" (date-only, como
// nascimento/admissão) são lidas como data LOCAL — senão o JS as interpreta como
// meia-noite UTC e, em fusos atrás de UTC (Brasil), o dia/mês "voltam" um dia
// (ex.: aniversário 02/06 vira 01/06). Datas com hora/Z seguem o parse nativo.
export function parseData(data: Date | string | null | undefined): Date | null {
  if (!data) return null;
  if (data instanceof Date) return isNaN(data.getTime()) ? null : data;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(data);
  return isNaN(d.getTime()) ? null : d;
}

export function formatBRL(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(valor);
}

export function formatNumber(valor: number | null | undefined, casas = 0): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

export function formatPercent(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "percent",
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

export function formatDate(data: Date | string | null | undefined): string {
  const d = parseData(data);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(d);
}

export function formatDateLong(data: Date | string | null | undefined): string {
  const d = parseData(data);
  if (!d) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(d);
}

export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

// Mascara o CPF para exibição quando o acesso não é privilegiado (LGPD)
export function maskCPF(cpf: string | null | undefined): string {
  if (!cpf) return "—";
  const d = cpf.replace(/\D/g, "");
  if (d.length !== 11) return "•••";
  return `•••.${d.slice(3, 6)}.•••-••`;
}

export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export function tempoDeCasa(dataAdmissao: Date | string | null | undefined): string {
  const d = parseData(dataAdmissao);
  if (!d) return "—";
  const agora = new Date();
  let meses =
    (agora.getFullYear() - d.getFullYear()) * 12 + (agora.getMonth() - d.getMonth());
  if (agora.getDate() < d.getDate()) meses -= 1;
  if (meses < 0) meses = 0;
  const anos = Math.floor(meses / 12);
  const m = meses % 12;
  if (anos === 0) return `${m} ${m === 1 ? "mês" : "meses"}`;
  if (m === 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;
  return `${anos}a ${m}m`;
}

export function mesesDeCasa(dataAdmissao: Date | string | null | undefined): number {
  const d = parseData(dataAdmissao);
  if (!d) return 0;
  const agora = new Date();
  let meses =
    (agora.getFullYear() - d.getFullYear()) * 12 + (agora.getMonth() - d.getMonth());
  if (agora.getDate() < d.getDate()) meses -= 1;
  return Math.max(0, meses);
}

export const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
