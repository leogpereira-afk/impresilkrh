import { useMemo, useRef, useState } from "react";
import {
  Wallet,
  Users,
  Upload,
  Settings2,
  TrendingUp,
  Coins,
  ReceiptText,
  Layers,
  UserCircle2,
  ShieldCheck,
  FileSpreadsheet,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { Select, Campo, Input } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { BarrasVerticais } from "@/components/charts/charts";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { podeGerir } from "@/lib/rbac";
import { formatBRL } from "@/lib/format";
import { somaPorTipo, corDoTipo, TIPOS_PAGAMENTO } from "@/lib/folha";
import {
  classeMap,
  competenciasPlano,
  compLabel,
  compLabelLongo,
  folhasDoMes,
  totaisDoMes,
  serieCustos,
  CLASSE_LABEL,
  parsePlanoContas,
  parsePagamentos,
  ehContaConfidencial,
} from "@/lib/custos";
import { lerPlanilha } from "@/lib/xlsx-lite";
import type {
  ClassificacaoConta,
  ClasseCusto,
  ContaPlano,
  Pagamento,
} from "@/data/types";

// Classes disponíveis no editor (confidencial fica fora — societárias só do master).
const CLASSES_EDITAVEIS: ClasseCusto[] = ["individual", "rateio", "encargo", "ignorar"];

// Encargos sobre o bruto (salário + adiantamento) — custo real do colaborador.
const FGTS_PCT = 0.08;
const PROVISAO_13 = 1 / 12;
const PROVISAO_FERIAS = (1 / 12) * 1.3333;

export default function Custos() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();

  const planoColecao = useColecao("planoContas");
  const classifColecao = useColecao("classificacaoCustos");
  const pagamentosColecao = useColecao("pagamentos");
  const planoContas = planoColecao.items;
  const classificacaoCustos = classifColecao.items;
  const pagamentos = pagamentosColecao.items;

  // ---------- Estado (hooks SEMPRE antes de qualquer return) ----------
  const competencias = useMemo(() => competenciasPlano(planoContas), [planoContas]);
  const ultimaComp = competencias[competencias.length - 1] ?? "";
  const [comp, setComp] = useState<string>(ultimaComp);

  const ativosOrdenados = useMemo(
    () => [...d.ativos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [d.ativos],
  );
  const [colabId, setColabId] = useState<string>(ativosOrdenados[0]?.id ?? "");

  const [comAdiantamento, setComAdiantamento] = useState<boolean>(true);
  const [comEncargos, setComEncargos] = useState<boolean>(true);
  const [rateioPorPessoa, setRateioPorPessoa] = useState<boolean>(false);

  const [editorAberto, setEditorAberto] = useState<boolean>(false);

  // Lançamento manual (preencher itens faltantes na folha real, ex.: comissão).
  const [addLanc, setAddLanc] = useState<boolean>(false);
  const [lancTipo, setLancTipo] = useState<string>("Comissão");
  const [lancValor, setLancValor] = useState<string>("");
  const [lancDesc, setLancDesc] = useState<string>("");

  // Competência efetiva (cai para a última quando a selecionada some / inicial vazia).
  const compAtiva = comp && competencias.includes(comp) ? comp : ultimaComp;
  const nColab = d.ativos.length;
  const mapaClasse = useMemo(() => classeMap(classificacaoCustos), [classificacaoCustos]);

  // ---------- Uploads ----------
  const refPlano = useRef<HTMLInputElement>(null);
  const refPagts = useRef<HTMLInputElement>(null);
  const hojeIso = new Date().toISOString().slice(0, 7);
  const [compUpload, setCompUpload] = useState<string>(ultimaComp || hojeIso);

  const importarPlano = async (file: File) => {
    try {
      const linhas = await lerPlanilha(file);
      const novos = parsePlanoContas(linhas, compUpload);
      if (novos.length === 0) {
        toast("Nenhuma conta reconhecida na planilha.", "erro");
        return;
      }
      planoColecao.definir([
        ...planoContas.filter((p: ContaPlano) => p.competencia !== compUpload),
        ...novos,
      ]);
      setComp(compUpload);
      toast(`Plano de contas importado: ${novos.length} contas em ${compLabel(compUpload)}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao ler a planilha.", "erro");
    }
  };

  const importarPagamentos = async (file: File) => {
    try {
      const linhas = await lerPlanilha(file);
      const { registros, naoCasados } = parsePagamentos(linhas, d.colaboradores);
      if (registros.length === 0) {
        toast("Nenhum pagamento reconhecido na planilha.", "erro");
        return;
      }
      const compsImportadas = new Set(registros.map((r: Pagamento) => r.competencia));
      pagamentosColecao.definir([
        ...pagamentos.filter((p: Pagamento) => !compsImportadas.has(p.competencia)),
        ...registros,
      ]);
      const aviso =
        naoCasados.length > 0
          ? ` ${naoCasados.length} ${naoCasados.length === 1 ? "nome não casou" : "nomes não casaram"}.`
          : "";
      toast(`Pagamentos importados: ${registros.length} lançamentos.${aviso}`, naoCasados.length > 0 ? "info" : "sucesso");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao ler a planilha.", "erro");
    }
  };

  // ---------- Seção 1: custo individual por colaborador ----------
  const pagsDoColab = useMemo(
    () => pagamentos.filter((p: Pagamento) => p.colaboradorId === colabId && p.competencia === compAtiva),
    [pagamentos, colabId, compAtiva],
  );
  const linhasColab = useMemo(() => somaPorTipo(pagsDoColab), [pagsDoColab]);
  // No modo "Só Salário" excluímos o tipo "Adiantamento" (a soma não duplica).
  const linhasConsideradas = useMemo(
    () => (comAdiantamento ? linhasColab : linhasColab.filter((l) => l.tipo !== "Adiantamento")),
    [linhasColab, comAdiantamento],
  );
  const custoPago = useMemo(() => linhasConsideradas.reduce((s, l) => s + l.valor, 0), [linhasConsideradas]);

  // Bruto = Salário + Adiantamento (base dos encargos), independente do toggle de adiantamento.
  const bruto = useMemo(
    () => linhasColab.filter((l) => l.tipo === "Salário" || l.tipo === "Adiantamento").reduce((s, l) => s + l.valor, 0),
    [linhasColab],
  );
  const fgts = bruto * FGTS_PCT;
  const prov13 = bruto * PROVISAO_13;
  const provFerias = bruto * PROVISAO_FERIAS;
  const encargos = fgts + prov13 + provFerias;
  const custoReal = custoPago + encargos;
  const custoTotalColab = comEncargos ? custoReal : custoPago;
  const colabSel = d.colabById.get(colabId);

  // ---------- Seção 1b: histórico do colaborador (mês a mês) + acumulado ----------
  const historicoColab = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pagamentos as Pagamento[]) {
      if (p.colaboradorId !== colabId) continue;
      m.set(p.competencia, (m.get(p.competencia) ?? 0) + p.valor);
    }
    return [...m.keys()].sort().map((c) => ({ competencia: c, nome: compLabel(c), valor: m.get(c) ?? 0 }));
  }, [pagamentos, colabId]);
  const acumuladoColab = useMemo(() => historicoColab.reduce((s, x) => s + x.valor, 0), [historicoColab]);
  const mediaColab = historicoColab.length ? acumuladoColab / historicoColab.length : 0;

  // ---------- Seção 2: custos coletivos (rateio) ----------
  const totais = useMemo(
    () => totaisDoMes(planoContas, mapaClasse, compAtiva, nColab),
    [planoContas, mapaClasse, compAtiva, nColab],
  );
  const totalColetivo = totais.individual + totais.rateio;
  const divisor = rateioPorPessoa && nColab > 0 ? nColab : 1;

  // ---------- Seção 3: evolução mês a mês ----------
  const serie = useMemo(
    () => serieCustos(planoContas, mapaClasse, nColab),
    [planoContas, mapaClasse, nColab],
  );
  const dadosEvolucao = useMemo(
    () => serie.map((s) => ({ nome: s.nome, valor: Math.round(s.medioIndividual) })),
    [serie],
  );

  // ---------- Editor de classificação ----------
  // Contas societárias confidenciais (2.14.*) NUNCA aparecem no editor de
  // classificação — independentemente de já estarem classificadas — para que
  // ninguém (nem gestor) consiga jogá-las no rateio público.
  const folhasEditor = useMemo(
    () =>
      folhasDoMes(planoContas, compAtiva)
        .filter((p: ContaPlano) => !ehContaConfidencial(p.codigo))
        .sort((a: ContaPlano, b: ContaPlano) => b.valor - a.valor),
    [planoContas, compAtiva],
  );

  const definirClasse = (conta: ContaPlano, classe: ClasseCusto) => {
    if (ehContaConfidencial(conta.codigo)) return; // não reclassificar confidenciais
    const existente = classificacaoCustos.find((c: ClassificacaoConta) => c.codigo === conta.codigo);
    if (existente) classifColecao.atualizar(existente.id, { classe, nome: conta.nome });
    else classifColecao.criar({ codigo: conta.codigo, nome: conta.nome, classe });
  };

  // Lança um pagamento manual para o colaborador no mês (preenche o que faltou na folha).
  const salvarLancamento = () => {
    const valor = Number(String(lancValor).replace(",", "."));
    if (!lancTipo) return toast("Escolha o tipo de pagamento.", "erro");
    if (!valor || valor <= 0) return toast("Informe um valor maior que zero.", "erro");
    pagamentosColecao.criar({
      colaboradorId: colabId,
      competencia: compAtiva,
      tipo: lancTipo,
      valor: Math.round(valor * 100) / 100,
      dataPagamento: `${compAtiva}-15`,
      descricao: lancDesc.trim() || "Lançamento manual",
    });
    toast("Lançamento adicionado.");
    setAddLanc(false);
  };

  // ---------- Guard (após os hooks) ----------
  if (!podeGerir(sessao)) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Esta área de custos de colaboradores é exclusiva da gestão (RH e gestores)."
        icon={<ShieldCheck className="h-10 w-10" />}
      />
    );
  }

  const semPlano = competencias.length === 0;

  return (
    <div>
      <PageHeader
        title="Custos de Colaboradores"
        description="Quanto custa cada colaborador e a equipe — folha real, rateio e encargos, mês a mês."
      >
        <Select
          value={compAtiva}
          onChange={(e) => setComp(e.target.value)}
          className="h-10 w-auto py-0"
          disabled={semPlano}
        >
          {semPlano && <option value="">Sem competências</option>}
          {competencias.map((c) => (
            <option key={c} value={c}>
              {compLabelLongo(c)}
            </option>
          ))}
        </Select>
        <button className="btn-outline" onClick={() => setEditorAberto(true)} disabled={semPlano}>
          <Settings2 className="h-4 w-4" /> Classificar contas
        </button>
      </PageHeader>

      {/* ---------- Uploads ---------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Plano de Contas (custos gerais)"
            subtitle="Planilha mensal de despesas (.xlsx ou .csv) — substitui a competência escolhida."
            icon={<FileSpreadsheet className="h-5 w-5" />}
          />
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo label="Competência" className="sm:w-44">
              <Select value={compUpload} onChange={(e) => setCompUpload(e.target.value)}>
                {opcoesCompetencia(compUpload).map((c) => (
                  <option key={c} value={c}>
                    {compLabelLongo(c)}
                  </option>
                ))}
              </Select>
            </Campo>
            <input
              ref={refPlano}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarPlano(f);
                e.target.value = "";
              }}
            />
            <button className="btn-primary sm:mb-0" onClick={() => refPlano.current?.click()}>
              <Upload className="h-4 w-4" /> Enviar plano
            </button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pagamentos (custos individuais)"
            subtitle="Extrato de Contas a Pagar (.xlsx ou .csv) — a folha real por colaborador."
            icon={<ReceiptText className="h-5 w-5" />}
          />
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <p className="flex-1 text-xs text-slate-500">
              As competências presentes no arquivo são atualizadas; as demais permanecem.
            </p>
            <input
              ref={refPagts}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarPagamentos(f);
                e.target.value = "";
              }}
            />
            <button className="btn-primary" onClick={() => refPagts.current?.click()}>
              <Upload className="h-4 w-4" /> Enviar pagamentos
            </button>
          </CardBody>
        </Card>
      </div>

      {semPlano ? (
        <EmptyState
          title="Nenhum plano de contas importado"
          description="Envie a planilha de despesas mensal acima para começar a calcular os custos."
          icon={<Wallet className="h-10 w-10" />}
        />
      ) : (
        <div className="space-y-8">
          {/* ===================== SEÇÃO 1 ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Custo individual por colaborador</h2>
            </div>

            <Card>
              <CardHeader
                title="Colaborador ativo"
                subtitle={`Folha real de ${compLabelLongo(compAtiva)}`}
                icon={<Users className="h-5 w-5" />}
                action={
                  <Select
                    value={colabId}
                    onChange={(e) => setColabId(e.target.value)}
                    className="h-9 w-auto py-0 text-sm"
                  >
                    {ativosOrdenados.length === 0 && <option value="">Sem colaboradores ativos</option>}
                    {ativosOrdenados.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Select>
                }
              />
              <CardBody>
                {/* Controles */}
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <SegToggle
                    opcoes={[
                      { v: true, label: "Salário + Adiantamento" },
                      { v: false, label: "Só Salário" },
                    ]}
                    valor={comAdiantamento}
                    onChange={setComAdiantamento}
                  />
                  <SegToggle
                    opcoes={[
                      { v: true, label: "Custo real (com encargos)" },
                      { v: false, label: "Custo pago" },
                    ]}
                    valor={comEncargos}
                    onChange={setComEncargos}
                  />
                  <button type="button" onClick={() => { setLancTipo("Comissão"); setLancValor(""); setLancDesc(""); setAddLanc(true); }} className="btn-outline h-9 py-0 text-sm sm:ml-auto" title="Adicionar um pagamento que faltou na folha (ex.: comissão)">
                    <Plus className="h-4 w-4" /> Lançamento
                  </button>
                </div>

                {pagsDoColab.length === 0 ? (
                  <EmptyState
                    title="Sem pagamentos nesta competência"
                    description="Não há folha lançada para este colaborador no mês selecionado."
                    icon={<Coins className="h-8 w-8" />}
                  />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Tabela por tipo */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="th">Tipo de pagamento</th>
                            <th className="th text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {linhasColab.map((l) => {
                            const ignorado = !comAdiantamento && l.tipo === "Adiantamento";
                            return (
                              <tr key={l.tipo} className={ignorado ? "opacity-40" : undefined}>
                                <td className="td">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: corDoTipo(l.tipo) }}
                                    />
                                    {l.tipo}
                                    {ignorado && <span className="text-xs text-slate-400">(não somado)</span>}
                                  </span>
                                </td>
                                <td className="td text-right font-medium text-slate-800">{formatBRL(l.valor)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-50/60">
                            <td className="td font-semibold text-brand-ink">Custo pago</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(custoPago)}</td>
                          </tr>
                        </tbody>
                      </table>
                      {!comAdiantamento && (
                        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          Política 60% saldo + 40% adiantamento = 1 salário (a soma não duplica).
                        </p>
                      )}
                    </div>

                    {/* Cálculo de custo real */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <StatCard label="Custo pago" value={formatBRL(custoPago)} accent="blue" icon={<Coins className="h-4 w-4" />} hint={comAdiantamento ? "Salário + adiantamento" : "Só salário"} />
                        <StatCard label="Custo real" value={formatBRL(custoReal)} accent="brand" icon={<Wallet className="h-4 w-4" />} hint="Pago + encargos" />
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Encargos estimados sobre o bruto ({formatBRL(bruto)})
                        </p>
                        <dl className="space-y-1.5 text-sm">
                          <LinhaEncargo label="FGTS (8%)" valor={fgts} />
                          <LinhaEncargo label="Provisão 13º (1/12)" valor={prov13} />
                          <LinhaEncargo label="Provisão Férias (1/12 × 1,3333)" valor={provFerias} />
                          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-700">
                            <dt>Total de encargos</dt>
                            <dd>{formatBRL(encargos)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                )}

                {/* Destaque: custo total mensal do colaborador */}
                <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-brand px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                      Custo total mensal do colaborador
                    </p>
                    <p className="mt-0.5 text-sm text-white/80">
                      {colabSel?.nome ?? "—"} · {comEncargos ? "custo real (com encargos)" : "custo pago"}
                    </p>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{formatBRL(custoTotalColab)}</p>
                </div>
              </CardBody>
            </Card>
          </section>

          {/* ===================== SEÇÃO 1b — histórico do colaborador ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Histórico de {colabSel?.nome ?? "colaborador"} mês a mês</h2>
            </div>
            <Card>
              <CardHeader
                title="Quanto recebeu por mês"
                subtitle="Total efetivamente pago em cada competência e o acumulado do período."
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <CardBody>
                {historicoColab.length === 0 ? (
                  <EmptyState title="Sem pagamentos para este colaborador" icon={<Coins className="h-8 w-8" />} />
                ) : (
                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <BarrasVerticais data={historicoColab.map((h) => ({ nome: h.nome, valor: h.valor }))} moeda altura={260} />
                    </div>
                    <div className="space-y-3">
                      <StatCard label="Acumulado no período" value={formatBRL(acumuladoColab)} accent="brand" icon={<Wallet className="h-4 w-4" />} hint={`${historicoColab.length} mes(es)`} />
                      <StatCard label="Média por mês" value={formatBRL(mediaColab)} accent="blue" icon={<Coins className="h-4 w-4" />} />
                      <div className="overflow-hidden rounded-xl border border-slate-200/70">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {historicoColab.map((h) => (
                              <tr key={h.competencia}>
                                <td className="px-3 py-2 text-slate-600">{compLabelLongo(h.competencia)}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800">{formatBRL(h.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50/60">
                            <tr>
                              <td className="px-3 py-2 font-semibold text-brand-ink">Acumulado</td>
                              <td className="px-3 py-2 text-right font-semibold text-brand-ink">{formatBRL(acumuladoColab)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </section>

          {/* ===================== SEÇÃO 2 ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Custos coletivos (rateio para todos)</h2>
            </div>

            {totalColetivo === 0 ? (
              <EmptyState
                title="Sem custos classificados nesta competência"
                description="Use “Classificar contas” para marcar contas como individual ou rateio."
                icon={<Layers className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Custo médio / colaborador"
                    value={formatBRL(nColab > 0 ? totais.individual / nColab : 0)}
                    hint={`Individual ÷ ${nColab} ativos`}
                    accent="brand"
                    icon={<Users className="h-4 w-4" />}
                  />
                  <StatCard
                    label="Total custos de colaboradores"
                    value={formatBRL(totalColetivo)}
                    hint="Individual + rateio"
                    accent="gold"
                    icon={<Wallet className="h-4 w-4" />}
                  />
                  <StatCard
                    label="Rateio por colaborador"
                    value={formatBRL(totais.rateioPorColab)}
                    hint={`Rateio ÷ ${nColab} ativos`}
                    accent="green"
                    icon={<Coins className="h-4 w-4" />}
                  />
                </div>

                <Card>
                  <CardHeader title="Individual × Rateio" subtitle={compLabelLongo(compAtiva)} icon={<Coins className="h-5 w-5" />} />
                  <CardBody>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Individual {formatBRL(totais.individual)}
                      </span>
                      <span className="flex items-center gap-2 text-slate-600">
                        Rateio {formatBRL(totais.rateio)} <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                      </span>
                    </div>
                    <Progress value={totalColetivo > 0 ? (totais.individual / totalColetivo) * 100 : 0} />
                    <p className="mt-2 text-xs text-slate-400">
                      {totalColetivo > 0
                        ? `${Math.round((totais.individual / totalColetivo) * 100)}% individual · ${Math.round((totais.rateio / totalColetivo) * 100)}% rateio`
                        : "Sem custos no período."}
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Contas de rateio"
                    subtitle="Custos coletivos divididos entre todos os colaboradores ativos."
                    icon={<Layers className="h-5 w-5" />}
                    action={
                      <SegToggle
                        opcoes={[
                          { v: false, label: "Total" },
                          { v: true, label: "Por colaborador" },
                        ]}
                        valor={rateioPorPessoa}
                        onChange={setRateioPorPessoa}
                      />
                    }
                  />
                  <CardBody className="p-0">
                    {totais.contasRateio.length === 0 ? (
                      <div className="p-5">
                        <EmptyState title="Nenhuma conta de rateio" description="Classifique contas como “Rateio para todos” no editor." />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="th">Conta</th>
                            <th className="th text-right">{rateioPorPessoa ? "Por colaborador" : "Valor"}</th>
                            <th className="th text-right">% do total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {totais.contasRateio.map((c: ContaPlano) => (
                            <tr key={c.codigo} className="transition hover:bg-slate-50/60">
                              <td className="td">
                                <span className="font-medium text-slate-800">{c.nome}</span>
                                <span className="ml-2 text-xs text-slate-400">{c.codigo}</span>
                              </td>
                              <td className="td text-right font-medium text-slate-800">{formatBRL(c.valor / divisor)}</td>
                              <td className="td text-right text-slate-500">
                                {totalColetivo > 0 ? `${((c.valor / totalColetivo) * 100).toFixed(1)}%` : "—"}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50/60">
                            <td className="td font-semibold text-brand-ink">Total de rateio</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(totais.rateio / divisor)}</td>
                            <td className="td text-right text-slate-500">
                              {totalColetivo > 0 ? `${((totais.rateio / totalColetivo) * 100).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}
          </section>

          {/* ===================== SEÇÃO 3 ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Evolução mês a mês</h2>
            </div>

            <Card>
              <CardHeader
                title="Custo médio por colaborador"
                subtitle="Custo individual da folha dividido pelos colaboradores ativos, por competência."
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <CardBody>
                {dadosEvolucao.length === 0 ? (
                  <EmptyState title="Sem histórico" description="Importe mais competências para ver a evolução." />
                ) : (
                  <BarrasVerticais data={dadosEvolucao} moeda altura={300} />
                )}

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-100 bg-slate-50/50">
                      <tr>
                        <th className="th">Mês</th>
                        <th className="th text-right">Individual</th>
                        <th className="th text-right">Rateio</th>
                        <th className="th text-right">Custo médio / colab.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {serie.map((s) => (
                        <tr
                          key={s.competencia}
                          className={`transition hover:bg-slate-50/60 ${s.competencia === compAtiva ? "bg-brand-50/40" : ""}`}
                        >
                          <td className="td font-medium text-slate-800">{compLabelLongo(s.competencia)}</td>
                          <td className="td text-right text-slate-600">{formatBRL(s.individual)}</td>
                          <td className="td text-right text-slate-600">{formatBRL(s.rateio)}</td>
                          <td className="td text-right font-semibold text-brand-ink">{formatBRL(s.medioIndividual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </section>
        </div>
      )}

      {/* ===================== Editor de classificação ===================== */}
      <Modal
        aberto={editorAberto}
        onFechar={() => setEditorAberto(false)}
        titulo="Classificar contas"
        descricao={`Defina a classe de cada conta-folha de ${compLabelLongo(compAtiva)}.`}
        largura="max-w-2xl"
        rodape={
          <button className="btn-primary" onClick={() => setEditorAberto(false)}>
            Concluir
          </button>
        }
      >
        {folhasEditor.length === 0 ? (
          <EmptyState title="Sem contas nesta competência" description="Importe um plano de contas para classificar." />
        ) : (
          <div className="space-y-2">
            <p className="mb-3 text-xs text-slate-500">
              Individual vai para a ficha do colaborador; rateio é dividido entre todos; encargo entra no custo real; ignorar fica de fora.
            </p>
            {folhasEditor.map((c: ContaPlano) => {
              const classeAtual = mapaClasse.get(c.codigo) ?? "ignorar";
              return (
                <div
                  key={c.codigo}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-400">
                      {c.codigo} · {formatBRL(c.valor)}
                    </p>
                  </div>
                  <Select
                    value={classeAtual}
                    onChange={(e) => definirClasse(c, e.target.value as ClasseCusto)}
                    className="h-9 w-40 shrink-0 py-0 text-sm"
                  >
                    {CLASSES_EDITAVEIS.map((cl) => (
                      <option key={cl} value={cl}>
                        {CLASSE_LABEL[cl]}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Lançamento manual de pagamento (preenche itens faltantes, ex.: comissão) */}
      <Modal
        aberto={addLanc}
        onFechar={() => setAddLanc(false)}
        titulo="Adicionar lançamento"
        descricao={`${d.colabById.get(colabId)?.nome ?? "Colaborador"} · ${compLabelLongo(compAtiva)}. Use para incluir um pagamento que faltou na folha.`}
        largura="max-w-md"
        rodape={
          <>
            <button className="btn-outline" onClick={() => setAddLanc(false)}>Cancelar</button>
            <button className="btn-primary" onClick={salvarLancamento}>Adicionar</button>
          </>
        }
      >
        <div className="space-y-3">
          <Campo label="Tipo de pagamento">
            <Select value={lancTipo} onChange={(e) => setLancTipo(e.target.value)}>
              {TIPOS_PAGAMENTO.map((t) => <option key={t.tipo} value={t.tipo}>{t.tipo}</option>)}
            </Select>
          </Campo>
          <Campo label="Valor (R$)">
            <Input type="number" inputMode="decimal" step="0.01" value={lancValor} onChange={(e) => setLancValor(e.target.value)} placeholder="0,00" />
          </Campo>
          <Campo label="Descrição (opcional)">
            <Input value={lancDesc} onChange={(e) => setLancDesc(e.target.value)} placeholder="Ex.: Comissão produção" />
          </Campo>
        </div>
      </Modal>
    </div>
  );
}

// ---------- Helpers de UI locais ----------

// Lista de competências para o seletor de upload: mês corrente + 23 meses anteriores,
// garantindo que a competência atualmente escolhida esteja presente.
function opcoesCompetencia(incluir: string): string[] {
  const set = new Set<string>();
  const agora = new Date();
  for (let i = 0; i < 24; i++) {
    const dt = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    set.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  if (incluir) set.add(incluir);
  return [...set].sort((a, b) => b.localeCompare(a));
}

function LinhaEncargo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd>{formatBRL(valor)}</dd>
    </div>
  );
}

// Alternador segmentado (estilo Apple) — genérico em booleano.
function SegToggle({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { v: boolean; label: string }[];
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
            (valor === o.v ? "bg-white text-brand-ink shadow-sm" : "text-slate-500 hover:text-slate-700")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
