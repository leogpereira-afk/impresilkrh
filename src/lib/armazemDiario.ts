// Diário versionado. A base é uma cópia estável no IndexedDB, conferida por
// SHA-256 antes do uso. Nunca aplica uma diferença sobre outra base.
export type BaseRecuperacao = { hash: string; valor: string };
type Registro = Record<string, unknown> & { id: string };
type Patch = { tipo: "texto"; inicio: number; remover: number; trecho: string }
  | { tipo: "colecao"; alterados: Registro[]; removidos: string[]; ordem?: string[] };

export async function hashRecuperacao(valor: string): Promise<string | null> {
  try {
    const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(valor));
    return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, "0")).join("");
  } catch { return null; } // sem WebCrypto, a gravação usa o retrato completo
}

function colecao(valor: string): Registro[] | null {
  try {
    const itens: unknown = JSON.parse(valor);
    if (!Array.isArray(itens) || itens.some(r => !r || typeof r !== "object" || typeof r.id !== "string")) return null;
    return new Set(itens.map(r => r.id)).size === itens.length ? itens : null;
  } catch { return null; }
}

function aplicar(base: string, patch: Patch): string {
  if (patch.tipo === "texto") {
    if (!Number.isSafeInteger(patch.inicio) || !Number.isSafeInteger(patch.remover) || patch.inicio < 0 || patch.remover < 0 || patch.inicio + patch.remover > base.length || typeof patch.trecho !== "string") throw new Error("Diferença de recuperação inválida");
    return base.slice(0, patch.inicio) + patch.trecho + base.slice(patch.inicio + patch.remover);
  }
  const itens = colecao(base);
  if (!itens || patch.tipo !== "colecao" || !Array.isArray(patch.removidos) || !Array.isArray(patch.alterados)) throw new Error("Coleção de recuperação inválida");
  const porId = new Map(itens.map(r => [r.id, r]));
  for (const id of patch.removidos) porId.delete(id);
  for (const r of patch.alterados) {
    if (!r || typeof r.id !== "string") throw new Error("Registro de recuperação inválido");
    porId.set(r.id, r);
  }
  const ordem = patch.ordem ?? [...porId.keys()];
  if (ordem.length !== porId.size || new Set(ordem).size !== porId.size || ordem.some(id => !porId.has(id))) throw new Error("Ordem de recuperação inválida");
  return JSON.stringify(ordem.map(id => porId.get(id)));
}

export function criarDiario(valor: string | null, base?: BaseRecuperacao): string {
  const id = crypto.randomUUID();
  let escolhido = JSON.stringify({ v: 1, id, valor });
  if (valor === null || !base) return escolhido;
  const escolher = (patch: Patch) => {
    // Só aceita uma representação que reconstrói exatamente a escrita original.
    if (aplicar(base.valor, patch) !== valor) return;
    const candidato = JSON.stringify({ v: 1, id, base: base.hash, patch });
    if (candidato.length < escolhido.length) escolhido = candidato;
  };
  let inicio = 0;
  while (inicio < base.valor.length && inicio < valor.length && base.valor[inicio] === valor[inicio]) inicio++;
  let fim = 0;
  while (fim < base.valor.length - inicio && fim < valor.length - inicio && base.valor[base.valor.length - 1 - fim] === valor[valor.length - 1 - fim]) fim++;
  escolher({ tipo: "texto", inicio, remover: base.valor.length - inicio - fim, trecho: valor.slice(inicio, valor.length - fim) });
  const antes = colecao(base.valor); const depois = colecao(valor);
  if (antes && depois) {
    const anteriores = new Map(antes.map(r => [r.id, JSON.stringify(r)]));
    const ids = new Set(depois.map(r => r.id));
    const removidos = antes.filter(r => !ids.has(r.id)).map(r => r.id);
    const alterados = depois.filter(r => anteriores.get(r.id) !== JSON.stringify(r));
    const natural = [...antes.filter(r => ids.has(r.id)).map(r => r.id), ...depois.filter(r => !anteriores.has(r.id)).map(r => r.id)];
    const ordem = depois.map(r => r.id);
    escolher({ tipo: "colecao", alterados, removidos, ...(JSON.stringify(natural) === JSON.stringify(ordem) ? {} : { ordem }) });
  }
  return escolhido;
}

export function recuperarDiario(diario: string, base?: BaseRecuperacao): string | null {
  const dado = JSON.parse(diario);
  // Compatível com o diário completo anterior, que não tinha campo v.
  if (dado && (dado.valor === null || typeof dado.valor === "string")) return dado.valor;
  if (dado?.v !== 1 || !base || dado.base !== base.hash) throw new Error("A base de recuperação não corresponde ao diário");
  return aplicar(base.valor, dado.patch);
}
