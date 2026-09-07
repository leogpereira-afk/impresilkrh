import { useState } from "react";
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
  onAbrirMes,
  onIrParaMes,
}: {
  resumo: ResumoDaEquipe;
  pessoaNome?: string;
  /** Fatia da pessoa aberta no estimado do mês (0 a 1) — null quando o mês é zero. */
  pessoaPeso: number | null;
  /** Segue o mesmo botão da ficha: estimado com provisões ou só o pago. */
  comEncargos: boolean;
  /** Abre quem compõe o total de uma competência (a lista de pessoas com o valor de cada uma). */
  onAbrirMes?: (competencia: string) => void;
  /** Leva a tela inteira para outra competência. */
  onIrParaMes?: (competencia: string) => void;
}) {
  // A régua mês a mês fica escondida até alguém querer ver de onde sai a média:
  // é referência, não é o número do mês.
  const [verSerie, setVerSerie] = useState(false);
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
            {/* O número do mês abre quem o compõe, pessoa por pessoa (pedido do
                Leonardo, 07/09/2026: "aqui tem que ser clicável"). */}
            <button
              type="button"
              onClick={() => onAbrirMes?.(resumo.competencia)}
              disabled={!onAbrirMes || resumo.pessoas === 0}
              className="mt-1 block text-left text-3xl font-semibold tabular-nums text-brand-ink hover:underline disabled:cursor-default disabled:no-underline"
              title={resumo.pessoas ? "Ver quem compõe este total" : undefined}
            >
              {formatBRL(principal)}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              {comEncargos
                ? `Pago ${formatBRL(resumo.pago)} + provisões ${formatBRL(resumo.provisoes)} (FGTS 8%, 13º e férias sobre ${formatBRL(resumo.base)}). Não é o custo patronal completo.`
                : `Pago às pessoas. FGTS e INSS lançados ficam fora — são custo da empresa.`}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatCard label="Pago à equipe" value={formatBRL(resumo.pago)} icon={<Users className="h-4 w-4" />} accent="blue" onClick={resumo.pessoas ? () => onAbrirMes?.(resumo.competencia) : undefined} />
              <StatCard label="Provisões" value={formatBRL(resumo.provisoes)} icon={<PiggyBank className="h-4 w-4" />} accent="gold" hint={`sobre ${formatBRL(resumo.base)}`} />
              <StatCard label="Média por pessoa" value={formatBRL(resumo.mediaPorPessoa)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" hint={`${resumo.pessoas} pessoa(s)`} onClick={resumo.pessoas ? () => onAbrirMes?.(resumo.competencia) : undefined} />
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
                {/* O MÊS NA FRENTE (pedido do Leonardo, 07/09/2026: "tem que ser
                    apenas o do mês"). A média e o pior mês ficam abaixo, como
                    referência para dimensionar a conta — em corpo menor, e nunca
                    um número de ano competindo com o do mês. */}
                <button
                  type="button"
                  onClick={() => onAbrirMes?.(resumo.competencia)}
                  disabled={!onAbrirMes || resumo.pessoas === 0}
                  className="mt-2 block w-full text-left disabled:cursor-default"
                  title={resumo.pessoas ? "Ver quem compõe este total" : undefined}
                >
                  <span className="block text-sm text-slate-600">Separar para {compLabelLongo(resumo.competencia)}</span>
                  <span className="mt-0.5 block text-2xl font-semibold tabular-nums text-brand-ink">{formatBRL(resumo.estimado)}</span>
                  <span className="block text-[11px] text-slate-500">o custo estimado deste mês, com provisões</span>
                </button>

                <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt>
                      <button type="button" onClick={() => setVerSerie((v) => !v)} className="text-slate-600 hover:text-brand-ink hover:underline">
                        Média de {resumo.serie.length} mês(es) {verSerie ? "▾" : "▸"}
                      </button>
                    </dt>
                    <dd className="font-semibold tabular-nums text-brand-ink">{formatBRL(resumo.mediaEstimada)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt>
                      <button
                        type="button"
                        onClick={() => resumo.competenciaDoPico && onIrParaMes?.(resumo.competenciaDoPico)}
                        disabled={!onIrParaMes || !resumo.competenciaDoPico}
                        className="text-slate-600 hover:text-brand-ink hover:underline disabled:no-underline"
                        title="Abrir este mês na tela"
                      >
                        Pior mês{resumo.competenciaDoPico ? ` (${compLabel(resumo.competenciaDoPico)})` : ""}
                      </button>
                    </dt>
                    <dd className="font-semibold tabular-nums text-brand-ink">{formatBRL(resumo.picoEstimado)}</dd>
                  </div>
                </dl>

                {verSerie && (
                  <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-100">
                    <table className="w-full text-xs">
                      <tbody>
                        {[...resumo.serie].reverse().map((m) => (
                          <tr key={m.competencia} className="border-b border-slate-50 last:border-0">
                            <td className="px-2 py-1">
                              <button type="button" className="text-slate-600 hover:text-brand-ink hover:underline" onClick={() => onIrParaMes?.(m.competencia)}>
                                {compLabel(m.competencia)}
                              </button>
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-slate-500">{m.pessoas} pessoa(s)</td>
                            <td className="px-2 py-1 text-right font-medium tabular-nums text-brand-ink">{formatBRL(m.estimado)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  A média serve para dimensionar a conta; o depósito de cada mês é o valor do próprio mês. Mês sem folha
                  não entra na média como R$ 0,00 — ausência não é zero e puxaria a reserva para baixo.
                </p>
                {/* Série: a barra do mês aberto fica destacada, e cada uma leva ao seu mês. */}
                <div className="mt-3 flex h-16 items-end gap-1">
                  {resumo.serie.map((m) => (
                    <button
                      key={m.competencia}
                      type="button"
                      onClick={() => onIrParaMes?.(m.competencia)}
                      title={`${compLabel(m.competencia)} · ${formatBRL(m.estimado)}`}
                      aria-label={`Abrir ${compLabel(m.competencia)}`}
                      className={`flex-1 rounded-t transition-opacity hover:opacity-80 ${m.competencia === resumo.competencia ? "bg-brand" : "bg-brand/25"}`}
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
