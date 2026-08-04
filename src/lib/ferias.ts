// ============================================================================
// Quem está de férias HOJE.
//
// O registro de férias tem um campo de texto `status` ("Em aberto", "Agendada",
// "Em andamento", "Concluída") preenchido à mão. Ninguém volta na tela para
// avançar esse texto quando o calendário vira: período que começou continua
// escrito "Agendada" e período que terminou continua "Em andamento". Contar por
// esse texto errava nos DOIS sentidos — contava quem já voltou e não contava
// quem está fora agora.
//
// A verdade está nas DATAS. Este helper é a fonte única de "está de férias
// agora"; as telas devem usá-lo em vez de comparar o texto do status.
// ============================================================================
import { parseData } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { Ferias } from "@/data/types";

/**
 * O período está em curso na data informada?
 * Regra: dataInicio <= hoje < dataRetorno (no dia do retorno a pessoa já voltou
 * ao trabalho).
 *
 * "Concluída"/"Cancelada" continuam mandando: são decisão explícita de quem
 * lançou (voltou antes, ou o período não aconteceu) e as datas não devem
 * atropelar isso. Registro sem uma das duas datas não conta — sem elas não dá
 * para afirmar que a pessoa está fora hoje.
 */
export function feriasEmCurso(f: Ferias, hoje: Date = HOJE): boolean {
  if (f.status === "Concluída" || f.status === "Cancelada") return false;
  const inicio = parseData(f.dataInicio);
  const retorno = parseData(f.dataRetorno);
  if (!inicio || !retorno) return false;
  /* Compara DIA com DIA, não instante com instante.
     "Está de férias hoje?" é pergunta de calendário: ou o dia está dentro do
     período, ou não está — a hora em que alguém abriu a tela não muda isso.
     Comparando instantes, o banco (que guarda "2026-08-04T12:00:00.000Z", ou
     seja 09:00 em Brasília) respondia SIM às 10h; e o mesmo registro, depois de
     salvo pela tela (que gravava meio-dia local = 15:00Z, ou seja 12:00 aqui),
     respondia NÃO no mesmo horário. O cartão "De férias agora" caía de 1 para 0
     sem ninguém editar nada de visível. */
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return dia(inicio) <= dia(hoje) && dia(hoje) < dia(retorno);
}
