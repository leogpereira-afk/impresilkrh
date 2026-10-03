import type { Colaborador, Freelancer } from "@/data/types";
import { mesmaPessoa } from "./freelancerNoQuadro";

/** A foto pertence à ficha quando existe vínculo inequívoco, mesmo após a saída.
 * Sem ficha, pertence ao contrato. Nunca escolher por nome ou ID abreviado. */
export function origemFotoFreelancer(
  contrato: Pick<Freelancer, "id" | "cpf" | "exColaboradorId" | "fotoDataUrl">,
  fichas: Pick<Colaborador, "id" | "cpf" | "fotoDataUrl">[],
) {
  const ligadas = fichas.filter((c) => {
    const a = String(c.cpf ?? "").replace(/\D/g, "");
    const b = String(contrato.cpf ?? "").replace(/\D/g, "");
    if (a && b && (a.length !== 11 || b.length !== 11)) return false;
    return mesmaPessoa(c, contrato);
  });
  if (ligadas.length > 1) return { ambiguo: true, foto: null, colecao: "freelancers" as const, id: contrato.id };
  const ficha = ligadas[0];
  return {
    ambiguo: false,
    foto: ficha ? ficha.fotoDataUrl ?? null : contrato.fotoDataUrl ?? null,
    colecao: ficha ? "colaboradores" as const : "freelancers" as const,
    id: ficha?.id ?? contrato.id,
  };
}
