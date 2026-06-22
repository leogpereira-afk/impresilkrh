import { cn } from "@/lib/cn";

type Variant = "neutral" | "success" | "warning" | "danger" | "info" | "gold";

const estilos: Record<Variant, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  gold: "bg-gold-50 text-gold-700 ring-gold-200",
};

export function Badge({
  children,
  variant = "neutral",
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        estilos[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

// Badge colorido por valor (cor arbitrária)
export function DotBadge({
  label,
  cor,
  className,
}: {
  label: string;
  cor: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-700 ring-1 ring-inset ring-slate-200",
        className,
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: cor }}
        aria-hidden
      />
      {label}
    </span>
  );
}
