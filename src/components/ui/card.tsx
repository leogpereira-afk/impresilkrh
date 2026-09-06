import { createContext, useContext, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// Contexto de recolhimento: todo Card é recolhível por padrão. O CardHeader vira
// o gatilho (clica no título ou na seta) e o CardBody some quando recolhido.
// Cards sem CardHeader não têm como recolher → o corpo fica sempre visível.
const ColapsoCtx = createContext<{ aberto: boolean; alternar: () => void } | null>(null);

// Escolha de recolher GUARDADA por card (localStorage). Em tela de análise a
// pessoa fecha o que não usa e isso tem de continuar fechado amanhã — recolher
// que volta a abrir a cada visita é o mesmo que não recolher. Sem `chave` o
// estado é só da sessão, como sempre foi.
const chaveDe = (id: string) => `card:${id}`;
function lerAberto(chave: string | undefined, inicial: boolean): boolean {
  if (!chave) return inicial;
  try {
    const v = localStorage.getItem(chaveDe(chave));
    return v == null ? inicial : v === "1";
  } catch {
    return inicial;
  }
}
function gravarAberto(chave: string | undefined, aberto: boolean) {
  if (!chave) return;
  try { localStorage.setItem(chaveDe(chave), aberto ? "1" : "0"); } catch { /* ignora */ }
}

export function useAbertoPersistido(chave: string | undefined, inicial = true) {
  const [aberto, setAberto] = useState(() => lerAberto(chave, inicial));
  const definir = (v: boolean | ((o: boolean) => boolean)) => {
    setAberto((o) => {
      const n = typeof v === "function" ? v(o) : v;
      gravarAberto(chave, n);
      return n;
    });
  };
  return [aberto, definir] as const;
}

export function Card({
  className,
  children,
  colapsavel = true,
  idPersistencia,
  abertoInicial = true,
}: {
  className?: string;
  children: React.ReactNode;
  colapsavel?: boolean;
  /** Com isto, recolher/expandir fica guardado entre visitas. */
  idPersistencia?: string;
  abertoInicial?: boolean;
}) {
  const [aberto, setAberto] = useAbertoPersistido(idPersistencia, abertoInicial);
  const ctx = colapsavel ? { aberto, alternar: () => setAberto((o) => !o) } : null;
  return (
    <ColapsoCtx.Provider value={ctx}>
      <div className={cn("card", className)}>{children}</div>
    </ColapsoCtx.Provider>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  const ctx = useContext(ColapsoCtx);
  const interior = (
    <>
      {icon && <div className="mt-0.5 text-brand">{icon}</div>}
      <div>
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
      </div>
    </>
  );
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 px-5 py-4",
        (!ctx || ctx.aberto) && "border-b border-slate-100",
        className,
      )}
    >
      {ctx ? (
        <button type="button" onClick={ctx.alternar} aria-expanded={ctx.aberto} className="flex flex-1 items-start gap-3 text-left">
          {interior}
        </button>
      ) : (
        <div className="flex items-start gap-3">{interior}</div>
      )}
      <div className="flex shrink-0 items-center gap-2">
        {action}
        {ctx && (
          <button
            type="button"
            onClick={ctx.alternar}
            aria-label={ctx.aberto ? "Recolher" : "Expandir"}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", !ctx.aberto && "-rotate-90")} />
          </button>
        )}
      </div>
    </div>
  );
}

export function CardBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = useContext(ColapsoCtx);
  if (ctx && !ctx.aberto) return null; // recolhido → esconde o corpo
  return <div className={cn("p-5", className)}>{children}</div>;
}

// Mantido por compatibilidade (ficha do colaborador). Como o Card já é recolhível,
// aqui o Card interno desliga o recolhimento próprio para não duplicar.
//
// Pode ser CONTROLADO (`aberto` + `onAlternar`): é o que permite algo de fora —
// um chip de "está atualizado?" — mandar abrir o bloco e rolar até ele.
export function SecaoColapsavel({
  title,
  subtitle,
  icon,
  action,
  className,
  bodyClassName,
  defaultOpen = true,
  aberto: abertoControlado,
  onAlternar,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  defaultOpen?: boolean;
  aberto?: boolean;
  onAlternar?: () => void;
  children: React.ReactNode;
}) {
  const [abertoLocal, setAbertoLocal] = useState(defaultOpen);
  const controlado = abertoControlado !== undefined;
  const aberto = controlado ? abertoControlado : abertoLocal;
  const alternar = () => (controlado ? onAlternar?.() : setAbertoLocal((o) => !o));
  return (
    <Card className={className} colapsavel={false}>
      <div className={cn("flex items-start justify-between gap-3 px-5 py-4", aberto && "border-b border-slate-100")}>
        <button type="button" onClick={alternar} aria-expanded={aberto} className="flex flex-1 items-start gap-3 text-left">
          {icon && <div className="mt-0.5 text-brand">{icon}</div>}
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {action}
          <button
            type="button"
            onClick={alternar}
            aria-label={aberto ? "Recolher" : "Expandir"}
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", !aberto && "-rotate-90")} />
          </button>
        </div>
      </div>
      {aberto && <CardBody className={bodyClassName}>{children}</CardBody>}
    </Card>
  );
}
