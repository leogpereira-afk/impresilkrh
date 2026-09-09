import { useMemo, useState } from 'react';
import { CalendarClock, CalendarPlus, ChevronDown, Palmtree, Search, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Modal, ConfirmDialog } from '@/components/ui/modal';
import { Campo, Input, Select } from '@/components/ui/form';
import { LinkFicha } from '@/components/ui/link-ficha';
import { EmptyState } from '@/components/ui/misc';
import { useToast } from '@/components/ui/toast';
import { useColecao } from '@/lib/store';
import { useDominio, noQuadro } from '@/lib/dominio';
import { useSessao } from '@/lib/session';
import { colaboradoresVisiveis, podeGerir } from '@/lib/rbac';
import { formatDate } from '@/lib/format';
import { useHoje } from '@/lib/useHoje';
import { dataFerias, estadoFerias, resumoFeriasPessoa, prazoPeriodoFerias } from '@/lib/feriasPeriodos';
import { proximaFerias } from '@/lib/feriasContagem';
import { DetalheFerias } from '@/components/ferias/detalhe-ferias';
import { HistoricoFerias } from '@/components/ferias/historico-ferias';
import { FormularioFerias } from '@/components/ferias/formulario-ferias';
import { ResumoFerias } from '@/components/ferias/resumo-ferias';
import type { Ferias as TFerias } from '@/data/types';

export default function Ferias() {
  const sessao=useSessao(),d=useDominio(),hoje=useHoje(),toast=useToast();
  const {items:ferias,criar,atualizar,remover}=useColecao('ferias');
  const podeEditar=podeGerir(sessao);
  const [busca,setBusca]=useState(''),[area,setArea]=useState(''),[foco,setFoco]=useState('');
  const [expandida,setExpandida]=useState<string|null>(null);
  const [escolher,setEscolher]=useState(false),[pessoa,setPessoa]=useState('');
  const [editando,setEditando]=useState<TFerias|null>(null),[excluindo,setExcluindo]=useState<TFerias|null>(null);
  const escopo=useMemo(()=>colaboradoresVisiveis(sessao,d.colaboradores).filter(c=>!c.ehDirecao&&noQuadro(c)),[sessao,d.colaboradores]);
  const linhas=useMemo(()=>escopo.map(c=>{
    const registros=ferias.filter(f=>f.colaboradorId===c.id).sort((a,b)=>(b.periodoAquisitivoInicio??'').localeCompare(a.periodoAquisitivoInicio??''));
    const resumo=resumoFeriasPessoa(registros,hoje);
    const agora=registros.some(f=>estadoFerias(f,hoje)==='Em andamento');
    const agendada=registros.some(f=>estadoFerias(f,hoje)==='Agendada');
    const conferir=resumo.disponivel===null || resumo.referencia;
    const prazos=resumo.periodos.map(p=>({p,prazo:prazoPeriodoFerias(p,hoje)})).filter(x=>x.prazo.atencao);
    return {c,registros,resumo,agora,agendada,conferir,prazos,proxima:proximaFerias(registros,hoje)};
  }).sort((a,b)=>a.c.nome.localeCompare(b.c.nome)),[escopo,ferias,hoje]);
  const normalizar=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const base=linhas.filter(l=>(!area||l.c.areaId===area)&&normalizar(l.c.nome).includes(normalizar(busca)));
  const grupos={agora:base.filter(l=>l.agora),agendada:base.filter(l=>l.agendada),prazos:base.filter(l=>l.prazos.length),conferir:base.filter(l=>l.conferir)};
  const visiveis=foco ? grupos[foco as keyof typeof grupos] : base;
  const agenda=base.flatMap(l=>l.registros.flatMap(f=>{
    const estado=estadoFerias(f,hoje);
    if(estado!=='Agendada'&&estado!=='Em andamento')return [];
    return [{c:l.c,f,estado,data:estado==='Agendada'?f.dataInicio:f.dataRetorno}];
  })).sort((a,b)=>+(dataFerias(a.data)??0)-+(dataFerias(b.data)??0));
  const colab=d.colabById.get(editando?.colaboradorId??pessoa);
  const fechar=()=>{setEditando(null);setPessoa('');};
  const alternar=(v:string)=>setFoco(atual=>atual===v?'':v);
  return <div className="space-y-5">
    <PageHeader title="Férias" description="Agenda, saldo por aquisitivo e conferência do histórico"
      >{podeEditar?<button className="btn-primary" onClick={()=>setEscolher(true)}><CalendarPlus className="h-4 w-4" /> Programar férias</button>:undefined}</PageHeader>
    <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Buscar pessoa"><Input aria-label="Buscar pessoa" placeholder="Nome da pessoa" value={busca} onChange={e=>setBusca(e.target.value)} /></Campo>
        <Campo label="Área"><Select aria-label="Filtrar férias por área" value={area} onChange={e=>setArea(e.target.value)}><option value="">Todas as áreas</option>{d.areas.filter(a=>escopo.some(c=>c.areaId===a.id)).map(a=><option key={a.id} value={a.id}>{a.nome}</option>)}</Select></Campo>
      </div>
      <p className="text-xs text-slate-500">{base.length} pessoas no quadro neste filtro · atualização por calendário em {formatDate(hoje)}. Os cartões contam pessoas; uma pessoa pode ter férias atuais e futuras.</p>
    </div>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <StatCard label="De férias agora" value={grupos.agora.length} icon={<Palmtree className="h-5 w-5" />} accent="green" hint="Pessoas fora hoje" ativo={foco==='agora'} onClick={()=>alternar('agora')} />
      <StatCard label="Com férias agendadas" value={grupos.agendada.length} icon={<CalendarPlus className="h-5 w-5" />} hint="Pessoas com saídas futuras" ativo={foco==='agendada'} onClick={()=>alternar('agendada')} />
      <StatCard label="Prazos para conferir" value={grupos.prazos.length} icon={<CalendarClock className="h-5 w-5" />} accent="amber" hint="Até 60 dias, encerrados ou gozo após o prazo" ativo={foco==='prazos'} onClick={()=>alternar('prazos')} />
      <StatCard label="Histórico a conferir" value={grupos.conferir.length} icon={<ShieldAlert className="h-5 w-5" />} accent="amber" hint="Direito não confirmado ou informação incompleta" ativo={foco==='conferir'} onClick={()=>alternar('conferir')} />
    </div>
    {agenda.length>0 && <Card><CardHeader title="Próximas saídas e retornos" subtitle="Movimentos mais próximos das pessoas no filtro" /><CardBody>
      <div className="grid gap-2 md:grid-cols-2">{agenda.slice(0,6).map(x=><button key={x.f.id} className="rounded-lg border border-slate-200 p-3 text-left hover:bg-slate-50" onClick={()=>{setFoco('');setExpandida(x.c.id);document.getElementById('controle-ferias')?.scrollIntoView({behavior:'smooth'});}}>
        <span className="block font-medium text-slate-800 break-words">{x.c.nome}</span><span className="text-sm text-slate-500">{x.estado==='Agendada'?'Sai em':'Retorna em'} {formatDate(x.data)} · {x.estado==='Agendada'?`retorno ${formatDate(x.f.dataRetorno)}`:'de férias agora'}</span>
      </button>)}</div>
      {agenda.length>6 && <p className="mt-3 text-xs text-slate-500">Mais {agenda.length-6} movimentos na lista de pessoas abaixo.</p>}
    </CardBody></Card>}
    <Card colapsavel={false}><CardHeader title="Controle de férias" subtitle={`${visiveis.length} de ${base.length} pessoas${foco?' · filtro do cartão ativo':''}`} action={foco?<button className="btn-outline" onClick={()=>setFoco('')}>Mostrar todas</button>:undefined} />
      <CardBody><div id="controle-ferias" className="space-y-3">
        {!visiveis.length && <EmptyState title="Nenhuma pessoa neste filtro" description="Ajuste a busca, a área ou o cartão selecionado." icon={<Search className="h-8 w-8" />} />}
        {visiveis.map(l=><div key={l.c.id} className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="p-4 grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_auto] lg:items-center">
            <div className="min-w-0"><LinkFicha id={l.c.id}>{l.c.nome}</LinkFicha><p className="text-xs text-slate-500">{d.areas.find(a=>a.id===l.c.areaId)?.nome??'Área não informada'}</p></div>
            <div className="text-sm space-y-1"><p className={l.agora?'font-semibold text-emerald-700':'text-slate-700'}>{l.proxima.texto}</p>
              <p className="text-slate-500">{l.resumo.disponivel===null?'Saldo a conferir':`${l.resumo.disponivel} dias livres${l.resumo.referencia?' · direito a confirmar':''}`} · {l.resumo.agendados} dias reservados</p>
              {l.prazos.length>0 && <p className="text-amber-800">{l.prazos.length} aquisitivo(s) com prazo para conferir</p>}
            </div>
            <div className="flex flex-wrap gap-2"><button className="btn-outline" aria-expanded={expandida===l.c.id} aria-label={`Ver férias de ${l.c.nome}`} onClick={()=>setExpandida(atual=>atual===l.c.id?null:l.c.id)}><ChevronDown className="h-4 w-4" /> Detalhes</button>
              {podeEditar && <button className="btn-outline" aria-label={`Programar férias de ${l.c.nome}`} onClick={()=>setPessoa(l.c.id)}><CalendarPlus className="h-4 w-4" /> Programar</button>}
            </div>
          </div>
          {expandida===l.c.id && <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4"><ResumoFerias registros={l.registros} />
            <DetalheFerias colaboradorId={l.c.id} nome={l.c.nome} registros={l.registros} podeEditar={podeEditar} aoEditar={setEditando} aoExcluir={setExcluindo} />
          </div>}
        </div>)}
      </div></CardBody>
    </Card>
    <p className="text-xs text-slate-500">O histórico registrado não prova que todos os períodos anteriores foram lançados. Vínculo e direito precisam ser conferidos; salário e pagamentos avulsos não definem quem tem direito a férias.</p>
    {podeEditar && <details className="rounded-xl border border-slate-200 bg-white p-4"><summary className="cursor-pointer text-sm font-medium text-slate-700">Histórico de alterações</summary><div className="mt-4"><HistoricoFerias nomeDe={id=>d.nomeColab(id)} /></div></details>}
    {escolher && <Modal aberto onFechar={()=>setEscolher(false)} titulo="Escolher pessoa" descricao="O período e o gozo serão conferidos antes de salvar."><Campo label="Pessoa"><Select aria-label="Pessoa para programar férias" value="" onChange={e=>{setPessoa(e.target.value);setEscolher(false);}}><option value="">Selecione</option>{escopo.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Campo></Modal>}
    {colab && <FormularioFerias colaborador={colab} registros={ferias.filter(f=>f.colaboradorId===colab.id)} registro={editando} onFechar={fechar} onSalvar={dados=>{
      if(editando){const patch=Object.fromEntries(Object.entries(dados).filter(([k,v])=>v!==editando[k as keyof TFerias]));atualizar(editando.id,patch);}
      else criar(dados);
      toast(editando?'Férias atualizadas.':'Férias registradas.');fechar();
    }} />}
    <ConfirmDialog aberto={!!excluindo} onFechar={()=>setExcluindo(null)} titulo="Excluir lançamento de férias" textoConfirmar="Excluir lançamento" mensagem="Excluir altera o saldo e remove este lançamento do histórico de períodos. Para preservar o registro de uma programação que não aconteceu, prefira editar e cancelar." onConfirmar={()=>{if(excluindo)remover(excluindo.id);setExcluindo(null);toast('Lançamento removido.');}} />
  </div>;
}
