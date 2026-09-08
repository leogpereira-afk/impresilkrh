import { cn } from "@/lib/cn";

export function Campo({
  label,
  children,
  hint,
  className,
  obrigatorio,
  estado,
}: {
  label?: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  obrigatorio?: boolean;
  /**
   * Pinta o campo pelo preenchimento (pedido do Leonardo, 08/09/2026): verde
   * claro quando está preenchido, vermelho quando falta e o cadastro precisa.
   * "neutro" mantém o mesmo espaçamento dos outros, sem cor — senão os campos
   * pintados ficariam maiores que os demais e a grade dançaria.
   */
  estado?: "ok" | "falta" | "neutro";
}) {
  return (
    <label className={cn(
      "block",
      estado && "rounded-lg p-2 transition-colors",
      estado === "ok" && "bg-green-50/70",
      estado === "falta" && "bg-red-50 ring-1 ring-red-200",
      className,
    )}>
      {label && (
        <span className="label">
          {label} {obrigatorio && <span className="text-red-500">*</span>}
          {estado === "falta" && <span className="ml-1 text-[10px] font-semibold uppercase tracking-wide text-red-600">falta</span>}
        </span>
      )}
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn("input", props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn("input min-h-[80px]", props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn("input", props.className)} />;
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-brand" : "bg-slate-300",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {label && <span className="text-sm text-slate-700">{label}</span>}
    </button>
  );
}
