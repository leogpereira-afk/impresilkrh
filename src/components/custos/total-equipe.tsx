import { Landmark, PiggyBank, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL } from "@/lib/format";
import { compLabel, compLabelLongo } from "@/lib/custos";
import type { ResumoDaEquipe } from "@/lib/provisaoEquipe";

const pctTexto = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")}%`;

/**
 * O total da equipe no mês, no topo da aba individual.
 *
 * Pedido do Leonardo (07/09/2026): "um título superior com todo esse estimado
 * com a soma de todos os funcionários — a partir do ano que vem vou depositar
 * esse custo numa conta separada para pagar esses acertos sem mexer no caixa".
 *
 * Por isso a faixa mostra DUAS coisas diferentes e diz qual é qual:
 *   - o mês (pago, provisões, estimado) — o que este mês custou;
 *   - a reserva (média, pico, ano) — quanto a conta precisa receber por mês
 *     para aguentar um mês como os últimos doze, e o pior mês da série, que é
 *     o que quebra uma reserva dimensionada só pela média.
 */
export function TotalEquipe({
  resumo,
  pessoaNome,
  pessoaPeso,
  comEncargos,
  onVerMes,
}: {
  resumo: ResumoDaEquipe;
  pessoaNome?: string;
  /** Fatia da pessoa aberta no estimado do mês (0 a 1) — null quando o mês é zero. */
  pessoaPeso: number | null;
  /** Segue o mesmo botão da ficha: estimado com provisões ou só o pago. */
  comEncargos: boolean;
  onVerMes?: () => void;
}) {
  const principal = comEncargos ? resumo.estimado : resumo.pago;
  const maior = Math.max(...resumo.serie.map((m) => m.estimado), 1);
  return (
    <Card idPersistencia="custos:total-equipe">
      <CardHeader
        icon={<Landmark className="h-5 w-5" />}
        title={`Custo total da equipe · ${compLabelLongo(resumo.competencia)}`}
        subtitle={
          resumo.pessoas > 0
            ? `${resumo.pessoas} pessoa(s) com lançamento no mês · soma de todos, sem sócios`
            : "Nenhum lançamento neste mês"
        }
        action={
          resumo.pctSobreMedia !== null && resumo.serie.length > 1 ? (
            <Badge variant={Math.abs(resumo.pctSobreMedia) < 0.1 ? "neutral" : resumo.pctSobreMedia > 0 ? "warning" : "success"}>
              <span title={`Média dos últimos ${resumo.serie.length} meses com lançamento: ${formatBRL(resumo.mediaEstimada)}`}>
                {pctTexto(resumo.pctSobreMedia)} sobre a média
              </span>
            </Badge>
          ) : undefined
        }
      />
      <CardBody>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          {/* ---- o mês ---- */}
          <div className="rounded-xl border border-brand/15 bg-brand/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {comEncargos ? "Custo estimado do mês (c/ provisões)" : "Custo pago do mês"}
            </p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-brand-ink">{formatBRL(principal)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {comEncargos
                ? `Pago ${formatBRL(resumo.pago)} + provisões ${formatBRL(resumo.provisoes)} (FGTS 8%, 13º e férias sobre ${formatBRL(resumo.base)}). Não é o custo patronal completo.`
                : `Pago às pessoas. FGTS e INSS lançados ficam fora — são custo da empresa.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatCard label="Pago à equipe" value={formatBRL(resumo.pago)} icon={<Users className="h-4 w-4" />} accent="blue" onClick={onVerMes} />
              <StatCard label="Provisões" value={formatBRL(resumo.provisoes)} icon={<PiggyBank className="h-4 w-4" />} accent="gold" hint={`sobre ${formatBRL(resumo.base)}`} />
              <StatCard label="Média por pessoa" value={formatBRL(resumo.mediaPorPessoa)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" hint={`${resumo.pessoas} pessoa(s)`} />
            </div>
            {pessoaNome && pessoaPeso !== null && (
              <p className="mt-3 text-xs text-slate-600">
                <strong className="font-semibold text-brand-ink">{pessoaNome}</strong> responde por{" "}
                <strong className="font-semibold tabular-nums text-brand-ink">{(pessoaPeso * 100).toFixed(1).replace(".", ",")}%</strong> deste total.
              </p>
            )}
          </div>

          {/* ---- a reserva ---- */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reserva para a conta dos acertos</p>
            {resumo.serie.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sem meses com lançamento — a reserva precisa de histórico para ser calculada.</p>
            ) : (
              <>
                <dl className="mt-2 space-y-1.5 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-slate-600">Depósito mensal sugerido</dt>
                    <dd className="font-semibold tabular-nums text-brand-ink">{formatBRL(resumo.mediaEstimada)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-slate-600">
                      Pior mês da série{resumo.competenciaDoPico ? ` (${compLabel(resumo.competenciaDoPico)})` : ""}
                    </dt>
                    <dd className="font-semibold tabular-nums text-brand-ink">{formatBRL(resumo.picoEstimado)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-slate-100 pt-1.5">
                    <dt className="text-slate-600">Doze meses nesse ritmo</dt>
                    <dd className="font-semibold tabular-nums text-brand-ink">{formatBRL(resumo.projecaoAno)}</dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  Média de {resumo.serie.length} mês(es) com lançamento. Mês sem folha não entra como zero — ausência não é
                  R$ 0,00 e puxaria a reserva para baixo.
                </p>
                {/* Série: a barra do mês aberto fica destacada. */}
                <div className="mt-3 flex h-16 items-end gap-1" aria-hidden>
                  {resumo.serie.map((m) => (
                    <div
                      key={m.competencia}
                      title={`${compLabel(m.competencia)} · ${formatBRL(m.estimado)}`}
                      className={`flex-1 rounded-t ${m.competencia === resumo.competencia ? "bg-brand" : "bg-brand/25"}`}
                      style={{ height: `${Math.max(6, (m.estimado / maior) * 100)}%` }}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                  <span>{compLabel(resumo.serie[0].competencia)}</span>
                  <span>{compLabel(resumo.serie[resumo.serie.length - 1].competencia)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
