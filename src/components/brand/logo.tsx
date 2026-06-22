import { cn } from "@/lib/cn";

// Wordmark discreto e elegante da Impresilk.
export function Logo({
  className,
  variant = "light",
  showTagline = true,
}: {
  className?: string;
  variant?: "light" | "dark";
  showTagline?: boolean;
}) {
  const cor = variant === "light" ? "text-white" : "text-brand-ink";
  const tagline = variant === "light" ? "text-gold-200" : "text-gold-600";
  return (
    <div className={cn("flex flex-col leading-none", className)}>
      <div className="flex items-baseline gap-[2px]">
        <span className={cn("text-xl font-semibold tracking-tight", cor)}>
          impresilk
        </span>
        <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden />
      </div>
      {showTagline && (
        <span
          className={cn(
            "mt-1 text-[9px] font-medium uppercase tracking-[0.32em]",
            tagline,
          )}
        >
          Comunicação Visual
        </span>
      )}
    </div>
  );
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg bg-brand text-white shadow-sm",
        className,
      )}
    >
      <span className="text-sm font-bold tracking-tight">i</span>
      <span className="ml-[1px] h-1 w-1 rounded-full bg-gold" aria-hidden />
    </div>
  );
}
