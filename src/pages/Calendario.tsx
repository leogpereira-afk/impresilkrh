import { useMemo, useState } from "react";
import {
  CalendarDays, Cake, PartyPopper, Flag, Sparkles, CalendarClock, Building2,
  Plus, ChevronLeft, ChevronRight, Pencil, Trash2, FileText, ShieldAlert, UserCheck, Palmtree,
  Banknote, Stethoscope,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
/* salvarConfig só grava no navegador; quem leva a config para a nuvem é este.
   Os dois andam sempre juntos (mesmo par de PainelControle.tsx e Custos.tsx). */
import { enviarConfigNuvem } from "@/lib/sync";
import { visivel, alternarFoco, esquecerTipo } from "@/lib/focoCalendario";
import { useDominio, noQuadro } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { podeGerir } from "@/lib/rbac";
import { cn } from "@/lib/cn";
import { parseData, MESES_PT, formatDate } from "@/lib/format";
import { situacaoExperiencia, situacaoFerias, inicioDoHistorico } from "@/lib/clt";
import { diaDoPagamento, diaDoAdiantamento, feriadosDe, DIAS_UTEIS_PAGAMENTO } from "@/lib/diaPagamento";
import { HOJE } from "@/data/_gen";
import {
  tiposDisponiveis, COR_PADRAO_TIPO, TIPOS_DERIVADOS, TIPOS_DE_FABRICA, NOMES_RESERVADOS,
  type TipoPersonalizado,
} from "@/lib/tiposEvento";
import type { EventoCalendario } from "@/data/types";

const DOW = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/* O ÍCONE de cada tipo. Nome e cor vivem em lib/tiposEvento.ts porque o Painel
   de Controle também precisa deles (para recusar um tipo novo com nome já
   ocupado); o ícone é só desenho e fica aqui. */
const ICONES: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  "Aniversário": Cake, "Tempo de empresa": PartyPopper, "Feriado": Flag,
  "Comemorativa": Sparkles, "Reunião": CalendarClock, "Empresa": Building2,
  // Prazos. Estavam espalhados por Documentos, SST, Colaboradores e Férias —
  // o calendário é onde se olha "o que vence", então eles passam a vir aqui.
  "Exame agendado": Stethoscope, "Documento vence": FileText, "NR vence": ShieldAlert, "Experiência": UserCheck,
  // "Férias — prazo CLT" é o limite legal; "Férias" é o período de gozo em si.
  "Férias — prazo CLT": Palmtree, "Férias": Palmtree,
  // Os dois dias de dinheiro do mês, que a equipe inteira tem na cabeça.
  "Pagamento": Banknote,
};

/* A legenda, na ordem de leitura: primeiro o que é sobre pessoa, depois o que
   vence, por fim dinheiro. "Outro" fica de fora — é a saída do seletor, não uma
   categoria com cor própria. */
const ORDEM_LEGENDA = [
  "Aniversário", "Tempo de empresa", "Feriado", "Comemorativa", "Reunião", "Empresa",
  "Exame agendado", "Documento vence", "NR vence", "Experiência", "Férias — prazo CLT", "Férias", "Pagamento",
];
const CORES_CONHECIDAS = [...TIPOS_DERIVADOS, ...TIPOS_DE_FABRICA];
const TIPOS: { tipo: string; cor: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }[] =
  ORDEM_LEGENDA.map((nome) => ({
    tipo: nome,
    cor: CORES_CONHECIDAS.find((t) => t.nome === nome)?.cor ?? COR_PADRAO_TIPO,
    Icon: ICONES[nome] ?? CalendarDays,
  }));

/* A cor e o ícone sabem dos tipos criados pela empresa. Sem isto, um tipo novo
   aparecia cinza e sem entrada na legenda — ou seja, sem cor e sem filtro,
   exatamente o que se perde ao jogar tudo em "Outro". */
const corDe = (t: string, extras: TipoPersonalizado[] = []) =>
  TIPOS.find((x) => x.tipo === t)?.cor
  ?? extras.find((x) => x.nome === t)?.cor
  ?? COR_PADRAO_TIPO;
const iconDe = (t: string) => TIPOS.find((x) => x.tipo === t)?.Icon ?? CalendarDays;

type Item = { dia: number; tipo: string; titulo: string; sub?: string; eventoId?: string };

export default function Calendario() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: eventos, remover } = useColecao("eventos");
  const { items: documentos } = useColecao("documentos");
  const { items: certificacoes } = useColecao("certificacoesNr");
  const { items: ferias } = useColecao("ferias");
  const config = useConfig();
  /* `?? []` cria um array NOVO a cada render, e aí o useMemo abaixo nunca
     memoriza nada. Memoizado, ele só muda quando a config muda de verdade. */
  const personalizados = useMemo(
    () => config.tiposEventoPersonalizados ?? [],
    [config.tiposEventoPersonalizados],
  );
  /* A legenda mostra os tipos de fábrica MAIS os criados pela empresa. Um tipo
     sem entrada aqui fica sem cor e sem como filtrar. */
  const tiposDaLegenda = useMemo(
    () => [
      ...TIPOS,
      ...personalizados
        .filter((e) => !TIPOS.some((t) => t.tipo === e.nome))
        .map((e) => ({ tipo: e.nome, cor: e.cor, Icon: CalendarDays })),
    ],
    [personalizados],
  );
  const gere = podeGerir(sessao);
  const [ano, setAno] = useState(HOJE.getFullYear());
  const [mes, setMes] = useState(HOJE.getMonth()); // 0-based
  const [edit, setEdit] = useState<EventoCalendario | null>(null);
  const [novo, setNovo] = useState(false);
  const [del, setDel] = useState<EventoCalendario | null>(null);
  const [apagarTipo, setApagarTipo] = useState<string | null>(null);
  /* Os tipos que a pessoa escolheu ISOLAR. Vazio = aparece tudo. A regra e o
     porquê estão em lib/focoCalendario.ts, com testes. */
  const [foco, setFoco] = useState<Set<string>>(() => new Set());
  const alternarTipo = (t: string) => setFoco((s) => alternarFoco(s, t));
  const mostrando = (t: string) => visivel(t, foco);

  /* Quem ainda está no quadro. Documento, NR e período de férias percorriam a
     coleção inteira e resolviam o nome com `d.nomeColab`: o quadro do mês exibia
     o nome de gente DESLIGADA como se fosse pendência da casa.
   *
   * A régua é `noQuadro` (não saiu da empresa), NÃO `d.ativos`. `d.ativos` é
   * HEADCOUNT — exclui quem está afastado e quem está com status que não conta
   * na folha. São réguas diferentes e hoje isso vale 4 pessoas reais: afastado
   * continua empregado, e o ASO dele vencendo continua sendo problema da
   * empresa. Usar o headcount aqui fazia o vencimento dessas pessoas sumir do
   * calendário — o mesmo tipo de sumiço silencioso que este bloco veio corrigir. */
  const noQuadroIds = useMemo(
    () => new Set(d.colaboradores.filter((c) => !c.ehDirecao && noQuadro(c)).map((c) => c.id)),
    [d.colaboradores],
  );

  // Eventos do mês = aniversários + tempo de empresa (derivados) + eventos salvos.
  const itens = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const c of d.ativos) {
      const n = parseData(c.dataNascimento);
      if (n && n.getMonth() === mes) {
        const idade = ano - n.getFullYear();
        out.push({ dia: n.getDate(), tipo: "Aniversário", titulo: c.nome, sub: idade > 0 ? `${idade} anos` : undefined });
      }
      const a = parseData(c.dataAdmissao);
      if (a && a.getMonth() === mes) {
        const anos = ano - a.getFullYear();
        out.push({ dia: a.getDate(), tipo: "Tempo de empresa", titulo: c.nome, sub: anos > 0 ? `${anos} ${anos === 1 ? "ano" : "anos"} de casa` : "Entrou agora" });
      }
    }
    for (const e of eventos) {
      const dt = parseData(e.data);
      if (!dt) continue;
      const match = e.recorrenteAnual ? dt.getMonth() === mes : (dt.getFullYear() === ano && dt.getMonth() === mes);
      if (!match) continue;
      const sub = e.hora ? `${e.hora}${e.descricao ? ` · ${e.descricao}` : ""}` : (e.descricao ?? undefined);
      out.push({ dia: dt.getDate(), tipo: e.tipo, titulo: e.titulo, sub: sub ?? undefined, eventoId: e.id });
    }

    /* ── Prazos ──────────────────────────────────────────────────────────────
       Todo vencimento que existe no sistema cai aqui: documento, NR, contrato
       de experiência e o prazo da CLT para conceder férias. Antes cada um vivia
       só na sua tela, e quem abria o calendário para planejar o mês não via
       nenhum deles. Só entra o que tem DATA e cai no mês/ano em exibição. */
    const noMes = (v?: string | null) => {
      const dt = parseData(v);
      return dt && dt.getFullYear() === ano && dt.getMonth() === mes ? dt : null;
    };

    for (const doc of documentos) {
      const dt = noMes(doc.dataVencimento);
      if (!dt) continue;
      /* Documento SEM colaborador é da empresa e continua valendo. Com
         colaborador, só entra se a pessoa ainda estiver no quadro. */
      if (doc.colaboradorId && !noQuadroIds.has(doc.colaboradorId)) continue;
      const nome = doc.colaboradorId ? d.nomeColab(doc.colaboradorId) : "Documento da empresa";
      out.push({
        dia: dt.getDate(), tipo: "Documento vence",
        titulo: nome,
        sub: [doc.categoria, doc.nome].filter(Boolean).join(" · ") || "Documento",
      });
    }

    /* EXAME AGENDADO — o dia de comparecer à clínica. É compromisso marcado, não
       prazo: o vencimento diz até quando dá para resolver, isto diz onde alguém
       precisa estar. Vivia só na linha do exame em SST, então quem abria o
       calendário para planejar a semana não via ninguém saindo para o exame.
       `agendadoPara` guarda data E hora (datetime-local), e a hora entra no
       subtítulo — é a informação que o colaborador liga para perguntar. */
    for (const doc of documentos) {
      if (!doc.agendadoPara) continue;
      if (doc.colaboradorId && !noQuadroIds.has(doc.colaboradorId)) continue;
      const dt = noMes(doc.agendadoPara);
      if (!dt) continue;
      const hora = doc.agendadoPara.slice(11, 16);
      out.push({
        dia: dt.getDate(), tipo: "Exame agendado",
        titulo: doc.colaboradorId ? d.nomeColab(doc.colaboradorId) : doc.nome,
        sub: [hora, doc.categoria, doc.clinica, doc.localExame].filter(Boolean).join(" · "),
      });
    }

    for (const c of certificacoes) {
      const dt = noMes(c.dataValidade);
      if (!dt) continue;
      if (!noQuadroIds.has(c.colaboradorId)) continue;
      out.push({
        dia: dt.getDate(), tipo: "NR vence",
        titulo: d.nomeColab(c.colaboradorId),
        sub: `${c.nr} vence${c.instituicao ? ` · ${c.instituicao}` : ""}`,
      });
    }

    for (const c of d.ativos) {
      // Contrato de experiência: o dia 90 é quando a empresa PRECISA ter
      // decidido — passou disso, o contrato vira por prazo indeterminado.
      const exp = situacaoExperiencia(c);
      if (exp) {
        const dt = noMes(exp.fim.toISOString());
        if (dt) out.push({
          dia: dt.getDate(), tipo: "Experiência",
          titulo: c.nome, sub: "90 dias de contrato — decidir efetivar ou encerrar",
        });
        // A marca dos 45 dias (decidir prorrogar) fica no meio do caminho.
        const meio = new Date(exp.fim.getTime());
        meio.setDate(meio.getDate() - 45);
        const dm = noMes(meio.toISOString());
        if (dm) out.push({
          dia: dm.getDate(), tipo: "Experiência",
          titulo: c.nome, sub: "45 dias — decidir se prorroga",
        });
      }
    }

    // Prazo de conceder férias (art. 134): passou, paga em dobro.
    const desde = inicioDoHistorico(ferias);
    for (const c of d.ativos) {
      const sit = situacaoFerias(c, ferias.filter((f) => f.colaboradorId === c.id), undefined, desde);
      if (!sit || sit.jaGozou || sit.situacao === "sem-registro") continue;
      const dt = noMes(sit.limiteConcessao.toISOString());
      if (!dt) continue;
      out.push({
        dia: dt.getDate(), tipo: "Férias — prazo CLT",
        titulo: c.nome,
        sub: `Último dia para conceder ${sit.diasEmAberto} dia(s) sem pagar em dobro`,
      });
    }

    /* ── Quem sai e quem volta de férias ───────────────────────────────────
       Duas marcas por período: o dia em que a pessoa SAI e o dia em que VOLTA
       ao trabalho. É o que responde "quem não vai estar aqui na semana que vem".
       Cancelada fica de fora; o resto entra, inclusive o que já passou — o
       calendário também serve para olhar para trás. */
    for (const f of ferias) {
      if (f.status === "Cancelada") continue;
      if (!noQuadroIds.has(f.colaboradorId)) continue;
      const nome = d.nomeColab(f.colaboradorId);
      const ini = noMes(f.dataInicio);
      const ret = noMes(f.dataRetorno);
      const volta = parseData(f.dataRetorno);
      const saida = parseData(f.dataInicio);
      const bruto = saida && volta
        ? Math.round((volta.getTime() - saida.getTime()) / 86_400_000) : null;
      // Registro com retorno ANTES do início existe na base antiga (a tela só
      // passou a impedir hoje). Imprimir "-31 dia(s)" é a tela afirmando um
      // absurdo: melhor dizer que o período está torto e mandar conferir.
      const quantos = bruto != null && bruto > 0 ? bruto : null;
      const torto = bruto != null && bruto <= 0;
      if (ini) out.push({
        dia: ini.getDate(), tipo: "Férias", titulo: nome,
        sub: torto
          ? "Período com datas trocadas — confira em Férias"
          : `Sai de férias${quantos ? ` · ${quantos} dia(s)` : ""}${volta ? ` · volta ${formatDate(volta.toISOString())}` : ""}`,
      });
      if (ret) out.push({
        dia: ret.getDate(), tipo: "Férias", titulo: nome,
        sub: torto
          ? "Período com datas trocadas — confira em Férias"
          : `Volta de férias${saida ? ` · saiu ${formatDate(saida.toISOString())}` : ""}`,
      });
    }

    /* ── Dinheiro: os dois dias que todo mundo pergunta ────────────────────
       O 5º dia útil não é "dia 5": depende de onde caem sábado, domingo e os
       feriados daquele mês. Os feriados saem do próprio calendário (eventos do
       tipo "Feriado", inclusive os que se repetem todo ano), então cadastrar um
       feriado novo já corrige a data do pagamento sozinho. */
    const feriados = feriadosDe(eventos);
    const pag = diaDoPagamento(ano, mes, feriados);
    if (pag) out.push({
      dia: pag.getDate(), tipo: "Pagamento",
      titulo: "Pagamento do salário",
      sub: `${DIAS_UTEIS_PAGAMENTO}º dia útil — prazo da CLT (art. 459)`,
    });
    const adi = diaDoAdiantamento(ano, mes, feriados);
    out.push({
      dia: adi.getDate(), tipo: "Pagamento",
      titulo: "Adiantamento",
      sub: adi.getDate() === 20 ? "Dia 20" : `Dia 20 caiu sem expediente — antecipado para ${adi.getDate()}`,
    });

    return out
      .filter((x) => visivel(x.tipo, foco))
      .sort((x, y) => x.dia - y.dia || x.tipo.localeCompare(y.tipo));
  }, [d, noQuadroIds, eventos, documentos, certificacoes, ferias, ano, mes, foco]);

  const porDia = useMemo(() => {
    const m = new Map<number, Item[]>();
    for (const it of itens) { const arr = m.get(it.dia) ?? []; arr.push(it); m.set(it.dia, arr); }
    return m;
  }, [itens]);

  // Grade de 6 semanas começando no domingo.
  const offset = new Date(ano, mes, 1).getDay();
  const celulas = Array.from({ length: 42 }, (_, i) => new Date(ano, mes, 1 - offset + i));
  const ehHoje = (dt: Date) => dt.getFullYear() === HOJE.getFullYear() && dt.getMonth() === HOJE.getMonth() && dt.getDate() === HOJE.getDate();

  const navMes = (delta: number) => {
    let m = mes + delta, y = ano;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setMes(m); setAno(y);
  };

  return (
    <div>
      <PageHeader title="Calendário" description="Aniversários, vencimentos, pagamentos e férias. Clique na legenda para ver só um tipo.">
        {gere && <button className="btn-primary" onClick={() => setNovo(true)}><Plus className="h-4 w-4" /> Novo evento</button>}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button className="btn-outline px-2" onClick={() => navMes(-1)} aria-label="Mês anterior"><ChevronLeft className="h-4 w-4" /></button>
          <span className="min-w-[150px] text-center text-lg font-semibold text-brand-ink">{MESES_PT[mes]} {ano}</span>
          <button className="btn-outline px-2" onClick={() => navMes(1)} aria-label="Próximo mês"><ChevronRight className="h-4 w-4" /></button>
          <button className="btn-ghost text-sm" onClick={() => { setMes(HOJE.getMonth()); setAno(HOJE.getFullYear()); }}>Hoje</button>
        </div>
        {/* A legenda É o filtro: clicar num selo mostra SÓ aquele tipo, e clicar
            em mais de um soma. Antes o clique escondia — para ver só os
            aniversários era preciso desligar os outros onze, um a um, e depois
            religar os onze. O selo apagado e riscado é o que NÃO está no quadro
            agora, para a diferença ser óbvia sem precisar contar. */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {tiposDaLegenda.map((t) => {
            const on = mostrando(t.tipo);
            const focado = foco.has(t.tipo);
            /* Removível é quem ESTÁ na lista de personalizados — não "quem não
               é de fábrica". A versão anterior perguntava à lib, que só conhece
               os 5 tipos de fábrica dela e desconhece os 8 DERIVADOS desta tela
               (Aniversário, NR vence, Pagamento…): os 8 passavam por "criados
               pela empresa" e ganhavam um "×" que prometia apagar e não apagava
               nada — o filtro do onConfirmar não encontrava o nome, e mesmo
               assim saía o aviso "Tipo apagado". */
            const removivel = gere && personalizados.some((p) => p.nome === t.tipo);
            return (
              /* Contêiner, não <button>: o "x" de apagar é um botão próprio, e
                 botão dentro de botão é HTML inválido — o navegador desmonta a
                 marcação e o clique passa a cair em lugar imprevisível. */
              <span
                key={t.tipo}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs transition",
                  focado ? "border-brand bg-brand/5 font-medium text-brand-ink"
                    : on ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                      : "border-dashed border-slate-200 text-slate-300 line-through hover:text-slate-400",
                )}
              >
                <button
                  type="button"
                  onClick={() => alternarTipo(t.tipo)}
                  aria-pressed={focado}
                  title={focado
                    ? (foco.size === 1 ? "Voltar a ver todos" : `Tirar ${t.tipo} do filtro`)
                    : (foco.size ? `Somar ${t.tipo} ao filtro` : `Ver só ${t.tipo}`)}
                  className="inline-flex items-center gap-1.5"
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? t.cor : "#cbd5e1" }} />
                  {t.tipo}
                </button>
                {/* Só os tipos criados pela empresa podem ser apagados. O x fica
                    DENTRO do selo, mas com o clique separado: sem `stopPropagation`
                    ele ligaria e desligaria o filtro junto. */}
                {removivel && (
                  <button
                    type="button"
                    aria-label={`Apagar o tipo ${t.tipo}`}
                    title={`Apagar o tipo ${t.tipo}`}
                    className="-mr-0.5 rounded-full px-0.5 text-slate-300 hover:text-red-600"
                    onClick={() => setApagarTipo(t.tipo)}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
          {/* Com o filtro ligado é preciso ter UMA saída óbvia. Sem isto a pessoa
              teria que lembrar em quais selos clicou para desfazer um a um — o
              mesmo trabalho que este recurso veio eliminar. */}
          {foco.size > 0 && (
            <button
              type="button"
              onClick={() => setFoco(new Set())}
              className="ml-1 rounded-full px-2 py-0.5 text-xs font-medium text-brand underline-offset-2 hover:underline"
            >
              Ver todos
            </button>
          )}
        </div>
      </div>

      <ConfirmDialog
        aberto={!!apagarTipo}
        onFechar={() => setApagarTipo(null)}
        onConfirmar={() => {
          if (!apagarTipo) return;
          salvarConfig({
            tiposEventoPersonalizados: personalizados.filter((t) => t.nome !== apagarTipo),
          });
          /* salvarConfig só escreve NESTE navegador. Sem isto o tipo continuava
             existindo nos outros aparelhos, e a próxima config que subisse de
             qualquer máquina ressuscitava o que acabou de ser apagado. */
          void enviarConfigNuvem();
          /* Apagar um tipo que estava EM FOCO deixaria o quadro filtrado por um
             nome que não tem mais selo: nada apareceria e não haveria onde
             clicar para desfazer. */
          setFoco((s) => esquecerTipo(s, apagarTipo));
          toast(`Tipo "${apagarTipo}" apagado.`);
          setApagarTipo(null);
        }}
        titulo="Apagar tipo de aviso"
        mensagem={
          apagarTipo ? (
            <>
              Apagar o tipo <span className="font-medium text-slate-700">{apagarTipo}</span>?
              {/* Apagar o TIPO não apaga os eventos — eles ficam, só perdem a cor
                  e a entrada na legenda. Dizer isso evita o medo de perder
                  lançamento, e evita a surpresa de eles sumirem do filtro. */}
              {(() => {
                const usados = eventos.filter((e) => e.tipo === apagarTipo).length;
                return usados > 0 ? (
                  <>
                    {" "}
                    <span className="font-medium text-amber-700">
                      {usados === 1 ? "1 evento usa" : `${usados} eventos usam`} este tipo.
                    </span>{" "}
                    Eles continuam no calendário, mas voltam a aparecer em cinza e sem filtro
                    próprio.
                  </>
                ) : (
                  " Nenhum evento usa este tipo."
                );
              })()}
            </>
          ) : (
            ""
          )
        }
      />

      <Card className="mb-6">
        <CardBody className="p-0">
          <div className="grid grid-cols-7 border-b border-slate-100 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            {DOW.map((x) => <div key={x} className="py-2">{x}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {celulas.map((dt, i) => {
              const noMes = dt.getMonth() === mes;
              const evs = noMes ? (porDia.get(dt.getDate()) ?? []) : [];
              return (
                <div key={i} className={cn("min-h-[88px] border-b border-r border-slate-100 p-1.5", !noMes && "bg-slate-50/40", ehHoje(dt) && "bg-brand-50/50")}>
                  <div className={cn("mb-1 text-xs font-medium", noMes ? "text-slate-600" : "text-slate-300", ehHoje(dt) && "font-bold text-brand")}>{dt.getDate()}</div>
                  <div className="space-y-0.5">
                    {evs.slice(0, 3).map((e, j) => (
                      <div key={j} className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white" style={{ background: corDe(e.tipo, personalizados) }} title={`${e.titulo}${e.sub ? ` — ${e.sub}` : ""}`}>{e.titulo}</div>
                    ))}
                    {evs.length > 3 && <div className="px-1 text-[10px] font-medium text-slate-400">+{evs.length - 3} mais</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title={`Tudo de ${MESES_PT[mes]}`} subtitle="Lista completa do mês, em ordem de data" icon={<CalendarDays className="h-[18px] w-[18px]" />} />
        <CardBody>
          {itens.length === 0 ? (
            /* Vazio POR FILTRO e vazio DE VERDADE são coisas diferentes: dizer
               "nada marcado neste mês" com o filtro ligado faz a pessoa concluir
               que o mês está livre quando ela mesma escondeu o resto. */
            <EmptyState
              title={foco.size > 0 ? "Nada deste tipo neste mês" : "Nada marcado neste mês"}
              description={foco.size > 0
                ? `O filtro está mostrando só ${[...foco].join(", ")}. Clique em “Ver todos” na legenda acima.`
                : "Use “Novo evento” para adicionar reuniões e datas comemorativas."}
              icon={<CalendarDays className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-1.5">
              {itens.map((it, i) => {
                const Icon = iconDe(it.tipo);
                const ev = it.eventoId ? eventos.find((e) => e.id === it.eventoId) : null;
                return (
                  <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                    <span className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-white" style={{ background: corDe(it.tipo, personalizados) }}>
                      <span className="text-[8px] uppercase leading-none">{MESES_PT[mes].slice(0, 3)}</span>
                      <span className="text-sm font-bold leading-none">{it.dia}</span>
                    </span>
                    <Icon className="h-4 w-4 shrink-0" style={{ color: corDe(it.tipo, personalizados) }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-700">{it.titulo}</p>
                      <p className="truncate text-xs text-slate-400">{it.tipo}{it.sub ? ` · ${it.sub}` : ""}</p>
                    </div>
                    {gere && ev && (
                      <div className="flex shrink-0 items-center gap-1">
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" onClick={() => setEdit(ev)} aria-label="Editar"><Pencil className="h-4 w-4" /></button>
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => setDel(ev)} aria-label="Remover"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>

      {(novo || edit) && <EventoModal onFechar={() => { setNovo(false); setEdit(null); }} editar={edit} />}
      <ConfirmDialog
        aberto={!!del}
        onFechar={() => setDel(null)}
        onConfirmar={() => { if (del) { remover(del.id); toast("Evento removido."); } }}
        titulo="Remover evento?"
        mensagem={del ? `“${del.titulo}” será removido do calendário.` : ""}
      />
    </div>
  );
}

function EventoModal({ onFechar, editar }: { onFechar: () => void; editar: EventoCalendario | null }) {
  const toast = useToast();
  const { criar, atualizar } = useColecao("eventos");
  const [form, setForm] = useState<Partial<EventoCalendario>>(editar ?? { tipo: "Comemorativa", recorrenteAnual: false, data: "" });
  const set = (p: Partial<EventoCalendario>) => setForm((f) => ({ ...f, ...p }));

  /* Criar tipo de aviso na hora de lançar o evento. Mandar a pessoa para uma
     tela de configuração no meio do cadastro é o caminho mais curto para ela
     desistir e escolher "Outro". */
  const config = useConfig();
  // Memoizado pelo mesmo motivo da página: `?? []` cria array novo a cada render.
  const personalizados = useMemo(
    () => config.tiposEventoPersonalizados ?? [],
    [config.tiposEventoPersonalizados],
  );
  const tipos = useMemo(() => tiposDisponiveis(personalizados, NOMES_RESERVADOS), [personalizados]);
  /* O tipo do evento que está sendo editado pode NÃO estar na lista — foi
     apagado, ou foi criado noutro aparelho e a config ainda não chegou aqui.
     Sem esta entrada o <select> não acha a option correspondente e mostra a
     PRIMEIRA ("Comemorativa"), enquanto o dado gravado continua o original:
     a tela afirma um tipo e o registro guarda outro, e quem mexer noutro campo
     e salvar acha que confirmou o que estava lendo. */
  const tipoAtual = form.tipo?.trim();
  const opcoes = useMemo(
    () => (tipoAtual && !tipos.some((t) => t.nome === tipoAtual)
      ? [...tipos, { nome: tipoAtual, cor: COR_PADRAO_TIPO }]
      : tipos),
    [tipos, tipoAtual],
  );
  const salvar = () => {
    if (!form.titulo?.trim()) return toast("Informe o título do evento.", "erro");
    if (!form.data) return toast("Informe a data.", "erro");
    const dados = {
      titulo: form.titulo.trim(),
      data: form.data,
      tipo: form.tipo ?? "Comemorativa",
      recorrenteAnual: !!form.recorrenteAnual,
      hora: form.hora || null,
      descricao: form.descricao || null,
    };
    if (editar) { atualizar(editar.id, dados); toast("Evento atualizado."); }
    else { criar(dados); toast("Evento adicionado ao calendário."); }
    onFechar();
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={editar ? "Editar evento" : "Novo evento"}
      descricao="Reuniões, datas comemorativas, feriados e marcos da empresa."
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>Salvar</button></>}
    >
      <div className="space-y-3">
        <Campo label="Título" obrigatorio><Input value={form.titulo ?? ""} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Reunião geral, Dia das Mães…" /></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data" obrigatorio><Input type="date" value={(form.data ?? "").slice(0, 10)} onChange={(e) => set({ data: e.target.value })} /></Campo>
          {/* Criar tipo saiu daqui. Um formulário de configuração no meio do
              cadastro de evento deixava a tela confusa e misturava dois
              trabalhos: lançar um aviso e definir as categorias da empresa.
              Agora os tipos se cadastram no Painel de Controle, junto das outras
              listas do sistema, e aqui só se escolhe. */}
          <Campo label="Tipo" hint="Cadastre novos tipos no Painel de Controle">
            <Select value={form.tipo} onChange={(e) => set({ tipo: e.target.value })}>
              {opcoes.map((t) => <option key={t.nome} value={t.nome}>{t.nome}</option>)}
            </Select>
          </Campo>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Campo label="Hora" hint="Opcional (reuniões)"><Input type="time" value={form.hora ?? ""} onChange={(e) => set({ hora: e.target.value })} /></Campo>
          <Campo label="Repetição">
            <label className="flex h-[42px] items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.recorrenteAnual} onChange={(e) => set({ recorrenteAnual: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand" />
              Repete todo ano
            </label>
          </Campo>
        </div>
        <Campo label="Descrição" hint="Opcional"><Textarea value={form.descricao ?? ""} onChange={(e) => set({ descricao: e.target.value })} placeholder="Detalhe a comemoração, a pauta da reunião, etc." /></Campo>
      </div>
    </Modal>
  );
}
