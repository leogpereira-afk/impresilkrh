import { useMemo, useState } from "react";
import {
  Coins, Plus, Trash2, CheckCircle2, FileDown, FileSpreadsheet, Clock, CalendarX2, Lock, ShieldCheck,
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
import { minParaHora } from "@/lib/pontoImport";
import { slug } from "@/data/_gen";
import type { Colaborador, Lancamento, TipoLancamento, Ponto } from "@/data/types";

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

export default function FolhaVariavel() {
  const sessao = useSessao();
  const d = useDominio();
  const config = useConfig();
  const toast = useToast();
  const podeEditar = podeGerir(sessao);
  const { items: lancamentos, criar, remover } = useColecao("lancamentos");
  const { items: pontos } = useColecao("pontos");
  const { items: fechamentos, criar: criarFech, atualizar: atualizarFech } = useColecao("fechamentos");

  const [competencia, setCompetencia] = useState(compAtual());
  const [aberto, setAberto] = useState<Colaborador | null>(null);

  const escopo = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores)
      .filter((c) => c.statusId !== "inativo")
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [sessao, d.colaboradores],
  );

  const lancDe = (colId: string) => lancamentos.filter((l) => l.colaboradorId === colId && l.competencia === competencia);
  const totalDe = (colId: string) => lancDe(colId).reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const pontoDe = (colId: string): Ponto | undefined => pontos.find((p) => p.colaboradorId === colId && p.competencia === competencia);
  const fechDe = (colId: string) => fechamentos.find((f) => f.id === `${competencia}::${colId}`);

  const totalGeral = escopo.reduce((s, c) => s + totalDe(c.id), 0);
  const aprovados = escopo.filter((c) => fechDe(c.id)?.aprovado).length;

  if (!podeEditar) {
    return (
      <div>
        <PageHeader title="Folha Variável" description="Verbas do mês por colaborador." />
        <EmptyState icon={<Lock className="h-6 w-6" />} title="Sem permissão" description="A folha variável é restrita ao RH/gestão." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Folha Variável"
        description="Verbas do mês por colaborador — hora extra, empreita, diária, bônus, comissão e limpeza. Some ao ponto e sai em PDF/Excel para a contabilidade."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-medium">Competência</span>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none" />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Total do mês" value={formatBRL(totalGeral)} icon={<Coins className="h-4 w-4" />} />
          <StatCard label="Aprovados" value={`${aprovados}/${escopo.length}`} icon={<ShieldCheck className="h-4 w-4" />} />
          <StatCard label="Colaboradores" value={String(escopo.length)} icon={<CheckCircle2 className="h-4 w-4" />} />
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
                  <th className="th text-right">Extras (ponto)</th>
                  <th className="th text-right">Faltas (ponto)</th>
                  <th className="th text-right">Verbas do mês</th>
                  <th className="th text-center">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {escopo.map((c) => {
                  const pt = pontoDe(c.id);
                  const fe = fechDe(c.id);
                  const tot = totalDe(c.id);
                  return (
                    <tr key={c.id} className="hover:bg-slate-50/50">
                      <td className="td font-medium text-slate-700">{c.nome}</td>
                      <td className="td text-right tabular-nums text-brand">{pt ? minParaHora(pt.extrasMin) : "—"}</td>
                      <td className={`td text-right tabular-nums ${pt && pt.faltasMin > 0 ? "text-red-600" : "text-slate-400"}`}>{pt ? minParaHora(pt.faltasMin) : "—"}</td>
                      <td className="td text-right tabular-nums font-medium text-slate-700">{tot > 0 ? formatBRL(tot) : "—"}</td>
                      <td className="td text-center">
                        {fe?.aprovado ? <Badge variant="success">Aprovado</Badge> : <Badge variant="neutral">Pendente</Badge>}
                      </td>
                      <td className="td text-right">
                        <button className="btn-outline px-3 py-1.5 text-sm" onClick={() => setAberto(c)}>Abrir</button>
                      </td>
                    </tr>
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
          ponto={pontoDe(aberto.id)}
          fechamento={fechDe(aberto.id)}
          cargoNome={d.nomeCargo(aberto) ?? aberto.cargoLivre ?? ""}
          onFechar={() => setAberto(null)}
          onCriar={(rec) => criar(rec)}
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

// ============================================================================
function DetalheColaborador({
  colaborador, competencia, config, lancamentos, ponto, fechamento, cargoNome,
  onFechar, onCriar, onRemover, onAprovar, toast,
}: {
  colaborador: Colaborador;
  competencia: string;
  config: { empresaNome?: string };
  lancamentos: Lancamento[];
  ponto: Ponto | undefined;
  fechamento: { aprovado: boolean; aprovadoEm?: string | null } | undefined;
  cargoNome: string;
  onFechar: () => void;
  onCriar: (rec: Lancamento) => void;
  onRemover: (id: string) => void;
  onAprovar: (aprovar: boolean) => void;
  toast: (m: string, t?: "sucesso" | "erro") => void;
}) {
  const [tipo, setTipo] = useState<TipoLancamento>("bonus");
  const [valor, setValor] = useState("");
  const [dia, setDia] = useState("");
  const [descricao, setDescricao] = useState("");

  const totalPorTipo = useMemo(() => {
    const m = new Map<TipoLancamento, number>();
    for (const l of lancamentos) m.set(l.tipo, (m.get(l.tipo) ?? 0) + (Number(l.valor) || 0));
    return m;
  }, [lancamentos]);
  const total = lancamentos.reduce((s, l) => s + (Number(l.valor) || 0), 0);

  const adicionar = () => {
    const v = Number(String(valor).replace(/\./g, "").replace(",", "."));
    if (!v || v <= 0) { toast("Informe um valor válido.", "erro"); return; }
    const agora = new Date().toISOString();
    onCriar({
      id: `${competencia}::${colaborador.id}::${slug(tipo)}::${agora}`,
      colaboradorId: colaborador.id, competencia, tipo, valor: v,
      data: dia || null, descricao: descricao.trim() || undefined,
      criadoEm: agora, atualizadoEm: agora,
    });
    setValor(""); setDescricao(""); setDia("");
    toast("Lançamento adicionado.");
  };

  const dadosRel = { colaborador, competencia, config, lancamentos, ponto, fechamento, cargoNome, totalPorTipo, total };

  return (
    <Modal aberto onFechar={onFechar} titulo={`Folha variável — ${colaborador.nome}`} descricao={`${labelMes(competencia)}${cargoNome ? ` · ${cargoNome}` : ""}`} largura="max-w-3xl">
      <div className="space-y-4">
        {/* Ponto do mês */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <Clock className="h-5 w-5 text-brand" />
            <div><p className="text-xs text-slate-500">Horas extras (ponto)</p><p className="text-lg font-semibold tabular-nums text-brand-ink">{ponto ? minParaHora(ponto.extrasMin) : "—"}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3">
            <CalendarX2 className="h-5 w-5 text-red-500" />
            <div><p className="text-xs text-slate-500">Faltas (ponto)</p><p className="text-lg font-semibold tabular-nums text-brand-ink">{ponto ? minParaHora(ponto.faltasMin) : "—"}</p></div>
          </div>
        </div>

        {/* Adicionar lançamento */}
        <Card>
          <CardHeader title="Lançar verba" subtitle="A assistente lança aqui durante o mês." icon={<Plus className="h-[18px] w-[18px]" />} />
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Campo label="Tipo"><Select value={tipo} onChange={(e) => setTipo(e.target.value as TipoLancamento)}>{TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.label}</option>)}</Select></Campo>
              <Campo label="Valor (R$)"><Input inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
              <Campo label="Dia (opcional)"><Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} /></Campo>
              <Campo label="Descrição (opcional)"><Input placeholder="Ex.: viagem SP" value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
            </div>
            <div className="mt-3 flex justify-end">
              <button className="btn-primary" onClick={adicionar}><Plus className="h-4 w-4" /> Adicionar</button>
            </div>
          </CardBody>
        </Card>

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
                <tr key={l.id}>
                  <td className="td tabular-nums text-slate-500">{diaBR(l.data)}</td>
                  <td className="td text-slate-700">{labelTipo(l.tipo)}</td>
                  <td className="td text-slate-500">{l.descricao || "—"}</td>
                  <td className="td text-right tabular-nums font-medium text-slate-700">{formatBRL(l.valor)}</td>
                  <td className="td text-right"><button className="btn-ghost p-1.5 text-red-500" onClick={() => onRemover(l.id)}><Trash2 className="h-4 w-4" /></button></td>
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
  ponto: Ponto | undefined;
  fechamento: { aprovado: boolean; aprovadoEm?: string | null } | undefined;
  cargoNome: string;
  totalPorTipo: Map<TipoLancamento, number>;
  total: number;
}

function baixar(nome: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
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
  doc.setFontSize(10); doc.setTextColor(90);
  doc.text(`Ponto do mês:  Horas extras ${r.ponto ? minParaHora(r.ponto.extrasMin) : "—"}   ·   Faltas ${r.ponto ? minParaHora(r.ponto.faltasMin) : "—"}`, 14, 41);

  autoTable(doc, {
    startY: 46,
    head: [["Dia", "Tipo", "Descrição", "Valor (R$)"]],
    body: r.lancamentos.map((l) => [diaBR(l.data), labelTipo(l.tipo), l.descricao || "", formatBRL(l.valor)]),
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
  const linhas = r.lancamentos.map((l) => `<tr><td>${diaBR(l.data)}</td><td>${labelTipo(l.tipo)}</td><td>${(l.descricao || "").replace(/</g, "")}</td><td style="text-align:right">${l.valor.toFixed(2).replace(".", ",")}</td></tr>`).join("");
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>
<table border="1">
<tr><td colspan="4" style="font-weight:bold;font-size:14px">${r.config.empresaNome || "Impresilk"} — Folha Variável — ${labelMes(r.competencia)}</td></tr>
<tr><td colspan="4">${r.colaborador.nome}${r.cargoNome ? " · " + r.cargoNome : ""}</td></tr>
<tr><td colspan="4">Ponto: extras ${r.ponto ? minParaHora(r.ponto.extrasMin) : "-"} · faltas ${r.ponto ? minParaHora(r.ponto.faltasMin) : "-"}</td></tr>
<tr></tr>
<tr style="background:#16334f;color:#fff;font-weight:bold"><td>Dia</td><td>Tipo</td><td>Descrição</td><td>Valor (R$)</td></tr>
${linhas || '<tr><td colspan="4">Sem lançamentos</td></tr>'}
<tr style="font-weight:bold"><td colspan="3">TOTAL</td><td style="text-align:right">${r.total.toFixed(2).replace(".", ",")}</td></tr>
</table></body></html>`;
  baixar(`folha-variavel-${slug(r.colaborador.nome)}-${r.competencia}.xls`, new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}
