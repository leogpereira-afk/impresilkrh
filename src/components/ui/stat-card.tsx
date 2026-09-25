import { cn } from "@/lib/cn";

/* O CARTÃO DE NÚMERO, compacto.
 *
 * Pedido do Léo (25/09/2026), olhando o RH no ar: "os cards estão muito
 * grandes, deixar eles menores, mais práticos, muito espaço vazio". Três
 * defeitos faziam isso, e nenhum era o número em si:
 *
 *  1. Rótulo e ícone dividiam uma linha com `flex-wrap`. Rótulo longo em caixa
 *     alta espaçada ("DESLIGAMENTOS NO PERÍODO") não cabia, e o ícone caía para
 *     uma linha só dele -- em metade dos cartões o ícone ficava à direita, na
 *     outra metade embaixo, e o cartão ganhava 36px de altura à toa.
 *  2. O cartão clicável é um <button>, e botão CENTRALIZA o conteúdo na
 *     vertical. Numa fileira em que o vizinho é mais alto, o número de
 *     "Turnover" flutuava no meio do cartão. `flex flex-col` põe tudo no topo.
 *  3. Folga demais: p-4, número em text-2xl, rótulo em caixa alta com
 *     espaçamento largo (ocupa ~25% a mais de largura que o mesmo texto normal).
 *
 * O ícone agora é um selo pequeno à ESQUERDA do rótulo, sempre no mesmo lugar.
 * Quem chama continua passando o ícone com o tamanho que quiser (121 usos, a
 * maioria com h-5 w-5); `[&_svg]` redimensiona aqui dentro, num lugar só.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  accent,
  onClick,
  ativo,
  title,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  trend?: { value: string; positivo?: boolean };
  accent?: "brand" | "gold" | "green" | "amber" | "red" | "blue";
  /** Torna o card clicável (filtra a tela ou abre o detalhe de quem compõe o número). */
  onClick?: () => void;
  /** Card em uso como filtro no momento — ganha realce. */
  ativo?: boolean;
  title?: string;
}) {
  const cores: Record<string, string> = {
    brand: "bg-brand/10 text-brand",
    gold: "bg-gold-100 text-gold-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-700",
    blue: "bg-blue-100 text-blue-700",
  };
  // Sem onClick continua sendo uma <div> comum; com onClick vira botão de verdade
  // (foco por teclado, Enter/Espaço, cursor) — acessível sem mudar o visual.
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      {...(onClick ? { type: "button" as const, onClick, "aria-pressed": !!ativo } : {})}
      title={title}
      className={cn(
        "card rh-stat flex min-w-0 flex-col p-3",
        onClick && "w-full cursor-pointer text-left transition hover:border-brand/40 hover:shadow-md active:scale-[0.99]",
        ativo && "border-brand ring-1 ring-brand/40",
      )}
    >
      <div className="flex min-w-0 items-start gap-1.5">
        {icon && (
          <span
            aria-hidden
            className={cn(
              "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-md [&_svg]:h-3.5 [&_svg]:w-3.5",
              cores[accent ?? "brand"],
            )}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 break-words text-xs font-medium leading-snug text-slate-500">
          {label}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2">
        <span className="rh-stat-valor min-w-0 font-semibold leading-tight tabular-nums tracking-tight text-brand-ink [overflow-wrap:anywhere]">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.positivo ? "text-green-600" : "text-red-600",
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{hint}</p>}
    </Tag>
  );
}
