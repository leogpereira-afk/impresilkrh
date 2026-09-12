import type { Aceite } from '@/data/types';
/** Uma versão antiga continua no histórico, sem confirmar um texto novo. */
export function aceiteDaVersao(aceites: readonly Aceite[], pessoa: string, tipo: string, versao?: string): Aceite | undefined {
  return aceites.filter(a => a.colaboradorId === pessoa && a.tipo === tipo && (a.versao ?? '') === (versao ?? ''))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
}
