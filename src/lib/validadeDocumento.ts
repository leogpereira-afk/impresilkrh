import { diasDeCalendario } from './format';
export type SituacaoValidade = 'Vencido' | 'A vencer' | 'Válido' | 'Sem validade informada';
export function situacaoValidade(data?: string | null, hoje = new Date(), janela = 30): SituacaoValidade {
  const dias = diasDeCalendario(data, hoje);
  if (!Number.isFinite(dias)) return 'Sem validade informada';
  return dias < 0 ? 'Vencido' : dias <= janela ? 'A vencer' : 'Válido';
}
