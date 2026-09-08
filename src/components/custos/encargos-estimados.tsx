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
  type MesDaReserva, type PagReserva, type ReservaDoAno,
} from "@/lib/reservaEncargos";

const ORIGEM: Record<MesDaReserva["origem"], { rotulo: string; curto: string; variant: "success" | "warning" | "danger" | "info" | "neutral"; explica: string }> = {
  // O selo diz o que o sinal SABE: houve salário no mês e a folha alcança pelo
  // menos 80% do quadro daquele mês. Ninguém é julgado por pessoa — uma pessoa
  // que sai no meio do mês não derruba o mês inteiro.
  folha: { rotulo: "folha", curto: "folha inteira", variant: "success", explica: "O mês tem salário lançado e a folha alcança o quadro daquele mês." },
  parcial: { rotulo: "a fechar", curto: "sobe sozinho", variant: "warning", explica: "A folha deste mês ainda não está inteira e a janela não fechou (o salário vence no início do mês seguinte). Depositar pela média; o valor sobe sozinho quando o resto entrar." },
  buraco: { rotulo: "falta folha", curto: "precisa Puxar histórico", variant: "danger", explica: "A janela deste mês já fechou e a folha não está inteira: falta o salário, ou falta gente em relação ao quadro do mês. Não sobe sozinho — traga em Sincronização › Puxar histórico. Enquanto isso, vale a média." },
  estimado: { rotulo: "estimado", curto: "pela média", variant: "info", explica: "Sem folha no sistema: vale a média dos meses completos." },
  vazio: { rotulo: "sem base", curto: "sem média para estimar", variant: "neutral", explica: "Sem folha e sem média para estimar: não há como dizer quanto seria." },
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
  quadroDe,
  onVerPessoa,
  onEscolherMes,
}: {
  /** Só a equipe (sem sócios) — quem chama já filtra. */
  pagamentos: PagReserva[];
  nomeDe: (colaboradorId: string) => string;
  compAtiva: string;
  /** Quantas pessoas estavam no quadro naquele mês — é o que denuncia folha pela metade. */
  quadroDe: (comp: string) => number;
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
  /** O ano na tela não é o do mês aberto: o primeiro card vira histórico, não ordem de depósito. */
  const olhandoOutroAno = ano !== anoDaComp;

  const reserva = useMemo(() => reservaDoAno(pagamentos, ano, { incluirFgts, quadroDe }), [pagamentos, ano, incluirFgts, quadroDe]);
  // A mesma média pela outra régua: o dono decide com os dois números à vista,
  // em vez de descobrir a diferença só depois de trocar o botão.
  const outraMedia = useMemo(
    () => reservaDoAno(pagamentos, ano, { incluirFgts: !incluirFgts, quadroDe }).mediaMensal,
    [pagamentos, ano, incluirFgts, quadroDe],
  );
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
  const mesesVazios = reserva.meses.filter((m) => m.origem === "vazio").length;
  const anoIncompleto = mesesVazios > 0; // sem média, o ano não fecha 12 meses
  const tot = reserva.meses.reduce(
    (t, m) => ({ base: t.base + m.base, fgts: t.fgts + m.fgts, d13: t.d13 + m.decimoTerceiro, fer: t.fer + m.ferias, dep: t.dep + m.aDepositar }),
    { base: 0, fgts: 0, d13: 0, fer: 0, dep: 0 },
  );
  const origensPresentes = [...new Set(reserva.meses.map((m) => m.origem))];
  // Quais meses da faixa da média ficaram de fora — a frase "média de 7 meses,
  // de jan a ago" sozinha faz a faixa parecer contínua.
  const foraDaMedia = useMemo(() => {
    const { de, ate } = reserva.baseDaMedia;
    if (!de || !ate) return [] as string[];
    const dentro = new Set(reserva.meses.filter((m) => m.origem === "folha").map((m) => m.competencia));
    return reserva.meses
      .filter((m) => m.competencia > de && m.competencia < ate && !dentro.has(m.competencia))
      .map((m) => compLabel(m.competencia));
  }, [reserva]);

  return (
    <div className="space-y-6">
      {/* ===================== o título: regra mensal e anual ===================== */}
      <Card idPersistencia="custos:encargos:titulo">
        <CardHeader
          icon={<PiggyBank className="h-5 w-5" />}
          title={`Reserva de encargos · ${ano}`}
          subtitle={`Quanto separar por mês, numa conta própria, para pagar 13º, férias${incluirFgts ? " e FGTS" : ""} sem passar pelo caixa da operação.`}
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
              label={mesDoDeposito
                ? `${olhandoOutroAno ? "Depósito de" : "Depositar em"} ${compLabel(mesDoDeposito.competencia)}`
                : "Depositar no mês"}
              value={formatBRL(mesDoDeposito?.aDepositar ?? 0)}
              icon={<PiggyBank className="h-4 w-4" />}
              accent="brand"
              hint={hintDoDeposito(mesDoDeposito, reserva.mediaMensal)}
              title={mesDoDeposito ? ORIGEM[mesDoDeposito.origem].explica : undefined}
              onClick={mesDoDeposito?.temFolha && onEscolherMes ? () => onEscolherMes(mesDoDeposito.competencia) : undefined}
            />
            <StatCard
              label={`Regra mensal · depósito fixo · ${ano}`}
              value={formatBRL(reserva.mediaMensal)}
              icon={<Scale className="h-4 w-4" />}
              accent="gold"
              hint={reserva.baseDaMedia.meses > 0
                ? `média de ${reserva.baseDaMedia.meses} mês(es) completo(s), de ${compLabel(reserva.baseDaMedia.de!)} a ${compLabel(reserva.baseDaMedia.ate!)}${reserva.baseDaMedia.furos ? ` · ${reserva.baseDaMedia.furos} mês(es) da faixa ficaram de fora` : ""}`
                : "sem mês completo para tirar média"}
              title={`Depósito fixo sugerido: a média dos até 12 últimos meses com folha completa. Mês pela metade e mês sem folha ficam fora da média${foraDaMedia.length ? ` (fora: ${foraDaMedia.join(", ")})` : ""}. Use este valor para a ordem automática no banco; o card ao lado é o do mês, que varia com a folha.${outraMedia > 0 ? ` ${incluirFgts ? "Sem o FGTS" : "Com o FGTS"} seria ${formatBRL(outraMedia)}.` : ""}`}
            />
            <StatCard
              label={`Regra anual · ${ano}`}
              value={anoIncompleto && reserva.mediaMensal <= 0 ? "—" : formatBRL(reserva.totalAno)}
              icon={<CalendarRange className="h-4 w-4" />}
              accent="blue"
              hint={anoIncompleto && reserva.mediaMensal <= 0
                ? `sem mês completo para projetar o ano (${mesesVazios} mês(es) sem base)`
                : [
                  `${reserva.mesesCompletos} mês(es) de folha completa`,
                  reserva.mesesPelaMetade ? `${reserva.mesesPelaMetade} pela metade` : "",
                  reserva.mesesEstimados ? `${reserva.mesesEstimados} estimado(s)` : "",
                ].filter(Boolean).join(" · ")}
              title={`Folha completa ${formatBRL(reserva.realizado)} + meses pela metade ${formatBRL(reserva.completado)} + estimado pela média ${formatBRL(reserva.estimado)}. É o tamanho que a conta precisa ter no ano.`}
            />
            <StatCard
              label={`13º e férias pagos em ${ano}`}
              value={reserva.acertosDaReserva > 0 ? formatBRL(reserva.acertosDaReserva) : "—"}
              icon={<Receipt className="h-4 w-4" />}
              accent="amber"
              hint={reserva.acertosFora > 0
                ? `+ ${formatBRL(reserva.acertosFora)} de rescisão e FGTS rescisório`
                : reserva.acertosDaReserva > 0 ? "é o que a reserva teria pago" : "nada saiu ainda neste ano"}
              title="13º e férias que saíram no ano — o que a conta da reserva teria pago. Rescisão vem à parte porque leva junto saldo de salário e aviso; o 13º e as férias proporcionais que ela contém saem, sim, da reserva."
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <strong className="font-semibold text-slate-600">Qual número levar ao banco:</strong> a <em>regra mensal</em> é a ordem fixa que você programa uma vez; o card do mês é quanto aquele mês pediu de verdade, e serve para conferir depois. No fim do ano, a diferença aparece na regra anual.{outraMedia > 0 && ` ${incluirFgts ? "Sem o FGTS" : "Com o FGTS"}, a regra mensal seria ${formatBRL(outraMedia)}.`}
            {" "}Composição: {composicao}. Hora extra, comissão, diária e demais verbas entram no que a pessoa recebe, mas não geram encargo. Não é o custo patronal completo: INSS patronal e multa do FGTS ficam fora, e o INSS lançado por pessoa não entra em nenhuma das duas colunas de acerto.
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
                  <th className="th px-2 text-right" title={`O que levar ao banco: ${incluirFgts ? "FGTS + 13º + férias" : "13º + férias"} (nos meses pela metade, a média — ou o próprio valor do mês, se já passou dela)`}>Depositar</th>
                  <th className="th px-2 text-right" title="13º e férias pagos no mês. Rescisão e FGTS rescisório aparecem em cinza, logo abaixo.">Acertos</th>
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
                        <tr className="bg-slate-100/60" id={`encargos-det-${m.competencia}`}>
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
                                      {m.acertosFora > 0 && <span className="text-slate-400"> — a rescisão leva junto saldo de salário e aviso, que não saem da reserva.</span>}
                                    </td>
                                  </tr>
                                )}
                                {m.origem !== "folha" && (
                                  <tr>
                                    <td colSpan={6} className="pt-2 text-slate-500">
                                      {textoDoDetalhe(m)}
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
                    <span className="ml-2 text-xs font-normal text-slate-500">{rodapeDoAno(reserva, mesesVazios)}</span>
                  </td>
                  <td className="td px-2 text-right text-xs font-normal text-slate-400">—</td>
                  <td className="td px-2 text-right text-xs tabular-nums">{formatBRL(tot.base)}</td>
                  <td className={cn("td px-2 text-right text-xs tabular-nums", !incluirFgts && "text-slate-400")}>{formatBRL(tot.fgts)}</td>
                  <td className="td px-2 text-right text-xs tabular-nums">{formatBRL(tot.d13)}</td>
                  <td className="td px-2 text-right text-xs tabular-nums">{formatBRL(tot.fer)}</td>
                  <td className="td px-2 text-right tabular-nums" title="Folha completa + os meses pela metade (a média, ou o próprio valor quando maior) + os estimados.">{formatBRL(tot.dep)}</td>
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
            {/* Só os selos que aparecem neste ano, e em uma linha: o texto
                inteiro já está no tooltip de cada mês. */}
            {origensPresentes.map((o) => (
              <span key={o} className="inline-flex items-center gap-1"><Badge variant={ORIGEM[o].variant}>{ORIGEM[o].rotulo}</Badge> {ORIGEM[o].curto}</span>
            ))}
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

/** A folha do mês já passou da média? Então o número não é "a média". */
const pelaMedia = (m: MesDaReserva) => m.aDepositar > m.deposito + 0.005;

/** O porquê do número grande, em uma linha. */
function hintDoDeposito(m: MesDaReserva | null, media: number): string {
  if (!m) return "sem folha";
  if (m.origem === "estimado") return "estimado pela média (mês sem folha no sistema)";
  if (m.origem === "parcial" || m.origem === "buraco") {
    if (!(media > 0)) return `sem mês completo para tirar média: é só o que já entrou (${formatBRL(m.deposito)})`;
    return pelaMedia(m)
      ? `pela média · a folha do mês só gerou ${formatBRL(m.deposito)} até agora`
      : `a folha deste mês já passou da média — vale o próprio valor`;
  }
  return `folha inteira · ${m.pessoas} pessoa(s) · base ${formatBRL(m.base)}`;
}

const textoDoDetalhe = (m: MesDaReserva): string =>
  pelaMedia(m)
    ? `A soma acima é a folha que já entrou. Este mês ${ORIGEM[m.origem].rotulo}: depositar ${formatBRL(m.aDepositar)} (a média).`
    : `Este mês ${ORIGEM[m.origem].rotulo}, mas o que já entrou passou da média: depositar ${formatBRL(m.aDepositar)}, o valor do próprio mês.`;

const rodapeDoAno = (r: ReservaDoAno, vazios: number): string =>
  [
    `${r.mesesCompletos} completo(s)`,
    r.mesesPelaMetade ? `${r.mesesPelaMetade} pela metade` : "",
    r.mesesEstimados ? `${r.mesesEstimados} estimado(s)` : "",
    vazios ? `${vazios} sem base para estimar` : "",
  ].filter(Boolean).join(" · ");

function MesLinha({ m, ativo, aberto, incluirFgts, media, onAlternar, children }: {
  m: MesDaReserva; ativo: boolean; aberto: boolean; incluirFgts: boolean; media: number; onAlternar: () => void; children?: React.ReactNode;
}) {
  const o = ORIGEM[m.origem];
  const apagado = m.origem === "estimado" || m.origem === "vazio";
  const semDado = m.origem === "vazio";
  // O cinza do mês estimado tem de ir CÉLULA A CÉLULA: `.td` declara cor
  // própria, e cor declarada no elemento vence a herdada da linha.
  const cinza = apagado ? "text-slate-400 italic" : "";
  // Número que veio da média, não da folha: o "~" e o itálico dizem isso sem
  // depender de cor (no escuro o cinza da célula é repintado, e cor sozinha
  // também não serve para quem não a distingue).
  const estimativa = m.origem === "estimado";
  const num = (v: number) => (semDado ? "—" : `${estimativa ? "~" : ""}${formatBRL(v)}`);
  return (
    <>
      <tr
        className={cn(
          "transition-colors",
          m.temFolha && "cursor-pointer hover:bg-slate-50",
          // bg-brand/10 é a única que tem par no tema escuro (index.css) — com
          // 5% o destaque do mês aberto sumia no escuro.
          ativo && "bg-brand/10",
        )}
        onClick={onAlternar}
        title={o.explica}
      >
        <td className={cn("td", cinza, ativo && "border-l-2 border-brand-400")}>
          {/* O gatilho é um <button> DENTRO da célula, não a linha inteira: uma
              <tr> com role="button" deixa de ser linha e o leitor de tela perde
              a ligação entre cabeçalho e células. */}
          <span className="flex items-center gap-2">
            {m.temFolha ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAlternar(); }}
                aria-expanded={aberto}
                aria-controls={`encargos-det-${m.competencia}`}
                className="inline-flex items-center gap-2 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
              >
                <ChevronDown className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", aberto && "rotate-180")} />
                <span className={cn("font-medium", ativo ? "text-brand-ink" : apagado ? "text-slate-400" : "text-slate-700")} title={compLabelLongo(m.competencia)}>{compLabel(m.competencia)}</span>
              </button>
            ) : (
              <>
                <span className="w-3.5" />
                <span className={cn("font-medium", apagado ? "text-slate-400" : "text-slate-700")} title={compLabelLongo(m.competencia)}>{compLabel(m.competencia)}</span>
              </>
            )}
            <Badge variant={o.variant}>{o.rotulo}</Badge>
          </span>
        </td>
        <td className={cn("td px-2 text-right tabular-nums", cinza)}>{m.temFolha ? m.pessoas : "—"}</td>
        <td className={cn("td px-2 text-right text-xs tabular-nums", cinza)}>{num(m.base)}</td>
        <td className={cn("td px-2 text-right text-xs tabular-nums", cinza, !incluirFgts && "text-slate-300")}>{num(m.fgts)}</td>
        <td className={cn("td px-2 text-right text-xs tabular-nums", cinza)}>{num(m.decimoTerceiro)}</td>
        <td className={cn("td px-2 text-right text-xs tabular-nums", cinza)}>{num(m.ferias)}</td>
        <td
          className={cn("td px-2 text-right font-semibold tabular-nums", apagado ? "text-slate-400" : "text-brand-ink")}
          title={pelaMedia(m) ? `A folha deste mês só gerou ${formatBRL(m.deposito)}; ${o.rotulo} — depositar a média (${formatBRL(media)}).` : undefined}
        >
          {num(m.aDepositar)}
        </td>
        <td className={cn("td px-2 text-right text-xs tabular-nums text-amber-700")} title={m.acertosFora > 0 ? `Fora da reserva neste mês: ${formatBRL(m.acertosFora)} de rescisão/FGTS rescisório.` : undefined}>
          {m.acertosDaReserva > 0 ? formatBRL(m.acertosDaReserva) : <span className="text-slate-300">—</span>}
          {m.acertosFora > 0 && <span className="block text-[10px] font-normal text-slate-400">+ {formatBRL(m.acertosFora)} fora</span>}
        </td>
      </tr>
      {children}
    </>
  );
}
