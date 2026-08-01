// Agregações do módulo de Custos de Colaboradores.
// Fontes: planoContas (agregado mensal por conta) + classificacaoCustos (editável).
// O custo INDIVIDUAL por pessoa vem da folha real (pagamentos.ts); aqui tratamos
// os totais por classe (individual/rateio/encargo/confidencial) e o comparativo.
import type { ContaPlano, ClassificacaoConta, ClasseCusto } from "@/data/types";
import { idConta } from "@/data/planoContas";
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

/**
 * Meses que a tela pode mostrar: os do plano de contas MAIS os que têm folha.
 *
 * A lista vinha só do plano de contas, e o plano é uma planilha que o contador
 * manda depois do mês fechado. Resultado real em 01/08/2026: a base tinha
 * pagamento de agosto/2025 a julho/2026 e o seletor só oferecia janeiro a junho
 * — sete competências de folha, incluindo o mês corrente, eram invisíveis. Quem
 * olhava concluía que o dado não tinha entrado.
 */
export function competenciasComDados(
  plano: ContaPlano[],
  pagamentos: { competencia: string }[],
): string[] {
  const s = new Set<string>(plano.map((p) => p.competencia));
  for (const p of pagamentos) if (p.competencia) s.add(p.competencia);
  return [...s].sort();
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
  return brutos.map((b) => ({ id: idConta(competencia, b.codigo), competencia, codigo: b.codigo, nome: b.nome, valor: Math.round(b.valor * 100) / 100, folha: ehFolha(b.codigo) }));
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

// Regra de competência da folha: vencimento até o dia 15 pertence ao mês
// ANTERIOR. Exportada porque a importação do ERP (mubiPagamentos.ts) precisa da
// MESMA regra — duas cópias dela já fizeram o mesmo dinheiro cair em dois meses.
export function competenciaPagto(iso: string): string {
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
    // Descrição: pega a mais informativa entre "Despesa" (G) e "Descrição" (H),
    // ignorando as genéricas ("Pagamento Colaborador" ou repetição do próprio tipo).
    // Ex.: Despesa "INCENTIVO DE PRODUTIVIDADE" + Descrição "Portas Adriano" → usa "Portas Adriano".
    const semAcento = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    const generico = (s: string) => !s || /^pagamento colabora/i.test(s) || semAcento(s) === semAcento(tipo);
    const g = String(l[6] ?? "").replace(/\s+/g, " ").trim(); // Despesa
    const h = String(l[7] ?? "").replace(/\s+/g, " ").trim(); // Descrição
    const desc = [g, h].filter((s) => !generico(s)).sort((a, b) => b.length - a.length)[0] ?? "";
    registros.push({ id: `pg_up_${lote}_${++seq}`, colaboradorId: id, competencia: competenciaPagto(venc), tipo, valor: Math.round(valor * 100) / 100, dataPagamento: venc, descricao: desc || undefined });
  }

  // PASSO 3: FGTS por funcionário. As linhas de FGTS NÃO começam com "Colab:"
  // (fornecedor "FGTS"/"Não definido"), mas quando têm o nome da pessoa na
  // descrição (ex.: "FGTS OSMANE", "fgts Camila") são um encargo daquele
  // colaborador — atribui a ele com tipo "FGTS". O FGTS mensal da folha inteira
  // (descrição só "FGTS", sem nome) não casa e fica de fora (segue estimado).
  const limparFgts = (s: string) =>
    s.replace(/f[gt]?g?ts|rescis[aã]o|recis[aã]o|rescis[oó]rio|guia|recolhimento|regular|colaboradores?|\bdo\b|\bde\b|\bda\b/gi, " ")
      .replace(/\s+/g, " ").trim();
  for (const l of linhas) {
    if (String(l[0] ?? "").startsWith("Colab:")) continue; // já tratado no passo 2
    const g = String(l[6] ?? ""); const h = String(l[7] ?? "");
    if (!/fgts/i.test(`${g} ${h}`)) continue; // não é FGTS
    const venc = iso(l[13]);
    const valor = moedaBR(l[19]) || moedaBR(l[15]);
    if (!venc || valor <= 0) continue;
    const nomeAlvo = limparFgts(`${h} ${g}`); // sobra o nome, se houver
    const id = nomeAlvo ? casarNome(nomeAlvo) : null;
    if (!id) continue; // FGTS sem nome (mensal da folha) → coletivo, não atribui
    const detalhe = String(h || g).replace(/\s+/g, " ").trim();
    registros.push({ id: `pg_up_${lote}_${++seq}`, colaboradorId: id, competencia: competenciaPagto(venc), tipo: "FGTS", valor: Math.round(valor * 100) / 100, dataPagamento: venc, descricao: detalhe || undefined });
  }
  return { registros, naoCasados: [...naoCasados], cpfsAprendidos: [...aprendidos.values()].map((v) => ({ colaboradorId: v.id, cpf: v.fmt })) };
}

// ===================== Conciliação de importação (idempotente) =====================
// Ao subir a MESMA planilha de novo, comparamos linha a linha com o que já existe
// (nas competências da planilha) e classificamos em 4 grupos, para mexer só no que
// mudou — e mostrar isso ao usuário antes de aplicar:
//   • iguais     → mesma identidade e valor. Não mexe no valor; se a DESCRIÇÃO
//                  mudou (ex.: agora puxa a coluna "Descrição"), atualiza só ela.
//   • alterados  → mesma pessoa/mês/tipo/data, VALOR diferente: corrige.
//   • novos      → não existiam: insere.
//   • ausentes   → existem no sistema mas NÃO vieram na planilha (ex.: lançamento
//                  manual, ou linha removida da folha). Mantidos por padrão.
// A descrição NÃO faz parte da identidade — senão, mudar o texto duplicaria o
// lançamento. Ela é tratada como um campo que pode ser atualizado.
type Pag = import("@/data/types").Pagamento;
export interface DiffPagamentos {
  iguais: { antigo: Pag; novo: Pag }[];
  alterados: { antigo: Pag; novo: Pag }[];
  novos: Pag[];
  ausentes: Pag[];
}
const dia10 = (s?: string | null) => String(s ?? "").slice(0, 10);
// Identidade + valor: identifica a MESMA linha (a descrição fica de fora).
const sigCompleta = (p: Pag) => `${p.colaboradorId}|${p.competencia}|${p.tipo}|${dia10(p.dataPagamento)}|${Math.round((p.valor ?? 0) * 100)}`;
// Chave de identidade (sem valor): a MESMA linha com valor corrigido.
const chaveNegocio = (p: Pag) => `${p.colaboradorId}|${p.competencia}|${p.tipo}|${dia10(p.dataPagamento)}`;

function multimap(itens: Pag[], chave: (p: Pag) => string): Map<string, Pag[]> {
  const m = new Map<string, Pag[]>();
  for (const p of itens) { const arr = m.get(chave(p)); if (arr) arr.push(p); else m.set(chave(p), [p]); }
  return m;
}

/** Identidade do título no ERP (campo novo; o prefixo do id é o formato antigo). */
export const idMubiDe = (p: Pag): string | null =>
  p.idMubi ? String(p.idMubi) : (String(p.id ?? "").startsWith("mubi-") ? String(p.id).slice(5) : null);
export const ehDoMubi = (p: Pag) => idMubiDe(p) != null;

/**
 * Concilia o que o ERP mandou com o que já está no sistema.
 *
 * `janela` são as competências que a busca realmente cobriu. Só o que está
 * DENTRO dela pode ser dado como ausente — sem esse recorte, importar agosto
 * listava a folha inteira de julho como "fora da planilha" e oferecia apagá-la.
 */
export function conciliarPagamentos(existentes: Pag[], novos: Pag[], janela?: Set<string>): DiffPagamentos {
  const temErp = novos.some(ehDoMubi);
  if (!temErp) return recortarAusentes(conciliarPorAssinatura(existentes, novos), janela);

  // 1) CASA PELO ID DO ERP. É a identidade de verdade: mudou data, valor,
  //    classificação ou até a pessoa, continua sendo o mesmo título.
  const porId = new Map<string, Pag>();
  for (const p of existentes) { const k = idMubiDe(p); if (k) porId.set(k, p); }

  const iguais: { antigo: Pag; novo: Pag }[] = [];
  const alterados: { antigo: Pag; novo: Pag }[] = [];
  const semPar: Pag[] = [];
  const casados = new Set<string>();

  for (const n of novos) {
    const k = idMubiDe(n);
    const antigo = k ? porId.get(k) : undefined;
    if (!antigo) { semPar.push(n); continue; }
    casados.add(antigo.id);
    (mudouAlgo(antigo, n) ? alterados : iguais).push({ antigo, novo: n });
  }

  // 2) ADOÇÃO: o título do ERP que ainda não tem par por id procura, entre os
  //    registros SEM id do ERP, a mesma linha por pessoa+competência+data+valor.
  //
  //    É o caso da base real: 593 pagamentos vieram de planilha e nenhum tem id
  //    do ERP. Sem esta etapa, a primeira importação casaria por assinatura, o
  //    registro continuaria sem identidade, e na busca seguinte — bastando o ERP
  //    corrigir um vencimento — o mesmo título entraria como novo. A duplicata
  //    que a trava existe para impedir, no único cenário que existe hoje.
  //
  //    O TIPO fica de fora da comparação de propósito: a planilha e o ERP
  //    classificam de formas diferentes (o DE_PARA do ERP nem existia quando a
  //    planilha foi importada), e exigir tipo igual faria a adoção falhar e
  //    duplicar tudo na primeira importação.
  const livres = existentes.filter((p) => !ehDoMubi(p) && !casados.has(p.id));
  const porLinha = multimap(livres, chaveSemTipo);
  const novosFinal: Pag[] = [];
  for (const n of semPar) {
    const arr = porLinha.get(chaveSemTipo(n));
    const antigo = arr && arr.length ? arr.pop()! : undefined;
    if (!antigo) { novosFinal.push(n); continue; }
    casados.add(antigo.id);
    // Adotado: mantém o id do registro (não quebra referência nem sync) e passa
    // a carregar o idMubi. Daqui para frente casa por id, não por assinatura.
    alterados.push({ antigo, novo: { ...n, id: antigo.id } });
  }

  const ausentes = existentes.filter((p) => !casados.has(p.id));
  return recortarAusentes({ iguais, alterados, novos: novosFinal, ausentes }, janela);
}

/** Mudou algo que precisa ser gravado? */
function mudouAlgo(a: Pag, b: Pag): boolean {
  return (
    Math.round((a.valor ?? 0) * 100) !== Math.round((b.valor ?? 0) * 100) ||
    dia10(a.dataPagamento) !== dia10(b.dataPagamento) ||
    a.competencia !== b.competencia ||
    a.tipo !== b.tipo ||
    a.colaboradorId !== b.colaboradorId ||
    idMubiDe(a) !== idMubiDe(b) ||
    (a.descricao ?? "").trim() !== (b.descricao ?? "").trim()
  );
}

/** Linha sem o tipo — a planilha e o ERP classificam diferente. */
const chaveSemTipo = (p: Pag) =>
  `${p.colaboradorId}|${p.competencia}|${dia10(p.dataPagamento)}|${Math.round((p.valor ?? 0) * 100)}`;

/**
 * "Ausente" só vale dentro da janela que a busca cobriu.
 *
 * Sem isto, importar um mês listava como "fora da planilha" tudo o que estava
 * gravado nos outros meses — e o checkbox de remover, ao lado, apagaria folha
 * boa com um clique. O contador ainda crescia a cada importação, treinando o
 * usuário a marcar a caixa.
 */
function recortarAusentes(d: DiffPagamentos, janela?: Set<string>): DiffPagamentos {
  if (!janela) return d;
  return { ...d, ausentes: d.ausentes.filter((p) => janela.has(p.competencia)) };
}

/** Regra da PLANILHA: sem id estável, a identidade é a assinatura da linha. */
function conciliarPorAssinatura(existentes: Pag[], novos: Pag[]): DiffPagamentos {
  // 1) casa por identidade + valor (multiconjunto). Guarda o par para poder
  //    atualizar a descrição do existente se o texto mudou.
  const porSig = multimap(existentes, sigCompleta);
  const iguais: { antigo: Pag; novo: Pag }[] = [];
  const novosResto: Pag[] = [];
  for (const n of novos) {
    const arr = porSig.get(sigCompleta(n));
    if (arr && arr.length) iguais.push({ antigo: arr.pop()!, novo: n }); // mesma linha → mantém o existente
    else novosResto.push(n);
  }
  const existResto: Pag[] = [];
  for (const arr of porSig.values()) existResto.push(...arr);

  // 2) do que sobrou, casa por chave de negócio (valor mudou) = alterado
  const porChave = multimap(existResto, chaveNegocio);
  const alterados: { antigo: Pag; novo: Pag }[] = [];
  const novosFinal: Pag[] = [];
  for (const n of novosResto) {
    const arr = porChave.get(chaveNegocio(n));
    if (arr && arr.length) alterados.push({ antigo: arr.pop()!, novo: n });
    else novosFinal.push(n);
  }
  const ausentes: Pag[] = [];
  for (const arr of porChave.values()) ausentes.push(...arr);

  return { iguais, alterados, novos: novosFinal, ausentes };
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

// ===================== Conferência da competência =====================
//
// Por que existe: em 01/08/2026 julho apareceu com os 27 adiantamentos e NENHUM
// salário, e a tela mostrou o mês pela metade sem dizer por quê — parecia dado
// perdido. Não era. O salário de uma competência vence no início do mês
// SEGUINTE (dias 5 a 7 nas últimas doze), então o mês corrente sempre parece
// incompleto até o ERP lançar a folha.
//
// A janela da competência vai do dia 16 do mês anterior ao dia 15 do seguinte —
// a mesma regra de `competenciaPagto` aqui e de `janelaDaCompetencia` na Edge
// Function. Antes de a janela fechar, salário faltando é ESPERA; depois dela é
// buraco de verdade, e aí a varredura do histórico é o conserto.
//
// O sinal escolhido é por pessoa, não estatístico: quem recebeu ADIANTAMENTO e
// não tem salário na mesma competência. Adiantamento é a primeira metade do
// salário — se ele saiu, a segunda metade existe. Comparar com a média dos
// meses anteriores daria alarme falso em mês de admissão e demissão.

export type EstadoCompetencia = "completa" | "aguardando" | "incompleta";

export interface DiagnosticoCompetencia {
  estado: EstadoCompetencia;
  titulo: string;
  detalhe: string;
  /** Quem recebeu adiantamento na competência e ficou sem salário nenhum. */
  semSalario: { id: string; nome: string }[];
}

// Rescisão faz as vezes de salário: quem foi desligado no mês recebe ela no
// lugar, e cobrar salário dessa pessoa seria alarme falso.
const CONTA_COMO_SALARIO = ["Salário", "Rescisão"];

/** Último dia em que um título ainda cai nesta competência (dia 15 do mês seguinte). */
export function fimDaCompetencia(comp: string): Date | null {
  const [ano, mes] = comp.split("-").map(Number);
  if (!ano || !mes || mes < 1 || mes > 12) return null;
  return new Date(ano, mes, 15);
}

/** Quando o salário desta competência costuma cair (início do mês seguinte). */
export function previsaoDoSalario(comp: string): Date | null {
  const [ano, mes] = comp.split("-").map(Number);
  if (!ano || !mes || mes < 1 || mes > 12) return null;
  return new Date(ano, mes, 5);
}

const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;

export function conferirCompetencia(
  comp: string,
  pagamentos: Pag[],
  pessoas: { id: string; nome: string }[],
  hoje: Date = new Date(),
): DiagnosticoCompetencia {
  const nada: DiagnosticoCompetencia = { estado: "completa", titulo: "", detalhe: "", semSalario: [] };
  const fim = fimDaCompetencia(comp);
  const previsao = previsaoDoSalario(comp);
  if (!fim || !previsao) return nada;

  const doMes = pagamentos.filter((p) => p.competencia === comp);
  if (doMes.length === 0) return nada; // o "sem pagamentos neste mês" da tela já fala por si

  // Comparação por DIA, no fuso local: usar a hora corrente faria a competência
  // "fechar" no meio do próprio dia 15.
  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  const janelaAberta = hojeDia <= fim.getTime();

  const comSalario = new Set(doMes.filter((p) => CONTA_COMO_SALARIO.includes(p.tipo)).map((p) => p.colaboradorId));
  const comAdiantamento = new Set(doMes.filter((p) => p.tipo === "Adiantamento").map((p) => p.colaboradorId));
  const nomePorId = new Map(pessoas.map((p) => [p.id, p.nome]));
  const semSalario = [...comAdiantamento]
    .filter((id) => !comSalario.has(id))
    .map((id) => ({ id, nome: nomePorId.get(id) ?? "(fora do cadastro)" }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  if (semSalario.length === 0) return nada;

  const folhaInteira = comSalario.size === 0; // ninguém: é a folha toda que não foi lançada

  if (janelaAberta) {
    return {
      estado: "aguardando",
      titulo: folhaInteira
        ? "O salário desta competência ainda não foi lançado no ERP"
        : `${semSalario.length} ${semSalario.length === 1 ? "pessoa ainda está" : "pessoas ainda estão"} sem salário nesta competência`,
      detalhe: folhaInteira
        ? `Os ${comAdiantamento.size} adiantamentos já entraram. O salário de ${compLabelLongo(comp)} vence por volta de ${ddmm(previsao)} e só existe no Mubisys na semana do pagamento — por isso o mês aparece pela metade. Não falta dado: falta a data chegar.`
        : `A folha de ${compLabelLongo(comp)} ainda está sendo lançada — a competência só fecha em ${ddmm(fim)}. Quem já tem salário aparece normalmente.`,
      semSalario,
    };
  }

  return {
    estado: "incompleta",
    titulo: folhaInteira
      ? "Esta competência não tem nenhum salário lançado"
      : `${semSalario.length} ${semSalario.length === 1 ? "pessoa recebeu adiantamento e não tem" : "pessoas receberam adiantamento e não têm"} salário`,
    detalhe: `A competência fechou em ${ddmm(fim)} e ${folhaInteira ? "não há um único salário nela" : "essas pessoas ficaram só com o adiantamento"}. Use "Puxar histórico" para trazer o que faltou do Mubisys; se continuar faltando depois disso, o título existe no ERP em outro nome ou com outro CPF e aparece na lista de não encontrados.`,
    semSalario,
  };
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
      if (!st.length) continue;
      // input de 1 token exige 1º nome IGUAL (não prefixo): "Carl" não casa "Carlos".
      const primeiroOk = pt.length === 1 ? st[0] === pt[0] : tokensIguais(pt[0], st[0]);
      if (!primeiroOk) continue; // 1º nome tem de bater
      let sc = 0;
      for (const tok of pt) if (st.some((t) => tokensIguais(t, tok))) sc++;
      if (sc > mx) { mx = sc; melhor = [{ id: s.id, n: s.n }]; }
      else if (sc === mx && sc > 0) melhor.push({ id: s.id, n: s.n });
    }
    // input com 2+ tokens precisa casar PELO MENOS 2 tokens (não basta o 1º nome) —
    // evita jogar "Maria Silva" em "Maria Souza".
    if (pt.length >= 2 && mx < 2) return null;
    if (melhor.length === 0) return null;
    if (melhor.length === 1) return melhor[0].id;
    const bases = new Set(melhor.map((m) => baseNome(m.n)));
    if (bases.size === 1) return melhor.reduce((a, b) => (a.n.length <= b.n.length ? a : b)).id; // "X" vs "X (2)"
    return null; // ambíguo de verdade → não chuta
  };
}
