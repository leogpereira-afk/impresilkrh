import { describe, it, expect } from "vitest";
import { foraDaExperiencia, explicar } from "@/lib/foraDaExperiencia";
import type { Colaborador } from "@/data/types";

const HOJE = new Date(2026, 7, 10); // 10/08/2026
const p = (x: Partial<Colaborador>): Colaborador =>
  ({ id: "p1", nome: "Teste", statusId: "experiencia", ...x } as Colaborador);

describe("foraDaExperiencia", () => {
  it("quem ESTÁ em experiência não tem nada a explicar", () => {
    expect(foraDaExperiencia(p({ dataAdmissao: "2026-07-01" }), HOJE)).toBeNull();
  });

  it("O CASO QUE IMPORTA: passou dos 90 dias e sumiu do quadro em silêncio", () => {
    // É o pior desfecho no caso mais caro: o contrato virou indeterminado
    // sozinho, e a pessoa desapareceu do aviso exatamente quando o prazo
    // estourou. A ficha continua dizendo "Em experiência".
    const r = foraDaExperiencia(p({ dataAdmissao: "2025-08-29" }), HOJE)!;
    expect(r.motivo).toBe("prazo-passou");
    expect(explicar(r)).toContain("JÁ É por tempo indeterminado");
  });

  it("no limite: 105 dias ainda aparece, 106 já não", () => {
    // 90 + 15 de tolerância é o corte de situacaoExperiencia.
    const em = (d: number) => new Date(HOJE.getTime() - d * 86_400_000).toISOString().slice(0, 10);
    expect(foraDaExperiencia(p({ dataAdmissao: em(105) }), HOJE)).toBeNull();
    expect(foraDaExperiencia(p({ dataAdmissao: em(106) }), HOJE)?.motivo).toBe("prazo-passou");
  });

  it("sem data de admissão", () => {
    expect(foraDaExperiencia(p({ dataAdmissao: "" }), HOJE)?.motivo).toBe("sem-admissao");
  });

  it("experiência já decidida — falta só acertar o status", () => {
    const r = foraDaExperiencia(p({ dataAdmissao: "2026-07-01", experienciaDecididaEm: "2026-08-01" }), HOJE)!;
    expect(r.motivo).toBe("ja-decidida");
    expect(explicar(r)).toContain("01/08/2026");
  });

  it("desligado", () => {
    expect(foraDaExperiencia(p({ dataAdmissao: "2026-07-01", dataDesligamento: "2026-08-05" }), HOJE)?.motivo)
      .toBe("desligado");
    expect(foraDaExperiencia(p({ dataAdmissao: "2026-07-01", statusId: "inativo" }), HOJE)?.motivo)
      .toBe("desligado");
  });

  it("admissão com data futura", () => {
    const r = foraDaExperiencia(p({ dataAdmissao: "2026-09-01" }), HOJE)!;
    expect(r.motivo).toBe("admissao-futura");
    expect(explicar(r)).toContain("01/09/2026");
  });

  it("a ordem das checagens acompanha situacaoExperiencia", () => {
    // Desligado E fora do prazo: o motivo tem de ser o que de fato tirou a
    // pessoa da lista primeiro, senão a explicação não corresponde ao código.
    const r = foraDaExperiencia(p({ dataAdmissao: "2025-01-01", dataDesligamento: "2026-01-10" }), HOJE)!;
    expect(r.motivo).toBe("desligado");
  });

  it("toda explicação é uma frase legível, sem código vazando", () => {
    const casos = [
      p({ dataAdmissao: "" }),
      p({ dataAdmissao: "2025-08-29" }),
      p({ dataAdmissao: "2026-09-01" }),
      p({ dataAdmissao: "2026-07-01", experienciaDecididaEm: "2026-08-01" }),
      p({ dataAdmissao: "2026-07-01", statusId: "inativo" }),
    ];
    for (const c of casos) {
      const r = foraDaExperiencia(c, HOJE)!;
      const frase = explicar(r);
      expect(frase.length).toBeGreaterThan(10);
      expect(frase).not.toContain("undefined");
      expect(frase).not.toContain("NaN");
      expect(frase).not.toContain("Invalid");
    }
  });
});
