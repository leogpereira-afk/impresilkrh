import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Users, ChevronRight, ChevronDown, Building2, LayoutGrid, Rows3, ArrowDownAZ, Download, Palmtree, UserCheck, UserX, HeartPulse, Hourglass } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { DotBadge, Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/form";
import { MotivacaoRosto } from "@/components/ui/indicadores";
import { ColaboradorForm } from "@/components/colaboradores/colaborador-form";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, ehRH, podeVerGestao } from "@/lib/rbac";
import { tempoDeCasa, parseData } from "@/lib/format";
import { situacaoExperiencia, type SituacaoExperiencia } from "@/lib/clt";
import { feriasEmCurso } from "@/lib/ferias";
import { cn } from "@/lib/cn";
import type { Colaborador } from "@/data/types";

const varianteEnq: Record<string, "danger" | "warning" | "success" | "info"> = {
  Crítico: "danger", Abaixo: "warning", Dentro: "success", Acima: "info",
};

// Ordenação da lista. A tabela vinha SEMPRE em ordem alfabética, sem como trocar:
// para achar quem está há mais tempo de casa ou quem está com salário crítico,
// era preciso ler linha por linha. Agora cada coluna ordena ao ser clicada.
type CampoOrdem = "nome" | "area" | "nivel" | "tempo" | "enquadramento" | "status";
interface Ordem { campo: CampoOrdem; asc: boolean }
const ORDEM_ENQUADRAMENTO: Record<string, number> = { Crítico: 0, Abaixo: 1, Dentro: 2, Acima: 3 };

// Inativo = desligado (data de desligamento) ou status "inativo".
const ehInativo = (c: Colaborador) => c.statusId === "inativo" || !!c.dataDesligamento;
// Afastado (INSS, licença, acidente) continua na empresa, mas NÃO está
// trabalhando: fica em card próprio e sai da conta de "ativos", senão o número
// de quem está de fato produzindo aparece inflado.
const ehAfastado = (c: Colaborador) => c.statusId === "afastado" && !ehInativo(c);

// Dia de casa em que aparece a 1ª decisão do contrato de experiência (prorrogar
// ou não, no marco dos 45 dias com a folga de 10 que clt.ts usa). Antes disso não
// há o que decidir, então quem não foi marcado à mão ainda não entra no aviso.
const DIAS_1O_MARCO_EXPERIENCIA = 35;

function ThOrdenavel({
  campo, ordem, setOrdem, className, children,
}: {
  campo: CampoOrdem;
  ordem: Ordem;
  setOrdem: (o: Ordem) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const ativo = ordem.campo === campo;
  return (
    <th className={cn("th", className)}>
      <button
        type="button"
        // Clicar de novo na mesma coluna inverte; em outra, começa crescente.
        onClick={() => setOrdem(ativo ? { campo, asc: !ordem.asc } : { campo, asc: true })}
        className={cn("inline-flex items-center gap-1 transition hover:text-brand", ativo && "text-brand")}
        title={`Ordenar por ${String(children)}`}
      >
        {children}
        {ativo
          ? <ArrowDownAZ className={cn("h-3.5 w-3.5", !ordem.asc && "rotate-180")} />
          : <ArrowDownAZ className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-40" />}
      </button>
    </th>
  );
}

export default function Colaboradores() {
  const sessao = useSessao();
  const d = useDominio();
  const [busca, setBusca] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(false); // padrão: só ativos
  const [novo, setNovo] = useState(false);
  const [verNomes, setVerNomes] = useState(false); // lista simples de nomes (A–Z)

  // Áreas/setores navegáveis (sem a Direção).
  const areasNav = useMemo(() => d.areas.filter((a) => a.id !== "direcao"), [d.areas]);

  // Visão padrão: LISTA (abre direto a tabela). Chips de área e o alternador
  // "Por setor" continuam para quem quiser navegar por setor.
  const [visao, setVisao] = useState<"setor" | "lista">("lista");
  // Card de resumo clicado (filtro rápido): ativos / em férias / desligados.
  const [foco, setFoco] = useState<"ativos" | "afastados" | "ferias" | "desligados" | null>(null);
  const [ordem, setOrdem] = useState<Ordem>({ campo: "nome", asc: true });
  const [chips, setChips] = useState<Set<string>>(() => new Set());
  // Sanfonas: primeira área aberta por padrão; subáreas começam fechadas.
  const [areasAbertas, setAreasAbertas] = useState<Set<string>>(
    () => new Set(areasNav.length ? [areasNav[0].id] : []),
  );
  const [subsAbertas, setSubsAbertas] = useState<Set<string>>(() => new Set());

  const escopo = useMemo(() => colaboradoresVisiveis(sessao, d.colaboradores), [sessao, d.colaboradores]);
  const { items: ferias } = useColecao("ferias");


  // Quem está em férias agora (usado nos cards e no filtro rápido). Vem das
  // DATAS do período, não do texto "Em andamento": esse texto é digitado à mão e
  // ninguém volta para atualizá-lo, então ele contava quem já voltou e deixava
  // de fora quem está fora hoje.
  const emFerias = useMemo(
    () => new Set(ferias.filter((f) => feriasEmCurso(f)).map((f) => f.colaboradorId)),
    [ferias],
  );

  // Quem está em contrato de experiência, do prazo mais curto para o mais longo
  // (quem vence antes aparece primeiro). Usa a regra da CLT que já existe.
  //
  // O aviso olhava SÓ quem foi marcado à mão com o status "Em experiência", mas o
  // cadastro nasce como "Ativo": quem ninguém marcou nunca entrava aqui, mesmo com
  // a ficha e o sino (que decidem pela data de admissão) já avisando sobre ele.
  // Agora a data também vale — porém só a partir do 1º marco de decisão (35 dias,
  // a mesma folga de clt.ts), para o bloco não virar alarme permanente com todo
  // recém-admitido, que ainda não tem decisão nenhuma a tomar.
  const emExperiencia = useMemo(
    () => escopo
      .filter((c) => !c.ehDirecao && !ehInativo(c))
      .map((c) => ({ c, sit: situacaoExperiencia(c), marcado: c.statusId === "experiencia" }))
      .filter((x): x is { c: Colaborador; sit: SituacaoExperiencia; marcado: boolean } =>
        !!x.sit && (x.marcado || x.sit.diasDeCasa >= DIAS_1O_MARCO_EXPERIENCIA))
      .sort((a, b) => a.sit.diasParaFim - b.sit.diasParaFim),
    [escopo],
  );

  // Cards de resumo — sobre o escopo de acesso, sem a Direção (mesma base da lista).
  const resumo = useMemo(() => {
    const base = escopo.filter((c) => !c.ehDirecao);
    return {
      // "Ativo" = está trabalhando: sem afastamento e sem desligamento.
      ativos: base.filter((c) => !ehInativo(c) && !ehAfastado(c)).length,
      afastados: base.filter((c) => ehAfastado(c)).length,
      ferias: base.filter((c) => emFerias.has(c.id) && !ehInativo(c)).length,
      desligados: base.filter((c) => ehInativo(c)).length,
    };
  }, [escopo, emFerias]);

  // Exporta a lista filtrada atual para CSV (Excel-friendly, separador ;).
  const exportarCsv = () => {
    const cols: [string, (c: Colaborador) => string | number][] = [
      ["Nome", (c) => c.nome],
      ["E-mail", (c) => c.email ?? ""],
      ["Telefone", (c) => c.telefone ?? ""],
      ["Cargo", (c) => d.nomeCargo(c)],
      ["Área", (c) => d.nomeArea(c.areaId)],
      ["Nível", (c) => d.nomeNivel(c.nivelId)],
      ["Status", (c) => d.nomeStatus(c.statusId)],
      ["Enquadramento", (c) => d.enquadrarColab(c)],
      ["Admissão", (c) => (c.dataAdmissao ?? "").slice(0, 10)],
    ];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      cols.map((x) => x[0]).join(";"),
      ...lista.map((c) => cols.map(([, fn]) => esc(fn(c))).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `colaboradores-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Comparador da coluna escolhida. Nome é o desempate em tudo, para a lista
  // nunca "dançar" entre pessoas com o mesmo valor.
  const comparar = useCallback(
    (a: Colaborador, b: Colaborador) => {
      const porNome = a.nome.localeCompare(b.nome, "pt-BR");
      const sinal = ordem.asc ? 1 : -1;
      switch (ordem.campo) {
        case "area": return sinal * (d.nomeArea(a.areaId).localeCompare(d.nomeArea(b.areaId), "pt-BR") || porNome);
        case "nivel": return sinal * (d.nomeNivel(a.nivelId).localeCompare(d.nomeNivel(b.nivelId), "pt-BR") || porNome);
        // Tempo de casa: quem entrou ANTES tem mais casa, então compara a data.
        case "tempo": {
          const ta = parseData(a.dataAdmissao)?.getTime() ?? Infinity;
          const tb = parseData(b.dataAdmissao)?.getTime() ?? Infinity;
          return sinal * ((ta - tb) || porNome);
        }
        // Ordem de gravidade (Crítico primeiro), não alfabética.
        case "enquadramento": {
          const ea = ORDEM_ENQUADRAMENTO[d.enquadrarColab(a)] ?? 9;
          const eb = ORDEM_ENQUADRAMENTO[d.enquadrarColab(b)] ?? 9;
          return sinal * ((ea - eb) || porNome);
        }
        case "status": return sinal * (d.nomeStatus(a.statusId).localeCompare(d.nomeStatus(b.statusId), "pt-BR") || porNome);
        default: return sinal * porNome;
      }
    },
    [ordem, d],
  );

  // Lista filtrada (busca + filtros + chips). Compartilhada pelas duas visões.
  // Por padrão mostra só os ativos; "Incluir inativos" libera os desligados.
  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return escopo
      .filter((c) => !c.ehDirecao)
      // Card clicado tem prioridade sobre o checkbox "incluir inativos".
      .filter((c) => {
        if (foco === "desligados") return ehInativo(c);
        if (foco === "ativos") return !ehInativo(c) && !ehAfastado(c);
        if (foco === "afastados") return ehAfastado(c);
        if (foco === "ferias") return !ehInativo(c) && emFerias.has(c.id);
        return mostrarInativos || !ehInativo(c);
      })
      // Área tem um filtro só (os chips). O Select abaixo é outra porta para o
      // MESMO estado — antes eram dois filtros somados em E, e escolher áreas
      // diferentes nos dois zerava a lista sem explicar.
      .filter((c) => (chips.size ? !!c.areaId && chips.has(c.areaId) : true))
      .filter((c) => (fStatus ? c.statusId === fStatus : true))
      .filter((c) =>
        termo
          ? c.nome.toLowerCase().includes(termo) ||
            d.nomeCargo(c).toLowerCase().includes(termo) ||
            (c.email ?? "").toLowerCase().includes(termo) ||
            d.nomeArea(c.areaId).toLowerCase().includes(termo)
          : true,
      )
      .sort(comparar);
  }, [escopo, fStatus, busca, chips, mostrarInativos, foco, emFerias, d, comparar]);

  // Lista simples de nomes, agrupada por inicial (A, B, C…) — só os nomes, sem
  // cargo/setor. Usa a mesma lista já filtrada e ordenada alfabeticamente.
  const inicial = (nome: string) =>
    (nome.trim()[0] || "#").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const porLetra = useMemo(() => {
    const m = new Map<string, Colaborador[]>();
    for (const c of lista) {
      const L = inicial(c.nome);
      const arr = m.get(L) ?? [];
      arr.push(c);
      m.set(L, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [lista]);

  // Agrupamento por setor (área) → subárea, sobre a lista já filtrada.
  const grupos = useMemo(() => {
    return areasNav
      .map((area) => {
        const pessoas = lista.filter((c) => c.areaId === area.id);
        const porSub = new Map<string, Colaborador[]>();
        for (const c of pessoas) {
          const sub = d.subareaDe(c);
          const arr = porSub.get(sub) ?? [];
          arr.push(c);
          porSub.set(sub, arr);
        }
        const subareas = [...porSub.entries()]
          .map(([nome, itens]) => ({ nome, itens }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
        return { area, total: pessoas.length, subareas };
      })
      .filter((g) => g.total > 0);
  }, [areasNav, lista, d]);

  const toggleChip = (id: string) =>
    setChips((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleArea = (id: string) =>
    setAreasAbertas((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleSub = (chave: string) =>
    setSubsAbertas((prev) => {
      const next = new Set(prev);
      next.has(chave) ? next.delete(chave) : next.add(chave);
      return next;
    });

  return (
    <div>
      <PageHeader title="Colaboradores" description={`${lista.length} colaborador(es) no seu escopo de acesso.`}>
        <button className="btn-outline" onClick={exportarCsv} disabled={lista.length === 0} title="Exporta a lista filtrada para CSV">
          <Download className="h-4 w-4" /> Exportar CSV
        </button>
        {ehRH(sessao) && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Novo colaborador
          </button>
        )}
      </PageHeader>

      {/* AVISO DE EXPERIÊNCIA — perder o prazo dos 90 dias transforma o contrato
          em indeterminado sozinho, e aí desligar custa aviso prévio e multa do
          FGTS. Por isso este bloco é grande, fica no topo e não some. */}
      {emExperiencia.length > 0 && (
        <div className={cn(
          "mb-4 rounded-2xl border-2 p-4",
          emExperiencia.some((e) => e.sit.diasParaFim <= 15) ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50",
        )}>
          <div className="mb-3 flex items-center gap-2">
            <span className={cn(
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
              emExperiencia.some((e) => e.sit.diasParaFim <= 15) ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
            )}>
              <Hourglass className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-bold text-slate-800">
                {emExperiencia.length} {emExperiencia.length === 1 ? "pessoa está" : "pessoas estão"} em contrato de experiência
              </p>
              <p className="text-xs text-slate-600">
                Decida antes do prazo: passou de 90 dias sem decisão, o contrato vira por tempo indeterminado — e desligar depois custa aviso prévio e multa do FGTS.
              </p>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {emExperiencia.map(({ c, sit, marcado }) => {
              const urgente = sit.diasParaFim <= 15;
              const atencao = sit.diasParaFim <= 45;
              return (
                <Link
                  key={c.id}
                  to={`/colaboradores/${c.id}`}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border bg-white p-3 transition hover:shadow-md",
                    urgente ? "border-red-300" : atencao ? "border-amber-300" : "border-slate-200",
                  )}
                >
                  <Avatar nome={c.nome} foto={c.fotoDataUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">{c.nome}</p>
                    <p className="text-[11px] text-slate-500">
                      {sit.diasDeCasa} dias de casa · {d.nomeCargo(c) || "—"}
                    </p>
                    {/* Entrou pela data de admissão, não pelo status: avisa que a
                        ficha ainda está como outro status, para o RH acertar. */}
                    {!marcado && (
                      <p className="truncate text-[10px] text-slate-400">
                        pela data de admissão · status não está como “Em experiência”
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={cn("text-sm font-bold tabular-nums", urgente ? "text-red-700" : atencao ? "text-amber-700" : "text-slate-600")}>
                      {sit.diasParaFim < 0 ? "venceu!" : `${sit.diasParaFim} dia${sit.diasParaFim === 1 ? "" : "s"}`}
                    </p>
                    <p className="text-[11px] text-slate-400">até {sit.fim.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}</p>
                  </div>
                </Link>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Marco dos 45 dias: decidir se prorroga. Marco dos 90: efetivar ou desligar. Clique no nome para abrir a ficha.
          </p>
        </div>
      )}

      {/* Cards de resumo do quadro — clicáveis: filtram a lista abaixo */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { key: "ativos", label: "Ativos", nota: "", valor: resumo.ativos, icon: UserCheck, cor: "text-emerald-600", bg: "bg-emerald-50" },
          { key: "afastados", label: "Afastados", nota: "fora da conta de Ativos", valor: resumo.afastados, icon: HeartPulse, cor: "text-orange-600", bg: "bg-orange-50" },
          // "Em férias" é um recorte de quem está ativo (férias não suspende o
          // contrato): a nota avisa, senão parece que os cards se somam e a mesma
          // pessoa aparece contada duas vezes.
          { key: "ferias", label: "Em férias", nota: "já contados em Ativos", valor: resumo.ferias, icon: Palmtree, cor: "text-amber-600", bg: "bg-amber-50" },
          { key: "desligados", label: "Desligados", nota: "", valor: resumo.desligados, icon: UserX, cor: "text-slate-500", bg: "bg-slate-100" },
        ] as const).map(({ key, label, nota, valor, icon: Icon, cor, bg }) => {
          const ativoCard = foco === key;
          // Card zerado não vira filtro: clicar só levaria à lista vazia.
          const semNinguem = valor === 0;
          return (
            <button
              key={label}
              type="button"
              onClick={() => setFoco(ativoCard ? null : key)}
              disabled={semNinguem}
              aria-pressed={ativoCard}
              title={
                semNinguem ? "Ninguém nesta situação agora"
                  : ativoCard ? "Clique para limpar o filtro"
                    : `Filtrar por ${label.toLowerCase()}`
              }
              className={cn(
                "flex items-center gap-3 rounded-2xl border bg-white p-4 text-left shadow-soft transition",
                ativoCard ? "border-brand ring-1 ring-brand/40" : "border-slate-200/70",
                semNinguem ? "cursor-default opacity-70" : !ativoCard && "hover:border-slate-300 hover:shadow-md",
              )}
            >
              <span className={cn("inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", bg)}>
                <Icon className={cn("h-5 w-5", cor)} />
              </span>
              <div className="min-w-0">
                <p className="text-2xl font-bold leading-none text-slate-800">{valor}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{label}{ativoCard && " · filtrando"}</p>
                {nota && <p className="truncate text-[10px] text-slate-400">{nota}</p>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Chips de área (multi-seleção) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setChips(new Set())}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
            chips.size === 0
              ? "border-brand bg-brand text-white"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
          )}
        >
          <Building2 className="h-3.5 w-3.5" /> Todas
        </button>
        {areasNav.map((a) => {
          const ativo = chips.has(a.id);
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => toggleChip(a.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                ativo
                  ? "border-brand bg-brand text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {a.nome}
            </button>
          );
        })}
      </div>

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative flex-1 sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder="Buscar por nome, cargo, e-mail ou área…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          {/* Mesma seleção dos chips, em forma de lista: escolher uma área aqui
              marca o chip dela; a 1ª opção limpa. Com mais de uma área marcada
              nos chips, a lista mostra quantas são (não dá para representar
              multi-seleção num Select simples). */}
          <Select
            value={chips.size === 1 ? [...chips][0] : ""}
            onChange={(e) => setChips(e.target.value ? new Set([e.target.value]) : new Set())}
            className="sm:w-56"
          >
            <option value="">{chips.size > 1 ? `Várias áreas (${chips.size}) · limpar` : "Todas as áreas"}</option>
            {areasNav.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="sm:w-44">
            <option value="">Todos os status</option>
            {d.status.filter((s) => s.id !== "direcao" && s.id !== "externo").map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </Select>
          <label
            className={cn("inline-flex shrink-0 items-center gap-2 text-sm text-slate-600", foco ? "cursor-not-allowed opacity-40" : "cursor-pointer")}
            title={foco ? "O card selecionado acima já define este filtro. Clique nele de novo para liberar." : "Por padrão a lista mostra só os colaboradores ativos"}
          >
            <input
              type="checkbox"
              checked={mostrarInativos}
              disabled={!!foco}
              onChange={(e) => setMostrarInativos(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand disabled:cursor-not-allowed"
            />
            Incluir inativos
          </label>
          {/* Alternador de visão */}
          <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              type="button"
              onClick={() => setVisao("setor")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                visao === "setor" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Por setor
            </button>
            <button
              type="button"
              onClick={() => setVisao("lista")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition",
                visao === "lista" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700",
              )}
            >
              <Rows3 className="h-3.5 w-3.5" /> Lista
            </button>
          </div>
        </div>
      </Card>

      {lista.length === 0 ? (
        <EmptyState title="Nenhum colaborador encontrado" description="Ajuste a busca ou os filtros." icon={<Users className="h-8 w-8" />} />
      ) : visao === "lista" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <ThOrdenavel campo="nome" ordem={ordem} setOrdem={setOrdem}>Colaborador</ThOrdenavel>
                  <ThOrdenavel campo="area" ordem={ordem} setOrdem={setOrdem} className="hidden md:table-cell">Área</ThOrdenavel>
                  <ThOrdenavel campo="nivel" ordem={ordem} setOrdem={setOrdem} className="hidden sm:table-cell">Nível</ThOrdenavel>
                  <ThOrdenavel campo="tempo" ordem={ordem} setOrdem={setOrdem} className="hidden lg:table-cell">Tempo de casa</ThOrdenavel>
                  <ThOrdenavel campo="enquadramento" ordem={ordem} setOrdem={setOrdem}>Enquadramento</ThOrdenavel>
                  <ThOrdenavel campo="status" ordem={ordem} setOrdem={setOrdem}>Status</ThOrdenavel>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lista.map((c) => (
                  <tr key={c.id} className="group transition hover:bg-slate-50/60">
                    <td className="td">
                      <Link to={`/colaboradores/${c.id}`} className="flex items-center gap-3">
                        <Avatar nome={c.nome} foto={c.fotoDataUrl} size="sm" />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{c.nome}</p>
                          <p className="truncate text-xs text-slate-500">{d.nomeCargo(c)}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="td hidden md:table-cell text-slate-500">{d.nomeArea(c.areaId)}</td>
                    <td className="td hidden sm:table-cell">{d.nomeNivel(c.nivelId)}</td>
                    <td className="td hidden lg:table-cell text-slate-500">{tempoDeCasa(c.dataAdmissao)}</td>
                    <td className="td">
                      <Badge variant={varianteEnq[d.enquadrarColab(c)] ?? "neutral"}>{d.enquadrarColab(c)}</Badge>
                    </td>
                    <td className="td"><DotBadge label={d.nomeStatus(c.statusId)} cor={d.corStatus(c.statusId)} /></td>
                    <td className="td text-right">
                      <Link to={`/colaboradores/${c.id}`} className="inline-flex text-slate-300 transition group-hover:text-brand">
                        <ChevronRight className="h-5 w-5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Visão por setor — sanfona de áreas → subáreas → mini-cards */
        <div className="space-y-3">
          {grupos.map(({ area, total, subareas }) => {
            const aberta = areasAbertas.has(area.id);
            return (
              <Card key={area.id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleArea(area.id)}
                  className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-slate-50/60"
                >
                  <span className="flex items-center gap-3">
                    {aberta ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                    <Building2 className="h-4 w-4 text-brand" />
                    <span className="text-sm font-semibold text-slate-800">{area.nome}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                    <Users className="h-3.5 w-3.5" /> {total}
                  </span>
                </button>

                {aberta && (
                  <div className="space-y-2 border-t border-slate-100 bg-slate-50/40 p-3">
                    {subareas.map(({ nome, itens }) => {
                      const chaveSub = `${area.id}::${nome}`;
                      const subAberta = subsAbertas.has(chaveSub);
                      return (
                        <div key={chaveSub} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => toggleSub(chaveSub)}
                            className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition hover:bg-slate-50"
                          >
                            <span className="flex items-center gap-2">
                              {subAberta ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                              <span className="text-sm font-medium text-slate-700">{nome}</span>
                            </span>
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              <Users className="h-3 w-3" /> {itens.length}
                            </span>
                          </button>

                          {subAberta && (
                            <div className="grid grid-cols-1 gap-2.5 border-t border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
                              {itens.map((c) => (
                                <Link
                                  key={c.id}
                                  to={`/colaboradores/${c.id}`}
                                  className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 transition hover:border-brand/40 hover:bg-slate-50/80 hover:shadow-sm"
                                >
                                  <Avatar nome={c.nome} foto={c.fotoDataUrl} size="sm" className="h-9 w-9" />
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-slate-800">{c.nome}</p>
                                    <p className="truncate text-xs text-slate-500">{d.nomeCargo(c)}</p>
                                    <p className="mt-0.5 text-[11px] text-slate-400">{tempoDeCasa(c.dataInicioCargo)} no cargo</p>
                                  </div>
                                  {podeVerGestao(sessao, c.id, d.colaboradores) && (
                                    <MotivacaoRosto score={c.motivacao} tamanho="sm" comTexto={false} />
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Atalho ao final: lista simples de nomes (A–Z), fora de cargos/setores */}
      {lista.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => setVerNomes(true)} className="btn-outline">
            <ArrowDownAZ className="h-4 w-4" /> Ver todos os nomes (A–Z)
          </button>
        </div>
      )}

      <Modal
        aberto={verNomes}
        onFechar={() => setVerNomes(false)}
        titulo="Colaboradores em ordem alfabética"
        descricao={`${lista.length} nome(s). Toque em um nome para abrir a ficha.`}
        largura="max-w-2xl"
      >
        <div className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
          {porLetra.map(([letra, itens]) => (
            <div key={letra}>
              <p className="sticky top-0 z-10 bg-white py-1 text-xs font-bold uppercase tracking-[0.18em] text-brand">{letra}</p>
              <ul className="grid grid-cols-1 gap-x-6 gap-y-0.5 sm:grid-cols-2">
                {itens.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/colaboradores/${c.id}`}
                      onClick={() => setVerNomes(false)}
                      className="block truncate rounded-md px-2 py-1 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-brand"
                    >
                      {c.nome}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>

      {novo && <ColaboradorForm aberto={novo} onFechar={() => setNovo(false)} />}
    </div>
  );
}
