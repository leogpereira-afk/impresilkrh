import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, ArrowRight, CheckCheck, ClipboardList, HeartHandshake, History, MessageSquare, RefreshCw, Smile, Users } from 'lucide-react';
import { useSessao } from '@/lib/session';
import { ehRH, podeGerir, modulosLiberados, moduloAcessivel } from '@/lib/rbac';
import { useColecao } from '@/lib/store';
import { chamarEscuta, pendenteAcao, type ListaEscuta } from '@/lib/escuta';
import { chamarEntrevistas, MODELOS_ENTREVISTA, nomePessoaEntrevista, type Entrevista } from '@/lib/entrevistas';
import { diaLocalISO } from '@/lib/format';
import ClimaPesquisa from '@/components/pesquisas/ClimaPesquisa';
import Individuais from '@/components/pesquisas/Individuais';
import AcoesEscuta from '@/components/pesquisas/AcoesEscuta';
const Feedback=lazy(()=>import('./Feedback'));
const Entrevistas=lazy(()=>import('@/components/pesquisas/EntrevistasCentral'));
const Acervo=lazy(()=>import('./Desempenho').then(m=>({default:m.AcervoPesquisas})));
const abas=[
 {id:'visao',nome:'Visão geral',icon:Activity,cor:'border-slate-300 bg-slate-100 text-slate-900'},
 {id:'feedbacks',nome:'Feedbacks',icon:MessageSquare,cor:'border-blue-300 bg-blue-100 text-blue-950'},
 {id:'clima',nome:'Clima',icon:HeartHandshake,cor:'border-teal-300 bg-teal-100 text-teal-950'},
 {id:'enps',nome:'eNPS',icon:Smile,cor:'border-sky-300 bg-sky-100 text-sky-950'},
 {id:'individuais',nome:'Individuais',icon:ClipboardList,cor:'border-violet-300 bg-violet-100 text-violet-950'},
 {id:'entrevistas',nome:'Entrevistas',icon:Users,cor:'border-amber-300 bg-amber-100 text-amber-950'},
 {id:'acoes',nome:'Ações e histórico',icon:History,cor:'border-rose-300 bg-rose-100 text-rose-950'},
];
const vazio:ListaEscuta={ok:false,pessoas:[],individuais:[],acoes:[],origens:[]};
export default function Nps(){ const s=useSessao();return s?<Central key={`${s.perfil}:${s.colaboradorId}`}/>:null;}
function Central(){
 const sessao=useSessao();const rh=ehRH(sessao);const {items:usuarios}=useColecao('usuarios');const feedback=podeGerir(sessao)&&moduloAcessivel('feedback',modulosLiberados(sessao,usuarios));
 const [params,setParams]=useSearchParams();const [dados,setDados]=useState<ListaEscuta>(vazio);const [entrevistas,setEntrevistas]=useState<Entrevista[]>([]);const [erro,setErro]=useState('');const [loading,setLoading]=useState(true);const [atualizado,setAtualizado]=useState('');
 const permitidas=abas.filter(a=>rh||['clima','enps','individuais'].includes(a.id)||(a.id==='feedbacks'&&feedback));
 const pedida=params.get('aba')??(rh?'visao':'individuais');const aba=(permitidas.some(a=>a.id===pedida)||rh&&pedida==='acervo')?pedida:permitidas[0].id;
 const [visitadas,setVisitadas]=useState<string[]>([aba]);
 const [consulta,setConsulta]=useState({area:"",filtro:"Pendentes",modo:"agenda",seq:0});
 useEffect(()=>{setVisitadas(v=>v.includes(aba)?v:[...v,aba]);},[aba]);
 function navegar(a:string,filtro?:string,modo="agenda",listar=false){if(listar&&document.querySelector(`[data-area="${a}"] [data-dirty="true"]`)&&!window.confirm("Há anotações não salvas nesta área. Descartar e abrir a lista do indicador?"))return;if(listar)setConsulta(v=>({area:a,filtro:filtro??"Pendentes",modo,seq:v.seq+1}));setParams(p=>{p.set('aba',a);if(a==='entrevistas')p.set('modo',modo);else p.delete('modo');p.delete('origem');if(filtro)p.set('filtro',filtro);else p.delete('filtro');return p;});}
 const carregar=useCallback(async()=>{setLoading(true);setErro('');try{const [r,e]=await Promise.all([chamarEscuta('listar'),rh?chamarEntrevistas('listar'):Promise.resolve(null)]);setDados(r);setEntrevistas(e?.entrevistas??[]);setAtualizado(new Date().toLocaleString('pt-BR'));}catch(e){setErro((e as Error).message);throw e;}finally{setLoading(false);}},[rh]);
 useEffect(()=>{void carregar().catch(()=>{});},[carregar]);
 const origens=[...dados.origens,...dados.individuais.map(i=>({tipo:'individual',id:i.id,pessoa_id:i.pessoa_id,titulo:i.roteiro.titulo})),...entrevistas.filter(e=>e.pessoa_colecao==='colaboradores').map(e=>({tipo:'entrevista',id:e.id,pessoa_id:e.pessoa_id,titulo:e.roteiro?.titulo??MODELOS_ENTREVISTA.find(m=>m.id===e.modelo)?.titulo??"Entrevista"}))];
 const hoje=diaLocalISO();const proximas=entrevistas.filter(e=>e.estado!=='Concluída').sort((a,b)=>a.agendada.localeCompare(b.agendada));const revisoes=dados.acoes.filter(a=>pendenteAcao(a,hoje));
 const pessoa=(id:string,colecao='colaboradores')=>dados.pessoas.find(p=>p.id===id&&p.colecao===colecao);
 return <div className="space-y-4"><header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand p-5 text-white"><div><p className="text-xs font-semibold uppercase tracking-widest text-white/75">Pessoas · escutar, combinar e acompanhar</p><h1 className="mt-1 !text-white text-2xl font-bold sm:text-3xl">Feedback & Pesquisas</h1><p className="mt-2 text-sm text-white/90">Cada conversa no seu lugar. Cada próximo passo com acompanhamento.</p></div><button className="flex min-h-11 items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm" disabled={loading} onClick={()=>void carregar().catch(()=>{})}><RefreshCw className="h-4 w-4"/>Atualizar</button></header>
 <nav aria-label="Áreas de Feedback e Pesquisas" className="flex flex-wrap gap-2">{permitidas.map(a=><button key={a.id} aria-pressed={aba===a.id} onClick={()=>navegar(a.id)} className={`flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${aba===a.id?a.cor+' ring-2 ring-brand/20':'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}><a.icon className="h-4 w-4"/>{a.nome}</button>)}</nav>
 <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>{rh?'Gestão e registros identificados: RH autorizado':'Somente conteúdos autorizados para o seu perfil'}</span>{atualizado&&<span>Fonte: RH · consulta em {atualizado}</span>}</div>
 {erro&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{erro} A consulta não foi concluída. Atualize com conexão; os dados desta central não entram na fila offline.</p>}
 {aba==='visao'&&rh&&<div className="space-y-4">{loading?<p role="status">Consultando acompanhamentos…</p>:erro?null:<><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
  {titulo:'Conversas agendadas',n:proximas.length,ir:'entrevistas',icon:Users},
  {titulo:'Individuais pendentes',n:dados.individuais.filter(i=>i.estado!=='Concluída').length,ir:'individuais',icon:ClipboardList},
  {titulo:'Ações em aberto',n:dados.acoes.filter(a=>a.estado!=='Concluída').length,ir:'acoes',icon:CheckCheck},
  {titulo:'Ações para revisar',n:revisoes.length,ir:'acoes',filtro:'Revisar',icon:History},
 ].map(c=><button key={c.titulo} onClick={()=>navegar(c.ir,c.filtro,"agenda",true)} className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-brand"><span className="flex items-center justify-between gap-2 text-xs text-slate-600">{c.titulo}<c.icon className="h-4 w-4"/></span><strong className="mt-2 block text-2xl text-brand">{c.n}</strong><span className="text-xs text-slate-500">Abrir registros →</span></button>)}</div>
 <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">Próximas conversas</h2><p className="mt-1 text-sm text-slate-500">As mais antigas aparecem primeiro. Concluir preserva o registro no histórico.</p>{proximas.length===0?<p className="mt-3 text-sm">Nenhuma entrevista pendente.</p>:proximas.slice(0,5).map(e=><div className="flex flex-wrap justify-between gap-2 border-b py-3 text-sm" key={e.id}><div><strong>{nomePessoaEntrevista(pessoa(e.pessoa_id,e.pessoa_colecao))}</strong><p className="text-xs text-slate-500">{e.roteiro?.titulo??MODELOS_ENTREVISTA.find(m=>m.id===e.modelo)?.titulo??"Entrevista"} · {e.agendada.split('-').reverse().join('/')} · {e.agendada<hoje?'Conversa em atraso':e.estado}</p></div><button className="btn-outline" onClick={()=>navegar('entrevistas',undefined,'agenda',true)}>Abrir agenda</button></div>)}</section>
 <div className="grid gap-3 md:grid-cols-2"><section className="rounded-xl border border-blue-200 bg-blue-50 p-4"><h2 className="font-bold">Conversas e devolutivas</h2><p className="my-2 text-sm text-slate-600">A fila de feedbacks mantém os registros, a cadência e os combinados existentes. Preparar uma conversa continua diferente de realizá-la.</p><button className="btn-outline" onClick={()=>navegar('feedbacks')}>Abrir meus feedbacks <ArrowRight className="h-4 w-4"/></button></section><section className="rounded-xl border border-teal-200 bg-teal-50 p-4"><h2 className="font-bold">Uma pergunta, um propósito</h2><p className="my-2 text-sm text-slate-600">Clima identifica temas da experiência de trabalho. eNPS mede recomendação. Individuais e entrevistas ajudam a acompanhar cada pessoa.</p><button className="btn-outline" onClick={()=>navegar('entrevistas',undefined,'modelos',true)}>Explorar biblioteca de roteiros</button></section></div>
 <details className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">Linha do tempo por pessoa e vínculos a conferir</summary><LinhaTempo dados={dados} entrevistas={entrevistas}/></details>
 <button className="text-sm underline" onClick={()=>navegar('acervo')}>Consultar acervo anterior de pesquisas e dinâmicas</button></> }</div>}
 <Suspense fallback={<p role="status">Abrindo área…</p>}>
 {feedback&&visitadas.includes('feedbacks')&&<div hidden={aba!=='feedbacks'}><Feedback/></div>}
 {visitadas.includes('clima')&&<div hidden={aba!=='clima'}><ClimaPesquisa instrumento="clima"/></div>}
 {visitadas.includes('enps')&&<div hidden={aba!=='enps'}><ClimaPesquisa instrumento="enps"/></div>}
 {visitadas.includes('individuais')&&<div data-area="individuais" hidden={aba!=='individuais'}>{!dados.ok?<p>Questionários ainda não consultados.</p>:<Individuais consulta={consulta.area==="individuais"?consulta.seq:0} dados={dados} rh={rh} recarregar={carregar}/>}</div>}
 {rh&&visitadas.includes('entrevistas')&&<div data-area="entrevistas" hidden={aba!=='entrevistas'}><Entrevistas consulta={consulta.area==="entrevistas"?consulta.seq:0} modoInicial={consulta.area==="entrevistas"?consulta.modo:"agenda"} onAtualizado={()=>void carregar().catch(()=>{})}/></div>}
 {rh&&visitadas.includes('acoes')&&<div data-area="acoes" hidden={aba!=='acoes'}>{dados.ok&&<AcoesEscuta consulta={consulta.area==="acoes"?consulta.seq:0} origemInicial={params.get('origem')??''} filtroInicial={params.get('filtro')??'Pendentes'} dados={dados} origens={origens} recarregar={carregar}/>}</div>}
 {rh&&aba==='acervo'&&<section><p className="mb-3 rounded-lg bg-amber-50 p-3 text-sm">Acervo anterior. Mantém as regras originais de acesso; estes registros não são os novos ciclos confidenciais de Clima ou eNPS.</p><Acervo/></section>}
 </Suspense></div>;
}
function LinhaTempo({dados,entrevistas}:{dados:ListaEscuta;entrevistas:Entrevista[]}){
 const [id,setId]=useState('');const itens=[...entrevistas.map(e=>({id:'e'+e.id,pessoa:`${e.pessoa_colecao}:${e.pessoa_id}`,data:e.agendada,titulo:e.roteiro?.titulo??MODELOS_ENTREVISTA.find(m=>m.id===e.modelo)?.titulo??"Entrevista",estado:e.estado})),...dados.individuais.map(i=>({id:'i'+i.id,pessoa:`colaboradores:${i.pessoa_id}`,data:i.prazo,titulo:i.roteiro.titulo,estado:i.estado})),...dados.acoes.map(a=>({id:'a'+a.id,pessoa:`colaboradores:${a.pessoa_id}`,data:a.prazo,titulo:a.titulo,estado:a.estado}))].filter(i=>i.pessoa===id).sort((a,b)=>b.data.localeCompare(a.data));
 return <div className="mt-3 space-y-3"><label className="block text-sm font-semibold">Pessoa e ID<select className="mt-1 block w-full rounded-lg border p-2 font-normal" value={id} onChange={e=>setId(e.target.value)}><option value="">Selecione uma pessoa</option>{dados.pessoas.map(p=><option key={p.colecao+p.id} value={`${p.colecao}:${p.id}`}>{nomePessoaEntrevista(p)}{p.pendencia?` · ${p.pendencia}`:''}</option>)}</select></label>{id&&<><p className="text-xs text-slate-500">Entrevistas, questionários e ações desta central. Feedbacks e PDI preservam o histórico nas áreas correspondentes.</p>{itens.length===0?<p className="text-sm">Sem registros nesta central para esse vínculo.</p>:itens.map(i=><p key={i.id} className="border-l-2 border-brand py-2 pl-3 text-sm"><strong>{i.titulo}</strong><br/>{i.data.split('-').reverse().join('/')} · {i.estado}</p>)}</>}</div>;
}
