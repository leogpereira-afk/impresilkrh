import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ShieldAlert, MessageSquareWarning, FileWarning, Plus, Trash2, Pencil,
  Upload, ExternalLink, CalendarRange, CalendarX2, Clock, CheckCircle2, Trophy, BarChart3, Brain,
  ChevronDown, ChevronRight, Stethoscope, Coins, Info, ListChecks, Copy, FileDown, FileSpreadsheet, Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { Avatar, EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { BarrasVerticais, BarrasColoridas } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate, formatNumber, formatPercent, formatBRL, diaLocalISO } from "@/lib/format";
import { cn } from "@/lib/cn";
import { calcularHoraExtra, calcularFalta, horasDecimais } from "@/lib/pontoFolha";
import { TIPOS_ADVERTENCIA } from "@/lib/constants";
import { GlossarioComportamental } from "@/components/comportamental/glossario";
import { Link } from "react-router-dom";
import { HOJE, slug } from "@/data/_gen";
import type { Colaborador, Ponto, PontoDia, SituacaoDia } from "@/data/types";
import { lerPontoPdf, minParaHora, horaParaMin, type PontoImportado } from "@/lib/pontoImport";
import FolhaVariavel from "@/pages/FolhaVariavel";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const labelMes = (comp: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(comp || "");
  return m ? `${MESES[+m[2] - 1]}/${m[1]}` : (comp || "—");
};

// As datas de advertências/ausências são guardadas como "YYYY-MM-DD" — a comparação
// lexicográfica funciona como comparação cronológica.
const iso = (d: Date) => diaLocalISO(d); // dia LOCAL (não UTC) — não pula de dia à noite
const diaData = (data?: string | null) => (data ? formatDate(`${String(data).slice(0, 10)}T12:00:00`) : "—");

const COR_TIPO_ADV: Record<string, "neutral" | "warning" | "danger"> = {
  Verbal: "neutral",
  Escrita: "warning",
  Suspensão: "danger",
};

const COR_TIPO_AUS: Record<string, string> = {
  Falta: "#dc2626",
  Atraso: "#d97706",
  Atestado: "#2563eb",
  "Falta justificada": "#16a34a",
  "Saída antecipada": "#7c3aed",
};
const TIPOS_AUSENCIA = ["Falta", "Atraso", "Atestado", "Falta justificada", "Saída antecipada"] as const;

const primeiroNome = (nome: string) => nome.split(" ")[0];

// --- Extrato do ponto: rótulos e cores por situação do dia --------------------
const SIT_LABEL: Record<SituacaoDia, string> = {
  normal: "Trabalhado", falta: "Falta", atestado: "Atestado", abono: "Abono",
  feriado: "Feriado", ferias: "Férias", folga: "Folga (DSR)", semRegistro: "Sem registro",
};
const SIT_BADGE: Record<SituacaoDia, "neutral" | "danger" | "info" | "success" | "warning"> = {
  normal: "neutral", falta: "danger", atestado: "info", abono: "success",
  feriado: "warning", ferias: "info", folga: "neutral", semRegistro: "neutral",
};
// Situações que a legenda explica (na ordem em que aparecem).
const SIT_LEGENDA: { s: SituacaoDia; txt: string }[] = [
  { s: "normal", txt: "Dia trabalhado normalmente." },
  { s: "falta", txt: "Falta não justificada — desconta na folha." },
  { s: "atestado", txt: "Falta coberta por atestado médico (abonada)." },
  { s: "abono", txt: "Falta abonada pela empresa." },
  { s: "feriado", txt: "Feriado." },
  { s: "ferias", txt: "Dia dentro de período de férias." },
  { s: "folga", txt: "Descanso semanal remunerado (fim de semana)." },
];
const diaCurto = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : d);

// SALDO do mês: as horas extras abatem as horas de falta (e vice-versa). Positivo
// = sobrou a favor do colaborador; negativo = deve horas à empresa.
const saldoDe = (p: { extrasMin: number; faltasMin: number }) => (p.extrasMin || 0) - (p.faltasMin || 0);
const saldoTxt = (min: number) => (min === 0 ? "00:00" : `${min > 0 ? "+" : "−"}${minParaHora(Math.abs(min))}`);

// MÊS INTEIRO do colaborador: o Secullum fecha o ponto por período (ex.: 29/06 a
// 28/07), não pelo mês civil. Aqui geramos TODOS os dias desse período e casamos
// com o que veio no PDF — os dias sem registro aparecem como lacuna, em vez de
// simplesmente sumirem da lista.
function diasCompletos(p: { dias?: PontoDia[]; periodoInicio?: string | null; periodoFim?: string | null; competencia: string }): PontoDia[] {
  const existentes = new Map((p.dias ?? []).map((d) => [d.data, d]));
  let inicio = p.periodoInicio ?? null;
  let fim = p.periodoFim ?? null;
  // Sem período gravado (lançamento manual), cai no mês civil da competência.
  if (!inicio || !fim) {
    const m = /^(\d{4})-(\d{2})$/.exec(p.competencia || "");
    if (!m) return (p.dias ?? []).slice().sort((a, b) => a.data.localeCompare(b.data));
    const ultimo = new Date(+m[1], +m[2], 0).getDate();
    inicio = `${m[1]}-${m[2]}-01`;
    fim = `${m[1]}-${m[2]}-${String(ultimo).padStart(2, "0")}`;
  }
  // A janela precisa cobrir TODOS os dias gravados: num lançamento manual dá
  // para registrar um dia fora do mês civil, e ele sumia do extrato em silêncio.
  for (const dia of p.dias ?? []) {
    if (dia.data < inicio) inicio = dia.data;
    if (dia.data > fim) fim = dia.data;
  }
  const emData = (iso: string) => {
    const [a, m, d] = iso.split("-").map(Number);
    return new Date(a, m - 1, d);
  };
  const out: PontoDia[] = [];
  const cursor = emData(inicio);
  const limite = emData(fim);
  // Trava de segurança: no máximo 62 dias, para um período torto não travar a tela.
  for (let i = 0; i < 62 && cursor <= limite; i++) {
    const iso = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    out.push(existentes.get(iso) ?? { data: iso, situacao: "semRegistro", marcacoes: [], normaisMin: 0, extrasMin: 0, faltasMin: 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// CONFERÊNCIA: a soma dos dias tem que fechar com os totais do mês. O relatório
// vai assinado para a contabilidade, então isso é checado de verdade em vez de
// ser só uma frase na legenda. Registro sem detalhe diário não entra na conta
// (não é divergência, é dado que não existe).
function confereSomaDias(p: Ponto): { ok: boolean; difExtras: number; difFaltas: number } | null {
  if (!p.dias?.length) return null;
  const somaExtras = p.dias.reduce((s, x) => s + (x.extrasMin || 0), 0);
  const somaFaltas = p.dias.reduce((s, x) => s + (x.faltasMin || 0), 0);
  const difExtras = somaExtras - (p.extrasMin || 0);
  const difFaltas = somaFaltas - (p.faltasMin || 0);
  // 1 minuto de tolerância: o Secullum arredonda ao imprimir.
  return { ok: Math.abs(difExtras) <= 1 && Math.abs(difFaltas) <= 1, difExtras, difFaltas };
}

// Contagens do extrato para o dashboard (soma de todos os colaboradores do mês).
function resumoDias(dias: PontoDia[] | undefined) {
  const r = { faltas: 0, atestados: 0, abonos: 0, comExtra: 0, extrasMin: 0, faltasMin: 0 };
  for (const dia of dias ?? []) {
    if (dia.situacao === "falta") r.faltas++;
    if (dia.situacao === "atestado") r.atestados++;
    if (dia.situacao === "abono") r.abonos++;
    if (dia.extrasMin > 0) r.comExtra++;
    r.extrasMin += dia.extrasMin;
    r.faltasMin += dia.faltasMin;
  }
  return r;
}

export default function Ponto() {
  const sessao = useSessao();
  const d = useDominio();
  const drill = useDrill();
  const podeEditar = podeGerir(sessao);

  // Escopo de visibilidade: colaboradores ativos (sem direção / sem inativos).
  const escopo = useMemo(
    () =>
      colaboradoresVisiveis(sessao, d.colaboradores)
        .filter((c) => !c.ehDirecao && c.statusId !== "inativo")
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  return (
    <div>
      <PageHeader
        title="Frequência e Advertências"
        description="Registro disciplinar e relatórios de absenteísmo da equipe."
      />

      <Tabs
        abas={[
          {
            id: "advertencias",
            label: "Advertências",
            icon: <ShieldAlert className="h-4 w-4" />,
            conteudo: <AbaAdvertencias escopo={escopo} idsEscopo={idsEscopo} podeEditar={podeEditar} drill={drill} />,
          },
          {
            id: "absenteismo",
            label: "Absenteísmo",
            icon: <BarChart3 className="h-4 w-4" />,
            conteudo: <AbaAbsenteismo escopo={escopo} idsEscopo={idsEscopo} drill={drill} podeEditar={podeEditar} />,
          },
          {
            id: "ponto",
            label: "Ponto do mês",
            icon: <Clock className="h-4 w-4" />,
            conteudo: <AbaPontoMes podeEditar={podeEditar} />,
          },
          {
            id: "folha-variavel",
            label: "Folha Variável",
            icon: <Coins className="h-4 w-4" />,
            conteudo: <FolhaVariavel embutido />,
          },
          {
            id: "comportamental",
            label: "Guia comportamental",
            icon: <Brain className="h-4 w-4" />,
            conteudo: (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/70 bg-slate-50/60 px-4 py-3">
                  <p className="text-sm text-slate-600">
                    Antes de advertir, entenda o perfil. Como identificar e como lidar com cada pessoa.
                  </p>
                  <Link to="/comportamental" className="btn-outline shrink-0">
                    <Brain className="h-4 w-4" /> Abrir guia completo
                  </Link>
                </div>
                <GlossarioComportamental />
              </div>
            ),
          },
        ]}
      />

      <DrillModal {...drill.props} />
    </div>
  );
}

type Drill = ReturnType<typeof useDrill>;

// =====================================================================================
// ABA — PONTO DO MÊS (importa o Cartão Ponto do Secullum em PDF)
// =====================================================================================
function AbaPontoMes({ podeEditar }: { podeEditar: boolean }) {
  const d = useDominio();
  const config = useConfig();
  const toast = useToast();
  const { items: pontos, criar, atualizar, remover } = useColecao("pontos");
  const fileRef = useRef<HTMLInputElement>(null);
  const [previa, setPrevia] = useState<PontoImportado | null>(null);
  const [competencia, setCompetencia] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<"tudo" | "resumo">("tudo");
  const [excluir, setExcluir] = useState<string | null>(null);
  const [verMes, setVerMes] = useState<Ponto | null>(null);
  // Cards do topo filtram a lista abaixo (clicar de novo limpa).
  const [foco, setFoco] = useState<"extras" | "faltasHoras" | "faltasDias" | "atestados" | null>(null);
  const alternarFoco = (f: NonNullable<typeof foco>) => setFoco((a) => (a === f ? null : f));
  // Lançamento manual: null = fechado; objeto = aberto (com quem pré-selecionar).
  const [manual, setManual] = useState<{ colaboradorId?: string | null; nome?: string; existente?: Ponto | null } | null>(null);
  // Correção de um dia específico do extrato.
  const [editandoDia, setEditandoDia] = useState<{ ponto: Ponto; dia: PontoDia } | null>(null);
  const [expandido, setExpandido] = useState<Set<string>>(() => new Set());
  const toggleExp = (id: string) =>
    setExpandido((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const colOpts = useMemo(() => d.colaboradores.map((c) => ({ id: c.id, nome: c.nome })), [d.colaboradores]);
  // Devolve null (e não o id cru) quando o colaborador saiu do cadastro — assim
  // quem chama consegue cair no nome do PDF em vez de imprimir um id no relatório.
  const nomeColab = (id: string | null | undefined) => (id ? (d.colaboradores.find((c) => c.id === id)?.nome ?? null) : null);

  // Chave do vínculo guardado: o nome como o Secullum escreve, sem acento/caixa.
  const chaveNome = (s: string) =>
    (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

  const onArquivo = async (file: File) => {
    setOcupado(true);
    try {
      const buf = await file.arrayBuffer();
      const r = await lerPontoPdf(buf, colOpts);
      if (!r.linhas.length) { toast("Não encontrei funcionários neste PDF. É o Cartão Ponto do Secullum?", "erro"); return; }
      // Reaplica os vínculos que o RH já fez à mão em importações anteriores.
      // Sem isso, quem tem grafia diferente no cadastro volta como "não
      // vinculado" todo mês — e a reimportação cria uma SEGUNDA ficha da pessoa.
      const vinc = config.vinculosPonto ?? {};
      let reaproveitados = 0;
      const linhas = r.linhas.map((l) => {
        if (l.colaboradorId) return l;
        const id = vinc[chaveNome(l.nomePdf)];
        if (!id || !d.colaboradores.some((c) => c.id === id)) return l;
        reaproveitados++;
        return { ...l, colaboradorId: id, colaboradorNome: nomeColab(id) };
      });
      setPrevia({ ...r, linhas });
      setCompetencia(r.competencia || competencia);
      const casados = linhas.filter((l) => l.colaboradorId).length;
      toast(`Lido: ${linhas.length} funcionário(s), ${casados} casaram com o cadastro${reaproveitados ? ` (${reaproveitados} pelo vínculo que você já tinha feito)` : ""}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Não consegui ler este PDF.", "erro");
    } finally { setOcupado(false); }
  };

  const definirColab = (i: number, colId: string) => {
    if (!previa) return;
    const linha = previa.linhas[i];
    // Guarda a escolha: no mês que vem esse mesmo nome casa sozinho.
    if (linha) {
      const vinc = { ...(config.vinculosPonto ?? {}) };
      if (colId) vinc[chaveNome(linha.nomePdf)] = colId;
      else delete vinc[chaveNome(linha.nomePdf)];
      salvarConfig({ vinculosPonto: vinc });
    }
    setPrevia({ ...previa, linhas: previa.linhas.map((l, j) => (j === i ? { ...l, colaboradorId: colId || null, colaboradorNome: nomeColab(colId) } : l)) });
  };

  const importar = () => {
    if (!previa) return;
    if (!/^\d{4}-\d{2}$/.test(competencia)) { toast("Escolha a competência (mês/ano).", "erro"); return; }
    // Reimportar sobrescreve as fichas do mês. Se já havia ponto gravado nessa
    // competência (inclusive correções feitas à mão), avisa antes de trocar.
    const jaExistem = pontos.filter((p) => p.competencia === competencia).length;
    if (jaExistem > 0) {
      const ok = window.confirm(
        `Já existem ${jaExistem} ficha(s) de ponto em ${labelMes(competencia)}.\n\n` +
        `A importação vai SUBSTITUIR os dados dessas fichas pelo que está no PDF — correções feitas à mão neste mês serão perdidas.\n\n` +
        `Continuar?`,
      );
      if (!ok) return;
    }
    const agora = new Date().toISOString();
    let n = 0;
    let duplicadasRemovidas = 0;
    for (const l of previa.linhas) {
      const chave = l.colaboradorId || `pdf-${slug(l.nomePdf)}`;
      const id = `${competencia}::${chave}`;
      const rec = {
        id, competencia, colaboradorId: l.colaboradorId, nomePdf: l.nomePdf,
        normaisMin: l.normaisMin, faltasMin: l.faltasMin, extrasMin: l.extrasMin,
        dias: l.dias,
        periodoInicio: previa.periodoInicio ?? null, periodoFim: previa.periodoFim ?? null,
        importadoEm: agora, atualizadoEm: agora,
      };
      if (pontos.some((p) => p.id === id)) atualizar(id, rec); else criar(rec);

      // NÃO LANÇAR DE NOVO O QUE JÁ ESTÁ LANÇADO: a mesma pessoa pode já ter uma
      // ficha no mês com OUTRO id — porque o vínculo mudou (pdf-nome ↔ cadastro)
      // ou porque o PDF anterior escreveu o nome diferente. Qualquer ficha do mês
      // que seja da mesma pessoa (mesmo colaborador ou mesmo nome do PDF) e tenha
      // id diferente é a versão velha: sai, senão a pessoa fica em duplicidade e
      // o mês soma as horas duas vezes.
      const mesmaPessoa = (p: Ponto) =>
        p.id !== id && p.competencia === competencia &&
        ((!!l.colaboradorId && p.colaboradorId === l.colaboradorId) ||
         chaveNome(p.nomePdf) === chaveNome(l.nomePdf));
      for (const antigo of pontos.filter(mesmaPessoa)) { remover(antigo.id); duplicadasRemovidas++; }
      n++;
    }
    toast(
      `${n} ficha(s) de ponto gravada(s) em ${labelMes(competencia)}` +
      (duplicadasRemovidas ? ` · ${duplicadasRemovidas} ficha(s) repetida(s) do mesmo mês foram substituídas.` : "."),
    );
    setPrevia(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Quem não bate ponto (gerente, comissão, externo) e quem está AFASTADO (INSS,
  // licença) aparecem no PDF do Secullum com o mês inteiro em FALTAS — mas isso
  // não é falta: é ausência de controle de jornada / de trabalho. Essas fichas
  // ficam de fora dos totais e do relatório, senão a contabilidade receberia
  // centenas de horas de falta que não existem.
  const naoBate = (p: Ponto) => {
    if (!p.colaboradorId) return false;
    const c = d.colabById.get(p.colaboradorId);
    return !!c && (!!c.naoBatePonto || c.statusId === "afastado");
  };

  const doMesTodos = useMemo(
    () => pontos.filter((p) => p.competencia === competencia)
      .sort((a, b) => (nomeColab(a.colaboradorId) || a.nomePdf).localeCompare(nomeColab(b.colaboradorId) || b.nomePdf)),
    [pontos, competencia], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const doMes = useMemo(() => doMesTodos.filter((p) => !naoBate(p)), [doMesTodos, d.colabById]); // eslint-disable-line react-hooks/exhaustive-deps
  const semControle = useMemo(() => doMesTodos.filter(naoBate), [doMesTodos, d.colabById]); // eslint-disable-line react-hooks/exhaustive-deps
  const totExtras = doMes.reduce((s, p) => s + (p.extrasMin || 0), 0);
  const totFaltas = doMes.reduce((s, p) => s + (p.faltasMin || 0), 0);
  const comps = useMemo(() => [...new Set(pontos.map((p) => p.competencia))].sort().reverse(), [pontos]);

  // A aba abria sempre com a competência vazia e mostrava "Nada importado ainda"
  // mesmo com o mês inteiro gravado — parecia que o ponto tinha sumido. Ao
  // chegar (ou quando os pontos carregam da nuvem), cai no mês mais recente.
  useEffect(() => {
    if (!competencia && comps.length > 0) setCompetencia(comps[0]);
  }, [comps, competencia]);

  // Dashboard do extrato: soma das contagens diárias de todos os colaboradores.
  const agg = useMemo(
    () => doMes.reduce(
      (r, p) => { const x = resumoDias(p.dias); r.faltas += x.faltas; r.atestados += x.atestados; r.abonos += x.abonos; r.comExtra += x.comExtra; return r; },
      { faltas: 0, atestados: 0, abonos: 0, comExtra: 0 },
    ),
    [doMes],
  );

  // Resumo p/ enviar: só quem teve hora extra, falta ou atestado no mês.
  // Usa `visiveis` (já filtrado pelos cards), não `doMes`: com um card aceso, o
  // resumo — e o que sai no WhatsApp/PDF/Excel — precisa ser o mesmo recorte que
  // a tela mostra. Antes o card acendia mas o resumo saía com o mês inteiro.
  // Lista que a tabela mostra: os cards do topo continuam somando o mês inteiro,
  // só a tabela obedece ao foco.
  const visiveis = useMemo(() => doMes.filter((p) => {
    const r = resumoDias(p.dias);
    if (foco === "extras") return p.extrasMin > 0;
    if (foco === "faltasHoras") return p.faltasMin > 0;
    if (foco === "faltasDias") return r.faltas > 0;
    if (foco === "atestados") return r.atestados > 0;
    return true;
  }), [doMes, foco]);

  const resumoLinhas = useMemo<LinhaResumo[]>(
    () => visiveis
      .map((p) => ({ ...ocorrenciasDo(p), nome: nomeColab(p.colaboradorId) || `${p.nomePdf} (não vinculado)` }))
      .filter(temOcorrencia),
    [visiveis], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // Totais do resumo derivam das PRÓPRIAS linhas exibidas — fecham com o corpo da tabela.
  const totResumo = useMemo(
    () => resumoLinhas.reduce(
      (t, r) => { t.extrasMin += r.extrasMin; t.faltasMin += r.faltasMin; t.atestados += r.atestados.length; return t; },
      { extrasMin: 0, faltasMin: 0, atestados: 0 },
    ),
    [resumoLinhas],
  );
  const empresa = config.empresaNome || "Impresilk";
  const copiarResumo = async () => {
    try {
      await navigator.clipboard.writeText(textoResumo(empresa, competencia, resumoLinhas));
      toast("Resumo copiado — é só colar no WhatsApp.");
    } catch { toast("Não consegui copiar aqui. Baixe o PDF.", "erro"); }
  };

  // Quem não bate ponto (comissão/externo/direção): fica fora da conferência.
  const { atualizar: atualizarColab } = useColecao("colaboradores");
  const [gerNaoBate, setGerNaoBate] = useState(false);
  const naoBatem = useMemo(() => d.colaboradores.filter((c) => c.naoBatePonto), [d.colaboradores]);

  // Conferência: quem do cadastro (ativo, não-direção, que bate ponto) NÃO veio no PDF.
  const presentesIds = useMemo(
    () => new Set(doMes.map((p) => p.colaboradorId).filter((x): x is string => !!x)),
    [doMes],
  );
  const faltandoNoPonto = useMemo(
    () => d.colaboradores
      // Afastado (INSS, licença) não bate ponto por definição — cobrar a ficha
      // dele seria ruído todo mês.
      .filter((c) => !c.ehDirecao && !c.naoBatePonto && c.statusId !== "inativo" && c.statusId !== "afastado" && !presentesIds.has(c.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [d.colaboradores, presentesIds],
  );

  // Expandir/recolher todos os extratos (modo Tudo) — para varrer o mês inteiro.
  // "Novos Funcionários" do rodapé: quem foi ADMITIDO dentro da competência e
  // por isso ainda não tem (ou tem pouco) ponto — não é "todo mundo sem ponto",
  // que misturava afastado e recém-desligado na mesma lista.
  const novosFuncionarios = useMemo(() => {
    const m = /^(\d{4})-(\d{2})$/.exec(competencia || "");
    if (!m) return [];
    return d.colaboradores
      .filter((c) => !c.ehDirecao && c.statusId !== "inativo")
      .filter((c) => String(c.dataAdmissao ?? "").slice(0, 7) === competencia)
      .sort((a, b) => a.nome.localeCompare(b.nome))
      .map((c) => `${c.nome} — admitido em ${diaData(c.dataAdmissao)}`);
  }, [d.colaboradores, competencia]);


  // A apuração exporta EXATAMENTE o que a tabela mostra — antes exportava o mês
  // inteiro mesmo com um filtro ligado, e o arquivo saía diferente da tela.
  const apuracao = useMemo(
    () => montarApuracao(visiveis, (p) => nomeColab(p.colaboradorId) || p.nomePdf),
    [visiveis], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Quem tem o detalhe diário divergindo dos totais do mês — a tela avisa em vez
  // de afirmar que confere.
  const divergentes = useMemo(
    () => doMes.map((p) => ({ p, c: confereSomaDias(p) })).filter((x) => x.c && !x.c.ok),
    [doMes],
  );
  const comDetalhe = useMemo(() => doMes.filter((p) => (p.dias?.length ?? 0) > 0).length, [doMes]);

  const idsExpansiveis = useMemo(() => visiveis.filter((p) => (p.dias?.length ?? 0) > 0).map((p) => p.id), [visiveis]);
  const todosAbertos = idsExpansiveis.length > 0 && idsExpansiveis.every((id) => expandido.has(id));
  const alternarTodos = () => setExpandido(todosAbertos ? new Set() : new Set(idsExpansiveis));

  if (!podeEditar) {
    return <EmptyState icon={<Clock className="h-6 w-6" />} title="Sem permissão" description="O import de ponto é restrito ao RH/gestão." />;
  }

  return (
    <div className="space-y-4">
      {/* Upload */}
      <Card>
        <CardHeader title="Importar Cartão Ponto (Secullum)" subtitle="Suba o PDF do mês. As horas extras e faltas já vêm calculadas — só extraio e cruzo com o cadastro." icon={<Upload className="h-[18px] w-[18px]" />} />
        <CardBody>
          <input ref={fileRef} type="file" accept="application/pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onArquivo(f); }} />
          <button onClick={() => fileRef.current?.click()} disabled={ocupado} className="btn-primary disabled:opacity-50">
            {ocupado ? <Clock className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {ocupado ? "Lendo o PDF…" : "Escolher o PDF do ponto"}
          </button>
          <p className="mt-2 text-xs text-slate-400">Nada é enviado para fora: o PDF é lido aqui no seu navegador.</p>
        </CardBody>
      </Card>

      {/* Prévia da importação */}
      {previa && (
        <Card>
          <CardHeader
            title="Confira antes de importar"
            subtitle={`${previa.linhas.length} funcionário(s)${previa.periodoInicio ? ` · período ${diaData(previa.periodoInicio)} a ${diaData(previa.periodoFim)}` : ""}`}
            icon={<CheckCircle2 className="h-[18px] w-[18px]" />}
            action={
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Competência</label>
                <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none" />
              </div>
            }
          />
          <CardBody>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 text-xs text-slate-500">
                  <tr>
                    <th className="th">Funcionário (PDF)</th>
                    <th className="th">Cadastro</th>
                    <th className="th text-right">Normais</th>
                    <th className="th text-right">Faltas</th>
                    <th className="th text-right">Extras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {previa.linhas.map((l, i) => (
                    <tr key={i} className={l.colaboradorId ? "" : "bg-amber-50/50"}>
                      <td className="td text-slate-700">{l.nomePdf}</td>
                      <td className="td">
                        {l.colaboradorId ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-3.5 w-3.5" /> {nomeColab(l.colaboradorId)}</span>
                        ) : (
                          <Select value="" onChange={(e) => definirColab(i, e.target.value)} className="min-w-[180px] text-xs">
                            <option value="">⚠️ Vincular a…</option>
                            {colOpts.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                          </Select>
                        )}
                      </td>
                      <td className="td text-right tabular-nums text-slate-600">{l.normaisTxt || "—"}</td>
                      <td className={`td text-right tabular-nums ${l.faltasMin > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{l.faltasTxt || "—"}</td>
                      <td className={`td text-right tabular-nums ${l.extrasMin > 0 ? "font-medium text-brand" : "text-slate-400"}`}>{l.extrasTxt || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button onClick={() => { setPrevia(null); if (fileRef.current) fileRef.current.value = ""; }} className="btn-outline">Cancelar</button>
              <button onClick={importar} className="btn-primary"><CheckCircle2 className="h-4 w-4" /> Importar {previa.linhas.length} para {labelMes(competencia)}</button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Ponto já importado da competência */}
      {!previa && (
        <Card>
          <CardHeader
            title="Ponto importado"
            subtitle="Horas extras e faltas do mês, por colaborador. Estes números somam no custo mensal de cada um."
            icon={<Clock className="h-[18px] w-[18px]" />}
            action={
              <div className="flex items-center gap-2">
                <button className="btn-outline h-9 px-3 py-0 text-xs" onClick={() => setManual({})} title="Lançar ponto de alguém que não veio no PDF">
                  <Plus className="h-3.5 w-3.5" /> Lançar manual
                </button>
                <button className="btn-outline h-9 px-3 py-0 text-xs" onClick={() => setGerNaoBate(true)} title="Marque quem não registra ponto — fica fora da conferência">
                  <Users className="h-3.5 w-3.5" /> Não batem ponto{naoBatem.length ? ` (${naoBatem.length})` : ""}
                </button>
                {comps.length > 0 && (
                  <Select value={competencia} onChange={(e) => setCompetencia(e.target.value)} className="text-sm">
                    {!comps.includes(competencia) && <option value="">Escolha o mês…</option>}
                    {comps.map((c) => <option key={c} value={c}>{labelMes(c)}</option>)}
                  </Select>
                )}
              </div>
            }
          />
          <CardBody>
            {doMes.length === 0 ? (
              <EmptyState icon={<Clock className="h-6 w-6" />} title="Nada importado ainda" description="Suba o PDF do Cartão Ponto acima para começar." />
            ) : (
              <>
                {/* Dashboard: resumo do mês */}
                <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <StatCard label="Horas extras" value={minParaHora(totExtras)} icon={<Trophy className="h-4 w-4" />} hint={`${agg.comExtra} dia(s) com extra`}
                    onClick={() => alternarFoco("extras")} ativo={foco === "extras"} title="Ver só quem fez hora extra" />
                  <StatCard label="Horas de falta" value={minParaHora(totFaltas)} icon={<CalendarX2 className="h-4 w-4" />} hint="descontam na folha"
                    onClick={() => alternarFoco("faltasHoras")} ativo={foco === "faltasHoras"} title="Ver só quem tem horas de falta (inclui atrasos)" />
                  <StatCard label="Faltas" value={String(agg.faltas)} icon={<AlertTriangle className="h-4 w-4" />} hint="dias de falta (dia cheio)"
                    onClick={() => alternarFoco("faltasDias")} ativo={foco === "faltasDias"} title="Ver só quem faltou dia inteiro" />
                  <StatCard label="Atestados" value={String(agg.atestados)} icon={<Stethoscope className="h-4 w-4" />} hint={agg.abonos ? `+ ${agg.abonos} abono(s)` : "dias com atestado"}
                    onClick={() => alternarFoco("atestados")} ativo={foco === "atestados"} title="Ver só quem apresentou atestado" />
                </div>

                {/* Seletor de visão: Tudo (extrato completo) ou Resumo (p/ enviar) */}
                <div className="mb-4 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  <button type="button" onClick={() => setModo("tudo")}
                    className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition", modo === "tudo" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    <CalendarRange className="h-3.5 w-3.5" /> Tudo
                  </button>
                  <button type="button" onClick={() => setModo("resumo")}
                    className={cn("inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition", modo === "resumo" ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                    <ListChecks className="h-3.5 w-3.5" /> Resumo p/ enviar
                  </button>
                </div>

                {modo === "tudo" ? (
                <>
                {/* Quem não bate ponto: a ficha existe no PDF (com o mês inteiro
                    em faltas), mas fica fora dos totais e do relatório. */}
                {semControle.length > 0 && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Users className="h-4 w-4" /> {semControle.length} sem controle de jornada — fora da apuração
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {semControle.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => setVerMes(p)}
                          title="Ver a ficha deste colaborador"
                          className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:border-brand/40 hover:text-brand"
                        >
                          {nomeColab(p.colaboradorId) || p.nomePdf}
                        </button>
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">
                      Aparecem no PDF do Secullum com o mês inteiro em faltas por não registrarem ponto. Não entram nos totais nem no relatório da contabilidade.
                    </p>
                  </div>
                )}

                {/* Divergência entre a soma dos dias e o total do mês: o relatório
                    vai para a contabilidade, então isso não pode passar calado. */}
                {divergentes.length > 0 && (
                  <div className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-red-800">
                      <AlertTriangle className="h-4 w-4" /> {divergentes.length} ficha(s) com a soma dos dias diferente do total do mês
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-red-700">
                      {divergentes.map(({ p, c }) => (
                        <li key={p.id}>
                          <b>{nomeColab(p.colaboradorId) || p.nomePdf}</b>
                          {c && c.difExtras !== 0 && ` · extras: dias somam ${minParaHora(p.extrasMin + c.difExtras)}, total do mês ${minParaHora(p.extrasMin)}`}
                          {c && c.difFaltas !== 0 && ` · faltas: dias somam ${minParaHora(p.faltasMin + c.difFaltas)}, total do mês ${minParaHora(p.faltasMin)}`}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-[11px] text-red-600/80">Confira antes de enviar: reimporte o PDF do mês ou corrija a ficha à mão.</p>
                  </div>
                )}

                {/* Conferência: quem do cadastro não apareceu no ponto (fora os que não batem) */}
                {faltandoNoPonto.length > 0 && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800"><AlertTriangle className="h-4 w-4" /> {faltandoNoPonto.length} do cadastro não apareceram neste ponto</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {faltandoNoPonto.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setManual({ colaboradorId: c.id, nome: c.nome })}
                          title={`Lançar o ponto de ${c.nome} manualmente`}
                          className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs text-amber-800 transition hover:border-amber-400 hover:bg-amber-50"
                        >
                          <Plus className="h-3 w-3" /> {c.nome}
                        </button>
                      ))}
                    </div>
                    <p className="mt-2 text-[11px] text-amber-600/80">Clique no nome para lançar o ponto dele à mão. Quem não bate ponto (comissão/externo) já ficou fora desta lista — ajuste em "Não batem ponto".</p>
                  </div>
                )}
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs text-slate-400">
                    {foco ? `${visiveis.length} de ${doMes.length}` : `${doMes.length}`} funcionário(s){doMes.filter((p) => !p.colaboradorId).length ? ` · ${doMes.filter((p) => !p.colaboradorId).length} não vinculado(s)` : ""} · clique no nome para o extrato diário.
                  </p>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {idsExpansiveis.length > 0 && (
                      <button className="btn-ghost px-2 py-1 text-xs text-slate-500 hover:text-brand" onClick={alternarTodos}>
                        {todosAbertos ? "Recolher todos" : "Expandir todos"}
                      </button>
                    )}
                    <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => void exportarApuracaoPdf(empresa, competencia, apuracao, novosFuncionarios)} title="Apuração completa, no formato usado pela contabilidade">
                      <FileDown className="h-3.5 w-3.5" /> Apuração PDF
                    </button>
                    <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => exportarApuracaoExcel(empresa, competencia, apuracao, novosFuncionarios)}>
                      <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-100 text-xs text-slate-500">
                      <tr>
                        <th className="th">Colaborador</th>
                        <th className="th text-right">Normais</th>
                        <th className="th text-right">Faltas</th>
                        <th className="th text-center" title="Dias em que faltou o dia inteiro">Dias</th>
                        <th className="th text-right">Extras</th>
                        <th className="th text-right" title="Horas extras menos as horas de falta — o que sobra a favor (+) ou contra (−)">Saldo</th>
                        <th className="th" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {visiveis.length === 0 && (
                        <tr><td colSpan={7} className="td text-center text-slate-400">Ninguém neste filtro — clique no card de novo para ver todos.</td></tr>
                      )}
                      {visiveis.map((p) => {
                        const rd = resumoDias(p.dias);
                        const temDias = (p.dias?.length ?? 0) > 0;
                        const aberto = expandido.has(p.id);
                        return (
                          <Fragment key={p.id}>
                            <tr className={cn(!p.colaboradorId && "bg-amber-50/40", "hover:bg-slate-50/50")}>
                              <td className="td">
                                <div className="flex items-center gap-2">
                                  {temDias
                                    ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleExp(p.id)}
                                        title={aberto ? "Recolher" : "Ver os dias aqui mesmo"}
                                        className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
                                      >
                                        {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                      </button>
                                    )
                                    : <span className="w-4 shrink-0" />}
                                  <div className="min-w-0">
                                    {/* Clicar no NOME abre o mês inteiro em tela cheia. */}
                                    {p.colaboradorId
                                      ? <button type="button" onClick={() => setVerMes(p)} className="text-left font-medium text-slate-700 hover:text-brand hover:underline">{nomeColab(p.colaboradorId)}</button>
                                      : <button type="button" onClick={() => setVerMes(p)} className="text-left text-amber-700 hover:underline">{p.nomePdf} <Badge variant="warning">não vinculado</Badge></button>}
                                    {temDias && (rd.faltas > 0 || rd.atestados > 0 || rd.comExtra > 0) && (
                                      <p className="mt-0.5 text-[11px] text-slate-400">
                                        {[rd.comExtra && `${rd.comExtra} dia(s) c/ extra`, rd.faltas && `${rd.faltas} falta(s)`, rd.atestados && `${rd.atestados} atestado(s)`].filter(Boolean).join(" · ")}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="td text-right tabular-nums text-slate-600">{minParaHora(p.normaisMin)}</td>
                              <td className={`td text-right tabular-nums ${p.faltasMin > 0 ? "font-medium text-red-600" : "text-slate-400"}`}>{minParaHora(p.faltasMin)}</td>
                              <td className={cn("td text-center tabular-nums", rd.faltas > 0 ? "font-medium text-red-600" : "text-slate-300")}>{temDias ? (rd.faltas || "—") : "?"}</td>
                              <td className={`td text-right tabular-nums ${p.extrasMin > 0 ? "font-medium text-brand" : "text-slate-400"}`}>{minParaHora(p.extrasMin)}</td>
                              <td className={cn("td text-right font-semibold tabular-nums", saldoDe(p) > 0 ? "text-green-700" : saldoDe(p) < 0 ? "text-red-600" : "text-slate-400")}>
                                {saldoTxt(saldoDe(p))}
                              </td>
                              <td className="td text-right">
                                <button className="btn-ghost p-1.5 text-red-500" title="Remover" onClick={(e) => { e.stopPropagation(); setExcluir(p.id); }}><Trash2 className="h-4 w-4" /></button>
                              </td>
                            </tr>
                            {aberto && temDias && (
                              <tr>
                                <td colSpan={7} className="bg-slate-50/50 p-0">
                                  <ExtratoDiario
                                    dias={p.dias!}
                                    nome={nomeColab(p.colaboradorId) || p.nomePdf}
                                    ponto={p}
                                    empresa={empresa}
                                    onEditarDia={(dia) => setEditandoDia({ ponto: p, dia })}
                                  />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                    {visiveis.length > 0 && (
                      <tfoot className="border-t-2 border-slate-200 text-sm">
                        <tr>
                          <td className="td font-semibold text-slate-700">Total{foco ? " (filtrado)" : ""}</td>
                          <td className="td text-right font-semibold tabular-nums text-slate-600">{minParaHora(visiveis.reduce((s, p) => s + p.normaisMin, 0))}</td>
                          <td className="td text-right font-semibold tabular-nums text-red-600">{minParaHora(visiveis.reduce((s, p) => s + p.faltasMin, 0))}</td>
                          <td className="td text-center font-semibold tabular-nums text-red-600">{visiveis.reduce((s, p) => s + resumoDias(p.dias).faltas, 0) || "—"}</td>
                          <td className="td text-right font-semibold tabular-nums text-brand">{minParaHora(visiveis.reduce((s, p) => s + p.extrasMin, 0))}</td>
                          {(() => {
                            const t = visiveis.reduce((s, p) => s + saldoDe(p), 0);
                            return <td className={cn("td text-right font-bold tabular-nums", t > 0 ? "text-green-700" : t < 0 ? "text-red-600" : "text-slate-400")}>{saldoTxt(t)}</td>;
                          })()}
                          <td className="td" />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
                </>
                ) : (
                  resumoLinhas.length === 0 ? (
                    <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="Sem ocorrências no mês" description="Ninguém teve hora extra, falta ou atestado nesta competência." />
                  ) : (
                    <>
                      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-slate-500">{resumoLinhas.length} colaborador(es) com ocorrências em {labelMes(competencia)} · pronto para enviar.</p>
                        <div className="flex flex-wrap gap-2">
                          <button className="btn-outline" onClick={copiarResumo}><Copy className="h-4 w-4" /> Copiar p/ WhatsApp</button>
                          <button className="btn-outline" onClick={() => void exportarResumoPdf(empresa, competencia, resumoLinhas)}><FileDown className="h-4 w-4" /> PDF</button>
                          <button className="btn-outline" onClick={() => exportarResumoExcel(empresa, competencia, resumoLinhas)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-100 text-xs text-slate-500">
                            <tr>
                              <th className="th">Colaborador</th>
                              <th className="th text-right">Horas extras</th>
                              <th className="th text-right">Faltas</th>
                              <th className="th text-right">Atestados</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {resumoLinhas.map((r, i) => (
                              <tr key={`${r.nome}-${i}`} className="hover:bg-slate-50/50">
                                <td className="td align-top font-medium text-slate-700">{r.nome}</td>
                                <td className="td align-top text-right">
                                  {r.extrasMin > 0 ? (
                                    <>
                                      <div className="font-medium tabular-nums text-brand">{minParaHora(r.extrasMin)}</div>
                                      {r.extras.length > 0 && <div className="text-[11px] text-slate-400">{r.extras.map((x) => `${diaCurto(x.data)} (${minParaHora(x.extrasMin)})`).join(", ")}</div>}
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="td align-top text-right">
                                  {r.faltasMin > 0 ? (
                                    <>
                                      <div className="font-medium tabular-nums text-red-600">{minParaHora(r.faltasMin)}{r.faltasDias.length ? ` · ${r.faltasDias.length}d` : ""}</div>
                                      <div className="text-[11px] text-slate-400">{faltasDetalhe(r)}</div>
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                                <td className="td align-top text-right">
                                  {r.atestados.length ? (
                                    <>
                                      <div className="font-medium tabular-nums text-blue-600">{r.atestados.length}d</div>
                                      <div className="text-[11px] text-slate-400">{r.atestados.map((x) => diaCurto(x.data)).join(", ")}</div>
                                    </>
                                  ) : <span className="text-slate-300">—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="border-t border-slate-200 text-sm">
                            <tr>
                              <td className="td font-semibold text-slate-700">Total do mês</td>
                              <td className="td text-right font-bold tabular-nums text-brand">{minParaHora(totResumo.extrasMin)}</td>
                              <td className="td text-right font-bold tabular-nums text-red-600">{minParaHora(totResumo.faltasMin)}</td>
                              <td className="td text-right font-bold tabular-nums text-blue-600">{totResumo.atestados}d</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )
                )}

                {/* Legenda / explicação — só no modo Tudo (o resumo não usa os selos de situação) */}
                {modo === "tudo" && (
                <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Info className="h-3.5 w-3.5" /> Como ler o extrato</p>
                  <div className="grid gap-x-6 gap-y-1.5 text-xs text-slate-500 sm:grid-cols-2">
                    {SIT_LEGENDA.map(({ s, txt }) => (
                      <div key={s} className="flex items-center gap-2">
                        <span className="shrink-0"><Badge variant={SIT_BADGE[s]}>{SIT_LABEL[s]}</Badge></span>
                        <span>{txt}</span>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    As horas <b>Normais</b>, <b>Faltas</b> e <b>Extras</b> já vêm calculadas pelo Secullum (regras da CLT) — não recalculamos, para não divergir da folha legal.
                    {/* Só afirma que confere depois de conferir de verdade. */}
                    {comDetalhe > 0 && divergentes.length === 0 && ` Conferido: em ${comDetalhe} ficha(s), a soma dos dias fecha com o total do mês.`}
                  </p>
                </div>
                )}
              </>
            )}
          </CardBody>
        </Card>
      )}

      <ConfirmDialog
        aberto={excluir != null}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => { if (excluir) { remover(excluir); toast("Ponto removido."); } setExcluir(null); }}
        titulo="Remover ponto do mês?"
        mensagem="O ponto importado deste colaborador nesta competência será apagado. Para recuperar, é preciso reimportar o PDF do mês."
      />

      {gerNaoBate && (
        <NaoBatePontoModal
          colaboradores={d.colaboradores}
          cargoDe={(c) => d.nomeCargo(c) || c.cargoLivre || "—"}
          onToggle={(id, valor) => atualizarColab(id, { naoBatePonto: valor })}
          onFechar={() => setGerNaoBate(false)}
        />
      )}

      {manual && (
        <ModalPontoManual
          competencia={competencia}
          colaboradores={d.colaboradores.filter((c) => c.statusId !== "inativo")}
          inicial={manual}
          existente={manual.existente}
          onFechar={() => setManual(null)}
          onSalvar={(rec) => {
            if (pontos.some((p) => p.id === rec.id)) atualizar(rec.id, rec); else criar(rec);
            toast(`Ponto de ${rec.nomePdf} salvo em ${labelMes(rec.competencia)}.`);
          }}
        />
      )}

      {editandoDia && (
        <ModalEditarDia
          ponto={editandoDia.ponto}
          dia={editandoDia.dia}
          nome={nomeColab(editandoDia.ponto.colaboradorId) || editandoDia.ponto.nomePdf}
          onFechar={() => setEditandoDia(null)}
          onSalvar={(patch) => {
            atualizar(editandoDia.ponto.id, patch);
            toast(`Dia ${diaCurto(editandoDia.dia.data)} corrigido.`);
          }}
        />
      )}

      {verMes && (
        <ModalMesColaborador
          ponto={verMes}
          nome={nomeColab(verMes.colaboradorId) || verMes.nomePdf}
          salario={verMes.colaboradorId ? (d.colabById.get(verMes.colaboradorId)?.salario ?? null) : null}
          empresa={empresa}
          onEditar={() => { setManual({ colaboradorId: verMes.colaboradorId, nome: verMes.nomePdf, existente: verMes }); setVerMes(null); }}
          onFechar={() => setVerMes(null)}
        />
      )}
    </div>
  );
}

// Modal para marcar quem NÃO bate ponto (comissão/externo/direção) — fica fora da
// conferência do ponto. Grava o flag no cadastro do colaborador.
function NaoBatePontoModal({
  colaboradores, cargoDe, onToggle, onFechar,
}: {
  colaboradores: Colaborador[];
  cargoDe: (c: Colaborador) => string;
  onToggle: (id: string, valor: boolean) => void;
  onFechar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return colaboradores
      .filter((c) => !c.ehDirecao && c.statusId !== "inativo")
      .filter((c) => (t ? c.nome.toLowerCase().includes(t) : true))
      .sort((a, b) => Number(!!b.naoBatePonto) - Number(!!a.naoBatePonto) || a.nome.localeCompare(b.nome));
  }, [colaboradores, busca]);
  const marcados = colaboradores.filter((c) => c.naoBatePonto).length;

  return (
    <Modal aberto onFechar={onFechar} titulo="Quem não bate ponto" descricao="Marque quem não registra ponto (comissão, externo, direção). Fica fora da conferência do ponto do mês." largura="max-w-lg">
      <div className="space-y-3">
        <Input placeholder="Buscar colaborador…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <p className="text-xs text-slate-500">{marcados} marcado(s) como “não bate ponto”.</p>
        <div className="max-h-[55vh] space-y-0.5 overflow-y-auto pr-1">
          {lista.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-slate-50">
              <input
                type="checkbox"
                checked={!!c.naoBatePonto}
                onChange={(e) => onToggle(c.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
              />
              <span className="min-w-0">
                <span className="block truncate text-sm text-slate-700">{c.nome}</span>
                {/* O cargo ajuda a decidir quem marcar — a escolha é sempre à mão. */}
                <span className="block truncate text-[11px] text-slate-400">{cargoDe(c)}</span>
              </span>
            </label>
          ))}
          {lista.length === 0 && <p className="px-2 py-4 text-center text-sm text-slate-400">Ninguém encontrado.</p>}
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================================
// APURAÇÃO DO MÊS — o relatório que vai para a contabilidade, no mesmo formato da
// planilha usada hoje (APURACAO_PONTO): horas, o que pagar/descontar em R$, os
// dias exatos de falta e de atestado, e os novos funcionários no rodapé.
// =====================================================================================

// "23/07, 24/07 e 27/07" — como se escreve à mão. Vazio vira "0", igual à planilha.
function listaDatas(dias: PontoDia[]): string {
  const ds = dias.map((x) => diaCurto(x.data));
  if (!ds.length) return "0";
  if (ds.length === 1) return ds[0];
  return `${ds.slice(0, -1).join(", ")} e ${ds[ds.length - 1]}`;
}

// Separa o que é falta de DIA INTEIRO do que é atraso, e colhe os feriados que o
// próprio PDF trouxe — os dois entram no cálculo do desconto (dia = 1/30).
export function decomporFaltas(p: { dias?: PontoDia[]; faltasMin: number }) {
  const dias = p.dias ?? [];
  const cheios = dias.filter((x) => x.situacao === "falta");
  const minCheios = cheios.reduce((s, x) => s + (x.faltasMin || 0), 0);
  return {
    diasCheios: cheios.length,
    // O que sobra do total do mês são atrasos/saídas antecipadas em dias normais.
    minutosAtraso: Math.max(0, (p.faltasMin || 0) - minCheios),
    feriadosISO: dias.filter((x) => x.situacao === "feriado").map((x) => x.data),
    temDetalhe: dias.length > 0,
  };
}

interface LinhaApuracao {
  nome: string;
  faltasTxt: string;   // HH:MM
  extrasTxt: string;   // HH:MM
  diasFaltas: string;
  atestados: string;
  complementares: string;
  semDetalhe: boolean; // ponto sem o dia a dia: não afirmar "0" dias
}

function montarApuracao(pontos: Ponto[], nomeDe: (p: Ponto) => string): LinhaApuracao[] {
  return pontos.map((p) => {
    const dias = p.dias ?? [];
    const temDetalhe = dias.length > 0;
    const faltasDias = dias.filter((x) => x.situacao === "falta");
    const atestados = dias.filter((x) => x.situacao === "atestado");
    const ferias = dias.filter((x) => x.situacao === "ferias");
    const abonos = dias.filter((x) => x.situacao === "abono");
    const compl: string[] = [];
    if (ferias.length) compl.push(`Férias: ${listaDatas(ferias)}`);
    if (abonos.length) compl.push(`Abono: ${listaDatas(abonos)}`);
    if (!p.colaboradorId) compl.push("Não vinculado ao cadastro");
    if (!temDetalhe && (p.faltasMin > 0 || p.extrasMin > 0)) compl.push("Sem detalhe diário — reimportar o PDF do mês para ter as datas");
    // Falta acima de ~1/3 do mês quase sempre é afastamento (INSS, licença) e
    // não falta a descontar: avisa em vez de deixar passar como falta comum.
    if (p.faltasMin > 60 * 60) compl.push(`CONFERIR: ${minParaHora(p.faltasMin)} de falta — parece afastamento, não desconto`);
    return {
      nome: nomeDe(p),
      faltasTxt: minParaHora(p.faltasMin),
      extrasTxt: minParaHora(p.extrasMin),
      // Sem o dia a dia não dá para afirmar "0": seria dizer que não houve falta
      // quando a verdade é que o dado não existe.
      diasFaltas: temDetalhe ? listaDatas(faltasDias) : "(sem detalhe)",
      atestados: temDetalhe ? listaDatas(atestados) : "(sem detalhe)",
      complementares: compl.join(" · "),
      semDetalhe: !temDetalhe,
    };
  });
}

// Só HORAS: os valores em R$ ficam na tela, para o RH se planejar. O que vai à
// contabilidade é o fato apurado pelo Secullum — quem fecha a folha é o
// escritório contábil (decisão do usuário em 31/07/2026).
const CABECALHO_APURACAO = [
  "COLABORADOR", "HORAS FALTAS", "H.E", "DIAS FALTAS", "ATESTADO", "INFORMAÇÕES COMPLEMENTARES",
];

async function exportarApuracaoPdf(empresa: string, competencia: string, linhas: LinhaApuracao[], novos: string[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ orientation: "landscape" });
  const marinho: [number, number, number] = [22, 51, 79];
  doc.setFontSize(15); doc.setTextColor(...marinho); doc.text(empresa, 14, 15);
  doc.setFontSize(12); doc.setTextColor(60); doc.text(`Apuração de ponto — ${labelMes(competencia)}`, 14, 22);
  doc.setFontSize(8); doc.setTextColor(120);
  doc.text("Horas apuradas pelo Secullum, conforme a CLT. Documento de conferência — o fechamento da folha é feito pela contabilidade.", 14, 27);

  autoTable(doc, {
    startY: 31,
    head: [CABECALHO_APURACAO],
    body: linhas.map((l) => [l.nome, l.faltasTxt, l.extrasTxt, l.diasFaltas, l.atestados, l.complementares]),
    headStyles: { fillColor: marinho, fontSize: 7 },
    styles: { fontSize: 7.5, cellPadding: 1.5, valign: "middle" },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: "bold" },
      1: { halign: "center", cellWidth: 22 },
      2: { halign: "center", cellWidth: 20 },
      3: { cellWidth: 58 },
      4: { cellWidth: 58 },
    },
    // Sem o detalhe diário a linha fica destacada: é dado faltando, não "zero".
    didParseCell: (data) => {
      if (data.section === "body" && linhas[data.row.index]?.semDetalhe) {
        data.cell.styles.fillColor = [254, 243, 199];
      }
    },
  });

  // Rodapé com quebra de página: antes, os nomes que passavam do fim da folha
  // simplesmente sumiam do PDF, sem erro nem aviso.
  const alturaPagina = doc.internal.pageSize.getHeight();
  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60) + 8;
  const cabeNaPagina = (altura: number) => {
    if (y + altura > alturaPagina - 14) { doc.addPage(); y = 20; }
  };
  if (novos.length) {
    cabeNaPagina(12);
    doc.setFontSize(10); doc.setTextColor(...marinho);
    doc.text("Novos Funcionários", 14, y);
    y += 6;
    doc.setFontSize(9); doc.setTextColor(60);
    for (const n of novos) { cabeNaPagina(5); doc.text(n, 16, y); y += 5; }
  }
  cabeNaPagina(10);
  doc.setFontSize(8); doc.setTextColor(130);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR")} · ${linhas.length} colaborador(es)`, 14, y + 4);
  baixarBlob(`apuracao-ponto-${competencia || "sem-competencia"}.pdf`, doc.output("blob"));
}

function exportarApuracaoExcel(empresa: string, competencia: string, linhas: LinhaApuracao[], novos: string[]) {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const nc = CABECALHO_APURACAO.length;
  const corpo = linhas.map((l) =>
    `<tr${l.semDetalhe ? ' style="background:#fef3c7"' : ""}><td>${esc(l.nome)}</td><td>${esc(l.faltasTxt)}</td><td>${esc(l.extrasTxt)}</td><td>${esc(l.diasFaltas)}</td><td>${esc(l.atestados)}</td><td>${esc(l.complementares)}</td></tr>`,
  ).join("");
  const rodape = novos.length
    ? `<tr></tr><tr><td colspan="${nc}" style="font-weight:bold">Novos Funcionários</td></tr>${novos.map((n) => `<tr><td>${esc(n)}</td></tr>`).join("")}`
    : "";
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1">
<tr><td colspan="${nc}" style="font-weight:bold;font-size:14px">${esc(empresa)} — Apuração de ponto — ${labelMes(competencia)}</td></tr>
<tr><td colspan="${nc}" style="font-size:11px;color:#555">Horas apuradas pelo Secullum, conforme a CLT. Documento de conferência — o fechamento da folha é feito pela contabilidade.</td></tr>
<tr style="background:#16334f;color:#fff;font-weight:bold">${CABECALHO_APURACAO.map((h) => `<td>${h}</td>`).join("")}</tr>
${corpo || `<tr><td colspan="${nc}">Sem dados</td></tr>`}
${rodape}
</table></body></html>`;
  baixarBlob(`apuracao-ponto-${competencia || "sem-competencia"}.xls`, new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}

// Lançamento MANUAL de ponto: para quem não veio no PDF (contratado no meio do
// mês, quem esqueceu de bater) ou para corrigir alguém. Aceita os dois jeitos:
// digitar só os TOTAIS do mês e, se quiser, detalhar DIA A DIA por cima.
function ModalPontoManual({
  competencia, colaboradores, inicial, existente, onSalvar, onFechar,
}: {
  competencia: string;
  colaboradores: Colaborador[];
  inicial?: { colaboradorId?: string | null; nome?: string };
  existente?: Ponto | null;
  onSalvar: (rec: Ponto) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState(inicial?.colaboradorId ?? existente?.colaboradorId ?? "");
  const [nomeLivre, setNomeLivre] = useState(existente?.nomePdf ?? inicial?.nome ?? "");
  const [normais, setNormais] = useState(existente ? minParaHora(existente.normaisMin) : "");
  const [faltas, setFaltas] = useState(existente ? minParaHora(existente.faltasMin) : "");
  const [extras, setExtras] = useState(existente ? minParaHora(existente.extrasMin) : "");
  const [dias, setDias] = useState<PontoDia[]>(existente?.dias ? [...existente.dias] : []);
  const [novoDia, setNovoDia] = useState("");
  const [novaSit, setNovaSit] = useState<SituacaoDia>("falta");
  const [novaHora, setNovaHora] = useState("");

  const addDia = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novoDia)) { toast("Escolha a data do dia.", "erro"); return; }
    if (dias.some((x) => x.data === novoDia)) { toast("Esse dia já está na lista.", "erro"); return; }
    const min = horaParaMin(novaHora);
    const dia: PontoDia = {
      data: novoDia,
      situacao: novaSit,
      marcacoes: [],
      normaisMin: 0,
      // "normal" com hora informada = hora extra do dia; falta/atraso = horas de falta.
      extrasMin: novaSit === "normal" ? min : 0,
      faltasMin: novaSit === "falta" ? min : 0,
    };
    setDias([...dias, dia].sort((a, b) => a.data.localeCompare(b.data)));
    setNovoDia(""); setNovaHora("");
  };

  // Soma dos dias detalhados — serve para conferir/preencher os totais.
  const somaDias = useMemo(() => ({
    extras: dias.reduce((s, x) => s + (x.extrasMin || 0), 0),
    faltas: dias.reduce((s, x) => s + (x.faltasMin || 0), 0),
  }), [dias]);

  const usarSomaDosDias = () => {
    setExtras(minParaHora(somaDias.extras));
    setFaltas(minParaHora(somaDias.faltas));
    toast("Totais preenchidos com a soma dos dias.");
  };

  // "8" ou "8h" viravam 00:00 em silêncio — num campo de horas isso é desconto
  // ou pagamento errado. Vazio é permitido (= zero); escrito torto, não.
  const horaValida = (v: string) => v.trim() === "" || /^\d{1,3}:[0-5]\d$/.test(v.trim());

  const salvar = () => {
    const nome = colaboradorId ? (colaboradores.find((c) => c.id === colaboradorId)?.nome ?? "") : nomeLivre.trim();
    if (!colaboradorId && !nome) { toast("Escolha o colaborador ou digite um nome.", "erro"); return; }
    if (!/^\d{4}-\d{2}$/.test(competencia)) { toast("Escolha a competência (mês/ano) antes.", "erro"); return; }
    const ruim = [["Horas normais", normais], ["Horas de falta", faltas], ["Horas extras", extras]].find(([, v]) => !horaValida(String(v)));
    if (ruim) { toast(`${ruim[0]}: use o formato horas:minutos, como 08:30.`, "erro"); return; }
    // Totais e dias são digitados separados; se brigarem, o relatório sairia
    // contradizendo o extrato. Avisa antes de gravar.
    if (dias.length > 0) {
      const difE = somaDias.extras - horaParaMin(extras);
      const difF = somaDias.faltas - horaParaMin(faltas);
      if (Math.abs(difE) > 1 || Math.abs(difF) > 1) {
        const ok = window.confirm(
          `Os totais não batem com os dias lançados:\n\n` +
          `Extras — total ${minParaHora(horaParaMin(extras))} · dias somam ${minParaHora(somaDias.extras)}\n` +
          `Faltas — total ${minParaHora(horaParaMin(faltas))} · dias somam ${minParaHora(somaDias.faltas)}\n\n` +
          `Salvar assim mesmo? (o botão "Usar a soma dos dias nos totais" acerta isso)`,
        );
        if (!ok) return;
      }
    }
    const agora = new Date().toISOString();
    const chave = colaboradorId || `pdf-${slug(nome)}`;
    onSalvar({
      id: existente?.id ?? `${competencia}::${chave}`,
      competencia,
      colaboradorId: colaboradorId || null,
      nomePdf: nome,
      normaisMin: horaParaMin(normais),
      faltasMin: horaParaMin(faltas),
      extrasMin: horaParaMin(extras),
      dias: dias.length ? dias : undefined,
      periodoInicio: existente?.periodoInicio ?? null,
      periodoFim: existente?.periodoFim ?? null,
      importadoEm: existente?.importadoEm ?? agora,
      atualizadoEm: agora,
    });
    onFechar();
  };

  const SITS: SituacaoDia[] = ["falta", "atestado", "abono", "normal", "feriado", "ferias", "folga"];

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={existente ? "Editar ponto do mês" : "Lançar ponto manualmente"}
      descricao={`${labelMes(competencia)} · digite os totais e, se quiser, detalhe os dias`}
      largura="max-w-3xl"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}><CheckCircle2 className="h-4 w-4" /> Salvar</button></>}
    >
      <div className="space-y-4">
        <Campo label="Colaborador" obrigatorio>
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)} disabled={!!existente?.colaboradorId}>
            <option value="">— digitar um nome (não está no cadastro) —</option>
            {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Campo>
        {!colaboradorId && (
          <Campo label="Nome" hint="Use quando a pessoa ainda não está no cadastro">
            <Input value={nomeLivre} onChange={(e) => setNomeLivre(e.target.value)} placeholder="Ex.: Guilherme Pereira Dias" />
          </Campo>
        )}

        {/* Totais do mês */}
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Totais do mês (formato horas:minutos)</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Horas normais"><Input value={normais} onChange={(e) => setNormais(e.target.value)} placeholder="184:00" /></Campo>
            <Campo label="Horas de falta"><Input value={faltas} onChange={(e) => setFaltas(e.target.value)} placeholder="00:00" /></Campo>
            <Campo label="Horas extras"><Input value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="00:00" /></Campo>
          </div>
        </div>

        {/* Detalhe dia a dia (opcional) */}
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold text-slate-600">Dias (opcional) — marque faltas, atestados e dias com extra</p>
            {dias.length > 0 && (
              <button className="btn-ghost px-2 py-1 text-[11px] text-slate-500 hover:text-brand" onClick={usarSomaDosDias}>
                Usar a soma dos dias nos totais (extras {minParaHora(somaDias.extras)} · faltas {minParaHora(somaDias.faltas)})
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Campo label="Dia" className="w-40"><Input type="date" value={novoDia} onChange={(e) => setNovoDia(e.target.value)} /></Campo>
            <Campo label="Situação" className="w-40">
              <Select value={novaSit} onChange={(e) => setNovaSit(e.target.value as SituacaoDia)}>
                {SITS.map((s) => <option key={s} value={s}>{SIT_LABEL[s]}</option>)}
              </Select>
            </Campo>
            <Campo label={novaSit === "normal" ? "Horas extras" : novaSit === "falta" ? "Horas de falta" : "Horas"} className="w-32">
              <Input value={novaHora} onChange={(e) => setNovaHora(e.target.value)} placeholder="00:00" />
            </Campo>
            <button className="btn-outline mb-0.5" onClick={addDia}><Plus className="h-4 w-4" /> Adicionar</button>
          </div>

          {dias.length > 0 && (
            <div className="mt-3 max-h-60 overflow-y-auto rounded-lg border border-slate-100">
              <table className="w-full text-xs">
                <tbody className="divide-y divide-slate-50">
                  {dias.map((x) => (
                    <tr key={x.data}>
                      <td className="td tabular-nums text-slate-700">{diaCurto(x.data)}</td>
                      <td className="td"><Badge variant={SIT_BADGE[x.situacao]}>{SIT_LABEL[x.situacao]}</Badge></td>
                      <td className="td text-right tabular-nums text-slate-500">
                        {x.extrasMin ? `+${minParaHora(x.extrasMin)}` : x.faltasMin ? `-${minParaHora(x.faltasMin)}` : "—"}
                      </td>
                      <td className="td text-right">
                        <button className="btn-ghost p-1 text-red-500" onClick={() => setDias(dias.filter((y) => y.data !== x.data))}><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// MÊS INTEIRO de um colaborador, em tela cheia: todos os dias do período (com as
// lacunas visíveis), o que isso vale em dinheiro e o extrato completo.
function ModalMesColaborador({
  ponto, nome, salario, empresa, onEditar, onFechar,
}: {
  ponto: Ponto;
  nome: string;
  salario: number | null;
  empresa: string;
  onEditar: () => void;
  onFechar: () => void;
}) {
  const temDetalhe = (ponto.dias?.length ?? 0) > 0;
  const dias = useMemo(() => diasCompletos(ponto), [ponto]);
  const rd = resumoDias(ponto.dias);
  const he = calcularHoraExtra({ salario, minutos: ponto.extrasMin });
  // Dia inteiro vale 1/30; atraso vale por hora. Os feriados vêm do próprio PDF
  // e entram como repouso no reflexo de DSR.
  const dec = decomporFaltas(ponto);
  const fl = calcularFalta({
    salario, competencia: ponto.competencia,
    diasCheios: dec.diasCheios, minutosAtraso: dec.minutosAtraso, feriadosISO: dec.feriadosISO,
  });
  const semSalario = he.semSalario;

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={nome}
      descricao={`Ponto de ${labelMes(ponto.competencia)}${ponto.periodoInicio ? ` · período ${diaData(ponto.periodoInicio)} a ${diaData(ponto.periodoFim)}` : ""}`}
      largura="max-w-5xl"
    >
      <div className="space-y-4">
        {/* Totais do mês */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Horas normais" value={minParaHora(ponto.normaisMin)} icon={<Clock className="h-4 w-4" />} />
          <StatCard label="Horas extras" value={minParaHora(ponto.extrasMin)} icon={<Trophy className="h-4 w-4" />} accent="brand" hint={`${rd.comExtra} dia(s)`} />
          <StatCard label="Horas de falta" value={minParaHora(ponto.faltasMin)} icon={<CalendarX2 className="h-4 w-4" />} accent="red" hint={`${rd.faltas} falta(s) de dia cheio`} />
          <StatCard label="Atestados" value={`${rd.atestados}d`} icon={<Stethoscope className="h-4 w-4" />} accent="blue" hint={rd.abonos ? `+ ${rd.abonos} abono(s)` : "sem desconto"} />
        </div>

        {/* O que isso vale em dinheiro */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Coins className="h-3.5 w-3.5" /> Reflexo na folha (sugestão — o RH confirma antes de pagar)</p>
          {semSalario ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Sem salário no cadastro deste colaborador — preencha em Colaboradores para o sistema calcular os valores.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Horas extras a pagar</p>
                <p className="text-lg font-semibold tabular-nums text-brand-ink">{formatBRL(he.valor)}</p>
                <p className="text-[11px] text-slate-400">{horasDecimais(ponto.extrasMin)} h × {formatBRL(he.valorHoraExtra)} (hora de {formatBRL(he.valorHoraNormal)} +50%)</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <p className="text-xs text-slate-500">Faltas a descontar</p>
                <p className="text-lg font-semibold tabular-nums text-red-600">{formatBRL(fl.total)}</p>
                <p className="text-[11px] text-slate-400">
                  {fl.diasCheios > 0 && <>{fl.diasCheios} dia(s) × {formatBRL(fl.valorDia)} (1/30) </>}
                  {fl.minutosAtraso > 0 && <>{fl.diasCheios > 0 ? "+ " : ""}{minParaHora(fl.minutosAtraso)} de atraso = {formatBRL(fl.valorAtrasos)} </>}
                  {fl.dsr > 0 && <>+ {formatBRL(fl.dsr)} de DSR ({fl.diasRepouso} de repouso ÷ {fl.diasUteis} úteis)</>}
                  {fl.total === 0 && "sem desconto"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Mês inteiro, dia a dia */}
        <div>
          {/* Ponto importado antes do detalhe diário existir: só tem os totais.
              Avisa em vez de mostrar o mês inteiro como "sem registro", que
              parece dado perdido. */}
          {!temDetalhe && (
            <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                <AlertTriangle className="h-4 w-4" /> Este ponto não tem o detalhe dia a dia
              </p>
              <p className="mt-1 text-xs text-amber-700">
                Ele foi importado antes de o extrato diário existir, então só ficaram os totais do mês (que estão certos e continuam valendo).
                Para ver os dias, <b>suba o PDF do ponto de {labelMes(ponto.competencia)} outra vez</b> — a reimportação atualiza todo mundo de uma vez, sem duplicar.
              </p>
            </div>
          )}
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{temDetalhe ? `${dias.length} dia(s) do período · lacunas aparecem como “sem registro”.` : "Totais do mês (sem o dia a dia)."}</p>
            <div className="flex gap-2">
              <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={onEditar}>
                <Pencil className="h-3.5 w-3.5" /> Corrigir
              </button>
              <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => void exportarMesPdf(empresa, nome, ponto, dias, rd)}>
                <FileDown className="h-3.5 w-3.5" /> PDF deste colaborador
              </button>
            </div>
          </div>
          <ExtratoDiario dias={dias} />
        </div>

        <p className="text-[11px] leading-relaxed text-slate-400">
          Horas <b>Normais</b>, <b>Faltas</b> e <b>Extras</b> vêm calculadas pelo Secullum (CLT) — não recalculamos, para não divergir da folha legal. Atestado e abono não geram desconto.
        </p>
      </div>
    </Modal>
  );
}

// PDF de um colaborador: o mês inteiro, dia a dia. Só horas — o fechamento em
// R$ é da contabilidade; os valores ficam na tela, para o RH se planejar.
async function exportarMesPdf(
  empresa: string, nome: string, ponto: Ponto, dias: PontoDia[],
  rd: ReturnType<typeof resumoDias>,
) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const marinho: [number, number, number] = [22, 51, 79];
  doc.setFontSize(15); doc.setTextColor(...marinho); doc.text(empresa, 14, 16);
  doc.setFontSize(12); doc.setTextColor(60); doc.text(`Cartão ponto — ${labelMes(ponto.competencia)}`, 14, 24);
  doc.setFontSize(11); doc.setTextColor(20); doc.text(nome, 14, 32);
  doc.setFontSize(9); doc.setTextColor(110);
  doc.text(`Normais ${minParaHora(ponto.normaisMin)}  ·  Extras ${minParaHora(ponto.extrasMin)}  ·  Faltas ${minParaHora(ponto.faltasMin)}`, 14, 38);
  // Só horas, como na apuração: o fechamento em R$ é da contabilidade.
  doc.text(`${rd.faltas} dia(s) de falta  ·  ${rd.atestados} dia(s) de atestado  ·  ${rd.comExtra} dia(s) com hora extra`, 14, 43);
  autoTable(doc, {
    startY: 48,
    head: [["Dia", "Batidas", "Normais", "Faltas", "Extras", "Situação"]],
    body: dias.map((x) => [
      `${diaCurto(x.data)}${x.diaSemana ? ` ${x.diaSemana}` : ""}`,
      (x.marcacoes ?? []).filter((mm) => /^\d{1,2}:\d{2}$/.test(mm)).join("  ") || "—",
      x.normaisMin ? minParaHora(x.normaisMin) : "—",
      x.faltasMin ? minParaHora(x.faltasMin) : "—",
      x.extrasMin ? minParaHora(x.extrasMin) : "—",
      x.situacao === "normal" ? "" : SIT_LABEL[x.situacao],
    ]),
    headStyles: { fillColor: marinho },
    styles: { fontSize: 8, cellPadding: 1.5 },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
  });
  baixarBlob(`ponto-${slug(nome)}-${ponto.competencia}.pdf`, doc.output("blob"));
}

// Extrato diário de um colaborador — segue o layout da folha de ponto do Secullum.
// Com `ponto`/`nome` ganha barra de exportação individual; com `onEditarDia`,
// cada linha vira editável.
function ExtratoDiario({
  dias, nome, ponto, empresa, onEditarDia,
}: {
  dias: PontoDia[];
  nome?: string;
  ponto?: Ponto;
  empresa?: string;
  onEditarDia?: (dia: PontoDia) => void;
}) {
  const tot = dias.reduce(
    (s, d) => ({
      normais: s.normais + (d.normaisMin || 0),
      faltas: s.faltas + (d.faltasMin || 0),
      extras: s.extras + (d.extrasMin || 0),
      diasFalta: s.diasFalta + (d.situacao === "falta" ? 1 : 0),
    }),
    { normais: 0, faltas: 0, extras: 0, diasFalta: 0 },
  );
  const saldo = tot.extras - tot.faltas;

  return (
    <div className="px-3 py-3 sm:px-4">
      {/* Exportar SÓ este colaborador, sem sair da lista. */}
      {ponto && nome && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-slate-400">
            {tot.diasFalta > 0 && <>{tot.diasFalta} dia(s) de falta · </>}
            saldo do mês <b className={cn(saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-slate-500")}>{saldoTxt(saldo)}</b>
            {onEditarDia && " · clique no lápis para corrigir um dia"}
          </p>
          <div className="flex gap-2">
            <button className="btn-outline h-7 px-2.5 py-0 text-[11px]" onClick={() => void exportarMesPdf(empresa || "Impresilk", nome, ponto, dias, resumoDias(ponto.dias))}>
              <FileDown className="h-3 w-3" /> PDF de {nome.split(" ")[0]}
            </button>
            <button className="btn-outline h-7 px-2.5 py-0 text-[11px]" onClick={() => exportarMesExcel(empresa || "Impresilk", nome, ponto, dias)}>
              <FileSpreadsheet className="h-3 w-3" /> Excel
            </button>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="th">Dia</th>
              <th className="th">Batidas</th>
              <th className="th text-right">Normais</th>
              <th className="th text-right">Faltas</th>
              <th className="th text-right">Extras</th>
              <th className="th">Situação</th>
              {onEditarDia && <th className="th" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {dias.map((dia) => {
              const batidas = (dia.marcacoes ?? []).filter((m) => /^\d{1,2}:\d{2}$/.test(m));
              return (
              <tr
                key={dia.data}
                className={cn(
                  dia.extrasMin > 0 && "bg-brand/[0.04]",
                  dia.situacao === "falta" && "bg-red-50/60",
                  dia.situacao === "atestado" && "bg-blue-50/40",
                )}
              >
                <td className="td whitespace-nowrap">
                  <span className="font-medium tabular-nums text-slate-700">{diaCurto(dia.data)}</span>
                  {dia.diaSemana && <span className="ml-1 text-slate-400">{dia.diaSemana}</span>}
                </td>
                <td className="td tabular-nums text-slate-500">{batidas.length ? batidas.join(" · ") : "—"}</td>
                <td className="td text-right tabular-nums text-slate-500">{dia.normaisMin ? minParaHora(dia.normaisMin) : "—"}</td>
                <td className={cn("td text-right tabular-nums", dia.faltasMin > 0 ? "font-medium text-red-600" : "text-slate-300")}>{dia.faltasMin ? minParaHora(dia.faltasMin) : "—"}</td>
                <td className={cn("td text-right tabular-nums", dia.extrasMin > 0 ? "font-medium text-brand" : "text-slate-300")}>{dia.extrasMin ? minParaHora(dia.extrasMin) : "—"}</td>
                <td className="td">{dia.situacao !== "normal" && <Badge variant={SIT_BADGE[dia.situacao]}>{SIT_LABEL[dia.situacao]}</Badge>}</td>
                {onEditarDia && (
                  <td className="td text-right">
                    <button
                      className="btn-ghost p-1 text-slate-300 transition hover:text-brand"
                      title={`Corrigir ${diaCurto(dia.data)}`}
                      onClick={() => onEditarDia(dia)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                )}
              </tr>
              );
            })}
          </tbody>
          {/* Totais do extrato, com o saldo do mês (extras abatendo faltas). */}
          <tfoot className="border-t-2 border-slate-200 bg-slate-50/60 text-[11px]">
            <tr>
              <td className="td font-semibold text-slate-600">Total</td>
              <td className="td text-slate-400">{tot.diasFalta > 0 ? `${tot.diasFalta} dia(s) de falta` : ""}</td>
              <td className="td text-right font-semibold tabular-nums text-slate-600">{minParaHora(tot.normais)}</td>
              <td className="td text-right font-semibold tabular-nums text-red-600">{tot.faltas ? minParaHora(tot.faltas) : "—"}</td>
              <td className="td text-right font-semibold tabular-nums text-brand">{tot.extras ? minParaHora(tot.extras) : "—"}</td>
              <td className="td" colSpan={onEditarDia ? 2 : 1}>
                <span className="text-slate-400">saldo </span>
                <b className={cn("tabular-nums", saldo > 0 ? "text-green-700" : saldo < 0 ? "text-red-600" : "text-slate-500")}>{saldoTxt(saldo)}</b>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Correção de UM dia do extrato, direto na tela. Ao salvar, os totais do mês são
// refeitos a partir dos dias — assim a ficha nunca fica dizendo uma coisa no
// total e outra no dia a dia.
function ModalEditarDia({
  ponto, dia, nome, onSalvar, onFechar,
}: {
  ponto: Ponto;
  dia: PontoDia;
  nome: string;
  onSalvar: (rec: Partial<Ponto>) => void;
  onFechar: () => void;
}) {
  const toast = useToast();
  const batidasIniciais = (dia.marcacoes ?? []).filter((m) => /^\d{1,2}:\d{2}$/.test(m));
  const [b, setB] = useState<string[]>([0, 1, 2, 3].map((i) => batidasIniciais[i] ?? ""));
  const [normais, setNormais] = useState(dia.normaisMin ? minParaHora(dia.normaisMin) : "");
  const [faltas, setFaltas] = useState(dia.faltasMin ? minParaHora(dia.faltasMin) : "");
  const [extras, setExtras] = useState(dia.extrasMin ? minParaHora(dia.extrasMin) : "");
  const [situacao, setSituacao] = useState<SituacaoDia>(dia.situacao);

  const horaOk = (v: string) => v.trim() === "" || /^\d{1,3}:[0-5]\d$/.test(v.trim());
  const relogioOk = (v: string) => v.trim() === "" || /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim());

  const salvar = () => {
    const ruim = [["Normais", normais], ["Faltas", faltas], ["Extras", extras]].find(([, v]) => !horaOk(String(v)));
    if (ruim) { toast(`${ruim[0]}: use horas:minutos, como 08:30.`, "erro"); return; }
    if (b.some((x) => !relogioOk(x))) { toast("Batida inválida: use o relógio, como 07:30.", "erro"); return; }

    const novoDia: PontoDia = {
      ...dia,
      situacao,
      marcacoes: b.map((x) => x.trim()).filter(Boolean),
      normaisMin: horaParaMin(normais),
      faltasMin: horaParaMin(faltas),
      extrasMin: horaParaMin(extras),
    };
    const dias = (ponto.dias ?? []).map((x) => (x.data === dia.data ? novoDia : x));

    // Os totais do mês são refeitos pela soma dos dias — MAS só quando o detalhe
    // diário é a fonte completa (ficha vinda do PDF, com o mês inteiro).
    //
    // Numa ficha lançada à mão os totais podem ser digitados com apenas ALGUNS
    // dias detalhados; ali, somar os dias zeraria o que a pessoa digitou. Nesse
    // caso aplicamos só a diferença do dia editado, preservando o resto.
    const somaDias = (campo: "normaisMin" | "faltasMin" | "extrasMin") =>
      dias.reduce((s, x) => s + (x[campo] || 0), 0);
    const detalheCompleto = !!ponto.periodoInicio && !!ponto.periodoFim;
    const ajuste = (campo: "normaisMin" | "faltasMin" | "extrasMin") => {
      if (detalheCompleto) return somaDias(campo);
      // Ficha manual: total antigo − valor antigo do dia + valor novo do dia.
      const antes = (dia[campo] || 0);
      const depois = (novoDia[campo] || 0);
      return Math.max(0, (ponto[campo] || 0) - antes + depois);
    };
    onSalvar({
      dias,
      normaisMin: ajuste("normaisMin"),
      faltasMin: ajuste("faltasMin"),
      extrasMin: ajuste("extrasMin"),
      atualizadoEm: new Date().toISOString(),
    });
    onFechar();
  };

  const SITS: SituacaoDia[] = ["normal", "falta", "atestado", "abono", "feriado", "ferias", "folga", "semRegistro"];

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={`Corrigir ${diaCurto(dia.data)}${dia.diaSemana ? ` (${dia.diaSemana})` : ""}`}
      descricao={`${nome} · ${labelMes(ponto.competencia)}`}
      largura="max-w-lg"
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}><CheckCircle2 className="h-4 w-4" /> Salvar o dia</button></>}
    >
      <div className="space-y-3">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-600">Batidas do dia</p>
          <div className="grid grid-cols-4 gap-2">
            {["Entrada", "Saída almoço", "Volta almoço", "Saída"].map((rot, i) => (
              <Campo key={rot} label={rot}>
                <Input type="time" value={b[i]} onChange={(e) => setB(b.map((v, j) => (j === i ? e.target.value : v)))} />
              </Campo>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Horas normais"><Input value={normais} onChange={(e) => setNormais(e.target.value)} placeholder="08:48" /></Campo>
          <Campo label="Horas de falta"><Input value={faltas} onChange={(e) => setFaltas(e.target.value)} placeholder="00:00" /></Campo>
          <Campo label="Horas extras"><Input value={extras} onChange={(e) => setExtras(e.target.value)} placeholder="00:00" /></Campo>
        </div>
        <Campo label="Situação do dia">
          <Select value={situacao} onChange={(e) => setSituacao(e.target.value as SituacaoDia)}>
            {SITS.map((s) => <option key={s} value={s}>{SIT_LABEL[s]}</option>)}
          </Select>
        </Campo>
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
          Ao salvar, os totais do mês são recalculados pela soma dos dias. Reimportar o PDF deste mês substitui esta correção.
        </p>
      </div>
    </Modal>
  );
}

// Excel de um colaborador (mesma tabela do extrato).
function exportarMesExcel(empresa: string, nome: string, ponto: Ponto, dias: PontoDia[]) {
  const esc = (s: string) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const saldo = dias.reduce((s, d) => s + (d.extrasMin || 0) - (d.faltasMin || 0), 0);
  const linhas = dias.map((x) => `<tr><td>${diaCurto(x.data)} ${esc(x.diaSemana ?? "")}</td><td>${esc((x.marcacoes ?? []).filter((m) => /^\d{1,2}:\d{2}$/.test(m)).join("  "))}</td><td>${x.normaisMin ? minParaHora(x.normaisMin) : ""}</td><td>${x.faltasMin ? minParaHora(x.faltasMin) : ""}</td><td>${x.extrasMin ? minParaHora(x.extrasMin) : ""}</td><td>${x.situacao === "normal" ? "" : SIT_LABEL[x.situacao]}</td></tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1">
<tr><td colspan="6" style="font-weight:bold;font-size:14px">${esc(empresa)} — Cartão ponto — ${labelMes(ponto.competencia)}</td></tr>
<tr><td colspan="6">${esc(nome)}</td></tr>
<tr style="background:#16334f;color:#fff;font-weight:bold"><td>Dia</td><td>Batidas</td><td>Normais</td><td>Faltas</td><td>Extras</td><td>Situação</td></tr>
${linhas}
<tr style="font-weight:bold"><td>TOTAL</td><td></td><td>${minParaHora(ponto.normaisMin)}</td><td>${minParaHora(ponto.faltasMin)}</td><td>${minParaHora(ponto.extrasMin)}</td><td>Saldo ${saldo < 0 ? "-" : "+"}${minParaHora(Math.abs(saldo))}</td></tr>
</table></body></html>`;
  baixarBlob(`ponto-${slug(nome)}-${ponto.competencia}.xls`, new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}

// --- Resumo do mês (só extras/faltas/atestados) — visão condensada p/ enviar ----------
interface LinhaResumo {
  nome: string;
  extrasMin: number;
  extras: PontoDia[];       // dias com hora extra
  faltasMin: number;
  faltasDias: PontoDia[];   // dias de falta cheia (situação "falta")
  atrasosMin: number;       // faltasMin que NÃO são de falta cheia (atrasos/parciais)
  atestados: PontoDia[];    // dias com atestado
  temDetalhe: boolean;      // false = registro legado sem detalhe diário
}

// Extrai as ocorrências de um ponto (o que interessa no resumo).
function ocorrenciasDo(p: Ponto): LinhaResumo {
  const dias = p.dias ?? [];
  const faltasDias = dias.filter((x) => x.situacao === "falta");
  const faltasMin = p.faltasMin ?? 0;
  const faltaCheiaMin = faltasDias.reduce((s, x) => s + (x.faltasMin || 0), 0);
  return {
    nome: p.colaboradorId ? "" : p.nomePdf, // nome real é preenchido por quem chama (tem o cadastro)
    extrasMin: p.extrasMin ?? 0,
    extras: dias.filter((x) => x.extrasMin > 0),
    faltasMin,
    faltasDias,
    atrasosMin: Math.max(0, faltasMin - faltaCheiaMin), // sobra = atrasos/parciais em dias normais
    atestados: dias.filter((x) => x.situacao === "atestado"),
    temDetalhe: (p.dias?.length ?? 0) > 0,
  };
}
// Extras gateiam pelo TOTAL (extrasMin), não pela contagem de dias — assim registros
// antigos sem detalhe diário (dias=undefined) também entram no resumo (simétrico a faltas).
const temOcorrencia = (r: LinhaResumo) => r.extrasMin > 0 || r.faltasMin > 0 || r.atestados.length > 0;

// Detalhe das faltas: datas das faltas cheias + a sobra de atrasos, para o total FECHAR
// com as datas. Sem detalhe diário (registro legado) não afirma a natureza da ausência.
function faltasDetalhe(r: LinhaResumo): string {
  if (!r.temDetalhe) return "sem detalhe diário";
  const partes: string[] = [];
  if (r.faltasDias.length) partes.push(r.faltasDias.map((x) => diaCurto(x.data)).join(", "));
  if (r.atrasosMin > 0) partes.push(`+ ${minParaHora(r.atrasosMin)} em atrasos`);
  return partes.join(" ") || "—";
}

// Texto pronto para colar no WhatsApp.
function textoResumo(empresa: string, comp: string, linhas: LinhaResumo[]): string {
  const corpo = linhas.map((r) => {
    const partes: string[] = [];
    if (r.extrasMin > 0) partes.push(`Extras ${minParaHora(r.extrasMin)}${r.extras.length ? ` (${r.extras.map((x) => diaCurto(x.data)).join(", ")})` : ""}`);
    if (r.faltasMin > 0) partes.push(`Faltas ${minParaHora(r.faltasMin)}${r.faltasDias.length ? ` · ${r.faltasDias.length}d` : ""} (${faltasDetalhe(r)})`);
    if (r.atestados.length) partes.push(`Atestado ${r.atestados.length}d (${r.atestados.map((x) => diaCurto(x.data)).join(", ")})`);
    return `• ${r.nome} — ${partes.join(" | ")}`;
  }).join("\n");
  return `*${empresa} — Resumo do ponto — ${labelMes(comp)}*\n\n${corpo}`;
}

function baixarBlob(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga só depois: em Safari/Firefox o fetch do blob pode ser assíncrono.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function exportarResumoPdf(empresa: string, comp: string, linhas: LinhaResumo[]) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const marinho: [number, number, number] = [22, 51, 79];
  doc.setFontSize(15); doc.setTextColor(...marinho); doc.text(empresa || "Impresilk", 14, 16);
  doc.setFontSize(12); doc.setTextColor(60); doc.text(`Resumo do ponto — ${labelMes(comp)}`, 14, 24);
  doc.setFontSize(9); doc.setTextColor(120);
  doc.text("Horas extras, faltas e atestados por colaborador — já calculados pelo Secullum (CLT).", 14, 30);
  autoTable(doc, {
    startY: 35,
    head: [["Colaborador", "Horas extras", "Faltas", "Atestados"]],
    body: linhas.map((r) => [
      r.nome,
      r.extrasMin > 0 ? `${minParaHora(r.extrasMin)}${r.extras.length ? `\n${r.extras.map((x) => diaCurto(x.data)).join(", ")}` : ""}` : "—",
      r.faltasMin > 0 ? `${minParaHora(r.faltasMin)}${r.faltasDias.length ? ` · ${r.faltasDias.length}d` : ""}\n${faltasDetalhe(r)}` : "—",
      r.atestados.length ? `${r.atestados.length}d\n${r.atestados.map((x) => diaCurto(x.data)).join(", ")}` : "—",
    ]),
    headStyles: { fillColor: marinho },
    styles: { fontSize: 8, cellPadding: 2, valign: "top" },
    columnStyles: { 0: { cellWidth: 55, fontStyle: "bold" }, 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" } },
  });
  baixarBlob(`resumo-ponto-${comp}.pdf`, doc.output("blob"));
}

function exportarResumoExcel(empresa: string, comp: string, linhas: LinhaResumo[]) {
  const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const faltasCel = (r: LinhaResumo) => r.faltasDias.map((x) => diaCurto(x.data)).join(", ") + (r.atrasosMin > 0 ? ` (+ ${minParaHora(r.atrasosMin)} atrasos)` : "");
  const corpo = linhas.map((r) => `<tr><td>${esc(r.nome)}</td><td>${r.extrasMin > 0 ? minParaHora(r.extrasMin) : ""}</td><td>${esc(r.extras.map((x) => diaCurto(x.data)).join(", "))}</td><td>${r.faltasMin > 0 ? minParaHora(r.faltasMin) : ""}</td><td>${esc(faltasCel(r))}</td><td>${r.atestados.length || ""}</td><td>${esc(r.atestados.map((x) => diaCurto(x.data)).join(", "))}</td></tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1">
<tr><td colspan="7" style="font-weight:bold;font-size:14px">${esc(empresa)} — Resumo do ponto — ${labelMes(comp)}</td></tr>
<tr style="background:#16334f;color:#fff;font-weight:bold"><td>Colaborador</td><td>Horas extras</td><td>Dias c/ extra</td><td>Horas de falta</td><td>Dias de falta</td><td>Atestados (dias)</td><td>Datas do atestado</td></tr>
${corpo || '<tr><td colspan="7">Sem ocorrências</td></tr>'}
</table></body></html>`;
  baixarBlob(`resumo-ponto-${comp}.xls`, new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}

// =====================================================================================
// ABA — ADVERTÊNCIAS
// =====================================================================================
function AbaAdvertencias({
  escopo,
  idsEscopo,
  podeEditar,
  drill,
}: {
  escopo: Colaborador[];
  idsEscopo: Set<string>;
  podeEditar: boolean;
  drill: Drill;
}) {
  const d = useDominio();
  const toast = useToast();
  const { items: advertencias, criar, atualizar, remover } = useColecao("advertencias");
  const [novo, setNovo] = useState(false);
  const [editar, setEditar] = useState<(typeof advertencias)[number] | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);
  // Cards do topo filtram a tabela de registros por tipo.
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null);
  const alternarTipo = (t: string) => setFiltroTipo((a) => (a === t ? null : t));

  const lista = useMemo(
    () =>
      advertencias
        .filter((a) => idsEscopo.has(a.colaboradorId))
        .sort((a, b) => String(b.data).localeCompare(String(a.data))),
    [advertencias, idsEscopo],
  );

  const porTipo = useMemo(() => {
    const c = { Verbal: 0, Escrita: 0, Suspensão: 0 } as Record<string, number>;
    lista.forEach((a) => {
      c[a.tipo] = (c[a.tipo] ?? 0) + 1;
    });
    return c;
  }, [lista]);

  // Os cards seguem contando tudo; só a tabela de registros obedece ao filtro.
  const listaVisivel = useMemo(
    () => (filtroTipo ? lista.filter((a) => a.tipo === filtroTipo) : lista),
    [lista, filtroTipo],
  );

  // Ranking: colaboradores com mais advertências no escopo.
  const ranking = useMemo(() => {
    const mapa = new Map<string, number>();
    lista.forEach((a) => mapa.set(a.colaboradorId, (mapa.get(a.colaboradorId) ?? 0) + 1));
    return [...mapa.entries()]
      .map(([id, total]) => ({ id, nome: d.nomeColab(id), total }))
      .sort((a, b) => b.total - a.total);
  }, [lista, d]);

  const rankingChart = useMemo(
    () => ranking.slice(0, 8).map((r) => ({ nome: primeiroNome(r.nome), valor: r.total })),
    [ranking],
  );

  const abrirDrill = (id: string) => {
    const c = d.colabById.get(id);
    if (c) drill.abrir(`Advertências de ${c.nome}`, [c], "Registros disciplinares no escopo atual");
  };

  return (
    <div>
      {podeEditar && (
        <div className="mb-6 flex items-center justify-end">
          <button className="btn-primary" onClick={() => setNovo(true)}>
            <Plus className="h-4 w-4" /> Registrar advertência
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total de advertências" value={lista.length} icon={<ShieldAlert className="h-5 w-5" />} accent="brand" hint="No seu escopo"
          onClick={() => setFiltroTipo(null)} ativo={filtroTipo === null} title="Mostrar todas" />
        <StatCard label="Verbais" value={porTipo.Verbal} icon={<MessageSquareWarning className="h-5 w-5" />} accent="blue" hint="Orientação registrada"
          onClick={() => alternarTipo("Verbal")} ativo={filtroTipo === "Verbal"} title="Ver só as advertências verbais" />
        <StatCard label="Escritas" value={porTipo.Escrita} icon={<FileWarning className="h-5 w-5" />} accent="amber" hint="Advertência formal"
          onClick={() => alternarTipo("Escrita")} ativo={filtroTipo === "Escrita"} title="Ver só as advertências escritas" />
        <StatCard label="Suspensões" value={porTipo.Suspensão} icon={<AlertTriangle className="h-5 w-5" />} accent="red" hint="Medida disciplinar"
          onClick={() => alternarTipo("Suspensão")} ativo={filtroTipo === "Suspensão"} title="Ver só as suspensões" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Advertências por colaborador"
          subtitle="Reincidência disciplinar no escopo"
          icon={<Trophy className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {rankingChart.length === 0 ? (
            <EmptyState title="Sem advertências registradas" description="Nenhum registro disciplinar no seu escopo." icon={<ShieldAlert className="h-8 w-8" />} />
          ) : (
            <BarrasVerticais
              data={rankingChart}
              cor="#dc2626"
              onItemClick={(nome) => {
                const alvo = ranking.find((r) => primeiroNome(r.nome) === nome);
                if (alvo) abrirDrill(alvo.id);
              }}
            />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Registros de advertência"
          subtitle={`${listaVisivel.length}${filtroTipo ? ` de ${lista.length}` : ""} registro(s) no seu escopo de acesso`}
          icon={<ShieldAlert className="h-[18px] w-[18px]" />}
        />
        {listaVisivel.length === 0 ? (
          <CardBody>
            <EmptyState title="Sem advertências" description={filtroTipo ? "Nenhuma advertência deste tipo — clique no card de novo para ver todas." : "Nenhuma advertência registrada no seu escopo."} icon={<ShieldAlert className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th">Tipo</th>
                  <th className="th hidden sm:table-cell">Data</th>
                  <th className="th">Motivo</th>
                  <th className="th hidden md:table-cell">Anexo</th>
                  {podeEditar && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaVisivel.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <button
                        type="button"
                        onClick={() => abrirDrill(a.colaboradorId)}
                        className="flex items-center gap-3 text-left"
                      >
                        <Avatar nome={d.nomeColab(a.colaboradorId)} foto={d.fotoColab(a.colaboradorId)} size="sm" />
                        <span className="font-medium text-slate-800 hover:text-brand">{d.nomeColab(a.colaboradorId)}</span>
                      </button>
                    </td>
                    <td className="td">
                      <Badge variant={COR_TIPO_ADV[a.tipo] ?? "neutral"}>{a.tipo}</Badge>
                    </td>
                    <td className="td hidden sm:table-cell text-slate-500">{diaData(a.data)}</td>
                    <td className="td">
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{a.motivo}</p>
                        {a.descricao && <p className="truncate text-xs text-slate-400">{a.descricao}</p>}
                      </div>
                    </td>
                    <td className="td hidden md:table-cell">
                      {a.arquivoDataUrl ? (
                        <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => abrirArquivo(a.arquivoDataUrl, toast)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Abrir
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    {podeEditar && (
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            className="btn-ghost p-1.5 text-slate-400 hover:text-brand"
                            onClick={() => setEditar(a)}
                            aria-label="Editar advertência"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            className="btn-ghost p-1.5 text-slate-400 hover:text-red-600"
                            onClick={() => setExcluir(a.id)}
                            aria-label="Excluir advertência"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(novo || editar) && (
        <NovaAdvertenciaModal
          aberto={novo || !!editar}
          inicial={editar}
          onFechar={() => {
            setNovo(false);
            setEditar(null);
          }}
          escopo={escopo}
          onSalvar={(payload) => {
            if (editar) {
              atualizar(editar.id, payload);
              toast("Advertência atualizada.");
            } else {
              criar(payload);
              toast("Advertência registrada.");
            }
          }}
        />
      )}

      <ConfirmDialog
        aberto={excluir != null}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => {
          if (excluir) {
            remover(excluir);
            toast("Advertência removida.");
          }
          setExcluir(null);
        }}
        titulo="Excluir advertência"
        mensagem="Tem certeza que deseja excluir este registro disciplinar? Esta ação não pode ser desfeita."
      />
    </div>
  );
}

function abrirArquivo(dataUrl: string | null | undefined, toast: (msg: string, tipo?: "sucesso" | "erro" | "info") => void) {
  if (!dataUrl) {
    toast("Este registro não possui arquivo anexado.", "info");
    return;
  }
  const w = window.open();
  if (w) w.document.write(`<iframe src="${dataUrl}" style="border:0;width:100%;height:100vh"></iframe>`);
}

function NovaAdvertenciaModal({
  aberto,
  inicial,
  onFechar,
  escopo,
  onSalvar,
}: {
  aberto: boolean;
  inicial?: Record<string, any> | null;
  onFechar: () => void;
  escopo: Colaborador[];
  onSalvar: (payload: Record<string, unknown>) => void;
}) {
  const ehEdicao = !!inicial;
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [colaboradorId, setColaboradorId] = useState(inicial?.colaboradorId ?? "");
  const [tipo, setTipo] = useState<string>(inicial?.tipo ?? TIPOS_ADVERTENCIA[0]);
  const [data, setData] = useState(inicial?.data ? String(inicial.data).slice(0, 10) : iso(HOJE));
  const [motivo, setMotivo] = useState(inicial?.motivo ?? "");
  const [descricao, setDescricao] = useState(inicial?.descricao ?? "");
  const [arquivo, setArquivo] = useState<{ nome: string; dataUrl: string } | null>(
    inicial?.arquivoDataUrl ? { nome: inicial.arquivoNome ?? "Anexo atual", dataUrl: inicial.arquivoDataUrl } : null,
  );
  const [lendo, setLendo] = useState(false);

  const onFile = (f: File) => {
    if (f.size > 2 * 1024 * 1024) {
      toast("Arquivo acima de 2 MB. Escolha um arquivo menor.", "erro");
      return;
    }
    setLendo(true);
    const reader = new FileReader();
    reader.onload = () => { setArquivo({ nome: f.name, dataUrl: String(reader.result) }); setLendo(false); };
    reader.onerror = () => { setLendo(false); toast("Não foi possível ler o arquivo. Tente novamente.", "erro"); };
    reader.readAsDataURL(f);
  };

  const salvar = () => {
    if (!colaboradorId) return toast("Selecione o colaborador.", "erro");
    if (!data) return toast("Informe a data da advertência.", "erro");
    if (!motivo.trim()) return toast("Informe o motivo da advertência.", "erro");
    if (lendo) return toast("Aguarde o anexo terminar de carregar.", "info");
    onSalvar({
      ...(inicial ?? {}),
      colaboradorId,
      tipo,
      data,
      motivo: motivo.trim(),
      descricao: descricao.trim() || undefined,
      arquivoNome: arquivo?.nome ?? null,
      arquivoDataUrl: arquivo?.dataUrl ?? null,
      registradoPor: inicial?.registradoPor ?? "RH",
      criadoEm: inicial?.criadoEm ?? new Date().toISOString(),
    });
    onFechar();
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo={ehEdicao ? "Editar advertência" : "Registrar advertência"}
      descricao="Registro disciplinar conforme política interna de conduta."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={salvar} disabled={lendo}>
            {ehEdicao ? <><Pencil className="h-4 w-4" /> Salvar</> : <><Plus className="h-4 w-4" /> Registrar</>}
          </button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo label="Colaborador" obrigatorio className="sm:col-span-2">
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            <option value="">Selecione…</option>
            {escopo.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Tipo" obrigatorio>
          <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {TIPOS_ADVERTENCIA.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
        </Campo>
        <Campo label="Data" obrigatorio>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </Campo>
        <Campo label="Motivo" obrigatorio className="sm:col-span-2">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Atrasos recorrentes" />
        </Campo>
        <Campo label="Descrição" className="sm:col-span-2">
          <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhe a ocorrência e as orientações dadas ao colaborador." />
        </Campo>
        <div className="sm:col-span-2">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
          />
          <button className="btn-outline w-full" onClick={() => fileRef.current?.click()} disabled={lendo}>
            <Upload className="h-4 w-4" /> {lendo ? "Lendo arquivo…" : arquivo ? arquivo.nome : "Anexar documento (≤ 2 MB)"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// =====================================================================================
// ABA — ABSENTEÍSMO
// =====================================================================================
const PERIODOS_RAPIDOS = [
  { label: "30 dias", dias: 30 },
  { label: "90 dias", dias: 90 },
  { label: "180 dias", dias: 180 },
  { label: "Ano", dias: 365 },
];

function AbaAbsenteismo({
  escopo,
  idsEscopo,
  drill,
  podeEditar,
}: {
  escopo: Colaborador[];
  idsEscopo: Set<string>;
  drill: Drill;
  podeEditar: boolean;
}) {
  const d = useDominio();
  const toast = useToast();
  const { items: ausencias, criar, atualizar, remover } = useColecao("ausencias");
  const [lancar, setLancar] = useState(false);
  const [editar, setEditar] = useState<(typeof ausencias)[number] | null>(null);
  const [excluir, setExcluir] = useState<string | null>(null);

  const [de, setDe] = useState(() => iso(new Date(HOJE.getTime() - 90 * 86400000)));
  const [ate, setAte] = useState(() => iso(HOJE));
  // Cards do topo filtram a tabela de registros (clicar de novo limpa).
  const [foco, setFoco] = useState<"naoJust" | "atrasos" | "justificadas" | null>(null);
  const alternarFoco = (f: NonNullable<typeof foco>) => setFoco((a) => (a === f ? null : f));

  const aplicarRapido = (dias: number) => {
    setDe(iso(new Date(HOJE.getTime() - dias * 86400000)));
    setAte(iso(HOJE));
  };

  // Filtra ausências do escopo dentro do período (comparação lexicográfica de "YYYY-MM-DD").
  const lista = useMemo(() => {
    const min = de || "0000-00-00";
    const max = ate || "9999-99-99";
    return ausencias
      .filter((a) => idsEscopo.has(a.colaboradorId))
      .filter((a) => {
        const dia = String(a.data).slice(0, 10);
        return dia >= min && dia <= max;
      })
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [ausencias, idsEscopo, de, ate]);

  const total = lista.length;
  const faltasNaoJust = useMemo(
    () => lista.filter((a) => a.tipo === "Falta" && !a.justificada).length,
    [lista],
  );
  const atrasos = useMemo(() => lista.filter((a) => a.tipo === "Atraso").length, [lista]);
  const pctJustificadas = total === 0 ? 0 : lista.filter((a) => a.justificada).length / total;

  // Cards e gráficos seguem contando o período inteiro; só a tabela obedece ao foco.
  const listaVisivel = useMemo(() => {
    if (foco === "naoJust") return lista.filter((a) => a.tipo === "Falta" && !a.justificada);
    if (foco === "atrasos") return lista.filter((a) => a.tipo === "Atraso");
    if (foco === "justificadas") return lista.filter((a) => a.justificada);
    return lista;
  }, [lista, foco]);

  // Ranking de quem mais falta no período: nº de ausências, faltas e horas de atraso.
  const ranking = useMemo(() => {
    const mapa = new Map<string, { ausencias: number; faltas: number; horas: number }>();
    lista.forEach((a) => {
      const atual = mapa.get(a.colaboradorId) ?? { ausencias: 0, faltas: 0, horas: 0 };
      atual.ausencias += 1;
      if (a.tipo === "Falta") atual.faltas += 1;
      if (a.tipo === "Atraso" || a.tipo === "Saída antecipada") atual.horas += a.horas ?? 0;
      mapa.set(a.colaboradorId, atual);
    });
    return [...mapa.entries()]
      .map(([id, m]) => ({ id, nome: d.nomeColab(id), ...m }))
      .sort((a, b) => b.ausencias - a.ausencias || b.faltas - a.faltas);
  }, [lista, d]);

  const rankingChart = useMemo(
    () => ranking.slice(0, 8).map((r) => ({ nome: primeiroNome(r.nome), valor: r.ausencias })),
    [ranking],
  );

  const porTipo = useMemo(() => {
    const mapa = new Map<string, number>();
    lista.forEach((a) => mapa.set(a.tipo, (mapa.get(a.tipo) ?? 0) + 1));
    return TIPOS_AUSENCIA
      .filter((t) => (mapa.get(t) ?? 0) > 0)
      .map((t) => ({ nome: t, valor: mapa.get(t) ?? 0, cor: COR_TIPO_AUS[t] ?? "#64748b" }));
  }, [lista]);

  const abrirDrill = (id: string) => {
    const c = d.colabById.get(id);
    if (c) drill.abrir(`Ausências de ${c.nome}`, [c], `Período de ${diaData(de)} a ${diaData(ate)}`);
  };

  return (
    <div>
      {podeEditar && (
        <div className="mb-4 flex justify-end">
          <button className="btn-primary" onClick={() => setLancar(true)}>
            <Plus className="h-4 w-4" /> Lançar falta / ausência
          </button>
        </div>
      )}
      {/* Filtro de período */}
      <Card className="mb-6">
        <CardBody className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo label="De" className="sm:w-44">
              <Input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} />
            </Campo>
            <Campo label="Até" className="sm:w-44">
              <Input type="date" value={ate} min={de} onChange={(e) => setAte(e.target.value)} />
            </Campo>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PERIODOS_RAPIDOS.map((p) => (
              <button key={p.dias} className="btn-outline h-9 px-3 py-0 text-xs" onClick={() => aplicarRapido(p.dias)}>
                {p.label}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Ausências no período" value={total} icon={<CalendarRange className="h-5 w-5" />} accent="brand" hint={`${diaData(de)} – ${diaData(ate)}`}
          onClick={() => setFoco(null)} ativo={foco === null} title="Mostrar todas as ausências do período" />
        <StatCard label="Faltas não justificadas" value={faltasNaoJust} icon={<CalendarX2 className="h-5 w-5" />} accent="red" hint="Sem justificativa"
          onClick={() => alternarFoco("naoJust")} ativo={foco === "naoJust"} title="Ver só as faltas sem justificativa" />
        <StatCard label="Atrasos" value={atrasos} icon={<Clock className="h-5 w-5" />} accent="amber" hint="Registros de atraso"
          onClick={() => alternarFoco("atrasos")} ativo={foco === "atrasos"} title="Ver só os atrasos" />
        <StatCard label="% justificadas" value={formatPercent(pctJustificadas)} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" hint="Com justificativa"
          onClick={() => alternarFoco("justificadas")} ativo={foco === "justificadas"} title="Ver só as ausências justificadas" />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Quem mais falta"
          subtitle="Ranking de ausências no período"
          icon={<Trophy className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {ranking.length === 0 ? (
            <EmptyState title="Sem ausências no período" description="Ajuste o intervalo de datas para ver os registros." icon={<CalendarRange className="h-8 w-8" />} />
          ) : (
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Nº de ausências por colaborador</p>
                <BarrasVerticais
                  data={rankingChart}
                  cor="#16334f"
                  onItemClick={(nome) => {
                    const alvo = ranking.find((r) => primeiroNome(r.nome) === nome);
                    if (alvo) abrirDrill(alvo.id);
                  }}
                />
              </div>
              <ol className="space-y-1">
                {ranking.map((r, i) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => abrirDrill(r.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-50"
                    >
                      <span
                        className={
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                          (i === 0
                            ? "bg-gold/15 text-gold"
                            : i === 1
                              ? "bg-slate-200 text-slate-600"
                              : i === 2
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-100 text-slate-500")
                        }
                      >
                        {i + 1}º
                      </span>
                      <Avatar nome={r.nome} foto={d.fotoColab(r.id)} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{r.nome}</p>
                        <p className="text-xs text-slate-500">
                          {r.faltas} falta(s) · {formatNumber(r.horas)}h de atraso
                        </p>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block text-sm font-semibold text-slate-800">{r.ausencias}</span>
                        <span className="text-[11px] text-slate-400">ausência(s)</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Ausências por tipo"
          subtitle="Distribuição dos motivos de ausência no período"
          icon={<BarChart3 className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {porTipo.length === 0 ? (
            <EmptyState title="Sem dados no período" description="Nenhuma ausência registrada no intervalo selecionado." icon={<BarChart3 className="h-8 w-8" />} />
          ) : (
            <BarrasColoridas data={porTipo} />
          )}
        </CardBody>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <CardHeader
          title="Registros de ausência"
          subtitle={`${listaVisivel.length}${foco ? ` de ${lista.length}` : ""} registro(s) entre ${diaData(de)} e ${diaData(ate)}`}
          icon={<CalendarRange className="h-[18px] w-[18px]" />}
        />
        {listaVisivel.length === 0 ? (
          <CardBody>
            <EmptyState title="Sem ausências no período" description={foco ? "Nada neste filtro — clique no card de novo para ver tudo." : "Nenhum registro no intervalo e escopo selecionados."} icon={<CalendarRange className="h-8 w-8" />} />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th hidden sm:table-cell">Data</th>
                  <th className="th">Tipo</th>
                  <th className="th">Justificada</th>
                  <th className="th hidden md:table-cell">Horas</th>
                  {podeEditar && <th className="th" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {listaVisivel.map((a) => (
                  <tr key={a.id} className="transition hover:bg-slate-50/60">
                    <td className="td">
                      <div className="flex items-center gap-3">
                        <Avatar nome={d.nomeColab(a.colaboradorId)} foto={d.fotoColab(a.colaboradorId)} size="sm" />
                        <span className="font-medium text-slate-800">{d.nomeColab(a.colaboradorId)}</span>
                      </div>
                    </td>
                    <td className="td hidden sm:table-cell text-slate-500">{diaData(a.data)}</td>
                    <td className="td">
                      <Badge variant={a.tipo === "Falta" ? "danger" : a.tipo === "Atraso" || a.tipo === "Saída antecipada" ? "warning" : a.tipo === "Atestado" ? "info" : "success"}>
                        {a.tipo}
                      </Badge>
                    </td>
                    <td className="td">
                      <Badge variant={a.justificada ? "success" : "danger"}>{a.justificada ? "Sim" : "Não"}</Badge>
                    </td>
                    <td className="td hidden md:table-cell text-slate-500">
                      {a.horas ? `${formatNumber(a.horas)}h` : "—"}
                    </td>
                    {podeEditar && (
                      <td className="td text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" onClick={() => setEditar(a)} title="Editar lançamento">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => setExcluir(a.id)} title="Excluir lançamento">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(lancar || editar) && (
        <ModalLancarAusencia
          escopo={escopo}
          inicial={editar}
          onFechar={() => {
            setLancar(false);
            setEditar(null);
          }}
          onSalvar={(dados) => {
            if (editar) {
              atualizar(editar.id, dados);
              toast("Ausência atualizada.");
            } else {
              criar(dados);
              toast("Ausência lançada.");
            }
            setLancar(false);
            setEditar(null);
          }}
        />
      )}
      <ConfirmDialog
        aberto={!!excluir}
        onFechar={() => setExcluir(null)}
        onConfirmar={() => {
          if (excluir) {
            remover(excluir);
            toast("Lançamento excluído.");
            setExcluir(null);
          }
        }}
        titulo="Excluir lançamento?"
        mensagem="Este registro de ausência será removido permanentemente."
      />
    </div>
  );
}

function ModalLancarAusencia({
  escopo,
  inicial,
  onFechar,
  onSalvar,
}: {
  escopo: Colaborador[];
  inicial?: Record<string, any> | null;
  onFechar: () => void;
  onSalvar: (dados: { colaboradorId: string; data: string; tipo: string; horas?: number; justificada: boolean; observacao?: string }) => void;
}) {
  const ehEdicao = !!inicial;
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState(inicial?.colaboradorId ?? escopo[0]?.id ?? "");
  const [data, setData] = useState(inicial?.data ? String(inicial.data).slice(0, 10) : iso(HOJE));
  const [tipo, setTipo] = useState<string>(inicial?.tipo ?? "Falta");
  const [justificada, setJustificada] = useState<boolean>(inicial?.justificada ?? false);
  const [horas, setHoras] = useState(inicial?.horas != null ? String(inicial.horas) : "");
  const [observacao, setObservacao] = useState(inicial?.observacao ?? "");
  const comHoras = tipo === "Atraso" || tipo === "Saída antecipada";

  const salvar = () => {
    if (!colaboradorId) return toast("Selecione o colaborador.", "erro");
    if (!data) return toast("Informe a data.", "erro");
    onSalvar({
      ...(inicial ?? {}),
      colaboradorId,
      data,
      tipo,
      justificada,
      horas: comHoras && horas ? Number(horas) : undefined,
      observacao: observacao.trim() || undefined,
    });
  };

  return (
    <Modal
      aberto
      onFechar={onFechar}
      titulo={ehEdicao ? "Editar falta / ausência" : "Lançar falta / ausência"}
      descricao="Registro manual de frequência da equipe."
      rodape={<><button className="btn-outline" onClick={onFechar}>Cancelar</button><button className="btn-primary" onClick={salvar}>{ehEdicao ? "Salvar" : "Lançar"}</button></>}
    >
      <div className="space-y-3">
        <Campo label="Colaborador" obrigatorio>
          <Select value={colaboradorId} onChange={(e) => setColaboradorId(e.target.value)}>
            {escopo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </Select>
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Data" obrigatorio><Input type="date" value={data} max={iso(HOJE)} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo label="Tipo">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              {TIPOS_AUSENCIA.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Campo>
        </div>
        {comHoras && (
          <Campo label="Horas" hint="Horas de atraso / saída antecipada">
            <Input type="number" min={0} step={0.5} value={horas} onChange={(e) => setHoras(e.target.value)} />
          </Campo>
        )}
        <div className="pt-1">
          <Toggle checked={justificada} onChange={setJustificada} label="Ausência justificada" />
        </div>
        <Campo label="Observação"><Input value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Opcional" /></Campo>
      </div>
    </Modal>
  );
}
