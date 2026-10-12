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
import { idBloqueado as bloqueadoNoCadastro, idGravado as gravadoNoCadastro, idsAnteriores as idsAnterioresNoCadastro } from "../../supabase/functions/_shared/idPessoa";

export const soDigitos = (v: unknown): string => String(v ?? "").replace(/\D/g, "");

/** O ID da pessoa: 6 primeiros dígitos do CPF. Sem CPF válido, não há ID. */
export function idPessoa(cpf: unknown): string | null {
  const d = soDigitos(cpf);
  return d.length === 11 ? d.slice(0, 6) : null;
}

/* O ID GRAVADO (D-004, 12/10/2026). A ficha e o contrato de freelancer passam
   a guardar o ID no campo `idPessoa`, que nasce no servidor e não muda com o
   CPF corrigido. A régua mora em supabase/functions/_shared/idPessoa.ts (a
   porta de dados usa a mesma). Para MOSTRAR a pessoa vale o gravado; sem ele,
   o do CPF de hoje (`idPessoa(cpf)` acima continua sendo o cálculo). */
export { idBloqueado, idGravado, idDivergeDoCpf, idValido, idQueVale } from "../../supabase/functions/_shared/idPessoa";

/** O ID para mostrar: o gravado; sem ele, o do CPF de hoje, a não ser que o
 *  cadastro tenha a marca de bloqueio (o ID do CPF é ou foi de outra pessoa). */
export function idDaPessoa(c: { idPessoa?: unknown; cpf?: unknown; idPessoaBloqueado?: unknown } | null | undefined): string | null {
  return gravadoNoCadastro(c) || (bloqueadoNoCadastro(c) ? null : idPessoa(c?.cpf));
}

export const TITULO_ID_DIVERGENTE =
  "O ID gravado na ficha é diferente do começo do CPF de hoje (o CPF foi corrigido depois). Vale o gravado: é com ele que a pessoa está nas O.S., equipes e divisões do PCP. Só o admin do RH troca o ID, com motivo.";

/** As chaves com que a pessoa casa num título do ERP: o ID que vale (o
 *  gravado; sem ele, o do CPF, a não ser com a marca de bloqueio), os IDs
 *  anteriores dela e o CPF inteiro (`cpf:<11 dígitos>`). Revisão do 80e7d8f:
 *  antes casava só pelo começo do CPF, e o título "ID <de quem saiu>" caía na
 *  ficha marcada, enquanto o ID gravado diferente do CPF não casava. */
function chavesDaPessoa(c: Colaborador): string[] {
  const doCpf = soDigitos(c.cpf);
  const hoje = idDaPessoa(c);
  return [...new Set([
    ...(hoje ? [hoje] : []),
    ...idsAnterioresNoCadastro(c),
    ...(doCpf.length === 11 ? [`cpf:${doCpf}`] : []),
  ])];
}

/** ID → pessoa, só quando a chave é de UMA pessoa (dois cadastros com o mesmo
 *  ID ou o mesmo CPF não casam com ninguém). Ver chavesDaPessoa. */
export function mapaDeIds(colaboradores: Colaborador[]): Map<string, Colaborador> {
  const contagem = new Map<string, number>();
  for (const c of colaboradores) for (const k of chavesDaPessoa(c)) contagem.set(k, (contagem.get(k) ?? 0) + 1);
  const m = new Map<string, Colaborador>();
  for (const c of colaboradores) for (const k of chavesDaPessoa(c)) if (contagem.get(k) === 1) m.set(k, c);
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
  // O CPF inteiro casa com a dona dele; sem ela, o começo do CPF casa como ID.
  if (cpf) { const c = ids.get(`cpf:${cpf.slice(1).join("")}`) ?? ids.get(cpf[1] + cpf[2]); if (c) return c; }
  const soltos = [...t.matchAll(/(?<!\d)(\d{6})(?!\d)/g)].map((m) => m[1]).filter((id) => ids.has(id));
  // Dois números da MESMA pessoa (o ID e um anterior) ainda são uma pessoa só.
  const pessoas = [...new Set(soltos.map((id) => ids.get(id)!))];
  return pessoas.length === 1 ? pessoas[0] : null;
}
