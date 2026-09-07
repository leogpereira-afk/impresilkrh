// Equivalência de contas entre duas numerações do plano do contador.
//
// Por que existe (07/09/2026): o contador renumerou o plano de contas INTEIRO
// em julho. Dos 118 lançamentos de julho, 115 mudaram de código para o mesmo
// nome, e 36 códigos passaram a ter OUTRO nome: 2.1.14 era Alimentação e virou
// Contribuição Sindical; 2.2.2 era Contribuição Sindical e virou CDL; as
// retiradas da direção saíram de 2.14.2.2 para 2.11.2.2. Tudo que classifica
// por código — rateio, encargo, individual, confidencial — passou a cair na
// conta errada, e a porta de dados deixou de cortar o que é societário.
//
// Regra da casa: código não é significado. A identidade de uma conta é o
// NOME dela DENTRO DO GRUPO em que está. Este módulo aprende a equivalência
// entre a numeração de referência (o último plano do contador) e a numeração
// que o ERP manda hoje, em quatro passos, do mais seguro para o menos:
//
//   1. identidade    — mesmo código, mesmo nome: não renumerou.
//   2. grupo         — o grupo novo (irmãos sob o mesmo pai) tem os mesmos
//                      nomes que um grupo antigo: cada filho casa pelo nome.
//   3. nome único    — o nome só existe uma vez em todo o plano de referência.
//   4. pai pelos filhos — o pai novo herda o pai antigo que os filhos já casados
//                      apontam, por maioria.
//
// O que não casa fica em `semPar`, e quem usa decide o que fazer com isso —
// nunca em silêncio. Puro, sem dependência: a Edge Function carrega uma CÓPIA
// idêntica (supabase/functions/_shared/renumeracao.ts) e um teste garante que
// as duas não divergem.

export interface ContaRef {
  codigo: string;
  nome: string;
}

export type ComoCasou = "identidade" | "grupo" | "nome-unico" | "pai-pelos-filhos";

export interface Equivalencia {
  /** Código na numeração de hoje (o que o ERP manda). */
  novo: string;
  /** Código na numeração de referência (o plano do contador). */
  antigo: string;
  nome: string;
  como: ComoCasou;
}

export interface Equivalencias {
  /** novo → antigo. Quem não renumerou aparece mapeado para si mesmo. */
  mapa: Map<string, string>;
  itens: Equivalencia[];
  /** Contas de hoje sem par na referência: conta nova, ou nome ambíguo sem grupo. */
  semPar: ContaRef[];
  /**
   * Nomes (normalizados) que na referência vivem sob um prefixo confidencial.
   * É a rede para o caso real de 07/09/2026: "Leonardo" apareceu SOZINHO em
   * 2.11.2.2, sem irmãos que o identificassem, e um nome ambíguo não casa —
   * mas "Leonardo" existe em 2.14.2.2 (retiradas). Na dúvida, esconde.
   */
  nomesConfidenciais: Set<string>;
  referenciaVazia: boolean;
  /** Competência do plano de referência (quem chama preenche). */
  referencia?: string | null;
}

/** A forma que viaja pela rede (Set e Map não passam por JSON). */
export interface EquivalenciasSerializadas {
  referencia: string | null;
  itens: Equivalencia[];
  semPar: ContaRef[];
  nomesConfidenciais: string[];
}

export function serializar(eq: Equivalencias): EquivalenciasSerializadas {
  return { referencia: eq.referencia ?? null, itens: eq.itens, semPar: eq.semPar, nomesConfidenciais: [...eq.nomesConfidenciais] };
}

export function desserializar(s: EquivalenciasSerializadas | null | undefined): Equivalencias | null {
  if (!s) return null;
  return {
    mapa: new Map(s.itens.map((i) => [i.novo, i.antigo])),
    itens: s.itens,
    semPar: s.semPar,
    nomesConfidenciais: new Set(s.nomesConfidenciais),
    referenciaVazia: s.itens.length === 0 && s.semPar.length > 0,
    referencia: s.referencia,
  };
}

export const normalizarNome = (s: string): string =>
  String(s ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const paiDe = (codigo: string): string => (codigo.includes(".") ? codigo.slice(0, codigo.lastIndexOf(".")) : "");

const sobe = (codigo: string, niveis: number): string => {
  let c = codigo;
  for (let i = 0; i < niveis; i++) c = paiDe(c);
  return c;
};

export function equivalenciasDeContas(
  referencia: ContaRef[],
  atual: ContaRef[],
  opcoes: { prefixosConfidenciais?: readonly string[] } = {},
): Equivalencias {
  const out: Equivalencias = { mapa: new Map(), itens: [], semPar: [], nomesConfidenciais: new Set(), referenciaVazia: referencia.length === 0 };
  const prefixos = opcoes.prefixosConfidenciais ?? [];
  const sobPrefixo = (c: string) => prefixos.some((p) => c === p || c.startsWith(p + "."));
  for (const r of referencia) if (r.codigo && sobPrefixo(r.codigo)) out.nomesConfidenciais.add(normalizarNome(r.nome));
  if (out.referenciaVazia) { out.semPar = [...atual]; return out; }

  const refNome = new Map<string, string>(); // código → nome normalizado
  const refPorNome = new Map<string, string[]>(); // nome normalizado → códigos
  const refFilhos = new Map<string, Map<string, string[]>>(); // pai → (nome → códigos)
  for (const r of referencia) {
    if (!r.codigo) continue;
    const n = normalizarNome(r.nome);
    refNome.set(r.codigo, n);
    refPorNome.set(n, [...(refPorNome.get(n) ?? []), r.codigo]);
    const pai = paiDe(r.codigo);
    const grupo = refFilhos.get(pai) ?? new Map<string, string[]>();
    grupo.set(n, [...(grupo.get(n) ?? []), r.codigo]);
    refFilhos.set(pai, grupo);
  }

  const casar = (novo: string, antigo: string, nome: string, como: ComoCasou) => {
    if (out.mapa.has(novo)) return;
    out.mapa.set(novo, antigo);
    out.itens.push({ novo, antigo, nome, como });
  };

  // 1. identidade
  for (const a of atual) {
    if (a.codigo && refNome.get(a.codigo) === normalizarNome(a.nome)) casar(a.codigo, a.codigo, a.nome, "identidade");
  }

  // 2. grupo: irmãos de hoje × grupos de referência, pelo conjunto de nomes
  const grupos = new Map<string, ContaRef[]>();
  for (const a of atual) {
    if (!a.codigo || out.mapa.has(a.codigo)) continue;
    const pai = paiDe(a.codigo);
    grupos.set(pai, [...(grupos.get(pai) ?? []), a]);
  }
  for (const [paiNovo, filhos] of grupos) {
    const nomes = new Set(filhos.map((f) => normalizarNome(f.nome)));
    let melhor: { pai: string; comuns: number; score: number } | null = null;
    for (const [paiRef, grupoRef] of refFilhos) {
      let comuns = 0;
      for (const n of nomes) if (grupoRef.has(n)) comuns++;
      if (comuns === 0) continue;
      const uniao = nomes.size + grupoRef.size - comuns;
      const score = comuns / uniao;
      const empate = melhor && comuns === melhor.comuns && score === melhor.score;
      const ganha = !melhor || comuns > melhor.comuns || (comuns === melhor.comuns && score > melhor.score)
        // Empate exato: o mesmo código de pai vence (não renumerou); depois o menor código, para ser determinístico.
        || (empate && (paiRef === paiNovo || (melhor!.pai !== paiNovo && paiRef < melhor!.pai)));
      if (ganha) melhor = { pai: paiRef, comuns, score };
    }
    if (!melhor) continue;
    // Um nome em comum só vale se ele for único em toda a referência —
    // "Manutenção" aparece em doze grupos e um único nome não identifica nada.
    if (melhor.comuns < 2) {
      const unico = [...nomes].some((n) => refFilhos.get(melhor!.pai)!.has(n) && (refPorNome.get(n)?.length ?? 0) === 1);
      if (!unico) continue;
    }
    const grupoRef = refFilhos.get(melhor.pai)!;
    for (const f of filhos) {
      const cods = grupoRef.get(normalizarNome(f.nome));
      if (cods && cods.length === 1) casar(f.codigo, cods[0], f.nome, "grupo");
    }
  }

  // 3. nome único em toda a referência
  for (const a of atual) {
    if (!a.codigo || out.mapa.has(a.codigo)) continue;
    const cods = refPorNome.get(normalizarNome(a.nome));
    if (cods && cods.length === 1) casar(a.codigo, cods[0], a.nome, "nome-unico");
  }

  // 4. pais pelos filhos: cada ancestral novo herda o ancestral antigo que a
  //    maioria (2/3) dos descendentes já casados aponta, no mesmo nível.
  const votos = new Map<string, Map<string, number>>();
  for (const [novo, antigo] of out.mapa) {
    for (let n = 1; ; n++) {
      const anc = sobe(novo, n);
      const ancAntigo = sobe(antigo, n);
      if (!anc || !ancAntigo) break;
      const urna = votos.get(anc) ?? new Map<string, number>();
      urna.set(ancAntigo, (urna.get(ancAntigo) ?? 0) + 1);
      votos.set(anc, urna);
    }
  }
  for (const [anc, urna] of votos) {
    if (out.mapa.has(anc)) continue;
    const total = [...urna.values()].reduce((s, v) => s + v, 0);
    const [vencedor, n] = [...urna.entries()].sort((x, y) => y[1] - x[1] || (x[0] < y[0] ? -1 : 1))[0];
    if (n * 3 >= total * 2) {
      const nome = atual.find((a) => a.codigo === anc)?.nome ?? referencia.find((r) => r.codigo === vencedor)?.nome ?? anc;
      casar(anc, vencedor, nome, "pai-pelos-filhos");
    }
  }

  out.semPar = atual.filter((a) => a.codigo && !out.mapa.has(a.codigo));
  return out;
}

/** O código pelo qual uma conta deve ser CLASSIFICADA: o de referência, se houver equivalência. */
export const codigoDeReferencia = (codigo: string, mapa?: Map<string, string> | null): string =>
  (mapa && mapa.get(codigo)) || codigo;

/**
 * Confidencial em QUALQUER das duas numerações — e, sem par, pelo NOME. Na
 * dúvida, esconder: uma conta de sócio que apareça para o RH é pior que uma
 * conta comum escondida.
 */
export function ehConfidencialEquivalente(
  conta: ContaRef,
  prefixos: readonly string[],
  eq?: Pick<Equivalencias, "mapa" | "nomesConfidenciais"> | null,
): boolean {
  const bate = (c: string) => prefixos.some((p) => c === p || c.startsWith(p + "."));
  if (bate(conta.codigo)) return true;
  if (!eq) return false;
  const ref = eq.mapa.get(conta.codigo);
  if (ref) return bate(ref);
  return eq.nomesConfidenciais.has(normalizarNome(conta.nome));
}
