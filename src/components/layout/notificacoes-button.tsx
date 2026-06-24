import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, FileWarning, Award, ClipboardCheck, Palmtree, Cake, Check } from "lucide-react";
import { useNotificacoes, type CategoriaNotif, type SeveridadeNotif, type Notificacao } from "@/lib/notificacoes";
import { cn } from "@/lib/cn";

const ICONE: Record<CategoriaNotif, typeof Bell> = {
  documento: FileWarning, nr: Award, avaliacao: ClipboardCheck, ferias: Palmtree, aniversario: Cake,
};
const COR: Record<SeveridadeNotif, string> = { alta: "text-red-600", media: "text-amber-600", baixa: "text-slate-400" };

export function NotificacoesButton() {
  const navigate = useNavigate();
  const itens = useNotificacoes();
  const [aberto, setAberto] = useState(false);

  const total = itens.length;
  const temAlta = itens.some((i) => i.severidade === "alta");
  const temMedia = itens.some((i) => i.severidade === "media");
  const corBadge = temAlta ? "bg-red-500" : temMedia ? "bg-amber-500" : "bg-slate-400";

  const ir = (n: Notificacao) => { setAberto(false); navigate(n.href); };

  return (
    <div className="relative">
      <button
        onClick={() => setAberto((o) => !o)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/80 bg-white text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
        title="Notificações"
        aria-label={`Notificações${total ? ` (${total})` : ""}`}
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
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Notificações</p>
              {total > 0 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{total}</span>}
            </div>
            <div className="max-h-[26rem] overflow-y-auto">
              {total === 0 ? (
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
                  return (
                    <button
                      key={n.id}
                      onClick={() => ir(n)}
                      className="flex w-full items-start gap-3 border-b border-slate-50 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                    >
                      <Icone className={cn("mt-0.5 h-4 w-4 shrink-0", COR[n.severidade])} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-700">{n.titulo}</p>
                        <p className="truncate text-xs text-slate-400">{n.descricao}</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
