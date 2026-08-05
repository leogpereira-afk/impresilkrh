// ============================================================================
// QUAL CERTIFICAÇÃO NR VALE HOJE.
//
// Renovar um treinamento não apaga o anterior — e não deve mesmo: o histórico é
// a prova de que a pessoa fez o curso na época. Só que o contador de "vencidas"
// olhava TODAS as linhas, então o certificado velho continuava sendo cobrado
// para sempre. Na prática: a pessoa renova a NR-35, e o painel segue dizendo
// "1 vencida" — o alerta vira ruído e a tela passa a mentir sobre o risco.
//
// A regra é simples: por PESSOA e por NR, quem manda é o treinamento mais
// RECENTE. As anteriores viram histórico, ficam visíveis e param de cobrar.
// ============================================================================
import type { CertificacaoNR } from "@/data/types";

/** Chave do que é "a mesma certificação": a pessoa e a norma. */
const chave = (c: Pick<CertificacaoNR, "colaboradorId" | "nr">) => `${c.colaboradorId}::${c.nr}`;

/**
 * A data que decide qual é a mais nova. Usa o treinamento (o fato), não a
 * validade — duas NRs da mesma pessoa podem ter validades diferentes por
 * mudança de regra, e aí a mais nova é a que foi feita depois.
 */
const quando = (c: Pick<CertificacaoNR, "dataTreinamento">) => String(c.dataTreinamento ?? "");

/**
 * Separa o que vale hoje do que é histórico.
 *
 * Empate na data (duas linhas no mesmo dia): fica a ÚLTIMA da lista, que é a
 * lançada por último. Sem esse desempate a escolha mudaria conforme a ordem de
 * chegada da sincronização.
 */
export function separarVigentes<T extends Pick<CertificacaoNR, "colaboradorId" | "nr" | "dataTreinamento">>(
  certs: T[],
): { vigentes: T[]; substituidas: T[] } {
  const melhorPorChave = new Map<string, T>();
  for (const c of certs) {
    const k = chave(c);
    const atual = melhorPorChave.get(k);
    if (!atual || quando(c) >= quando(atual)) melhorPorChave.set(k, c);
  }
  const vigentesSet = new Set(melhorPorChave.values());
  return {
    vigentes: certs.filter((c) => vigentesSet.has(c)),
    substituidas: certs.filter((c) => !vigentesSet.has(c)),
  };
}

/** `true` quando esta linha foi substituída por um treinamento mais novo. */
export function foiSubstituida<T extends Pick<CertificacaoNR, "colaboradorId" | "nr" | "dataTreinamento">>(
  cert: T,
  certs: T[],
): boolean {
  return separarVigentes(certs).substituidas.includes(cert);
}
