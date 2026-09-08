import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { HistoricoMensal } from "@/components/custos/historico-mensal";
import { formatBRL } from "@/lib/format";
import { Pessoa } from "@/components/ui/pessoa";
import { compLabelLongo, competenciasPlano, confidencialDoMes } from "@/lib/custos";
import { corDoTipo } from "@/lib/folha";
import { CARDS_CONFIDENCIAIS } from "@/data/classificacaoContas";
import { CARD_POR_PESSOA, rotuloDoSocio } from "@/lib/societario";
import { cn } from "@/lib/cn";
import type { Colaborador, ContaPlano, Pagamento } from "@/data/types";

interface Entrada {
  chave: string;
  rotulo: string;
  detalhe?: string;
  valor: number;
  cor: string;
}

/**
 * O que entra para um sócio num mês — UM valor, de UMA fonte.
 *
 * O sócio tem um tipo de dinheiro só (pedido do Léo, 07/09/2026: "ela só tem um
 * tipo de valor, não tem dois"). A fonte é a que tem o mês: o que foi gravado
 * para a pessoa pelo Contas a Pagar, e, quando não há nada, as contas 2.14
 * dele no plano do contador. Nunca as duas somadas — seria o mesmo dinheiro
 * duas vezes — e a tela diz de onde veio.
 */
export function entradasDoSocio(
  socio: Colaborador,
  pagamentos: Pagamento[],
  plano: ContaPlano[],
  comp: string,
): { entradas: Entrada[]; total: number; fonte: "contas-a-pagar" | "plano" | null } {
  const doMes = pagamentos.filter((p) => p.colaboradorId === socio.id && p.competencia === comp);
  if (doMes.length > 0) {
    const entradas = doMes
      .map((p) => ({ chave: p.id, rotulo: p.tipo, detalhe: p.descricao, valor: Number(p.valor) || 0, cor: corDoTipo(p.tipo) }))
      .sort((a, b) => b.valor - a.valor);
    return { entradas, total: entradas.reduce((s, e) => s + e.valor, 0), fonte: "contas-a-pagar" };
  }
  const card = confidencialDoMes(plano, comp, CARDS_CONFIDENCIAIS).find((c) => c.id === CARD_POR_PESSOA[socio.id]);
  if (card && card.itens.length > 0) {
    const entradas = card.itens.map((c) => ({ chave: c.codigo, rotulo: c.nome, detalhe: c.codigo, valor: c.valor, cor: "#475569" }));
    return { entradas, total: card.total, fonte: "plano" };
  }
  return { entradas: [], total: 0, fonte: null };
}

/** Pedro primeiro, Leonardo depois, o resto por nome. */
const pesoDoSocio = (c: Colaborador) => (c.id === "pedro-ramos" ? 0 : c.id === "leonardo-goncalves" ? 1 : 2);

/**
 * Quais sócios merecem uma aba — e quantos ficaram de fora.
 *
 * Pedido do Léo em 08/09/2026, olhando a tela: "a saída societárias pode ficar
 * só Leonardo e Pedro, o resto não precisa". No cadastro há TRÊS pessoas
 * marcadas como direção; a terceira não tem lançamento nenhum nem conta 2.14 no
 * plano do contador, então a aba dela é sempre R$ 0,00 e só ocupa espaço.
 *
 * A régua é o DINHEIRO, não os dois nomes escritos aqui. Se um sócio novo passar
 * a receber, ele aparece sozinho; se um dos dois parar de vez, some. Nome fixo
 * envelheceria no dia em que a sociedade mudasse — e alguém teria de lembrar de
 * vir mexer no código.
 *
 * Duas cautelas, as duas com teste:
 *  - basta ter dinheiro em UM mês, não no mês aberto: senão a aba piscaria
 *    conforme o mês escolhido;
 *  - se ninguém tiver dinheiro, mostra todos. Esconder todo mundo deixaria a
 *    tela dizendo "nenhum sócio no cadastro", que é mentira: eles existem, só
 *    não receberam nada.
 */
export function sociosComMovimento(
  socios: Colaborador[],
  pagamentos: Pagamento[],
  plano: ContaPlano[],
): { visiveis: Colaborador[]; ocultos: number } {
  const ordenados = [...socios].sort((a, b) => pesoDoSocio(a) - pesoDoSocio(b) || a.nome.localeCompare(b.nome, "pt-BR"));
  const temDinheiro = (s: Colaborador) => {
    const comps = new Set<string>([
      ...competenciasPlano(plano),
      ...pagamentos.filter((p) => p.colaboradorId === s.id).map((p) => p.competencia),
    ]);
    for (const c of comps) if (entradasDoSocio(s, pagamentos, plano, c).total !== 0) return true;
    return false;
  };
  const visiveis = ordenados.filter(temDinheiro);
  if (visiveis.length === 0) return { visiveis: ordenados, ocultos: 0 };
  return { visiveis, ocultos: ordenados.length - visiveis.length };
}

export function Societarias({
  socios,
  pagamentos,
  plano,
  compAtiva,
  onEscolherMes,
}: {
  socios: Colaborador[];
  pagamentos: Pagamento[];
  plano: ContaPlano[];
  compAtiva: string;
  onEscolherMes: (c: string) => void;
}) {
  const { visiveis: ordenados, ocultos } = useMemo(
    () => sociosComMovimento(socios, pagamentos, plano),
    [socios, pagamentos, plano],
  );
  const [socioId, setSocioId] = useState<string>(ordenados[0]?.id ?? "");
  // Se o sócio escolhido deixar de aparecer (parou de ter dinheiro, ou a busca
  // trouxe outro conjunto), cai no primeiro em vez de mostrar tela vazia.
  const socio = ordenados.find((s) => s.id === socioId) ?? ordenados[0];

  const mes = useMemo(() => (socio ? entradasDoSocio(socio, pagamentos, plano, compAtiva) : null), [socio, pagamentos, plano, compAtiva]);
  const historico = useMemo(() => {
    if (!socio) return [];
    const comps = new Set<string>([...competenciasPlano(plano), ...pagamentos.filter((p) => p.colaboradorId === socio.id).map((p) => p.competencia)]);
    return [...comps].sort().map((c) => ({ competencia: c, valor: entradasDoSocio(socio, pagamentos, plano, c).total })).filter((x) => x.valor !== 0);
  }, [socio, pagamentos, plano]);

  if (!socio || !mes) {
    return <EmptyState title="Nenhum sócio no cadastro" description="Marque a direção no cadastro de colaboradores." icon={<Landmark className="h-10 w-10" />} />;
  }
  const rotulo = rotuloDoSocio(socio.id);

  return (
    <div className="space-y-6">
      {/* Quem: um de cada vez. */}
      <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Sócio">
        {ordenados.map((s) => {
          const ativo = s.id === socio.id;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => setSocioId(s.id)}
              className={cn(
                "rounded-xl border px-4 py-2 text-sm font-medium transition",
                ativo ? "border-brand bg-brand text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {s.nome} <span className={cn("ml-1 text-xs", ativo ? "text-white/80" : "text-slate-400")}>· {rotuloDoSocio(s.id)}</span>
            </button>
          );
        })}
      </div>
      {ocultos > 0 && (
        /* Nunca esconder calado: quem lê precisa saber que a lista foi filtrada,
           e por qual régua. */
        <p className="-mt-4 text-xs text-slate-400">
          {ocultos} pessoa(s) da direção sem nenhum valor lançado não aparecem aqui.
        </p>
      )}

      {/* O número do mês — um só. */}
      <div className="rounded-2xl bg-brand-ink px-6 py-5 text-white">
        <p className="text-xs font-medium uppercase tracking-wide text-white/70">{rotulo} · {compLabelLongo(compAtiva)}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight">{formatBRL(mes.total)}</p>
        <p className="mt-1 text-xs text-white/70">
          {mes.fonte === "contas-a-pagar" ? "Do Contas a Pagar do Mubisys" : mes.fonte === "plano" ? "Do plano de contas do contador (2.14)" : "Nada gravado neste mês"}
        </p>
      </div>

      {/* O que entra. */}
      <Card idPersistencia={`custos:soc:${socio.id}:entra`}>
        <CardHeader title="O que entra" subtitle={<>{<Pessoa nome={socio.nome} cpf={socio.cpf} />} em {compLabelLongo(compAtiva)}</>} icon={<Landmark className="h-5 w-5" />} />
        <CardBody>
          {mes.entradas.length === 0 ? (
            <p className="text-sm text-slate-400">Nada gravado em {compLabelLongo(compAtiva)}.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {mes.entradas.map((e) => (
                  <tr key={e.chave}>
                    <td className="td">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: e.cor }} />
                        <span className="text-slate-700">{e.rotulo}</span>
                        {e.detalhe && <span className="text-xs text-slate-400">· {e.detalhe}</span>}
                      </span>
                    </td>
                    <td className="td w-44">
                      <span className="flex items-center gap-2">
                        <span className="h-1.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
                          <span className="block h-1.5 rounded-full" style={{ width: `${mes.total > 0 ? Math.max(0, Math.min(100, (e.valor / mes.total) * 100)) : 0}%`, backgroundColor: e.cor }} />
                        </span>
                        <span className="w-11 text-right text-xs tabular-nums text-slate-500">{mes.total > 0 ? `${((e.valor / mes.total) * 100).toFixed(1).replace(".", ",")}%` : "—"}</span>
                      </span>
                    </td>
                    <td className="td text-right font-medium tabular-nums text-slate-800">{formatBRL(e.valor)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/60">
                  <td className="td font-semibold text-brand-ink">Total</td>
                  <td className="td text-right text-xs text-slate-500">100%</td>
                  <td className="td text-right font-semibold tabular-nums text-brand-ink">{formatBRL(mes.total)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Mês a mês. */}
      <Card idPersistencia={`custos:soc:${socio.id}:hist`}>
        <CardHeader title="Mês a mês" subtitle="Quanto entrou em cada competência. Clique num mês para abri-lo." icon={<Landmark className="h-5 w-5" />} />
        <CardBody>
          <HistoricoMensal
            pontos={historico}
            selecionada={compAtiva}
            onSelecionar={onEscolherMes}
            rotuloValor={rotulo}
            vazio={<p className="text-sm text-slate-400">Sem lançamentos gravados para {socio.nome}.</p>}
          />
        </CardBody>
      </Card>
    </div>
  );
}
