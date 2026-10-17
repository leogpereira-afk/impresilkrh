import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Plus, MessageSquare } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Campo, Input, Select } from "@/components/ui/form";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { chamarNps, DIMENSOES_NPS, PERGUNTA_NPS, estadoNps, pontuacaoNps, type CicloNps } from "@/lib/nps";

const bloco = "rounded-xl border border-slate-200 bg-white p-4";
const data = (v: string | null) => v ? new Date(v).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "Ainda não aberta";
const escala = ["Discordo totalmente", "Discordo", "Nem concordo nem discordo", "Concordo", "Concordo totalmente"];

export default function ClimaPesquisa() {
  const sessao = useSessao(); const rh = ehRH(sessao);
  const [ciclos, setCiclos] = useState<CicloNps[]>([]);
  const [selecionado, setSelecionado] = useState("");
  const [aba, setAba] = useState("Pesquisas");
  const [carregando, setCarregando] = useState(true); const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(""); const [aviso, setAviso] = useState("");
  const [titulo, setTitulo] = useState(""); const [dias, setDias] = useState(14); const [novo, setNovo] = useState(false);
  const [nota, setNota] = useState<number | null>(null); const [dimensoes, setDimensoes] = useState<Record<string, number | null>>({}); const [prioridade, setPrioridade] = useState("");
  const [acao, setAcao] = useState(""); const [responsavel, setResponsavel] = useState("RH"); const [prazo, setPrazo] = useState("");
  const carregar = useCallback(async () => {
    setCarregando(true); setErro("");
    try { const r = await chamarNps("listar"); setCiclos(r.ciclos ?? []); }
    catch (e) { setCiclos([]); setErro(e instanceof Error ? e.message : "Dados indisponíveis."); }
    finally { setCarregando(false); }
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);
  const c = ciclos.find(x => x.id === selecionado) ?? ciclos[0];
  const id = c?.id;
  useEffect(() => { setNota(null); setDimensoes({}); setPrioridade(""); setAcao(""); setPrazo(""); }, [id]);
  async function executar(op: string, dados: Record<string, unknown>, mensagem: string) {
    setOcupado(true); setErro(""); setAviso("");
    try { await chamarNps(op, dados); setAviso(mensagem); setNovo(false); setNota(null); setDimensoes({}); setPrioridade(""); setAcao(""); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente."); }
    finally { setOcupado(false); }
  }
  const r = c?.resultados; const estado = c ? estadoNps(c) : "";
  return <div className="space-y-3">
    <PageHeader title="Clima e eNPS" description="Escutar a equipe, entender prioridades e acompanhar melhorias.">
      <button className="btn-outline" disabled={carregando || ocupado} onClick={() => void carregar()}><RefreshCw className="h-4 w-4" />Atualizar</button>
      {rh && <button className="btn-primary" disabled={ocupado} onClick={() => setNovo(!novo)}><Plus className="h-4 w-4" />Nova pesquisa</button>}
    </PageHeader>
    <div className="flex gap-3 rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm text-sky-950"><ShieldCheck className="h-5 w-5 shrink-0" /><div><strong>Escuta confidencial</strong><p>Notas individuais não são exibidas nem armazenadas. O RH recebe apenas resultados agrupados após o prazo e com pelo menos 5 respostas. Sem filtros por pessoa ou setor.</p></div></div>
    <nav className="flex flex-wrap gap-2" aria-label="Seções da pesquisa">{["Pesquisas", "Questionário e método"].map(a => <button key={a} className={aba === a ? "btn-primary" : "btn-outline"} aria-pressed={aba === a} onClick={() => setAba(a)}>{a}</button>)}</nav>
    {erro && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro} Nenhum envio é guardado na fila offline. Se faltar conexão, tente novamente; o sistema impede respostas duplicadas.</div>}
    {aviso && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</p>}
    {novo && rh && <form className={bloco + " space-y-3"} onSubmit={e => { e.preventDefault(); void executar("criar", { titulo, dias }, "Rascunho criado. Confira o questionário antes de abrir a coleta."); }}><h2 className="font-semibold">Preparar pesquisa</h2><div className="grid gap-3 sm:grid-cols-2"><Campo label="Nome do ciclo"><Input required minLength={3} maxLength={100} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Pesquisa de clima · trimestre" /></Campo><Campo label="Duração da coleta"><Select value={dias} onChange={e => setDias(Number(e.target.value))}>{[7,14,21,30,60,90].map(n => <option key={n} value={n}>{n} dias</option>)}</Select></Campo></div><p className="text-sm text-slate-600">Público: pessoas com conta ativa no RH, congelado ao abrir. Uma participação por pessoa. Colaboradores sem acesso não são incluídos. Questionário v1 e confidencialidade não mudam durante o ciclo.</p><button className="btn-primary" disabled={ocupado}>Salvar rascunho</button></form>}
    {aba === "Questionário e método" ? <div className={bloco + " space-y-4"}>
      <h2 className="text-lg font-semibold">Questionário v1 · aproximadamente 3 minutos</h2>
      <p className="text-sm text-slate-600">Participação voluntária. Pense na sua experiência recente. Somente a nota de recomendação é necessária para calcular o eNPS. As demais perguntas podem ficar sem resposta.</p>
      <h3 className="font-semibold">1. {PERGUNTA_NPS}</h3><p className="text-sm">0 = nada provável · 10 = extremamente provável</p>
      <ol className="space-y-3">{DIMENSOES_NPS.map((d,i) => <li key={d.id}><strong>{i+2}. {d.tema}</strong><p className="text-sm text-slate-600">{d.pergunta}</p></li>)}</ol>
      <p className="text-sm">Escala de concordância de 1 a 5, com opção “Não se aplica / prefiro não responder”.</p>
      <h3 className="font-semibold">11. Qual tema deve receber atenção primeiro?</h3><p className="text-sm">Escolha uma das nove dimensões ou deixe em branco. Não coletamos texto livre, para reduzir identificação pelo conteúdo.</p>
      <details className="rounded-lg bg-slate-50 p-3 text-sm"><summary className="cursor-pointer font-semibold">Como interpretar e transformar em ação</summary><div className="mt-3 space-y-2"><p>eNPS = % de promotores (9–10) menos % de detratores (0–6). Passivos (7–8) entram no total. O índice vai de -100 a +100 pontos, não é uma nota média.</p><p>As dimensões têm média de 1 a 5 e base própria. Não se aplica fica fora da média. Itens com menos de cinco respostas não são exibidos. Prioridades só aparecem com cinco ou mais escolhas.</p><p>Sugestão: aplicar trimestralmente, comunicar o resultado, escolher até três melhorias e revisar os compromissos no próximo ciclo. Não usar eNPS para avaliar ou punir indivíduos. Não há classificação automática “bom/ruim” sem contexto.</p><p>A conta serve para impedir duplicidade. O controle de participação fica separado dos totais, sem guardar respostas individuais. O acesso técnico à infraestrutura continua restrito aos administradores do serviço.</p><p>Referências: <a className="underline" href="https://marketing-prod.qualtrics.com/articles/employee-experience/employee-net-promoter-score-enps-good-measure-engagement/" target="_blank" rel="noreferrer">Qualtrics: eNPS</a> · <a className="underline" href="https://support.cultureamp.com/en/articles/7048386-confidentiality-protections-in-reporting" target="_blank" rel="noreferrer">Culture Amp: confidencialidade</a>.</p></div></details>
    </div> : <>
      {carregando ? <p role="status" className={bloco}>Consultando pesquisas…</p> : !c ? !erro && <div className={bloco}><MessageSquare className="mb-2 h-6 w-6 text-brand" /><h2 className="font-semibold">Nenhuma pesquisa disponível</h2><p className="mt-1 text-sm text-slate-500">{rh ? "O questionário está pronto. Crie um ciclo e confira antes de abrir a coleta." : "As pesquisas destinadas a você aparecerão aqui quando o RH abrir a coleta."}</p></div> : <>
        <div className={bloco + " flex flex-wrap items-end gap-3"}><Campo label="Ciclo" className="min-w-0 flex-1"><Select value={c.id} onChange={e => setSelecionado(e.target.value)}>{ciclos.map(x => <option key={x.id} value={x.id}>{x.titulo} · {estadoNps(x)}</option>)}</Select></Campo><span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-medium">{estado}</span></div>
        <div className={bloco + " flex flex-wrap items-center justify-between gap-3 text-sm"}><div><p><strong>{c.titulo}</strong> · Questionário v{c.versao}</p><p className="mt-1 text-slate-500">{c.abertura ? `${data(c.abertura)} até ${data(c.fim)} · Brasília` : `Coleta durante ${c.dias} dias após a abertura`}</p></div>{rh && <span>{c.recebidas ?? 0} respostas / {c.elegiveis} convidados</span>}{rh && estado === "Rascunho" && <button className="btn-primary" disabled={ocupado} onClick={() => { if (window.confirm(`Abrir esta pesquisa por ${c.dias} dias? O público será congelado e os resultados só aparecerão após o prazo, com pelo menos cinco respostas. Não será possível reabrir nem mudar as perguntas.`)) void executar("abrir", { id: c.id }, "Coleta aberta. Os convidados podem responder na área Clima e eNPS do RH."); }}>Abrir coleta</button>}</div>
        {estado === "Em coleta" && c.convidado && !c.respondeu && <form className={bloco + " space-y-5"} onSubmit={e => { e.preventDefault(); if (nota !== null && window.confirm("Enviar sua participação? Depois do envio, não será possível alterar a resposta.")) void executar("responder", { id: c.id, nota, dimensoes, prioridade }, "Participação confirmada. Obrigado por contribuir."); }}>
          <fieldset disabled={ocupado} className="space-y-4"><legend className="mb-3 font-semibold">{PERGUNTA_NPS}</legend><div className="flex flex-wrap gap-2">{Array.from({ length: 11 }, (_, n) => <label key={n} className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border ${nota === n ? "border-brand bg-brand text-white" : "border-slate-300"}`}><input className="sr-only peer" type="radio" name="nps" value={n} checked={nota === n} onChange={() => setNota(n)} required /><span className="peer-focus-visible:outline peer-focus-visible:outline-2">{n}</span></label>)}</div><p className="text-xs text-slate-500">0: nada provável · 10: extremamente provável</p>
          <div className="grid gap-4 md:grid-cols-2">{DIMENSOES_NPS.map(d => <Campo key={d.id} label={d.pergunta}><Select value={dimensoes[d.id] ?? ""} onChange={e => setDimensoes({ ...dimensoes, [d.id]: e.target.value === "" ? null : Number(e.target.value) })}><option value="">Não se aplica / prefiro não responder</option>{escala.map((s,i) => <option key={s} value={i+1}>{i+1} · {s}</option>)}</Select></Campo>)}</div><Campo label="Qual tema deve receber atenção primeiro?"><Select value={prioridade} onChange={e => setPrioridade(e.target.value)}><option value="">Prefiro não responder</option>{DIMENSOES_NPS.map(d => <option value={d.id} key={d.id}>{d.tema}</option>)}</Select></Campo><button className="btn-primary" disabled={nota === null || ocupado}>{ocupado ? "Confirmando…" : "Enviar participação confidencial"}</button></fieldset>
        </form>}
        {c.respondeu && <p className="text-sm text-emerald-800">Sua participação já foi confirmada neste ciclo.</p>}
        {rh && <section className={bloco + " space-y-3"}><h2 className="font-semibold">Resultados agrupados</h2>{!r ? <p className="text-sm text-slate-600">{estado !== "Encerrada" ? "Resultados protegidos durante a coleta. Serão liberados após o prazo se houver pelo menos cinco respostas." : "Resultado não liberado: menos de cinco respostas. Não significa nota zero."}</p> : <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["eNPS", `${pontuacaoNps(r)} pontos`],["Participação", `${Math.round(r.n / c.elegiveis * 100)}%`],["Respostas", r.n],["Convidados", c.elegiveis]].map(([label,valor]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><span className="text-xs text-slate-500">{label}</span><strong className="block text-xl text-brand">{valor}</strong></div>)}</div>
          <p className="text-sm text-slate-600">Promotores: {r.promotores} · Passivos: {r.passivos} · Detratores: {r.detratores}. Base: {r.n} respostas válidas. Resultado exclusivo deste ciclo e público.</p>
          <div className="grid gap-2 md:grid-cols-2">{DIMENSOES_NPS.map(d => { const v = r.dimensoes[d.id]; return <div key={d.id} className="flex justify-between gap-3 border-b py-2 text-sm"><span>{d.tema}</span><strong>{v ? `${(v.soma/v.n).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}/5 · base ${v.n}` : "Base insuficiente"}</strong></div>; })}</div><h3 className="font-semibold">Prioridades indicadas</h3><p className="text-sm">{Object.entries(r.prioridades).map(([k,n]) => `${DIMENSOES_NPS.find(d => d.id === k)?.tema}: ${n}`).join(" · ") || "Nenhum tema atingiu cinco escolhas. Contagens pequenas ficam protegidas."}</p>
        </>}</section>}
        {estado === "Encerrada" && <section className={bloco + " space-y-3"}><h2 className="font-semibold">Devolutiva e ações de melhoria</h2><p className="text-sm text-slate-500">Compartilhadas com os convidados. Registre compromissos da empresa, sem citar respostas ou pessoas que participaram.</p>{c.acoes.length === 0 && <p className="text-sm">Ainda não há ações publicadas pelo RH.</p>}{c.acoes.map(a => <article key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><strong className="text-sm">{a.titulo}</strong><p className="text-xs text-slate-500">{a.responsavel} · Prazo {a.prazo.split("-").reverse().join("/")} · {a.concluida ? "Concluída" : "Em acompanhamento"}</p></div>{rh && !a.concluida && <button className="btn-outline" disabled={ocupado} onClick={() => void executar("concluir", { id: c.id, acaoId: a.id }, "Ação concluída.")}>Concluir</button>}</article>)}{rh && <form className="grid gap-3 md:grid-cols-3" onSubmit={e => { e.preventDefault(); void executar("acao", { id: c.id, acao: { titulo: acao, responsavel, prazo } }, "Ação publicada na devolutiva."); }}><Campo label="Melhoria combinada"><Input required minLength={3} maxLength={300} value={acao} onChange={e => setAcao(e.target.value)} /></Campo><Campo label="Área responsável"><Input required minLength={2} maxLength={80} value={responsavel} onChange={e => setResponsavel(e.target.value)} /></Campo><Campo label="Prazo"><Input type="date" required value={prazo} onChange={e => setPrazo(e.target.value)} /></Campo><button className="btn-primary justify-self-start" disabled={ocupado}>Registrar melhoria</button></form>}</section>}
      </>}
    </>}
  </div>;
}
