// Desligar alguém na ficha: o que o botão grava e o que a tela precisa avisar.
//
// Pedido do Léo (07/09/2026): "embaixo, data do desligamento tem que ser
// incluída, e o botão desligar funcionário desliga e mantém a data no dia que
// aperta o botão — mas claro que pode editar".
//
// A regra mora aqui, e não no formulário, por um motivo concreto: esses dois
// campos juntos decidem se a pessoa está no quadro, e errar a combinação é o
// erro que a auditoria dos lançamentos mais acha. `noQuadro` (lib/dominio) é
//
//     c.statusId !== "inativo" && !c.dataDesligamento
//
// ou seja: A DATA SOZINHA JÁ TIRA A PESSOA DO QUADRO, mesmo com o status
// dizendo "Ativo". Quem preenche a data sem saber disso some do quadro do mês,
// vê a própria ficha vazia e não entende por quê.
import type { StatusColaborador } from "@/data/types";
import { diaLocalISO } from "./format";

/** O que o botão "Desligar funcionário" grava. A data é a de hoje, e é editável. */
export function desligamentoDeHoje(hoje: Date = new Date()): { statusId: string; dataDesligamento: string } {
  return { statusId: "inativo", dataDesligamento: diaLocalISO(hoje) };
}

export type TomAviso = "erro" | "atencao" | "info";

export interface AvisoDesligamento {
  tom: TomAviso;
  texto: string;
}

/**
 * O que dizer embaixo dos dois campos, para a combinação escolhida.
 *
 * Devolve `null` quando não há o que avisar — status ativo e sem data é o caso
 * normal e não merece ruído.
 */
export function avisoDoDesligamento(
  statusId: string | null | undefined,
  dataDesligamento: string | null | undefined,
  status: StatusColaborador[],
): AvisoDesligamento | null {
  const id = String(statusId ?? "");
  const data = String(dataDesligamento ?? "").slice(0, 10);
  const s = status.find((x) => x.id === id);
  const nome = s?.nome ?? id;

  // Inativo sem data: é o achado "inativo sem data de desligamento" da
  // auditoria. A pessoa sai do quadro, mas nada diz desde quando — e o mês do
  // desligamento fica sem referência para conferir a rescisão.
  if (id === "inativo" && !data) {
    return { tom: "erro", texto: "Inativo sem data: preencha para saber desde quando. Sem ela, a auditoria acusa e o mês da rescisão fica sem referência." };
  }

  // Status "ativo" é caso à parte: o salvar APAGA a data (é a regra de
  // reativação, que devolve a pessoa ao quadro). Dizer aqui que ela "sai do
  // quadro" seria o contrário do que acontece — o que a pessoa precisa saber é
  // que digitou uma data que não vai sobreviver ao Salvar.
  if (data && id === "ativo") {
    return { tom: "erro", texto: "O status é Ativo: ao salvar, esta data será apagada. Use “Desligar funcionário” ou escolha outro status." };
  }

  // Os demais status que contam no headcount (Em experiência, Aviso prévio,
  // Afastado) GUARDAM a data — e aí a data ganha: `noQuadro` exige que ela
  // esteja vazia. A pessoa some do quadro com o status dizendo o contrário. É
  // a contradição que esvazia a ficha e some com ela no mês.
  if (data && s?.contaComoAtivo) {
    return { tom: "erro", texto: `Contradição: com data preenchida a pessoa sai do quadro, mesmo marcada como “${nome}”. Apague a data ou mude o status.` };
  }

  // Data preenchida e status fora do headcount, mas que não é desligamento
  // (Direção, Externo): não é erro, mas convém dizer o que a data faz.
  if (data && !s?.contaComoAtivo && id !== "inativo") {
    return { tom: "atencao", texto: `Com data preenchida a pessoa sai do quadro a partir dela, mesmo com status “${nome}”.` };
  }

  if (data && id === "inativo") {
    return { tom: "info", texto: "Sai do quadro a partir desta data. Dá para corrigir aqui a qualquer momento." };
  }

  return null;
}

/** Faz sentido oferecer o botão "Desligar funcionário"? */
export function podeDesligar(statusId: string | null | undefined, dataDesligamento: string | null | undefined): boolean {
  // Quem já tem data não é desligado de novo — o que falta ali é editar.
  return !String(dataDesligamento ?? "").slice(0, 10);
}
