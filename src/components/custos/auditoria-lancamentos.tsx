import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, UserSearch, Wand2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { Select } from "@/components/ui/form";
import { formatBRL } from "@/lib/format";
import { compLabel } from "@/lib/custos";
import { auditarLancamentos, ROTULO_REGRA, type AchadoAuditoria, type Gravidade, type RegraAuditoria } from "@/lib/auditoriaLancamentos";
import type { Colaborador, Pagamento } from "@/data/types";

const MOSTRAR = 25;
const TOM: Record<Gravidade, { caixa: string; chip: string; rotulo: string }> = {
  erro: { caixa: "border-red-200 bg-red-50/60", chip: "bg-red-100 text-red-700", rotulo: "Erro" },
  atencao: { caixa: "border-amber-200 bg-amber-50/50", chip: "bg-amber-100 text-amber-700", rotulo: "Atenção" },
  aviso: { caixa: "border-slate-200 bg-slate-50", chip: "bg-slate-100 text-slate-600", rotulo: "Aviso" },
};

/**
 * A auditoria dos lançamentos, na tela.
 *
 * Em 07/09/2026 esta conferência foi feita à mão sobre os 1.451 lançamentos
 * gravados desde agosto/2025 — funcionário por funcionário, linha por linha.
 * Ela achou 11 cadastros que contradizem os pagamentos (data de desligamento
 * errada esconde a pessoa do quadro e esvazia a ficha dela), 8 pares de
 * títulos gêmeos no mesmo dia e 29 pessoas com mês no quadro sem lançamento
 * nenhum. Nada disso aparecia em tela nenhuma.
 *
 * O painel existe para essa varredura não precisar de mais ninguém: roda
 * sozinha, sobre a competência que estiver escolhida ou sobre a história
 * inteira, e conserta sozinha só o que é determinístico (tipo e competência).
 * Cadastro e vínculo são decisão humana — ela aponta e leva até a pessoa.
 */
export function AuditoriaLancamentos({
  pagamentos,
  colaboradores,
  onCorrigir,
  onVerPessoa,
}: {
  pagamentos: Pagamento[];
  colaboradores: Colaborador[];
  /** Aplica os consertos determinísticos (tipo, competência) em lote. */
  onCorrigir: (achados: AchadoAuditoria[]) => void;
  onVerPessoa?: (colaboradorId: string) => void;
}) {
  const anos = useMemo(
    () => [...new Set(pagamentos.map((p) => String(p.competencia ?? "").slice(0, 4)).filter(Boolean))].sort().reverse(),
    [pagamentos],
  );
  const [ano, setAno] = useState("");
  const [gravidade, setGravidade] = useState<Gravidade | "">("");
  const [confirmar, setConfirmar] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const { achados, resumo } = useMemo(
    () => auditarLancamentos(pagamentos, colaboradores, ano ? { de: `${ano}-01`, ate: `${ano}-12` } : {}),
    [pagamentos, colaboradores, ano],
  );
  const visiveis = gravidade ? achados.filter((a) => a.gravidade === gravidade) : achados;
  const consertaveis = achados.filter((a) => a.conserto);
  const porRegra = useMemo(() => {
    const m = new Map<RegraAuditoria, AchadoAuditoria[]>();
    for (const a of visiveis) m.set(a.regra, [...(m.get(a.regra) ?? []), a]);
    return [...m.entries()];
  }, [visiveis]);
  const limpo = achados.length === 0;
  const nome = (id: string) => colaboradores.find((c) => c.id === id)?.nome ?? id;

  return (
    <Card idPersistencia="custos:auditoria-lancamentos">
      <CardHeader
        title="Auditoria dos lançamentos"
        subtitle="Pessoa por pessoa, linha por linha: tipo × conta, competência × vencimento, cadastro × pagamentos, título em dobro e mês no quadro sem lançamento."
        icon={<ClipboardCheck className="h-5 w-5" />}
        action={
          consertaveis.length > 0 ? (
            <button type="button" className="btn-primary" onClick={() => setConfirmar(true)}>
              <Wand2 className="h-4 w-4" /> Corrigir {consertaveis.length} automático(s)
            </button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ano} onChange={(e) => setAno(e.target.value)} className="h-9 w-auto py-0 text-sm">
            <option value="">Toda a história</option>
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          {(["erro", "atencao", "aviso"] as Gravidade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGravidade(gravidade === g ? "" : g)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                gravidade === g ? "ring-brand bg-brand/10 text-brand-ink" : "ring-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {TOM[g].rotulo}: {resumo.porGravidade[g]}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {resumo.linhas} lançamento(s) · {resumo.pessoas} pessoa(s) ·{" "}
            {resumo.competencias.length ? `${compLabel(resumo.competencias[0])} a ${compLabel(resumo.competencias[resumo.competencias.length - 1])}` : "sem competência"}
          </span>
        </div>

        <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${limpo ? "border-green-200 bg-green-50/60 text-green-800" : TOM.erro.caixa + " text-red-800"}`}>
          {limpo ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>
            {limpo
              ? `Varreu ${resumo.linhas} lançamento(s) e não achou nada fora do lugar.`
              : `${resumo.porGravidade.erro} erro(s), ${resumo.porGravidade.atencao} de atenção e ${resumo.porGravidade.aviso} aviso(s) em ${resumo.linhas} lançamento(s).`}
            {consertaveis.length > 0 && " Tipo e competência têm conserto automático; cadastro e vínculo são decisão sua."}
          </p>
        </div>

        {porRegra.map(([regra, lista]) => {
          const aberto = abertos.has(regra);
          const g = lista[0].gravidade;
          return (
            <div key={regra} className={`rounded-xl border ${TOM[g].caixa}`}>
              <button
                type="button"
                onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(regra)) n.delete(regra); else n.add(regra); return n; })}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TOM[g].chip}`}>{TOM[g].rotulo}</span>
                <span className="text-sm font-semibold text-brand-ink">{ROTULO_REGRA[regra]}</span>
                <span className="text-xs text-slate-500">{lista.length}</span>
                <span className="ml-auto text-xs text-slate-500">{aberto ? "esconder" : "ver"}</span>
              </button>
              {aberto && (
                <ul className="space-y-1.5 border-t border-black/5 px-3 py-2">
                  {lista.slice(0, MOSTRAR).map((a, i) => (
                    <li key={`${a.regra}:${a.colaboradorId}:${a.pagamentoIds[0] ?? i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium text-brand-ink">{nome(a.colaboradorId)}</span>
                      <span className="text-slate-600">{a.detalhe}</span>
                      {a.valor > 0 && <span className="tabular-nums text-slate-500">{formatBRL(a.valor)}</span>}
                      {onVerPessoa && (
                        <button type="button" className="inline-flex items-center gap-1 text-xs text-brand hover:underline" onClick={() => onVerPessoa(a.colaboradorId)}>
                          <UserSearch className="h-3 w-3" /> abrir
                        </button>
                      )}
                    </li>
                  ))}
                  {lista.length > MOSTRAR && (
                    <li className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                      <Info className="h-3 w-3" /> e mais {lista.length - MOSTRAR} — filtre por ano para ver o resto.
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}

        {confirmar && (
          <ConfirmDialog
            aberto
            titulo={`Corrigir ${consertaveis.length} lançamento(s)?`}
            mensagem={`Só o que é determinístico: ${consertaveis.filter((a) => a.conserto?.campo === "tipo").length} tipo(s) pelo nome da conta e ${consertaveis.filter((a) => a.conserto?.campo === "competencia").length} competência(s) pela regra 16→15. Cadastro e vínculo não são tocados. Fica no histórico e pode ser revisto lançamento a lançamento.`}
            textoConfirmar={`Corrigir ${consertaveis.length}`}
            perigo={false}
            onConfirmar={() => { setConfirmar(false); onCorrigir(consertaveis); }}
            onFechar={() => setConfirmar(false)}
          />
        )}
      </CardBody>
    </Card>
  );
}
