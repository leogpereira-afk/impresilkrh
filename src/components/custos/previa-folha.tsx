import { type ReactNode } from "react";
import { AlertTriangle, ShieldAlert, Info, Coins, Lock } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Pessoa } from "@/components/ui/pessoa";
import { formatBRL } from "@/lib/format";
import { compLabel, compLabelLongo } from "@/lib/custos";
import { corDoTipo } from "@/lib/folha";
import { NATUREZAS_SILENCIOSAS, chaveDoAlarme, type GrupoAlterado, type Natureza, type ResumoDaPrevia } from "@/lib/previaFolha";
import type { Mudanca } from "@/lib/custos";
import type { Pagamento } from "@/data/types";
import type { SugestaoSalario } from "@/lib/mubiPagamentos";
import { cn } from "@/lib/cn";

const ROTULO: Record<Natureza, string> = {
  valor: "Valor muda",
  pessoa: "Trocam de pessoa",
  mes: "Trocam de mês",
  tipo: "Trocam de tipo",
  data: "Vencimento muda",
  status: "Estado do título muda",
  texto: "Só o texto da descrição muda",
  conta: "Conta do plano muda",
  renumeracao: "Conta renumerada pelo contador (só o código; nada de dinheiro)",
  adocao: "Ganham o id do ERP (eram de planilha)",
};
const ROTULO_CAMPO: Record<Mudanca["campo"], string> = {
  valor: "valor", pessoa: "pessoa", mes: "mês", tipo: "tipo", data: "vencimento", status: "estado", texto: "texto", conta: "conta", adocao: "id do ERP",
};
const pct = (p: number | null) => (p == null ? "" : `${p > 0 ? "+" : ""}${(p * 100).toFixed(1).replace(".", ",")}%`);
const sinal = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatBRL(Math.abs(v))}`;
const ddmm = (iso: string) => (/^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10).split("-").reverse().join("/") : iso);

export interface CoberturaBusca { truncado: boolean; pedidas: string[]; lidas: string[]; falhas: string[] }

/**
 * A prévia da importação da folha — a tela que grava centenas de linhas de uma
 * vez, e que por isso tem de dizer TUDO antes: quanto cada mês muda em reais,
 * o que muda em cada linha (campo a campo, de → para), o que pede confirmação
 * e o que está bloqueado. Nada aqui grava: quem grava é quem chama `onAplicar`.
 */
export function PreviaFolha({
  resumo,
  iguais,
  cobertura,
  nomeDe,
  ausentesMarcados,
  onMarcarAusente,
  onMarcarBloco,
  confirmados,
  onConfirmar,
  salarios,
  salariosMarcados,
  onMarcarSalario,
  cpfs,
  extras,
  excluidos,
  onExcluir,
  onExcluirBloco,
  onAplicar,
  onCancelar,
}: {
  resumo: ResumoDaPrevia;
  iguais: number;
  cobertura?: CoberturaBusca;
  nomeDe: (colaboradorId: string) => string;
  ausentesMarcados: Set<string>;
  onMarcarAusente: (id: string, marcado: boolean) => void;
  onMarcarBloco: (ids: string[], marcado: boolean) => void;
  /** Chaves de alarme já conferidas — ver chaveDoAlarme (conteúdo, não só o tipo). */
  confirmados: Set<string>;
  onConfirmar: (chave: string, ok: boolean) => void;
  salarios: SugestaoSalario[];
  salariosMarcados: Set<string>;
  onMarcarSalario: (colaboradorId: string) => void;
  cpfs: { colaboradorId: string; cpf: string }[];
  extras?: ReactNode;
  /** Ids desmarcados: continuam na lista, fora de todas as contas. */
  excluidos: Set<string>;
  onExcluir: (id: string, fora: boolean) => void;
  onExcluirBloco: (ids: string[], fora: boolean) => void;
  onAplicar: () => void;
  onCancelar: () => void;
}) {
  // Confere por conteúdo: marcar mais remoções, vincular alguém ou mudar de
  // valor gera outra chave e a caixa volta a pedir conferência.
  const faltaConfirmar = resumo.precisaConfirmar.filter((a) => !confirmados.has(chaveDoAlarme(a)));
  // CPF sozinho também é trabalho a fazer: sem ele a tela prometia preencher
  // N cadastros com o botão escrito "Nada a alterar" e desabilitado.
  const nadaAFazer = resumo.contaNoBotao + resumo.silenciosos + salariosMarcados.size + cpfs.length === 0;
  const podeAplicar = resumo.podeAplicar && faltaConfirmar.length === 0 && !nadaAFazer;
  const bloqueios = resumo.alarmes.filter((a) => a.nivel === "bloqueia");
  const avisos = resumo.alarmes.filter((a) => a.nivel === "avisa");
  const varios = resumo.porMes.length > 1;
  const idsForaDoQuadro = new Set(resumo.alarmes.filter((a) => a.id === "fora-do-quadro" && a.nivel === "confirma").flatMap((a) => a.ids));

  // TUDO o que dá para aceitar ou rejeitar, num lugar só — alterações e novos.
  // Sem isto, quem queria aceitar meia dúzia tinha de desmarcar as outras
  // ~160 uma a uma, e por isso a tela parecia só aceitar "tudo ou nada".
  const idsEscolhiveis = [
    ...resumo.grupos.flatMap((g) => g.itens.map((i) => i.antigo.id)),
    ...resumo.novos.map((n) => n.id),
  ];
  const escolhidos = idsEscolhiveis.filter((id) => !excluidos.has(id)).length;
  const novosFora = resumo.novos.filter((n) => excluidos.has(n.id)).length;

  const soCpf = resumo.contaNoBotao + resumo.silenciosos + salariosMarcados.size === 0 && cpfs.length > 0;
  const rotuloBotao = nadaAFazer
    ? "Nada a alterar"
    : soCpf
    ? `Preencher ${cpfs.length} CPF(s)`
    : `Aplicar ${resumo.contaNoBotao} alteração(ões)` +
      (resumo.silenciosos ? ` · ${resumo.silenciosos} só de texto/conta/id` : "") +
      (salariosMarcados.size ? ` · ${salariosMarcados.size} salário(s)` : "") +
      (cpfs.length ? ` · ${cpfs.length} CPF(s)` : "");

  return (
    <Modal
      aberto
      onFechar={onCancelar}
      titulo="Conferir importação da folha"
      descricao="Cada mês em reais, cada linha campo a campo. Nada é gravado até você aplicar — e o que for aplicado pode ser desfeito."
      largura="max-w-3xl"
      rodape={<>
        <button className="btn-outline" onClick={onCancelar}>Cancelar</button>
        <button className="btn-primary" onClick={onAplicar} disabled={!podeAplicar} title={
          !resumo.podeAplicar ? "Há um bloqueio acima — resolva antes."
            : faltaConfirmar.length ? `Confira os ${faltaConfirmar.length} aviso(s) marcados como "conferi" antes de aplicar.`
            : undefined
        }>
          <Coins className="h-4 w-4" /> {rotuloBotao}
        </button>
      </>}
    >
      <div className="space-y-3">
        {/* Cobertura da busca */}
        {cobertura && (
          <p className="text-xs text-slate-500">
            {cobertura.pedidas.length > 1
              ? `Busca de ${cobertura.pedidas.length} meses (${compLabel(cobertura.pedidas[cobertura.pedidas.length - 1])} → ${compLabel(cobertura.pedidas[0])})`
              : `Busca de ${compLabelLongo(cobertura.pedidas[0] ?? "")}`}
            {" · "}{cobertura.lidas.length} lido(s)
            {cobertura.falhas.length ? ` · ${cobertura.falhas.length} falhou (${cobertura.falhas.map(compLabel).join(", ")})` : ""}
            {cobertura.truncado ? " · veio cortada" : " · completa"}
          </p>
        )}

        {/* A frase de dinheiro */}
        <div className="rounded-2xl bg-brand-ink px-4 py-3 text-white">
          <p className="text-xs font-medium uppercase tracking-wide text-white/70">Pago à equipe nos meses da busca</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">
            {formatBRL(resumo.totalHoje)} <span className="text-white/60">→</span> {formatBRL(resumo.totalDepois)}
            <span className={cn("ml-2 text-sm", resumo.delta > 0 ? "text-amber-200" : resumo.delta < 0 ? "text-sky-200" : "text-white/70")}>
              {resumo.delta === 0 ? "sem mudança de valor" : `${sinal(resumo.delta)}${resumo.totalHoje > 0 ? ` (${pct(resumo.delta / resumo.totalHoje)})` : ""}`}
            </span>
          </p>
          <p className="mt-0.5 text-[11px] text-white/60">Sem FGTS/INSS e sem sócio — a mesma régua do topo da tela.</p>
        </div>

        {/* Bloqueios e confirmações */}
        {bloqueios.map((a) => (
          <div key={a.id + a.titulo} className="rounded-xl border border-red-300 bg-red-50 p-3">
            <p className="flex items-center gap-2 text-xs font-semibold text-red-900"><ShieldAlert className="h-4 w-4" /> Bloqueado: {a.titulo}</p>
            <p className="mt-1 text-[11px] text-red-800/90">{a.detalhe}{a.valor ? ` · ${formatBRL(a.valor)}` : ""}</p>
          </div>
        ))}
        {resumo.precisaConfirmar.map((a) => (
          <label key={a.id + a.titulo} className={cn("flex cursor-pointer items-start gap-2.5 rounded-xl border p-3", confirmados.has(chaveDoAlarme(a)) ? "border-amber-200 bg-amber-50/40" : "border-amber-300 bg-amber-50")}>
            <input type="checkbox" className="mt-0.5" checked={confirmados.has(chaveDoAlarme(a))} onChange={(e) => onConfirmar(chaveDoAlarme(a), e.target.checked)} aria-label={`Conferi: ${a.titulo}`} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-xs font-semibold text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" /> {a.titulo}{a.valor ? <span className="font-normal text-amber-800/80">· {formatBRL(a.valor)}</span> : null}</span>
              <span className="mt-0.5 block text-[11px] text-amber-800/90">{a.detalhe}</span>
              <span className="mt-0.5 block text-[11px] font-medium text-amber-900">{confirmados.has(chaveDoAlarme(a)) ? "Conferido." : "Marque para confirmar que conferiu."}</span>
            </span>
          </label>
        ))}
        {avisos.map((a) => (
          <p key={a.id + a.titulo} className="flex items-start gap-2 text-[11px] text-slate-500"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> <span><strong className="font-medium text-slate-600">{a.titulo}.</strong> {a.detalhe}</span></p>
        ))}

        {/* Por mês */}
        {varios && (
          <div className="overflow-x-auto rounded-xl border border-slate-200/70">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/50">
                <tr><th className="th">Mês</th><th className="th text-right">Hoje</th><th className="th text-right">Depois</th><th className="th text-right">Diferença</th><th className="th text-right">Linhas</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumo.porMes.map((m) => (
                  <tr key={m.competencia} className={Math.abs(m.delta) > 0.005 ? (m.fechada ? "bg-amber-50/40" : "bg-blue-50/30") : undefined}>
                    <td className="td">
                      <span className="flex items-center gap-1.5">{compLabelLongo(m.competencia)}{m.fechada && <Lock className="h-3 w-3 text-slate-400" aria-label="mês fechado" />}</span>
                    </td>
                    <td className="td text-right tabular-nums text-slate-500">{formatBRL(m.hoje)}</td>
                    <td className="td text-right font-medium tabular-nums text-slate-800">{formatBRL(m.depois)}</td>
                    <td className={cn("td text-right text-xs tabular-nums", m.delta > 0 ? "text-amber-700" : m.delta < 0 ? "text-sky-700" : "text-slate-400")}>
                      {Math.abs(m.delta) < 0.005 ? "igual" : `${sinal(m.delta)} ${pct(m.pct)}`}
                    </td>
                    <td className="td text-right text-xs tabular-nums text-slate-500">{m.mexe || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Placar */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Placar n={iguais} rotulo="iguais" tom="text-slate-600" borda="border-slate-200 bg-slate-50/60" />
          <Placar n={resumo.grupos.reduce((s, g) => s + g.itens.length, 0)} rotulo="alteradas" tom="text-blue-700" borda="border-blue-200 bg-blue-50/60"
            sub={resumo.grupos.map((g) => `${g.itens.length} ${g.natureza === "renumeracao" ? "conta" : ROTULO_CAMPO[g.natureza as Mudanca["campo"]] ?? g.natureza}`).join(" · ")} />
          <Placar n={resumo.novos.length} rotulo="novas" tom="text-green-700" borda="border-green-200 bg-green-50/60" sub={formatBRL(resumo.novos.reduce((s, p) => s + (Number(p.valor) || 0), 0))} />
          <Placar n={resumo.ausentes.comIdErp.length + resumo.ausentes.semId.length + resumo.ausentes.semDono.length + resumo.ausentes.foraDaFolha.length} rotulo="não vieram" tom="text-amber-700" borda="border-amber-200 bg-amber-50/60"
            sub={[resumo.ausentes.comIdErp.length ? `${resumo.ausentes.comIdErp.length} do ERP` : "", resumo.ausentes.semId.length ? `${resumo.ausentes.semId.length} de planilha` : "", resumo.ausentes.semDono.length ? `${resumo.ausentes.semDono.length} sem dono` : "", resumo.ausentes.foraDaFolha.length ? `${resumo.ausentes.foraDaFolha.length} fora da lista` : ""].filter(Boolean).join(" · ")} />
        </div>

        {/* Salários */}
        {salarios.length > 0 && (
          <div className="rounded-xl border border-gold-200">
            <p className="border-b border-gold-100 bg-gold-50/50 px-3 py-1.5 text-xs font-semibold text-gold-700">Sem salário no cadastro · {salarios.length} pessoa(s)</p>
            <p className="px-3 py-1.5 text-[11px] text-slate-500">
              Valor <b>pago</b> na competência (Salário + Adiantamento) — é o líquido, já sem INSS, IRRF e vale-transporte. Use como <b>ponto de partida</b> e ajuste na ficha se o contrato for outro. Nada é aplicado sem marcar.
            </p>
            <div className="max-h-48 overflow-y-auto">
              <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
                {salarios.map((sug) => {
                  const marcado = salariosMarcados.has(sug.colaborador.id);
                  return (
                    <tr key={sug.colaborador.id} className={marcado ? "bg-gold-50/40" : undefined}>
                      <td className="td w-8"><input type="checkbox" checked={marcado} disabled={!sug.completo} onChange={() => onMarcarSalario(sug.colaborador.id)} aria-label={`Preencher o salário de ${sug.colaborador.nome}`} /></td>
                      <td className="td font-medium text-slate-700">{sug.colaborador.nome}</td>
                      <td className="td text-slate-400">{compLabel(sug.competencia)}{!sug.completo && <span className="ml-1 text-red-600">· mês incompleto</span>}</td>
                      <td className="td text-right font-semibold tabular-nums text-gold-700">{formatBRL(sug.sugerido)}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            </div>
          </div>
        )}

        {/* CPFs que serão preenchidos — antes era invisível */}
        {cpfs.length > 0 && (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            <strong className="text-slate-700">CPF será preenchido em {cpfs.length} cadastro(s)</strong> a partir do ERP (só onde estava vazio): {cpfs.map((c) => nomeDe(c.colaboradorId)).join(", ")}. O próximo mês casa pela chave forte.
          </p>
        )}

        {/* Alterados, por natureza — cada linha diz o que mudou */}
        {/* ACEITAR ALGUMAS, REJEITAR OUTRAS.
            Tudo vem marcado (a folha do mês são ~140 linhas certas e meia dúzia
            duvidosas), mas quem quer o contrário — aceitar poucas — precisa
            começar do zero. "Nenhuma" existe para isso. */}
        {idsEscolhiveis.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs">
            <span className="font-semibold text-slate-700">
              {escolhidos} de {idsEscolhiveis.length} marcadas para aplicar
            </span>
            {escolhidos < idsEscolhiveis.length && (
              <span className="text-slate-500">· {idsEscolhiveis.length - escolhidos} rejeitada(s)</span>
            )}
            <span className="ml-auto flex gap-1.5">
              <button
                type="button"
                className="btn-outline h-7 px-2 py-0 text-xs"
                disabled={escolhidos === idsEscolhiveis.length}
                onClick={() => onExcluirBloco(idsEscolhiveis, false)}
              >
                Marcar todas
              </button>
              <button
                type="button"
                className="btn-outline h-7 px-2 py-0 text-xs"
                disabled={escolhidos === 0}
                onClick={() => onExcluirBloco(idsEscolhiveis, true)}
              >
                Nenhuma
              </button>
            </span>
          </div>
        )}

        {resumo.grupos.map((g) => <GrupoDeMudanca key={g.natureza} grupo={g} nomeDe={nomeDe} onExcluir={onExcluir} onExcluirBloco={onExcluirBloco} />)}

        {/* Novos */}
        {resumo.novos.length > 0 && (
          <details open className="rounded-xl border border-green-200">
            <summary className="cursor-pointer border-b border-green-100 bg-green-50/50 px-3 py-1.5 text-xs font-semibold text-green-800">
              <input
                type="checkbox"
                className="mr-1.5 align-middle"
                checked={resumo.novos.length - novosFora > 0}
                ref={(el) => { if (el) el.indeterminate = novosFora > 0 && novosFora < resumo.novos.length; }}
                onClick={(ev) => ev.stopPropagation()}
                onChange={(ev) => onExcluirBloco(resumo.novos.map((n) => n.id), !ev.target.checked)}
                aria-label={`Aplicar os ${resumo.novos.length} lançamentos novos`}
              />
              Novos lançamentos · {resumo.novos.length} · {formatBRL(resumo.novos.filter((n) => !excluidos.has(n.id)).reduce((s, p) => s + (Number(p.valor) || 0), 0))}
              <span className="ml-1 font-normal opacity-70">· {resumo.novos.length - novosFora} marcado(s)</span>
            </summary>
            {/* REJEITAR UM LANÇAMENTO NOVO. Este bloco não tinha caixa nenhuma:
                os novos entravam obrigatoriamente, e são o maior volume da
                importação. Quem queria aceitar uns e recusar outros não tinha
                como — só aplicar tudo ou cancelar tudo. A regra já sabia
                excluí-los (previaFolha filtra `novos` pelos desmarcados); era
                a tela que não perguntava. */}

            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
                {[...resumo.novos].sort((a, b) => a.competencia.localeCompare(b.competencia) || nomeDe(a.colaboradorId).localeCompare(nomeDe(b.colaboradorId), "pt-BR")).map((n) => (
                  <tr key={n.id} className={cn(excluidos.has(n.id) && "opacity-45", !excluidos.has(n.id) && idsForaDoQuadro.has(n.id) && "bg-amber-50/40")}>
                    <td className="td w-8">
                      <input
                        type="checkbox"
                        checked={!excluidos.has(n.id)}
                        onChange={() => onExcluir(n.id, !excluidos.has(n.id))}
                        aria-label={`Aplicar o novo lançamento de ${nomeDe(n.colaboradorId)}`}
                      />
                    </td>
                    <td className={cn("td font-medium text-slate-700", excluidos.has(n.id) && "line-through")}><Pessoa nome={nomeDe(n.colaboradorId)} colaboradorId={n.colaboradorId} />{idsForaDoQuadro.has(n.id) && <span className="ml-1 rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">fora do quadro</span>}</td>
                    <td className="td text-slate-500">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: corDoTipo(n.tipo) }} />
                        {compLabel(n.competencia)} · {n.tipo}
                        {n.descricao && <span className="text-[11px] text-slate-400">· {n.descricao}</span>}
                        {n.statusErp && n.statusErp !== "PAGO" && <span className="rounded-full bg-slate-100 px-1.5 text-[10px] text-slate-600">{n.statusErp.toLowerCase()}</span>}
                      </span>
                    </td>
                    <td className="td text-right font-semibold tabular-nums text-green-700">{formatBRL(n.valor)}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </details>
        )}

        {/* Não vieram: três motivos, remoção só por linha */}
        <BlocoAusentes
          titulo="No ERP, mas sem pessoa nesta busca"
          porque="O título existe no Mubisys; só não casou com ninguém desta vez. Vincule a pessoa em “Não encontrados” — não remova."
          itens={resumo.ausentes.semDono} nomeDe={nomeDe} tom="border-sky-200 bg-sky-50/40 text-sky-900"
        />
        <BlocoAusentes
          titulo="No ERP, mas a conta saiu da lista de folha"
          porque="O título existe no Mubisys; a conta dele é que não está na lista da folha (o contador renumerou, ou é conta nova). Ajuste a lista — não remova o lançamento."
          itens={resumo.ausentes.foraDaFolha} nomeDe={nomeDe} tom="border-violet-200 bg-violet-50/40 text-violet-900"
        />
        <BlocoAusentes
          titulo="Vieram do ERP e não voltaram nesta busca"
          porque="Podem ter sido cancelados, ou ter mudado de mês (vencimento cruzou o dia 15 — busque o mês vizinho antes de remover). Removido some da tela e fica arquivado no banco."
          itens={resumo.ausentes.comIdErp} nomeDe={nomeDe} tom="border-amber-200 bg-amber-50/30 text-amber-900"
          marcados={ausentesMarcados} onMarcar={onMarcarAusente} onMarcarTodos={(ids, ok) => onMarcarBloco(ids, ok)}
        />
        <BlocoAusentes
          titulo="Vieram de planilha ou foram lançados à mão — sem par no ERP"
          porque="Não existir no Mubisys é a natureza deles. Só remova o que você sabe que está errado, um a um."
          itens={resumo.ausentes.semId} nomeDe={nomeDe} tom="border-slate-200 bg-slate-50 text-slate-700"
          marcados={ausentesMarcados} onMarcar={onMarcarAusente}
        />

        {extras}
      </div>
    </Modal>
  );
}

function Placar({ n, rotulo, tom, borda, sub }: { n: number; rotulo: string; tom: string; borda: string; sub?: string }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2 text-center", borda)}>
      <p className={cn("text-xl font-bold tabular-nums", tom)}>{n}</p>
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{rotulo}</p>
      {sub && <p className="mt-0.5 truncate text-[10px] text-slate-500" title={sub}>{sub}</p>}
    </div>
  );
}

function legivel(m: Mudanca, lado: "de" | "para", nomeDe: (id: string) => string): string {
  const v = m[lado];
  if (m.campo === "valor") return formatBRL(Number(v));
  if (m.campo === "pessoa") return nomeDe(v);
  if (m.campo === "mes") return compLabel(v);
  if (m.campo === "data") return ddmm(v);
  return v || "—";
}

function GrupoDeMudanca({ grupo, nomeDe, onExcluir, onExcluirBloco }: {
  grupo: GrupoAlterado;
  nomeDe: (id: string) => string;
  onExcluir: (id: string, fora: boolean) => void;
  onExcluirBloco: (ids: string[], fora: boolean) => void;
}) {
  const ids = grupo.itens.map((i) => i.antigo.id);
  const dentro = grupo.itens.filter((i) => !i.fora).length;
  const silencioso = NATUREZAS_SILENCIOSAS.has(grupo.natureza);
  const tom = silencioso ? "border-slate-200" : grupo.natureza === "valor" ? "border-blue-200" : "border-amber-200";
  const cab = silencioso ? "bg-slate-50/60 text-slate-700 border-slate-100" : grupo.natureza === "valor" ? "bg-blue-50/50 text-blue-800 border-blue-100" : "bg-amber-50/50 text-amber-900 border-amber-100";
  return (
    <details open={!silencioso} className={cn("rounded-xl border", tom)}>
      {/* A CAIXA DO BLOCO MORA NO CABEÇALHO, e não lá dentro.
          Tudo nasce desmarcado ("tudo desmarcável, só marcar o que é certo"),
          e o bloco silencioso vem recolhido — são 99 linhas de texto e conta.
          Com a caixa aqui, dá para aprovar um bloco inteiro sem abri-lo, e
          abrir só o que se quer escolher item a item. O stopPropagation existe
          porque clicar no cabeçalho é o que abre e fecha a sanfona: sem ele,
          marcar o bloco recolhia a seção na cara de quem clicou. */}
      <summary className={cn("cursor-pointer border-b px-3 py-1.5 text-xs font-semibold", cab)}>
        <input
          type="checkbox"
          className="mr-1.5 align-middle"
          checked={dentro > 0}
          ref={(el) => { if (el) el.indeterminate = dentro > 0 && dentro < grupo.itens.length; }}
          onClick={(ev) => ev.stopPropagation()}
          onChange={(ev) => onExcluirBloco(ids, !ev.target.checked)}
          aria-label={`Aplicar as ${grupo.itens.length} de ${ROTULO[grupo.natureza]}`}
        />
        {ROTULO[grupo.natureza]} · {grupo.itens.length}
        {grupo.natureza === "valor" && ` · ${sinal(grupo.deltaValor)}`}
        {silencioso && <span className="ml-1 font-normal opacity-70">· não muda valor</span>}
        <span className="ml-1 font-normal opacity-70">
          · {dentro} marcada(s)
        </span>
      </summary>
      <div className="max-h-64 overflow-y-auto">
        <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
          {grupo.itens.map(({ antigo, novo, muds, fora }) => (
            <tr key={antigo.id} className={fora ? "opacity-45" : undefined}>
              <td className="td w-8">
                <input
                  type="checkbox"
                  checked={!fora}
                  onChange={() => onExcluir(antigo.id, !fora)}
                  aria-label={`Aplicar a alteração de ${nomeDe(novo.colaboradorId)}`}
                />
              </td>
              <td className={cn("td font-medium text-slate-700", fora && "line-through")}><Pessoa nome={nomeDe(novo.colaboradorId)} colaboradorId={novo.colaboradorId} /></td>
              <td className="td text-slate-500">{compLabel(novo.competencia)} · {novo.tipo} · {formatBRL(novo.valor)}</td>
              <td className="td">
                <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                  {muds.map((m) => (
                    <span key={m.campo} className={cn(silencioso ? "text-slate-500" : "text-slate-700")}>
                      <span className="text-slate-400">{ROTULO_CAMPO[m.campo]}:</span>{" "}
                      <s className="text-slate-400">{legivel(m, "de", nomeDe)}</s> → <b>{legivel(m, "para", nomeDe)}</b>
                    </span>
                  ))}
                </span>
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </details>
  );
}

function BlocoAusentes({ titulo, porque, itens, nomeDe, tom, marcados, onMarcar, onMarcarTodos }: {
  titulo: string; porque: string; itens: Pagamento[]; nomeDe: (id: string) => string; tom: string;
  marcados?: Set<string>; onMarcar?: (id: string, ok: boolean) => void; onMarcarTodos?: (ids: string[], ok: boolean) => void;
}) {
  if (itens.length === 0) return null;
  const total = itens.reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const todos = !!marcados && itens.every((p) => marcados.has(p.id));
  return (
    <details open className={cn("rounded-xl border p-3", tom)}>
      <summary className="cursor-pointer text-xs font-semibold">{titulo} · {itens.length} · {formatBRL(total)}</summary>
      <p className="mt-1 text-[11px] opacity-80">{porque}</p>
      {onMarcarTodos && (
        <label className="mt-2 flex items-center gap-2 text-[11px]">
          <input type="checkbox" checked={todos} onChange={(e) => onMarcarTodos(itens.map((p) => p.id), e.target.checked)} /> marcar todos deste bloco para remover
        </label>
      )}
      <div className="mt-2 max-h-48 overflow-y-auto rounded-lg bg-white/70">
        <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
          {[...itens].sort((a, b) => a.competencia.localeCompare(b.competencia) || nomeDe(a.colaboradorId).localeCompare(nomeDe(b.colaboradorId), "pt-BR")).map((a) => (
            <tr key={a.id} className={marcados?.has(a.id) ? "bg-red-50/50" : undefined}>
              {onMarcar && <td className="td w-8"><input type="checkbox" checked={marcados?.has(a.id) ?? false} onChange={(e) => onMarcar(a.id, e.target.checked)} aria-label={`Remover ${nomeDe(a.colaboradorId)} ${compLabel(a.competencia)} ${a.tipo}`} /></td>}
              <td className="td text-slate-600"><Pessoa nome={nomeDe(a.colaboradorId)} colaboradorId={a.colaboradorId} /></td>
              <td className="td text-slate-500">{compLabel(a.competencia)} · {a.tipo}{a.descricao && <span className="text-[11px] text-slate-400"> · {a.descricao}</span>}</td>
              <td className="td text-right tabular-nums text-slate-500">{formatBRL(a.valor)}</td>
            </tr>
          ))}
        </tbody></table>
      </div>
    </details>
  );
}
