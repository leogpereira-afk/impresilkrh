import { useMemo } from "react";
import { Landmark, Wallet, FileSpreadsheet, Scale } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/misc";
import { HistoricoMensal } from "@/components/custos/historico-mensal";
import { formatBRL } from "@/lib/format";
import { compLabelLongo } from "@/lib/custos";
import { corDoTipo } from "@/lib/folha";
import { CARD_POR_PESSOA, rotuloDoSocio } from "@/lib/societario";
import type { Colaborador, ContaPlano, Pagamento } from "@/data/types";

interface CardPlano { id: string; titulo: string; total: number; itens: ContaPlano[] }

/**
 * Aba Societárias — só a direção vê (pedido do Léo, 07/09/2026: "subir as
 * despesas societárias, separar Pedro Ramos e Leonardo, os dois organizados").
 *
 * Um bloco por sócio. Em cada um, o mês aberto de dois lados — o que saiu pelo
 * Contas a Pagar (folha) e o que o contador lançou em 2.14 (plano) — e o
 * histórico mês a mês. Os dois lados têm de bater; a diferença aparece como
 * número, não como suspeita.
 */
export function Societarias({
  socios,
  pagamentos,
  cardsPlano,
  compAtiva,
  onEscolherMes,
  semPlanoNoMes,
}: {
  socios: Colaborador[];
  /** TODOS os pagamentos — o componente filtra por sócio. */
  pagamentos: Pagamento[];
  cardsPlano: CardPlano[];
  compAtiva: string;
  onEscolherMes: (c: string) => void;
  semPlanoNoMes: boolean;
}) {
  const ordenados = useMemo(() => {
    // Pedro primeiro, depois Leonardo, depois quem mais for direção — a ordem
    // do plano de contas (2.14.1, 2.14.2).
    const peso = (c: Colaborador) => (c.id === "pedro-ramos" ? 0 : c.id === "leonardo-goncalves" ? 1 : 2);
    return [...socios].sort((a, b) => peso(a) - peso(b) || a.nome.localeCompare(b.nome, "pt-BR"));
  }, [socios]);

  if (ordenados.length === 0) {
    return <EmptyState title="Nenhum sócio no cadastro" description="Marque a direção no cadastro de colaboradores." icon={<Landmark className="h-10 w-10" />} />;
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-500">
        O que sai para cada sócio, fora da folha: o Contas a Pagar de um lado, o plano do contador (2.14) do outro. As janelas são diferentes
        (16→15 × mês civil) — diferença pequena é vencimento na virada; diferença grande é título em conta errada.
      </p>
      {ordenados.map((socio) => (
        <BlocoSocio
          key={socio.id}
          socio={socio}
          pagamentos={pagamentos.filter((p) => p.colaboradorId === socio.id)}
          card={cardsPlano.find((c) => c.id === CARD_POR_PESSOA[socio.id])}
          compAtiva={compAtiva}
          onEscolherMes={onEscolherMes}
          semPlanoNoMes={semPlanoNoMes}
        />
      ))}
    </div>
  );
}

function BlocoSocio({
  socio,
  pagamentos,
  card,
  compAtiva,
  onEscolherMes,
  semPlanoNoMes,
}: {
  socio: Colaborador;
  pagamentos: Pagamento[];
  card?: CardPlano;
  compAtiva: string;
  onEscolherMes: (c: string) => void;
  semPlanoNoMes: boolean;
}) {
  const doMes = useMemo(() => pagamentos.filter((p) => p.competencia === compAtiva).sort((a, b) => b.valor - a.valor), [pagamentos, compAtiva]);
  const pagoMes = doMes.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const planoMes = card?.total ?? 0;
  const dif = Math.round((pagoMes - planoMes) * 100) / 100;
  const historico = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pagamentos) m.set(p.competencia, (m.get(p.competencia) ?? 0) + (Number(p.valor) || 0));
    return [...m.entries()].map(([competencia, valor]) => ({ competencia, valor }));
  }, [pagamentos]);
  const rotulo = rotuloDoSocio(socio.id);

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Landmark className="h-5 w-5 text-brand" />
        <h2 className="text-base font-semibold text-brand-ink">{socio.nome}</h2>
        <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600">{rotulo}</span>
        {card && <span className="text-xs text-slate-400">· plano de contas: {card.titulo}</span>}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Pago no mês" value={formatBRL(pagoMes)} accent="brand" icon={<Wallet className="h-4 w-4" />} hint={`Contas a Pagar · ${compLabelLongo(compAtiva)}`} />
        <StatCard
          label="Plano do contador"
          value={semPlanoNoMes ? "—" : formatBRL(planoMes)}
          accent="blue"
          icon={<FileSpreadsheet className="h-4 w-4" />}
          hint={semPlanoNoMes ? "Sem plano de contas neste mês" : `${card?.itens.length ?? 0} conta(s) em 2.14`}
        />
        <StatCard
          label="Diferença"
          value={semPlanoNoMes ? "—" : `${dif > 0 ? "+" : dif < 0 ? "−" : ""}${formatBRL(Math.abs(dif))}`}
          accent={semPlanoNoMes || Math.abs(dif) < 0.005 ? "green" : "gold"}
          icon={<Scale className="h-4 w-4" />}
          hint={semPlanoNoMes ? "Sem o que comparar" : Math.abs(dif) < 0.005 ? "Os dois lados batem" : dif > 0 ? "Pago acima do plano" : "Plano acima do pago"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card idPersistencia={`custos:soc:${socio.id}:mes`}>
          <CardHeader title="Lançamentos do mês" subtitle="O que saiu pelo Contas a Pagar" icon={<Wallet className="h-5 w-5" />} />
          <CardBody>
            {doMes.length === 0 ? (
              <p className="text-sm text-slate-400">Nada gravado em {compLabelLongo(compAtiva)}.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {doMes.map((p) => (
                    <tr key={p.id}>
                      <td className="td">
                        <span className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDoTipo(p.tipo) }} />
                          <span className="text-slate-700">{p.tipo}</span>
                          {p.descricao && <span className="text-xs text-slate-400">· {p.descricao}</span>}
                        </span>
                      </td>
                      <td className="td text-right font-medium tabular-nums text-slate-800">{formatBRL(p.valor)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/60">
                    <td className="td font-semibold text-brand-ink">Total</td>
                    <td className="td text-right font-semibold tabular-nums text-brand-ink">{formatBRL(pagoMes)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card idPersistencia={`custos:soc:${socio.id}:plano`}>
          <CardHeader title="No plano do contador" subtitle={card ? `Contas ${card.titulo.toLowerCase()} (2.14)` : "Sem card no plano"} icon={<FileSpreadsheet className="h-5 w-5" />} />
          <CardBody>
            {!card || card.itens.length === 0 ? (
              <p className="text-sm text-slate-400">{semPlanoNoMes ? "Sem plano de contas neste mês." : "Nada em 2.14 para este sócio neste mês."}</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {card.itens.map((c) => (
                    <tr key={c.codigo}>
                      <td className="td"><span className="font-mono text-xs text-slate-500">{c.codigo}</span> <span className="text-slate-700">{c.nome}</span></td>
                      <td className="td text-right font-medium tabular-nums text-slate-800">{formatBRL(c.valor)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/60">
                    <td className="td font-semibold text-brand-ink">Total</td>
                    <td className="td text-right font-semibold tabular-nums text-brand-ink">{formatBRL(card.total)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card idPersistencia={`custos:soc:${socio.id}:hist`} className="mt-4">
        <CardHeader title="Mês a mês" subtitle="Quanto saiu para o sócio em cada competência. Clique num mês para abri-lo." icon={<Landmark className="h-5 w-5" />} />
        <CardBody>
          <HistoricoMensal
            pontos={historico}
            selecionada={compAtiva}
            onSelecionar={onEscolherMes}
            rotuloValor="Pago"
            vazio={<p className="text-sm text-slate-400">Sem lançamentos gravados para {socio.nome}.</p>}
          />
        </CardBody>
      </Card>
    </section>
  );
}
