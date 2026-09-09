import type { Ferias } from '@/data/types';
import { formatDate } from '@/lib/format';
import { resumoFeriasPessoa, prazoPeriodoFerias } from '@/lib/feriasPeriodos';
import { useHoje } from '@/lib/useHoje';
export function ResumoFerias({registros}:{registros:Ferias[]}) {
  const hoje=useHoje(),resumo=resumoFeriasPessoa(registros,hoje);
  return <div className="space-y-3 text-sm">
    <p className="text-slate-600">{resumo.disponivel===null ? 'Saldo a conferir: histórico ausente ou incompleto.' : `${resumo.disponivel} dias livres para programar nos aquisitivos registrados${resumo.referencia?' (referência de direito a confirmar)':''}.`} Reservas futuras já estão descontadas.</p>
    {resumo.semAquisitivo.length>0 && <p className="text-amber-800">{resumo.semAquisitivo.length} lançamento(s) sem aquisitivo válido. Confira no histórico abaixo.</p>}
    {resumo.periodos.map(p=><div key={p.chave} className="rounded-lg border border-slate-200 bg-white p-3 space-y-1">
      <p className="font-semibold text-slate-800">{formatDate(p.inicio)} a {formatDate(p.fim)}</p>
      <p>{p.direito} dias de direito{!p.direitoConfirmado?' de referência':''} · {p.gozados} gozados · {p.emCurso} em curso · {p.agendados} agendados · {p.abono} vendidos</p>
      <p className="font-medium">{p.pendencias.length?'Saldo a conferir':`${p.disponivel} dias livres`} · Conceder até {formatDate(p.limite)}</p>
      <p className={prazoPeriodoFerias(p,hoje).atencao?'text-amber-800':'text-slate-500'}>{prazoPeriodoFerias(p,hoje).texto}</p>
      {p.pendencias.map(e=><p key={e} className="text-amber-800">{e}</p>)}
    </div>)}
  </div>;
}
