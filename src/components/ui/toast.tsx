import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tipo = "sucesso" | "erro" | "info";
interface ToastItem {
  id: number;
  tipo: Tipo;
  msg: string;
}

const ToastCtx = createContext<(msg: string, tipo?: Tipo) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const mostrar = useCallback((msg: string, tipo: Tipo = "sucesso") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const remover = (id: number) => setToasts((t) => t.filter((x) => x.id !== id));

  const icone = { sucesso: CheckCircle2, erro: AlertTriangle, info: Info };
  const cor = {
    sucesso: "text-green-600",
    erro: "text-red-600",
    info: "text-brand",
  };

  return (
    <ToastCtx.Provider value={mostrar}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = icone[t.tipo];
          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-card-hover animate-fade-in"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", cor[t.tipo])} />
              <p className="flex-1 text-sm text-slate-700">{t.msg}</p>
              <button onClick={() => remover(t.id)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}
