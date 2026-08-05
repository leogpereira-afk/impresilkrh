import { Fragment, useMemo, useState } from "react";
import {
  Palmtree, CalendarClock, CalendarPlus, ShieldAlert, Plus, BarChart3, Save,
  ChevronRight, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { LinkFicha } from "@/components/ui/link-ficha";
import { Campo, Input, Select } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasColoridas, BarrasVerticais } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, parseData, diaLocalISO, diasDeCalendario } from "@/lib/format";
import { JANELA_ALERTA_DIAS, STATUS_FERIAS } from "@/lib/constants";
import { feriasEmCurso } from "@/lib/ferias";
import { HistoricoFerias } from "@/components/ferias/historico-ferias";
import { situacaoFerias, inicioDoHistorico, DIAS_FERIAS } from "@/lib/clt";
import {
  contagem, prazoDeConcessao, statusIncoerente, proximaFerias, limiteDeConcessao,
} from "@/lib/feriasContagem";
import { DetalheFerias } from "@/components/ferias/detalhe-ferias";
import {
  validarAgendamento, validarPeriodo, retornoDe, diasEntre, temErro,
  MAX_ABONO_DIAS, type Achado,
} from "@/lib/feriasAgenda";
import { HOJE } from "@/data/_gen";
import type { Ferias as TFerias, Colaborador } from "@/data/types";

// Conta ANCORADA no início do dia (diasDeCalendario). A conta crua de
// milissegundos comparava a meia-noite do alvo com a HORA ATUAL: o mesmo
// documento dizia "vence hoje" de manhã e "vencido há 1 dia" depois das 12h.
const diasAte = (d?: string | null) => diasDeCalendario(d, HOJE);
// ISO -> "yyyy-MM-dd" para inputs type="date" (e o caminho inverso).
const isoParaInput = (iso?: string | null) => { const d = parseData(iso); return d ? diaLocalISO(d) : ""; };

/* Grava DATA PURA ("2026-08-04"), a mesma convenção do período aquisitivo.
   Antes montava `new Date(v + "T12:00:00").toISOString()`, meio-dia LOCAL, que
   em Brasília vira 15:00Z. Como o banco guarda 12:00Z em 17 dos 31 registros,
   abrir e salvar SEM TOCAR NA DATA movia o instante em 3 horas — e ainda criava
   uma convenção nova por fuso de quem editasse. Data de férias não tem hora:
   guardar só o dia acaba com o problema na origem, e a ida e volta vira
   identidade. */
const inputParaIso = (v: string) => (v ? v : null);

/* Salvar SEM MEXER na data não pode alterar o que está gravado.
   O banco guarda a mesma data em formatos diferentes ("2026-09-07T12:00:00.000Z"
   e "2026-09-07"), e reescrever no formato novo gerava uma alteração de valor
   com o MESMO dia — que ia parar no histórico como "07/09/2026 → 07/09/2026" e
   ainda oferecia um "Desfazer" que não desfazia nada. Se o dia é o mesmo, o
   valor guardado fica como está; só troca quando a pessoa realmente mudou. */
const manterSeMesmoDia = (guardado: string | null | undefined, noCampo: string) =>
  isoParaInput(guardado) === noCampo ? (guardado ?? null) : inputParaIso(noCampo);

// Paleta dos status de férias (alinhada às variantes de Badge / Quadro de Comando).
const CORES_STATUS: Record<string, string> = {
  "Em andamento": "#16a34a",
  Agendada: "#2563eb",
  "Em aberto": "#d97706",
  Concluída: "#94a3b8",
};

/* Cor da contagem. Quem está de férias AGORA é a informação que muda a decisão
   de quem escala o dia — por isso é a única em verde forte; o resto é leitura
   calma, e "datas trocadas" é o único vermelho porque é dado errado. */
const COR_FASE: Record<string, string> = {
  "em-curso": "text-emerald-600",
  futuro: "text-sky-600",
  voltou: "text-slate-400",
  "sem-gozo": "text-slate-400",
  // Vem de proximaFerias: ninguem marcou nada. Nao e erro, e agenda vazia.
  "sem-marcacao": "text-slate-400",
  "datas-trocadas": "text-red-600",
};

// Variante de Badge por status de férias (Apêndice — CLT).
function varianteStatus(status: string): "neutral" | "success" | "info" | "warning" {
  if (status === "Concluída") return "neutral";
  if (status === "Em andamento") return "success";
  if (status === "Agendada") return "info";
  return "warning"; // Em aberto
}

/* O prazo que interessa NÃO é o fim do período aquisitivo — é doze meses depois
   dele (art. 134: a empresa tem os 12 meses seguintes para conceder). Comparar
   com `periodoAquisitivoFim` direto marcava "vencido" assim que o direito
   nascia, um ano inteiro antes de existir qualquer risco de pagar em dobro.

   A conta mora em lib/feriasContagem.ts, com testes: aqui a tela só decide o
   que mostrar. `desdeHistorico` é a data a partir da qual o sistema tem
   registro de férias — período cujo prazo acabou antes disso não é "vencido",
   é desconhecido (ver inicioDoHistorico em lib/clt.ts). */
type Alerta = "vencido" | "a-vencer" | null;

function alertaCLT(f: TFerias, desde: Date | null): Alerta {
  const s = prazoDeConcessao(f, HOJE, desde, JANELA_ALERTA_DIAS).situacao;
  return s === "vencido" || s === "a-vencer" ? s : null;
}

export default function Ferias() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: ferias, criar, atualizar, remover } = useColecao("ferias");
  const drill = useDrill();

  const [novo, setNovo] = useState(false);
  const [colabId, setColabId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  // Dias deixou de ser sempre 30: a CLT permite partir em até três períodos, e
  // quem agenda 15 dias não tinha como registrar isso — ficava gravado 30.
  const [dias, setDias] = useState("30");
  const [abono, setAbono] = useState("0");

  // Uma linha aberta por vez: o painel é alto (abas + anexos) e dois abertos
  // ao mesmo tempo empurram a tabela para fora da tela.
  const [expandida, setExpandida] = useState<string | null>(null);

  // CRUD — edição/exclusão de um registro de férias (Quadro de Comando).
  const [editando, setEditando] = useState<TFerias | null>(null);
  const [edForm, setEdForm] = useState({
    aqInicio: "",
    aqFim: "",
    dataInicio: "",
    dataRetorno: "",
    diasGozados: "0",
    saldoDias: "0",
    status: "Em aberto" as string,
  });
  const [excluindo, setExcluindo] = useState<TFerias | null>(null);

  const podeEditar = podeGerir(sessao);

  // Escopo: colaboradores visíveis, sem direção e sem inativos.
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => !c.ehDirecao && noQuadro(c)),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  const lista = useMemo(
    () => ferias.filter((f) => idsEscopo.has(f.colaboradorId)),
    [ferias, idsEscopo],
  );

  // "De férias agora" vem das DATAS (helper único em lib/ferias), não do texto
  // "Em andamento": esse texto é digitado à mão e ninguém volta para avançá-lo,
  // então contava quem já voltou e deixava de fora quem está fora hoje. Sem isso
  // esta tela diria 0 enquanto a de Colaboradores diz 2, para a mesma pergunta.
  const deFeriasAgora = useMemo(
    () =>
      lista
        .filter((f) => feriasEmCurso(f))
        // registros sem data de retorno (NaN) vão para o fim, sem embaralhar a ordem.
        .sort((a, b) => {
          const da = diasAte(a.dataRetorno), db = diasAte(b.dataRetorno);
          if (isNaN(da)) return isNaN(db) ? 0 : 1;
          if (isNaN(db)) return -1;
          return da - db;
        }),
    [lista],
  );
  const agendadas = useMemo(() => lista.filter((f) => f.status === "Agendada"), [lista]);
  const emAberto = useMemo(() => lista.filter((f) => f.status === "Em aberto"), [lista]);

  /* Filtrava por feriasEmCurso, ou seja: só quem JÁ ESTÁ de férias. Um período
     agendado para o mês que vem — justamente o que se quer ver chegando — nunca
     aparecia, e o cartão dizia "nenhum retorno agendado" com o indicador
     "Agendadas 1" logo acima. Agora entra todo retorno futuro que ainda não
     foi concluído nem cancelado. */
  const proximosRetornos = useMemo(
    () =>
      lista
        .filter((f) =>
          f.status !== "Concluída" && f.status !== "Cancelada" &&
          f.dataRetorno && diasAte(f.dataRetorno) >= 0)
        .sort((a, b) => diasAte(a.dataRetorno) - diasAte(b.dataRetorno)),
    [lista],
  );

  // O corte vem de TODA a base de férias, não só do escopo visível: o que
  // define até onde o sistema enxerga é quando a empresa começou a lançar.
  const desdeHistorico = useMemo(() => inicioDoHistorico(ferias), [ferias]);
  const alertasCLT = useMemo(
    () => lista.filter((f) => alertaCLT(f, desdeHistorico) !== null),
    [lista, desdeHistorico],
  );

  /* Vencido é diferente de "a vencer": um custa dinheiro HOJE (art. 137 — as
     férias passam a ser pagas em dobro), o outro é agenda. O cartão "Alertas
     CLT" soma os dois num número só, e quem lê não sabe se precisa correr. */
  const vencidas = useMemo(
    () => lista.filter((f) => prazoDeConcessao(f, HOJE, desdeHistorico, JANELA_ALERTA_DIAS).situacao === "vencido"),
    [lista, desdeHistorico],
  );

  /* A próxima pessoa a sair de férias, com a contagem. Só olha gozo FUTURO:
     quem já está de férias aparece no cartão "De férias agora". */
  const proxima = useMemo(() => {
    const futuras = lista
      .map((f) => ({ f, c: contagem(f, HOJE) }))
      .filter((x) => x.c.fase === "futuro" && x.f.status !== "Cancelada");
    futuras.sort((a, b) => a.c.dias - b.c.dias);
    return futuras[0] ?? null;
  }, [lista]);

  // Os 4 indicadores são recortes da tabela "Controle de férias", então clicar filtra a tabela.
  const [foco, setFoco] = useState<string | null>(null);
  const alternarFoco = (f: string) => setFoco((atual) => (atual === f ? null : f));

  /* UMA LINHA POR PESSOA, não por lançamento.
     Antes cada período virava uma linha, e quem tinha três anos de histórico
     aparecia três vezes seguidas — com a mesma foto, o mesmo nome e três
     contagens diferentes. A pergunta que se faz aqui é sobre a PESSOA ("falta
     muito para as férias do Andre?"), não sobre o lançamento; o histórico dela
     mora no painel que abre na linha.

     O filtro dos cartões continua valendo sobre os LANÇAMENTOS: a pessoa entra
     na tabela se algum período dela casa com o recorte, e o painel mostra os
     períodos que casaram — senão o número do cartão diria uma coisa e a lista
     mostraria outra. */
  const tabela = useMemo(() => {
    const base =
      foco === "alertas" ? lista.filter((f) => alertaCLT(f, desdeHistorico) !== null)
      // "agora" tem chave própria porque não é um status: é o cálculo por datas
      // do card. Filtrar por texto aqui mostraria uma lista diferente do número.
      : foco === "agora" ? lista.filter((f) => feriasEmCurso(f))
      : foco ? lista.filter((f) => f.status === foco)
      : lista;

    const porPessoa = new Map<string, TFerias[]>();
    for (const f of base) {
      const atual = porPessoa.get(f.colaboradorId);
      if (atual) atual.push(f);
      else porPessoa.set(f.colaboradorId, [f]);
    }

    return [...porPessoa.entries()]
      .map(([colaboradorId, registros]) => {
        // Do mais recente para o mais antigo: o histórico se lê de cima.
        const ordenados = [...registros].sort((a, b) =>
          String(b.dataInicio || b.periodoAquisitivoFim || "").localeCompare(
            String(a.dataInicio || a.periodoAquisitivoFim || ""),
          ),
        );
        /* A próxima sai de TODOS os períodos da pessoa, não só dos que passaram
           no filtro: com o cartão "Concluídas" ligado, olhar só o recorte diria
           "sem férias marcadas" para quem tem uma agendada. */
        const todosDela = lista.filter((f) => f.colaboradorId === colaboradorId);
        const prazos = todosDela
          .map((f) => prazoDeConcessao(f, HOJE, desdeHistorico, JANELA_ALERTA_DIAS))
          .filter((p) => p.situacao !== "sem-prazo");
        return {
          colaboradorId,
          nome: d.nomeColab(colaboradorId),
          registros: ordenados,
          proxima: proximaFerias(todosDela, HOJE),
          // Saldo do que ainda está por gozar; período concluído não soma.
          saldoAberto: todosDela
            .filter((f) => f.status === "Em aberto" || f.status === "Agendada")
            .reduce((s, f) => s + (Number(f.saldoDias) || 0), 0),
          // O prazo que corre mais risco manda na linha.
          prazo: prazos.sort((a, b) => a.dias - b.dias)[0] ?? null,
          incoerentes: todosDela.filter((f) => statusIncoerente(f, HOJE)).length,
        };
      })
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [lista, d, foco, desdeHistorico]);

  // ---- Quadro de Comando: distribuição por status (gráfico clicável) ----
  const porStatus = useMemo(
    () =>
      STATUS_FERIAS.map((s) => ({
        nome: s,
        valor: lista.filter((f) => f.status === s).length,
        cor: CORES_STATUS[s] ?? "#64748b",
      })),
    [lista],
  );

  // Distribuição por área (somente registros com gozo programado/ativo/concluído).
  const porArea = useMemo(() => {
    const acc = new Map<string, number>();
    for (const f of lista) {
      const c = d.colabById.get(f.colaboradorId);
      const area = d.nomeArea(c?.areaId);
      acc.set(area, (acc.get(area) ?? 0) + 1);
    }
    return [...acc.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor);
  }, [lista, d]);

  // Mapeia uma lista de férias -> colaboradores (para o drill-down).
  const colabsDe = (fs: TFerias[]): Colaborador[] =>
    fs
      .map((f) => d.colabById.get(f.colaboradorId))
      .filter((c): c is Colaborador => !!c);

  const abrirDrillStatus = (status: string) => {
    const fs = lista.filter((f) => f.status === status);
    if (fs.length === 0) {
      toast(`Nenhum colaborador com férias "${status}".`, "erro");
      return;
    }
    drill.abrir(`Férias — ${status}`, colabsDe(fs), `${fs.length} colaborador(es) neste status`);
  };

  const abrirDrillArea = (area: string) => {
    const fs = lista.filter((f) => d.nomeArea(d.colabById.get(f.colaboradorId)?.areaId) === area);
    if (fs.length === 0) return;
    drill.abrir(`Férias — ${area}`, colabsDe(fs), `${fs.length} registro(s) na área`);
  };

  const resetForm = () => {
    setColabId("");
    setDataInicio("");
    setDias("30");
    setAbono("0");
    setNovo(false);
  };

  /* O que a pessoa escolhida já tem: período aquisitivo aberto (calculado da
     admissão pelo motor de clt.ts, que já existia e esta tela não usava) e os
     períodos de férias dela, para conferir saldo e sobreposição. */
  const contexto = useMemo(() => {
    const colab = escopo.find((c) => c.id === colabId) || null;
    const dela = ferias.filter((f) => f.colaboradorId === colabId);
    const sit = colab ? situacaoFerias(colab, dela) : null;
    return { colab, dela, sit };
  }, [colabId, escopo, ferias]);

  const inicioData = dataInicio ? new Date(`${dataInicio}T12:00:00`) : null;
  const diasNum = Number(dias);
  const abonoNum = Number(abono);

  const achados: Achado[] = useMemo(() => {
    if (!colabId || !dataInicio) return [];
    return validarAgendamento({
      inicio: inicioData,
      dias: diasNum,
      abono: abonoNum,
      diasJaLancados: contexto.sit?.diasGozados ?? 0,
      fracoesExistentes: contexto.dela.filter((f) => f.status !== "Cancelada" && f.dataInicio).length,
      outros: contexto.dela,
    });
  }, [colabId, dataInicio, inicioData, diasNum, abonoNum, contexto]);

  const agendar = () => {
    if (!colabId || !dataInicio) {
      toast("Selecione o colaborador e a data de início.", "erro");
      return;
    }
    if (temErro(achados)) {
      toast(achados.find((a) => a.nivel === "erro")!.texto, "erro");
      return;
    }
    const inicio = new Date(`${dataInicio}T12:00:00`);
    const inicioISO = inicio.toISOString();
    const sit = contexto.sit;
    criar({
      colaboradorId: colabId,
      // Antes ia null nos dois, e por isso a coluna CLT e o indicador
      // "Alertas CLT" ficavam vazios em TUDO que era criado por aqui — só os
      // registros antigos, importados, tinham o período preenchido.
      periodoAquisitivoInicio: sit ? sit.aquisitivoInicio.toISOString() : null,
      periodoAquisitivoFim: sit ? sit.direitoDesde.toISOString() : null,
      dataInicio: inicioISO,
      dataRetorno: retornoDe(inicio, diasNum).toISOString(),
      diasGozados: diasNum,
      saldoDias: Math.max(0, DIAS_FERIAS - (sit?.diasGozados ?? 0) - diasNum - abonoNum),
      status: "Agendada",
      observacao: abonoNum > 0 ? `${abonoNum} dia(s) vendido(s) como abono pecuniário (art. 143).` : null,
    });
    toast(`Férias de ${diasNum} dia(s) agendadas para ${d.nomeColab(colabId)}.`);
    resetForm();
  };

  // ---- Editar registro de férias ----
  const abrirEdicao = (f: TFerias) => {
    setEditando(f);
    setEdForm({
      aqInicio: isoParaInput(f.periodoAquisitivoInicio),
      aqFim: isoParaInput(f.periodoAquisitivoFim),
      dataInicio: isoParaInput(f.dataInicio),
      dataRetorno: isoParaInput(f.dataRetorno),
      diasGozados: String(f.diasGozados ?? 0),
      saldoDias: String(f.saldoDias ?? 0),
      status: f.status,
    });
  };

  /* Conferência do que está no formulário de edição. Antes não havia nenhuma:
     dava para gravar retorno ANTES do início (e aí "de férias agora" nunca
     achava a pessoa, porque a janela era negativa), 999 dias gozados e saldo
     de 99 — números que a CLT não permite e que ninguém digitaria de propósito,
     mas que passavam calados quando o dedo escorregava. */
  const edInicio = edForm.dataInicio ? new Date(`${edForm.dataInicio}T12:00:00`) : null;
  const edRetorno = edForm.dataRetorno ? new Date(`${edForm.dataRetorno}T12:00:00`) : null;
  const edAchados: Achado[] = useMemo(() => {
    if (!editando) return [];
    const a = validarPeriodo(edInicio, edRetorno);
    const g = Number(edForm.diasGozados);
    const sa = Number(edForm.saldoDias);
    if (!Number.isFinite(g) || g < 0 || g > DIAS_FERIAS) {
      a.push({ nivel: "erro", texto: `Dias gozados vai de 0 a ${DIAS_FERIAS}.` });
    }
    if (!Number.isFinite(sa) || sa < 0 || sa > DIAS_FERIAS) {
      a.push({ nivel: "erro", texto: `Saldo vai de 0 a ${DIAS_FERIAS}.` });
    }
    if (Number.isFinite(g) && Number.isFinite(sa) && g + sa > DIAS_FERIAS) {
      a.push({ nivel: "aviso", texto: `Gozados + saldo dão ${g + sa} — um período aquisitivo tem ${DIAS_FERIAS} dias.` });
    }
    // O período aquisitivo também é um par: um sem o outro deixa a coluna CLT
    // muda, e invertido faria o prazo de concessão nascer antes do direito.
    const aqI = edForm.aqInicio ? new Date(`${edForm.aqInicio}T12:00:00`) : null;
    const aqF = edForm.aqFim ? new Date(`${edForm.aqFim}T12:00:00`) : null;
    if (aqI && aqF && aqF.getTime() <= aqI.getTime()) {
      a.push({ nivel: "erro", texto: "O fim do período aquisitivo precisa ser depois do início." });
    }
    if (!!aqI !== !!aqF) {
      a.push({ nivel: "aviso", texto: "Preencha as duas datas do período aquisitivo — só com as duas o alerta da CLT funciona." });
    }
    if (edInicio && edRetorno) {
      const doPeriodo = diasEntre(edInicio, edRetorno);
      if (doPeriodo > 0 && Number.isFinite(g) && g !== doPeriodo) {
        a.push({ nivel: "aviso", texto: `As datas dão ${doPeriodo} dia(s) e "dias gozados" está ${g}.` });
      }
    }
    return a;
  }, [editando, edInicio, edRetorno, edForm.diasGozados, edForm.saldoDias, edForm.aqInicio, edForm.aqFim]);

  const salvarEdicao = () => {
    if (!editando) return;
    if (temErro(edAchados)) {
      toast(edAchados.find((a) => a.nivel === "erro")!.texto, "erro");
      return;
    }
    atualizar(editando.id, {
      // O período aquisitivo é gravado como DATA PURA ("AAAA-MM-DD"), que é como
      // ele já está no banco nos 31 registros. Guardar hora aqui só criaria uma
      // terceira convenção para as mesmas datas.
      periodoAquisitivoInicio: manterSeMesmoDia(editando.periodoAquisitivoInicio, edForm.aqInicio),
      periodoAquisitivoFim: manterSeMesmoDia(editando.periodoAquisitivoFim, edForm.aqFim),
      dataInicio: manterSeMesmoDia(editando.dataInicio, edForm.dataInicio),
      dataRetorno: manterSeMesmoDia(editando.dataRetorno, edForm.dataRetorno),
      diasGozados: Math.max(0, Number(edForm.diasGozados) || 0),
      saldoDias: Math.max(0, Number(edForm.saldoDias) || 0),
      status: edForm.status,
    });
    toast(`Férias de ${d.nomeColab(editando.colaboradorId)} atualizadas.`);
    setEditando(null);
  };

  // ---- Excluir registro de férias ----
  const confirmarExclusao = () => {
    if (!excluindo) return;
    const nome = d.nomeColab(excluindo.colaboradorId);
    remover(excluindo.id);
    toast(`Registro de férias de ${nome} excluído.`);
    setExcluindo(null);
  };

  return (
    <div>
      <PageHeader title="Férias" description="Painel de férias, saldos e conformidade CLT da sua equipe.">
        {podeEditar && (
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <CalendarPlus className="h-4 w-4" /> Agendar férias
          </button>
        )}
      </PageHeader>

      {/* Conclusão primeiro: a pergunta que se faz olhando esta tela é "falta
          muito para a próxima?". Antes ela só era respondida contando no
          calendário, linha por linha. Quando não há nenhuma marcada, o silêncio
          seria a pior resposta — dizer isso em voz alta é o próprio aviso. */}
      <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" />
        {proxima ? (
          <>
            <span className="text-slate-500">Próximas férias:</span>
            <span className="font-medium text-slate-800">{d.nomeColab(proxima.f.colaboradorId)}</span>
            <span className="font-medium text-sky-600">{proxima.c.texto.toLowerCase()}</span>
            <span className="text-slate-400">
              (início em {formatDate(proxima.f.dataInicio)}, retorno em {formatDate(proxima.f.dataRetorno)})
            </span>
          </>
        ) : (
          <>
            <span className="text-slate-600">Nenhuma férias marcada para os próximos dias.</span>
            {emAberto.length > 0 && (
              <span className="text-slate-400">
                {emAberto.length} {emAberto.length === 1 ? "pessoa tem período" : "pessoas têm período"} em aberto para programar.
              </span>
            )}
          </>
        )}
        {vencidas.length > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
            <ShieldAlert className="h-3.5 w-3.5" />
            {vencidas.length} {vencidas.length === 1 ? "período vencido" : "períodos vencidos"} — pagos em dobro
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="De férias agora" value={deFeriasAgora.length} icon={<Palmtree className="h-5 w-5" />} accent="green" hint="Período em curso hoje" onClick={() => alternarFoco("agora")} ativo={foco === "agora"} title="Filtrar o controle de férias por quem está de férias agora" />
        <StatCard label="Agendadas" value={agendadas.length} icon={<CalendarClock className="h-5 w-5" />} accent="blue" hint="Gozo programado" onClick={() => alternarFoco("Agendada")} ativo={foco === "Agendada"} title="Filtrar o controle de férias pelas agendadas" />
        <StatCard label="Em aberto" value={emAberto.length} icon={<CalendarPlus className="h-5 w-5" />} accent="amber" hint="Saldo a programar" onClick={() => alternarFoco("Em aberto")} ativo={foco === "Em aberto"} title="Filtrar o controle de férias pelas em aberto" />
        <StatCard label="Alertas CLT" value={alertasCLT.length} icon={<ShieldAlert className="h-5 w-5" />} accent={alertasCLT.length ? "red" : "green"} hint="Períodos a vencer/vencidos" onClick={() => alternarFoco("alertas")} ativo={foco === "alertas"} title="Filtrar o controle de férias pelos períodos vencidos/a vencer" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Quem está de férias agora" subtitle="Colaboradores ausentes no momento" icon={<Palmtree className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {deFeriasAgora.length === 0 ? (
              <EmptyState title="Ninguém de férias" description="Nenhum colaborador em gozo de férias no momento." icon={<Palmtree className="h-8 w-8" />} />
            ) : (
              deFeriasAgora.map((f) => (
                <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                  <LinkFicha id={f.colaboradorId} className="flex min-w-0 items-center gap-3">
                    <Avatar nome={d.nomeColab(f.colaboradorId)} foto={d.fotoColab(f.colaboradorId)} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="truncate text-xs text-slate-400">Desde {formatDate(f.dataInicio)}</p>
                    </div>
                  </LinkFicha>
                  <Badge variant="success">Retorna {formatDate(f.dataRetorno)}</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Próximos retornos" subtitle="Ordenados pela data de retorno" icon={<CalendarClock className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {proximosRetornos.length === 0 ? (
              <EmptyState title="Sem retornos previstos" description="Nenhum retorno de férias agendado." icon={<CalendarClock className="h-8 w-8" />} />
            ) : (
              proximosRetornos.map((f) => {
                const dd = diasAte(f.dataRetorno);
                return (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <LinkFicha id={f.colaboradorId} className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-700">{d.nomeColab(f.colaboradorId)}</p>
                      <p className="text-xs text-slate-400">{formatDate(f.dataRetorno)}</p>
                    </LinkFicha>
                    <Badge variant={feriasEmCurso(f) ? "success" : "info"}>
                      {dd === 0 ? "Volta hoje" : feriasEmCurso(f) ? `volta em ${dd}d` : `sai depois · ${dd}d`}
                    </Badge>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Quadro de Comando"
            subtitle="Distribuição por status"
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {lista.length === 0 ? (
              <EmptyState title="Sem dados" description="Nenhum registro de férias no seu escopo." icon={<BarChart3 className="h-8 w-8" />} />
            ) : (
              <>
                <BarrasColoridas data={porStatus} altura={240} onItemClick={abrirDrillStatus} />
                <div className="mt-3 flex flex-wrap gap-3">
                  {porStatus.map((s) => (
                    <button
                      key={s.nome}
                      type="button"
                      onClick={() => abrirDrillStatus(s.nome)}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-brand"
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.cor }} aria-hidden />
                      {s.nome} <span className="font-medium text-slate-700">({s.valor})</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Férias por área"
            subtitle="Volume de registros por área"
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {porArea.length === 0 ? (
              <EmptyState title="Sem dados" description="Nenhum registro de férias no seu escopo." icon={<BarChart3 className="h-8 w-8" />} />
            ) : (
              <BarrasVerticais data={porArea} altura={240} onItemClick={abrirDrillArea} />
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Controle de férias" subtitle={`${tabela.length} ${tabela.length === 1 ? "pessoa" : "pessoas"} · ${lista.length} periodo(s) no seu escopo`} icon={<Palmtree className="h-[18px] w-[18px]" />} />
        {tabela.length === 0 ? (
          <CardBody>
            {/* Card de valor zero também é clicável: sem este aviso a tela diria
                que não há férias nenhuma com a lista cheia por trás do filtro. */}
            <EmptyState
              title={foco ? "Nenhum registro neste filtro" : "Sem registros de férias"}
              description={foco ? "Clique de novo no cartão para ver todos os períodos." : "Nenhum período de férias no seu escopo de acesso."}
              icon={<Palmtree className="h-8 w-8" />}
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th w-8"><span className="sr-only">Abrir histórico</span></th>
                  <th className="th">Colaborador</th>
                  <th className="th">Próximas férias</th>
                  <th className="th hidden sm:table-cell">Saldo a gozar</th>
                  <th className="th hidden md:table-cell">Períodos</th>
                  <th className="th">CLT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tabela.map((p) => {
                  const aberta = expandida === p.colaboradorId;
                  const prazo = p.prazo;
                  return (
                    <Fragment key={p.colaboradorId}>
                      <tr className="transition hover:bg-slate-50/60">
                        <td className="td pr-0">
                          <button
                            type="button"
                            className="btn-ghost p-1.5"
                            aria-expanded={aberta}
                            title={aberta ? "Fechar" : "Ver o histórico de férias, observações e documentos"}
                            aria-label={`${aberta ? "Fechar" : "Abrir"} o histórico de férias de ${p.nome}`}
                            onClick={() => setExpandida(aberta ? null : p.colaboradorId)}
                          >
                            <ChevronRight className={`h-4 w-4 transition-transform ${aberta ? "rotate-90" : ""}`} />
                          </button>
                        </td>
                        <td className="td">
                          <LinkFicha id={p.colaboradorId} className="flex items-center gap-3" titulo="Abrir a ficha para lançar/agendar as férias">
                            <Avatar nome={p.nome} foto={d.fotoColab(p.colaboradorId)} size="sm" />
                            <span className="font-medium text-slate-800">{p.nome}</span>
                          </LinkFicha>
                        </td>
                        {/* A pergunta que se faz olhando esta tela: falta muito?
                            A contagem por lançamento respondia "voltou há 211
                            dias" — verdade que não serve para nada. */}
                        <td className="td">
                          <span className={`text-xs font-medium ${COR_FASE[p.proxima.fase]}`}>
                            {p.proxima.texto}
                          </span>
                          {p.proxima.registro?.dataInicio && (
                            <span className="ml-1.5 text-xs text-slate-400">
                              ({formatDate(p.proxima.registro.dataInicio)} → {formatDate(p.proxima.registro.dataRetorno)})
                            </span>
                          )}
                          {p.incoerentes > 0 && (
                            <span
                              className="ml-1.5 inline-flex align-middle text-amber-500"
                              title={`${p.incoerentes} período(s) com o status em desacordo com as datas. Abra para corrigir.`}
                              aria-label={`${p.incoerentes} período com status desatualizado`}
                            >
                              <AlertTriangle className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </td>
                        <td className="td hidden sm:table-cell text-slate-700">
                          {p.saldoAberto > 0 ? `${p.saldoAberto} dias` : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="td hidden md:table-cell text-slate-500">
                          {p.registros.length} {p.registros.length === 1 ? "período" : "períodos"}
                        </td>
                        {/* Antes só falava dentro da janela de 60 dias: em tudo o
                            mais ficava um travessão, que se lê como "não há prazo"
                            quando na verdade há, com folga. Agora diz o prazo. */}
                        <td className="td">
                          {prazo?.situacao === "vencido" ? (
                            <span title={`O limite era ${prazo.limite}`}>
                              <Badge variant="danger">{prazo.texto}</Badge>
                            </span>
                          ) : prazo?.situacao === "a-vencer" ? (
                            <span title={`Conceder até ${prazo.limite}`}>
                              <Badge variant="warning">{prazo.texto}</Badge>
                            </span>
                          ) : prazo?.situacao === "no-prazo" ? (
                            <span className="text-xs text-slate-500" title={`Conceder até ${prazo.limite}`}>{prazo.texto}</span>
                          ) : (
                            <span className="text-xs text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                      {aberta && (
                        <tr>
                          <td className="bg-slate-50/60 px-4 py-4" colSpan={6}>
                            <DetalheFerias
                              colaboradorId={p.colaboradorId}
                              nome={p.nome}
                              registros={p.registros}
                              podeEditar={podeEditar}
                              aoEditar={abrirEdicao}
                              aoExcluir={setExcluindo}
                            />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* O log já existia, mas só no Painel de Controle. Quem erra um lançamento
          precisa do valor ANTERIOR para desfazer, e precisa dele aqui. */}
      {podeEditar && (
        <div className="mt-6">
          <HistoricoFerias nomeDe={(id) => d.nomeColab(id)} />
        </div>
      )}

      {podeEditar && (
        <Modal
          aberto={novo}
          onFechar={resetForm}
          titulo="Agendar férias"
          descricao="Programe o gozo. 30 dias corridos, ou partido em até três períodos."
          rodape={
            <>
              <button className="btn-outline" onClick={resetForm}>Cancelar</button>
              <button className="btn-primary" onClick={agendar} disabled={temErro(achados)}>
                <Plus className="h-4 w-4" /> Agendar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            <Campo label="Colaborador" obrigatorio>
              <Select value={colabId} onChange={(e) => setColabId(e.target.value)}>
                <option value="">Selecione…</option>
                {escopo
                  .slice()
                  .sort((a, b) => a.nome.localeCompare(b.nome))
                  .map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
              </Select>
            </Campo>
            {contexto.sit && (
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Período aquisitivo desde <b>{formatDate(contexto.sit.aquisitivoInicio.toISOString())}</b> ·
                {" "}direito nasceu em <b>{formatDate(contexto.sit.direitoDesde.toISOString())}</b> ·
                {" "}conceder até <b>{formatDate(contexto.sit.limiteConcessao.toISOString())}</b>
                <br />
                Já lançados: <b>{contexto.sit.diasGozados} dia(s)</b> · disponível:{" "}
                <b>{Math.max(0, DIAS_FERIAS - contexto.sit.diasGozados)} dia(s)</b>
              </div>
            )}
            {colabId && !contexto.sit && (
              <p className="text-xs text-amber-700">
                Sem período aquisitivo completo (menos de 12 meses de casa) ou sem data de admissão no cadastro.
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data de início" obrigatorio>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </Campo>
              <Campo label="Dias de férias" obrigatorio hint="30 é o normal. Pode partir em até 3 períodos (mín. 5 dias).">
                <Input type="number" min={1} max={30} step={1} value={dias}
                  onChange={(e) => setDias(e.target.value)} />
              </Campo>
            </div>
            <Campo label="Vender como abono (opcional)" hint={`Até ${MAX_ABONO_DIAS} dias, um terço das férias (art. 143).`}>
              <Input type="number" min={0} max={MAX_ABONO_DIAS} step={1} value={abono}
                onChange={(e) => setAbono(e.target.value)} />
            </Campo>
            {dataInicio && inicioData && Number.isFinite(diasNum) && diasNum > 0 && (
              <p className="text-xs text-slate-500">
                Fica fora de <span className="font-medium text-slate-700">{formatDate(inicioData.toISOString())}</span>
                {" "}a <span className="font-medium text-slate-700">{formatDate(retornoDe(inicioData, diasNum - 1).toISOString())}</span>
                {" · "}volta em <span className="font-medium text-slate-700">{formatDate(retornoDe(inicioData, diasNum).toISOString())}</span>
              </p>
            )}
            {achados.length > 0 && (
              <ul className="space-y-1">
                {achados.map((a, i) => (
                  <li key={i} className={`rounded-lg px-3 py-2 text-xs ${a.nivel === "erro" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                    {a.nivel === "erro" ? "⛔ " : "⚠️ "}{a.texto}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {podeEditar && (
        <Modal
          aberto={!!editando}
          onFechar={() => setEditando(null)}
          titulo="Editar férias"
          descricao={editando ? d.nomeColab(editando.colaboradorId) : undefined}
          rodape={
            <>
              <button className="btn-outline" onClick={() => setEditando(null)}>Cancelar</button>
              <button className="btn-primary" onClick={salvarEdicao} disabled={temErro(edAchados)}>
                <Save className="h-4 w-4" /> Salvar
              </button>
            </>
          }
        >
          <div className="space-y-4">
            {/* O período aquisitivo não tinha campo nenhum: era gravado só no
                agendamento e nunca mais dava para corrigir — e é ele que manda
                na coluna CLT e no alerta de férias vencidas. */}
            <div className="rounded-lg border border-slate-200 p-3">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Período aquisitivo</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Campo label="Início" hint="12 meses de trabalho que geraram o direito.">
                  <Input type="date" value={edForm.aqInicio} onChange={(e) => setEdForm((s) => ({ ...s, aqInicio: e.target.value }))} />
                </Campo>
                <Campo label="Fim" hint="Quando o direito nasceu. Conceder em até 12 meses.">
                  <Input type="date" value={edForm.aqFim} onChange={(e) => setEdForm((s) => ({ ...s, aqFim: e.target.value }))} />
                </Campo>
              </div>
              {edForm.aqFim && (
                <p className="mt-1 text-xs text-slate-500">
                  Conceder até <b>{formatDate(limiteDeConcessao(edForm.aqFim))}</b>, senão as férias são pagas em dobro (art. 134).
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Início do gozo">
                <Input type="date" value={edForm.dataInicio} onChange={(e) => setEdForm((s) => ({ ...s, dataInicio: e.target.value }))} />
              </Campo>
              <Campo label="Retorno">
                <Input type="date" value={edForm.dataRetorno} onChange={(e) => setEdForm((s) => ({ ...s, dataRetorno: e.target.value }))} />
              </Campo>
              <Campo label="Dias gozados">
                <Input type="number" min={0} value={edForm.diasGozados} onChange={(e) => setEdForm((s) => ({ ...s, diasGozados: e.target.value }))} />
              </Campo>
              <Campo label="Saldo de dias">
                <Input type="number" min={0} value={edForm.saldoDias} onChange={(e) => setEdForm((s) => ({ ...s, saldoDias: e.target.value }))} />
              </Campo>
            </div>
            <Campo label="Status">
              <Select value={edForm.status} onChange={(e) => setEdForm((s) => ({ ...s, status: e.target.value }))}>
                {STATUS_FERIAS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </Select>
            </Campo>
            {edInicio && edRetorno && diasEntre(edInicio, edRetorno) > 0 && (
              <button
                type="button"
                className="btn-outline w-full justify-center text-xs"
                onClick={() => {
                  // Acerta os números pelas datas, que é a informação confiável:
                  // as datas vêm do calendário, os dias eram digitados à mão.
                  const dd = diasEntre(edInicio, edRetorno);
                  setEdForm((s) => ({ ...s, diasGozados: String(dd), saldoDias: String(Math.max(0, DIAS_FERIAS - dd)) }));
                }}
              >
                Acertar os dias pelas datas ({diasEntre(edInicio, edRetorno)} dia(s))
              </button>
            )}
            {edAchados.length > 0 && (
              <ul className="space-y-1">
                {edAchados.map((a, i) => (
                  <li key={i} className={`rounded-lg px-3 py-2 text-xs ${a.nivel === "erro" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800"}`}>
                    {a.nivel === "erro" ? "⛔ " : "⚠️ "}{a.texto}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Modal>
      )}

      {podeEditar && (
        <ConfirmDialog
          aberto={!!excluindo}
          onFechar={() => setExcluindo(null)}
          onConfirmar={confirmarExclusao}
          titulo="Excluir registro de férias"
          mensagem={
            excluindo ? (
              <>
                Excluir o registro de férias de{" "}
                <span className="font-medium text-slate-700">{d.nomeColab(excluindo.colaboradorId)}</span>? Esta ação não pode ser desfeita.
              </>
            ) : (
              ""
            )
          }
        />
      )}

      <DrillModal {...drill.props} />
    </div>
  );
}
