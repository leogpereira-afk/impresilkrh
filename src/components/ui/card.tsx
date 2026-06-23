import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("card", className)}>{children}</div>;
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
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-brand">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
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
  return <div className={cn("p-5", className)}>{children}</div>;
}

// Card com cabeçalho recolhível: clicar no título (ou na seta) recolhe/expande o
// corpo. Mesma API do CardHeader (title/subtitle/icon/action) + children = corpo.
// A `action` fica FORA do botão de recolher (pode conter links/botões próprios).
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
    <Card className={className}>
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
