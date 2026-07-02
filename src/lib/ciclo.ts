import { useColecao } from "@/lib/store";

// Nome do ciclo de avaliação vigente: o que estiver ABERTO ou, na falta, o mais
// recente. Antes o texto "Ciclo 2026.1" estava fixo no código em várias telas —
// viraria mentira na primeira virada de ciclo/ano.
export function useCicloAtivo(): string {
  const { items } = useColecao("ciclos");
  const vigente =
    items.find((c) => c.status === "Aberto") ??
    [...items].sort((a, b) => String(b.dataInicio).localeCompare(String(a.dataInicio)))[0];
  return vigente?.nome ?? "Ciclo atual";
}
