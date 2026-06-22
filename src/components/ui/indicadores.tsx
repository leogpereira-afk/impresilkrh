import { Laugh, Meh, Frown, Brain } from "lucide-react";
import { cn } from "@/lib/cn";
import { COR_HUMOR, COR_PERFIL_COMPORTAMENTAL, DESC_PERFIL_COMPORTAMENTAL } from "@/lib/constants";

// Indicador de humor/clima com carinha expressiva (Motivado/Estável/Desmotivado).
export function HumorIndicador({
  humor,
  tamanho = "md",
  comTexto = true,
}: {
  humor?: string | null;
  tamanho?: "sm" | "md" | "lg";
  comTexto?: boolean;
}) {
  if (!humor) return <span className="text-xs text-slate-400">—</span>;
  const Icon = humor === "Motivado" ? Laugh : humor === "Desmotivado" ? Frown : Meh;
  const cor = COR_HUMOR[humor] ?? "#64748b";
  const sz = tamanho === "lg" ? "h-7 w-7" : tamanho === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Humor: ${humor}`}>
      <Icon className={sz} style={{ color: cor }} />
      {comTexto && <span className="text-sm font-medium" style={{ color: cor }}>{humor}</span>}
    </span>
  );
}

// Selo do perfil comportamental (4 temperamentos), com cor própria.
export function PerfilComportamentalBadge({
  perfil,
  className,
}: {
  perfil?: string | null;
  className?: string;
}) {
  if (!perfil) return <span className="text-xs text-slate-400">—</span>;
  const cor = COR_PERFIL_COMPORTAMENTAL[perfil] ?? "#64748b";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset", className)}
      style={{ color: cor, backgroundColor: `${cor}14`, borderColor: `${cor}33` }}
      title={DESC_PERFIL_COMPORTAMENTAL[perfil]}
    >
      <Brain className="h-3.5 w-3.5" />
      {perfil}
    </span>
  );
}
