import { useCallback, useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, CheckCircle2, ClipboardList, DoorOpen, GraduationCap, HeartHandshake, LockKeyhole, MessageSquare, Plus, RefreshCw, Search, ShieldCheck, Users } from "lucide-react";
import { Campo, Input, Select } from "@/components/ui/form";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import ClimaPesquisa from "@/components/pesquisas/ClimaPesquisa";
import { chamarEntrevistas, MODELOS_ENTREVISTA, nomePessoaEntrevista, type Entrevista, type ModeloEntrevista, type PessoaEntrevista } from "@/lib/entrevistas";
import EntrevistaEditor from "@/components/pesquisas/EntrevistaEditor";

export const CATEGORIAS_ESCUTA = [
 {id:"clima",nome:"Clima e eNPS",descricao:"Escuta coletiva",icon:HeartHandshake,cor:"border-sky-200 bg-sky-50 text-sky-900",ponto:"bg-sky-500"},
 {id:"selecao",nome:"Seleção",descricao:"Antes de entrar",icon:Users,cor:"border-indigo-200 bg-indigo-50 text-indigo-900",ponto:"bg-indigo-500"},
 {id:"entrada",nome:"Entrada e integração",descricao:"Boas-vindas · 30 / 60 / 90 dias",icon:DoorOpen,cor:"border-teal-200 bg-teal-50 text-teal-900",ponto:"bg-teal-500"},
 {id:"acompanhamento",nome:"Acompanhamento",descricao:"Rotina e permanência",icon:MessageSquare,cor:"border-violet-200 bg-violet-50 text-violet-900",ponto:"bg-violet-500"},
 {id:"desenvolvimento",nome:"Desenvolvimento",descricao:"Carreira e treinamento",icon:GraduationCap,cor:"border-amber-200 bg-amber-50 text-amber-950",ponto:"bg-amber-500"},
 {id:"saida",nome:"Saída",descricao:"Aprendizado e transição",icon:DoorOpen,cor:"border-rose-200 bg-rose-50 text-rose-900",ponto:"bg-rose-500"},
];
const painel="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5";
const dia=(d:string)=>d.split("-").reverse().join("/");
export default function Nps() {
 const sessao=useSessao();
 // Quem participa da pesquisa não recebe sequer a requisição das entrevistas.
 return ehRH(sessao) ? <CentralEscuta/> : <ClimaPesquisa/>;
}
function CentralEscuta() {
 const [aba,setAba]=useState("modelos"); const [categoria,setCategoria]=useState("todas");
 const [entrevistas,setEntrevistas]=useState<Entrevista[]>([]); const [pessoas,setPessoas]=useState<PessoaEntrevista[]>([]);
 const [carregando,setCarregando]=useState(true); const [erro,setErro]=useState(""); const [aviso,setAviso]=useState(""); const [ocupado,setOcupado]=useState(false);
 const [modelo,setModelo]=useState<ModeloEntrevista|null>(null); const [pessoa,setPessoa]=useState(""); const [data,setData]=useState(""); const [criacaoId,setCriacaoId]=useState("");
 const [aberta,setAberta]=useState<string|null>(null); const [busca,setBusca]=useState(""); const [status,setStatus]=useState("Pendentes");
 const carregar=useCallback(async(propagar=false)=>{
  setCarregando(true);setErro("");
  try {const r=await chamarEntrevistas("listar");setEntrevistas(r.entrevistas);setPessoas(r.pessoas);}
  catch(e){setErro(e instanceof Error?e.message:"Entrevistas indisponíveis.");if(propagar)throw e;}
  finally{setCarregando(false);}
 },[]);
 useEffect(()=>{void carregar();},[carregar]);
 const identificar=(e:Entrevista)=>pessoas.find(p=>p.id===e.pessoa_id && p.colecao===e.pessoa_colecao);
 const selecionada=entrevistas.find(e=>e.id===aberta);
 const modelos=MODELOS_ENTREVISTA.filter(m=>categoria==="todas" || m.categoria===categoria);
 const filtradas=entrevistas.filter(e=>{
  const m=MODELOS_ENTREVISTA.find(x=>x.id===e.modelo);
  return (categoria==="todas" || categoria===m?.categoria) && (status==="Todas" || (status==="Pendentes"?e.estado!=="Concluída":e.estado===status)) && `${nomePessoaEntrevista(identificar(e))} ${m?.titulo ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"));
 }).sort((a,b)=>status==="Concluída"?b.agendada.localeCompare(a.agendada):a.agendada.localeCompare(b.agendada));
 function preparar(m:ModeloEntrevista){setModelo(m);setPessoa("");setData("");setCriacaoId(crypto.randomUUID());setAviso("");}
 async function criar(){
  if(!modelo) return;
  setOcupado(true);setErro("");
  try{await chamarEntrevistas("criar",{id:criacaoId,modelo:modelo.id,pessoa_id:pessoa,agendada:data});setModelo(null);setAberta(criacaoId);setAba("agenda");setCategoria("todas");setStatus("Pendentes");await carregar();setAviso("Entrevista agendada. Nenhum convite foi enviado automaticamente.");}
  catch(e){setErro(e instanceof Error?e.message:"Não foi possível agendar.");}finally{setOcupado(false);}
 }
 if(selecionada) return <EntrevistaEditor entrevista={selecionada} pessoa={identificar(selecionada)} onVoltar={()=>setAberta(null)} onSalvo={()=>carregar(true)}/>;
 return <div className="space-y-4">
  <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand p-5 text-white sm:p-6">
   <div><p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/75">Pessoas · escuta e relacionamento</p><h1 className="!text-white text-2xl font-bold sm:text-3xl">Pesquisas e entrevistas</h1><p className="mt-2 max-w-2xl text-sm text-white/90">Da primeira conversa à saída. Escolha o momento, use um roteiro e acompanhe os combinados.</p></div>
   <button className="flex min-h-11 items-center gap-2 rounded-lg border border-white/40 px-4 py-2 text-sm hover:bg-white/10" disabled={carregando || ocupado} onClick={()=>void carregar()}><RefreshCw className="h-4 w-4"/>Atualizar</button>
  </header>
  <nav aria-label="Áreas da central" className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
   {[{id:"modelos",label:"Modelos e roteiros",icon:BookOpen},{id:"agenda",label:"Entrevistas e histórico",icon:CalendarDays},{id:"clima",label:"Pesquisas de clima e eNPS",icon:ShieldCheck}].map(a=><button key={a.id} aria-pressed={aba===a.id} onClick={()=>{setAba(a.id);setModelo(null);}} className={aba===a.id?"btn-primary":"btn-outline"}><a.icon className="h-4 w-4"/>{a.label}</button>)}
  </nav>
  {aba==="clima" ? <ClimaPesquisa/> : <>
   <div className="grid grid-cols-2 gap-2 lg:grid-cols-6" aria-label="Tipos de pesquisa e entrevista">{CATEGORIAS_ESCUTA.map(c=><button key={c.id} aria-pressed={categoria===c.id} className={`min-h-28 rounded-xl border p-3 text-left transition hover:shadow-sm ${c.cor} ${categoria===c.id?"ring-2 ring-brand ring-offset-2":""}`} onClick={()=>{if(c.id==="clima")setAba("clima");else setCategoria(categoria===c.id?"todas":c.id);setModelo(null);}}><c.icon className="mb-2 h-5 w-5"/><span className="block text-sm font-bold">{c.nome}</span><span className="mt-1 block text-xs leading-relaxed">{c.descricao}</span></button>)}</div>
   <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="flex items-center gap-2 text-slate-600"><LockKeyhole className="h-4 w-4"/>Entrevistas identificadas · somente o RH tem acesso</span>{categoria!=="todas" && <button className="btn-outline" onClick={()=>setCategoria("todas")}>Ver todos os tipos</button>}</div>
   {erro && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">{erro} Os roteiros continuam disponíveis. Os registros não são salvos offline; tente atualizar com conexão.</div>}
   {aviso && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900">{aviso}</p>}
   {modelo && <section className={painel+" border-teal-200 bg-teal-50/40"} aria-label="Agendar entrevista">
    <div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">{modelo.titulo}</h2><p className="text-sm text-slate-600">{modelo.objetivo}</p></div><button className="btn-outline" disabled={ocupado} onClick={()=>setModelo(null)}>Cancelar</button></div>
    <form onSubmit={e=>{e.preventDefault();void criar();}} className="grid gap-3 sm:grid-cols-[1fr_200px_auto]">
     <Campo label={modelo.categoria==="selecao"?"Candidato do recrutamento":"Colaborador do RH"}><Select required value={pessoa} disabled={carregando || !!erro || ocupado} onChange={e=>setPessoa(e.target.value)}><option value="">Selecione o cadastro</option>{pessoas.filter(p=>p.colecao===(modelo.categoria==="selecao"?"candidatos":"colaboradores")).map(p=><option key={p.id} value={p.id}>{nomePessoaEntrevista(p)}</option>)}</Select></Campo>
     <Campo label="Data da conversa"><Input type="date" required value={data} onChange={e=>setData(e.target.value)}/></Campo><button className="btn-primary self-end" disabled={carregando || !!erro || ocupado}>{ocupado?"Agendando…":"Agendar entrevista"}</button>
    </form><p className="mt-3 text-xs text-slate-600">O cadastro é o mesmo do RH. Na seleção, use o candidato já cadastrado em Recrutamento. A agenda desta central é interna; o agendamento não envia mensagens.</p>
   </section>}
   {aba==="modelos" ? <section className="space-y-3">
    <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Escolha um roteiro</h2><span className="text-sm text-slate-500">{modelos.length} modelos de entrevista</span></div>
    <div className="grid gap-3 md:grid-cols-2">{modelos.map(m=>{const c=CATEGORIAS_ESCUTA.find(c=>c.id===m.categoria)!;return <article key={m.id} className={painel+" relative overflow-hidden"}><span className={`absolute inset-y-0 left-0 w-1 ${c.ponto}`}/><div className="flex flex-wrap items-center justify-between gap-2"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${c.cor}`}>{c.nome}</span><span className="text-xs text-slate-500">{m.momento}</span></div><h3 className="mt-3 text-lg font-bold text-brand-ink">{m.titulo}</h3><p className="mt-1 text-sm text-slate-600">{m.objetivo}</p><details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-medium">Ver roteiro · {m.perguntas.length} perguntas</summary><ol className="mt-3 list-decimal space-y-2 pl-5 text-slate-700">{m.perguntas.map(q=><li key={q.id}>{q.texto}</li>)}</ol></details><button className="btn-outline mt-3 w-full justify-between" onClick={()=>preparar(m)}><span>Usar este roteiro</span><ArrowRight className="h-4 w-4"/></button></article>;})}</div>
    <aside className={painel+" text-sm text-slate-600"}><strong className="text-slate-800">Conversa com propósito</strong><p className="mt-1">Explique a finalidade e quem pode ler o registro. As perguntas abertas são opcionais; respeite a decisão de não responder. Registre somente informações necessárias ao trabalho, sem diagnósticos ou detalhes da vida pessoal. Combine o próximo passo e a data de revisão.</p><details className="mt-3"><summary className="cursor-pointer font-medium">Referências e registros anteriores</summary><p className="mt-2">Roteiros originais apoiados nas orientações de <a className="underline" href="https://www.cipd.org/en/knowledge/guides/employee-induction/" target="_blank" rel="noreferrer">integração da CIPD</a> e de <a className="underline" href="https://www.gallup.com/workplace/236051/real-value-getting-exit-interview-right.aspx" target="_blank" rel="noreferrer">entrevistas de saída da Gallup</a>. A entrevista de desenvolvimento apoia o PDI existente; não altera avaliações automaticamente.</p><a className="mt-2 inline-block underline" href="#/desempenho?aba=pesquisas">Consultar acervo anterior de pesquisas e dinâmicas</a><p className="mt-1 text-xs">Os registros anteriores permanecem no acervo e não são misturados aos ciclos confidenciais desta central.</p></details></aside>
   </section> : <section className={painel+" space-y-4"}>
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Entrevistas e histórico</h2><p className="text-sm text-slate-500">Próximas conversas, registros e combinados em um só lugar.</p></div><button className="btn-primary" onClick={()=>setAba("modelos")}><Plus className="h-4 w-4"/>Agendar entrevista</button></div>
    <div className="grid gap-3 sm:grid-cols-[1fr_220px]"><Campo label="Buscar pessoa ou roteiro"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><Input className="pl-9" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Nome, ID ou tipo de entrevista"/></div></Campo><Campo label="Situação"><Select value={status} onChange={e=>setStatus(e.target.value)}>{["Pendentes","Agendada","Em andamento","Concluída","Todas"].map(s=><option key={s}>{s}</option>)}</Select></Campo></div>
    {carregando?<p role="status">Consultando entrevistas…</p>:erro?null:filtradas.length===0?<div className="rounded-xl bg-slate-50 p-6 text-center"><ClipboardList className="mx-auto mb-2 h-6 w-6 text-slate-400"/><strong>Nenhuma entrevista neste filtro</strong><p className="mt-1 text-sm text-slate-500">Agende usando um roteiro ou altere o tipo e a situação acima.</p></div>:<div className="divide-y divide-slate-100">{filtradas.map(e=>{const m=MODELOS_ENTREVISTA.find(m=>m.id===e.modelo);const c=CATEGORIAS_ESCUTA.find(c=>c.id===m?.categoria);return <article key={e.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full border px-2 py-1 text-xs font-semibold ${c?.cor??""}`}>{m?.titulo}</span><span className="text-xs font-medium text-slate-600">{e.estado}</span></div><strong className="break-words text-sm">{nomePessoaEntrevista(identificar(e))}</strong><p className="mt-1 text-xs text-slate-500">Conversa: {dia(e.agendada)}{e.revisao?` · Revisar combinados: ${dia(e.revisao)}`:""}</p></div><button className="btn-outline" onClick={()=>setAberta(e.id)}>{e.estado==="Concluída"?<CheckCircle2 className="h-4 w-4"/>:<MessageSquare className="h-4 w-4"/>}{e.estado==="Concluída"?"Ver registro":"Registrar conversa"}</button></article>;})}<p className="pt-3 text-xs text-slate-500">{filtradas.length} de {entrevistas.length} entrevistas</p></div>}
   </section>}
  </>}
 </div>;
}
