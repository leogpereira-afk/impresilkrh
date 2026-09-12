import { useColecao } from "@/lib/store";
import { cicloVigente } from './cicloVigente';

// Nome do ciclo de avaliação vigente: o que estiver ABERTO ou, na falta, o mais
// recente. Antes o texto "Ciclo 2026.1" estava fixo no código em várias telas —
// viraria mentira na primeira virada de ciclo/ano.
export function useCicloAtivo(): string {
  const { items } = useColecao("ciclos");
  const vigente = cicloVigente(items);
  return vigente?.nome ?? "Ciclo atual";
}
