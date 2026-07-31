import { Fragment, useMemo, useState } from "react";
import {
  Coins, Plus, Trash2, CheckCircle2, FileDown, FileSpreadsheet, Lock, ShieldCheck, Pencil, Clock, ChevronDown, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useColecao, useConfig } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatBRL } from "@/lib/format";
import { cn } from "@/lib/cn";
import { minParaHora } from "@/lib/pontoImport";
import { calcularHoraExtra, minutosEntre, horasDecimais, valorDigitado, ADICIONAIS_HE, FATOR_HE_PADRAO } from "@/lib/pontoFolha";
import { slug } from "@/data/_gen";
import type { Colaborador, Lancamento, TipoLancamento } from "@/data/types";

const TIPOS: { tipo: TipoLancamento; label: string }[] = [
  { tipo: "hora_extra", label: "Hora extra (avulsa)" },
  { tipo: "empreita", label: "Empreita" },
  { tipo: "diaria", label: "Diária" },
  { tipo: "bonus", label: "Bônus" },
  { tipo: "bonus_viagem", label: "Bônus de viagem" },
  { tipo: "comissao", label: "Comissão" },
  { tipo: "limpeza", label: "Limpeza" },
];
const labelTipo = (t: TipoLancamento) => TIPOS.find((x) => x.tipo === t)?.label ?? t;

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const labelMes = (comp: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(comp || "");
  return m ? `${MESES[+m[2] - 1]}/${m[1]}` : comp;
};
const compAtual = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
};
const diaBR = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split("-").reverse().join("/") : "—");

export default function FolhaVariavel({ embutido = false }: { embutido?: boolean } = {}) {
  const sessao = useSessao();
  const d = useDominio();
  const config = useConfig();
  const toast = useToast();
  const podeEditar = podeGerir(sessao);
  const { items: lancamentos, criar, atualizar, remover } = useColecao("lancamentos");
  const { items: fechamentos, criar: criarFech, atualizar: atualizarFech } = useColecao("fechamentos");

  const [competencia, setCompetencia] = useState(compAtual());
  const [aberto, setAberto] = useState<Colaborador | null>(null);
  // Foco dos cards do topo: filtra a lista de colaboradores abaixo
  // (clicar no mesmo card de novo limpa o filtro).
  const [foco, setFoco] = useState<"comVerba" | "aprovados" | null>(null);
  const alternarFoco = (f: "comVerba" | "aprovados") =>
    setFoco((atual) => (atual === f ? null : f));
  // Linhas expandidas: mostram os lançamentos do mês sem sair da lista.
  const [expandidos, setExpandidos] = useState<Set<string>>(() => new Set());
  const alternarLinha = (id: string) =>
    setExpandidos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const [incluirInativos, setIncluirInativos] = useState(false);

  const todos = useMemo(() => colaboradoresVisiveis(sessao, d.colaboradores), [sessao, d.colaboradores]);
  const inativos = useMemo(() => todos.filter((c) => c.statusId === "inativo"), [todos]);
  // Quem já tem verba lançada NESTE mês continua na lista mesmo depois de
  // desligado: senão, ao desligar a pessoa, a linha sumia junto com o "Total do
  // mês" e não havia mais como abrir o detalhe para exportar a folha da rescisão.
  const comVerbaNoMes = useMemo(
    () => new Set(lancamentos.filter((l) => l.competencia === competencia).map((l) => l.colaboradorId)),
    [lancamentos, competencia],
  );
  const escopo = useMemo(
    () => todos
      .filter((c) => c.statusId !== "inativo" || incluirInativos || comVerbaNoMes.has(c.id))
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [todos, incluirInativos, comVerbaNoMes],
  );

  const lancDe = (colId: string) => lancamentos.filter((l) => l.colaboradorId === colId && l.competencia === competencia);
  const totalDe = (colId: string) => lancDe(colId).reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const fechDe = (colId: string) => fechamentos.find((f) => f.id === `${competencia}::${colId}`);

  const totalGeral = escopo.reduce((s, c) => s + totalDe(c.id), 0);
  const aprovados = escopo.filter((c) => fechDe(c.id)?.aprovado).length;

  // Os cards seguem contando o mês inteiro; só a tabela obedece ao foco.
  const visiveis = escopo.filter((c) => {
    if (foco === "comVerba") return totalDe(c.id) > 0;
    if (foco === "aprovados") return !!fechDe(c.id)?.aprovado;
    return true;
  });

  if (!podeEditar) {
    return (
      <div>
        {!embutido && <PageHeader title="Folha Variável" description="Verbas do mês por colaborador." />}
        <EmptyState icon={<Lock className="h-6 w-6" />} title="Sem permissão" description="A folha variável é restrita ao RH/gestão." />
      </div>
    );
  }

  return (
    <div>
      {/* A verba NÃO soma ao ponto nem ao custo: vive só aqui até a contabilidade
          pagar (e voltar como pagamento do ERP). O texto não pode prometer soma
          que não existe — o RH acharia que o valor já está em algum total. */}
      {!embutido && (
        <PageHeader
          title="Folha Variável"
          description="Verbas do mês por colaborador — hora extra, empreita, diária, bônus, comissão e limpeza. Sai em PDF/Excel por pessoa para a contabilidade."
        />
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="font-medium">Competência</span>
            <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none" />
          </label>
          {/* Rescisão: dá para lançar a verba de quem já saiu sem verba lançada. */}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
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
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total do mês" value={formatBRL(totalGeral)} icon={<Coins className="h-4 w-4" />} onClick={() => alternarFoco("comVerba")} ativo={foco === "comVerba"} title="Ver só quem tem verba lançada no mês" />
          <StatCard label="Aprovados" value={`${aprovados}/${escopo.length}`} icon={<ShieldCheck className="h-4 w-4" />} onClick={() => alternarFoco("aprovados")} ativo={foco === "aprovados"} title="Ver só as folhas já aprovadas" />
          <StatCard label="Colaboradores" value={String(escopo.length)} icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setFoco(null)} ativo={foco === null} title="Mostrar todos os colaboradores" />
        </div>
      </div>

      <Card>
        <CardHeader title={`Fechamento de ${labelMes(competencia)}`} subtitle="Abra um colaborador para lançar as verbas do mês, aprovar e exportar." icon={<Coins className="h-[18px] w-[18px]" />} />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-xs text-slate-500">
                <tr>
                  <th className="th">Colaborador</th>
                  <th className="th text-right">Verbas do mês</th>
                  <th className="th text-center">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {visiveis.length === 0 && (
                  <tr><td colSpan={4} className="td text-center text-slate-400">Nenhum colaborador neste filtro — clique no card de novo para ver todos.</td></tr>
                )}
                {visiveis.map((c) => {
                  const fe = fechDe(c.id);
                  const tot = totalDe(c.id);
                  return (
                    <Fragment key={c.id}>
                      <tr className="hover:bg-slate-50/50">
                        {/* O nome EXPANDE os lançamentos aqui mesmo; o botão "Abrir"
                            leva ao detalhe completo (lançar, aprovar, exportar). */}
                        <td className="td">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => alternarLinha(c.id)}
                              title={expandidos.has(c.id) ? "Recolher" : "Ver os lançamentos aqui"}
                              className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
                            >
                              {expandidos.has(c.id) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <button type="button" onClick={() => alternarLinha(c.id)} className="text-left font-medium text-slate-700 transition hover:text-brand hover:underline">
                              {c.nome}
                            </button>
                            {c.statusId === "inativo" && (
                              <Badge variant="neutral">Desligado{c.dataDesligamento ? ` em ${diaBR(c.dataDesligamento)}` : ""}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="td text-right tabular-nums font-medium text-slate-700">{tot > 0 ? formatBRL(tot) : "—"}</td>
                        <td className="td text-center">
                          {fe?.aprovado ? <Badge variant="success">Aprovado</Badge> : <Badge variant="neutral">Pendente</Badge>}
                        </td>
                        <td className="td text-right">
                          <button className="btn-outline px-3 py-1.5 text-sm" onClick={() => setAberto(c)}>Abrir</button>
                        </td>
                      </tr>
                      {expandidos.has(c.id) && (
                        <tr>
                          <td colSpan={4} className="bg-slate-50/60 p-0">
                            <LancamentosDaLinha
                              lancamentos={lancDe(c.id)}
                              total={tot}
                              onAbrir={() => setAberto(c)}
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
        </CardBody>
      </Card>

      {aberto && (
        <DetalheColaborador
          colaborador={aberto}
          competencia={competencia}
          config={config}
          lancamentos={lancDe(aberto.id)}
          fechamento={fechDe(aberto.id)}
          cargoNome={d.nomeCargo(aberto) ?? aberto.cargoLivre ?? ""}
          onFechar={() => setAberto(null)}
          onCriar={(rec) => criar(rec)}
          onAtualizar={(id, patch) => atualizar(id, patch)}
          onRemover={(id) => remover(id)}
          onAprovar={(aprovar) => {
            const id = `${competencia}::${aberto.id}`;
            const agora = new Date().toISOString();
            const base = { id, colaboradorId: aberto.id, competencia, aprovado: aprovar, aprovadoPor: sessao?.colaboradorId, aprovadoEm: aprovar ? agora : null, atualizadoEm: agora };
            if (fechamentos.some((f) => f.id === id)) atualizarFech(id, base); else criarFech(base);
            toast(aprovar ? "Folha aprovada — vai no 1º pagamento do mês." : "Aprovação removida.");
          }}
          toast={toast}
        />
      )}
    </div>
  );
}

// Lançamentos do mês mostrados na própria linha da lista (sem abrir o detalhe).
// Só leitura: para lançar, corrigir ou aprovar, o botão leva ao detalhe.
function LancamentosDaLinha({
  lancamentos, total, onAbrir,
}: {
  lancamentos: Lancamento[];
  total: number;
  onAbrir: () => void;
}) {
  const porTipo = useMemo(() => {
    const m = new Map<TipoLancamento, number>();
    for (const l of lancamentos) m.set(l.tipo, (m.get(l.tipo) ?? 0) + (Number(l.valor) || 0));
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [lancamentos]);

  if (lancamentos.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <p className="text-xs text-slate-400">Nenhuma verba lançada neste mês.</p>
        <button className="btn-outline h-7 px-2.5 py-0 text-[11px]" onClick={onAbrir}><Plus className="h-3 w-3" /> Lançar</button>
      </div>
    );
  }

  return (
    <div className="space-y-2 px-3 py-3 sm:px-4">
      {/* Subtotal por tipo: a leitura que o RH faz primeiro. */}
      <div className="flex flex-wrap gap-1.5">
        {porTipo.map(([t, v]) => (
          <span key={t} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600">
            {labelTipo(t)} <b className="tabular-nums text-slate-800">{formatBRL(v)}</b>
          </span>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400">
            <tr><th className="th">Dia</th><th className="th">Tipo</th><th className="th">Descrição</th><th className="th text-right">Valor</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {lancamentos.map((l) => (
              <tr key={l.id}>
                <td className="td tabular-nums text-slate-500">{diaBR(l.data)}</td>
                <td className="td text-slate-700">
                  {labelTipo(l.tipo)}
                  {l.minutos ? <span className="ml-1 text-slate-400">({l.horaInicio}–{l.horaFim} · {minParaHora(l.minutos)})</span> : null}
                </td>
                <td className="td text-slate-500">{l.descricao || "—"}</td>
                <td className="td text-right font-medium tabular-nums text-slate-700">{formatBRL(l.valor)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50/60">
            <tr>
              <td className="td font-semibold text-slate-600" colSpan={3}>Total a receber</td>
              <td className="td text-right font-bold tabular-nums text-brand-ink">{formatBRL(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="flex justify-end">
        <button className="btn-outline h-7 px-2.5 py-0 text-[11px]" onClick={onAbrir}><Pencil className="h-3 w-3" /> Lançar / corrigir / aprovar</button>
      </div>
    </div>
  );
}

// ============================================================================
function DetalheColaborador({
  colaborador, competencia, config, lancamentos, fechamento, cargoNome,
  onFechar, onCriar, onAtualizar, onRemover, onAprovar, toast,
}: {
  colaborador: Colaborador;
  competencia: string;
  config: { empresaNome?: string };
  lancamentos: Lancamento[];
  fechamento: { aprovado: boolean; aprovadoEm?: string | null } | undefined;
  cargoNome: string;
  onFechar: () => void;
  onCriar: (rec: Lancamento) => void;
  onAtualizar: (id: string, patch: Partial<Lancamento>) => void;
  onRemover: (id: string) => void;
  onAprovar: (aprovar: boolean) => void;
  toast: (m: string, t?: "sucesso" | "erro") => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("bonus");
  const [valor, setValor] = useState("");
  // "O RH escolheu esse valor à mão" — não confundir com "o campo está preenchido":
  // na edição o campo já vem preenchido pelo próprio sistema.
  const [valorTocado, setValorTocado] = useState(false);
  const [dia, setDia] = useState("");
  const [descricao, setDescricao] = useState("");
  // Hora extra por relógio: início/fim viram minutos e o valor sai do salário.
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [fatorHE, setFatorHE] = useState<number>(FATOR_HE_PADRAO);
  const [editando, setEditando] = useState<Lancamento | null>(null); // item 9: editar

  const ehHoraExtra = tipo === "hora_extra";
  const minutosHE = ehHoraExtra ? minutosEntre(horaInicio, horaFim) : 0;
  const calcHE = useMemo(
    () => calcularHoraExtra({ salario: colaborador.salario, minutos: minutosHE, fator: fatorHE }),
    [colaborador.salario, minutosHE, fatorHE],
  );

  // Enquanto o RH não escolhe um valor à mão, o mostrado é o sugerido pelo
  // cálculo — inclusive na edição, para que mudar o horário ou o adicional
  // refaça o R$ em vez de manter o valor antigo com os minutos novos.
  const valorEfetivo = valorTocado ? valor : (ehHoraExtra && minutosHE > 0 ? String(calcHE.valor).replace(".", ",") : valor);

  const limpar = () => {
    setValor(""); setValorTocado(false); setDescricao(""); setDia(""); setHoraInicio(""); setHoraFim("");
    setFatorHE(FATOR_HE_PADRAO); setEditando(null);
  };

  const totalPorTipo = useMemo(() => {
    const m = new Map<TipoLancamento, number>();
    for (const l of lancamentos) m.set(l.tipo, (m.get(l.tipo) ?? 0) + (Number(l.valor) || 0));
    return m;
  }, [lancamentos]);
  const total = lancamentos.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const minutosExtrasLancados = lancamentos.reduce((s, l) => s + (l.minutos ?? 0), 0);

  const abrirEdicao = (l: Lancamento) => {
    setEditando(l);
    setTipo(l.tipo);
    setValor(String(l.valor).replace(".", ","));
    // Se o valor gravado é o que o cálculo tinha sugerido, ele volta a ser
    // sugestão (recalcula ao mexer no horário/adicional). Se foi ajustado à
    // mão, segue como escolha do RH e não é sobrescrito.
    setValorTocado(!(l.valorSugerido != null && Math.abs(l.valorSugerido - l.valor) < 0.01));
    setDia(l.data ?? "");
    setDescricao(l.descricao ?? "");
    setHoraInicio(l.horaInicio ?? "");
    setHoraFim(l.horaFim ?? "");
    setFatorHE(l.fatorHE ?? FATOR_HE_PADRAO);
  };

  const salvar = () => {
    const v = valorDigitado(valorEfetivo);
    if (!v || v <= 0) {
      toast(ehHoraExtra && minutosHE === 0 ? "Informe o horário de início e fim (ou o valor)." : "Informe um valor válido.", "erro");
      return;
    }
    const agora = new Date().toISOString();
    const extras = ehHoraExtra && minutosHE > 0
      ? { horaInicio, horaFim, minutos: minutosHE, fatorHE, valorSugerido: calcHE.valor }
      : { horaInicio: undefined, horaFim: undefined, minutos: undefined, fatorHE: undefined, valorSugerido: undefined };

    if (editando) {
      // O lançamento pode ter sumido por outro caminho (sync, outra aba): gravar
      // num id que não existe mais é silencioso e a tela dizia "atualizado".
      if (!lancamentos.some((x) => x.id === editando.id)) {
        toast("Esse lançamento foi removido — lance de novo.", "erro");
        limpar();
        return;
      }
      onAtualizar(editando.id, { tipo, valor: v, data: dia || null, descricao: descricao.trim() || undefined, ...extras, atualizadoEm: agora });
      toast("Lançamento atualizado.");
    } else {
      onCriar({
        id: `${competencia}::${colaborador.id}::${slug(tipo)}::${agora}`,
        colaboradorId: colaborador.id, competencia, tipo, valor: v,
        data: dia || null, descricao: descricao.trim() || undefined,
        ...extras,
        criadoEm: agora, atualizadoEm: agora,
      });
      toast("Lançamento adicionado.");
    }
    limpar();
  };

  const dadosRel = { colaborador, competencia, config, lancamentos, fechamento, cargoNome, totalPorTipo, total };

  return (
    <Modal aberto onFechar={onFechar} titulo={`Folha variável — ${colaborador.nome}`} descricao={`${labelMes(competencia)}${cargoNome ? ` · ${cargoNome}` : ""}`} largura="max-w-3xl">
      <div className="space-y-4">
        {/* Resumo do que a pessoa vai receber (item 6) */}
        <Card>
          <CardHeader
            title="Resumo do mês"
            subtitle={fechamento?.aprovado ? "Aprovado — entra no 1º pagamento do mês." : "Parcial — ainda em aberto."}
            icon={<Coins className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            {lancamentos.length === 0 ? (
              <p className="text-sm text-slate-400">Nada lançado ainda neste mês.</p>
            ) : (
              <>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TIPOS.filter((t) => (totalPorTipo.get(t.tipo) ?? 0) > 0).map((t) => (
                    <div key={t.tipo} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
                      <span className="text-sm text-slate-600">{t.label}</span>
                      <span className="text-sm font-semibold tabular-nums text-slate-800">{formatBRL(totalPorTipo.get(t.tipo) ?? 0)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-brand/20 bg-brand/5 px-4 py-3">
                  <div>
                    <p className="text-xs text-slate-500">Total {fechamento?.aprovado ? "aprovado" : "parcial"} a receber</p>
                    {minutosExtrasLancados > 0 && (
                      <p className="text-[11px] text-slate-400">Inclui {minParaHora(minutosExtrasLancados)} de hora extra lançada por horário</p>
                    )}
                  </div>
                  <p className="text-2xl font-bold tabular-nums text-brand-ink">{formatBRL(total)}</p>
                </div>
              </>
            )}
          </CardBody>
        </Card>

        {/* Folha aprovada = fechada. Mexer depois de aprovar mudava o total sem
            mudar o carimbo de aprovação: o PDF saía "Aprovada em <data>" com um
            valor que ninguém aprovou. Para alterar, reabra primeiro. */}
        {fechamento?.aprovado ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-green-800">
              <Lock className="h-4 w-4" /> Folha aprovada — fechada para alterações
            </p>
            <p className="mt-1 text-xs text-green-700">
              Aprovada em {fechamento.aprovadoEm ? new Date(fechamento.aprovadoEm).toLocaleString("pt-BR") : "—"}. Para lançar ou corrigir alguma verba, clique em “Aprovada — clique para reabrir” abaixo.
            </p>
          </div>
        ) : (
        /* Adicionar/editar lançamento */
        <Card>
          <CardHeader
            title={editando ? "Editar lançamento" : "Lançar verba"}
            subtitle={editando ? "Altere e salve — o valor pode ser corrigido à vontade." : "A assistente lança aqui durante o mês."}
            icon={editando ? <Pencil className="h-[18px] w-[18px]" /> : <Plus className="h-[18px] w-[18px]" />}
          />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamento)}>{TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}</Select></Campo>
              <Campo label="Dia (opcional)"><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
              <Campo label="Descrição (opcional)" className="lg:col-span-2"><Input placeholder="Ex.: viagem SP" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
            </div>

            {/* Hora extra: início e fim somam as horas e o valor sai do salário */}
            {ehHoraExtra && (
              <div className="mt-3 rounded-xl border border-brand/20 bg-brand/5 p-3">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Clock className="h-3.5 w-3.5" /> Horário da hora extra</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo label="Início"><Input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} /></Campo>
                  <Campo label="Fim"><Input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></Campo>
                  <Campo label="Adicional">
                    <Select value={String(fatorHE)} onChange={(e) => setFatorHE(Number(e.target.value))}>
                      {ADICIONAIS_HE.map((a) => <option key={a.fator} value={a.fator}>{a.label}</option>)}
                    </Select>
                  </Campo>
                </div>
                {minutosHE > 0 && (
                  <p className="mt-2 text-xs text-slate-600">
                    <b>{minParaHora(minutosHE)}</b> de hora extra
                    {calcHE.semSalario
                      ? <span className="text-amber-700"> · sem salário no cadastro — digite o valor à mão</span>
                      : <> · {horasDecimais(minutosHE)} h × {formatBRL(calcHE.valorHoraExtra)} = <b>{formatBRL(calcHE.valor)}</b> <span className="text-slate-400">(hora de {formatBRL(calcHE.valorHoraNormal)})</span></>}
                  </p>
                )}
              </div>
            )}

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Campo label="Valor (R$)" hint={ehHoraExtra && minutosHE > 0 && !calcHE.semSalario ? "Sugerido pelo cálculo — pode alterar" : undefined}>
                {/* Apagar o campo devolve a sugestão do cálculo (é o jeito de recalcular). */}
                <Input inputMode="decimal" placeholder="0,00" value={valorEfetivo}
                  onChange={(e) => { setValor(e.target.value); setValorTocado(e.target.value !== ""); }} />
              </Campo>
            </div>

            <div className="mt-3 flex justify-end gap-2">
              {editando && <button className="btn-outline" onClick={limpar}>Cancelar edição</button>}
              <button className="btn-primary" onClick={salvar}>
                {editando ? <><CheckCircle2 className="h-4 w-4" /> Salvar alteração</> : <><Plus className="h-4 w-4" /> Adicionar</>}
              </button>
            </div>
          </CardBody>
        </Card>
        )}

        {/* Lançamentos do mês */}
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr><th className="th">Dia</th><th className="th">Tipo</th><th className="th">Descrição</th><th className="th text-right">Valor</th><th className="th" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lancamentos.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-slate-400">Nenhuma verba lançada neste mês.</td></tr>
              ) : lancamentos.map((l) => (
                <tr key={l.id} className={cn(editando?.id === l.id && "bg-brand/5")}>
                  <td className="td tabular-nums text-slate-500">{diaBR(l.data)}</td>
                  <td className="td text-slate-700">
                    {labelTipo(l.tipo)}
                    {/* Hora extra por horário: mostra de onde veio o valor */}
                    {l.minutos ? (
                      <p className="text-[11px] text-slate-400">
                        {l.horaInicio}–{l.horaFim} · {minParaHora(l.minutos)}
                        {l.fatorHE ? ` · ${ADICIONAIS_HE.find((a) => a.fator === l.fatorHE)?.curto ?? ""}` : ""}
                        {l.valorSugerido != null && Math.abs(l.valorSugerido - l.valor) > 0.01 ? ` · ajustado (sugerido ${formatBRL(l.valorSugerido)})` : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="td text-slate-500">{l.descricao || "—"}</td>
                  <td className="td text-right tabular-nums font-medium text-slate-700">{formatBRL(l.valor)}</td>
                  <td className="td text-right">
                    {/* Aprovada = fechada: sem editar nem remover até reabrir. */}
                    {fechamento?.aprovado ? (
                      <span className="text-[11px] text-green-700">aprovado</span>
                    ) : (
                      <div className="flex items-center justify-end gap-1">
                        <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" title="Editar" onClick={() => abrirEdicao(l)}><Pencil className="h-4 w-4" /></button>
                        <button
                          className="btn-ghost p-1.5 text-red-500"
                          title="Remover"
                          onClick={() => {
                            // Verba é dinheiro e não tem desfazer: confirma antes.
                            if (window.confirm(`Remover ${labelTipo(l.tipo)} de ${formatBRL(l.valor)}?\n\nIsso não pode ser desfeito.`)) {
                              if (editando?.id === l.id) limpar(); // não deixa o formulário editando um item que sumiu
                              onRemover(l.id);
                            }
                          }}
                        ><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50/60">
              <tr><td colSpan={3} className="td font-semibold text-slate-700">Total de verbas</td><td className="td text-right text-base font-bold tabular-nums text-brand-ink">{formatBRL(total)}</td><td /></tr>
            </tfoot>
          </table>
        </div>

        {/* Ações: aprovar + exportar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <div className="flex gap-2">
            <button className="btn-outline" onClick={() => void exportarPdf(dadosRel)}><FileDown className="h-4 w-4" /> PDF</button>
            <button className="btn-outline" onClick={() => exportarExcel(dadosRel)}><FileSpreadsheet className="h-4 w-4" /> Excel</button>
          </div>
          {fechamento?.aprovado ? (
            <button className="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700" onClick={() => onAprovar(false)}>
              <CheckCircle2 className="h-4 w-4" /> Aprovada — clique para reabrir
            </button>
          ) : (
            <button className="btn-primary" onClick={() => onAprovar(true)}><ShieldCheck className="h-4 w-4" /> Aprovar folha do mês</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Exportações (PDF via jsPDF sob demanda; Excel via tabela HTML .xls formatada).
interface DadosRel {
  colaborador: Colaborador;
  competencia: string;
  config: { empresaNome?: string };
  lancamentos: Lancamento[];
  fechamento: { aprovado: boolean; aprovadoEm?: string | null } | undefined;
  cargoNome: string;
  totalPorTipo: Map<TipoLancamento, number>;
  total: number;
}

function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoga só depois: em Safari/Firefox o fetch do blob pode ser assíncrono.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// A tela mostra horário/horas/adicional ao lado do tipo; quem lança hora extra
// pelo relógio costuma deixar a descrição vazia, e o relatório chegava à
// contabilidade com um valor sem nenhuma justificativa das horas.
function descricaoExport(l: Lancamento): string {
  if (!l.minutos) return l.descricao || "";
  const adicional = l.fatorHE ? ADICIONAIS_HE.find((a) => a.fator === l.fatorHE)?.curto ?? "" : "";
  const ajustado = l.valorSugerido != null && Math.abs(l.valorSugerido - l.valor) > 0.01
    ? `ajustado (sugerido ${formatBRL(l.valorSugerido)})`
    : "";
  return [`${l.horaInicio}–${l.horaFim}`, minParaHora(l.minutos), adicional, ajustado, l.descricao]
    .filter(Boolean).join(" · ");
}

async function exportarPdf(r: DadosRel) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();
  const marinho: [number, number, number] = [22, 51, 79];
  doc.setFontSize(16); doc.setTextColor(...marinho);
  doc.text(r.config.empresaNome || "Impresilk", 14, 18);
  doc.setFontSize(12); doc.setTextColor(60);
  doc.text(`Folha Variável — ${labelMes(r.competencia)}`, 14, 26);
  doc.setFontSize(11); doc.setTextColor(20);
  doc.text(`${r.colaborador.nome}${r.cargoNome ? ` · ${r.cargoNome}` : ""}`, 14, 34);

  autoTable(doc, {
    startY: 42,
    head: [["Dia", "Tipo", "Descrição", "Valor (R$)"]],
    body: r.lancamentos.map((l) => [diaBR(l.data), labelTipo(l.tipo), descricaoExport(l), formatBRL(l.valor)]),
    foot: [["", "", "TOTAL", formatBRL(r.total)]],
    headStyles: { fillColor: marinho },
    footStyles: { fillColor: [240, 243, 246], textColor: marinho, fontStyle: "bold" },
    columnStyles: { 3: { halign: "right" } },
    styles: { fontSize: 9 },
  });
  let y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 60) + 10;
  doc.setFontSize(9); doc.setTextColor(90);
  doc.text(r.fechamento?.aprovado ? `Aprovada em ${r.fechamento.aprovadoEm ? new Date(r.fechamento.aprovadoEm).toLocaleDateString("pt-BR") : "—"} — pagar no 1º pagamento do mês.` : "Pendente de aprovação.", 14, y);
  y += 8;
  doc.setDrawColor(200); doc.line(120, y + 6, 195, y + 6);
  doc.text("Aprovação (contabilidade)", 130, y + 11);
  baixar(`folha-variavel-${slug(r.colaborador.nome)}-${r.competencia}.pdf`, doc.output("blob"));
}

function exportarExcel(r: DadosRel) {
  const linhas = r.lancamentos.map((l) => `<tr><td>${diaBR(l.data)}</td><td>${labelTipo(l.tipo)}</td><td>${descricaoExport(l).replace(/</g, "")}</td><td style="text-align:right">${l.valor.toFixed(2).replace(".", ",")}</td></tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1">
<tr><td colspan="4" style="font-weight:bold;font-size:14px">${r.config.empresaNome || "Impresilk"} — Folha Variável — ${labelMes(r.competencia)}</td></tr>
<tr><td colspan="4">${r.colaborador.nome}${r.cargoNome ? " · " + r.cargoNome : ""}</td></tr>
<tr></tr>
<tr style="background:#16334f;color:#fff;font-weight:bold"><td>Dia</td><td>Tipo</td><td>Descrição</td><td>Valor (R$)</td></tr>
${linhas || '<tr><td colspan="4">Sem lançamentos</td></tr>'}
<tr style="font-weight:bold"><td colspan="3">TOTAL</td><td style="text-align:right">${r.total.toFixed(2).replace(".", ",")}</td></tr>
</table></body></html>`;
  baixar(`folha-variavel-${slug(r.colaborador.nome)}-${r.competencia}.xls`, new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}
