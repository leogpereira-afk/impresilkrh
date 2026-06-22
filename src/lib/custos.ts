// Agregações do módulo de Custos de Colaboradores.
// Fontes: planoContas (agregado mensal por conta) + classificacaoCustos (editável).
// O custo INDIVIDUAL por pessoa vem da folha real (pagamentos.ts); aqui tratamos
// os totais por classe (individual/rateio/encargo/confidencial) e o comparativo.
import type { ContaPlano, ClassificacaoConta, ClasseCusto } from "@/data/types";
import { MESES_PT } from "@/lib/format";

export function classeMap(cls: ClassificacaoConta[]): Map<string, ClasseCusto> {
  return new Map(cls.map((c) => [c.codigo, c.classe]));
}
export const classeDe = (codigo: string, m: Map<string, ClasseCusto>): ClasseCusto => m.get(codigo) ?? "ignorar";

export function competenciasPlano(plano: ContaPlano[]): string[] {
  return [...new Set(plano.map((p) => p.competencia))].sort();
}

// "2026-05" -> "Mai/2026"
export function compLabel(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  if (!m || isNaN(m)) return comp;
  return `${MESES_PT[(m - 1 + 12) % 12].slice(0, 3)}/${y}`;
}
export function compLabelLongo(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  if (!m || isNaN(m)) return comp;
  return `${MESES_PT[(m - 1 + 12) % 12]}/${y}`;
}

// Folhas (sem subcontas) de um mês — soma sem duplicar pai+filho.
export function folhasDoMes(plano: ContaPlano[], comp: string): ContaPlano[] {
  return plano.filter((p) => p.competencia === comp && p.folha);
}

export interface TotaisMes {
  individual: number;
  rateio: number;
  rateioPorColab: number;
  encargo: number;
  contasIndividual: ContaPlano[];
  contasRateio: ContaPlano[];
}

export function totaisDoMes(plano: ContaPlano[], m: Map<string, ClasseCusto>, comp: string, nColab: number): TotaisMes {
  const folhas = folhasDoMes(plano, comp);
  const contasIndividual = folhas.filter((p) => classeDe(p.codigo, m) === "individual").sort((a, b) => b.valor - a.valor);
  const contasRateio = folhas.filter((p) => classeDe(p.codigo, m) === "rateio").sort((a, b) => b.valor - a.valor);
  const individual = contasIndividual.reduce((s, p) => s + p.valor, 0);
  const rateio = contasRateio.reduce((s, p) => s + p.valor, 0);
  const encargo = folhas.filter((p) => classeDe(p.codigo, m) === "encargo").reduce((s, p) => s + p.valor, 0);
  return { individual, rateio, rateioPorColab: nColab > 0 ? rateio / nColab : 0, encargo, contasIndividual, contasRateio };
}

// Série mês a mês (para o dash de evolução).
export function serieCustos(plano: ContaPlano[], m: Map<string, ClasseCusto>, nColab: number) {
  return competenciasPlano(plano).map((comp) => {
    const t = totaisDoMes(plano, m, comp, nColab);
    return { competencia: comp, nome: compLabel(comp), individual: t.individual, rateio: t.rateio, rateioPorColab: t.rateioPorColab, medioIndividual: nColab > 0 ? t.individual / nColab : 0 };
  });
}

// Cards confidenciais: agrupa folhas por prefixo de código.
export function confidencialDoMes(
  plano: ContaPlano[],
  comp: string,
  cards: { id: string; titulo: string; prefixos: string[] }[],
) {
  const folhas = folhasDoMes(plano, comp);
  return cards.map((card) => {
    const itens = folhas
      .filter((p) => card.prefixos.some((pre) => p.codigo.startsWith(pre)))
      .sort((a, b) => b.valor - a.valor);
    return { ...card, itens, total: itens.reduce((s, p) => s + p.valor, 0) };
  });
}

export const CLASSE_LABEL: Record<ClasseCusto, string> = {
  individual: "Individual",
  rateio: "Rateio para todos",
  encargo: "Encargo",
  confidencial: "Confidencial",
  ignorar: "Ignorar",
};

// ===================== Importação de planilhas (.xlsx/.csv) =====================
type Linha = (string | number | null)[];

function moedaBR(v: string | number | null): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/R\$/g, "").trim().replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// Plano de Contas → ContaPlano[] de uma competência. Linhas: col A "• cod - nome", col D valor.
export function parsePlanoContas(linhas: Linha[], competencia: string): ContaPlano[] {
  const brutos: { codigo: string; nome: string; valor: number }[] = [];
  for (const l of linhas) {
    const a = l[0] == null ? "" : String(l[0]).replace(/•/g, "").trim();
    const m = /^([\d\s.]+?)\s*-\s*(.*)$/.exec(a);
    if (!m) continue;
    const codigo = m[1].replace(/\s/g, "");
    if (!codigo.startsWith("2")) continue;
    brutos.push({ codigo, nome: m[2].trim(), valor: moedaBR(l[3]) });
  }
  const codigos = new Set(brutos.map((b) => b.codigo));
  const ehFolha = (c: string) => { const p = c + "."; return ![...codigos].some((x) => x.startsWith(p)); };
  return brutos.map((b) => ({ competencia, codigo: b.codigo, nome: b.nome, valor: Math.round(b.valor * 100) / 100, folha: ehFolha(b.codigo) }));
}

const norm = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function tipoDePlano(plano: string, desp: string): string {
  const p = plano.toLowerCase(), dd = desp.toLowerCase();
  if (/amil|unimed|sa[uú]de|odonto/.test(dd)) return "Plano de Saúde";
  if (/sal[aá]rio/.test(p)) return "Salário";
  if (/adiantamento/.test(p)) return "Adiantamento";
  if (/f[eé]rias/.test(p)) return "Férias";
  if (/hora/.test(p) || /hora extra/.test(dd)) return "Horas Extras";
  if (/comiss/.test(p)) return "Comissão";
  if (/produtividade/.test(p)) return "Incentivo de Produtividade";
  if (/viagens|viagem/.test(p) || /viagens|viagem/.test(dd)) return "Incentivo de Viagens";
  if (/vale transporte/.test(p)) return "Vale Transporte";
  if (/rescis/.test(p)) return "Rescisão";
  if (/freelancer/.test(p) || /empreita/.test(dd)) return "Freelancer (Empreita)";
  if (/limpeza/.test(p) || /faxina/.test(dd)) return "Limpeza/Faxina";
  if (/presta[cç][aã]o/.test(p)) return "Prestação de Serviços";
  return "Outros";
}

function competenciaPagto(iso: string): string {
  const [y, m, dd] = iso.split("-").map(Number);
  let yy = y, mm = m;
  if (dd <= 15) { mm = m - 1; if (mm === 0) { mm = 12; yy = y - 1; } }
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

// Resultado/Contas a Pagar → Pagamento[] (folha real por pessoa).
// Colunas (1-based): A nome "Colab: X", G despesa, K plano, N vencimento, P/T valor.
export function parsePagamentos(linhas: Linha[], colaboradores: { id: string; nome: string }[]): { registros: import("@/data/types").Pagamento[]; naoCasados: string[] } {
  const sys = colaboradores.map((c) => ({ id: c.id, n: norm(c.nome) }));
  const matchId = (nome: string): string | null => {
    const p = norm(nome);
    let m = sys.find((s) => s.n === p) ?? sys.find((s) => s.n.startsWith(p)) ?? sys.find((s) => p.startsWith(s.n));
    if (!m) { const pt = p.split(" "); m = sys.find((s) => { const st = s.n.split(" "); return pt.length >= 2 && pt[0] === st[0] && st.some((x) => x === pt[1]); }); }
    return m ? m.id : null;
  };
  const iso = (v: string | number | null): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    const mm = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
    if (!mm) return null;
    let [, d, mo, y] = mm; const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };
  const registros: import("@/data/types").Pagamento[] = [];
  const naoCasados = new Set<string>();
  let seq = 0;
  for (const l of linhas) {
    const a = l[0] == null ? "" : String(l[0]);
    if (!a.startsWith("Colab:")) continue;
    const nome = a.slice(6).trim();
    const venc = iso(l[13]); // N
    const valor = moedaBR(l[19]) || moedaBR(l[15]); // T ou P
    if (!venc || valor <= 0) continue;
    const id = matchId(nome);
    if (!id) { naoCasados.add(nome); continue; }
    const tipo = tipoDePlano(String(l[10] ?? ""), String(l[6] ?? "")); // K, G
    let desc = String(l[6] ?? "").replace(/\s+/g, " ").trim();
    if (/^pagamento colabora/i.test(desc) || desc.toLowerCase() === tipo.toLowerCase()) desc = "";
    registros.push({ id: `pg_up_${++seq}`, colaboradorId: id, competencia: competenciaPagto(venc), tipo, valor: Math.round(valor * 100) / 100, dataPagamento: venc, descricao: desc || undefined });
  }
  return { registros, naoCasados: [...naoCasados] };
}
