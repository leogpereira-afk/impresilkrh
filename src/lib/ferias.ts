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
import { estadoFerias } from './feriasPeriodos';
import type { Ferias } from '@/data/types';
/** Datas civis, excluindo decisões explícitas de conclusão ou cancelamento. */
export function feriasEmCurso(f: Ferias, hoje: Date = new Date()): boolean {
  return estadoFerias(f,hoje)==='Em andamento';
}
