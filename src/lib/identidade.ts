// A identidade da pessoa: o ID.
//
// Decisão do Leonardo (17/08/2026, reafirmada em 07/09): a pessoa existe uma
// vez, e a chave é o ID = os 6 primeiros dígitos do CPF (únicos entre as 93
// fichas; conferido). O NOME é dado de exibição: tem acento, forma curta e
// longa, grafia que varia ("Golçalves"/"GONCALVES") e se repete. Casar por
// nome é palpite — e palpite erra em silêncio, para mais (sósia) ou para
// menos (a pessoa some da folha).
//
// Aqui mora a régua, e só ela: quem casa pagamento com pessoa usa estas
// funções; quem mostra a pessoa na tela mostra o ID ao lado do nome.
import type { Colaborador } from "@/data/types";

export const soDigitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** O ID da pessoa: 6 primeiros dígitos do CPF. Sem CPF válido, não há ID. */
export function idPessoa(cpf: unknown): string | null {
  const d = soDigitos(cpf);
  return d.length === 11 ? d.slice(0, 6) : null;
}

/** ID → pessoa, só quando o ID é único (dois cadastros com o mesmo CPF não casam com ninguém). */
export function mapaDeIds(colaboradores: Colaborador[]): Map<string, Colaborador> {
  const contagem = new Map<string, number>();
  for (const c of colaboradores) { const id = idPessoa(c.cpf); if (id) contagem.set(id, (contagem.get(id) ?? 0) + 1); }
  const m = new Map<string, Colaborador>();
  for (const c of colaboradores) { const id = idPessoa(c.cpf); if (id && contagem.get(id) === 1) m.set(id, c); }
  return m;
}

/**
 * Acha a pessoa pelo ID escrito num texto (origem ou descrição do título do
 * ERP), do mais explícito para o menos:
 *   1. "ID 123456", "ID: 123456", "#123456";
 *   2. um CPF inteiro (11 dígitos, com ou sem pontuação);
 *   3. um número de 6 dígitos solto — só se for de UMA pessoa conhecida.
 * Datas escritas com barra ou hífen ("08/2026", "2026-08-15") não viram ID:
 * os separadores impedem a sequência de 6 dígitos.
 */
export function acharPorIdNoTexto(texto: string, ids: Map<string, Colaborador>): Colaborador | null {
  const t = String(texto ?? "");
  if (!t || ids.size === 0) return null;
  const explicito = t.match(/\b(?:ID|IDENT(?:IDADE)?)\s*[:#.-]?\s*(\d{6})\b|#(\d{6})\b/i);
  if (explicito) { const id = explicito[1] ?? explicito[2]; const c = ids.get(id); if (c) return c; }
  const cpf = t.match(/(?<!\d)(\d{3})\.?(\d{3})\.?(\d{3})-?(\d{2})(?!\d)/);
  if (cpf) { const c = ids.get(cpf[1] + cpf[2]); if (c) return c; }
  const soltos = [...t.matchAll(/(?<!\d)(\d{6})(?!\d)/g)].map((m) => m[1]).filter((id) => ids.has(id));
  const unicos = [...new Set(soltos)];
  return unicos.length === 1 ? ids.get(unicos[0])! : null;
}
