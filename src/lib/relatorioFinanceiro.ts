import type { Colaborador, Pagamento } from '@/data/types';
import { tituloCancelado, tituloEmAberto, tituloPago } from './mubiPagamentos';
import { TIPOS_ENCARGO } from './folha';
import { ehSocio, ehLancamentoSocietario } from './societario';

export type EstadoFinanceiro = 'pago' | 'legado' | 'aberto' | 'outro';
export function estadoFinanceiro(p: Pick<Pagamento, 'statusErp'>): EstadoFinanceiro {
  if (!p.statusErp?.trim()) return 'legado';
  if (tituloCancelado(p.statusErp)) return 'outro';
  if (tituloEmAberto(p.statusErp)) return 'aberto';
  return tituloPago(p.statusErp) ? 'pago' : 'outro';
}
const compValida = (v: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const centavos = (v: number) => Math.round(Number(v) * 100);
export interface LinhaFinanceira { pagamento: Pagamento; pessoa?: Colaborador; estado: EstadoFinanceiro; valor: number }
export function relatorioFinanceiro(pagamentos: Pagamento[], pessoas: Colaborador[], de: string, ate: string, areaId = '') {
  const porId = new Map(pessoas.map(p => [p.id, p]));
  const equipe = pagamentos.filter(p => !ehLancamentoSocietario(p.tipo) && !(porId.get(p.colaboradorId) && ehSocio(porId.get(p.colaboradorId)!)));
  const invalidos = equipe.filter(p => !compValida(p.competencia) || !Number.isFinite(Number(p.valor)));
  const linhas: LinhaFinanceira[] = equipe.filter(p => compValida(p.competencia) && Number.isFinite(Number(p.valor)) && p.competencia >= de && p.competencia <= ate && (!areaId || porId.get(p.colaboradorId)?.areaId === areaId))
    .map(p => ({ pagamento: p, pessoa: porId.get(p.colaboradorId), estado: estadoFinanceiro(p), valor: centavos(p.valor) / 100 }));
  const soma = (ls: LinhaFinanceira[]) => ls.reduce((s, l) => s + centavos(l.valor), 0) / 100;
  const pagos = linhas.filter(l => l.estado === 'pago' || l.estado === 'legado');
  const encargos = pagos.filter(l => TIPOS_ENCARGO.includes(l.pagamento.tipo));
  const recebidos = pagos.filter(l => !TIPOS_ENCARGO.includes(l.pagamento.tipo));
  const agrupar = (chave: (l: LinhaFinanceira) => string) => {
    const grupos = new Map<string, LinhaFinanceira[]>();
    for (const l of recebidos) { const k = chave(l); grupos.set(k, [...(grupos.get(k) ?? []), l]); }
    return [...grupos].map(([nome, ls]) => ({ nome, valor: soma(ls), quantidade: ls.length })).sort((a,b) => b.valor-a.valor || a.nome.localeCompare(b.nome));
  };
  // Meses ausentes são lacunas, nunca zero de gasto. Limite protege dados malformados.
  const meses: { competencia: string; pago: number | null; aberto: number | null; registros: number }[] = [];
  if (compValida(de) && compValida(ate)) {
    let [ano, mes] = de.split('-').map(Number);
    for (let i=0; i<1200; i++) {
      const c = `${ano}-${String(mes).padStart(2,'0')}`; if (c>ate) break;
      const ls = linhas.filter(l => l.pagamento.competencia === c);
      meses.push({ competencia:c, pago:ls.length ? soma(ls.filter(l => (l.estado==='pago'||l.estado==='legado') && !TIPOS_ENCARGO.includes(l.pagamento.tipo))) : null, aberto:ls.length ? soma(ls.filter(l => l.estado==='aberto')) : null, registros:ls.length });
      if (++mes>12) {mes=1;ano++;}
    }
  }
  const ultimo = meses[meses.length - 1], anterior = meses[meses.length - 2];
  const variacoes = ultimo?.registros && anterior?.registros ? [...new Set(recebidos.map(l => l.pagamento.tipo))].map(tipo => {
    const atual = soma(recebidos.filter(l => l.pagamento.tipo === tipo && l.pagamento.competencia === ultimo.competencia));
    const antes = soma(recebidos.filter(l => l.pagamento.tipo === tipo && l.pagamento.competencia === anterior.competencia));
    return { tipo, atual, anterior: antes, delta: Math.round((atual - antes) * 100) / 100 };
  }).filter(v => v.delta !== 0).sort((a,b) => Math.abs(b.delta)-Math.abs(a.delta)) : [];
  const pessoasPagas = new Set(recebidos.filter(l => l.pessoa).map(l => l.pagamento.colaboradorId)).size;
  return { linhas, meses, variacoes, invalidos: invalidos.length, pago: soma(recebidos), encargos: soma(encargos), aberto:soma(linhas.filter(l=>l.estado==='aberto')), outros:soma(linhas.filter(l=>l.estado==='outro')), legado:soma(pagos.filter(l=>l.estado==='legado')), semCadastro:linhas.filter(l=>!l.pessoa).length, pessoasPagas, porTipo:agrupar(l=>l.pagamento.tipo), porArea:agrupar(l=>l.pessoa?.areaId || '(sem área)'), porPessoa:agrupar(l=>l.pagamento.colaboradorId || '(sem cadastro)') };
}

// Exporta exatamente as linhas visíveis; neutraliza fórmulas em nomes/descrições.
export function csvFinanceiro(linhas: LinhaFinanceira[]): string {
  const celula = (s: string) => `"${(/^[\s]*[=+@-]/.test(s) ? "'"+s : s).replace(/"/g,'""')}"`;
  const rows = [['Competência','Pessoa','ID cadastro','Tipo','Estado','Valor','Vencimento','Pagamento confirmado','Descrição'], ...linhas.map(l => [l.pagamento.competencia,l.pessoa?.nome ?? 'Sem cadastro',l.pagamento.colaboradorId,l.pagamento.tipo,l.estado,l.valor.toFixed(2).replace('.',','),l.pagamento.dataPagamento,l.pagamento.pagoEm ?? '',l.pagamento.descricao ?? ''])];
  return '\ufeff'+rows.map(row=>row.map(celula).join(';')).join('\r\n');
}
