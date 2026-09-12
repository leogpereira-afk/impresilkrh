import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileDown, Pencil, CalendarDays } from 'lucide-react';
import { obter, useColecao } from '@/lib/store';
import { idPessoa } from '@/lib/identidade';
import { useDominio, noQuadro } from '@/lib/dominio';
import { useSessao } from '@/lib/session';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { Campo, Input, Select, Textarea } from '@/components/ui/form';
import { StatCard } from '@/components/ui/stat-card';
import { formatDate } from '@/lib/format';
import { horas, mesAtual, minutosTurno, validarPlantao } from '@/lib/performance';
import { exportarPlantoes } from '@/lib/performancePdf';
import type { Plantao } from '@/data/performance';

const criar = (data: string, por: string): Plantao => ({id:'',titulo:'',data,inicio:'08:00',fim:'12:00',intervaloMin:0,tipo:'Sábado',local:'',osNumero:'',observacao:'',participantes:[],cancelado:false,criadoPor:por,atualizadoEm:''});

export default function Plantoes() {
  const sessao=useSessao();
  const d=useDominio();
  const nomePessoa=(id:string)=>`${d.nomeColab(id)} · ID ${idPessoa(d.colabById.get(id)?.cpf)??id}`;
  const store=useColecao('plantoes');
  const equipes=useColecao('equipesPlantoes');
  const [nomeEquipe,setNomeEquipe]=useState('');
  const toast=useToast();
  const [mes,setMes]=useState(mesAtual);
  const [pessoa,setPessoa]=useState('');
  const original=useRef('');
  const [edit,setEdit]=useState<Plantao|null>(null);
  const [erro,setErro]=useState<string[]>([]);
  const [baixando,setBaixando]=useState(false);
  const pessoas=d.colaboradores.filter(c=>noQuadro(c)&&!c.ehDirecao);
  const linhas=store.items.filter(p=>p.data.startsWith(mes)&&(!pessoa||p.participantes.some(x=>x.colaboradorId===pessoa))).sort((a,b)=>`${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`));
  const ativos=linhas.filter(x=>!x.cancelado);
  const participantes=ativos.flatMap(p=>p.participantes.filter(x=>x.situacao!=='Dispensado'&&(!pessoa||x.colaboradorId===pessoa)));
  const sabados=Array.from({length:new Date(Number(mes.slice(0,4)),Number(mes.slice(5)),0).getDate()},(_,i)=>`${mes}-${String(i+1).padStart(2,'0')}`).filter(dt=>new Date(`${dt}T12:00:00`).getDay()===6);
  const abrir=(p: Plantao)=>{setErro([]);setNomeEquipe('');original.current=JSON.stringify(p);setEdit(structuredClone(p));};
  const salvar=()=>{
    if(!edit||sessao?.perfil!=='ADMIN_RH')return;
    const atuais=obter('plantoes');
    if(edit.id&&JSON.stringify(atuais.find(x=>x.id===edit.id))!==original.current){setErro(['Esta escala foi atualizada enquanto você editava. Feche e abra novamente para conferir a versão atual.']);return;}
    const erros=validarPlantao(edit,atuais);
    if(erros.length){setErro(erros);return;}
    try {if(edit.id)store.atualizar(edit.id,edit);else {const {id:_id,...novo}=edit;store.criar(novo);}setEdit(null);toast('Escala salva. Acompanhe a sincronização no topo.','sucesso');} catch(e){setErro([e instanceof Error?e.message:'Não foi possível salvar.']);}
  };
  const pdf=async()=>{setBaixando(true);try{await exportarPlantoes(mes,linhas,nomePessoa,pessoa);}catch{toast('Não foi possível gerar o PDF. Tente novamente.','erro');}finally{setBaixando(false);}};
  if(sessao?.perfil!=='ADMIN_RH')return <p>Escalas gerenciadas pelo RH.</p>;
  return <section className="space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-2xl font-semibold text-brand">Plantões</h2><p className="mt-1 text-slate-500">Sábados, horas extras e empreitas. Planeje a equipe e confira o que foi realizado.</p></div><div className="flex flex-wrap gap-2"><button className="btn-outline" onClick={()=>void pdf()} disabled={baixando}><FileDown className="h-4 w-4"/>{baixando?'Gerando…':'Relatório mensal em PDF'}</button><button className="btn-primary" onClick={()=>abrir(criar(sabados.find(dt=>dt>=new Date().toLocaleDateString('sv-SE'))??sabados[0]??`${mes}-01`,sessao.colaboradorId))}><Plus className="h-4 w-4"/>Novo plantão</button></div></div>
    <div className="flex flex-wrap items-end gap-3"><Campo label="Mês da escala"><Input type="month" value={mes} onChange={e=>{if(e.target.value)setMes(e.target.value);}}/></Campo><Campo label="Pessoa"><Select value={pessoa} onChange={e=>setPessoa(e.target.value)}><option value="">Toda a equipe</option>{d.colaboradores.filter(c=>pessoas.includes(c)||linhas.some(p=>p.participantes.some(x=>x.colaboradorId===c.id))).map(c=><option key={c.id} value={c.id}>{nomePessoa(c.id)}</option>)}</Select></Campo><button className="btn-ghost" onClick={()=>setMes(mesAtual())}>Mês atual</button></div>
    <div className="grid gap-3 sm:grid-cols-3"><StatCard label="Plantões no mês" value={ativos.length} hint="Escalas canceladas ficam no histórico"/><StatCard label="Pessoas escaladas" value={new Set(participantes.map(p=>p.colaboradorId)).size}/><StatCard label="Extras conferidas na escala" value={horas(participantes.filter(p=>p.situacao==='Realizado').reduce((n,p)=>n+(p.extrasMin??0),0))} hint="A conferência do ponto continua separada"/></div>
    <div className="card p-4"><h3 className="mb-3 font-semibold">Sábados do mês</h3><div className="grid grid-cols-2 gap-3 sm:grid-cols-5">{sabados.map(data=>{const lista=ativos.filter(p=>p.data===data);return <button className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-brand hover:bg-slate-50" key={data} onClick={()=>abrir(criar(data,sessao.colaboradorId))}><span className="text-xl font-semibold text-brand">{data.slice(8)}</span><span className="block text-sm text-slate-500">{lista.length?`${lista.length} plantão(ões)`:'Escalar equipe'}</span></button>;})}</div></div>
    {!linhas.length&&<div className="card p-8 text-center"><CalendarDays className="mx-auto mb-3 h-9 w-9 text-brand"/><h3 className="font-semibold">Seu planejamento começa aqui</h3><p className="mt-2 text-slate-500">Escolha um sábado acima ou crie um plantão em qualquer dia do mês.</p></div>}
    <div className="space-y-4">{linhas.map(p=><article key={p.id} className={`card p-5 ${p.cancelado?'opacity-60':''}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold text-brand">{formatDate(p.data)} · {p.inicio}–{p.fim} · {p.tipo}{p.cancelado?' · Cancelado':''}</p><h3 className="mt-1 text-lg font-semibold">{p.titulo}</h3><p className="text-sm text-slate-500">{[p.local,p.osNumero&&`O.S. ${p.osNumero}`,`${p.intervaloMin} min de intervalo`].filter(Boolean).join(' · ')}</p></div><button className="btn-outline" onClick={()=>abrir(p)}><Pencil className="h-4 w-4"/>Conferir escala</button></div><div className="mt-4 divide-y divide-slate-100">{p.participantes.filter(x=>!pessoa||x.colaboradorId===pessoa).map(x=><div className="flex flex-wrap justify-between gap-2 py-3" key={x.colaboradorId}><span className="font-medium">{nomePessoa(x.colaboradorId)}</span><span className="text-sm text-slate-500">{x.situacao} · {x.situacao==='Realizado'?`${horas(x.realizadoMin??0)} realizadas / ${horas(x.extrasMin??0)} extras`:`${horas(minutosTurno(p.inicio,p.fim,p.intervaloMin)??0)} previstas`}</span></div>)}</div>{p.observacao&&<p className="mt-2 whitespace-pre-wrap text-sm text-slate-500">{p.observacao}</p>}</article>)}</div>
    <p className="text-sm text-slate-500">A escala organiza o trabalho. Confira ponto, descanso, segurança e a regra de pagamento aplicável antes de fechar a folha. <Link className="underline" to="/ponto">Abrir ponto</Link></p>
    {edit&&<Modal aberto onFechar={()=>setEdit(null)} titulo={edit.id?'Conferir plantão':'Novo plantão'} largura="max-w-4xl" rodape={<><button className="btn-ghost" onClick={()=>setEdit(null)}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar escala</button></>}><div className="space-y-4">
      {!!erro.length&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-red-700">{erro.map(e=><p key={e}>{e}</p>)}</div>}
      <div className="grid gap-3 sm:grid-cols-2"><Campo label="Serviço / título" obrigatorio><Input value={edit.titulo} onChange={e=>setEdit({...edit,titulo:e.target.value})}/></Campo><Campo label="Tipo"><Select value={edit.tipo} onChange={e=>setEdit({...edit,tipo:e.target.value as Plantao['tipo']})}>{['Sábado','Hora extra','Empreita'].map(t=><option key={t}>{t}</option>)}</Select></Campo><Campo label="Data"><Input type="date" value={edit.data} onChange={e=>setEdit({...edit,data:e.target.value})}/></Campo><Campo label="Local"><Input value={edit.local} onChange={e=>setEdit({...edit,local:e.target.value})}/></Campo></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Campo label="Início"><Input type="time" value={edit.inicio} onChange={e=>setEdit({...edit,inicio:e.target.value})}/></Campo><Campo label="Fim"><Input type="time" value={edit.fim} onChange={e=>setEdit({...edit,fim:e.target.value})}/></Campo><Campo label="Intervalo (min)"><Input type="number" min="0" value={edit.intervaloMin} onChange={e=>setEdit({...edit,intervaloMin:Number(e.target.value)})}/></Campo><Campo label="O.S. (opcional)"><Input value={edit.osNumero} onChange={e=>setEdit({...edit,osNumero:e.target.value})}/></Campo></div>
      <div className="rounded-xl bg-slate-50 p-4"><div className="grid gap-3 sm:grid-cols-2"><Campo label="Usar equipe habitual" hint="Acrescenta as pessoas à escala. Você pode trocar ou retirar qualquer integrante."><Select value="" onChange={e=>{const eq=equipes.items.find(x=>x.id===e.target.value);if(eq){const ids=eq.colaboradorIds.filter(id=>pessoas.some(c=>c.id===id)&&!edit.participantes.some(x=>x.colaboradorId===id));setEdit({...edit,participantes:[...edit.participantes,...ids.map(colaboradorId=>({colaboradorId,situacao:'Escalado' as const,realizadoMin:null,extrasMin:null}))]});}}}><option value="">Escolha uma equipe</option>{equipes.items.map(eq=><option key={eq.id} value={eq.id}>{eq.nome}</option>)}</Select></Campo><Campo label="Salvar esta composição como equipe habitual"><div className="flex gap-2"><Input value={nomeEquipe} placeholder="Ex.: Instalação A" onChange={e=>setNomeEquipe(e.target.value)}/><button className="btn-outline" disabled={!nomeEquipe.trim()||!edit.participantes.length} onClick={()=>{try{const nome=nomeEquipe.trim();const existente=equipes.items.find(x=>x.nome.toLocaleLowerCase('pt-BR')===nome.toLocaleLowerCase('pt-BR'));const patch={nome,colaboradorIds:edit.participantes.map(x=>x.colaboradorId)};if(existente)equipes.atualizar(existente.id,patch);else equipes.criar(patch);toast('Equipe habitual salva. Escalas anteriores foram preservadas.','sucesso');setNomeEquipe('');}catch(e){setErro([e instanceof Error?e.message:'Não foi possível salvar a equipe.']);}}}>Salvar equipe</button></div></Campo></div><p className="mt-2 text-xs text-slate-500">A equipe habitual é um ponto de partida. Cada escala e cada entrega preservam sua própria composição.</p></div>
      <fieldset><legend className="mb-2 font-semibold">Equipe escalada</legend><div className="max-h-52 overflow-auto rounded-xl border p-3 grid gap-2 sm:grid-cols-2">{d.colaboradores.filter(c=>pessoas.includes(c)||edit.participantes.some(x=>x.colaboradorId===c.id)).sort((a,b)=>a.nome.localeCompare(b.nome)).map(c=><label key={c.id} className="flex items-center gap-2 py-1"><input type="checkbox" checked={edit.participantes.some(p=>p.colaboradorId===c.id)} onChange={e=>setEdit({...edit,participantes:e.target.checked?[...edit.participantes,{colaboradorId:c.id,situacao:'Escalado',realizadoMin:null,extrasMin:null}]:edit.participantes.filter(p=>p.colaboradorId!==c.id)})}/>{nomePessoa(c.id)}</label>)}</div></fieldset>
      {!!edit.participantes.length&&<div><h3 className="mb-2 font-semibold">Conferência por pessoa</h3><p className="mb-3 text-sm text-slate-500">Só preencha as horas após a execução. Horas extras são parte das horas realizadas.</p>{edit.participantes.map(x=>{const patch=(v:Partial<typeof x>)=>setEdit({...edit,participantes:edit.participantes.map(p=>p.colaboradorId===x.colaboradorId?{...p,...v}:p)});return <div key={x.colaboradorId} className="mb-3 rounded-xl bg-slate-50 p-3"><p className="mb-2 font-medium">{nomePessoa(x.colaboradorId)}</p><div className="grid gap-3 sm:grid-cols-3"><Campo label="Situação"><Select value={x.situacao} onChange={e=>patch({situacao:e.target.value as typeof x.situacao})}>{['Escalado','Confirmado','Realizado','Dispensado'].map(s=><option key={s}>{s}</option>)}</Select></Campo><Campo label="Horas realizadas"><Input type="number" min="0" max="24" step="0.25" value={x.realizadoMin===null?'':x.realizadoMin/60} onChange={e=>patch({realizadoMin:e.target.value===''?null:Math.round(Number(e.target.value)*60)})}/></Campo><Campo label="Dessas, horas extras"><Input type="number" min="0" max="24" step="0.25" value={x.extrasMin===null?'':x.extrasMin/60} onChange={e=>patch({extrasMin:e.target.value===''?null:Math.round(Number(e.target.value)*60)})}/></Campo></div></div>;})}</div>}
      <Campo label="Orientações e conferência"><Textarea value={edit.observacao} onChange={e=>setEdit({...edit,observacao:e.target.value})} placeholder="Serviço combinado, materiais, responsável e cuidados necessários."/></Campo>
      {edit.id&&<label className="flex items-center gap-2"><input type="checkbox" checked={edit.cancelado} onChange={e=>setEdit({...edit,cancelado:e.target.checked})}/>Plantão cancelado — manter no histórico</label>}
    </div></Modal>}
  </section>;
}
