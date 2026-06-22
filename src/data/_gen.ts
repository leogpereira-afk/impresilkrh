// Utilitários determinísticos para gerar dados fictícios estáveis (CPF, telefone,
// endereço) e identificadores. Tudo determinístico => os mesmos dados a cada carga.

export function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gerarCPF(seed: number): string {
  const base: number[] = [];
  let x = seed * 7 + 13;
  for (let i = 0; i < 9; i++) {
    x = (x * 9301 + 49297) % 233280;
    base.push(Math.floor((x / 233280) * 10) % 10);
  }
  const calc = (arr: number[], fator: number) => {
    let s = 0;
    for (let i = 0; i < arr.length; i++) s += arr[i] * (fator - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = calc(base, 10);
  const d2 = calc([...base, d1], 11);
  return [...base, d1, d2].join("");
}

export function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function slug(nome: string): string {
  return semAcento(nome)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function email(nome: string): string {
  const partes = semAcento(nome).toLowerCase().replace(/[*.]/g, "").trim().split(/\s+/);
  const primeiro = partes[0];
  const ultimo = partes[partes.length - 1];
  return `${primeiro}.${ultimo}@impresilk.com.br`;
}

export function addDias(base: Date | string, dias: number): string {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

// Data de referência do sistema (para alertas/vencimentos coerentes com os dados).
export const HOJE = new Date("2026-06-22T12:00:00");

export function uid(prefixo = "id"): string {
  return `${prefixo}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
