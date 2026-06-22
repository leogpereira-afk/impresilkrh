import { cn } from "@/lib/cn";

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { value: string; positivo?: boolean };
  accent?: "brand" | "gold" | "green" | "amber" | "red" | "blue";
}) {
  const cores: Record<string, string> = {
    brand: "bg-brand/10 text-brand",
    gold: "bg-gold-100 text-gold-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              cores[accent ?? "brand"],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <span className="text-2xl font-semibold tracking-tight text-brand-ink">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "mb-1 text-xs font-medium",
              trend.positivo ? "text-green-600" : "text-red-600",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
