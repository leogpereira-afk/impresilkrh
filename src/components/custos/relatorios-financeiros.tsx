import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, FileBarChart, Search } from 'lucide-react';
import type { Colaborador, Pagamento } from '@/data/types';
import { relatorioFinanceiro, csvFinanceiro, type EstadoFinanceiro } from '@/lib/relatorioFinanceiro';
import { formatBRL } from '@/lib/format';
import { compLabel } from '@/lib/custos';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Select, Input } from '@/components/ui/form';
import { BarrasVerticais } from '@/components/charts/charts';

const ESTADOS: Record<EstadoFinanceiro,string> = {pago:'Pago confirmado',legado:'Legado sem estado',aberto:'Em aberto',outro:'Não confirmado / cancelado'};
export function RelatoriosFinanceiros({ pagamentos, colaboradores, areas, comp, onComp, onSincronizar }: {
  pagamentos: Pagamento[]; colaboradores: Colaborador[]; areas: {id:string;nome:string}[]; comp:string;
  onComp:(comp:string)=>void; onSincronizar:()=>void;
}) {
  const [janela,setJanela] = useState('6');
  const [area,setArea] = useState('');
  const [tipo,setTipo] = useState('');
  const [estado,setEstado] = useState('');
  const [busca,setBusca] = useState('');
  const [pagina,setPagina] = useState(0);
  const de = useMemo(()=>{
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(comp)) return comp;
    const [y,m]=comp.split('-').map(Number); const dt=new Date(y,m-Number(janela),1);
    return `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}`;
  },[comp,janela]);
  const r = useMemo(()=>relatorioFinanceiro(pagamentos,colaboradores,de,comp,area),[pagamentos,colaboradores,de,comp,area]);
  const tipos = [...new Set(r.linhas.map(l=>l.pagamento.tipo))].sort();
  const linhas = r.linhas.filter(l=>(!tipo||l.pagamento.tipo===tipo)&&(!estado||l.estado===estado)&&(!busca||`${l.pessoa?.nome ?? ''} ${l.pagamento.colaboradorId} ${l.pagamento.descricao ?? ''}`.toLocaleLowerCase('pt-BR').includes(busca.toLocaleLowerCase('pt-BR'))));
  const ultimaPagina=Math.max(0,Math.ceil(linhas.length/25)-1); const paginaAtual=Math.min(pagina,ultimaPagina);
  const ultimo=r.meses[r.meses.length-1]; const anterior=r.meses[r.meses.length-2];
  const delta=ultimo?.pago!=null && anterior?.pago!=null ? Math.round((ultimo.pago-anterior.pago)*100)/100 : null;
  const exportar=()=>{
    const url=URL.createObjectURL(new Blob([csvFinanceiro(linhas)],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download=`rh-financeiro-${de}-${comp}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-semibold text-brand-ink">Relatórios financeiros</h2><p className="mt-1 text-sm text-slate-500">Do resumo ao lançamento: acompanhe o que foi registrado para a equipe.</p></div>
      <div className="flex flex-wrap gap-2">
        <label className="text-xs text-slate-600">Período<Select value={janela} onChange={e=>{setJanela(e.target.value);setPagina(0);}} aria-label="Período do relatório"><option value="1">Mês selecionado</option><option value="3">Últimos 3 meses</option><option value="6">Últimos 6 meses</option><option value="12">Últimos 12 meses</option></Select></label>
        <label className="text-xs text-slate-600">Área atual<Select value={area} onChange={e=>{setArea(e.target.value);setPagina(0);}} aria-label="Área do relatório"><option value="">Todas as áreas</option>{areas.map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</Select></label>
        <button className="btn-outline" onClick={exportar} disabled={!linhas.length}><Download className="h-4 w-4"/> Exportar lançamentos</button>
      </div>
    </div>
    <p className="text-xs text-slate-500">{compLabel(de)} a {compLabel(comp)} · por competência, não por data de saída do caixa. Área é a do cadastro atual; não reconstrói transferências antigas. Sócios e verbas societárias ficam fora. Reservas estimadas e plano de contas não são somados aos pagamentos.</p>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Pago à equipe" value={r.linhas.length?formatBRL(r.pago):'Sem dados'} hint="Sem FGTS e INSS; inclui legado sem estado" accent="brand"/>
      <StatCard label="Encargos lançados pagos" value={r.linhas.length?formatBRL(r.encargos):'Sem dados'} hint="FGTS e INSS registrados; não é provisão" accent="gold"/>
      <StatCard label="Em aberto registrado" value={formatBRL(r.aberto)} hint="Só o que está salvo no RH; não é toda a dívida do ERP" accent="amber"/>
      <StatCard label="Pessoas com recebimento" value={r.pessoasPagas} hint="Pessoas identificadas com lançamento pago; não é headcount" accent="blue"/>
    </div>
    <Card><CardHeader title="O que merece atenção" icon={<FileBarChart className="h-5 w-5"/>}/><CardBody>
      <ul className="space-y-2 text-sm text-slate-700">
        <li>{delta==null?'Não há dois meses consecutivos com registros para comparar.':`${compLabel(comp)}: ${formatBRL(Math.abs(delta))} ${delta>0?'a mais':delta<0?'a menos':'de diferença'} que ${compLabel(anterior!.competencia)} no pago à equipe. Meses podem estar incompletos; isso não prova aumento ou economia.`}</li>
        {r.porTipo[0]&&<li>Maior verba paga: <button className="font-semibold text-brand underline" onClick={()=>{setTipo(r.porTipo[0].nome);setEstado('');setPagina(0);}}>{r.porTipo[0].nome} · {formatBRL(r.porTipo[0].valor)}</button>. Abra os lançamentos abaixo para conferir.</li>}
        <li>{r.meses.filter(m=>!m.registros).length} mês(es) sem registros neste recorte. Ausência de dados não significa custo zero.</li>
        {r.legado!==0&&<li>{formatBRL(r.legado)} em registros sem estado de pagamento, incluídos por compatibilidade com o histórico.</li>}
        {r.semCadastro>0&&<li>{r.semCadastro} lançamento(s) sem pessoa cadastrada; permanecem nos totais e na exportação.</li>}
        {r.invalidos>0&&<li>{r.invalidos} registro(s) da equipe com competência ou valor inválido, fora dos cálculos (verificação de toda a base, antes dos filtros).</li>}
      </ul>
      <button className="btn-outline mt-3" onClick={onSincronizar}>Conferir dados na Sincronização</button>
      <Link className="ml-3 text-sm text-brand underline" to="/relatorios">Abrir relatórios gerais do RH</Link>
    </CardBody></Card>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card><CardHeader title="Evolução do pago à equipe" subtitle="Meses sem registros ficam identificados na tabela"/><CardBody>
        {r.meses.some(m=>m.pago!=null)?<BarrasVerticais moeda data={r.meses.filter(m=>m.pago!=null).map(m=>({nome:compLabel(m.competencia),valor:m.pago!}))}/>:<p className="text-sm text-slate-500">Nenhum registro no período.</p>}
        <table className="w-full text-sm"><thead><tr><th className="text-left">Competência</th><th className="text-right">Pago à equipe</th><th className="text-right">Em aberto</th></tr></thead><tbody>{r.meses.map(m=><tr key={m.competencia} className="border-t border-slate-100"><td className="py-2"><button className="text-brand underline disabled:text-slate-400" disabled={!m.registros} onClick={()=>{onComp(m.competencia);setJanela('1');setPagina(0);}}>{compLabel(m.competencia)}</button></td><td className="text-right">{m.pago==null?'Sem registros':formatBRL(m.pago)}</td><td className="text-right">{m.aberto==null?'—':formatBRL(m.aberto)}</td></tr>)}</tbody></table>
      </CardBody></Card>
      <Card><CardHeader title="Composição dos pagamentos" subtitle="Clique na verba para conferir os lançamentos"/><CardBody><div className="space-y-3">{r.porTipo.map(t=><button className="w-full text-left" key={t.nome} onClick={()=>{setTipo(t.nome);setEstado('');setPagina(0);}}><span className="flex justify-between gap-3 text-sm"><span>{t.nome}</span><strong>{formatBRL(t.valor)}</strong></span><span className="mt-1 block h-2 rounded bg-slate-100"><span className="block h-2 rounded bg-brand" style={{width:`${Math.min(100,Math.abs(t.valor)/(Math.max(...r.porTipo.map(x=>Math.abs(x.valor)),1))*100)}%`}}/></span></button>)}</div></CardBody></Card>
    </div>
    {r.variacoes.length > 0 && <Card><CardHeader title="O que explica a variação do último mês" subtitle="Comparação com o mês imediatamente anterior; variações podem refletir folha ainda incompleta"/><CardBody><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Verba</th><th className="text-right">Anterior</th><th className="text-right">Atual</th><th className="text-right">Diferença</th></tr></thead><tbody>{r.variacoes.map(v=><tr key={v.tipo} className="border-t border-slate-100"><td className="py-2"><button className="text-brand underline" onClick={()=>{setTipo(v.tipo);setEstado('');setPagina(0);}}>{v.tipo}</button></td><td className="text-right">{formatBRL(v.anterior)}</td><td className="text-right">{formatBRL(v.atual)}</td><td className="text-right font-medium">{v.delta>0?'+':'−'}{formatBRL(Math.abs(v.delta))}</td></tr>)}</tbody></table></div></CardBody></Card>}
    <Card><CardHeader title="Maiores valores pagos por pessoa" subtitle="Até 10 pessoas no período; valores não medem produtividade nem desempenho"/><CardBody><ol className="space-y-2">{r.porPessoa.slice(0,10).map(p=>{const pessoa=colaboradores.find(c=>c.id===p.nome);return <li key={p.nome} className="flex justify-between gap-3 border-b border-slate-100 py-2 text-sm"><span>{pessoa?<Link className="text-brand underline" to={`/colaboradores/${encodeURIComponent(pessoa.id)}`}>{pessoa.nome}</Link>:'Sem cadastro'}<span className="ml-2 text-xs text-slate-400">{p.nome}</span></span><strong>{formatBRL(p.valor)}</strong></li>;})}</ol></CardBody></Card>
    <Card><CardHeader title="Distribuição por área" subtitle="Cadastro atual · valores pagos à equipe"/><CardBody><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{r.porArea.map(a=><div key={a.nome} className="rounded-xl border border-slate-200 p-3"><p className="text-sm text-slate-500">{areas.find(x=>x.id===a.nome)?.nome??'Sem área / sem cadastro'}</p><strong>{formatBRL(a.valor)}</strong></div>)}</div></CardBody></Card>
    <Card><CardHeader title="Lançamentos do relatório" subtitle={`${linhas.length} lançamento(s) · filtros abaixo afetam esta lista e a exportação; os gráficos mantêm o período e a área`}/><CardBody>
      <div className="mb-3 flex flex-wrap gap-2"><Search className="mt-2 h-4 w-4 text-slate-400"/><Input aria-label="Buscar lançamento" placeholder="Pessoa, ID ou descrição" value={busca} onChange={e=>{setBusca(e.target.value);setPagina(0);}}/><Select aria-label="Verba do relatório" value={tipo} onChange={e=>{setTipo(e.target.value);setPagina(0);}}><option value="">Todas as verbas</option>{tipos.map(t=><option key={t}>{t}</option>)}</Select><Select aria-label="Estado do pagamento" value={estado} onChange={e=>{setEstado(e.target.value);setPagina(0);}}><option value="">Todos os estados</option>{Object.entries(ESTADOS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</Select><button className="btn-outline" onClick={()=>{setTipo('');setEstado('');setBusca('');setPagina(0);}}>Limpar filtros da lista</button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Competência','Pessoa','Verba','Estado','Valor'].map(h=><th className="px-2 py-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{linhas.slice(paginaAtual*25,paginaAtual*25+25).map(l=><tr className="border-t border-slate-100" key={l.pagamento.id}><td className="p-2">{compLabel(l.pagamento.competencia)}</td><td className="p-2">{l.pessoa?<Link className="text-brand underline" to={`/colaboradores/${encodeURIComponent(l.pessoa.id)}`}>{l.pessoa.nome}</Link>:'Sem cadastro'}<span className="block text-xs text-slate-400">{l.pagamento.colaboradorId}</span></td><td className="p-2">{l.pagamento.tipo}<span className="block max-w-xs text-xs text-slate-500">{l.pagamento.descricao}</span></td><td className="p-2">{ESTADOS[l.estado]}</td><td className="p-2 text-right tabular-nums">{formatBRL(l.valor)}</td></tr>)}</tbody></table></div>
      {!linhas.length&&<p className="py-4 text-sm text-slate-500">Nenhum lançamento corresponde aos filtros.</p>}
      <div className="mt-3 flex items-center justify-end gap-3 text-sm"><button className="btn-outline" disabled={!paginaAtual} onClick={()=>setPagina(paginaAtual-1)}>Anterior</button><span>{paginaAtual+1} / {ultimaPagina+1}</span><button className="btn-outline" disabled={paginaAtual>=ultimaPagina} onClick={()=>setPagina(paginaAtual+1)}>Próxima</button></div>
    </CardBody></Card>
  </div>;
}
