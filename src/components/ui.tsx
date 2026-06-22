import { clsx } from "clsx";
import type { ReactNode } from "react";
import { iniciais } from "@/lib/format";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("card", className)}>{children}</div>;
}
export function CardHeader({ title, subtitle, icon, action }: { title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-brand">{icon}</div>}
        <div>
          <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx("p-5", className)}>{children}</div>;
}

type Variant = "neutral" | "success" | "warning" | "danger" | "info" | "gold";
const badgeStyles: Record<Variant, string> = {
  neutral: "bg-slate-100 text-slate-600 ring-slate-200",
  success: "bg-green-50 text-green-700 ring-green-200",
  warning: "bg-amber-50 text-amber-700 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-blue-50 text-blue-700 ring-blue-200",
  gold: "bg-gold-50 text-gold-700 ring-gold-200",
};
export function Badge({ children, variant = "neutral", className }: { children: ReactNode; variant?: Variant; className?: string }) {
  return <span className={clsx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", badgeStyles[variant], className)}>{children}</span>;
}

export function PageHeader({ title, description, children }: { title: string; description?: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-brand-ink sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, hint, icon, accent = "brand" }: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; accent?: "brand" | "gold" | "green" | "amber" | "red" | "blue" }) {
  const cores: Record<string, string> = {
    brand: "bg-brand/10 text-brand", gold: "bg-gold-100 text-gold-700", green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700", red: "bg-red-100 text-red-700", blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        {icon && <span className={clsx("flex h-9 w-9 items-center justify-center rounded-lg", cores[accent])}>{icon}</span>}
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight text-brand-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Avatar({ nome, size = "md", className }: { nome: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const t = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" };
  return <div className={clsx("flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand", t[size], className)} title={nome}>{iniciais(nome)}</div>;
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
      {icon && <div className="mb-3 text-slate-300">{icon}</div>}
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
    </div>
  );
}

export function Field({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm text-slate-800">{value ?? "—"}</dd>
    </div>
  );
}

export function Progress({ value, cor }: { value: number; cor?: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, backgroundColor: cor ?? "#16334f" }} />
    </div>
  );
}
