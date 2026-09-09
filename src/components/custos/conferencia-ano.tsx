import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { Colaborador, Pagamento } from '@/data/types';
import { conferirAno, csvConferencia } from '@/lib/conferenciaSincronizacao';
import { compLabel, idMubiDe } from '@/lib/custos';
import { formatBRL, formatDate } from '@/lib/format';
import { Card, CardBody, CardHeader } from '@/components/ui/card';

export function ConferenciaAno({ pagamentos, pessoas, ocupado, onBuscarAno, onBuscarMes }: {
  pagamentos: Pagamento[]; pessoas: Colaborador[]; ocupado: boolean;
  onBuscarAno: (ano: string) => void; onBuscarMes: (mes: string) => void;
}) {
  const [ano, setAno] = useState(String(new Date().getFullYear()));
  const [mes, setMes] = useState('');
  const [busca, setBusca] = useState('');
  const [somentePendentes, setSomentePendentes] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [todosMeses, setTodosMeses] = useState(false);
  const r = useMemo(() => conferirAno(pagamentos, pessoas, ano), [pagamentos, pessoas, ano]);
  const anos = [...new Set([String(new Date().getFullYear()), ...pagamentos.map(p => p.competencia.slice(0,4)).filter(a => /^\d{4}$/.test(a))])].sort().reverse();
  const filtradas = r.linhas.filter(l => (!mes || l.pagamento.competencia === mes) && (!somentePendentes || l.motivos.length > 0) && (!busca || [l.pessoa?.nome, l.pagamento.id, idMubiDe(l.pagamento), l.pagamento.tipo, l.pagamento.descricao].join(' ').toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))));
  const totalPaginas = Math.max(1, Math.ceil(filtradas.length/25));
  const pag = Math.min(pagina, totalPaginas-1);
  const exportar = () => {
    const url = URL.createObjectURL(new Blob([csvConferencia(filtradas)], {type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a'); a.href=url; a.download=`conferencia-rh-${ano}.csv`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <Card><CardHeader title="Conferência dos lançamentos por ano" subtitle="Veja o que está gravado, confira cada linha e compare com o ERP antes de aplicar"/><CardBody>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm">Ano da conferência<select aria-label="Ano da conferência" className="ml-2 rounded-lg border p-2" value={ano} onChange={e=>{setAno(e.target.value);setMes('');setPagina(0);}}>{anos.map(a=><option key={a}>{a}</option>)}</select></label>
      <button className="btn-primary" disabled={ocupado} onClick={()=>onBuscarAno(ano)}>{ocupado?'Consulta em andamento…':`Conferir ${ano} inteiro no ERP`}</button>
      <button className="btn-outline" disabled={!filtradas.length} onClick={exportar}>Exportar linhas filtradas</button>
    </div>
    <p className="mt-3 text-sm text-slate-600">{r.linhas.length} lançamentos no RH · {r.linhas.filter(l=>l.motivos.length>0).length} com pontos para conferir. A consulta anual lê janeiro a dezembro, página por página, e abre uma prévia para sua escolha. Não aplica pagamentos.</p>
    <p className="mt-1 text-xs text-slate-500">Ter registros não comprova que o mês está completo. “Confirmado” abaixo significa estado de pagamento gravado, não conferência recente com o ERP. Meses futuros podem não ter títulos.</p>
    <details className="mt-4 rounded-xl border border-slate-200 p-3">
      <summary className="cursor-pointer text-sm font-semibold">Ver cobertura mês a mês</summary>
      <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={todosMeses} onChange={e=>setTodosMeses(e.target.checked)}/>Incluir meses sem registros</label>
    <div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Mês','No RH','Pago confirmado','Sem estado','Não confirmado','Sem ID ERP','Comparar'].map(t=><th className="p-2 text-left" key={t}>{t}</th>)}</tr></thead><tbody>{r.meses.filter(m => todosMeses || m.registros > 0).map(m=><tr key={m.competencia} className="border-t border-slate-100"><td className="p-2"><button className="text-brand underline" onClick={()=>{setMes(m.competencia);setPagina(0);}}>{compLabel(m.competencia)}</button></td><td className="p-2">{m.registros || 'Sem registros'}</td><td className="p-2">{m.confirmados}</td><td className="p-2">{m.semEstado}</td><td className="p-2">{m.naoPagos}</td><td className="p-2">{m.semId}</td><td className="p-2"><button className="btn-outline" aria-label={`Conferir ${compLabel(m.competencia)} no ERP`} disabled={ocupado} onClick={()=>onBuscarMes(m.competencia)}>Conferir mês</button></td></tr>)}</tbody></table></div>
    </details>
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <input aria-label="Buscar na conferência" className="min-w-0 rounded-lg border p-2 text-sm" placeholder="Pessoa, título, verba ou descrição" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(0);}}/>
      <select aria-label="Mês das linhas" className="rounded-lg border p-2 text-sm" value={mes} onChange={e=>{setMes(e.target.value);setPagina(0);}}><option value="">Todos os meses</option>{r.meses.map(m=><option key={m.competencia} value={m.competencia}>{compLabel(m.competencia)}</option>)}</select>
      <label className="flex items-center gap-2 text-sm"><input aria-label="Somente com pontos para conferir" type="checkbox" checked={somentePendentes} onChange={e=>{setSomentePendentes(e.target.checked);setPagina(0);}}/>Somente com pontos para conferir</label>
    </div>
    <p className="mt-2 text-xs text-slate-500">{filtradas.length} linha(s) no filtro. Alertas sugerem revisão; não autorizam exclusão nem mudança de vínculo.</p>
    <div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Pessoa e identificação','Competência / verba','Valor','Vencimento / baixa','O que conferir'].map(t=><th key={t} className="p-2 text-left">{t}</th>)}</tr></thead><tbody>{filtradas.slice(pag*25,pag*25+25).map(l=><tr key={l.pagamento.id} className="border-t border-slate-100 align-top"><td className="p-2">{l.pessoa?<Link className="text-brand underline" to={`/colaboradores/${encodeURIComponent(l.pessoa.id)}`}>{l.pessoa.nome}</Link>:'Sem cadastro'}<span className="block text-xs text-slate-500">ERP: {idMubiDe(l.pagamento)||'sem ID'} · RH: {l.pagamento.id}</span></td><td className="p-2">{compLabel(l.pagamento.competencia)}<span className="block">{l.pagamento.tipo}</span><span className="block max-w-xs text-xs text-slate-500">{l.pagamento.descricao}</span></td><td className="whitespace-nowrap p-2">{formatBRL(l.pagamento.valor)}</td><td className="p-2"><span className="block">Vence: {formatDate(l.pagamento.dataPagamento)}</span><span className="block">Baixa: {l.pagamento.pagoEm?formatDate(l.pagamento.pagoEm):'não informada'}</span><span className="text-xs">{l.pagamento.statusErp||'Estado não informado'}</span></td><td className="p-2"><ul className="space-y-1">{l.motivos.map(m=><li key={m}>{m}</li>)}</ul>{!l.motivos.length&&<span>Sem alerta local; falta comparar com ERP.</span>}<button className="mt-2 text-brand underline" disabled={ocupado} onClick={()=>onBuscarMes(l.pagamento.competencia)}>Comparar mês no ERP</button></td></tr>)}</tbody></table></div>
    {!filtradas.length&&<p className="py-4 text-sm text-slate-500">Nenhum lançamento neste filtro.</p>}
    <div className="mt-3 flex justify-end gap-3 text-sm"><button className="btn-outline" disabled={pag===0} onClick={()=>setPagina(pag-1)}>Anterior</button><span>{pag+1} / {totalPaginas}</span><button className="btn-outline" disabled={pag+1>=totalPaginas} onClick={()=>setPagina(pag+1)}>Próxima</button></div>
  </CardBody></Card>;
}
