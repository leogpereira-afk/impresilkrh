import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, FileWarning, Award, ClipboardCheck, Palmtree, Cake, Check, CalendarClock, CheckCheck } from "lucide-react";
import { useNotificacoes, type CategoriaNotif, type SeveridadeNotif, type Notificacao } from "@/lib/notificacoes";
import { useSessao } from "@/lib/session";
import { lerLidas, gravarLidas, naoLido, marcarTodas, limpar, type Lidas } from "@/lib/notificacoesLidas";
import { cn } from "@/lib/cn";

const ICONE: Record<CategoriaNotif, typeof Bell> = {
  documento: FileWarning, nr: Award, avaliacao: ClipboardCheck, ferias: Palmtree,
  experiencia: CalendarClock, aniversario: Cake,
};
const COR: Record<SeveridadeNotif, string> = { alta: "text-red-600", media: "text-amber-600", baixa: "text-slate-400" };

export function NotificacoesButton() {
  const navigate = useNavigate();
  const itens = useNotificacoes();
  const sessao = useSessao();
  const usuarioId = sessao?.colaboradorId ?? "";
  const [aberto, setAberto] = useState(false);
  const [lidas, setLidas] = useState<Lidas>(() => lerLidas(usuarioId));

  // Troca de usuário no mesmo aparelho: recarrega a marcação da pessoa certa.
  useEffect(() => { setLidas(lerLidas(usuarioId)); }, [usuarioId]);

  /* O CONTADOR é dos não lidos; a LISTA continua inteira. Um aviso lido não
     some — some do número. Esconder um exame vencido porque alguém clicou em
     "dar como lidas" seria o sino escondendo justamente o que existe para
     mostrar. */
  const naoLidos = useMemo(() => itens.filter((n) => naoLido(n, lidas)), [itens, lidas]);
  const total = naoLidos.length;
  const temAlta = naoLidos.some((i) => i.severidade === "alta");
  const temMedia = naoLidos.some((i) => i.severidade === "media");
  const corBadge = temAlta ? "bg-red-500" : temMedia ? "bg-amber-500" : "bg-slate-400";

  const ir = (n: Notificacao) => { setAberto(false); navigate(n.href); };

  const darTodasComoLidas = () => {
    // `limpar` junto: sem isso o registro guardaria para sempre a marcação de
    // cada documento renovado e de cada pessoa desligada, até estourar a cota.
    const novo = limpar(itens, marcarTodas(itens, lidas));
    setLidas(novo);
    gravarLidas(usuarioId, novo);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
        title="Notificações"
        aria-label={`Notificações${total ? ` (${total} não lidas)` : ""}`}
      >
        <Bell className="h-[18px] w-[18px]" />
        {total > 0 && (
          <span className={cn("absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white", corBadge)}>
            {total > 9 ? "9+" : total}
          </span>
        )}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft animate-scale-in">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Notificações</p>
              <div className="flex items-center gap-2">
                {itens.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                    {total > 0 ? `${total} de ${itens.length}` : itens.length}
                  </span>
                )}
                {total > 0 && (
                  <button
                    type="button"
                    onClick={darTodasComoLidas}
                    title="Marcar todas como lidas — elas continuam na lista, só param de contar no sino"
                    className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-brand transition hover:bg-brand/5"
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Dar como lidas
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {itens.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-50">
                    <Check className="h-6 w-6 text-green-500" />
                  </span>
                  <p className="text-sm font-medium text-slate-600">Tudo em dia</p>
                  <p className="text-xs text-slate-400">Nenhuma pendência no seu escopo.</p>
                </div>
              ) : (
                itens.slice(0, 40).map((n) => {
                  const Icone = ICONE[n.categoria];
                  const novo = naoLido(n, lidas);
                  return (
                    <button
                      key={n.id}
                      onClick={() => ir(n)}
                      className={cn(
                        "flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50",
                        !novo && "opacity-60",
                      )}
                    >
                      <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", COR[n.severidade])} />
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm text-slate-700", novo ? "font-medium" : "font-normal")}>{n.titulo}</p>
                        <p className="truncate text-xs text-slate-400">{n.descricao}</p>
                      </div>
                      {/* Bolinha do não lido: sem ela, "lido" ficaria só no tom
                          mais claro, que some em tela clara e para quem tem
                          dificuldade de enxergar contraste. */}
                      {novo && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-label="não lida" />}
                    </button>
                  );
                })
              )}
            </div>
            {itens.length > 0 && total === 0 && (
              <p className="border-t border-slate-100 px-4 py-2.5 text-center text-xs text-slate-400">
                Todas lidas. As pendências continuam aqui até serem resolvidas.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
