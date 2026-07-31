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
  return inicio.getTime() <= hoje.getTime() && hoje.getTime() < retorno.getTime();
}
