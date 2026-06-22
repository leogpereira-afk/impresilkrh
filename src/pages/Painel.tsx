import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Users, TrendingDown, TrendingUp, FileWarning, ClipboardCheck, Palmtree, Cake,
  AlertTriangle, CalendarClock, Award, Target, Laugh, Brain, PartyPopper,
  Wallet, ShieldAlert, GraduationCap, UserX,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, DotBadge } from "@/components/ui/badge";
import { EmptyState, Progress } from "@/components/ui/misc";
import { BarrasColoridas, BarrasVerticais, Rosca } from "@/components/charts/charts";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { HumorIndicador, PerfilComportamentalBadge } from "@/components/ui/indicadores";
import { useColecao } from "@/lib/store";
import { useDominio, contaHeadcount } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis } from "@/lib/rbac";
import { formatBRL, formatPercent, formatDate, MESES_PT } from "@/lib/format";
import { ARQUETIPOS, COR_POSICAO_FAIXA, COR_RISCO, JANELA_ALERTA_DIAS, COR_HUMOR, COR_PERFIL_COMPORTAMENTAL, HUMORES, PERFIS_COMPORTAMENTAIS } from "@/lib/constants";
import { HOJE } from "@/data/_gen";

const dias = (d?: string | null) => (d ? Math.round((new Date(d).getTime() - HOJE.getTime()) / 86400000) : NaN);
const mesesAtras = (d?: string | null) => (d ? (HOJE.getTime() - new Date(d).getTime()) / (86400000 * 30.44) : Infinity);

// dd/MM (dois dígitos) a partir de uma data ISO. Ex.: 02/06.
const ddmm = (iso?: string | null) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return "—";
  const dia = String(dt.getDate()).padStart(2, "0");
  const mes = String(dt.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}`;
};

// Abreviação de mês (3 letras) a partir de MESES_PT. Ex.: "Janeiro" -> "Jan".
const mesAbrev = (idx: number) => MESES_PT[((idx % 12) + 12) % 12].slice(0, 3);

export default function Painel() {
  const sessao = useSessao();
  const d = useDominio();
  const drill = useDrill();
  const { items: documentos } = useColecao("documentos");
  const { items: ferias } = useColecao("ferias");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: advertencias } = useColecao("advertencias");
  const { items: treinamentos } = useColecao("treinamentos");

  // ---------- Filtro por mês e ano (v3) ----------
  // mes === 0 => "Ano inteiro". Padrão = mês/ano de HOJE.
  const [filtroMes, setFiltroMes] = useState<number>(HOJE.getMonth() + 1);
  const [filtroAno, setFiltroAno] = useState<number>(HOJE.getFullYear());
  // Inativos só aparecem quando explicitamente marcado (padrão DESLIGADO).
  const [incluirInativos, setIncluirInativos] = useState<boolean>(false);

  const escopoBruto = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores),
    [sessao, d.colaboradores],
  );

  if (sessao?.perfil === "COLABORADOR") {
    return <PainelPessoal />;
  }

  // Anos disponíveis para o seletor (admissões/desligamentos do escopo + ano corrente).
  const anosSet = new Set<number>([HOJE.getFullYear()]);
  escopoBruto.forEach((c) => {
    if (c.dataAdmissao) anosSet.add(new Date(c.dataAdmissao).getFullYear());
    if (c.dataDesligamento) anosSet.add(new Date(c.dataDesligamento).getFullYear());
  });
  const anosDisponiveis = [...anosSet].filter((a) => !isNaN(a)).sort((a, b) => b - a);

  // Período selecionado: testa se uma data ISO cai no mês/ano do filtro (ou no ano inteiro).
  const noPeriodo = (iso?: string | null) => {
    if (!iso) return false;
    const dt = new Date(iso);
    if (isNaN(dt.getTime())) return false;
    if (dt.getFullYear() !== filtroAno) return false;
    return filtroMes === 0 ? true : dt.getMonth() + 1 === filtroMes;
  };
  const rotuloPeriodo = filtroMes === 0 ? `Ano inteiro · ${filtroAno}` : `${MESES_PT[filtroMes - 1]}/${filtroAno}`;

  // Escopo visível: por padrão NENHUM inativo aparece. Só inclui quando o toggle está ligado.
  const escopo = incluirInativos ? escopoBruto : escopoBruto.filter((c) => c.statusId !== "inativo");
  const inativos = escopoBruto.filter((c) => c.statusId === "inativo");

  const ids = new Set(escopo.map((c) => c.id));
  const ativos = escopo.filter((c) => contaHeadcount(c, d.statusById));

  // ---------- Métricas de PERÍODO (respeitam o filtro de mês/ano) ----------
  const admitidosPeriodo = escopo.filter((c) => noPeriodo(c.dataAdmissao));
  const desligadosPeriodo = escopo.filter((c) => noPeriodo(c.dataDesligamento));
  const admissoesPeriodo = admitidosPeriodo.length;
  const desligamentosPeriodo = desligadosPeriodo.length;

  const desligados12m = escopo.filter((c) => c.dataDesligamento && mesesAtras(c.dataDesligamento) <= 12);
  const desligamentos12m = desligados12m.length;
  const turnover = ativos.length + desligamentos12m > 0 ? desligamentos12m / ((ativos.length + (ativos.length + desligamentos12m)) / 2) : 0;

  const docsAlerta = documentos.filter((doc) => ids.has(doc.colaboradorId) && doc.dataVencimento && dias(doc.dataVencimento) <= JANELA_ALERTA_DIAS);
  const docsVencidos = docsAlerta.filter((doc) => dias(doc.dataVencimento) < 0);

  const feriasAtivas = ferias.filter((f) => ids.has(f.colaboradorId) && f.status === "Em andamento");
  const proximosRetornos = ferias
    .filter((f) => ids.has(f.colaboradorId) && f.status === "Em andamento" && f.dataRetorno && dias(f.dataRetorno) >= 0)
    .sort((a, b) => dias(a.dataRetorno) - dias(b.dataRetorno));

  const cicloAvaliados = new Set(avaliacoes.filter((a) => a.tipo === "GESTOR").map((a) => a.colaboradorId));
  const avaliacoesPendentes = ativos.filter((c) => !cicloAvaliados.has(c.id));
  const elegiveis = avaliacoes.filter((a) => a.elegivelPromocao && ids.has(a.colaboradorId));

  // Mês de referência para aniversários: o mês do filtro (ou HOJE quando "Ano inteiro").
  const mesAniversario = filtroMes === 0 ? HOJE.getMonth() + 1 : filtroMes;
  const aniversariantes = ativos
    .filter((c) => c.dataNascimento && new Date(c.dataNascimento).getMonth() + 1 === mesAniversario)
    .sort((a, b) => new Date(a.dataNascimento!).getDate() - new Date(b.dataNascimento!).getDate());

  const risco = { Alto: 0, Médio: 0, Baixo: 0 } as Record<string, number>;
  ativos.forEach((c) => (risco[c.riscoSaida ?? "Baixo"] = (risco[c.riscoSaida ?? "Baixo"] ?? 0) + 1));

  // Advertências no escopo — colaboradores que possuem ao menos uma advertência
  const advertenciasEscopo = advertencias.filter((a) => ids.has(a.colaboradorId));
  const idsComAdvertencia = new Set(advertenciasEscopo.map((a) => a.colaboradorId));
  const colabsComAdvertencia = escopo.filter((c) => idsComAdvertencia.has(c.id));

  // ---------- Folha de pagamento (somente Administrador de RH) ----------
  const folhaDe = (c: { salario?: number | null; adicionais?: number }) => (c.salario ?? 0) + (c.adicionais ?? 0);
  // Folha do mês corrente = soma sobre os colaboradores ativos (headcount).
  const folhaTotal = ativos.reduce((acc, c) => acc + folhaDe(c), 0);
  // Estimativa da folha do mês anterior:
  //  - exclui admitidos nos últimos 30 dias (ainda não estavam na folha)
  //  - soma de volta os desligados nos últimos 30 dias (ainda estavam na folha)
  const admitidosUlt30 = ativos.filter((c) => dias(c.dataAdmissao) >= -30);
  const desligadosUlt30 = escopo.filter((c) => c.dataDesligamento && dias(c.dataDesligamento) >= -30);
  const folhaMesAnterior =
    folhaTotal - admitidosUlt30.reduce((acc, c) => acc + folhaDe(c), 0) + desligadosUlt30.reduce((acc, c) => acc + folhaDe(c), 0);
  const folhaVariacao = folhaTotal - folhaMesAnterior;
  const folhaVariacaoPct = folhaMesAnterior !== 0 ? folhaVariacao / folhaMesAnterior : 0;
  const folhaSubiu = folhaVariacao >= 0;
  // Abertura por setor (setor = área; exceto "direcao")
  const folhaPorArea = d.areas
    .filter((a) => a.id !== "direcao")
    .map((a) => {
      const pessoas = ativos.filter((c) => c.areaId === a.id);
      return { id: a.id, nome: a.nome.split(" ")[0], nomeCompleto: a.nome, pessoas: pessoas.length, folha: pessoas.reduce((acc, c) => acc + folhaDe(c), 0) };
    })
    .filter((x) => x.folha > 0)
    .sort((a, b) => b.folha - a.folha);
  const folhaBarras = folhaPorArea.map((x) => ({ nome: x.nome, valor: x.folha }));
  const abrirFolhaArea = (id: string, nomeCompleto: string) =>
    drill.abrir(`Folha · ${nomeCompleto}`, ativos.filter((c) => c.areaId === id), "Composição da folha");
  const abrirFolhaPorRotulo = (nome: string) => {
    const area = folhaPorArea.find((x) => x.nome === nome);
    if (area) abrirFolhaArea(area.id, area.nomeCompleto);
  };

  // ---------- Folha comparativa mês a mês (últimos 6 meses até o mês selecionado) ----------
  // Estima a folha de cada mês somando (salario+adicionais) dos colaboradores que já
  // estavam ATIVOS naquele mês: admitidos até o fim do mês e não desligados antes do início.
  const baseFolhaMes = filtroMes === 0 ? HOJE.getMonth() + 1 : filtroMes;
  const folhaComparativa = Array.from({ length: 6 }, (_, k) => {
    const offset = 5 - k; // mais antigo -> mais recente
    const ref = new Date(filtroAno, baseFolhaMes - 1 - offset, 1);
    const inicioMes = new Date(ref.getFullYear(), ref.getMonth(), 1).getTime();
    const fimMes = new Date(ref.getFullYear(), ref.getMonth() + 1, 1).getTime() - 1;
    const valor = escopo.reduce((acc, c) => {
      const adm = c.dataAdmissao ? new Date(c.dataAdmissao).getTime() : NaN;
      if (isNaN(adm) || adm > fimMes) return acc; // ainda não admitido no fim do mês
      const desl = c.dataDesligamento ? new Date(c.dataDesligamento).getTime() : null;
      if (desl !== null && desl < inicioMes) return acc; // já desligado antes do início do mês
      return acc + folhaDe(c);
    }, 0);
    return { nome: mesAbrev(ref.getMonth()), valor };
  });

  // ---------- Treinamento (v3) ----------
  // Considera apenas treinamentos de colaboradores ATIVOS (no escopo de headcount).
  const idsAtivos = new Set(ativos.map((c) => c.id));
  const treinosEscopo = treinamentos.filter((t) => idsAtivos.has(t.colaboradorId));
  const treinosAbertos = treinosEscopo.filter((t) => t.status !== "Concluído");
  const idsEmTreinamento = new Set(treinosAbertos.map((t) => t.colaboradorId));
  const emTreinamento = ativos.filter((c) => idsEmTreinamento.has(c.id));
  // "O que precisa treinar" — top títulos com treinamentos ainda não concluídos.
  const treinoPorTitulo = new Map<string, number>();
  treinosAbertos.forEach((t) => treinoPorTitulo.set(t.titulo, (treinoPorTitulo.get(t.titulo) ?? 0) + 1));
  const topTreinos = [...treinoPorTitulo.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  const porArea = d.areas
    .filter((a) => a.id !== "direcao")
    .map((a) => ({ nome: a.nome.split(" ")[0], valor: ativos.filter((c) => c.areaId === a.id).length }))
    .filter((x) => x.valor > 0);
  const porNivel = d.niveis.map((n) => ({ nome: n.codigo, valor: ativos.filter((c) => c.nivelId === n.id).length }));
  const enquadCont: Record<string, number> = { Crítico: 0, Abaixo: 0, Dentro: 0, Acima: 0 };
  ativos.forEach((c) => {
    const e = d.enquadrarColab(c);
    enquadCont[e] = (enquadCont[e] ?? 0) + 1;
  });
  const enquadData = Object.entries(enquadCont).filter(([, v]) => v > 0).map(([nome, valor]) => ({ nome, valor, cor: COR_POSICAO_FAIXA[nome] }));

  // Clima / engajamento — distribuição de humor entre os ativos
  const humorCont: Record<string, number> = { Motivado: 0, Estável: 0, Desmotivado: 0, "Não informado": 0 };
  ativos.forEach((c) => {
    const h = c.humor && HUMORES.includes(c.humor as (typeof HUMORES)[number]) ? c.humor : "Não informado";
    humorCont[h] = (humorCont[h] ?? 0) + 1;
  });
  const humorData = Object.entries(humorCont)
    .filter(([, v]) => v > 0)
    .map(([nome, valor]) => ({ nome, valor, cor: COR_HUMOR[nome] ?? "#94a3b8" }));
  const pctMotivado = ativos.length ? Math.round(((humorCont.Motivado ?? 0) / ativos.length) * 100) : 0;

  // Perfil comportamental — distribuição dos 4 temperamentos entre os ativos.
  // Exibimos o ARQUÉTIPO correspondente (ex.: "O Executor") no lugar do temperamento.
  const perfilCont: Record<string, number> = {};
  PERFIS_COMPORTAMENTAIS.forEach((p) => (perfilCont[p] = 0));
  ativos.forEach((c) => {
    const p = c.perfilComportamental && PERFIS_COMPORTAMENTAIS.includes(c.perfilComportamental as (typeof PERFIS_COMPORTAMENTAIS)[number]) ? c.perfilComportamental : "Não informado";
    perfilCont[p] = (perfilCont[p] ?? 0) + 1;
  });
  // Rótulo exibido = arquétipo (quando houver); guarda o mapa rótulo -> temperamento para o drill.
  const rotuloArquetipo = (temp: string) => ARQUETIPOS[temp]?.arquetipo ?? temp;
  const arquetipoParaTemp = new Map<string, string>();
  const perfilData = Object.entries(perfilCont)
    .filter(([, v]) => v > 0)
    .map(([temp, valor]) => {
      const nome = rotuloArquetipo(temp);
      arquetipoParaTemp.set(nome, temp);
      return { nome, valor, cor: COR_PERFIL_COMPORTAMENTAL[temp] ?? "#94a3b8" };
    });

  // Aniversário de empresa (tempo de casa) — admitidos no mês de referência
  const anosDeCasa = (d?: string | null) => (d ? HOJE.getFullYear() - new Date(d).getFullYear() : 0);
  const aniversariosEmpresa = ativos
    .filter((c) => c.dataAdmissao && new Date(c.dataAdmissao).getMonth() + 1 === mesAniversario)
    .sort((a, b) => new Date(a.dataAdmissao!).getDate() - new Date(b.dataAdmissao!).getDate());

  // Mapeia o rótulo clicado de volta para os colaboradores ativos correspondentes
  const colabsPorArea = (nome: string) => {
    const area = d.areas.find((a) => a.id !== "direcao" && a.nome.split(" ")[0] === nome);
    return area ? ativos.filter((c) => c.areaId === area.id) : [];
  };
  const colabsPorNivel = (codigo: string) => {
    const nivel = d.niveis.find((n) => n.codigo === codigo);
    return nivel ? ativos.filter((c) => c.nivelId === nivel.id) : [];
  };
  const colabsPorEnquadramento = (nome: string) => ativos.filter((c) => d.enquadrarColab(c) === nome);
  const colabsPorRisco = (rotulo: string) => {
    const chave = rotulo.replace("Risco ", "").replace(/^./, (s) => s.toUpperCase()); // "Risco alto" -> "Alto"
    return ativos.filter((c) => (c.riscoSaida ?? "Baixo") === chave);
  };
  const colabsPorHumor = (nome: string) =>
    ativos.filter((c) => (c.humor && HUMORES.includes(c.humor as (typeof HUMORES)[number]) ? c.humor : "Não informado") === nome);
  // O rótulo clicado é o arquétipo; converte de volta para o temperamento antes de filtrar.
  const colabsPorPerfil = (rotulo: string) => {
    const temp = arquetipoParaTemp.get(rotulo) ?? rotulo;
    return ativos.filter((c) => (c.perfilComportamental && PERFIS_COMPORTAMENTAIS.includes(c.perfilComportamental as (typeof PERFIS_COMPORTAMENTAIS)[number]) ? c.perfilComportamental : "Não informado") === temp);
  };

  return (
    <div>
      <PageHeader
        title={`Painel de RH`}
        description={sessao?.perfil === "GESTOR" ? "Visão da sua equipe (hierarquia recursiva)." : "Visão geral do quadro de colaboradores da Impresilk."}
      />

      {/* ---------- Filtro por mês/ano + inativos (v3) ---------- */}
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
        <span className="hidden text-xs text-slate-400 sm:inline">Métricas de período: {rotuloPeriodo}</span>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={incluirInativos}
            onChange={(e) => setIncluirInativos(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Incluir inativos
          {inativos.length > 0 && <span className="text-xs text-slate-400">({inativos.length})</span>}
        </label>
      </div>

      {sessao?.perfil === "ADMIN_RH" && (
        <div className="mb-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <StatCard
              label="Folha de pagamento do mês"
              value={formatBRL(folhaTotal)}
              icon={<Wallet className="h-5 w-5" />}
              accent="gold"
              hint={`${ativos.length} colaborador(es) · salário + adicionais`}
              trend={{ value: `${folhaSubiu ? "+" : "−"}${formatBRL(Math.abs(folhaVariacao))} (${formatPercent(Math.abs(folhaVariacaoPct))}) vs. mês anterior`, positivo: folhaSubiu }}
            />
            <Card className="lg:col-span-2">
              <CardHeader title="Folha por setor" subtitle="Clique no gráfico ou na linha para ver a composição" icon={<Wallet className="h-[18px] w-[18px]" />} />
              <CardBody>
                {folhaPorArea.length === 0 ? (
                  <EmptyState title="Sem dados de folha" />
                ) : (
                  <div className="grid gap-4 lg:grid-cols-2">
                    <BarrasVerticais data={folhaBarras} moeda cor="#c2a14d" onItemClick={abrirFolhaPorRotulo} />
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-100">
                          <tr>
                            <th className="th">Setor</th>
                            <th className="th text-right">Pessoas</th>
                            <th className="th text-right">Folha</th>
                            <th className="th text-right">% total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {folhaPorArea.map((x) => (
                            <tr
                              key={x.id}
                              className="cursor-pointer hover:bg-slate-50/60"
                              onClick={() => abrirFolhaArea(x.id, x.nomeCompleto)}
                            >
                              <td className="td font-medium text-slate-700">{x.nomeCompleto}</td>
                              <td className="td text-right text-slate-500">{x.pessoas}</td>
                              <td className="td text-right text-slate-700">{formatBRL(x.folha)}</td>
                              <td className="td text-right text-slate-500">{formatPercent(folhaTotal ? x.folha / folhaTotal : 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="border-t border-slate-200">
                          <tr>
                            <td className="td font-semibold text-brand-ink">Total</td>
                            <td className="td text-right font-semibold text-brand-ink">{ativos.length}</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(folhaTotal)}</td>
                            <td className="td text-right font-semibold text-brand-ink">100%</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
          <div className="mt-4">
            <Card>
              <CardHeader
                title="Folha comparativa mês a mês"
                subtitle={`Últimos 6 meses até ${mesAbrev(baseFolhaMes - 1)}/${filtroAno} · estimativa por ativos no mês`}
                icon={<Wallet className="h-[18px] w-[18px]" />}
              />
              <CardBody>
                <BarrasVerticais data={folhaComparativa} moeda cor="#16334f" altura={240} />
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Headcount ativo", ativos, "Colaboradores que contam no quadro")}>
          <StatCard label="Headcount ativo" value={ativos.length} icon={<Users className="h-5 w-5" />} accent="brand" hint="Colaboradores que contam no quadro" />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir(`Admissões · ${rotuloPeriodo}`, admitidosPeriodo, `Admitidos em ${rotuloPeriodo}`)}>
          <StatCard label="Admissões no período" value={admissoesPeriodo} icon={<TrendingUp className="h-5 w-5" />} accent="green" hint={rotuloPeriodo} />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir(`Desligamentos · ${rotuloPeriodo}`, desligadosPeriodo, `Desligados em ${rotuloPeriodo}`)}>
          <StatCard label="Desligamentos no período" value={desligamentosPeriodo} icon={<TrendingDown className="h-5 w-5" />} accent="red" hint={rotuloPeriodo} />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Turnover 12m", desligados12m, "Desligamentos que compõem o índice")}>
          <StatCard label="Turnover 12m" value={`${(turnover * 100).toFixed(1)}%`} icon={<TrendingDown className="h-5 w-5" />} accent="amber" hint="Índice móvel · 12 meses" />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Em treinamento", emTreinamento, "Colaboradores com treinamento em aberto")}>
          <StatCard label="Em treinamento" value={emTreinamento.length} hint={`${treinosAbertos.length} treinamento(s) em aberto`} icon={<GraduationCap className="h-5 w-5" />} accent="blue" />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Documentos a vencer", escopo.filter((c) => docsAlerta.some((doc) => doc.colaboradorId === c.id)), `${docsAlerta.length} documento(s) · ${docsVencidos.length} vencido(s)`)}>
          <StatCard label="Documentos a vencer" value={docsAlerta.length} hint={`${docsVencidos.length} vencido(s)`} icon={<FileWarning className="h-5 w-5" />} accent={docsVencidos.length ? "red" : "amber"} />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Avaliações pendentes", avaliacoesPendentes, "Ciclo 2026.1 · ainda sem avaliação do gestor")}>
          <StatCard label="Avaliações pendentes" value={avaliacoesPendentes.length} icon={<ClipboardCheck className="h-5 w-5" />} accent="blue" />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("De férias agora", escopo.filter((c) => feriasAtivas.some((f) => f.colaboradorId === c.id)), "Colaboradores em período de férias")}>
          <StatCard label="De férias agora" value={feriasAtivas.length} icon={<Palmtree className="h-5 w-5" />} accent="green" />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Com advertência", colabsComAdvertencia, `${advertenciasEscopo.length} advertência(s) registrada(s)`)}>
          <StatCard label="Advertências" value={advertenciasEscopo.length} hint={`${colabsComAdvertencia.length} colaborador(es)`} icon={<ShieldAlert className="h-5 w-5" />} accent="amber" />
        </button>
        <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Risco de saída alto", colabsPorRisco("Risco alto"), "Atenção à retenção de talentos")}>
          <StatCard label="Risco de saída alto" value={risco.Alto ?? 0} icon={<AlertTriangle className="h-5 w-5" />} accent="red" />
        </button>
        {incluirInativos && (
          <button type="button" className="text-left w-full transition-transform hover:-translate-y-0.5" onClick={() => drill.abrir("Inativos", inativos, "Colaboradores inativos (fora das contagens por padrão)")}>
            <StatCard label="Inativos" value={inativos.length} hint="Exibidos por inclusão manual" icon={<UserX className="h-5 w-5" />} accent="amber" />
          </button>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Colaboradores por área" subtitle="Clique para ver os nomes" icon={<Users className="h-[18px] w-[18px]" />} />
          <CardBody><BarrasVerticais data={porArea} onItemClick={(nome) => drill.abrir(`Área · ${nome}`, colabsPorArea(nome))} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Distribuição por nível" subtitle="Régua de senioridade N1–N5" />
          <CardBody><BarrasVerticais data={porNivel} cor="#c2a14d" onItemClick={(nome) => drill.abrir(`Nível ${nome}`, colabsPorNivel(nome))} /></CardBody>
        </Card>
        <Card>
          <CardHeader title="Enquadramento salarial" subtitle="Posição frente à faixa do cargo" />
          <CardBody>{enquadData.length ? <Rosca data={enquadData} onItemClick={(nome) => drill.abrir(`Enquadramento · ${nome}`, colabsPorEnquadramento(nome))} /> : <EmptyState title="Sem dados" />}</CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="Clima / Engajamento" subtitle="Humor declarado da equipe" icon={<Laugh className="h-[18px] w-[18px]" />} />
          <CardBody>
            {humorData.length ? (
              <>
                <Rosca data={humorData} onItemClick={(nome) => drill.abrir(`Clima · ${nome}`, colabsPorHumor(nome))} />
                <p className="mt-1 text-center text-xs text-slate-500"><span className="font-semibold text-green-600">{pctMotivado}%</span> motivados</p>
              </>
            ) : (
              <EmptyState title="Sem dados de clima" />
            )}
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="Perfil comportamental" subtitle="Distribuição por arquétipo (4 temperamentos)" icon={<Brain className="h-[18px] w-[18px]" />} />
          <CardBody>
            {perfilData.length ? (
              <BarrasColoridas data={perfilData} onItemClick={(nome) => drill.abrir(`Perfil · ${nome}`, colabsPorPerfil(nome))} />
            ) : (
              <EmptyState title="Sem dados de perfil" />
            )}
          </CardBody>
        </Card>
      </div>

      {/* ---------- Treinamento (v3) ---------- */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Treinamento"
            subtitle="Quem está em capacitação agora"
            icon={<GraduationCap className="h-[18px] w-[18px]" />}
            action={<Link to="/treinamento" className="text-xs font-medium text-brand hover:underline">Ver treinamentos →</Link>}
          />
          <CardBody className="space-y-3">
            <button
              type="button"
              className="w-full rounded-lg border border-slate-100 px-3 py-3 text-left transition-colors hover:bg-slate-50/60"
              onClick={() => drill.abrir("Em treinamento", emTreinamento, "Colaboradores com treinamento em aberto")}
            >
              <div className="flex items-end justify-between">
                <span className="text-3xl font-semibold tracking-tight text-brand-ink">{emTreinamento.length}</span>
                <span className="mb-1 text-xs text-slate-400">colaborador(es)</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">Em treinamento · clique para ver os nomes</p>
            </button>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{treinosAbertos.length} treinamento(s) em aberto</span>
              <span>{treinosEscopo.length - treinosAbertos.length} concluído(s)</span>
            </div>
          </CardBody>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title="O que precisa treinar" subtitle="Treinamentos pendentes por título" icon={<GraduationCap className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {topTreinos.length === 0 ? (
              <EmptyState title="Nenhum treinamento pendente" description="Todo o time está em dia com a capacitação." icon={<ClipboardCheck className="h-8 w-8" />} />
            ) : (
              topTreinos.map(([titulo, qtd]) => (
                <div key={titulo} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2">
                  <span className="truncate text-sm font-medium text-slate-700">{titulo}</span>
                  <Badge variant="warning">{qtd} pendente(s)</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Alertas e pendências" subtitle="Conformidade de documentos, férias e avaliações" icon={<AlertTriangle className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {docsAlerta.length === 0 && avaliacoesPendentes.length === 0 ? (
              <EmptyState title="Tudo em dia" description="Nenhuma pendência crítica no seu escopo." icon={<ClipboardCheck className="h-8 w-8" />} />
            ) : (
              <>
                {docsAlerta.slice(0, 6).map((doc) => {
                  const dd = dias(doc.dataVencimento);
                  const vencido = dd < 0;
                  return (
                    <div key={doc.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-700">{doc.nome} · {d.nomeColab(doc.colaboradorId)}</p>
                        <p className="text-xs text-slate-400">{doc.categoria}</p>
                      </div>
                      <Badge variant={vencido ? "danger" : "warning"}>
                        {vencido ? `Vencido há ${Math.abs(dd)}d` : `Vence em ${dd}d`}
                      </Badge>
                    </div>
                  );
                })}
                {avaliacoesPendentes.slice(0, 3).map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                    <p className="truncate text-sm font-medium text-slate-700">Avaliação pendente · {c.nome}</p>
                    <Badge variant="info">Ciclo 2026.1</Badge>
                  </div>
                ))}
              </>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Aniversariantes do mês" subtitle={MESES_PT[mesAniversario - 1]} icon={<Cake className="h-[18px] w-[18px]" />} />
            <CardBody className="space-y-2">
              {aniversariantes.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum aniversariante este mês.</p>
              ) : (
                aniversariantes.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link to={`/colaboradores/${c.id}`} className="truncate font-medium text-slate-700 hover:text-brand hover:underline">{c.nome}</Link>
                    <span className="flex shrink-0 items-center gap-2">
                      {c.humor && <HumorIndicador humor={c.humor} tamanho="sm" comTexto={false} />}
                      <span className="text-slate-400">{ddmm(c.dataNascimento)}</span>
                    </span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Aniversário de empresa" subtitle={`Tempo de casa · ${MESES_PT[mesAniversario - 1]}`} icon={<PartyPopper className="h-[18px] w-[18px]" />} />
            <CardBody className="space-y-2">
              {aniversariosEmpresa.length === 0 ? (
                <p className="text-sm text-slate-400">Nenhum aniversário de empresa este mês.</p>
              ) : (
                aniversariosEmpresa.map((c) => {
                  const anos = anosDeCasa(c.dataAdmissao);
                  return (
                    <div key={c.id} className="flex items-center justify-between gap-2 text-sm">
                      <Link to={`/colaboradores/${c.id}`} className="truncate font-medium text-slate-700 hover:text-brand hover:underline">{c.nome}</Link>
                      <span className="flex shrink-0 items-center gap-2">
                        {c.perfilComportamental && <PerfilComportamentalBadge perfil={c.perfilComportamental} />}
                        <span className="text-slate-400">{ddmm(c.dataAdmissao)} · {anos > 0 ? `${anos} ano(s)` : "1º ano"}</span>
                      </span>
                    </div>
                  );
                })
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Próximos retornos de férias" icon={<CalendarClock className="h-[18px] w-[18px]" />} />
            <CardBody className="space-y-2">
              {proximosRetornos.length === 0 ? (
                <p className="text-sm text-slate-400">Ninguém de férias no momento.</p>
              ) : (
                proximosRetornos.slice(0, 4).map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-sm">
                    <span className="text-slate-700">{d.nomeColab(f.colaboradorId)}</span>
                    <span className="text-slate-400">{formatDate(f.dataRetorno)}</span>
                  </div>
                ))
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Risco de saída × potencial" subtitle="Atenção à retenção de talentos" icon={<AlertTriangle className="h-[18px] w-[18px]" />} action={<Link to="/desempenho" className="text-xs font-medium text-brand hover:underline">Ver 9-Box →</Link>} />
          <CardBody>
            <BarrasColoridas
              altura={200}
              onItemClick={(nome) => drill.abrir(nome, colabsPorRisco(nome), "Atenção à retenção de talentos")}
              data={[
                { nome: "Risco alto", valor: risco.Alto ?? 0, cor: COR_RISCO.Alto },
                { nome: "Risco médio", valor: risco.Médio ?? 0, cor: COR_RISCO.Médio },
                { nome: "Risco baixo", valor: risco.Baixo ?? 0, cor: COR_RISCO.Baixo },
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Elegíveis a promoção" subtitle="Ciclo 2026.1" icon={<Award className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-2">
            {elegiveis.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhum elegível no momento.</p>
            ) : (
              elegiveis.slice(0, 6).map((a) => (
                <div key={a.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{d.nomeColab(a.colaboradorId)}</span>
                  <DotBadge label={`→ ${a.proximoNivel}`} cor="#16a34a" />
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <DrillModal
        {...drill.props}
        colunaExtra={
          drill.props.titulo.startsWith("Folha · ")
            ? { titulo: "Folha", render: (c) => formatBRL((c.salario ?? 0) + (c.adicionais ?? 0)) }
            : undefined
        }
      />
    </div>
  );
}

// ---------- Visão do colaborador (autoatendimento) ----------
function PainelPessoal() {
  const sessao = useSessao();
  const d = useDominio();
  const { items: documentos } = useColecao("documentos");
  const { items: ferias } = useColecao("ferias");
  const { items: avaliacoes } = useColecao("avaliacoes");
  const { items: pdis } = useColecao("pdis");

  const c = d.colabById.get(sessao!.colaboradorId);
  if (!c) return null;

  const minhasFerias = ferias.filter((f) => f.colaboradorId === c.id);
  const feriasAtiva = minhasFerias.find((f) => f.status === "Em andamento" || f.status === "Agendada");
  const saldoFerias = minhasFerias.reduce((acc, f) => Math.max(acc, f.saldoDias), 0);
  const minhaAval = avaliacoes.find((a) => a.colaboradorId === c.id && a.tipo === "GESTOR");
  const meusPdis = pdis.filter((p) => p.colaboradorId === c.id);
  const meusDocsAlerta = documentos.filter((doc) => doc.colaboradorId === c.id && doc.dataVencimento && dias(doc.dataVencimento) <= JANELA_ALERTA_DIAS);

  return (
    <div>
      <PageHeader title={`Olá, ${c.nome.split(" ")[0]}`} description="Seu painel de autoatendimento na Impresilk." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Cargo" value={<span className="text-base">{d.nomeCargo(c)}</span>} icon={<Users className="h-5 w-5" />} accent="brand" hint={`Nível ${d.nomeNivel(c.nivelId)}`} />
        <StatCard label="Saldo de férias" value={`${saldoFerias} dias`} icon={<Palmtree className="h-5 w-5" />} accent="green" hint={feriasAtiva ? feriasAtiva.status : "Em aberto"} />
        <StatCard label="Nota da avaliação" value={minhaAval?.notaFinal ?? "—"} icon={<Award className="h-5 w-5" />} accent="gold" hint={minhaAval?.statusDesempenho ?? "Sem avaliação"} />
        <StatCard label="Documentos a vencer" value={meusDocsAlerta.length} icon={<FileWarning className="h-5 w-5" />} accent={meusDocsAlerta.length ? "amber" : "green"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Meu desempenho" subtitle="Ciclo 2026.1" icon={<TrendingUp className="h-[18px] w-[18px]" />} />
          <CardBody>
            {minhaAval ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-600">Nota final</span>
                  <Badge variant={minhaAval.statusDesempenho === "Apto" ? "success" : minhaAval.statusDesempenho === "Não apto" ? "danger" : "warning"}>
                    {minhaAval.notaFinal} · {minhaAval.statusDesempenho}
                  </Badge>
                </div>
                {minhaAval.elegivelPromocao && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
                    Elegível para promoção → {minhaAval.proximoNivel}
                  </div>
                )}
                {minhaAval.planoAcao && <p className="text-sm text-slate-500">{minhaAval.planoAcao}</p>}
              </div>
            ) : (
              <EmptyState title="Sem avaliação registrada" />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Meu PDI" subtitle="Plano de Desenvolvimento Individual" icon={<Target className="h-[18px] w-[18px]" />} />
          <CardBody className="space-y-3">
            {meusPdis.length === 0 ? (
              <EmptyState title="Nenhum PDI ativo" />
            ) : (
              meusPdis.map((p) => (
                <div key={p.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{p.competencia}</span>
                    <span className="text-slate-400">{p.progresso}%</span>
                  </div>
                  <Progress value={p.progresso} />
                  <p className="mt-1 text-xs text-slate-500">{p.acao}</p>
                </div>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-4">
        <Link to="/meu-perfil" className="btn-outline">Ver meu perfil completo</Link>
      </div>
    </div>
  );
}
