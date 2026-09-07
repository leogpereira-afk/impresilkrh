// Repor no cadastro os status do quadro que a semente traz e o banco não tem.
//
// POR QUE ISTO EXISTE. `src/data/status.ts` é semente: só vale para quem abre o
// RH sem nada gravado. Quem já usa tem a coleção `status` no disco e na nuvem —
// e o merge do sync nunca apaga às cegas, então acrescentar uma linha naquele
// arquivo NÃO faz o status novo aparecer no cadastro de ninguém. Foi assim que
// o cadastro do Léo ganhou "Atestado médico" e "Abandono" pela tela e ficou
// diferente do arquivo.
//
// Sem isto, "criar o status Freelancer" seria uma linha de código que não muda
// nada na tela do Léo — e pior: a proposta da auditoria apontaria para um id que
// não existe, o que tira a pessoa do quadro em silêncio (statusById.get devolve
// undefined e `contaHeadcount` vira false).
//
// NADA AQUI GRAVA. A função devolve o que FALTA; o Painel de Controle mostra e
// o Léo repõe com um clique.
import { STATUS } from "@/data/status";
import type { StatusColaborador } from "@/data/types";

const chaveNome = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/**
 * Os status da semente que o cadastro não tem — prontos para criar.
 *
 * Compara por id E por nome sem acento: se o Léo já criou "Freelancer" na mão
 * pela tela, ele não pode voltar aqui como se faltasse. Um segundo status com
 * o mesmo nome e id diferente seria pior que a falta — as pessoas ficariam
 * espalhadas entre dois status iguais, e um deles fora do headcount.
 *
 * A `ordem` proposta é a da semente, mas nunca em cima de uma já ocupada: o
 * cadastro de hoje tem DOIS status na ordem 7 ("Externo" e "Atestado médico") e
 * a lista da tela ordena por esse número. Quando o número está tomado, o novo
 * vai para o fim (maior ordem existente + 1), que é onde ele pertence mesmo.
 */
export function statusPadraoFaltando(
  existentes: Pick<StatusColaborador, "id" | "nome" | "ordem">[],
  catalogo: StatusColaborador[] = STATUS,
): StatusColaborador[] {
  const ids = new Set(existentes.map((s) => String(s.id)));
  const nomes = new Set(existentes.map((s) => chaveNome(s.nome)));
  const ordens = new Set(existentes.map((s) => Number(s.ordem)).filter((n) => Number.isFinite(n)));
  let proxima = existentes.reduce((m, s) => (Number.isFinite(Number(s.ordem)) ? Math.max(m, Number(s.ordem)) : m), 0);

  const out: StatusColaborador[] = [];
  for (const padrao of catalogo) {
    if (ids.has(padrao.id) || nomes.has(chaveNome(padrao.nome))) continue;
    let ordem = padrao.ordem;
    if (ordens.has(ordem)) ordem = ++proxima;
    // Reserva o número aqui também: repor DOIS status de uma vez não pode
    // devolver os dois na mesma ordem.
    ordens.add(ordem);
    if (ordem > proxima) proxima = ordem;
    ids.add(padrao.id);
    nomes.add(chaveNome(padrao.nome));
    out.push({ ...padrao, ordem });
  }
  return out;
}
