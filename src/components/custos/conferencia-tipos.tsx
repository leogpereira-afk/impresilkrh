import { useMemo, useState } from "react";
import { CheckCircle2, AlertTriangle, ListChecks, Wand2 } from "lucide-react";
import { Pessoa } from "@/components/ui/pessoa";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatBRL } from "@/lib/format";
import { compLabel } from "@/lib/custos";
import { corDoTipo } from "@/lib/folha";
import { conferirTipos, type Divergencia } from "@/lib/conferirTipos";
import type { Pagamento } from "@/data/types";

const MOSTRAR = 60;

/**
 * "Cada pagamento está no tipo certo?" — a conferência que faltou em jul/2026.
 *
 * Compara o tipo gravado com o que o NOME da conta do contador diz (a mesma
 * regra que classifica o que chega do ERP). Divergência é lista, com a pessoa,
 * o mês e a conta; a correção é em lote, pelo caminho normal do app — cada
 * registro é atualizado e sobe para a nuvem com rastro no histórico.
 */
export function ConferenciaTipos({
  pagamentos,
  colaboradorPor,
  nomeDe,
  onCorrigir,
}: {
  pagamentos: Pagamento[];
  /** Para a conferência saber quem é sócio — em sócio a conta do ERP não manda. */
  colaboradorPor?: (id: string) => { id: string; ehDirecao?: boolean; statusId?: string } | undefined;
  nomeDe: (colaboradorId: string) => string;
  onCorrigir: (divergencias: Divergencia[]) => void;
}) {
  const r = useMemo(() => conferirTipos(pagamentos, colaboradorPor), [pagamentos, colaboradorPor]);
  const [confirmar, setConfirmar] = useState(false);
  const n = r.divergencias.length;
  const tudoCerto = n === 0;

  return (
    <Card idPersistencia="custos:conferencia-tipos">
      <CardHeader
        title="Classificação dos tipos"
        subtitle="Cada lançamento do ERP comparado com o nome da conta do contador — o nome manda, o código só desempata."
        icon={<ListChecks className="h-5 w-5" />}
        action={
          !tudoCerto ? (
            <button type="button" className="btn-primary" onClick={() => setConfirmar(true)}>
              <Wand2 className="h-4 w-4" /> Corrigir {n} lançamento{n === 1 ? "" : "s"}
            </button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className={"flex items-start gap-3 rounded-xl border p-3 text-sm " + (tudoCerto && r.conferiveis > 0 ? "border-green-200 bg-green-50/60 text-green-800" : "border-amber-200 bg-amber-50/60 text-amber-800")}>
          {tudoCerto && r.conferiveis > 0 ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <div>
            <p className="font-semibold">
              {r.conferiveis === 0 ? "Sem dados suficientes para conferir a classificação" : tudoCerto
                ? `Todos os ${r.conferiveis} lançamentos conferíveis estão no tipo que a conta diz.`
                : `${n} de ${r.conferiveis} lançamentos estão num tipo diferente do que a conta do contador diz.`}
            </p>
            <p className="mt-0.5 text-xs opacity-80">
              {pagamentos.length === 0 ? "Nenhum lançamento disponível nesta base." : r.semConta > 0
                ? `${r.semConta} sem conta na descrição (planilha antiga ou lançamento manual) ficam fora da conferência — não há como conferi-los sem o ERP.`
                : "Todos os lançamentos têm a conta do ERP na descrição."}
            </p>
          </div>
        </div>

        {!tudoCerto && (
          <>
            <div className="flex flex-wrap gap-2">
              {r.porTroca.map((t) => (
                <span key={`${t.de}→${t.para}`} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700" title={formatBRL(t.valor)}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDoTipo(t.de) }} />
                  <span className="line-through decoration-slate-400">{t.de}</span>
                  <span aria-hidden="true">→</span>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDoTipo(t.para) }} />
                  <span className="font-medium">{t.para}</span>
                  <span className="rounded-full bg-slate-100 px-1.5 font-mono text-[10px] text-slate-500">{t.quantos}</span>
                </span>
              ))}
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200/70">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <th className="th">Mês</th>
                    <th className="th">Colaborador</th>
                    <th className="th">Gravado</th>
                    <th className="th">Conta diz</th>
                    <th className="th">Conta do ERP</th>
                    <th className="th text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {r.divergencias.slice(0, MOSTRAR).map((d) => (
                    <tr key={d.id}>
                      <td className="td tabular-nums text-slate-600">{compLabel(d.competencia)}</td>
                      <td className="td font-medium text-slate-800"><Pessoa nome={nomeDe(d.colaboradorId)} colaboradorId={d.colaboradorId} /></td>
                      <td className="td text-slate-500 line-through decoration-slate-300">{d.de}</td>
                      <td className="td font-medium text-brand-ink">{d.para}</td>
                      <td className="td font-mono text-xs text-slate-500">{d.plano}</td>
                      <td className="td text-right tabular-nums">{formatBRL(d.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {n > MOSTRAR && <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">… e mais {n - MOSTRAR}. A correção pega todos.</p>}
            </div>
          </>
        )}
      </CardBody>
      <ConfirmDialog
        aberto={confirmar}
        onFechar={() => setConfirmar(false)}
        onConfirmar={() => { setConfirmar(false); onCorrigir(r.divergencias); }}
        titulo={`Corrigir ${n} lançamento${n === 1 ? "" : "s"}`}
        mensagem="Cada lançamento passa para o tipo que o nome da conta do contador indica. Pessoa, mês, valor e data não mudam. A alteração sobe para a nuvem e fica no histórico."
      />
    </Card>
  );
}
