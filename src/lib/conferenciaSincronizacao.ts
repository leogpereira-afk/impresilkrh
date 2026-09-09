import type { Colaborador, Pagamento } from '@/data/types';
import { auditarLancamentos } from './auditoriaLancamentos';
import { idMubiDe } from './custos';
import { tituloPago } from './mubiPagamentos';

/** Competências exatas do ano, sem misturar os últimos 12 meses. */
export function competenciasDoAno(ano: string): string[] {
  if (!/^\d{4}$/.test(ano)) return [];
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(12 - i).padStart(2, '0')}`);
}

/** Conferência local não prova completude do ERP nem autoriza uma correção. */
export function conferirAno(pagamentos: Pagamento[], pessoas: Colaborador[], ano: string, hoje = new Date()) {
  const meses = competenciasDoAno(ano).reverse();
  const dados = pagamentos.filter(p => meses.includes(p.competencia));
  const auditoria = auditarLancamentos(pagamentos, pessoas, { de: `${ano}-01`, ate: `${ano}-12`, hoje });
  const porId = new Map(pessoas.map(p => [p.id, p]));
  const linhas = dados.map(p => {
    const motivos = auditoria.achados.filter(a => a.pagamentoIds.includes(p.id)).map(a => a.titulo);
    if (!p.statusErp?.trim()) motivos.push('Estado do pagamento não informado');
    else if (!tituloPago(p.statusErp)) motivos.push('Pagamento não confirmado');
    if (!idMubiDe(p)) motivos.push('Sem ID do ERP para comparar');
    if (tituloPago(p.statusErp) && !p.pagoEm) motivos.push('Sem data de pagamento confirmada');
    return { pagamento: p, pessoa: porId.get(p.colaboradorId), motivos: [...new Set(motivos)] };
  }).sort((a,b) => a.pagamento.competencia.localeCompare(b.pagamento.competencia) || (a.pessoa?.nome ?? '').localeCompare(b.pessoa?.nome ?? '') || a.pagamento.id.localeCompare(b.pagamento.id));
  return { linhas, auditoria, meses: meses.map(comp => {
    const ps = dados.filter(p => p.competencia === comp);
    return { competencia: comp, registros: ps.length, confirmados: ps.filter(p => !!p.statusErp?.trim() && tituloPago(p.statusErp)).length, semEstado: ps.filter(p => !p.statusErp?.trim()).length, naoPagos: ps.filter(p => !!p.statusErp?.trim() && !tituloPago(p.statusErp)).length, semId: ps.filter(p => !idMubiDe(p)).length };
  }) };
}

export function csvConferencia(linhas: ReturnType<typeof conferirAno>['linhas']): string {
  const cell = (v: unknown) => { const s=String(v ?? ''); return `"${(/^[\s]*[=+@-]/.test(s)?"'"+s:s).replace(/"/g,'""')}"`; };
  const rows = [['Competência','Pessoa','ID cadastro','ID lançamento','ID ERP','Verba','Valor','Vencimento','Pagamento confirmado','Estado ERP','Conferência local'], ...linhas.map(l => {const p=l.pagamento;return [p.competencia,l.pessoa?.nome ?? 'Sem cadastro',p.colaboradorId,p.id,idMubiDe(p) ?? '',p.tipo,Number(p.valor).toFixed(2).replace('.',','),p.dataPagamento,p.pagoEm,p.statusErp,l.motivos.join(' | ') || 'Sem alerta local; falta comparar com ERP'];})];
  return '\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
}
