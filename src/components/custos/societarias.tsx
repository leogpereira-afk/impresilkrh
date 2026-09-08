import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { HistoricoMensal } from "@/components/custos/historico-mensal";
import { formatBRL } from "@/lib/format";
import { Pessoa } from "@/components/ui/pessoa";
import { compLabelLongo, competenciasPlano, confidencialDoMes, folhasDoMes } from "@/lib/custos";
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
 * tipo de valor, não tem dois"). Nunca as duas fontes somadas: seria o mesmo
 * dinheiro duas vezes. A tela diz de onde veio.
 *
 * QUAL FONTE GANHA (corrigido em 08/09/2026). Era o Contas a Pagar sempre que
 * houvesse QUALQUER lançamento da pessoa no mês. Isso quebrou feio em maio: o
 * Leonardo tem UM título lá — "AMIL LEONARDO", R$ 3.146,27, um plano de saúde —
 * e esse único título ganhou do plano do contador, que fecha o mês em
 * R$ 15.961,02. A tela mostrava 3.146,27, escondia R$ 12.814,75 e ainda
 * desenhava uma queda de 93% que nunca existiu.
 *
 * As duas fontes não são equivalentes: o plano do contador é o mês FECHADO, e o
 * Contas a Pagar traz só os títulos que casaram com a pessoa pelo nome. Então o
 * plano manda quando tem o mês; o Contas a Pagar entra quando o plano não tem.
 *
 * E o que sobrou da outra fonte não some calado: volta em `outraFonte` para a
 * tela dizer que existe. Número escondido foi o defeito do dia inteiro.
 */
export function entradasDoSocio(
  socio: Colaborador,
  pagamentos: Pagamento[],
  plano: ContaPlano[],
  comp: string,
  vinculos: Record<string, string> = {},
): {
  entradas: Entrada[];
  total: number;
  fonte: "contas-a-pagar" | "plano" | null;
  /** A fonte que NÃO foi usada, quando ela tem algo. Para a tela declarar. */
  outraFonte?: { fonte: "contas-a-pagar" | "plano"; total: number; linhas: number };
} {
  const doMes = pagamentos.filter((p) => p.colaboradorId === socio.id && p.competencia === comp);
  const totalPagamentos = doMes.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const card = confidencialDoMes(plano, comp, CARDS_CONFIDENCIAIS, vinculos).find((c) => c.id === CARD_POR_PESSOA[socio.id]);

  if (card && card.itens.length > 0) {
    const entradas = card.itens.map((c) => ({ chave: c.codigo, rotulo: c.nome, detalhe: c.codigo, valor: c.valor, cor: "#475569" }));
    return {
      entradas,
      total: card.total,
      fonte: "plano",
      ...(doMes.length > 0 ? { outraFonte: { fonte: "contas-a-pagar" as const, total: totalPagamentos, linhas: doMes.length } } : {}),
    };
  }
  if (doMes.length > 0) {
    const entradas = doMes
      .map((p) => ({ chave: p.id, rotulo: p.tipo, detalhe: p.descricao, valor: Number(p.valor) || 0, cor: corDoTipo(p.tipo) }))
      .sort((a, b) => b.valor - a.valor);
    return { entradas, total: totalPagamentos, fonte: "contas-a-pagar" };
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
  vinculos: Record<string, string> = {},
): { visiveis: Colaborador[]; ocultos: number } {
  const ordenados = [...socios].sort((a, b) => pesoDoSocio(a) - pesoDoSocio(b) || a.nome.localeCompare(b.nome, "pt-BR"));
  const temDinheiro = (s: Colaborador) => {
    const comps = new Set<string>([
      ...competenciasPlano(plano),
      ...pagamentos.filter((p) => p.colaboradorId === s.id).map((p) => p.competencia),
    ]);
    for (const c of comps) if (entradasDoSocio(s, pagamentos, plano, c, vinculos).total !== 0) return true;
    return false;
  };
  const visiveis = ordenados.filter(temDinheiro);
  if (visiveis.length === 0) return { visiveis: ordenados, ocultos: 0 };
  return { visiveis, ocultos: ordenados.length - visiveis.length };
}

/**
 * Contas do plano que NOMEIAM um sócio e não estão em card nenhum.
 *
 * É a lista que o Léo usa para resolver o que a máquina não resolve. Em julho
 * "Leonardo" aparece em 2.11.2.2 (retirada, R$ 28.105,64) e em 2.13.5.1
 * (antecipação de recebíveis, R$ 10.000) — mesmo nome, bolsos diferentes.
 * Juntar as duas por semelhança de nome seria inventar; mostrar as duas e
 * deixar ele apontar é o certo.
 *
 * Só contas com VALOR entram: linha zerada não é decisão a tomar.
 */
export function contasCandidatas(
  plano: ContaPlano[],
  comp: string,
  socios: Colaborador[],
  vinculos: Record<string, string> = {},
): { codigo: string; nome: string; valor: number }[] {
  const norm = (t: string) =>
    t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const pedacos = new Set<string>();
  for (const s of socios) for (const t of norm(s.nome).split(" ")) if (t.length > 3) pedacos.add(t);
  const emCard = new Set(
    confidencialDoMes(plano, comp, CARDS_CONFIDENCIAIS, vinculos).flatMap((c) => c.itens.map((i) => i.codigo)),
  );
  return folhasDoMes(plano, comp)
    .filter((p) => p.valor !== 0 && !emCard.has(p.codigo))
    .filter((p) => norm(p.nome).split(" ").some((t) => pedacos.has(t)))
    .map((p) => ({ codigo: p.codigo, nome: p.nome, valor: p.valor }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor));
}

export function Societarias({
  socios,
  pagamentos,
  plano,
  compAtiva,
  onEscolherMes,
  vinculos = {},
  onVincular,
  onSincronizar,
  sincronizando,
}: {
  socios: Colaborador[];
  pagamentos: Pagamento[];
  plano: ContaPlano[];
  compAtiva: string;
  onEscolherMes: (c: string) => void;
  /** Conta do plano → id do card. O que o Léo apontou à mão. */
  vinculos?: Record<string, string>;
  onVincular?: (codigo: string, cardId: string) => void;
  /** Traz o plano deste mês do Mubisys — a sincronização só desta parte. */
  onSincronizar?: (comp: string) => void;
  sincronizando?: string | null;
}) {
  const { visiveis: ordenados, ocultos } = useMemo(
    () => sociosComMovimento(socios, pagamentos, plano, vinculos),
    [socios, pagamentos, plano, vinculos],
  );
  const [socioId, setSocioId] = useState<string>(ordenados[0]?.id ?? "");
  // Se o sócio escolhido deixar de aparecer (parou de ter dinheiro, ou a busca
  // trouxe outro conjunto), cai no primeiro em vez de mostrar tela vazia.
  const socio = ordenados.find((s) => s.id === socioId) ?? ordenados[0];

  const mes = useMemo(() => (socio ? entradasDoSocio(socio, pagamentos, plano, compAtiva, vinculos) : null), [socio, pagamentos, plano, compAtiva, vinculos]);
  const candidatas = useMemo(() => contasCandidatas(plano, compAtiva, socios, vinculos), [plano, compAtiva, socios, vinculos]);
  const historico = useMemo(() => {
    if (!socio) return [];
    const comps = new Set<string>([...competenciasPlano(plano), ...pagamentos.filter((p) => p.colaboradorId === socio.id).map((p) => p.competencia)]);
    return [...comps].sort().map((c) => ({ competencia: c, valor: entradasDoSocio(socio, pagamentos, plano, c, vinculos).total })).filter((x) => x.valor !== 0);
  }, [socio, pagamentos, plano, vinculos]);

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
          {mes.fonte === "contas-a-pagar" ? "Do Contas a Pagar do Mubisys" : mes.fonte === "plano" ? "Do plano de contas do contador" : "Nada gravado neste mês"}
        </p>
        {mes.outraFonte && (
          /* A outra fonte NÃO some calada. Foi assim que maio virou R$ 3.146,27:
             um título de plano de saúde ganhou do mês fechado do contador e
             R$ 12.814,75 sumiram sem nada dizer. */
          <p className="mt-2 rounded-lg bg-white/10 px-3 py-2 text-xs text-white/80">
            Também há {mes.outraFonte.linhas} lançamento(s) no Contas a Pagar somando {formatBRL(mes.outraFonte.total)} —
            não entram neste número para não contar o mesmo dinheiro duas vezes.
          </p>
        )}
        {onSincronizar && (
          <button
            type="button"
            onClick={() => onSincronizar(compAtiva)}
            disabled={!!sincronizando}
            className="mt-3 rounded-lg border border-white/25 px-3 py-1.5 text-xs font-medium text-white/90 transition hover:bg-white/10 disabled:opacity-50"
          >
            {sincronizando ?? `Trazer ${compLabelLongo(compAtiva)} do Mubisys`}
          </button>
        )}
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

      {/* O que a máquina NÃO soube atribuir — e você sabe. */}
      {onVincular && (candidatas.length > 0 || Object.keys(vinculos).length > 0) && (
        <Card idPersistencia="custos:soc:vinculos">
          <CardHeader
            title="Contas que nomeiam um sócio"
            subtitle={`Em ${compLabelLongo(compAtiva)}. O contador renumera o plano e o nome sozinho não identifica — "Leonardo" já apareceu como retirada num lugar e antecipação de recebíveis noutro. Aponte de quem é cada uma; fica gravado.`}
            icon={<Landmark className="h-5 w-5" />}
          />
          <CardBody>
            {candidatas.length === 0 ? (
              <p className="text-sm text-slate-400">Nenhuma conta solta neste mês.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {candidatas.map((c) => (
                    <tr key={c.codigo}>
                      <td className="td font-mono text-xs text-slate-500">{c.codigo}</td>
                      <td className="td text-slate-700">{c.nome}</td>
                      <td className="td text-right font-medium tabular-nums text-slate-800">{formatBRL(c.valor)}</td>
                      <td className="td w-52">
                        <select
                          className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs"
                          value={vinculos[c.codigo] ?? ""}
                          onChange={(ev) => onVincular(c.codigo, ev.target.value)}
                        >
                          <option value="">Não é de sócio</option>
                          {ordenados.map((s) => (
                            <option key={s.id} value={CARD_POR_PESSOA[s.id] ?? s.id}>
                              É do {s.nome}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {Object.keys(vinculos).length > 0 && (
              <p className="mt-3 text-xs text-slate-400">
                {Object.keys(vinculos).length} conta(s) apontada(s) à mão. Elas valem em todos os meses e sobrevivem à
                próxima renumeração do contador.
              </p>
            )}
          </CardBody>
        </Card>
      )}

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
