// Agregações do módulo de Custos de Colaboradores.
// Fontes: planoContas (agregado mensal por conta) + classificacaoCustos (editável).
// O custo INDIVIDUAL por pessoa vem da folha real (pagamentos.ts); aqui tratamos
// os totais por classe (individual/rateio/encargo/confidencial) e o comparativo.
import type { ContaPlano, ClassificacaoConta, ClasseCusto } from "@/data/types";
import { MESES_PT } from "@/lib/format";

export function classeMap(cls: ClassificacaoConta[]): Map<string, ClasseCusto> {
  return new Map(cls.map((c) => [c.codigo, c.classe]));
}
// Prefixos de contas societárias confidenciais (só o gestor master vê/edita).
const PREFIXOS_CONFIDENCIAIS = ["2.14.1", "2.14.2"];
export const ehContaConfidencial = (codigo: string): boolean =>
  PREFIXOS_CONFIDENCIAIS.some((p) => codigo === p || codigo.startsWith(p + "."));
// Confidencial por prefixo SEMPRE prevalece (mesmo sem classificação salva), para
// que um upload novo nunca exponha 2.14.* no rateio nem no editor de não-master.
export const classeDe = (codigo: string, m: Map<string, ClasseCusto>): ClasseCusto =>
  ehContaConfidencial(codigo) ? "confidencial" : (m.get(codigo) ?? "ignorar");

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

// Classifica a descrição/plano nos 14 tipos canônicos (NÃO cria tipos novos).
// Olha plano + descrição juntos; ordem do mais específico ao mais genérico — o
// primeiro padrão que casar vence. Cobre as variações reais da planilha:
//   Plano de Saúde  ← amil, unimed, saúde, odonto
//   Vale Transporte ← vale transporte, vt
//   Adiantamento    ← adiantamento (colaborador/salário)
//   Férias          ← férias, pagamento férias, férias <nome>
//   Rescisão        ← rescisão
//   Comissão        ← comissão, comissão produção
//   Limpeza/Faxina  ← faxina, faxinas, limpeza
//   Freelancer      ← empreita (sábado/aeroporto/shopping/Sicoob), freelancer
//   Horas Extras    ← hora extra, plantão, plantões, sábado
//   Incentivo Prod. ← incentivo de produtividade, produtividade
//   Incentivo Viag. ← viagem, viagens
//   Salário         ← salário, adicional de salário, pagamento, pagamento colaborador
//   Outros          ← documento saveiro, retirada de adesivo, licenciamento, adicional <nome>
// NOTA: "Adicional <nome>", "Plantão" e "Empreita" são casos a confirmar (ver chat).
export function classificarPagamento(plano: string, desp: string): string {
  const t = `${plano} ${desp}`.toLowerCase();
  if (/amil|unimed|sa[uú]de|odonto|plano de sa/.test(t)) return "Plano de Saúde";
  if (/vale ?transporte|\bvt\b/.test(t)) return "Vale Transporte";
  if (/adiantamento/.test(t)) return "Adiantamento";
  if (/f[eé]rias/.test(t)) return "Férias";
  if (/rescis/.test(t)) return "Rescisão";
  if (/comiss/.test(t)) return "Comissão";
  if (/faxina|limpeza/.test(t)) return "Limpeza/Faxina";
  if (/empreita|freela/.test(t)) return "Freelancer (Empreita)";
  if (/hora ?extra|plant[ãa]o|s[áa]bado/.test(t)) return "Horas Extras";
  if (/produtividade/.test(t)) return "Incentivo de Produtividade";
  if (/viage[mn]/.test(t)) return "Incentivo de Viagens";
  if (/presta[cç][aã]o/.test(t)) return "Prestação de Serviços";
  if (/sal[aá]rio|pagamento/.test(t)) return "Salário";
  return "Outros";
}
const tipoDePlano = classificarPagamento; // alias usado pelo parsePagamentos

function competenciaPagto(iso: string): string {
  const [y, m, dd] = iso.split("-").map(Number);
  let yy = y, mm = m;
  if (dd <= 15) { mm = m - 1; if (mm === 0) { mm = 12; yy = y - 1; } }
  return `${yy}-${String(mm).padStart(2, "0")}`;
}

// Resultado/Contas a Pagar → Pagamento[] (folha real por pessoa).
// Colunas (1-based): A nome "Colab: X", G despesa, K plano, N vencimento, P/T valor.
export function parsePagamentos(
  linhas: Linha[],
  colaboradores: { id: string; nome: string; cpf?: string | null }[],
): { registros: import("@/data/types").Pagamento[]; naoCasados: string[]; cpfsAprendidos: { colaboradorId: string; cpf: string }[] } {
  const casarNome = criarCasadorDeNomes(colaboradores); // reserva (vencedor claro)
  const soDigitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
  const iso = (v: string | number | null): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    const mm = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(s);
    if (!mm) return null;
    const [, d, mo, y] = mm; const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };
  // CPF MANDA (coluna C): à prova de nome truncado/xará. O nome é só reserva.
  const porCpf = new Map<string, string>(); // cpf(11 díg.) → colaboradorId
  for (const c of colaboradores) { const dg = soDigitos(c.cpf); if (dg.length === 11) porCpf.set(dg, c.id); }
  const aprendidos = new Map<string, { id: string; fmt: string }>(); // p/ preencher cadastro
  const linhasColab = linhas.filter((l) => String(l[0] ?? "").startsWith("Colab:"));

  // PASSO 1: aprende CPF→id pelos nomes que casam com vencedor claro. Assim, mesmo
  // sem CPF no cadastro, uma linha só com o 1º nome (ex.: "REINALDO") casa pelo
  // CPF se outra linha do mesmo CPF trouxe o nome completo — e preenche o cadastro.
  for (const l of linhasColab) {
    const cpf = soDigitos(l[2]); // coluna C
    if (cpf.length !== 11 || porCpf.has(cpf)) continue;
    const id = casarNome(String(l[0]).slice(6).trim());
    if (id) { porCpf.set(cpf, id); aprendidos.set(cpf, { id, fmt: String(l[2]).trim() }); }
  }

  // PASSO 2: lança tudo (qualquer tipo, inclusive "Outros", entra no total da pessoa).
  const registros: import("@/data/types").Pagamento[] = [];
  const naoCasados = new Set<string>();
  const lote = Date.now().toString(36);
  let seq = 0;
  for (const l of linhasColab) {
    const nome = String(l[0]).slice(6).trim();
    const venc = iso(l[13]); // N
    const valor = moedaBR(l[19]) || moedaBR(l[15]); // T ou P
    if (!venc || valor <= 0) continue;
    const cpf = soDigitos(l[2]);
    const id = (cpf.length === 11 ? porCpf.get(cpf) : undefined) ?? casarNome(nome);
    if (!id) { naoCasados.add(nome); continue; }
    const tipo = tipoDePlano(String(l[10] ?? ""), String(l[6] ?? "")); // K, G
    let desc = String(l[6] ?? "").replace(/\s+/g, " ").trim();
    if (/^pagamento colabora/i.test(desc) || desc.toLowerCase() === tipo.toLowerCase()) desc = "";
    registros.push({ id: `pg_up_${lote}_${++seq}`, colaboradorId: id, competencia: competenciaPagto(venc), tipo, valor: Math.round(valor * 100) / 100, dataPagamento: venc, descricao: desc || undefined });
  }
  return { registros, naoCasados: [...naoCasados], cpfsAprendidos: [...aprendidos.values()].map((v) => ({ colaboradorId: v.id, cpf: v.fmt })) };
}

// Importação SÓ das comissões, casando por NOME (caso à parte; o fluxo normal por
// CPF segue para o resto). Pega as linhas cujo plano/descrição classificam como
// "Comissão" e usa a competência da própria data de vencimento.
export function parseComissoesPorNome(
  linhas: Linha[],
  colaboradores: { id: string; nome: string }[],
): { registros: import("@/data/types").Pagamento[]; naoCasados: string[]; total: number } {
  const casar = criarCasadorDeNomes(colaboradores);
  const dataBR = (v: string | number | null): string | null => {
    if (v == null) return null;
    const mm = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(String(v).trim());
    if (!mm) return null;
    const [, d, mo, y] = mm; const yy = y.length === 2 ? "20" + y : y;
    return `${yy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };
  const registros: import("@/data/types").Pagamento[] = [];
  const naoCasados = new Set<string>();
  const lote = Date.now().toString(36);
  let seq = 0; let total = 0;
  for (const l of linhas) {
    const a = String(l[0] ?? "");
    if (!a.startsWith("Colab:")) continue;
    if (classificarPagamento(String(l[10] ?? ""), String(l[6] ?? "")) !== "Comissão") continue; // só comissões
    const venc = dataBR(l[13]);
    const valor = moedaBR(l[19]) || moedaBR(l[15]);
    if (!venc || valor <= 0) continue;
    const nome = a.slice(6).trim();
    const id = casar(nome);
    if (!id) { naoCasados.add(nome); continue; }
    const v2 = Math.round(valor * 100) / 100;
    total += v2;
    registros.push({ id: `cm_${lote}_${++seq}`, colaboradorId: id, competencia: competenciaPagto(venc), tipo: "Comissão", valor: v2, dataPagamento: venc });
  }
  return { registros, naoCasados: [...naoCasados], total: Math.round(total * 100) / 100 };
}

// ---- Reuso para importadores por nome (comissões das vendedoras, limpeza) ----
// Mesma lógica de moeda e de casamento de nome do parsePagamentos, exposta para
// listas simples (nome + valor). NÃO cria colaboradores: nome que não bater é
// devolvido para conferência.
export function valorBR(v: string | number | null): number { return moedaBR(v); }

// Dois tokens "iguais" se um é prefixo do outro (cobre truncamento e abreviação:
// "ferreira" ~ "f", "perei" ~ "pereira").
const tokensIguais = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);
const baseNome = (nn: string) => nn.replace(/\s*\(?\d+\)?$/, "").trim(); // remove sufixo "(2)"

// Casador de nomes robusto: pontua cada colaborador pelos tokens em comum (o
// PRIMEIRO nome precisa bater) e só aceita um VENCEDOR CLARO. Empate entre o
// mesmo nome + "(2)" → pega o original; empate entre pessoas diferentes (ex.:
// dois "Reinaldo") → retorna null (não chuta — vira "não casado" para conferir).
// É o que faz a planilha real (nomes truncados, acentos, abreviações) casar
// certo pelo NOME, sem atribuir pagamento à pessoa errada.
export function criarCasadorDeNomes(colaboradores: { id: string; nome: string }[]): (nome: string) => string | null {
  const sys = colaboradores.map((c) => ({ id: c.id, n: norm(c.nome) }));
  return (nome: string): string | null => {
    const p = norm(nome);
    if (!p) return null;
    const pt = p.split(" ");
    let mx = 0;
    let melhor: { id: string; n: string }[] = [];
    for (const s of sys) {
      const st = s.n.split(" ");
      if (!st.length || !tokensIguais(pt[0], st[0])) continue; // 1º nome tem de bater
      let sc = 0;
      for (const tok of pt) if (st.some((t) => tokensIguais(t, tok))) sc++;
      if (sc > mx) { mx = sc; melhor = [{ id: s.id, n: s.n }]; }
      else if (sc === mx && sc > 0) melhor.push({ id: s.id, n: s.n });
    }
    if (melhor.length === 0) return null;
    if (melhor.length === 1) return melhor[0].id;
    const bases = new Set(melhor.map((m) => baseNome(m.n)));
    if (bases.size === 1) return melhor.reduce((a, b) => (a.n.length <= b.n.length ? a : b)).id; // "X" vs "X (2)"
    return null; // ambíguo de verdade → não chuta
  };
}
