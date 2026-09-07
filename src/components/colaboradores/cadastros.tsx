import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRightLeft, CheckCircle2, CircleHelp, Copy, Search, Trash2, Users } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { Input } from "@/components/ui/form";
import { useToast } from "@/components/ui/toast";
import { useColecao, obterDinamico, atualizarEm, ehNomeColecao } from "@/lib/store";
import { emLote, registrarAcaoManual } from "@/lib/auditoria";
import { formatCPF, formatDate } from "@/lib/format";
import { idPessoa } from "@/lib/identidade";
import {
  aproximarCadastros, quemFica, avaliarExclusao, planoDeTransferencia, nomeNormalizado,
  COLECOES_DA_PESSOA, COLECOES_TRILHA, COLECOES_CONTA, COLECAO_LANCAMENTOS, CONTAGEM_VAZIA,
  type ContagemFicha, type FichaResumo, type AvaliacaoExclusao,
} from "@/lib/cadastrosDuplicados";
import type { ColecaoMap, NomeColecao } from "@/data";
import type { Colaborador } from "@/data/types";

/**
 * TODOS OS CADASTROS — e o que fazer com os repetidos.
 *
 * Pedido do Léo (07/09/2026): "ter algum local onde vê todos, onde pode ser
 * possível apagar o que deseja". Ele apontou o José Adilando e o Demerval, e
 * estava certo nos dois: eram três fichas cada um.
 *
 * A tela faz três coisas, nesta ordem de propósito:
 *   1. mostra os grupos de ficha repetida, com quantos lançamentos cada uma tem;
 *   2. oferece TRANSFERIR o que está pendurado na ficha que vai sair;
 *   3. só então apaga — e apagar custa mais quanto mais a ficha tiver dentro.
 *
 * A ordem importa porque registro pendurado numa ficha quase nunca é lixo: em
 * 29/07/2026, de 102 órfãos do RH, 16 eram dado real de gente da casa com o id
 * levemente errado. Apagar primeiro e conferir depois perde trabalho de verdade.
 */

// Quantas fichas a tabela de baixo mostra sem pedir busca (são 93 hoje).
const MOSTRAR = 120;

/** O patch é sempre o mesmo campo; o cast serve só ao nome dinâmico da coleção. */
type PatchDono = Partial<ColecaoMap[NomeColecao]>;

type Pendurado = { id: string; colaboradorId?: string | null; competencia?: string | null };

const foraDoQuadro = (c: FichaResumo) => c.statusId === "inativo" || !!c.dataDesligamento;

/** Lê de uma vez tudo que está pendurado em cada pessoa. */
function contarTudo(colaboradores: Colaborador[]): Map<string, ContagemFicha> {
  const mapa = new Map<string, ContagemFicha>(colaboradores.map((c) => [c.id, { ...CONTAGEM_VAZIA }]));
  const somar = (colecoes: readonly string[], campo: "lancamentos" | "dados" | "trilha" | "contas") => {
    for (const nome of colecoes) {
      for (const r of obterDinamico(nome)) {
        const dono = (r as { colaboradorId?: string | null }).colaboradorId;
        const alvo = dono ? mapa.get(dono) : undefined;
        if (alvo) alvo[campo] += 1;
      }
    }
  };
  somar([COLECAO_LANCAMENTOS], "lancamentos");
  somar(COLECOES_DA_PESSOA.filter((c) => c !== COLECAO_LANCAMENTOS), "dados");
  somar(COLECOES_TRILHA, "trilha");
  somar(COLECOES_CONTA, "contas");
  for (const c of colaboradores) {
    if (c.gestorId) { const g = mapa.get(c.gestorId); if (g) g.subordinados += 1; }
    if (c.padrinhoId) { const p = mapa.get(c.padrinhoId); if (p) p.afilhados += 1; }
  }
  return mapa;
}

/** O retrato do que está pendurado, no formato que o plano de transferência lê. */
function lerPendurados(): Record<string, Pendurado[]> {
  const r: Record<string, Pendurado[]> = {};
  for (const nome of [...COLECOES_DA_PESSOA, ...COLECOES_TRILHA, ...COLECOES_CONTA]) {
    r[nome] = obterDinamico(nome) as unknown as Pendurado[];
  }
  return r;
}

function Numero({ valor, forte }: { valor: number; forte?: boolean }) {
  if (valor === 0) return <span className="tabular-nums text-slate-300">0</span>;
  return <span className={forte ? "tabular-nums font-semibold text-brand-ink" : "tabular-nums text-slate-600"}>{valor}</span>;
}

function CabecalhoTabela() {
  return (
    <thead className="border-b border-slate-100 bg-slate-50/60">
      <tr>
        <th className="th">Cadastro</th>
        <th className="th">CPF</th>
        <th className="th">Situação</th>
        <th className="th">Admissão</th>
        <th className="th">Saída</th>
        <th className="th text-right">Lanç.</th>
        <th className="th text-right">Outros</th>
        <th className="th text-right">Trilha</th>
        <th className="th text-right">Ações</th>
      </tr>
    </thead>
  );
}

function LinhaFicha({
  ficha, contagem, fica, nomeStatus, onApagar, onTransferir, onAbrir,
}: {
  ficha: FichaResumo;
  contagem: ContagemFicha;
  /** Esta é a ficha que a regra sugere manter? `null` = tabela sem sugestão. */
  fica: boolean | null;
  nomeStatus: (id?: string | null) => string;
  onApagar?: () => void;
  onTransferir?: () => void;
  onAbrir?: () => void;
}) {
  const tem = contagem.lancamentos + contagem.dados;
  return (
    <tr className={fica ? "bg-emerald-50/40" : undefined}>
      <td className="td">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-brand-ink">{ficha.nome}</span>
          {fica && <Badge variant="success">manter</Badge>}
          {foraDoQuadro(ficha) && <Badge variant="neutral">fora do quadro</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px] text-slate-600">{ficha.id}</code>
          {ficha.apelido && <span>login {ficha.apelido}</span>}
          {idPessoa(ficha.cpf) && <span>ID {idPessoa(ficha.cpf)}</span>}
        </div>
      </td>
      <td className="td whitespace-nowrap text-xs text-slate-600">{formatCPF(ficha.cpf)}</td>
      <td className="td whitespace-nowrap text-xs text-slate-600">{nomeStatus(ficha.statusId)}</td>
      <td className="td whitespace-nowrap text-xs text-slate-600">{ficha.dataAdmissao ? formatDate(ficha.dataAdmissao) : "—"}</td>
      <td className="td whitespace-nowrap text-xs text-slate-600">{ficha.dataDesligamento ? formatDate(ficha.dataDesligamento) : "—"}</td>
      <td className="td text-right"><Numero valor={contagem.lancamentos} forte /></td>
      <td className="td text-right"><Numero valor={contagem.dados} /></td>
      <td className="td text-right"><Numero valor={contagem.trilha} /></td>
      <td className="td">
        <div className="flex items-center justify-end gap-1">
          {onAbrir && (
            <button type="button" className="btn-ghost h-8 px-2 py-0 text-xs" onClick={onAbrir}>ficha</button>
          )}
          {onTransferir && tem > 0 && (
            <button type="button" className="btn-outline h-8 px-2 py-0 text-xs" onClick={onTransferir}>
              <ArrowRightLeft className="h-3.5 w-3.5" /> transferir
            </button>
          )}
          {onApagar && (
            <button type="button" className="btn-ghost h-8 px-2 py-0 text-xs text-red-600 hover:bg-red-50" onClick={onApagar}>
              <Trash2 className="h-3.5 w-3.5" /> apagar
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function CadastrosSecao({ onAbrirFicha }: { onAbrirFicha?: (id: string) => void }) {
  const { items: colaboradores, remover } = useColecao("colaboradores");
  // Reativas de propósito: são as coleções que mudam os números desta tela.
  const { items: pagamentos } = useColecao("pagamentos");
  const { items: status } = useColecao("status");
  const toast = useToast();

  const [busca, setBusca] = useState("");
  const [versao, setVersao] = useState(0);
  const [apagando, setApagando] = useState<{ ficha: FichaResumo; contagem: ContagemFicha; avaliacao: AvaliacaoExclusao; destino: FichaResumo | null } | null>(null);
  const [digitado, setDigitado] = useState("");
  const [conferido, setConferido] = useState(false);
  const [transferindo, setTransferindo] = useState<{ de: FichaResumo; para: FichaResumo } | null>(null);

  const nomeStatus = (id?: string | null) => status.find((s) => s.id === id)?.nome ?? (id || "—");

  const contagens = useMemo(
    () => contarTudo(colaboradores as Colaborador[]),
    // `pagamentos` e `versao` entram para a contagem refazer quando o dinheiro
    // muda e quando esta tela grava; as outras coleções são lidas direto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [colaboradores, pagamentos, versao],
  );
  const contar = (id: string): ContagemFicha => contagens.get(id) ?? { ...CONTAGEM_VAZIA };

  const { grupos, conferir } = useMemo(() => aproximarCadastros(colaboradores as FichaResumo[]), [colaboradores]);

  const visiveis = useMemo(() => {
    const cru = busca.trim().toLowerCase();
    const alvo = nomeNormalizado(busca);
    const digitos = cru.replace(/\D/g, "");
    const lista = (colaboradores as FichaResumo[]).filter((c) => {
      if (!cru) return true;
      if (alvo && nomeNormalizado(c.nome).includes(alvo)) return true;
      if (c.id.toLowerCase().includes(cru)) return true;
      if (String(c.apelido ?? "").toLowerCase().includes(cru)) return true;
      return !!digitos && String(c.cpf ?? "").replace(/\D/g, "").includes(digitos);
    });
    return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [colaboradores, busca]);

  const abrirExclusao = (ficha: FichaResumo, destino: FichaResumo | null) => {
    // Reconta AGORA: a lista pode ter sido montada há minutos, e o que decide
    // se apagar é barato ou caro é o estado do momento da decisão.
    const c = contarTudo(colaboradores as Colaborador[]).get(ficha.id) ?? { ...CONTAGEM_VAZIA };
    setDigitado("");
    setConferido(false);
    setApagando({ ficha, contagem: c, avaliacao: avaliarExclusao(c, !!destino), destino });
  };

  const confirmarExclusao = () => {
    if (!apagando) return;
    const { ficha, contagem, destino } = apagando;
    // FREIO: lê antes de escrever. Se a ficha ganhou conteúdo (ou impedimento)
    // depois que o aviso abriu, não apaga — refaz a conta e mostra de novo.
    const agora = contarTudo(colaboradores as Colaborador[]).get(ficha.id) ?? { ...CONTAGEM_VAZIA };
    const avaliacao = avaliarExclusao(agora, !!destino);
    const cresceu = agora.lancamentos > contagem.lancamentos || agora.dados > contagem.dados;
    if (cresceu || avaliacao.bloqueios.length > 0) {
      setApagando({ ficha, contagem: agora, avaliacao, destino });
      setDigitado("");
      setConferido(false);
      toast("A ficha mudou desde que este aviso abriu. Confira os números de novo.", "erro");
      return;
    }
    remover(ficha.id);
    registrarAcaoManual(
      `Apagou a ficha repetida ${ficha.id}${agora.trilha > 0 ? ` (${agora.trilha} linha(s) de trilha ficaram)` : ""}`,
      ficha.nome,
      "colaboradores",
    );
    setApagando(null);
    setVersao((v) => v + 1);
    toast(`Ficha ${ficha.id} apagada.`, "sucesso");
  };

  const confirmarTransferencia = () => {
    if (!transferindo) return;
    const { de, para } = transferindo;
    const plano = planoDeTransferencia(de.id, para.id, lerPendurados());
    if (plano.total === 0) {
      setTransferindo(null);
      toast("Não havia nada para transferir.", "info");
      return;
    }
    emLote(`Passou ${plano.total} registro(s) de ${de.nome} (${de.id}) para ${para.id}`, () => {
      for (const m of plano.mover) {
        if (!ehNomeColecao(m.colecao)) continue;
        for (const id of m.ids) atualizarEm(m.colecao, id, { colaboradorId: para.id } as PatchDono);
      }
    });
    registrarAcaoManual(`Transferiu ${plano.total} registro(s) de ${de.id} para ${para.id}`, de.nome, "colaboradores");
    setTransferindo(null);
    setVersao((v) => v + 1);
    toast(
      plano.conflitos.length > 0
        ? `${plano.total} registro(s) transferido(s). ${plano.conflitos.length} ficaram: o destino já tem o mesmo mês.`
        : `${plano.total} registro(s) transferido(s) para ${para.nome}.`,
      plano.conflitos.length > 0 ? "info" : "sucesso",
    );
  };

  const planoPrevisto = transferindo ? planoDeTransferencia(transferindo.de.id, transferindo.para.id, lerPendurados()) : null;

  const podeApagar = (() => {
    if (!apagando) return false;
    const { avaliacao, ficha } = apagando;
    if (avaliacao.bloqueios.length > 0) return false;
    if (avaliacao.exigencia === "digitar-id") return digitado.trim() === ficha.id;
    if (avaliacao.exigencia === "conferir") return conferido;
    return true;
  })();

  return (
    <div className="space-y-4">
      <Card idPersistencia="cadastros:repetidos">
        <CardHeader
          title="Fichas repetidas"
          subtitle="A mesma pessoa cadastrada mais de uma vez. Fica a que tem os lançamentos; o que estiver pendurado na outra pode ser transferido antes de apagar."
          icon={<Copy className="h-5 w-5" />}
        />
        <CardBody className="space-y-4">
          {grupos.length === 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50/60 p-3 text-sm text-green-800">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Varreu {colaboradores.length} cadastro(s) e não achou nenhuma pessoa cadastrada duas vezes.</p>
            </div>
          ) : (
            grupos.map((g) => {
              const escolha = quemFica(g.fichas, contar);
              const daVez = escolha ? g.fichas.find((f) => f.id === escolha.id) ?? null : null;
              return (
                <div key={g.chave} className="rounded-xl border border-amber-200 bg-amber-50/40">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-3 pt-3">
                    <p className="text-sm font-semibold text-brand-ink">{g.fichas[0].nome}</p>
                    <span className="text-xs text-slate-600">{g.fichas.length} fichas</span>
                    {escolha && (
                      <span className={`ml-auto text-xs ${escolha.provada ? "text-emerald-800" : "text-amber-800"}`}>
                        fica <strong>{escolha.id}</strong> — {escolha.motivo}
                      </span>
                    )}
                  </div>
                  {escolha?.disputa && (
                    <p className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-800">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Mais de uma ficha tem lançamento. Transfira o que está na que vai sair antes de apagar qualquer coisa.
                    </p>
                  )}
                  <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[62rem]">
                      <CabecalhoTabela />
                      <tbody className="divide-y divide-black/5">
                        {g.fichas.map((f) => (
                          <LinhaFicha
                            key={f.id}
                            ficha={f}
                            contagem={contar(f.id)}
                            fica={escolha ? f.id === escolha.id : null}
                            nomeStatus={nomeStatus}
                            onAbrir={onAbrirFicha ? () => onAbrirFicha(f.id) : undefined}
                            onTransferir={daVez && f.id !== daVez.id ? () => setTransferindo({ de: f, para: daVez }) : undefined}
                            onApagar={escolha && f.id === escolha.id ? undefined : () => abrirExclusao(f, daVez)}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <ul className="space-y-0.5 px-3 pb-3 pt-2 text-[11px] text-slate-500">
                    {g.motivos.map((m) => <li key={m}>{m}</li>)}
                  </ul>
                </div>
              );
            })
          )}

          {conferir.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-ink">
                  <CircleHelp className="h-4 w-4 text-slate-400" /> Parecidos — confira você
                </p>
                <span className="text-xs text-slate-500">
                  aqui a tela NÃO afirma nada: são nomes próximos que tanto podem ser a mesma pessoa quanto duas.
                </span>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {conferir.map((p) => (
                  <li key={p.chave} className="flex flex-wrap items-baseline gap-x-2 border-t border-slate-50 pt-1">
                    <span className="font-medium text-brand-ink">{p.a.nome}</span>
                    <span className="text-slate-400">e</span>
                    <span className="font-medium text-brand-ink">{p.b.nome}</span>
                    <span className="text-slate-500">{p.motivo}</span>
                    <span className="ml-auto tabular-nums text-slate-500">
                      {contar(p.a.id).lancamentos} e {contar(p.b.id).lancamentos} lanç.
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>

      <Card idPersistencia="cadastros:todos">
        <CardHeader
          title="Todos os cadastros"
          subtitle="Ativos e inativos, do jeito que estão no banco — com o que cada ficha tem pendurado."
          icon={<Users className="h-5 w-5" />}
          action={
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="nome, id, login ou CPF"
                className="h-9 w-56 py-0 pl-9 text-sm"
                aria-label="Buscar cadastro"
              />
            </div>
          }
        />
        <CardBody>
          {visiveis.length === 0 ? (
            <EmptyState
              title="Nenhum cadastro com esse texto."
              description="A busca ignora acento e maiúscula, e também procura pelo id, pelo login e pelo CPF."
              icon={<Search className="h-8 w-8" />}
            />
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">
                {visiveis.length} de {colaboradores.length} cadastro(s). <strong>Lanç.</strong> é a folha;{" "}
                <strong>Outros</strong> são documentos, férias, avaliações e afins; <strong>Trilha</strong> é acesso e
                histórico — não se transfere e não impede apagar.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[62rem]">
                  <CabecalhoTabela />
                  <tbody className="divide-y divide-slate-50">
                    {visiveis.slice(0, MOSTRAR).map((f) => (
                      <LinhaFicha
                        key={f.id}
                        ficha={f}
                        contagem={contar(f.id)}
                        fica={null}
                        nomeStatus={nomeStatus}
                        onAbrir={onAbrirFicha ? () => onAbrirFicha(f.id) : undefined}
                        onApagar={() => abrirExclusao(f, null)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
              {visiveis.length > MOSTRAR && (
                <p className="mt-2 text-xs text-slate-500">e mais {visiveis.length - MOSTRAR} — use a busca.</p>
              )}
            </>
          )}
        </CardBody>
      </Card>

      {apagando && (
        <Modal
          aberto
          onFechar={() => setApagando(null)}
          largura="max-w-xl"
          titulo={`Apagar a ficha de ${apagando.ficha.nome}?`}
          descricao={`id ${apagando.ficha.id} · ${formatCPF(apagando.ficha.cpf)}`}
          rodape={
            <>
              <button type="button" className="btn-outline" onClick={() => setApagando(null)}>Cancelar</button>
              {apagando.destino && apagando.contagem.lancamentos + apagando.contagem.dados > 0 && (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    const alvo = apagando;
                    setApagando(null);
                    if (alvo.destino) setTransferindo({ de: alvo.ficha, para: alvo.destino });
                  }}
                >
                  <ArrowRightLeft className="h-4 w-4" /> Transferir antes
                </button>
              )}
              <button type="button" className="btn-danger" disabled={!podeApagar} onClick={confirmarExclusao}>
                Apagar de vez
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            {apagando.avaliacao.bloqueios.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-red-800">
                  <AlertTriangle className="h-4 w-4" /> Não dá para apagar ainda
                </p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-red-800">
                  {apagando.avaliacao.bloqueios.map((b) => <li key={b}>{b}</li>)}
                </ul>
              </div>
            )}

            {apagando.avaliacao.perde.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-sm font-semibold text-amber-900">Some junto com a ficha:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-900">
                  {apagando.avaliacao.perde.map((p) => <li key={p}>{p}</li>)}
                </ul>
                <p className="mt-2 text-xs text-amber-900">
                  {apagando.destino ? (
                    <>
                      Isto é trabalho de verdade. O caminho normal é{" "}
                      <strong>transferir para {apagando.destino.nome} ({apagando.destino.id})</strong> e só depois
                      apagar a ficha vazia.
                    </>
                  ) : (
                    <>Não há outra ficha desta pessoa para receber. Apagar aqui perde o registro para sempre.</>
                  )}
                </p>
              </div>
            ) : (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Esta ficha não tem lançamento nem registro de pessoa — nada de trabalho se perde ao apagá-la.
              </p>
            )}

            {apagando.avaliacao.fica.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-xs text-slate-500">
                {apagando.avaliacao.fica.map((f) => <li key={f}>{f}</li>)}
              </ul>
            )}

            <p className="text-xs text-slate-500">
              Apagar não tem volta: o id fica marcado como excluído na nuvem e não volta a ser usado.
            </p>

            {apagando.avaliacao.bloqueios.length === 0 && apagando.avaliacao.exigencia === "conferir" && (
              <label className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
                <input type="checkbox" checked={conferido} onChange={(e) => setConferido(e.target.checked)} className="mt-0.5" />
                <span>Li a lista acima e quero apagar mesmo assim.</span>
              </label>
            )}

            {apagando.avaliacao.bloqueios.length === 0 && apagando.avaliacao.exigencia === "digitar-id" && (
              <div className="rounded-xl border border-red-200 bg-red-50/60 p-3">
                <p className="text-xs text-red-900">
                  Esta ficha tem dinheiro lançado. Para apagar, digite o id dela — é o id, e não o nome, que distingue
                  uma ficha da outra quando o nome se repete.
                </p>
                <code className="mt-1.5 block select-all rounded bg-white px-2 py-1 text-xs text-slate-700">{apagando.ficha.id}</code>
                <Input
                  value={digitado}
                  onChange={(e) => setDigitado(e.target.value)}
                  placeholder="digite o id acima"
                  className="mt-2 h-9 py-0 text-sm"
                  aria-label="Confirme o id da ficha"
                />
              </div>
            )}
          </div>
        </Modal>
      )}

      {transferindo && planoPrevisto && (
        <Modal
          aberto
          onFechar={() => setTransferindo(null)}
          largura="max-w-xl"
          titulo="Transferir o que está pendurado"
          descricao={`de ${transferindo.de.id} para ${transferindo.para.id}`}
          rodape={
            <>
              <button type="button" className="btn-outline" onClick={() => setTransferindo(null)}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={planoPrevisto.total === 0} onClick={confirmarTransferencia}>
                Transferir {planoPrevisto.total}
              </button>
            </>
          }
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p className="text-xs text-slate-600">
              Cada registro passa a apontar para <strong>{transferindo.para.nome}</strong>. Nada é apagado e nada é
              criado — só muda o dono. Depois disso a ficha de origem fica vazia e pode ser apagada com um clique.
            </p>

            {planoPrevisto.total === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                Não há nada para transferir nesta ficha.
              </p>
            ) : (
              <ul className="divide-y divide-slate-50 rounded-xl border border-slate-200">
                {planoPrevisto.mover.map((m) => (
                  <li key={m.colecao} className="flex items-baseline justify-between px-3 py-1.5 text-xs">
                    <span className="text-slate-700">{m.colecao}</span>
                    <span className="tabular-nums font-medium text-brand-ink">{m.ids.length}</span>
                  </li>
                ))}
              </ul>
            )}

            {planoPrevisto.conflitos.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <p className="text-xs font-semibold text-amber-900">{planoPrevisto.conflitos.length} ficam onde estão:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs text-amber-900">
                  {planoPrevisto.conflitos.map((c) => <li key={`${c.colecao}:${c.id}`}>{c.motivo}</li>)}
                </ul>
                <p className="mt-1 text-[11px] text-amber-900">
                  Mover criaria o mesmo mês duas vezes para a mesma pessoa. Confira esses na tela do mês.
                </p>
              </div>
            )}

            {planoPrevisto.ficam.length > 0 && (
              <p className="text-[11px] text-slate-500">
                Não mudam de dono: {planoPrevisto.ficam.map((f) => `${f.quantidade} em ${f.colecao}`).join(", ")}.
                Trilha é testemunho do que aconteceu, e conta de acesso não se herda.
              </p>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
