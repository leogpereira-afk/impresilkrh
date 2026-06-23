import { useCallback, useMemo, useState } from "react";
import {
  Users,
  Wallet,
  Coins,
  TrendingDown,
  TrendingUp,
  Minus,
  Gauge,
  BarChart3,
  Building2,
  CalendarRange,
  PieChart,
  Clock,
  Lock,
  HeartPulse,
  DoorOpen,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { useColecao } from "@/lib/store";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import {
  BarrasVerticais,
  BarrasDuplas,
  BarrasColoridas,
  Rosca,
} from "@/components/charts/charts";
import { cn } from "@/lib/cn";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { ehRH } from "@/lib/rbac";
import { formatBRL, formatPercent, mesesDeCasa, parseData, MESES_PT } from "@/lib/format";

// Datas "YYYY-MM-DD" devem ser lidas como locais (parseData) para não escorregar
// de mês por fuso. Retorna true se a data existe e é >= ref.
const aposOuIgual = (s: string | null | undefined, ref: Date) => {
  const d = parseData(s);
  return !!d && d.getTime() >= ref.getTime();
};
import { COR_POSICAO_FAIXA, COR_HUMOR, COR_RISCO } from "@/lib/constants";
import { HOJE } from "@/data/_gen";
import type { Colaborador } from "@/data/types";

// Cor da nota/média de desempenho (verde ≥80, âmbar ≥60, vermelho abaixo).
const corNota = (n: number) => (n >= 80 ? "#16a34a" : n >= 60 ? "#d97706" : "#dc2626");

// Variação (pts) com seta e cor — usado nas comparações de desempenho por setor.
function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-xs text-slate-300">—</span>;
  const up = v > 0.05, down = v < -0.05;
  const cor = up ? "#16a34a" : down ? "#dc2626" : "#94a3b8";
  const Icon = up ? TrendingUp : down ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center justify-end gap-1 text-sm font-medium tabular-nums" style={{ color: cor }}>
      <Icon className="h-3.5 w-3.5" />{v > 0 ? "+" : ""}{v.toFixed(1)}
    </span>
  );
}

// Linha de "distribuição por setor" com barra empilhada (clima / risco).
function LinhaSetorDistrib({
  nome, foco, total, segs, onClick,
}: {
  nome: string;
  foco: boolean;
  total: number;
  segs: { label: string; valor: number; cor: string }[];
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="block w-full rounded-lg p-2 text-left transition hover:bg-slate-50">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
          {nome}
          {foco && <Badge variant="warning">Atue aqui</Badge>}
        </span>
        <span className="flex items-center gap-2.5 text-xs tabular-nums text-slate-500">
          {segs.filter((s) => s.valor > 0).map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1" title={s.label}>
              <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} />{s.valor}
            </span>
          ))}
        </span>
      </div>
      <div className="mt-1.5 flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        {segs.map((s, i) => (s.valor > 0 ? <div key={i} style={{ width: `${(s.valor / (total || 1)) * 100}%`, background: s.cor }} /> : null))}
      </div>
    </button>
  );
}

// Faixas de tempo de casa (em meses)
const FAIXAS_TEMPO: { nome: string; cor: string; teste: (m: number) => boolean }[] = [
  { nome: "< 1 ano", cor: "#94a3b8", teste: (m) => m < 12 },
  { nome: "1–3 anos", cor: "#60a5fa", teste: (m) => m >= 12 && m < 36 },
  { nome: "3–5 anos", cor: "#3b82f6", teste: (m) => m >= 36 && m < 60 },
  { nome: "5–10 anos", cor: "#c2a14d", teste: (m) => m >= 60 && m < 120 },
  { nome: "10+ anos", cor: "#16334f", teste: (m) => m >= 120 },
];

export default function Relatorios() {
  const sessao = useSessao();
  const d = useDominio();
  const drill = useDrill();

  const ehRestrito = !ehRH(sessao);

  const ativos = d.ativos;
  const colaboradores = d.colaboradores;

  // -- Filtro de período (mês/ano), igual ao Painel. Controla a movimentação
  //    (admissões/desligamentos) e o turnover. mês 0 = "Ano inteiro".
  //    Padrão = ano inteiro do ano corrente (visão executiva anual). --
  const [filtroMes, setFiltroMes] = useState<number>(0);
  const [filtroAno, setFiltroAno] = useState<number>(HOJE.getFullYear());
  const anosDisponiveis = useMemo(() => {
    const s = new Set<number>([HOJE.getFullYear()]);
    for (const c of colaboradores) {
      const a = parseData(c.dataAdmissao); if (a) s.add(a.getFullYear());
      const dd = parseData(c.dataDesligamento); if (dd) s.add(dd.getFullYear());
    }
    return [...s].sort((a, b) => b - a);
  }, [colaboradores]);
  const noPeriodo = (iso?: string | null) => {
    const dt = parseData(iso);
    if (!dt || dt.getFullYear() !== filtroAno) return false;
    return filtroMes === 0 ? true : dt.getMonth() + 1 === filtroMes;
  };
  const rotuloPeriodo = filtroMes === 0 ? `${filtroAno}` : `${MESES_PT[filtroMes - 1]}/${filtroAno}`;

  // Movimentação e turnover do período selecionado.
  const periodo = useMemo(() => {
    const dentro = (iso?: string | null) => {
      const dt = parseData(iso);
      if (!dt || dt.getFullYear() !== filtroAno) return false;
      return filtroMes === 0 ? true : dt.getMonth() + 1 === filtroMes;
    };
    const admit = colaboradores.filter((c) => dentro(c.dataAdmissao));
    const deslig = colaboradores.filter((c) => dentro(c.dataDesligamento));
    // Headcount médio aproximado no período (atual ± movimentação do período).
    const inicio = ativos.length + deslig.length - admit.length;
    const hcMedio = (ativos.length + Math.max(0, inicio)) / 2;
    const turnover = hcMedio > 0 ? deslig.length / hcMedio : 0;
    return { admit, deslig, saldo: admit.length - deslig.length, turnover };
  }, [colaboradores, ativos, filtroMes, filtroAno]);

  // -- Folha real (pagamentos enviados), somando SÓ os ativos. Duas bases:
  //    "caixa" = pelo dia em que o pagamento saiu (dataPagamento);
  //    "competencia" = pelo mês de referência (competencia). Respeita o período. --
  const { items: pagamentos } = useColecao("pagamentos");
  const idsAtivos = useMemo(() => new Set(ativos.map((c) => c.id)), [ativos]);
  const [baseFolha, setBaseFolha] = useState<"caixa" | "competencia">("caixa");
  const folhaReal = useMemo(() => {
    const porCaixa = new Map<string, number>();
    const porComp = new Map<string, number>();
    for (const p of pagamentos) {
      if (!idsAtivos.has(p.colaboradorId)) continue; // só ativos
      porComp.set(p.competencia, (porComp.get(p.competencia) ?? 0) + p.valor);
      const dt = parseData(p.dataPagamento);
      const ck = dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` : p.competencia;
      porCaixa.set(ck, (porCaixa.get(ck) ?? 0) + p.valor);
    }
    const compDe = (mes: number) => `${filtroAno}-${String(mes).padStart(2, "0")}`;
    const resumo = (m: Map<string, number>) => {
      let total = 0;
      if (filtroMes === 0) { for (const [k, v] of m) if (k.startsWith(`${filtroAno}-`)) total += v; }
      else total = m.get(compDe(filtroMes)) ?? 0;
      const serie = MESES_PT.map((nome, i) => ({ nome: nome.slice(0, 3), valor: m.get(compDe(i + 1)) ?? 0 }));
      return { total, serie, mapa: m };
    };
    return { caixa: resumo(porCaixa), competencia: resumo(porComp), temDados: porCaixa.size > 0 || porComp.size > 0 };
  }, [pagamentos, idsAtivos, filtroMes, filtroAno]);
  const folhaAtual = folhaReal[baseFolha];

  const drillFolhaReal = useCallback(
    (nomeMes: string) => {
      const i = MESES_PT.findIndex((m) => m.slice(0, 3) === nomeMes);
      if (i < 0) return;
      const key = `${filtroAno}-${String(i + 1).padStart(2, "0")}`;
      const noMes = (p: { competencia: string; dataPagamento?: string | null }) => {
        if (baseFolha === "competencia") return p.competencia === key;
        const dt = parseData(p.dataPagamento);
        return (dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}` : p.competencia) === key;
      };
      const ids = new Set(pagamentos.filter((p) => idsAtivos.has(p.colaboradorId) && noMes(p)).map((p) => p.colaboradorId));
      const lista = ativos.filter((c) => ids.has(c.id));
      drill.abrir(`Folha real (${baseFolha}) — ${nomeMes}/${filtroAno}`, lista, `${formatBRL(folhaReal[baseFolha].mapa.get(key) ?? 0)} · ${lista.length} colaborador(es)`);
    },
    [pagamentos, idsAtivos, ativos, filtroAno, baseFolha, folhaReal, drill],
  );

  // -- Indicadores de cabeçalho --
  const indicadores = useMemo(() => {
    const comSalario = ativos.filter(
      (c): c is Colaborador & { salario: number } =>
        typeof c.salario === "number",
    );
    const folha = comSalario.reduce((acc, c) => acc + c.salario, 0);
    const custoMedio = comSalario.length > 0 ? folha / comSalario.length : 0;

    const limite12m = new Date(HOJE);
    limite12m.setMonth(limite12m.getMonth() - 12);

    const desligamentos12m = colaboradores.filter(
      (c) => aposOuIgual(c.dataDesligamento, limite12m),
    ).length;
    const admissoes12m = colaboradores.filter(
      (c) => aposOuIgual(c.dataAdmissao, limite12m),
    ).length;

    // Headcount médio aproximado: (atual + (atual + desligados)) / 2
    const headcountFim = ativos.length;
    const headcountInicio = ativos.length + desligamentos12m - admissoes12m;
    const headcountMedio = (headcountFim + Math.max(0, headcountInicio)) / 2;
    const turnover =
      headcountMedio > 0 ? desligamentos12m / headcountMedio : 0;

    return {
      headcount: ativos.length,
      folha,
      custoMedio,
      desligamentos12m,
      turnover,
    };
  }, [ativos, colaboradores]);

  // -- Folha e custo médio por área --
  const porArea = useMemo(() => {
    return d.areas
      .filter((a) => a.id !== "direcao")
      .map((a) => {
        const doArea = ativos.filter((c) => c.areaId === a.id);
        const folha = doArea.reduce(
          (acc, c) => acc + (typeof c.salario === "number" ? c.salario : 0),
          0,
        );
        return {
          id: a.id,
          nome: a.nome,
          nomeCurto: a.nome.split(" ")[0],
          headcount: doArea.length,
          folha,
          custoMedio: doArea.length > 0 ? folha / doArea.length : 0,
        };
      })
      .filter((x) => x.headcount > 0)
      .sort((a, b) => b.folha - a.folha);
  }, [d.areas, ativos]);

  const folhaPorAreaChart = useMemo(
    () => porArea.map((a) => ({ nome: a.nomeCurto, valor: a.folha })),
    [porArea],
  );

  // -- Movimentação (admissões vs desligamentos), ancorada no período --
  // "Ano inteiro" => Jan–Dez do ano; mês específico => 12 meses terminando nele.
  const movimentacao = useMemo(() => {
    const meses: {
      ano: number;
      mes: number;
      nome: string;
      a: number;
      b: number;
    }[] = [];
    if (filtroMes === 0) {
      for (let m = 0; m < 12; m++) {
        meses.push({ ano: filtroAno, mes: m, nome: MESES_PT[m].slice(0, 3), a: 0, b: 0 });
      }
    } else {
      for (let i = 11; i >= 0; i--) {
        const ref = new Date(filtroAno, filtroMes - 1 - i, 1);
        meses.push({ ano: ref.getFullYear(), mes: ref.getMonth(), nome: MESES_PT[ref.getMonth()].slice(0, 3), a: 0, b: 0 });
      }
    }
    const idx = new Map(meses.map((m, i) => [`${m.ano}-${m.mes}`, i]));
    for (const c of colaboradores) {
      const dtA = parseData(c.dataAdmissao);
      if (dtA) {
        const i = idx.get(`${dtA.getFullYear()}-${dtA.getMonth()}`);
        if (i !== undefined) meses[i].a += 1;
      }
      const dtD = parseData(c.dataDesligamento);
      if (dtD) {
        const i = idx.get(`${dtD.getFullYear()}-${dtD.getMonth()}`);
        if (i !== undefined) meses[i].b += 1;
      }
    }
    // O rótulo do mês pode se repetir em 12 meses; resolvemos pelo índice da
    // primeira ocorrência para mapear o clique de volta ao ano/mês corretos.
    const porNome = new Map<string, { ano: number; mes: number }>();
    for (const m of meses) {
      if (!porNome.has(m.nome)) porNome.set(m.nome, { ano: m.ano, mes: m.mes });
    }
    return {
      chart: meses.map((m) => ({ nome: m.nome, a: m.a, b: m.b })),
      porNome,
    };
  }, [colaboradores, filtroMes, filtroAno]);

  // -- Enquadramento salarial --
  const enquadramento = useMemo(() => {
    const cont: Record<string, number> = {
      Crítico: 0,
      Abaixo: 0,
      Dentro: 0,
      Acima: 0,
    };
    for (const c of ativos) {
      const e = d.enquadrarColab(c);
      cont[e] = (cont[e] ?? 0) + 1;
    }
    return Object.entries(cont)
      .filter(([, v]) => v > 0)
      .map(([nome, valor]) => ({
        nome,
        valor,
        cor: COR_POSICAO_FAIXA[nome] ?? "#64748b",
      }));
  }, [ativos, d]);

  // -- Tempo de casa --
  const tempoDeCasa = useMemo(() => {
    return FAIXAS_TEMPO.map((f) => ({
      nome: f.nome,
      cor: f.cor,
      valor: ativos.filter((c) => f.teste(mesesDeCasa(c.dataAdmissao))).length,
    }));
  }, [ativos]);

  // -- Desempenho por setor (média das notas do ciclo) + comparação --
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: ciclos } = useColecao("ciclos");
  const cicloAtual = useMemo(
    () => ciclos.find((c) => c.status === "Aberto") ?? [...ciclos].sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1))[0],
    [ciclos],
  );
  const cicloAnterior = useMemo(() => {
    if (!cicloAtual) return undefined;
    return [...ciclos]
      .filter((c) => c.id !== cicloAtual.id && c.dataInicio < cicloAtual.dataInicio)
      .sort((a, b) => (a.dataInicio < b.dataInicio ? 1 : -1))[0];
  }, [ciclos, cicloAtual]);

  // Mesma população do módulo Desempenho (não-inativos, fora da direção),
  // para a média por setor bater exatamente entre as duas telas.
  const baseDesemp = useMemo(
    () => d.colaboradores.filter((c) => !c.ehDirecao && c.statusId !== "inativo"),
    [d.colaboradores],
  );

  const desempenhoSetor = useMemo(() => {
    // notaFinal (avaliação do gestor) por colaborador, para um dado ciclo
    const notasDoCiclo = (cicloId?: string) => {
      const m = new Map<string, number>();
      if (!cicloId) return m;
      for (const a of avaliacoes) {
        if (a.tipo === "GESTOR" && a.cicloId === cicloId && a.notaFinal != null) m.set(a.colaboradorId, a.notaFinal);
      }
      return m;
    };
    const atual = notasDoCiclo(cicloAtual?.id);
    const anterior = cicloAnterior ? notasDoCiclo(cicloAnterior.id) : null;
    const media = (ns: number[]) => (ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : null);

    const linhas = d.areas
      .filter((a) => a.id !== "direcao")
      .map((a) => {
        const colabs = baseDesemp.filter((c) => c.areaId === a.id);
        const notasA = colabs.map((c) => atual.get(c.id)).filter((n): n is number => n != null);
        const notasP = anterior ? colabs.map((c) => anterior.get(c.id)).filter((n): n is number => n != null) : [];
        return {
          id: a.id, nome: a.nome,
          total: colabs.length, avaliados: notasA.length,
          media: media(notasA), mediaAnterior: anterior ? media(notasP) : null,
        };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => {
        if (a.media == null) return b.media == null ? 0 : 1;
        if (b.media == null) return -1;
        return a.media - b.media; // menor média primeiro = onde atuar
      });

    const todas = [...atual.values()];
    const mediaGeral = media(todas);
    const focoId = linhas.find((l) => l.media != null)?.id;
    return { linhas, mediaGeral, temAnterior: !!cicloAnterior, focoId };
  }, [avaliacoes, baseDesemp, d.areas, cicloAtual, cicloAnterior]);

  const drillDesempSetor = useCallback(
    (areaId: string, nome: string, media: number | null) => {
      const lista = baseDesemp.filter((c) => c.areaId === areaId);
      drill.abrir(`Desempenho — ${nome}`, lista, media != null ? `Média ${media.toFixed(1)} · ${lista.length} colaborador(es)` : `${lista.length} colaborador(es) · sem notas`);
    },
    [baseDesemp, drill],
  );

  // -- Clima (humor) por setor: setores com mais gente desmotivada no topo --
  const climaPorSetor = useMemo(() => {
    const linhas = d.areas
      .filter((a) => a.id !== "direcao")
      .map((a) => {
        const colabs = ativos.filter((c) => c.areaId === a.id);
        const mot = colabs.filter((c) => c.humor === "Motivado").length;
        const est = colabs.filter((c) => c.humor === "Estável").length;
        const desm = colabs.filter((c) => c.humor === "Desmotivado").length;
        return { id: a.id, nome: a.nome, total: colabs.length, mot, est, desm, pctDesm: colabs.length ? desm / colabs.length : 0 };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.pctDesm - a.pctDesm || b.desm - a.desm); // pior clima primeiro
    return { linhas, focoId: linhas.find((l) => l.desm > 0)?.id };
  }, [d.areas, ativos]);

  // -- Risco de saída por setor: setores com mais gente em risco alto no topo --
  const riscoPorSetor = useMemo(() => {
    const linhas = d.areas
      .filter((a) => a.id !== "direcao")
      .map((a) => {
        const colabs = ativos.filter((c) => c.areaId === a.id);
        const baixo = colabs.filter((c) => c.riscoSaida === "Baixo").length;
        const medio = colabs.filter((c) => c.riscoSaida === "Médio").length;
        const alto = colabs.filter((c) => c.riscoSaida === "Alto").length;
        return { id: a.id, nome: a.nome, total: colabs.length, baixo, medio, alto, score: alto * 2 + medio };
      })
      .filter((x) => x.total > 0)
      .sort((a, b) => b.score - a.score || b.alto - a.alto); // mais risco primeiro
    return { linhas, focoId: linhas.find((l) => l.alto > 0)?.id };
  }, [d.areas, ativos]);

  const drillSetorPred = useCallback(
    (areaId: string, nome: string, label: string, pred: (c: Colaborador) => boolean) => {
      const foco = ativos.filter((c) => c.areaId === areaId && pred(c));
      const lista = foco.length ? foco : ativos.filter((c) => c.areaId === areaId);
      drill.abrir(`${nome} — ${label}`, lista, `${lista.length} colaborador(es)`);
    },
    [ativos, drill],
  );

  // -- Drill-down: mapeia o item clicado de volta para os colaboradores --
  const drillFolhaArea = useCallback(
    (nomeCurto: string) => {
      const area = porArea.find((a) => a.nomeCurto === nomeCurto);
      if (!area) return;
      const lista = ativos.filter((c) => c.areaId === area.id);
      drill.abrir(
        `Folha — ${area.nome}`,
        lista,
        `${formatBRL(area.folha)} em folha · ${lista.length} colaborador(es)`,
      );
    },
    [porArea, ativos, drill],
  );

  const drillArea = useCallback(
    (areaId: string, areaNome: string) => {
      const lista = ativos.filter((c) => c.areaId === areaId);
      drill.abrir(`Área — ${areaNome}`, lista, `${lista.length} colaborador(es) ativo(s)`);
    },
    [ativos, drill],
  );

  const drillMovimentacao = useCallback(
    (nomeMes: string) => {
      const ref = movimentacao.porNome.get(nomeMes);
      if (!ref) return;
      const noMes = (dt?: string | null) => {
        const data = parseData(dt); // "YYYY-MM-DD" como data local (evita off-by-one no dia 1)
        if (!data) return false;
        return data.getFullYear() === ref.ano && data.getMonth() === ref.mes;
      };
      const lista = colaboradores.filter(
        (c) => noMes(c.dataAdmissao) || noMes(c.dataDesligamento),
      );
      drill.abrir(
        `Movimentação — ${nomeMes}/${ref.ano}`,
        lista,
        `Admissões e desligamentos em ${MESES_PT[ref.mes]} de ${ref.ano}`,
      );
    },
    [movimentacao, colaboradores, drill],
  );

  const drillEnquadramento = useCallback(
    (label: string) => {
      const lista = ativos.filter((c) => d.enquadrarColab(c) === label);
      drill.abrir(
        `Enquadramento — ${label}`,
        lista,
        `${lista.length} colaborador(es) na posição "${label}"`,
      );
    },
    [ativos, d, drill],
  );

  const drillTempoCasa = useCallback(
    (label: string) => {
      const faixa = FAIXAS_TEMPO.find((f) => f.nome === label);
      if (!faixa) return;
      const lista = ativos.filter((c) => faixa.teste(mesesDeCasa(c.dataAdmissao)));
      drill.abrir(
        `Tempo de casa — ${label}`,
        lista,
        `${lista.length} colaborador(es) com ${label} de empresa`,
      );
    },
    [ativos, drill],
  );

  if (ehRestrito) {
    return (
      <div>
        <PageHeader
          title="Relatórios gerenciais"
          description="Indicadores executivos do quadro de colaboradores."
        />
        <EmptyState
          title="Acesso restrito"
          description="Os relatórios gerenciais estão disponíveis apenas para o RH."
          icon={<Lock className="h-8 w-8" />}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Relatórios gerenciais"
        description="Visão executiva da Impresilk — folha, movimentação e enquadramento. Clique nas barras, fatias e cartões para ver os nomes."
      />

      {/* Filtro de período — controla movimentação e turnover */}
      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Período</span>
        <select
          value={filtroMes}
          onChange={(e) => setFiltroMes(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          aria-label="Mês"
        >
          <option value={0}>Ano inteiro</option>
          {MESES_PT.map((nome, i) => (
            <option key={i} value={i + 1}>{nome}</option>
          ))}
        </select>
        <select
          value={filtroAno}
          onChange={(e) => setFiltroAno(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          aria-label="Ano"
        >
          {anosDisponiveis.map((ano) => (
            <option key={ano} value={ano}>{ano}</option>
          ))}
        </select>
        <span className="hidden text-xs text-slate-400 sm:inline">
          Movimentação e turnover: {rotuloPeriodo} · folha e quadro mostram a posição atual
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              "Headcount ativo",
              ativos,
              `${ativos.length} colaborador(es) no quadro`,
            )
          }
        >
          <StatCard
            label="Headcount ativo"
            value={indicadores.headcount}
            icon={<Users className="h-5 w-5" />}
            accent="brand"
            hint="Colaboradores que contam no quadro"
          />
        </button>
        <button
          type="button"
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              "Folha total",
              ativos.filter((c) => typeof c.salario === "number"),
              `${formatBRL(indicadores.folha)} em folha mensal`,
            )
          }
        >
          <StatCard
            label="Folha total"
            value={<span className="text-xl">{formatBRL(indicadores.folha)}</span>}
            icon={<Wallet className="h-5 w-5" />}
            accent="gold"
            hint="Soma dos salários ativos"
          />
        </button>
        <button
          type="button"
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              "Custo médio",
              ativos.filter((c) => typeof c.salario === "number"),
              `${formatBRL(indicadores.custoMedio)} por colaborador`,
            )
          }
        >
          <StatCard
            label="Custo médio"
            value={
              <span className="text-xl">{formatBRL(indicadores.custoMedio)}</span>
            }
            icon={<Coins className="h-5 w-5" />}
            accent="blue"
            hint="Salário médio por colaborador"
          />
        </button>
        <button
          type="button"
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              `Desligamentos · ${rotuloPeriodo}`,
              periodo.deslig,
              `${periodo.deslig.length} desligamento(s) · ${periodo.admit.length} admissão(ões) no período`,
            )
          }
        >
          <StatCard
            label={`Turnover · ${rotuloPeriodo}`}
            value={formatPercent(periodo.turnover)}
            icon={<TrendingDown className="h-5 w-5" />}
            accent="amber"
            hint={`${periodo.deslig.length} deslig. · ${periodo.admit.length} adm. no período`}
          />
        </button>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Folha real (pagamentos)"
            subtitle={`Só dos ativos · ${rotuloPeriodo}. Clique numa barra para ver quem foi pago.`}
            icon={<Wallet className="h-[18px] w-[18px]" />}
            action={
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {(["caixa", "competencia"] as const).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBaseFolha(b)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-xs font-medium capitalize transition",
                      baseFolha === b ? "bg-white text-brand shadow-sm" : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {b === "caixa" ? "Caixa" : "Competência"}
                  </button>
                ))}
              </div>
            }
          />
          <CardBody className="space-y-4">
            {/* Em cima: salário de carteira (contrato) × folha real paga no período */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">Salário de carteira (contrato) · atual</p>
                <p className="mt-0.5 text-2xl font-semibold text-gold-700">{formatBRL(indicadores.folha)}</p>
                <p className="text-xs text-slate-400">Soma dos salários registrados dos ativos</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Folha real · {baseFolha === "caixa" ? "caixa" : "competência"} · {rotuloPeriodo}
                </p>
                <p className="mt-0.5 text-2xl font-semibold text-brand-ink">{formatBRL(folhaAtual.total)}</p>
                <p className="text-xs text-slate-400">
                  {baseFolha === "caixa" ? "Pelo dia em que o pagamento saiu (caixa)" : "Pelo mês de competência (referência)"}
                </p>
              </div>
            </div>
            {folhaReal.temDados ? (
              <BarrasVerticais
                data={folhaAtual.serie}
                moeda
                cor="#16334f"
                onItemClick={drillFolhaReal}
              />
            ) : (
              <EmptyState
                title="Sem pagamentos enviados"
                description="Suba a folha no módulo Custos de Colaboradores (espaço “Pagamentos”) para ver a folha real mês a mês."
                icon={<Wallet className="h-8 w-8" />}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Folha por área"
            subtitle="Custo mensal de pessoal por área (R$)"
            icon={<BarChart3 className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {folhaPorAreaChart.length ? (
              <BarrasVerticais
                data={folhaPorAreaChart}
                moeda
                cor="#c2a14d"
                onItemClick={drillFolhaArea}
              />
            ) : (
              <EmptyState title="Sem dados de folha" />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Custo médio por área"
            subtitle="Headcount, folha e custo médio"
            icon={<Building2 className="h-[18px] w-[18px]" />}
          />
          <CardBody className="p-0">
            {porArea.length ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>
                      <th className="th">Área</th>
                      <th className="th text-right">HC</th>
                      <th className="th text-right">Folha</th>
                      <th className="th text-right">Custo médio</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porArea.map((a) => (
                      <tr
                        key={a.id}
                        className="cursor-pointer transition hover:bg-slate-50/60"
                        onClick={() => drillArea(a.id, a.nome)}
                        title={`Ver colaboradores de ${a.nome}`}
                      >
                        <td className="td font-medium text-slate-700">
                          {a.nome}
                        </td>
                        <td className="td text-right text-slate-600">
                          {a.headcount}
                        </td>
                        <td className="td text-right text-slate-600">
                          {formatBRL(a.folha)}
                        </td>
                        <td className="td text-right text-slate-600">
                          {formatBRL(a.custoMedio)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50/60">
                    <tr>
                      <td className="td font-semibold text-slate-700">Total</td>
                      <td className="td text-right font-semibold text-slate-700">
                        {indicadores.headcount}
                      </td>
                      <td className="td text-right font-semibold text-slate-700">
                        {formatBRL(indicadores.folha)}
                      </td>
                      <td className="td text-right font-semibold text-slate-700">
                        {formatBRL(indicadores.custoMedio)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <EmptyState title="Sem dados por área" />
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Desempenho por setor"
            subtitle={
              cicloAtual
                ? `Média das notas — ${cicloAtual.nome}${desempenhoSetor.temAnterior && cicloAnterior ? ` · comparado a ${cicloAnterior.nome}` : ""}. Do menor para o maior — comece a atuar pelo topo.`
                : "Média das notas de desempenho por setor"
            }
            icon={<Gauge className="h-[18px] w-[18px]" />}
          />
          <CardBody className="p-0">
            {desempenhoSetor.mediaGeral == null ? (
              <div className="p-5">
                <EmptyState title="Sem notas lançadas" description="Lance avaliações no módulo Desempenho para ver a média por setor." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-slate-100 bg-slate-50/50">
                    <tr>
                      <th className="th">Setor</th>
                      <th className="th text-right">Avaliados</th>
                      <th className="th text-right">Média</th>
                      <th className="th text-right">vs. média geral</th>
                      {desempenhoSetor.temAnterior && <th className="th text-right">vs. ciclo anterior</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {desempenhoSetor.linhas.map((l) => {
                      const cor = l.media == null ? "#94a3b8" : corNota(l.media);
                      const foco = l.media != null && l.id === desempenhoSetor.focoId;
                      const dGeral = l.media != null && desempenhoSetor.mediaGeral != null ? l.media - desempenhoSetor.mediaGeral : null;
                      const dAnt = l.media != null && l.mediaAnterior != null ? l.media - l.mediaAnterior : null;
                      return (
                        <tr
                          key={l.id}
                          className="cursor-pointer transition hover:bg-slate-50/60"
                          onClick={() => drillDesempSetor(l.id, l.nome, l.media)}
                          title={`Ver colaboradores de ${l.nome}`}
                        >
                          <td className="td">
                            <span className="flex items-center gap-2 font-medium text-slate-700">
                              {l.nome}
                              {foco && <Badge variant="warning">Atue aqui</Badge>}
                            </span>
                          </td>
                          <td className="td text-right text-slate-500 tabular-nums">{l.avaliados}/{l.total}</td>
                          <td className="td text-right">
                            <span className="font-semibold tabular-nums" style={{ color: cor }}>
                              {l.media != null ? l.media.toFixed(1) : "—"}
                            </span>
                          </td>
                          <td className="td text-right"><Delta v={dGeral} /></td>
                          {desempenhoSetor.temAnterior && <td className="td text-right"><Delta v={dAnt} /></td>}
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t border-slate-200 bg-slate-50/60">
                    <tr>
                      <td className="td font-semibold text-slate-700">Média geral</td>
                      <td className="td" />
                      <td className="td text-right font-semibold tabular-nums" style={{ color: desempenhoSetor.mediaGeral != null ? corNota(desempenhoSetor.mediaGeral) : undefined }}>
                        {desempenhoSetor.mediaGeral != null ? desempenhoSetor.mediaGeral.toFixed(1) : "—"}
                      </td>
                      <td className="td" />
                      {desempenhoSetor.temAnterior && <td className="td" />}
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Clima por setor"
            subtitle="Motivados, estáveis e desmotivados — setor com mais desmotivados no topo."
            icon={<HeartPulse className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {climaPorSetor.linhas.length === 0 ? (
              <EmptyState title="Sem dados de clima" />
            ) : (
              <div className="space-y-2">
                {climaPorSetor.linhas.map((l) => (
                  <LinhaSetorDistrib
                    key={l.id}
                    nome={l.nome}
                    foco={l.desm > 0 && l.id === climaPorSetor.focoId}
                    total={l.mot + l.est + l.desm}
                    segs={[
                      { label: "Motivados", valor: l.mot, cor: COR_HUMOR.Motivado },
                      { label: "Estáveis", valor: l.est, cor: COR_HUMOR.Estável },
                      { label: "Desmotivados", valor: l.desm, cor: COR_HUMOR.Desmotivado },
                    ]}
                    onClick={() => drillSetorPred(l.id, l.nome, "desmotivados", (c) => c.humor === "Desmotivado")}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Risco de saída por setor"
            subtitle="Baixo, médio e alto risco — setor com mais risco alto no topo."
            icon={<DoorOpen className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {riscoPorSetor.linhas.length === 0 ? (
              <EmptyState title="Sem dados de risco" />
            ) : (
              <div className="space-y-2">
                {riscoPorSetor.linhas.map((l) => (
                  <LinhaSetorDistrib
                    key={l.id}
                    nome={l.nome}
                    foco={l.alto > 0 && l.id === riscoPorSetor.focoId}
                    total={l.baixo + l.medio + l.alto}
                    segs={[
                      { label: "Baixo", valor: l.baixo, cor: COR_RISCO.Baixo },
                      { label: "Médio", valor: l.medio, cor: COR_RISCO.Médio },
                      { label: "Alto", valor: l.alto, cor: COR_RISCO.Alto },
                    ]}
                    onClick={() => drillSetorPred(l.id, l.nome, "risco alto", (c) => c.riscoSaida === "Alto")}
                  />
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Movimentação"
            subtitle={filtroMes === 0 ? `Admissões e desligamentos · ${filtroAno}` : `Admissões e desligamentos · 12 meses até ${rotuloPeriodo}`}
            icon={<CalendarRange className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            <div className="mb-3 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-green-700">{periodo.admit.length}</p>
                <p className="text-xs text-slate-500">Admissões · {rotuloPeriodo}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                <p className="text-lg font-semibold text-red-600">{periodo.deslig.length}</p>
                <p className="text-xs text-slate-500">Desligamentos · {rotuloPeriodo}</p>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
                <p className={`text-lg font-semibold ${periodo.saldo >= 0 ? "text-green-700" : "text-red-600"}`}>{periodo.saldo >= 0 ? "+" : ""}{periodo.saldo}</p>
                <p className="text-xs text-slate-500">Saldo no período</p>
              </div>
            </div>
            <BarrasDuplas
              data={movimentacao.chart}
              serieA={{ nome: "Admissões", cor: "#16a34a" }}
              serieB={{ nome: "Desligamentos", cor: "#dc2626" }}
              onItemClick={drillMovimentacao}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Enquadramento salarial"
            subtitle="Posição frente à faixa do cargo"
            icon={<PieChart className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {enquadramento.length ? (
              <Rosca data={enquadramento} onItemClick={drillEnquadramento} />
            ) : (
              <EmptyState title="Sem dados" />
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Tempo de casa"
            subtitle="Distribuição do quadro ativo por tempo de empresa"
            icon={<Clock className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            <BarrasColoridas data={tempoDeCasa} onItemClick={drillTempoCasa} />
          </CardBody>
        </Card>
      </div>

      <DrillModal {...drill.props} />
    </div>
  );
}
