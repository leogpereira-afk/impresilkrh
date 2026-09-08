import { useMemo, type ReactNode } from "react";
import { TrendingUp, TrendingDown, Minus, Wallet, Coins, CalendarDays, Activity } from "lucide-react";
import { BarrasVerticais } from "@/components/charts/charts";
import { formatBRL } from "@/lib/format";
import { compLabel, compLabelLongo } from "@/lib/custos";
import { resumirHistorico, type PontoMensal } from "@/lib/historicoMensal";
import { cn } from "@/lib/cn";

/**
 * Coluna extra na lista (ex.: no custo global, Individual / Rateio / Médio por
 * colaborador ao lado do total). `valorDe` devolve null quando o mês não tem.
 */
export interface ColunaHistorico {
  rotulo: string;
  valorDe: (competencia: string) => number | null;
  destaque?: boolean;
}

const pctFmt = (p: number) => `${p > 0 ? "+" : ""}${(p * 100).toFixed(p >= 1 || p <= -1 ? 0 : 1).replace(".", ",")}%`;

function Tile({ rotulo, valor, detalhe, icon, tom = "neutro" }: { rotulo: string; valor: string; detalhe?: string; icon: ReactNode; tom?: "brand" | "neutro" }) {
  return (
    <div className={cn("rounded-xl border p-3", tom === "brand" ? "border-brand/30 bg-brand/5" : "border-slate-200/80 bg-white")}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-[11px] font-semibold uppercase tracking-wide", tom === "brand" ? "text-brand" : "text-slate-500")}>{rotulo}</p>
        <span className={cn("rounded-lg p-1.5", tom === "brand" ? "bg-brand/10 text-brand" : "bg-slate-100 text-slate-500")}>{icon}</span>
      </div>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums tracking-tight", tom === "brand" ? "text-brand-ink" : "text-slate-800")}>{valor}</p>
      {detalhe && <p className="mt-0.5 text-[11px] text-slate-500">{detalhe}</p>}
    </div>
  );
}

/**
 * Histórico mês a mês: quatro números que resumem o período, o gráfico e a
 * lista com barra proporcional e variação contra o mês anterior. A mesma peça
 * serve o colaborador (quanto recebeu) e o custo global (quanto custou).
 *
 * Clicar num mês — na barra ou na linha — leva o seletor de competência até
 * ele; a linha do mês aberto fica marcada, para a lista e o resto da tela
 * apontarem para o mesmo lugar.
 */
export function HistoricoMensal({
  pontos,
  selecionada,
  onSelecionar,
  rotuloValor = "Recebido",
  rotuloTotal = "Acumulado no período",
  colunas = [],
  vazio,
  altura = 240,
}: {
  pontos: PontoMensal[];
  selecionada?: string;
  onSelecionar?: (competencia: string) => void;
  rotuloValor?: string;
  rotuloTotal?: string;
  colunas?: ColunaHistorico[];
  vazio?: ReactNode;
  altura?: number;
}) {
  const r = useMemo(() => resumirHistorico(pontos), [pontos]);
  if (r.meses === 0) return <>{vazio ?? <p className="text-sm text-slate-500">Sem histórico.</p>}</>;

  const ultimoVsMedia = r.ultimoVsMedia;
  const anos = new Set(r.linhas.map((l) => l.ano));
  // O gráfico só desenha o que a conta considera: mês incompleto some da
  // barra (a lista continua mostrando a linha, com a marca).
  const dados = r.linhas.filter((l) => !l.incompleto).map((l) => ({ nome: compLabel(l.competencia), valor: l.valor }));

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile rotulo={rotuloTotal} valor={formatBRL(r.total)} detalhe={`${r.meses} ${r.meses === 1 ? "mês" : "meses"}`} icon={<Wallet className="h-4 w-4" />} tom="brand" />
        <Tile rotulo="Média por mês" valor={formatBRL(r.media)} icon={<Coins className="h-4 w-4" />} />
        <Tile rotulo="Maior mês" valor={formatBRL(r.maior?.valor ?? 0)} detalhe={r.maior ? compLabelLongo(r.maior.competencia) : undefined} icon={<TrendingUp className="h-4 w-4" />} />
        <Tile
          rotulo="Último mês"
          valor={formatBRL(r.ultimo?.valor ?? 0)}
          detalhe={
            r.ultimo
              ? `${compLabelLongo(r.ultimo.competencia)}${ultimoVsMedia == null ? "" : ` · ${pctFmt(ultimoVsMedia)} contra a média`}`
              : undefined
          }
          icon={<Activity className="h-4 w-4" />}
        />
      </div>

      <BarrasVerticais
        data={dados}
        moeda
        altura={altura}
        onItemClick={onSelecionar ? (nome) => { const l = r.linhas.find((x) => compLabel(x.competencia) === nome); if (l) onSelecionar(l.competencia); } : undefined}
      />

      <div className="overflow-x-auto rounded-xl border border-slate-200/70">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/50">
            <tr>
              <th className="th">Mês</th>
              {colunas.map((c) => <th key={c.rotulo} className="th text-right">{c.rotulo}</th>)}
              <th className="th text-right">{rotuloValor}</th>
              <th className="th text-right">Contra o mês anterior</th>
              <th className="th w-40"><span className="sr-only">Proporção do maior mês</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {r.linhas.map((l) => {
              const ativa = l.competencia === selecionada;
              const sobe = (l.delta ?? 0) > 0;
              const desce = (l.delta ?? 0) < 0;
              return (
                <FragmentoAno key={l.competencia} mostrar={anos.size > 1 && l.primeiroDoAno} ano={l.ano} colunas={colunas.length + 4}>
                  <tr
                    className={cn("transition", onSelecionar && "cursor-pointer hover:bg-slate-50/70", ativa && "bg-brand/5")}
                    onClick={onSelecionar ? () => onSelecionar(l.competencia) : undefined}
                    aria-current={ativa ? "true" : undefined}
                    title={l.lacuna ? "O mês anterior não tem lançamento — a comparação pula um buraco." : undefined}
                  >
                    <td className={cn("td", ativa ? "font-semibold text-brand-ink" : "font-medium text-slate-800")}>
                      {/* O mês abre por TECLADO também: a linha inteira responde
                          ao mouse, mas quem navega por Tab (ou usa leitor de
                          tela) precisa de um alvo focável — e o gráfico, que é
                          o outro caminho, só entende clique. */}
                      <Celula como={onSelecionar ? "button" : "span"} onClick={onSelecionar ? () => onSelecionar(l.competencia) : undefined}>
                        {ativa && <span className="h-1.5 w-1.5 rounded-full bg-brand" aria-hidden="true" />}
                        {compLabelLongo(l.competencia)}
                        {l.lacuna && (
                          <>
                            <CalendarDays className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                            <span className="sr-only">mês anterior sem lançamento</span>
                          </>
                        )}
                        {l.incompleto && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800" title="O que existe deste mês é um pedaço: ele fica fora do total, da média e do gráfico.">
                            incompleto
                          </span>
                        )}
                      </Celula>
                    </td>
                    {colunas.map((c) => {
                      const v = c.valorDe(l.competencia);
                      return (
                        <td key={c.rotulo} className={cn("td text-right tabular-nums", c.destaque ? "font-semibold text-brand-ink" : "text-slate-600")}>
                          {v == null ? <span className="text-slate-300">—</span> : formatBRL(v)}
                        </td>
                      );
                    })}
                    <td className={cn("td text-right tabular-nums", ativa ? "font-semibold text-brand-ink" : "font-medium text-slate-800")}>{formatBRL(l.valor)}</td>
                    <td className="td text-right tabular-nums">
                      {l.delta == null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={cn("inline-flex items-center justify-end gap-1 text-xs font-medium", sobe ? "text-amber-700" : desce ? "text-sky-700" : "text-slate-500")}>
                          {sobe ? <TrendingUp className="h-3.5 w-3.5" /> : desce ? <TrendingDown className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                          {l.delta === 0 ? "igual" : `${sobe ? "+" : "−"}${formatBRL(Math.abs(l.delta))}`}
                          {l.pct != null && l.delta !== 0 && <span className="text-slate-400">({pctFmt(l.pct)})</span>}
                        </span>
                      )}
                    </td>
                    <td className="td">
                      <div className="h-1.5 w-full rounded-full bg-slate-100" aria-hidden="true">
                        <div className={cn("h-1.5 rounded-full", ativa ? "bg-brand" : "bg-brand/40")} style={{ width: `${Math.round(l.parcela * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                </FragmentoAno>
              );
            })}
          </tbody>
          <tfoot className="border-t border-slate-200 bg-slate-50/60">
            <tr>
              <td className="td font-semibold text-brand-ink">{rotuloTotal}</td>
              {colunas.map((c) => <td key={c.rotulo} className="td" />)}
              <td className="td text-right font-semibold tabular-nums text-brand-ink">{formatBRL(r.total)}</td>
              <td className="td text-right text-xs text-slate-500">média {formatBRL(r.media)}</td>
              <td className="td" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

/**
 * O nome do mês: botão quando dá para trocar de competência, texto quando não.
 * `stopPropagation` porque a linha inteira também é clicável — sem isso o mouse
 * dispararia a troca duas vezes.
 */
function Celula({ como, onClick, children }: { como: "button" | "span"; onClick?: () => void; children: ReactNode }) {
  if (como === "span") return <span className="flex items-center gap-2">{children}</span>;
  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      onClick={(e) => { e.stopPropagation(); onClick?.(); }}
    >
      {children}
    </button>
  );
}

/** Linha divisória com o ano antes do primeiro mês de cada ano (só quando há mais de um ano). */
function FragmentoAno({ mostrar, ano, colunas, children }: { mostrar: boolean; ano: number; colunas: number; children: ReactNode }) {
  return (
    <>
      {mostrar && (
        <tr className="bg-slate-50/40">
          <td colSpan={colunas} className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{ano}</td>
        </tr>
      )}
      {children}
    </>
  );
}
