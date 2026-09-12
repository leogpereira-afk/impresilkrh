import { useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, AlertTriangle } from 'lucide-react';
import type { Ponto } from '@/data/types';
import { periodoDoPonto, janelaDaLeitura, leituraDoPonto } from '@/lib/leituraPonto';
import { diaLocalISO, formatDate, parseData } from '@/lib/format';
import { useHoje } from '@/lib/useHoje';
import { cn } from '@/lib/cn';

const hora = (n: number) => `${Math.floor(n / 60)}h${String(Math.round(n % 60)).padStart(2, '0')}`;

export function LeituraPonto({ pontos, nome, abrir }: { pontos: Ponto[]; nome: (p: Ponto) => string; abrir: (p: Ponto) => void }) {
  const hoje = diaLocalISO(useHoje());
  const periodos = pontos.map(periodoDoPonto).filter(p => p !== null);
  const inicio = periodos.map(p => p.inicio).sort()[0] ?? hoje;
  const fim = periodos.map(p => p.fim).sort().reverse()[0] ?? hoje;
  const [modo, setModo] = useState<'dia' | 'semana' | 'periodo'>('periodo');
  const [referencia, setReferencia] = useState(() => hoje < inicio ? inicio : hoje > fim ? fim : hoje);
  const [busca, setBusca] = useState('');
  const normalizar = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const filtrados = pontos.filter(p => normalizar(nome(p)).includes(normalizar(busca)));
  const janela = janelaDaLeitura({ inicio, fim }, modo, referencia);
  const leitura = leituraDoPonto(filtrados, janela, hoje);
  const total = leitura.pessoas.reduce((t, p) => ({ normais: t.normais + p.normais, extras: t.extras + p.extras, faltas: t.faltas + p.faltas, alertas: t.alertas + p.alertas, lacunas: t.lacunas + p.lacunas, duplicados: t.duplicados + p.duplicados }), { normais: 0, extras: 0, faltas: 0, alertas: 0, lacunas: 0, duplicados: 0 });
  const teto = Math.max(1, ...leitura.dias.map(d => d.normais + d.extras));
  const navegar = (delta: number) => { const d = parseData(referencia); if (!d) return; d.setDate(d.getDate() + delta * (modo === 'semana' ? 7 : 1)); setReferencia(diaLocalISO(d)); };
  const temRegistros = leitura.dias.some(d => d.registros > 0);

  return <section className="mb-5" aria-label="Leitura do ponto">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="flex items-center gap-2 text-base font-semibold text-slate-800"><CalendarDays className="h-4 w-4 text-brand" /> Leitura do ponto</h2><p className="mt-1 text-xs text-slate-500">{formatDate(janela.inicio)} a {formatDate(janela.fim)} · {filtrados.length} de {pontos.length} ficha(s)</p></div>
      <div className="flex rounded-lg bg-slate-100 p-1" aria-label="Período da leitura">{([['dia', 'Dia'], ['semana', 'Semana'], ['periodo', 'Período completo']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={modo === id} onClick={() => setModo(id)} className={cn('min-h-10 rounded-md px-3 text-xs font-medium', modo === id ? 'bg-white text-brand shadow-sm' : 'text-slate-600')}>{label}</button>)}</div>
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input className="input max-w-xs" value={busca} onChange={e => setBusca(e.target.value)} aria-label="Buscar pessoa no ponto" placeholder="Buscar pessoa…" />
      {modo !== 'periodo' && <div className="flex min-w-0 items-center gap-1"><button className="btn-ghost px-2" aria-label="Período anterior" onClick={() => navegar(-1)}><ChevronLeft className="h-4 w-4" /></button><input className="input min-w-0 w-40" type="date" aria-label="Data de referência" value={referencia} onChange={e => { if (e.target.value) setReferencia(e.target.value); }} /><button className="btn-ghost px-2" aria-label="Próximo período" onClick={() => navegar(1)}><ChevronRight className="h-4 w-4" /></button></div>}
    </div>
    <div className="my-4 grid grid-cols-3 divide-x divide-slate-200 border-y border-slate-100 py-3">
      {([['Horas normais', total.normais], ['Horas extras', total.extras], ['Horas de falta', total.faltas]] as const).map(([label, valor]) => <div key={label} className="px-3 first:pl-0"><p className="text-[11px] text-slate-500">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-slate-800">{temRegistros ? hora(valor) : '—'}</p></div>)}
    </div>
    {(total.alertas > 0 || total.lacunas > 0 || total.duplicados > 0) && <p role="status" className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" /><span>{total.alertas} dia(s) com batidas ou intervalo a conferir · {total.lacunas} lacuna(s) de detalhe diário{total.duplicados > 0 ? ` · ${total.duplicados} dia(s) repetido(s): confira o extrato` : ''}. Lacuna não é falta; ausência de intervalo não gera desconto automático.</span></p>}
    {temRegistros ? <>
      <div className="overflow-x-auto pb-2" aria-label="Horas por dia; selecione uma barra para ver os valores">
        <div className="flex h-36 items-end gap-1.5 border-b border-slate-200" style={{ minWidth: Math.max(280, leitura.dias.length * 32) }}>
          {leitura.dias.map(d => <button key={d.data} type="button" onClick={() => { setReferencia(d.data); setModo('dia'); }} title={`${formatDate(d.data)}: ${hora(d.normais)} normais; ${hora(d.extras)} extras; ${d.lacunas} lacuna(s)`} aria-label={`${formatDate(d.data)}: ${hora(d.normais)} normais e ${hora(d.extras)} extras${d.lacunas ? ', base parcial' : ''}`} className="flex h-full min-w-6 flex-1 flex-col justify-end gap-1 text-center">
            <div className="flex min-h-1 w-full flex-col justify-end overflow-hidden rounded-t" style={{ height: `${Math.max(2, (d.normais + d.extras) / teto * 100)}%`, opacity: d.lacunas ? .55 : 1 }}><span className="block bg-sky-500" style={{ flex: d.extras }} /><span className="block bg-teal-700" style={{ flex: d.normais }} /></div>
            <span className="text-[10px] tabular-nums text-slate-500">{d.data.slice(8)}{d.lacunas > 0 ? '*' : ''}</span>
          </button>)}
        </div>
      </div>
      <p className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500"><span>Verde: normais</span><span>Azul: extras</span><span>* Detalhe parcial · clique no dia para abrir</span></p>
      <div className="divide-y divide-slate-100">{leitura.pessoas.map(p => <button key={p.ponto.id} type="button" onClick={() => abrir(p.ponto)} className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-slate-50">
        <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium text-slate-800">{nome(p.ponto)}</span><span className="text-xs text-slate-500">{p.lacunas ? `${p.lacunas} lacuna(s) · ` : ''}{p.alertas ? `${p.alertas} dia(s) a conferir` : p.registros ? 'Sem alerta nas batidas informadas' : 'Sem detalhe diário'}</span></span>
        <span className="text-right text-xs tabular-nums text-slate-600"><b className="text-sm text-slate-800">{p.registros ? hora(p.normais) : '—'} normais</b><br />{hora(p.extras)} extras · {hora(p.faltas)} faltas</span><ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
      </button>)}</div>
    </> : <p className="py-4 text-sm text-slate-500">Sem detalhe diário neste recorte. Os totais importados continuam disponíveis no extrato abaixo.</p>}
    <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Leitura dos dias informados pelo Secullum, até hoje. Horas normais, extras e faltas mantêm os cálculos da origem; o intervalo não é descontado uma segunda vez. PDF e Excel da apuração ficam no extrato completo abaixo.</p>
  </section>;
}
