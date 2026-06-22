import { Laugh, Smile, Meh, Frown, Angry, Brain, TrendingUp, TrendingDown, Minus, ThumbsUp, AlertTriangle, MessageCircle, Target, CheckCircle2, Send, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { COR_HUMOR, COR_PERFIL_COMPORTAMENTAL, DESC_PERFIL_COMPORTAMENTAL, faixaMotivacao, ARQUETIPOS } from "@/lib/constants";

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

// Indicador de motivação (rosto 0–100 que muda de expressão e cor) + tendência.
export function MotivacaoRosto({
  score,
  anterior,
  tamanho = "md",
  comTexto = true,
}: {
  score?: number | null;
  anterior?: number | null;
  tamanho?: "sm" | "md" | "lg";
  comTexto?: boolean;
}) {
  if (score == null) return <span className="text-xs text-slate-400">—</span>;
  const f = faixaMotivacao(score);
  const Icon = f.rosto === "muito-feliz" ? Laugh : f.rosto === "feliz" ? Smile : f.rosto === "neutro" ? Meh : f.rosto === "triste" ? Frown : Angry;
  const sz = tamanho === "lg" ? "h-9 w-9" : tamanho === "sm" ? "h-4 w-4" : "h-6 w-6";
  const tend = anterior == null ? null : score > anterior + 2 ? "up" : score < anterior - 2 ? "down" : "stable";
  const TendIcon = tend === "up" ? TrendingUp : tend === "down" ? TrendingDown : Minus;
  const tendCor = tend === "up" ? "#16a34a" : tend === "down" ? "#dc2626" : "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1.5" title={`Motivação ${score}/100 — ${f.label}`}>
      <Icon className={sz} style={{ color: f.cor }} strokeWidth={2.2} />
      {comTexto && (
        <span className="inline-flex items-baseline gap-1">
          <span className="text-sm font-bold" style={{ color: f.cor }}>{score}</span>
          <span className="text-xs text-slate-500">{f.label}</span>
        </span>
      )}
      {tend && <TendIcon className="h-3.5 w-3.5" style={{ color: tendCor }} aria-label={`tendência ${tend}`} />}
    </span>
  );
}

// Ficha comportamental completa (arquétipo + temperamento + como lidar).
export function PerfilComportamentalGuia({ perfil }: { perfil?: string | null }) {
  if (!perfil || !ARQUETIPOS[perfil]) {
    return <p className="text-sm text-slate-400">Perfil comportamental não informado.</p>;
  }
  const a = ARQUETIPOS[perfil];
  const cor = COR_PERFIL_COMPORTAMENTAL[perfil] ?? "#16334f";
  const lidar: { icon: typeof MessageCircle; label: string; texto: string }[] = [
    { icon: MessageCircle, label: "Comunicação", texto: a.comoLidar.comunicacao },
    { icon: Target, label: "O que motiva", texto: a.comoLidar.motiva },
    { icon: CheckCircle2, label: "Como dar feedback", texto: a.comoLidar.feedback },
    { icon: Send, label: "Como delegar", texto: a.comoLidar.delegacao },
    { icon: XCircle, label: "O que evitar", texto: a.comoLidar.evite },
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl text-white" style={{ backgroundColor: cor }}>
          <Brain className="h-5 w-5" />
        </span>
        <div>
          <p className="text-base font-semibold text-brand-ink">{a.arquetipo}</p>
          <p className="text-xs text-slate-500">Temperamento {perfil} · DISC {a.disc}</p>
        </div>
      </div>
      <p className="text-sm leading-relaxed text-slate-600">{a.explicacao}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-green-200 bg-green-50/50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-green-700"><ThumbsUp className="h-3.5 w-3.5" /> Pontos fortes</p>
          <ul className="space-y-1">{a.fortes.map((x, i) => <li key={i} className="flex gap-1.5 text-sm text-slate-600"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-500" />{x}</li>)}</ul>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-amber-700"><AlertTriangle className="h-3.5 w-3.5" /> Pontos de atenção</p>
          <ul className="space-y-1">{a.atencao.map((x, i) => <li key={i} className="flex gap-1.5 text-sm text-slate-600"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />{x}</li>)}</ul>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand">Como lidar com {a.arquetipo}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {lidar.map((l, i) => {
            const Icon = l.icon;
            return (
              <div key={i} className="flex gap-2.5 rounded-lg border border-slate-100 bg-white p-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <div><p className="text-xs font-semibold text-slate-700">{l.label}</p><p className="text-sm text-slate-600">{l.texto}</p></div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
