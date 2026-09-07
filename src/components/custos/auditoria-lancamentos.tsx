import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Info, UserSearch, Wand2 } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/modal";
import { formatBRL } from "@/lib/format";
import { compLabel } from "@/lib/custos";
import { auditarLancamentos, ROTULO_REGRA, COMO_CORRIGIR, ROTULO_ONDE, type AchadoAuditoria, type Gravidade, type RegraAuditoria } from "@/lib/auditoriaLancamentos";
import { desligamentosPeloUltimoPagamento, type PropostaDesligamento } from "@/lib/desligarPeloUltimoPagamento";
import { reativarQuemContinuaRecebendo, admissaoAnteriorAoPrimeiroPagamento, opcoesDeStatus, type PropostaReativar, type PropostaAdmissao } from "@/lib/consertoCadastro";
import { Input, Select } from "@/components/ui/form";
import type { Colaborador, Pagamento } from "@/data/types";

const MOSTRAR = 25;
const TOM: Record<Gravidade, { caixa: string; chip: string; rotulo: string }> = {
  erro: { caixa: "border-red-200 bg-red-50/60", chip: "bg-red-100 text-red-700", rotulo: "Erro" },
  atencao: { caixa: "border-amber-200 bg-amber-50/50", chip: "bg-amber-100 text-amber-700", rotulo: "Atenção" },
  aviso: { caixa: "border-slate-200 bg-slate-50", chip: "bg-slate-100 text-slate-600", rotulo: "Aviso" },
};

/**
 * A auditoria dos lançamentos, na tela.
 *
 * Em 07/09/2026 esta conferência foi feita à mão sobre os 1.451 lançamentos
 * gravados desde agosto/2025 — funcionário por funcionário, linha por linha.
 * Ela achou 11 cadastros que contradizem os pagamentos (data de desligamento
 * errada esconde a pessoa do quadro e esvazia a ficha dela), 8 pares de
 * títulos gêmeos no mesmo dia e 29 pessoas com mês no quadro sem lançamento
 * nenhum. Nada disso aparecia em tela nenhuma.
 *
 * O painel existe para essa varredura não precisar de mais ninguém: roda
 * sozinha, sobre a competência que estiver escolhida ou sobre a história
 * inteira, e conserta sozinha só o que é determinístico (tipo e competência).
 * Cadastro e vínculo são decisão humana — ela aponta e leva até a pessoa.
 */
export function AuditoriaLancamentos({
  pagamentos,
  colaboradores,
  onCorrigir,
  onVerPessoa,
  onDesligar,
  onReativar,
  onCorrigirAdmissao,
  statusDisponiveis = [],
}: {
  pagamentos: Pagamento[];
  colaboradores: Colaborador[];
  /** Aplica os consertos determinísticos (tipo, competência) em lote. */
  onCorrigir: (achados: AchadoAuditoria[]) => void;
  onVerPessoa?: (colaboradorId: string) => void;
  /** Grava status inativo + data de desligamento pelo último pagamento (regra de 07/09/2026). */
  onDesligar?: (propostas: PropostaDesligamento[]) => void;
  /** Limpa a data de saída de quem continua recebendo salário, com o status escolhido. */
  onReativar?: (propostas: { colaboradorId: string; nome: string; statusId: string }[]) => void;
  /** Recua a data de admissão para o primeiro mês em que a pessoa recebeu. */
  onCorrigirAdmissao?: (propostas: PropostaAdmissao[]) => void;
  /** Status que contam no quadro — para escolher o destino de quem volta. */
  statusDisponiveis?: { id: string; nome: string }[];
}) {
  // "Quem não recebe desde <mês> ou antes está desligado no último mês em que
  // recebeu" — o limite é escolha de quem manda; a regra vem com junho/2026.
  const [ate, setAte] = useState("2026-06");
  const [confirmarDesligar, setConfirmarDesligar] = useState(false);
  const propostas = useMemo(() => desligamentosPeloUltimoPagamento(colaboradores, pagamentos, ate), [colaboradores, pagamentos, ate]);
  const anos = useMemo(
    () => [...new Set(pagamentos.map((p) => String(p.competencia ?? "").slice(0, 4)).filter(Boolean))].sort().reverse(),
    [pagamentos],
  );
  // As duas propostas que o dinheiro PROVA. Não gravam nada: a pessoa aplica.
  //
  // Os ids vão junto porque o destino padrão de quem parou de ser CLT é
  // "freelancer" — e propor um status que este cadastro não tem sumiria com a
  // pessoa do quadro em silêncio (`contaHeadcount` lê `?? false`).
  const idsDeStatus = useMemo(() => statusDisponiveis.map((s2) => s2.id), [statusDisponiveis]);
  const reativaveis = useMemo(
    () => reativarQuemContinuaRecebendo(colaboradores, pagamentos, idsDeStatus),
    [colaboradores, pagamentos, idsDeStatus],
  );
  const admissoes = useMemo(() => admissaoAnteriorAoPrimeiroPagamento(colaboradores, pagamentos), [colaboradores, pagamentos]);
  // Destino de quem volta, por pessoa: o dado prova que ela NÃO saiu, mas não
  // diz em que condição ela ficou. Quem sabe isso é quem manda.
  const [destino, setDestino] = useState<Record<string, string>>({});
  const [confirmarReativar, setConfirmarReativar] = useState(false);
  const [confirmarAdmissao, setConfirmarAdmissao] = useState(false);
  const [ano, setAno] = useState("");
  const [gravidade, setGravidade] = useState<Gravidade | "">("");
  const [confirmar, setConfirmar] = useState(false);
  const [abertos, setAbertos] = useState<Set<string>>(new Set());

  const { achados, resumo } = useMemo(
    () => auditarLancamentos(pagamentos, colaboradores, ano ? { de: `${ano}-01`, ate: `${ano}-12` } : {}),
    [pagamentos, colaboradores, ano],
  );
  const visiveis = gravidade ? achados.filter((a) => a.gravidade === gravidade) : achados;
  const consertaveis = achados.filter((a) => a.conserto);
  const porRegra = useMemo(() => {
    const m = new Map<RegraAuditoria, AchadoAuditoria[]>();
    for (const a of visiveis) m.set(a.regra, [...(m.get(a.regra) ?? []), a]);
    return [...m.entries()];
  }, [visiveis]);
  const limpo = achados.length === 0;
  const nome = (id: string) => colaboradores.find((c) => c.id === id)?.nome ?? id;

  return (
    <Card idPersistencia="custos:auditoria-lancamentos">
      <CardHeader
        title="Auditoria dos lançamentos"
        subtitle="Pessoa por pessoa, linha por linha: tipo × conta, competência × vencimento, cadastro × pagamentos, título em dobro e mês no quadro sem lançamento."
        icon={<ClipboardCheck className="h-5 w-5" />}
        action={
          consertaveis.length > 0 ? (
            <button type="button" className="btn-primary" onClick={() => setConfirmar(true)}>
              <Wand2 className="h-4 w-4" /> Corrigir {consertaveis.length} automático(s)
            </button>
          ) : undefined
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={ano} onChange={(e) => setAno(e.target.value)} className="h-9 w-auto py-0 text-sm">
            <option value="">Toda a história</option>
            {anos.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
          {(["erro", "atencao", "aviso"] as Gravidade[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGravidade(gravidade === g ? "" : g)}
              className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition ${
                gravidade === g ? "ring-brand bg-brand/10 text-brand-ink" : "ring-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {TOM[g].rotulo}: {resumo.porGravidade[g]}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {resumo.linhas} lançamento(s) · {resumo.pessoas} pessoa(s) ·{" "}
            {resumo.competencias.length ? `${compLabel(resumo.competencias[0])} a ${compLabel(resumo.competencias[resumo.competencias.length - 1])}` : "sem competência"}
          </span>
        </div>

        <div className={`flex items-start gap-3 rounded-xl border p-3 text-sm ${limpo ? "border-green-200 bg-green-50/60 text-green-800" : TOM.erro.caixa + " text-red-800"}`}>
          {limpo ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <p>
            {limpo
              ? `Varreu ${resumo.linhas} lançamento(s) e não achou nada fora do lugar.`
              : `${resumo.porGravidade.erro} erro(s), ${resumo.porGravidade.atencao} de atenção e ${resumo.porGravidade.aviso} aviso(s) em ${resumo.linhas} lançamento(s).`}
            {consertaveis.length > 0 && " Tipo e competência têm conserto automático; cadastro e vínculo são decisão sua."}
          </p>
        </div>

        {porRegra.map(([regra, lista]) => {
          const aberto = abertos.has(regra);
          const g = lista[0].gravidade;
          return (
            <div key={regra} className={`rounded-xl border ${TOM[g].caixa}`}>
              <button
                type="button"
                onClick={() => setAbertos((s) => { const n = new Set(s); if (n.has(regra)) n.delete(regra); else n.add(regra); return n; })}
                className="flex w-full items-center gap-2 px-3 py-2 text-left"
              >
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TOM[g].chip}`}>{TOM[g].rotulo}</span>
                <span className="text-sm font-semibold text-brand-ink">{ROTULO_REGRA[regra]}</span>
                <span className="text-xs text-slate-500">{lista.length}</span>
                <span className="ml-auto text-xs text-slate-500">{aberto ? "esconder" : "ver"}</span>
              </button>
              {aberto && (
                <>
                {/* COMO CORRIGIR — vem antes da lista de propósito. A auditoria
                    apontava e parava aí; quem lê não conhece a regra que gerou
                    o achado e ficava com o problema na mão, sem o caminho. */}
                {(() => {
                  const c = COMO_CORRIGIR[regra];
                  if (!c) return null;
                  return (
                    <div className="border-t border-black/5 bg-white/70 px-3 py-2.5">
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Como corrigir</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">{ROTULO_ONDE[c.onde]}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">{c.causa}</p>
                      <ol className="mt-1.5 list-decimal space-y-1 pl-4 text-xs text-slate-700 marker:text-slate-400">
                        {c.passos.map((passo) => (
                          <li key={passo}>{passo}</li>
                        ))}
                      </ol>
                      {c.onde === "automatico" && consertaveis.length > 0 && (
                        <button type="button" className="btn-outline mt-2 h-8 py-0 text-xs" onClick={() => setConfirmar(true)}>
                          <Wand2 className="h-3.5 w-3.5" /> Corrigir {consertaveis.length} automático(s)
                        </button>
                      )}
                    </div>
                  );
                })()}
                <ul className="space-y-1.5 border-t border-black/5 px-3 py-2">
                  {lista.slice(0, MOSTRAR).map((a, i) => (
                    <li key={`${a.regra}:${a.colaboradorId}:${a.pagamentoIds[0] ?? i}`} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                      <span className="font-medium text-brand-ink">{nome(a.colaboradorId)}</span>
                      <span className="text-slate-600">{a.detalhe}</span>
                      {a.valor > 0 && <span className="tabular-nums text-slate-500">{formatBRL(a.valor)}</span>}
                      {onVerPessoa && (
                        <button type="button" className="inline-flex items-center gap-1 text-xs text-brand hover:underline" onClick={() => onVerPessoa(a.colaboradorId)}>
                          <UserSearch className="h-3 w-3" /> abrir
                        </button>
                      )}
                    </li>
                  ))}
                  {lista.length > MOSTRAR && (
                    <li className="flex items-center gap-1.5 pt-1 text-xs text-slate-500">
                      <Info className="h-3 w-3" /> e mais {lista.length - MOSTRAR} — filtre por ano para ver o resto.
                    </li>
                  )}
                </ul>
                </>
              )}
            </div>
          );
        })}

        {/* CONTINUA RECEBENDO — o conserto que o dinheiro prova.
            Salário e adiantamento de competência POSTERIOR à data de saída
            provam que a pessoa não saiu: ninguém paga salário de agosto a quem
            saiu em junho. Rescisão, férias, 13º e FGTS não contam — são o
            acerto de quem saiu de verdade. */}
        {onReativar && reativaveis.length > 0 && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-brand-ink">Tem data de saída, mas continua recebendo</p>
              <span className="text-xs text-slate-600">o salário depois da data prova que não saiu — a data é que está errada</span>
              <button type="button" className="btn-primary ml-auto" onClick={() => setConfirmarReativar(true)}>
                Corrigir {reativaveis.length} cadastro(s)
              </button>
            </div>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
              {reativaveis.map((r) => (
                <li key={r.colaboradorId} className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-emerald-100/70 pt-1.5">
                  <span className="font-medium text-brand-ink">{r.nome}</span>
                  <span className="text-slate-500">
                    saída {r.de.dataDesligamento?.slice(0, 10)} → recebeu {r.verbas.join(" e ")} em {compLabel(r.mesQueProva)}
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="text-slate-500">fica como</span>
                    <Select
                      value={destino[r.colaboradorId] ?? r.para.statusId}
                      onChange={(e) => setDestino((m) => ({ ...m, [r.colaboradorId]: e.target.value }))}
                      className="h-7 w-auto py-0 text-xs"
                      aria-label={`Status de ${r.nome}`}
                    >
                      {/* O status proposto entra na lista quando não está nela
                          — é o caso de quem tem um status fora do headcount
                          (Externo, Direção) e a regra preserva o dele. Sem isto
                          o <select> mostraria a PRIMEIRA opção enquanto o
                          clique aplicava outra coisa: a tela mentindo. */}
                      {opcoesDeStatus(statusDisponiveis, destino[r.colaboradorId] ?? r.para.statusId).map((s2) => (
                        <option key={s2.id} value={s2.id}>{s2.nome}</option>
                      ))}
                    </Select>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">A data de saída é apagada e a pessoa volta ao quadro. Cada uma ganha uma linha no histórico.</p>
          </div>
        )}

        {/* ADMISSÃO ANTERIOR AO PRIMEIRO PAGAMENTO — a data proposta é o
            primeiro dia do mês mais antigo em que a pessoa recebeu. É um PISO,
            não a verdade: ela pode ter entrado no meio daquele mês. Por isso a
            tela mostra o número e pede confirmação. */}
        {onCorrigirAdmissao && admissoes.length > 0 && (
          <div className="rounded-xl border border-sky-200 bg-sky-50/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-brand-ink">Recebeu antes da data de admissão</p>
              <span className="text-xs text-slate-600">a admissão do cadastro é posterior ao primeiro pagamento</span>
              <button type="button" className="btn-primary ml-auto" onClick={() => setConfirmarAdmissao(true)}>
                Recuar {admissoes.length} admissão(ões)
              </button>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {admissoes.map((a) => (
                <li key={a.colaboradorId} className="flex flex-wrap items-baseline gap-x-2 border-t border-sky-100/70 pt-1">
                  <span className="font-medium text-brand-ink">{a.nome}</span>
                  <span className="text-slate-500">
                    {a.faltando ? "sem admissão no cadastro" : `cadastro diz ${a.de.dataAdmissao?.slice(0, 10)}`}
                    {" · recebeu em "}{compLabel(a.primeiraComp)} (vence {a.primeiroVenc})
                  </span>
                  <span className="ml-auto font-medium text-sky-800">→ {a.para.dataAdmissao}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">A data proposta é o primeiro dia do mês mais antigo com pagamento — o mais cedo que ela pode ter entrado. Ajuste na ficha se souber o dia certo.</p>
          </div>
        )}

        {onDesligar && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-brand-ink">Desligar pelo último pagamento</p>
              <span className="text-xs text-slate-500">quem não recebe desde</span>
              <Input type="month" value={ate} onChange={(e) => setAte(e.target.value)} className="h-8 w-40 py-0 text-sm" aria-label="Mês limite" />
              <span className="text-xs text-slate-500">ou antes → inativo, com a data no fim do último mês em que recebeu</span>
              <button type="button" className="btn-primary ml-auto" disabled={propostas.length === 0} onClick={() => setConfirmarDesligar(true)}>
                Desligar {propostas.length} pessoa(s)
              </button>
            </div>
            {propostas.length > 0 ? (
              <ul className="mt-2 max-h-52 overflow-y-auto text-xs text-slate-700">
                {propostas.map((p) => (
                  <li key={p.colaboradorId} className="flex flex-wrap items-baseline gap-x-2 border-t border-slate-50 py-1">
                    <span className="font-medium text-brand-ink">{p.nome}</span>
                    <span>último lançamento {compLabel(p.ultimoMes)}</span>
                    <span className="text-slate-500">
                      {p.de.statusId ?? "—"}{p.de.dataDesligamento ? ` · saída ${p.de.dataDesligamento}` : " · sem data"} → inativo · saída {p.para.dataDesligamento}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">Ninguém a desligar até {compLabel(ate)}: quem parou de receber até aí já está inativo com a data certa.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">Direção e quem não tem lançamento nenhum ficam de fora. Quem recebeu depois do limite é decisão sua, na ficha.</p>
          </div>
        )}

        {confirmarDesligar && onDesligar && (
          <ConfirmDialog
            aberto
            titulo={`Desligar ${propostas.length} pessoa(s) pelo último pagamento?`}
            mensagem={`Status vira inativo e a data de desligamento passa a ser o fim do último mês com lançamento (até ${compLabel(ate)}). Cada pessoa ganha uma linha no histórico; dá para ajustar uma a uma na ficha depois.`}
            textoConfirmar={`Desligar ${propostas.length}`}
            perigo
            onConfirmar={() => { setConfirmarDesligar(false); onDesligar(propostas); }}
            onFechar={() => setConfirmarDesligar(false)}
          />
        )}

        {confirmarReativar && onReativar && (
          <ConfirmDialog
            aberto
            titulo={`Corrigir ${reativaveis.length} cadastro(s) de quem continua recebendo?`}
            mensagem="A data de saída é apagada e a pessoa volta ao quadro com o status escolhido ao lado do nome. Elas voltam a contar no headcount e no custo do mês — que é o certo, já que estão recebendo salário."
            textoConfirmar={`Corrigir ${reativaveis.length}`}
            perigo={false}
            onConfirmar={() => {
              setConfirmarReativar(false);
              onReativar(reativaveis.map((r) => ({ colaboradorId: r.colaboradorId, nome: r.nome, statusId: destino[r.colaboradorId] ?? r.para.statusId })));
            }}
            onFechar={() => setConfirmarReativar(false)}
          />
        )}

        {confirmarAdmissao && onCorrigirAdmissao && (
          <ConfirmDialog
            aberto
            titulo={`Recuar ${admissoes.length} data(s) de admissão?`}
            mensagem="A admissão passa a ser o primeiro dia do mês mais antigo em que a pessoa recebeu. É o mais cedo que ela pode ter entrado; se souber o dia exato, ajuste na ficha depois."
            textoConfirmar={`Recuar ${admissoes.length}`}
            perigo={false}
            onConfirmar={() => { setConfirmarAdmissao(false); onCorrigirAdmissao(admissoes); }}
            onFechar={() => setConfirmarAdmissao(false)}
          />
        )}

        {confirmar && (
          <ConfirmDialog
            aberto
            titulo={`Corrigir ${consertaveis.length} lançamento(s)?`}
            mensagem={`Só o que é determinístico: ${consertaveis.filter((a) => a.conserto?.campo === "tipo").length} tipo(s) pelo nome da conta e ${consertaveis.filter((a) => a.conserto?.campo === "competencia").length} competência(s) pela regra 16→15. Cadastro e vínculo não são tocados. Fica no histórico e pode ser revisto lançamento a lançamento.`}
            textoConfirmar={`Corrigir ${consertaveis.length}`}
            perigo={false}
            onConfirmar={() => { setConfirmar(false); onCorrigir(consertaveis); }}
            onFechar={() => setConfirmar(false)}
          />
        )}
      </CardBody>
    </Card>
  );
}
