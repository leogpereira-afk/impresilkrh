import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight, PiggyBank, Receipt, Scale, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, useAbertoPersistido } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { formatBRL } from "@/lib/format";
import { compLabel, compLabelLongo } from "@/lib/custos";
import { cn } from "@/lib/cn";
import {
  anosComFolha, encargosPorPessoa, reservaDoAno,
  type EstadoFolha, type MesDaReserva, type PagReserva, type ReservaDoAno,
} from "@/lib/reservaEncargos";

const ORIGEM: Record<MesDaReserva["origem"], { rotulo: string; variant: "success" | "warning" | "danger" | "info" | "neutral"; explica: string }> = {
  folha: { rotulo: "folha", variant: "success", explica: "Adiantamento e salário do mês estão no sistema." },
  parcial: { rotulo: "a fechar", variant: "warning", explica: "O mês ainda vai fechar: só o adiantamento entrou, o salário vence no início do mês seguinte. Depositar pela média; o valor sobe sozinho quando o salário chegar." },
  buraco: { rotulo: "falta folha", variant: "danger", explica: "A janela deste mês já fechou e o salário não chegou. Não sobe sozinho: traga em Sincronização › Puxar histórico. Enquanto isso, vale a média." },
  estimado: { rotulo: "estimado", variant: "info", explica: "Sem folha no sistema: vale a média dos meses completos." },
  vazio: { rotulo: "sem folha", variant: "neutral", explica: "Sem folha e sem média para estimar." },
};

/**
 * Aba "Encargos estimados" — a reserva de encargos, mês a mês, com a regra
 * mensal e a anual no título (pedido do Leonardo, 07/09/2026).
 *
 * A régua é a do bloco "Encargos estimados sobre o bruto" da ficha, somada
 * para a equipe inteira (lib/reservaEncargos, com testes): FGTS 8% + 13º 1/12
 * + férias 1/12 × 1,3333 sobre salário + adiantamento de cada pessoa.
 *
 * O número grande é o que LEVAR AO BANCO (`aDepositar`), não o que a folha do
 * mês já gerou: num mês que ainda vai fechar, o segundo é metade do primeiro,
 * e mandar depositar metade era o erro mais caro da primeira versão.
 */
export function EncargosEstimados({
  pagamentos,
  nomeDe,
  compAtiva,
  estadoDe,
  onVerPessoa,
  onEscolherMes,
}: {
  /** Só a equipe (sem sócios) — quem chama já filtra. */
  pagamentos: PagReserva[];
  nomeDe: (colaboradorId: string) => string;
  compAtiva: string;
  estadoDe: (comp: string) => EstadoFolha;
  onVerPessoa?: (colaboradorId: string) => void;
  onEscolherMes?: (comp: string) => void;
}) {
  // FGTS no depósito é escolha do dono: ele já sai todo mês pela guia. Fica
  // guardado entre visitas (o hook é o mesmo dos cards recolhíveis).
  const [incluirFgts, setIncluirFgts] = useAbertoPersistido("custos:encargos:incluir-fgts", true);
  const anos = useMemo(() => anosComFolha(pagamentos), [pagamentos]);
  const anoDaComp = Number(compAtiva.slice(0, 4)) || new Date().getFullYear();
  const [ano, setAno] = useState<number>(anoDaComp);
  // A faixa de meses fica ACIMA da aba e troca de ano sem remontar nada: sem
  // isto a tabela ficava num ano e o mês escolhido em outro, sem destaque.
  useEffect(() => { setAno(anoDaComp); }, [anoDaComp]);
  // O ano que vem entra de propósito: a conta começa no ano que vem, e o
  // tamanho dela é a projeção pela média de agora.
  const anoMin = Math.min(anos[0] ?? anoDaComp, anoDaComp);
  const anoMax = Math.max(anos[anos.length - 1] ?? anoDaComp, anoDaComp) + 1;

  const reserva = useMemo(() => reservaDoAno(pagamentos, ano, { incluirFgts }, estadoDe), [pagamentos, ano, incluirFgts, estadoDe]);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const alternar = (comp: string) => setAbertos((s) => { const n = new Set(s); if (n.has(comp)) n.delete(comp); else n.add(comp); return n; });

  // "Depositar este mês": o mês aberto na tela quando ele é deste ano; senão,
  // o último mês do ano com folha; senão, um mês estimado pela média.
  const mesDoDeposito = useMemo(() => {
    const ativo = reserva.meses.find((m) => m.competencia === compAtiva);
    if (ativo && ativo.origem !== "vazio") return ativo;
    return [...reserva.meses].reverse().find((m) => m.temFolha) ?? reserva.meses.find((m) => m.origem === "estimado") ?? null;
  }, [reserva, compAtiva]);

  const composicao = `${incluirFgts ? "FGTS 8% + " : ""}13º (1/12) + férias (1/12 × 1,3333) sobre salário + adiantamento de cada pessoa da equipe, sem sócios`;
  const tot = reserva.meses.reduce(
    (t, m) => ({ base: t.base + m.base, fgts: t.fgts + m.fgts, d13: t.d13 + m.decimoTerceiro, fer: t.fer + m.ferias, dep: t.dep + m.aDepositar }),
    { base: 0, fgts: 0, d13: 0, fer: 0, dep: 0 },
  );

  return (
    <div className="space-y-6">
      {/* ===================== o título: regra mensal e anual ===================== */}
      <Card idPersistencia="custos:encargos:titulo">
        <CardHeader
          icon={<PiggyBank className="h-5 w-5" />}
          title={`Reserva de encargos · ${ano}`}
          subtitle="Quanto separar por mês, numa conta própria, para pagar 13º e férias sem passar pelo caixa da operação."
          action={
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-xl bg-slate-100 p-0.5" title="O FGTS (8%) já sai todo mês pela guia. Deixe fora se a conta for só para 13º e férias." role="group" aria-label="FGTS no depósito">
                {[{ v: true, label: "Com FGTS" }, { v: false, label: "Só 13º + férias" }].map((o) => (
                  <button
                    key={o.label}
                    type="button"
                    onClick={() => setIncluirFgts(o.v)}
                    aria-pressed={incluirFgts === o.v}
                    className={cn("rounded-lg px-3 py-1 text-xs font-medium transition-colors", incluirFgts === o.v ? "bg-white text-brand-ink shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="btn-ghost px-2" onClick={() => setAno((a) => Math.max(anoMin, a - 1))} disabled={ano <= anoMin} title="Ano anterior" aria-label="Ano anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-[3.5rem] text-center text-sm font-semibold tabular-nums text-brand-ink">{ano}</span>
                <button type="button" className="btn-ghost px-2" onClick={() => setAno((a) => Math.min(anoMax, a + 1))} disabled={ano >= anoMax} title="Ano seguinte" aria-label="Ano seguinte">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          }
        />
        <CardBody>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label={mesDoDeposito ? `Depositar em ${compLabel(mesDoDeposito.competencia)}` : "Depositar no mês"}
              value={formatBRL(mesDoDeposito?.aDepositar ?? 0)}
              icon={<PiggyBank className="h-4 w-4" />}
              accent="brand"
              hint={hintDoDeposito(mesDoDeposito)}
              title={mesDoDeposito ? ORIGEM[mesDoDeposito.origem].explica : undefined}
              onClick={mesDoDeposito?.temFolha && onEscolherMes ? () => onEscolherMes(mesDoDeposito.competencia) : undefined}
            />
            <StatCard
              label="Regra mensal · depósito fixo"
              value={formatBRL(reserva.mediaMensal)}
              icon={<Scale className="h-4 w-4" />}
              accent="gold"
              hint={reserva.baseDaMedia.meses > 0
                ? `média de ${reserva.baseDaMedia.meses} mês(es) completo(s), de ${compLabel(reserva.baseDaMedia.de!)} a ${compLabel(reserva.baseDaMedia.ate!)}`
                : "sem mês completo para tirar média"}
              title="Depósito fixo sugerido: a média dos até 12 últimos meses com folha completa. Mês pela metade e mês sem folha ficam fora da média."
            />
            <StatCard
              label={`Regra anual · ${ano}`}
              value={formatBRL(reserva.totalAno)}
              icon={<CalendarRange className="h-4 w-4" />}
              accent="blue"
              hint={[
                `${reserva.mesesCompletos} mês(es) de folha completa`,
                reserva.mesesPelaMetade ? `${reserva.mesesPelaMetade} pela metade` : "",
                reserva.mesesEstimados ? `${reserva.mesesEstimados} estimado(s)` : "",
              ].filter(Boolean).join(" · ")}
              title={`Doze meses inteiros: ${formatBRL(reserva.realizado)} de folha completa + ${formatBRL(reserva.completado)} nos meses pela metade + ${formatBRL(reserva.estimado)} estimado pela média. É o tamanho que a conta precisa ter no ano.`}
            />
            <StatCard
              label={`13º e férias pagos em ${ano}`}
              value={reserva.acertosDaReserva > 0 || reserva.acertosFora > 0 ? formatBRL(reserva.acertosDaReserva) : "—"}
              icon={<Receipt className="h-4 w-4" />}
              accent="amber"
              hint={reserva.acertosDaReserva > 0 || reserva.acertosFora > 0
                ? `é o que a reserva teria pago${reserva.acertosFora > 0 ? ` · fora dela: ${formatBRL(reserva.acertosFora)} de rescisão e FGTS rescisório` : ""}`
                : "nada saiu ainda neste ano"}
              title="13º e férias que saíram no ano — o que a conta da reserva teria pago. Compare com a regra anual. Rescisão e FGTS rescisório aparecem à parte: a reserva não os cobre."
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Composição: {composicao}. Hora extra, comissão, diária e demais verbas entram no que a pessoa recebe, mas não geram encargo. Não é o custo patronal completo (INSS patronal e multa do FGTS ficam fora).
          </p>
        </CardBody>
      </Card>

      {/* ===================== mês a mês ===================== */}
      <Card idPersistencia="custos:encargos:meses">
        <CardHeader
          icon={<CalendarRange className="h-5 w-5" />}
          title={`Mês a mês · ${ano}`}
          subtitle="Clique no mês para ver pessoa por pessoa. O mês aberto na tela fica destacado."
        />
        <CardBody>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="th">Mês</th>
                  <th className="th px-2 text-right" title="Quem tem salário ou adiantamento no mês">Pessoas</th>
                  <th className="th px-2 text-right" title="Salário + adiantamento">Base</th>
                  <th className={cn("th px-2 text-right", !incluirFgts && "text-slate-400")} title="8% sobre a base">FGTS</th>
                  <th className="th px-2 text-right" title="1/12 da base">13º</th>
                  <th className="th px-2 text-right" title="1/12 da base × 1,3333 (o terço constitucional)">Férias</th>
                  <th className="th px-2 text-right" title={incluirFgts ? "O que levar ao banco: FGTS + 13º + férias (nos meses pela metade, a média)" : "O que levar ao banco: 13º + férias (nos meses pela metade, a média)"}>Depositar</th>
                  <th className="th px-2 text-right" title="13º e férias pagos no mês (rescisão e FGTS rescisório vêm em seguida, fora da reserva)">Acertos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reserva.meses.map((m) => {
                  const aberto = abertos.has(m.competencia);
                  const pessoas = aberto && m.temFolha ? encargosPorPessoa(pagamentos, m.competencia, { incluirFgts }) : [];
                  return (
                    <MesLinha
                      key={m.competencia}
                      m={m}
                      ativo={m.competencia === compAtiva}
                      aberto={aberto}
                      incluirFgts={incluirFgts}
                      media={reserva.mediaMensal}
                      onAlternar={() => m.temFolha && alternar(m.competencia)}
                    >
                      {aberto && m.temFolha && (
                        <tr className="bg-slate-50/60">
                          <td colSpan={8} className="px-3 py-2">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left uppercase tracking-wide text-slate-400">
                                  <th className="py-1 pr-2 font-medium">Pessoa</th>
                                  <th className="py-1 text-right font-medium">Base</th>
                                  <th className={cn("py-1 text-right font-medium", !incluirFgts && "text-slate-300")}>FGTS</th>
                                  <th className="py-1 text-right font-medium">13º</th>
                                  <th className="py-1 text-right font-medium">Férias</th>
                                  <th className="py-1 text-right font-medium">Depositar</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {pessoas.map((p) => (
                                  <tr key={p.colaboradorId}>
                                    <td className="py-1 pr-2">
                                      {onVerPessoa ? (
                                        <button type="button" className="text-left text-slate-700 hover:underline" onClick={(e) => { e.stopPropagation(); onVerPessoa(p.colaboradorId); }}>{nomeDe(p.colaboradorId)}</button>
                                      ) : nomeDe(p.colaboradorId)}
                                    </td>
                                    <td className="py-1 text-right tabular-nums text-slate-500">{formatBRL(p.base)}</td>
                                    <td className={cn("py-1 text-right tabular-nums", incluirFgts ? "text-slate-500" : "text-slate-300")}>{formatBRL(p.fgts)}</td>
                                    <td className="py-1 text-right tabular-nums text-slate-500">{formatBRL(p.decimoTerceiro)}</td>
                                    <td className="py-1 text-right tabular-nums text-slate-500">{formatBRL(p.ferias)}</td>
                                    <td className="py-1 text-right font-semibold tabular-nums text-brand-ink">{formatBRL(p.deposito)}</td>
                                  </tr>
                                ))}
                                {m.acertosPorTipo.length > 0 && (
                                  <tr>
                                    <td colSpan={6} className="pt-2 text-slate-500">
                                      Acertos pagos em {compLabelLongo(m.competencia)}: {m.acertosPorTipo.map((a) => `${a.tipo} ${formatBRL(a.valor)}`).join(" · ")}
                                      {m.acertosFora > 0 && <span className="text-slate-400"> — rescisão e FGTS rescisório não saem da reserva.</span>}
                                    </td>
                                  </tr>
                                )}
                                {m.origem !== "folha" && (
                                  <tr>
                                    <td colSpan={6} className="pt-2 text-slate-500">
                                      A soma acima é a folha que já entrou. Este mês {ORIGEM[m.origem].rotulo}: depositar {formatBRL(m.aDepositar)} (a média).
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </MesLinha>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 font-semibold text-brand-ink">
                  <td className="td">
                    Ano {ano}
                    <span className="ml-2 text-xs font-normal text-slate-500">{rodapeDoAno(reserva)}</span>
                  </td>
                  <td className="td px-2 text-right text-xs font-normal text-slate-400">—</td>
                  <td className="td px-2 text-right text-xs tabular-nums">{formatBRL(tot.base)}</td>
                  <td className={cn("td px-2 text-right text-xs tabular-nums", !incluirFgts && "text-slate-400")}>{formatBRL(tot.fgts)}</td>
                  <td className="td px-2 text-right text-xs tabular-nums">{formatBRL(tot.d13)}</td>
                  <td className="td px-2 text-right text-xs tabular-nums">{formatBRL(tot.fer)}</td>
                  <td className="td px-2 text-right tabular-nums" title="Os 12 meses inteiros: folha completa, o que falta nos meses pela metade e os estimados pela média.">{formatBRL(tot.dep)}</td>
                  <td className="td px-2 text-right text-xs tabular-nums text-amber-700">
                    {reserva.acertosDaReserva > 0 ? formatBRL(reserva.acertosDaReserva) : <span className="text-slate-300">—</span>}
                    {reserva.acertosFora > 0 && <span className="block text-[10px] font-normal text-slate-400">+ {formatBRL(reserva.acertosFora)} fora</span>}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Pessoas = quem tem salário ou adiantamento no mês. Base, FGTS, 13º e férias do rodapé somam os 12 meses, inclusive os estimados.</span>
            {(["folha", "parcial", "buraco", "estimado", "vazio"] as const).map((o) => (
              <span key={o} className="inline-flex items-center gap-1"><Badge variant={ORIGEM[o].variant}>{ORIGEM[o].rotulo}</Badge> {ORIGEM[o].explica}</span>
            ))}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/** O porquê do número grande, em uma linha. */
function hintDoDeposito(m: MesDaReserva | null): string {
  if (!m) return "sem folha";
  if (m.origem === "estimado") return "estimado pela média (mês sem folha no sistema)";
  if (m.origem === "parcial" || m.origem === "buraco") return `pela média · a folha do mês só gerou ${formatBRL(m.deposito)} até agora`;
  return `folha completa · ${m.pessoas} pessoa(s) · base ${formatBRL(m.base)}`;
}

const rodapeDoAno = (r: ReservaDoAno): string =>
  [
    `${r.mesesCompletos} completo(s)`,
    r.mesesPelaMetade ? `${r.mesesPelaMetade} pela metade` : "",
    r.mesesEstimados ? `${r.mesesEstimados} estimado(s)` : "",
  ].filter(Boolean).join(" · ");

function MesLinha({ m, ativo, aberto, incluirFgts, media, onAlternar, children }: {
  m: MesDaReserva; ativo: boolean; aberto: boolean; incluirFgts: boolean; media: number; onAlternar: () => void; children?: React.ReactNode;
}) {
  const o = ORIGEM[m.origem];
  const apagado = m.origem === "estimado" || m.origem === "vazio";
  const semDado = m.origem === "vazio";
  // A linha abre o detalhe; teclado também (o resto da tela é acessível e esta
  // era a única parte que só respondia ao mouse).
  const teclado = m.temFolha
    ? {
        tabIndex: 0,
        role: "button" as const,
        "aria-expanded": aberto,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onAlternar(); }
        },
      }
    : {};
  return (
    <>
      <tr
        className={cn(
          "transition-colors",
          m.temFolha && "cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          ativo && "bg-brand/[0.05]",
          apagado && "text-slate-400",
        )}
        onClick={onAlternar}
        title={o.explica}
        {...teclado}
      >
        <td className="td">
          <span className="flex items-center gap-2">
            {m.temFolha ? <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", aberto && "rotate-180")} /> : <span className="w-3.5" />}
            <span className={cn("font-medium", ativo ? "text-brand-ink" : apagado ? "text-slate-400" : "text-slate-700")} title={compLabelLongo(m.competencia)}>{compLabel(m.competencia)}</span>
            <Badge variant={o.variant}>{o.rotulo}</Badge>
          </span>
        </td>
        <td className="td px-2 text-right tabular-nums">{m.temFolha ? m.pessoas : "—"}</td>
        <td className="td px-2 text-right text-xs tabular-nums">{semDado ? "—" : formatBRL(m.base)}</td>
        <td className={cn("td px-2 text-right text-xs tabular-nums", !incluirFgts && "text-slate-300")}>{semDado ? "—" : formatBRL(m.fgts)}</td>
        <td className="td px-2 text-right text-xs tabular-nums">{semDado ? "—" : formatBRL(m.decimoTerceiro)}</td>
        <td className="td px-2 text-right text-xs tabular-nums">{semDado ? "—" : formatBRL(m.ferias)}</td>
        <td
          className={cn("td px-2 text-right font-semibold tabular-nums", apagado ? "text-slate-400" : "text-brand-ink")}
          title={m.aDepositar > m.deposito + 0.005 ? `A folha deste mês só gerou ${formatBRL(m.deposito)}; ${o.rotulo} — depositar a média (${formatBRL(media)}).` : undefined}
        >
          {semDado ? "—" : formatBRL(m.aDepositar)}
        </td>
        {/* O que a reserva teria pago (13º/férias) em destaque; o que sai da
            folha mas NÃO sai da reserva (rescisão, FGTS rescisório) fica logo
            abaixo, em cinza — some da coluna era esconder dinheiro que saiu. */}
        <td className="td px-2 text-right text-xs tabular-nums text-amber-700" title={m.acertosFora > 0 ? `Fora da reserva neste mês: ${formatBRL(m.acertosFora)} de rescisão/FGTS rescisório.` : undefined}>
          {m.acertosDaReserva > 0 ? formatBRL(m.acertosDaReserva) : <span className="text-slate-300">—</span>}
          {m.acertosFora > 0 && <span className="block text-[10px] font-normal text-slate-400">+ {formatBRL(m.acertosFora)} fora</span>}
        </td>
      </tr>
      {children}
    </>
  );
}
