// ============================================================================
// Histórico de alterações das FÉRIAS — quem mexeu, quando, e o que era antes.
//
// O log já existia (coleção `alteracoes`), mas só aparecia no Painel de
// Controle, junto com tudo do sistema. Quem estava mexendo em férias e errou um
// lançamento não tinha como ver o valor anterior sem sair da tela — e sem o
// valor anterior não dá para desfazer.
//
// Aqui ele fica ao lado da tabela que a pessoa acabou de editar, já filtrado, e
// com um botão que devolve o registro ao que era. Desfazer também é gravado no
// log: o histórico nunca perde um passo.
// ============================================================================
import { useMemo, useState } from "react";
import { History, Undo2, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useColecao } from "@/lib/store";
import { formatDate } from "@/lib/format";
import type { Ferias } from "@/data/types";

interface Mudanca { campo: string; de?: string | null; para?: string | null }
interface Alteracao {
  id: string;
  acao?: string;
  colecao?: string;
  recurso?: string;
  registroId?: string;
  criadoEm?: string;
  usuarioNome?: string;
  mudancas?: Mudanca[];
}

/** Campos que a tela de férias grava — os únicos que dá para desfazer daqui. */
const CAMPOS_DESFAZIVEIS = new Set([
  "dataInicio", "dataRetorno", "diasGozados", "saldoDias", "status",
  "periodoAquisitivoInicio", "periodoAquisitivoFim",
]);

const ROTULO: Record<string, string> = {
  dataInicio: "Início do gozo",
  dataRetorno: "Retorno",
  diasGozados: "Dias gozados",
  saldoDias: "Saldo",
  status: "Status",
  periodoAquisitivoInicio: "Aquisitivo — início",
  periodoAquisitivoFim: "Aquisitivo — fim",
};

/** Mostra data como data; o resto como veio. */
function bonito(campo: string, valor?: string | null): string {
  if (valor == null || valor === "") return "—";
  if (campo.toLowerCase().includes("data") || campo.startsWith("periodoAquisitivo")) {
    const f = formatDate(valor);
    return f === "—" ? String(valor) : f;
  }
  return String(valor);
}

const quandoLegivel = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
  });
};

export function HistoricoFerias({ nomeDe }: { nomeDe: (id: string) => string }) {
  const { items: alteracoes } = useColecao("alteracoes");
  const { items: ferias, atualizar } = useColecao("ferias");
  const toast = useToast();
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const [desfazendo, setDesfazendo] = useState<{ log: Alteracao; m: Mudanca } | null>(null);

  const linhas = useMemo(
    () => (alteracoes as Alteracao[])
      .filter((l) => l.colecao === "ferias")
      .sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""))
      .slice(0, 60),
    [alteracoes],
  );

  const alternar = (id: string) =>
    setAbertos((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // Nome da pessoa a partir do id do registro ("fer-fulano-de-tal").
  const dono = (l: Alteracao) => {
    const reg = (ferias as Ferias[]).find((f) => f.id === l.registroId);
    if (reg) return nomeDe(reg.colaboradorId);
    const id = String(l.registroId ?? "").replace(/^fer-/, "");
    return id ? nomeDe(id) : (l.recurso ?? "—");
  };

  const confirmarDesfazer = () => {
    if (!desfazendo) return;
    const { log, m } = desfazendo;
    const alvo = (ferias as Ferias[]).find((f) => f.id === log.registroId);
    if (!alvo) { toast("Este registro de férias não existe mais.", "erro"); setDesfazendo(null); return; }
    const numero = m.campo === "diasGozados" || m.campo === "saldoDias";
    atualizar(alvo.id, {
      [m.campo]: m.de == null || m.de === "" ? null : numero ? Number(m.de) : m.de,
    } as Partial<Ferias>);
    toast(`${ROTULO[m.campo] ?? m.campo} devolvido para ${bonito(m.campo, m.de)}.`);
    setDesfazendo(null);
  };

  return (
    <>
      <Card>
        <CardHeader
          title="Histórico de alterações"
          subtitle="Quem mexeu nas férias, quando, e o que era antes"
          icon={<History className="h-[18px] w-[18px]" />}
        />
        <CardBody>
          {linhas.length === 0 ? (
            <EmptyState title="Nada alterado ainda" description="Toda edição de férias passa a aparecer aqui." icon={<History className="h-8 w-8" />} />
          ) : (
            <ul className="space-y-1">
              {linhas.map((l) => {
                const aberto = abertos.has(l.id);
                const n = l.mudancas?.length ?? 0;
                return (
                  <li key={l.id} className="rounded-lg border border-slate-100">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                      onClick={() => alternar(l.id)}
                    >
                      {n > 0 ? (aberto ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />) : <span className="w-4" />}
                      <Badge variant={l.acao === "REMOVEU" ? "danger" : l.acao === "CRIOU" ? "success" : "info"}>
                        {l.acao === "REMOVEU" ? "Apagou" : l.acao === "CRIOU" ? "Criou" : "Alterou"}
                      </Badge>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">{dono(l)}</span>
                      <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">{l.usuarioNome ?? "—"}</span>
                      <span className="shrink-0 text-xs text-slate-400">{quandoLegivel(l.criadoEm)}</span>
                    </button>

                    {aberto && n > 0 && (
                      <div className="border-t border-slate-100 px-3 py-2">
                        <table className="w-full text-xs">
                          <tbody>
                            {l.mudancas!.map((m, i) => (
                              <tr key={i} className="align-middle">
                                <td className="py-1 pr-2 text-slate-500">{ROTULO[m.campo] ?? m.campo}</td>
                                <td className="py-1 pr-2 text-slate-400 line-through">{bonito(m.campo, m.de)}</td>
                                <td className="py-1 pr-2 text-slate-700">{bonito(m.campo, m.para)}</td>
                                <td className="py-1 text-right">
                                  {/* Só o que a tela de férias grava, e só se o
                                      registro ainda existe: apagado não volta
                                      por aqui, porque a lixeira guarda só o id. */}
                                  {CAMPOS_DESFAZIVEIS.has(m.campo) && l.acao !== "REMOVEU"
                                    && (ferias as Ferias[]).some((f) => f.id === l.registroId) ? (
                                    <button
                                      type="button"
                                      className="btn-ghost inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-brand"
                                      title={`Devolver para ${bonito(m.campo, m.de)}`}
                                      onClick={() => setDesfazendo({ log: l, m })}
                                    >
                                      <Undo2 className="h-3.5 w-3.5" /> Desfazer
                                    </button>
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        aberto={!!desfazendo}
        onFechar={() => setDesfazendo(null)}
        onConfirmar={confirmarDesfazer}
        titulo="Desfazer alteração"
        mensagem={desfazendo
          ? `Devolver "${ROTULO[desfazendo.m.campo] ?? desfazendo.m.campo}" de ${bonito(desfazendo.m.campo, desfazendo.m.para)} para ${bonito(desfazendo.m.campo, desfazendo.m.de)}? A volta também fica registrada no histórico.`
          : ""}
        textoConfirmar="Desfazer"
        perigo={false}
      />
    </>
  );
}
