import { cn } from "@/lib/cn";
import { iniciais } from "@/lib/format";

export function Avatar({
  nome,
  size = "md",
  className,
}: {
  nome: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const tamanhos = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-xl",
  };
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand",
        tamanhos[size],
        className,
      )}
      title={nome}
    >
      {iniciais(nome)}
    </div>
  );
}

export function Progress({
  value,
  className,
  cor,
}: {
  value: number;
  className?: string;
  cor?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-100", className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${v}%`, backgroundColor: cor ?? "#16334f" }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}

export function Field({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}
