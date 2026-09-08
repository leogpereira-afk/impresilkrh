import { useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { HistoricoMensal } from "@/components/custos/historico-mensal";
import { formatBRL } from "@/lib/format";
import { Pessoa } from "@/components/ui/pessoa";
import { chaveContaSocio, compLabelLongo, competenciasPlano, confidencialDoMes, folhasDoMes, NAO_E_DE_SOCIO } from "@/lib/custos";
import { corDoTipo } from "@/lib/folha";
import { CARDS_CONFIDENCIAIS } from "@/data/classificacaoContas";
import { CARD_POR_PESSOA, rotuloDoSocio } from "@/lib/societario";
import { cn } from "@/lib/cn";
import type { Colaborador, Config, ContaPlano, Pagamento } from "@/data/types";

interface Entrada {
  chave: string;
  rotulo: string;
  detalhe?: string;
  valor: number;
  cor: string;
  /** Escrito à mão pelo Léo — a tela marca, para ninguém achar que veio de sistema. */
  manual?: boolean;
  /** Conta do plano por trás da linha, quando há: é ela que o "remover" tira. */
  codigo?: string;
  /** O nome da conta NAQUELE mês. A chave do vínculo é código+nome. */
  nomeConta?: string;
}

export type LancamentoSocio = NonNullable<Config["lancamentosSocio"]>[number];

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
  /**
   * Lançamentos escritos à mão. SOMAM SEMPRE, seja qual for a fonte do mês —
   * é o dono dizendo "isto também é meu", e nem tudo que sai para um sócio
   * passa pelo ERP ou pelo plano do contador.
   */
  manuais: LancamentoSocio[] = [],
): {
  entradas: Entrada[];
  total: number;
  fonte: "contas-a-pagar" | "plano" | "manual" | null;
  /** A fonte que NÃO foi usada, quando ela tem algo. Para a tela declarar. */
  outraFonte?: { fonte: "contas-a-pagar" | "plano"; total: number; linhas: number };
} {
  const doMes = pagamentos.filter((p) => p.colaboradorId === socio.id && p.competencia === comp);
  const totalPagamentos = doMes.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const card = confidencialDoMes(plano, comp, CARDS_CONFIDENCIAIS, vinculos).find((c) => c.id === CARD_POR_PESSOA[socio.id]);
  const aMao: Entrada[] = manuais
    .filter((m) => m.socioId === socio.id && m.competencia === comp)
    .map((m) => ({ chave: m.id, rotulo: m.rotulo, valor: Number(m.valor) || 0, cor: "#b45309", manual: true }));
  const somaMao = aMao.reduce((s, e) => s + e.valor, 0);

  if (card && card.itens.length > 0) {
    const entradas = [
      ...card.itens.map((c) => ({ chave: c.codigo, rotulo: c.nome, detalhe: c.codigo, valor: c.valor, cor: "#475569", codigo: c.codigo, nomeConta: c.nome })),
      ...aMao,
    ];
    return {
      entradas,
      total: card.total + somaMao,
      fonte: "plano",
      ...(doMes.length > 0 ? { outraFonte: { fonte: "contas-a-pagar" as const, total: totalPagamentos, linhas: doMes.length } } : {}),
    };
  }
  if (doMes.length > 0 || aMao.length > 0) {
    const entradas = [
      ...doMes
        .map((p) => ({ chave: p.id, rotulo: p.tipo, detalhe: p.descricao, valor: Number(p.valor) || 0, cor: corDoTipo(p.tipo) }))
        .sort((a, b) => b.valor - a.valor),
      ...aMao,
    ];
    return { entradas, total: totalPagamentos + somaMao, fonte: doMes.length > 0 ? "contas-a-pagar" : "manual" };
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
  manuais = [],
  onLancarManual,
  onApagarManual,
}: {
  socios: Colaborador[];
  pagamentos: Pagamento[];
  plano: ContaPlano[];
  compAtiva: string;
  onEscolherMes: (c: string) => void;
  /** Conta do plano → id do card. O que o Léo apontou à mão. */
  vinculos?: Record<string, string>;
  /** Recebe a CHAVE (código+nome), não o código — o número sozinho não identifica a conta. */
  onVincular?: (chave: string, cardId: string) => void;
  /** Traz o plano deste mês do Mubisys — a sincronização só desta parte. */
  onSincronizar?: (comp: string) => void;
  sincronizando?: string | null;
  /** Lançamentos escritos à mão, e como criar/apagar. */
  manuais?: LancamentoSocio[];
  onLancarManual?: (l: { socioId: string; competencia: string; rotulo: string; valor: number }) => void;
  onApagarManual?: (id: string) => void;
}) {
  const { visiveis: ordenados, ocultos } = useMemo(
    () => sociosComMovimento(socios, pagamentos, plano, vinculos),
    [socios, pagamentos, plano, vinculos],
  );
  const [socioId, setSocioId] = useState<string>(ordenados[0]?.id ?? "");
  const [abrindoLancamento, setAbrindoLancamento] = useState(false);
  const [novoRotulo, setNovoRotulo] = useState("");
  const [novoValor, setNovoValor] = useState("");
  // Se o sócio escolhido deixar de aparecer (parou de ter dinheiro, ou a busca
  // trouxe outro conjunto), cai no primeiro em vez de mostrar tela vazia.
  const socio = ordenados.find((s) => s.id === socioId) ?? ordenados[0];

  const mes = useMemo(() => (socio ? entradasDoSocio(socio, pagamentos, plano, compAtiva, vinculos, manuais) : null), [socio, pagamentos, plano, compAtiva, vinculos, manuais]);
  const candidatas = useMemo(() => contasCandidatas(plano, compAtiva, socios, vinculos), [plano, compAtiva, socios, vinculos]);
  const historico = useMemo(() => {
    if (!socio) return [];
    const comps = new Set<string>([
      ...competenciasPlano(plano),
      ...pagamentos.filter((p) => p.colaboradorId === socio.id).map((p) => p.competencia),
      // O mês que só existe à mão também é um mês: sem isto, o lançamento
      // escrito num mês sem plano e sem título nunca apareceria no gráfico.
      ...manuais.filter((m) => m.socioId === socio.id).map((m) => m.competencia),
    ]);
    return [...comps].sort().map((c) => ({ competencia: c, valor: entradasDoSocio(socio, pagamentos, plano, c, vinculos, manuais).total })).filter((x) => x.valor !== 0);
  }, [socio, pagamentos, plano, vinculos, manuais]);

  /* Todos os meses que existem em qualquer fonte, do mais novo para o mais
     antigo: é o seletor do topo. Sem ele, só dava para trocar de mês clicando
     na tabela lá embaixo — e o mês que não tem linha nenhuma era inalcançável. */
  const mesesDisponiveis = useMemo(() => {
    const c = new Set<string>([
      compAtiva,
      ...competenciasPlano(plano),
      ...pagamentos.filter((p) => socios.some((s) => s.id === p.colaboradorId)).map((p) => p.competencia),
      ...manuais.map((m) => m.competencia),
    ].filter(Boolean));
    return [...c].sort().reverse();
  }, [plano, pagamentos, socios, manuais, compAtiva]);

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
      {/* Mês e lançamento manual, no topo: é daqui que se comanda a tela. */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-600">
          Mês
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={compAtiva}
            onChange={(e) => onEscolherMes(e.target.value)}
          >
            {mesesDisponiveis.map((c) => (
              <option key={c} value={c}>{compLabelLongo(c)}</option>
            ))}
          </select>
        </label>
        {onLancarManual && (
          <button
            type="button"
            onClick={() => setAbrindoLancamento((v) => !v)}
            className="rounded-lg border border-brand/30 bg-brand/5 px-3 py-1.5 text-sm font-medium text-brand transition hover:bg-brand/10"
          >
            {abrindoLancamento ? "Fechar" : "Lançamento manual"}
          </button>
        )}
      </div>

      {abrindoLancamento && onLancarManual && (
        /* O que não passa nem pelo ERP nem pelo plano do contador. Soma sempre,
           e a linha fica marcada para ninguém achar que veio de sistema. */
        <form
          className="flex flex-wrap items-end gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = Number(String(novoValor).replace(/\./g, "").replace(",", "."));
            if (!novoRotulo.trim() || !Number.isFinite(v) || v === 0) return;
            onLancarManual({ socioId: socio.id, competencia: compAtiva, rotulo: novoRotulo.trim(), valor: v });
            setNovoRotulo("");
            setNovoValor("");
            setAbrindoLancamento(false);
          }}
        >
          <label className="flex flex-col gap-1 text-xs text-amber-900">
            O que é
            <input
              className="w-64 rounded-lg border border-amber-200 px-3 py-1.5 text-sm"
              value={novoRotulo}
              onChange={(e) => setNovoRotulo(e.target.value)}
              placeholder="Retirada extra, acerto…"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-amber-900">
            Valor (R$)
            <input
              className="w-36 rounded-lg border border-amber-200 px-3 py-1.5 text-right text-sm tabular-nums"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              inputMode="decimal"
              placeholder="1.500,00"
            />
          </label>
          <span className="pb-2 text-xs text-amber-800/80">
            em {compLabelLongo(compAtiva)}, para {socio.nome}
          </span>
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white">
            Lançar
          </button>
        </form>
      )}

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
                        {e.manual && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">à mão</span>
                        )}
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
                    <td className="td w-24 text-right">
                      {/* Remover: a conta do plano sai de TODOS os cards; o
                          lançamento à mão é apagado. O que veio do Contas a
                          Pagar não tem botão — ele é título do ERP, e sumir
                          com ele daqui esconderia dinheiro que existe. */}
                      {e.manual && onApagarManual ? (
                        <button
                          type="button"
                          onClick={() => onApagarManual(e.chave)}
                          className="text-xs text-slate-400 underline-offset-2 transition hover:text-rose-600 hover:underline"
                        >
                          apagar
                        </button>
                      ) : e.codigo && onVincular ? (
                        <button
                          type="button"
                          onClick={() => onVincular(chaveContaSocio(e.codigo!, e.nomeConta ?? ""), NAO_E_DE_SOCIO)}
                          className="text-xs text-slate-400 underline-offset-2 transition hover:text-rose-600 hover:underline"
                          title="Tira esta conta do card, em todos os meses"
                        >
                          não é daqui
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/60">
                  <td className="td font-semibold text-brand-ink">Total</td>
                  <td className="td text-right text-xs text-slate-500">100%</td>
                  <td className="td text-right font-semibold tabular-nums text-brand-ink">{formatBRL(mes.total)}</td>
                  <td className="td" />
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
                          value={vinculos[chaveContaSocio(c.codigo, c.nome)] ?? ""}
                          onChange={(ev) => onVincular(chaveContaSocio(c.codigo, c.nome), ev.target.value)}
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

    </div>
  );
}
