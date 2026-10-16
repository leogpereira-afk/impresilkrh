import { useMemo, useState } from "react";
import { RichContent } from "@/components/ui/rich";
import { AnexosEndo } from "@/components/endomarketing/anexos";
import { EventoModal } from "./Calendario";
import { AbaTemplates } from "./Mensagens";
import type { EventoCalendario } from "@/data/types";
import { Link } from "react-router-dom";
import { Plus, HeartHandshake, CalendarDays, Lightbulb, Check, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { Tabs, useAbaAtiva } from "@/components/ui/tabs";
import { Pessoa } from "@/components/ui/pessoa";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { useSessao } from "@/lib/session";
import { useHoje } from "@/lib/useHoje";
import { ehRH, podeGerir, modulosLiberados, moduloAcessivel, podeVerDadosSensiveis } from "@/lib/rbac";
import { idDaPessoa } from "@/lib/identidade";
import { normalizar } from "@/lib/buscaTelas";
import { MODELOS_ENDO, FONTES_ENDO, TEMAS_ENDO, SITUACOES_ENDO, type AcaoEndomarketing, type TemaEndo } from "@/data/endomarketing";
import { agendaEndo, pessoasEndo, hojeEndo, dataCurtaEndo, dataValidaEndo, acaoAberta, acaoAtrasada, novaAcaoEndo, registrarAcaoEndo, conteudoEndo, eventoEndo, type MarcoEndo } from "@/lib/endomarketing";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const chip = "rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand";
const corTema: Record<TemaEndo, string> = { Acolhimento: "bg-sky-50 text-sky-800", Reconhecimento: "bg-amber-50 text-amber-800", Escuta: "bg-violet-50 text-violet-800", Conexão: "bg-indigo-50 text-indigo-800", "Bem-estar": "bg-teal-50 text-teal-800", Desenvolvimento: "bg-blue-50 text-blue-800", Celebração: "bg-pink-50 text-pink-800" };
const corSituacao = { Planejada: "bg-slate-100 text-slate-700", "Em preparação": "bg-blue-50 text-blue-800", Realizada: "bg-emerald-50 text-emerald-800", Cancelada: "bg-slate-100 text-slate-500" };

export default function Endomarketing() {
  const sessao = useSessao();
  const hoje = hojeEndo(useHoje());
  const rh = ehRH(sessao);
  const toast = useToast();
  const { items: colaboradores } = useColecao("colaboradores");
  const { items: eventos, remover: removerEvento } = useColecao("eventos");
  const { items: usuarios } = useColecao("usuarios");
  const colecao = useColecao("endomarketing");
  const acoes = rh ? colecao.items : [];
  const [ano, setAno] = useState(Number(hoje.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoje.slice(5, 7)) - 1);
  const [aba, setAba] = useAbaAtiva("endomarketing", ["agenda", "acoes", "ideias"], "agenda");
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("Todos");
  const [filtroAcao, setFiltroAcao] = useState("Abertas");
  const [todosPeriodos, setTodosPeriodos] = useState(false);
  const [tema, setTema] = useState("Todos");
  const [rascunho, setRascunho] = useState<AcaoEndomarketing | null>(null);
  const [base, setBase] = useState<AcaoEndomarketing | undefined>();
  const [inicial, setInicial] = useState("");
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [arquivoOcupado, setArquivoOcupado] = useState(false);
  const [excluirData, setExcluirData] = useState<EventoCalendario | null>(null);
  const [dataModal, setDataModal] = useState<EventoCalendario | null | undefined>();
  const { items: guias } = useColecao("comunicacao");
  const guiasEndo = guias.filter(g => conteudoEndo(g.titulo));
  const [erro, setErro] = useState("");
  const [novoItem, setNovoItem] = useState("");
  const pessoas = useMemo(() => pessoasEndo(sessao, colaboradores, hoje), [sessao, colaboradores, hoje]);
  const marcos = useMemo(() => agendaEndo(pessoas, eventos, ano), [pessoas, eventos, ano]);
  const periodo = `${ano}-${String(mes + 1).padStart(2, "0")}`;
  const doMes = marcos.filter(m => m.data.startsWith(periodo));
  const termo = normalizar(busca);
  const agendaFiltrada = doMes.filter(m => (tipo === "Todos" || m.tipo === tipo) && normalizar(`${m.titulo} ${m.detalhe}`).includes(termo));
  const proximos = agendaFiltrada.filter(m => m.data >= hoje);
  const passados = agendaFiltrada.filter(m => m.data < hoje);
  const acoesPeriodo = acoes.filter(a => todosPeriodos || !a.data || a.data.startsWith(periodo));
  const acoesFiltradas = acoesPeriodo.filter(a => (filtroAcao === "Todas" || (filtroAcao === "Abertas" ? acaoAberta(a) : filtroAcao === "Atrasadas" ? acaoAtrasada(a, hoje) : a.situacao === filtroAcao)) && normalizar(`${a.titulo} ${a.objetivo} ${a.publico}`).includes(termo)).sort((a, b) => Number(acaoAberta(b)) - Number(acaoAberta(a)) || (a.data || "9999").localeCompare(b.data || "9999"));
  const selecionada = acoesFiltradas.find(a => a.id === selecionadaId) ?? acoesFiltradas[0];
  const anos = [...new Set([Number(hoje.slice(0, 4)) - 1, Number(hoje.slice(0, 4)), Number(hoje.slice(0, 4)) + 1, ano, ...acoes.filter(a => a.data).map(a => Number(a.data.slice(0, 4)))])].sort((a, b) => a - b);
  const liberados = modulosLiberados(sessao, usuarios);
  const podeAbrir = (modulo: string) => moduloAcessivel(modulo, liberados);
  const gerirDatas = podeGerir(sessao) && podeAbrir("calendario");
  const abrir = (a: AcaoEndomarketing) => { setRascunho(structuredClone(a)); setInicial(JSON.stringify(a)); setBase(a.id ? a : undefined); setErro(""); setNovoItem(""); };
  const fechar = () => {
    if (arquivoOcupado) return;
    if (rascunho && JSON.stringify(rascunho) !== inicial && !window.confirm("Fechar sem salvar as alterações desta ação?")) return;
    setRascunho(null);
  };
  const salvar = (a: AcaoEndomarketing, anterior?: AcaoEndomarketing) => {
    if (!rh || !sessao || arquivoOcupado) return;
    try {
      if (anterior && JSON.stringify(colecao.items.find(x => x.id === anterior.id)) !== JSON.stringify(anterior)) throw new Error("Esta ação foi atualizada. Feche e abra novamente para conferir antes de salvar.");
      const salva = registrarAcaoEndo(a, anterior, sessao.colaboradorId);
      if (anterior) colecao.atualizar(anterior.id, salva);
      else { const { id: _id, ...nova } = salva; setSelecionadaId(colecao.criar(nova).id); }
      setRascunho(null);
      toast("Ação guardada neste aparelho e na fila de sincronização.");
    } catch (e) { const msg = e instanceof Error ? e.message : "Não foi possível salvar."; setErro(msg); toast(msg, "erro"); }
  };
  const planejar = (m: MarcoEndo) => {
    const existente = acoes.find(a => a.origemId === m.id && a.situacao !== "Cancelada");
    if (existente) { abrir(existente); return; }
    const modelo = MODELOS_ENDO.find(x => x.id === (m.tipo === "Aniversário" ? "aniversario" : m.tipo === "Tempo de empresa" ? "tempo-casa" : m.tipo === "Acolhimento" ? "boas-vindas" : "datas"));
    abrir({ ...novaAcaoEndo(modelo), titulo: `${m.tipo}: ${m.titulo}`, data: m.data, origemId: m.id, colaboradorId: m.colaboradorId });
  };
  const pessoa = (id: string) => podeVerDadosSensiveis(sessao, id) ? <Pessoa colaboradorId={id} /> : colaboradores.find(p => p.id === id)?.nome ?? "Pessoa não disponível";
  const listaAgenda = (lista: MarcoEndo[]) => <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{lista.map(m => <article key={m.id} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
    <div className="min-w-[42px] rounded-lg bg-brand/5 px-2 py-1 text-center text-brand"><strong className="block text-lg leading-tight">{m.data.slice(8)}</strong><span className="text-[10px] uppercase">{MESES[mes]}</span></div>
    <div className="min-w-0 flex-1"><span className="text-[11px] font-medium text-slate-500">{m.tipo}{m.data === hoje ? " · Hoje" : ""}</span><h3 className="break-words text-sm font-semibold text-slate-800">{m.colaboradorId ? pessoa(m.colaboradorId) : m.titulo}</h3><p className="mt-0.5 text-xs text-slate-500">{m.detalhe}</p>{m.descricao && <details className="mt-1 text-xs text-slate-600"><summary className="cursor-pointer">Detalhes da data</summary><p className="whitespace-pre-wrap">{m.descricao}</p></details>}{rh && <button className="mt-2 text-xs font-semibold text-brand hover:underline" onClick={() => planejar(m)}>{acoes.some(a => a.origemId === m.id && a.situacao !== "Cancelada") ? "Ação e arquivos" : "Planejar / anexar"}</button>}</div>
  </article>)}</div>;
  const campo = <K extends keyof AcaoEndomarketing>(key: K, value: AcaoEndomarketing[K]) => setRascunho(r => r ? { ...r, [key]: value } : r);

  return <div className="min-w-0">
    <PageHeader title="Endomarketing" description="Cuidar das pessoas, celebrar trajetórias e transformar escuta em ação." children={rh ? <button className="btn-primary" onClick={() => abrir(novaAcaoEndo())}><Plus className="h-4 w-4" /> Nova ação</button> : undefined} />
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-xs text-slate-500">Ano <select aria-label="Ano do endomarketing" value={ano} onChange={e => { setAno(Number(e.target.value)); setSelecionadaId(null); }} className="input !w-24 !py-1.5">{anos.map(a => <option key={a}>{a}</option>)}</select></label>
      <div className="flex flex-wrap gap-1" aria-label="Mês do endomarketing">{MESES.map((m, i) => <button key={m} aria-pressed={mes === i} onClick={() => { setMes(i); setSelecionadaId(null); }} className={`${chip} ${mes === i ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600"}`}>{m}</button>)}</div>
    </div>
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Resumo do mês">
      {([['Aniversários', 'Aniversário'], ['Tempo de empresa', 'Tempo de empresa'], ['Datas especiais', 'Data especial']] as const).map(([label, value]) => <button key={label} className={`${chip} border-slate-200 bg-white text-slate-700`} onClick={() => { setTipo(value); setAba("agenda"); }}><strong className="mr-1.5 text-brand">{doMes.filter(m => m.tipo === value).length}</strong>{label}</button>)}
      {rh && <button className={`${chip} border-violet-200 bg-violet-50 text-violet-800`} onClick={() => { setAba("acoes"); setFiltroAcao("Abertas"); setTodosPeriodos(true); }}><strong className="mr-1.5">{acoes.filter(acaoAberta).length}</strong>Ações abertas · todos os meses</button>}
    </div>
    <Tabs ativa={aba} aoMudar={a => { setAba(a); setBusca(""); }} abas={[
      { id: "agenda", label: "Agenda", icon: <CalendarDays className="h-4 w-4" />, conteudo: <>
        <div className="mb-3 flex flex-wrap items-center gap-2"><label className="relative min-w-[180px] flex-1"><span className="sr-only">Buscar na agenda</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><Input className="!pl-9" placeholder="Buscar pessoa ou data especial" value={busca} onChange={e => { setBusca(e.target.value); setSelecionadaId(null); }} /></label><select aria-label="Tipo de data" className="input !w-auto" value={tipo} onChange={e => setTipo(e.target.value)}>{["Todos", "Aniversário", "Tempo de empresa", "Acolhimento", "Data especial"].map(t => <option key={t}>{t}</option>)}</select></div>
        {gerirDatas && <div className="mb-2 flex flex-wrap gap-3 text-xs"><button className="font-semibold text-brand" onClick={() => setDataModal(null)}>+ Data especial</button><details><summary className="cursor-pointer text-brand">Gerenciar datas cadastradas</summary><ul className="mt-2 space-y-2">{eventos.filter(eventoEndo).map(e => <li key={e.id}><button className="text-left text-brand" onClick={() => setDataModal(e)}>{dataCurtaEndo(e.data)} · {e.titulo}</button><button className="ml-3 text-slate-500" aria-label={`Remover data: ${e.titulo}`} onClick={() => setExcluirData(e)}>Remover</button></li>)}</ul></details></div>}
        <p className="mb-3 text-xs text-slate-500">{MESES[mes]}/{ano} · Cadastro e calendário existentes · Somente pessoas dentro do seu acesso. A agenda não cria nem envia ações automaticamente.</p>
        {proximos.length > 0 ? listaAgenda(proximos) : <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-slate-500">Nenhuma próxima data neste recorte. Consulte as datas passadas ou escolha outro mês.</p>}
        {passados.length > 0 && <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-medium text-slate-600">Datas passadas · {passados.length}</summary><div className="mt-3">{listaAgenda(passados)}</div></details>}
        {rh && <details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer">Conferir datas do cadastro</summary><p className="my-2">{pessoas.filter(p => !dataValidaEndo(p.dataNascimento ?? "")).length} sem nascimento válido · {pessoas.filter(p => !dataValidaEndo(p.dataAdmissao ?? "")).length} sem admissão válida. Pessoas afastadas permanecem no quadro; desligadas não entram. Em anos não bissextos, o lembrete de 29/02 aparece em 28/02.</p>{podeAbrir("colaboradores") && <Link className="text-brand underline" to="/colaboradores">Conferir cadastros</Link>} · {podeAbrir("calendario") && <Link className="text-brand underline" to="/calendario">Calendário de prazos e reuniões</Link>}</details>}
      </> },
      { id: "acoes", label: "Ações e bem-estar", icon: <HeartHandshake className="h-4 w-4" />, conteudo: !rh ? <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">O planejamento e as observações das ações são internos ao perfil de RH. Consulte a agenda e as ideias disponíveis ao seu acesso.</p> : <>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Input aria-label="Buscar ações" placeholder="Buscar ação" value={busca} onChange={e => { setBusca(e.target.value); setSelecionadaId(null); }} className="!w-48 !py-1.5 !text-xs" />
          {["Abertas", "Atrasadas", "Todas"].map(f => <button key={f} aria-pressed={filtroAcao === f} onClick={() => { setFiltroAcao(f); setSelecionadaId(null); }} className={`rounded-full border px-2.5 py-1 text-xs font-medium ${filtroAcao === f ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600"}`}>{f}</button>)}
          <select aria-label="Etapa da ação" className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs" value={SITUACOES_ENDO.includes(filtroAcao as typeof SITUACOES_ENDO[number]) ? filtroAcao : ""} onChange={e => { setFiltroAcao(e.target.value || "Abertas"); setSelecionadaId(null); }}><option value="">Etapa</option>{SITUACOES_ENDO.map(f => <option key={f}>{f}</option>)}</select>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-500"><input type="checkbox" checked={todosPeriodos} onChange={e => { setTodosPeriodos(e.target.checked); setSelecionadaId(null); }} /> Todos os meses</label>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-x-3 text-xs text-slate-500"><span>{acoesFiltradas.length} {acoesFiltradas.length === 1 ? "ação" : "ações"} · {todosPeriodos ? "Todos os meses" : `${MESES[mes]}/${ano} + sem data`}</span><details><summary className="cursor-pointer">Critérios</summary><p className="py-1">Atrasadas fazem parte das abertas. Abra uma ação para ver objetivo, checklist e histórico.</p></details></div>
        {!acoesFiltradas.length && <div className="rounded-lg border border-dashed p-3 text-sm text-slate-500">Nenhuma ação neste filtro. <button className="font-semibold text-brand" onClick={() => setAba("ideias")}>Ver ideias</button></div>}
        {!!acoesFiltradas.length && <div className="grid items-start gap-3 lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
          <div aria-label="Lista de ações" className={`${selecionadaId ? "hidden lg:block" : ""} max-h-[65vh] overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100`}>
            {acoesFiltradas.map(a => <button key={a.id} aria-label={`Selecionar ação: ${a.titulo}`} aria-pressed={selecionada?.id === a.id} className={`block w-full border-l-2 px-3 py-2 text-left ${selecionada?.id === a.id ? "border-brand bg-brand/5" : "border-transparent hover:bg-slate-50"}`} onClick={() => setSelecionadaId(a.id)}><strong className="block break-words text-sm text-slate-800">{a.titulo}</strong><span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500"><span className={`rounded px-1.5 py-0.5 ${corSituacao[a.situacao]}`}>{a.situacao}</span>{dataCurtaEndo(a.data)}{acaoAtrasada(a, hoje) && <span className="text-red-700">Atrasada</span>}</span></button>)}
          </div>
          {selecionada && <section aria-label="Detalhe da ação" className={`${selecionadaId ? "" : "hidden lg:block"} min-w-0 rounded-xl border border-slate-200 bg-white p-3`}>
            <button className="mb-2 text-xs font-medium text-brand lg:hidden" onClick={() => setSelecionadaId(null)}>← Voltar à lista</button>
            <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-base font-semibold text-slate-800">{selecionada.titulo}</h3><p className="mt-1 text-xs text-slate-500">{dataCurtaEndo(selecionada.data)} · {selecionada.responsavelId ? pessoa(selecionada.responsavelId) : "Sem responsável"}</p></div><button aria-label={`Abrir ação: ${selecionada.titulo}`} className="text-xs font-semibold text-brand" onClick={() => abrir(selecionada)}>Editar / anexar</button></div>
            <div className="my-3 flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 text-xs ${corSituacao[selecionada.situacao]}`}>{selecionada.situacao}</span><span className={`rounded px-2 py-0.5 text-xs ${corTema[selecionada.tema]}`}>{selecionada.tema}</span><button className="ml-auto text-xs font-semibold text-brand" onClick={() => salvar({ ...selecionada, situacao: acaoAberta(selecionada) ? "Realizada" : "Planejada" }, selecionada)}>{acaoAberta(selecionada) ? "Concluir" : "Reabrir"}</button></div>
            {selecionada.objetivo && <p className="mb-2 whitespace-pre-wrap text-sm text-slate-600">{selecionada.objetivo}</p>}
            <AnexosEndo anexos={selecionada.anexos ?? []} />
            {!!selecionada.checklist.length && <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Checklist · {selecionada.checklist.filter(i => i.feito).length}/{selecionada.checklist.length}</summary><ul className="mt-2 space-y-1">{selecionada.checklist.map(i => <li key={i.id}>{i.feito ? "✓" : "○"} {i.texto}</li>)}</ul></details>}
            <details className="mt-3 text-xs text-slate-600"><summary className="cursor-pointer font-medium">Observações, resultado e histórico</summary><p className="my-2 whitespace-pre-wrap">{selecionada.publico && `Público: ${selecionada.publico}\n`}{selecionada.observacoes}{selecionada.resultado && `\nResultado: ${selecionada.resultado}`}</p><ul className="space-y-1">{[...selecionada.historico].reverse().map((h,i) => <li key={i}>{new Date(h.em).toLocaleString("pt-BR")} · {h.texto} · {pessoa(h.por)}</li>)}</ul></details>
          </section>}
        </div>}
      </> },
      { id: "ideias", label: "Ideias e materiais", icon: <Lightbulb className="h-4 w-4" />, conteudo: <>
        <p className="mb-3 text-sm text-slate-600">Modelos para adaptar à equipe. Escolha uma ação, combine quem participa e registre o retorno. Participação voluntária e respeito às preferências pessoais.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">{["Todos", ...TEMAS_ENDO].map(t => <button key={t} aria-pressed={tema === t} className={`${chip} ${tema === t ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600"}`} onClick={() => setTema(t)}>{t}</button>)}</div>
        <div className="grid items-start gap-2 md:grid-cols-2 xl:grid-cols-3">{MODELOS_ENDO.filter(m => tema === "Todos" || m.tema === tema).map(m => <article key={m.id} className="rounded-xl border border-slate-200 bg-white p-3"><span className={`rounded px-2 py-0.5 text-[11px] ${corTema[m.tema]}`}>{m.tema}</span><h3 className="mt-2 text-sm font-semibold text-slate-800">{m.titulo}</h3><p className="mt-1 text-xs leading-relaxed text-slate-500">{m.objetivo}</p><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-medium text-brand">Como fazer</summary><p className="mt-2">{m.publico} · {m.frequencia}</p><ol className="my-2 list-decimal space-y-1 pl-4">{m.passos.map(p => <li key={p}>{p}</li>)}</ol><p><strong>Avaliar:</strong> {m.avaliar}</p></details>{rh && <button className="mt-3 text-xs font-semibold text-brand hover:underline" onClick={() => abrir(novaAcaoEndo(m))}>Usar modelo</button>}</article>)}</div>
        {podeAbrir("comunicacao") && guiasEndo.length > 0 && <details className="mt-4 rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer font-medium">Guias de endomarketing · {guiasEndo.length}</summary>{guiasEndo.map(g => <article key={g.id} className="mt-3"><h3 className="font-semibold">{g.titulo}</h3><p className="text-xs text-slate-500">{g.descricao}{g.versao && ` · v${g.versao}`}</p><RichContent blocos={g.blocos} /></article>)}</details>}
        {podeGerir(sessao) && podeAbrir("mensagens") && <details className="mt-4 rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer font-medium">Modelos de mensagens de endomarketing</summary><div className="mt-3"><AbaTemplates podeEditar endomarketing /></div></details>}
        <div className="mt-4 flex flex-wrap gap-3 text-xs font-medium text-brand">{podeAbrir("comunicacao") && <Link to="/comunicacao">Plano e guias de comunicação ↗</Link>}{rh && podeAbrir("mensagens") && <Link to="/mensagens">Modelos de mensagens ↗</Link>}{rh && podeAbrir("desempenho") && <Link to="/desempenho?aba=pesquisas">Pesquisas existentes ↗</Link>}</div>
        <details className="mt-4 text-xs text-slate-500"><summary className="cursor-pointer">Referências e cuidados</summary><p className="my-2">Modelos editoriais apoiados nas recomendações de escuta, reconhecimento e condições de trabalho da OMS e do CIPD. Celebrações complementam, mas não substituem, melhorias da rotina. Não registrar diagnósticos, relatos individuais sensíveis ou respostas identificadas de pesquisa nestas ações. Encaminhe esses assuntos em canal reservado com o RH.</p><ul className="space-y-1">{FONTES_ENDO.map(f => <li key={f.url}><a href={f.url} target="_blank" rel="noreferrer" className="text-brand underline">{f.titulo}</a></li>)}</ul></details>
      </> },
    ]} />
    {gerirDatas && dataModal !== undefined && <EventoModal editar={dataModal} onFechar={() => setDataModal(undefined)} />}
    <ConfirmDialog aberto={gerirDatas && !!excluirData} onFechar={() => setExcluirData(null)} onConfirmar={() => { if (gerirDatas && excluirData) removerEvento(excluirData.id); }} titulo="Remover data especial?" mensagem="A data será retirada da agenda. Ações e arquivos já vinculados permanecem guardados." />
    {rh && rascunho && <Modal aberto onFechar={fechar} titulo={base ? "Detalhes da ação" : "Planejar ação"} descricao="Só o título é obrigatório. Planejamento interno do RH." largura="max-w-2xl" rodape={<><button className="btn-outline" onClick={fechar}>Cancelar</button><button className="btn-primary" disabled={arquivoOcupado} onClick={() => salvar(rascunho, base)}>Salvar ação</button></>}>
      <div className="space-y-3">
        {erro && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erro}</p>}
        <Campo label="Título" obrigatorio><Input value={rascunho.titulo} maxLength={160} onChange={e => campo("titulo", e.target.value)} autoFocus /></Campo>
        <div className="grid gap-3 sm:grid-cols-2"><Campo label="Data"><Input type="date" value={rascunho.data} onChange={e => campo("data", e.target.value)} /></Campo><Campo label="Responsável"><Select value={rascunho.responsavelId} onChange={e => campo("responsavelId", e.target.value)}><option value="">Definir depois</option>{pessoas.map(p => <option key={p.id} value={p.id}>{p.nome} · {idDaPessoa(p) || "sem ID"}</option>)}{rascunho.responsavelId && !pessoas.some(p => p.id === rascunho.responsavelId) && <option value={rascunho.responsavelId}>Responsável fora do quadro atual</option>}</Select></Campo><Campo label="Tema"><Select value={rascunho.tema} onChange={e => campo("tema", e.target.value as TemaEndo)}>{TEMAS_ENDO.map(t => <option key={t}>{t}</option>)}</Select></Campo><Campo label="Situação"><Select value={rascunho.situacao} onChange={e => campo("situacao", e.target.value as AcaoEndomarketing["situacao"])}>{SITUACOES_ENDO.map(s => <option key={s}>{s}</option>)}</Select></Campo></div>
        {rascunho.colaboradorId && <p className="text-xs text-slate-600">Pessoa vinculada: {pessoa(rascunho.colaboradorId)}</p>}
        <AnexosEndo anexos={rascunho.anexos ?? []} onChange={a => campo("anexos", a)} onBusy={setArquivoOcupado} />
        <Campo label="Objetivo"><Textarea value={rascunho.objetivo} maxLength={1500} onChange={e => campo("objetivo", e.target.value)} /></Campo><Campo label="Público"><Input value={rascunho.publico} maxLength={300} onChange={e => campo("publico", e.target.value)} /></Campo>
        <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="px-1 text-xs font-semibold text-slate-600">Checklist</legend><div className="space-y-2">{rascunho.checklist.map(i => <div key={i.id} className="flex items-start gap-2"><label className="flex flex-1 items-start gap-2 text-sm text-slate-600"><input type="checkbox" className="mt-1" checked={i.feito} onChange={e => campo("checklist", rascunho.checklist.map(x => x.id === i.id ? { ...x, feito: e.target.checked } : x))} /><span className={i.feito ? "line-through" : ""}>{i.texto}</span></label><button className="text-xs text-slate-400" aria-label={`Remover item: ${i.texto}`} onClick={() => campo("checklist", rascunho.checklist.filter(x => x.id !== i.id))}>Remover</button></div>)}</div><div className="mt-2 flex gap-2"><Input aria-label="Novo item do checklist" value={novoItem} maxLength={300} placeholder="Adicionar item" onChange={e => setNovoItem(e.target.value)} /><button className="btn-outline" disabled={!novoItem.trim()} onClick={() => { campo("checklist", [...rascunho.checklist, { id: crypto.randomUUID(), texto: novoItem.trim(), feito: false }]); setNovoItem(""); }}>Adicionar</button></div></fieldset>
        <Campo label="Observações" hint="Sem dados de saúde ou relatos individuais sensíveis."><Textarea value={rascunho.observacoes} maxLength={3000} onChange={e => campo("observacoes", e.target.value)} /></Campo><Campo label="Resultado e próximo aprendizado" hint={rascunho.criterio || "Registre o que aconteceu e o retorno recebido; não confunda presença com satisfação."}><Textarea value={rascunho.resultado} maxLength={3000} onChange={e => campo("resultado", e.target.value)} /></Campo>
        {rascunho.concluidaEm && <p className="text-xs text-emerald-700">Realizada em {new Date(rascunho.concluidaEm).toLocaleString("pt-BR")}</p>}
        {!!rascunho.historico.length && <details className="text-xs text-slate-600"><summary className="cursor-pointer font-semibold">Histórico · {rascunho.historico.length}</summary><ul className="mt-2 space-y-2">{[...rascunho.historico].reverse().map((h, i) => <li key={`${h.em}-${i}`}>{new Date(h.em).toLocaleString("pt-BR")} · {h.texto}<br />{pessoa(h.por)}</li>)}</ul></details>}
      </div>
    </Modal>}
  </div>;
}
