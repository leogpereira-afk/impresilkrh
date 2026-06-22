import { cn } from "@/lib/cn";
import logoColor from "@/assets/brand/logo-color.png";
import logoWhite from "@/assets/brand/logo-white.png";
import logoBlack from "@/assets/brand/logo-black.png";
import iconColor from "@/assets/brand/icon.png";

// Logomarca oficial Impresilk (eagle CMYK + wordmark). Variantes:
//  - color: colorida (fundos claros)
//  - white: branca (fundos escuros, ex.: sidebar navy)
//  - black: preta (fundos claros, uso monocromático)
const SRC: Record<string, string> = {
  color: logoColor,
  white: logoWhite,
  black: logoBlack,
  // compatibilidade com chamadas antigas
  light: logoWhite,
  dark: logoColor,
};

export function Logo({
  className,
  variant = "color",
}: {
  className?: string;
  variant?: "color" | "white" | "black" | "light" | "dark";
  showTagline?: boolean;
}) {
  return (
    <img
      src={SRC[variant] ?? logoColor}
      alt="Impresilk · Soluções Visuais"
      draggable={false}
      className={cn("h-9 w-auto select-none", className)}
    />
  );
}

// Marca compacta (apenas o "águia") para favicons, cabeçalhos colapsados, etc.
export function LogoMark({ className }: { className?: string }) {
  return (
    <img
      src={iconColor}
      alt="Impresilk"
      draggable={false}
      className={cn("h-8 w-auto select-none", className)}
    />
  );
}
