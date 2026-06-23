import { createContext, useContext, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

// Contexto de recolhimento: todo Card é recolhível por padrão. O CardHeader vira
// o gatilho (clica no título ou na seta) e o CardBody some quando recolhido.
// Cards sem CardHeader não têm como recolher → o corpo fica sempre visível.
const ColapsoCtx = createContext<{ aberto: boolean; alternar: () => void } | null>(null);

export function Card({
  className,
  children,
  colapsavel = true,
}: {
  className?: string;
  children: React.ReactNode;
  colapsavel?: boolean;
}) {
  const [aberto, setAberto] = useState(true);
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
export function SecaoColapsavel({
  title,
  subtitle,
  icon,
  action,
  className,
  bodyClassName,
  defaultOpen = true,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(defaultOpen);
  const alternar = () => setAberto((o) => !o);
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
