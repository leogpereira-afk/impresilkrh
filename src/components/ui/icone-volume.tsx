import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Ícone decorativo em relevo; o nome acessível pertence ao controle ao lado. */
export function IconeVolume({ children, className, pequeno = false }: {
  children: ReactNode;
  className?: string;
  pequeno?: boolean;
}) {
  return <span aria-hidden="true" className={cn("rh-icone-volume", pequeno && "rh-icone-volume-sm", className)}>
    <span className="rh-icone-volume-face">{children}</span>
  </span>;
}
