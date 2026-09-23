// ============================================================================
// QUEM ESTÁ EM CONTRATO DE EXPERIÊNCIA — a régua, num lugar só.
//
// Ordem do Léo (23/09/2026): "a experiência ainda faz parte do onboarding".
// Então ela precisa aparecer nos cartões de Onboarding e offboarding, ao lado
// das admissões. Só que a tela de Colaboradores JÁ tinha o bloco de
// experiência, com a sua própria conta escrita dentro do componente.
//
// POR QUE ISTO VIROU ARQUIVO. Duas telas contando a mesma coisa por conta
// própria acabam discordando, e nada avisa: o Léo abre Colaboradores e lê 6, na
// tela ao lado lê 5, e a partir daí não confia em nenhuma das duas. O jeito de
// isso não acontecer não é lembrar de mexer nos dois lugares -- é não haver
// dois lugares.
//
// O QUE ESTA REGRA NÃO FAZ: não olha o campo `statusId === "experiencia"`. O
// relógio dos 90 dias corre pelas DATAS, e alguém pode estar marcado à mão como
// "Em experiência" com as datas dizendo outra coisa (ou o contrário). Quem
// explica essa divergência é `foraDaExperiencia`, e a tela de Colaboradores já
// mostra o bloco dela. Aqui devolvemos `marcado` junto para quem quiser exibir
// a diferença, mas ela não entra na conta.
// ============================================================================

import type { Colaborador } from "@/data/types";
import { HOJE } from "@/data/_gen";
import { situacaoExperiencia, type SituacaoExperiencia } from "@/lib/clt";

export interface PessoaEmExperiencia {
  c: Colaborador;
  /** O relógio dos 90 dias: fim, dias que faltam e em que fase está. */
  sit: SituacaoExperiencia;
  /** A ficha está marcada com o status "Em experiência"? Só para exibir. */
  marcado: boolean;
}

/**
 * As pessoas cujo contrato de experiência está correndo, das que terminam
 * primeiro para as que terminam depois.
 *
 * Fora da lista ficam a Direção (fundador não faz experiência) e quem
 * `situacaoExperiencia` já descarta: sem data de admissão, admissão futura,
 * experiência já decidida, desligado, ou mais de 15 dias além do prazo -- esse
 * último porque o contrato já virou por tempo indeterminado sozinho.
 */
export function quemEstaEmExperiencia(
  colaboradores: Colaborador[],
  hoje: Date = HOJE,
): PessoaEmExperiencia[] {
  return colaboradores
    .filter((c) => !c.ehDirecao)
    .map((c) => ({ c, sit: situacaoExperiencia(c, hoje), marcado: c.statusId === "experiencia" }))
    .filter((x): x is PessoaEmExperiencia => !!x.sit)
    .sort((a, b) => a.sit.diasParaFim - b.sit.diasParaFim);
}

/**
 * A frase curta do cartão: quando acaba a experiência de quem acaba primeiro.
 *
 * Devolve "" quando não há ninguém -- e aí o cartão mostra a frase dele, não
 * uma linha vazia fingindo que há informação.
 */
export function proximoFimDeExperiencia(lista: PessoaEmExperiencia[]): string {
  const primeiro = lista[0];
  if (!primeiro) return "";
  const dia = primeiro.sit.fim.toLocaleDateString("pt-BR");
  const faltam = primeiro.sit.diasParaFim;
  // Prazo estourado não vira "faltam -3 dias": o sinal negativo passa batido e
  // o caso urgente fica com a cara do tranquilo.
  if (faltam < 0) return `A de ${primeiro.c.nome} venceu em ${dia}`;
  if (faltam === 0) return `A de ${primeiro.c.nome} termina HOJE, ${dia}`;
  return `A próxima termina em ${dia} · ${faltam} dia(s)`;
}
