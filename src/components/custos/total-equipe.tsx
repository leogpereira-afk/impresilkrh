import { Landmark, PiggyBank, TrendingUp, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL } from "@/lib/format";
import { compLabelLongo } from "@/lib/custos";
import type { ResumoDaEquipe } from "@/lib/provisaoEquipe";

const pctTexto = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1).replace(".", ",")}%`;

/**
 * O total da equipe no mês, no topo da aba individual.
 *
 * Pedido do Leonardo (07/09/2026): "um título superior com todo esse estimado
 * com a soma de todos os funcionários — a partir do ano que vem vou depositar
 * esse custo numa conta separada para pagar esses acertos sem mexer no caixa".
 *
 * A faixa mostra o MÊS — pago, provisões, estimado, média por pessoa e a fatia
 * da pessoa aberta — e só isso. Havia ao lado um quadro de "reserva" com média
 * de doze meses, pior mês e projeção do ano; o Leonardo mandou tirar
 * (07/09/2026): número de ano dentro de uma tela de mês confunde, e o quanto
 * o mês foge da média já está no chip do cabeçalho.
 */
export function TotalEquipe({
  resumo,
  pessoaNome,
  pessoaPeso,
  comEncargos,
  onAbrirMes,
}: {
  resumo: ResumoDaEquipe;
  pessoaNome?: string;
  /** Fatia da pessoa aberta no estimado do mês (0 a 1) — null quando o mês é zero. */
  pessoaPeso: number | null;
  /** Segue o mesmo botão da ficha: estimado com provisões ou só o pago. */
  comEncargos: boolean;
  /** Abre quem compõe o total de uma competência (a lista de pessoas com o valor de cada uma). */
  onAbrirMes?: (competencia: string) => void;
}) {
  const principal = comEncargos ? resumo.estimado : resumo.pago;
  return (
    <Card idPersistencia="custos:total-equipe">
      <CardHeader
        icon={<Landmark className="h-5 w-5" />}
        title={`Custo total da equipe · ${compLabelLongo(resumo.competencia)}`}
        subtitle={
          resumo.pessoas > 0
            ? `${resumo.pessoas} pessoa(s) com lançamento pago no mês · soma de todos, sem sócios`
            : "Nenhum lançamento pago neste mês"
        }
        action={
          resumo.pctSobreMedia !== null && resumo.serie.length > 1 ? (
            <Badge variant={Math.abs(resumo.pctSobreMedia) < 0.1 ? "neutral" : resumo.pctSobreMedia > 0 ? "warning" : "success"}>
              <span title={`Média do custo estimado dos últimos ${resumo.serie.length} meses com lançamento pago: ${formatBRL(resumo.mediaEstimada)}`}>
                {pctTexto(resumo.pctSobreMedia)} sobre a média do estimado
              </span>
            </Badge>
          ) : undefined
        }
      />
      <CardBody>
        <div className="grid gap-4">
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
              title={resumo.pessoas ? "Ver custo estimado por pessoa (com provisões)" : undefined}
            >
              {formatBRL(principal)}
            </button>
            <p className="mt-1 text-xs text-slate-500">
              {comEncargos
                ? `Pago ${formatBRL(resumo.pago)} + provisões ${formatBRL(resumo.provisoes)} (FGTS 8%, 13º e férias sobre ${formatBRL(resumo.base)}). Não é o custo patronal completo.`
                : `Pago às pessoas. FGTS e INSS lançados ficam fora — são custo da empresa.`}
              {resumo.emAberto > 0.005 && (
                <> <strong className="font-semibold text-amber-700">{formatBRL(resumo.emAberto)} ainda em aberto no ERP</strong> — fora dos totais acima; ainda não saiu do caixa.</>
              )}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <StatCard label="Pago à equipe" value={formatBRL(resumo.pago)} icon={<Users className="h-4 w-4" />} accent="blue" onClick={resumo.pessoas ? () => onAbrirMes?.(resumo.competencia) : undefined} />
              <StatCard label="Provisões" value={formatBRL(resumo.provisoes)} icon={<PiggyBank className="h-4 w-4" />} accent="gold" hint={`sobre ${formatBRL(resumo.base)}`} title="Provisão do mês: FGTS, 13º e férias sobre a base, mais o FGTS lançado de verdade. Quanto SEPARAR por mês para os acertos está na aba Encargos estimados — lá o mês pela metade vale pela média, então os dois números não são o mesmo." />
              <StatCard label="Média por pessoa" value={formatBRL(resumo.pessoas > 0 ? principal / resumo.pessoas : 0)} icon={<TrendingUp className="h-4 w-4" />} accent="brand" hint={`${resumo.pessoas} pessoa(s)`} onClick={resumo.pessoas ? () => onAbrirMes?.(resumo.competencia) : undefined} />
            </div>
            {pessoaNome && pessoaPeso !== null && (
              <p className="mt-3 text-xs text-slate-600">
                <strong className="font-semibold text-brand-ink">{pessoaNome}</strong> responde por{" "}
                <strong className="font-semibold tabular-nums text-brand-ink">{(pessoaPeso * 100).toFixed(1).replace(".", ",")}%</strong> {comEncargos ? "deste total" : "do custo estimado (com provisões)"}.
              </p>
            )}
          </div>

        </div>
      </CardBody>
    </Card>
  );
}
