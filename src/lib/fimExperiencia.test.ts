import { describe, it, expect } from "vitest";
import { fimDaExperiencia, LIMITE_EXPERIENCIA_DIAS } from "@/lib/clt";
import type { Colaborador } from "@/data/types";

const HOJE = new Date("2026-08-05T12:00:00");
const colab = (p: Partial<Colaborador>) => ({ id: "c", nome: "X", ...p }) as Colaborador;

describe("fimDaExperiencia — o marco que encerra o onboarding", () => {
  it("são 90 dias contados da admissão", () => {
    expect(LIMITE_EXPERIENCIA_DIAS).toBe(90);
    const r = fimDaExperiencia(colab({ dataAdmissao: "2026-08-04" }), HOJE);
    expect(r.fim?.getMonth()).toBe(10); // novembro
    expect(r.diasParaFim).toBe(89);
    expect(r.encerrada).toBe(false);
  });

  it("o caso do Victor: admitido ontem, a experiência mal começou", () => {
    const r = fimDaExperiencia(colab({ dataAdmissao: "2026-08-04" }), HOJE);
    expect(r.encerrada).toBe(false);
    expect(r.decidida).toBe(false);
  });

  it("passados os 90 dias, encerrada", () => {
    const r = fimDaExperiencia(colab({ dataAdmissao: "2026-01-10" }), HOJE);
    expect(r.encerrada).toBe(true);
    expect(r.diasParaFim).toBeLessThan(0);
  });

  it("DIFERENTE de situacaoExperiencia: continua respondendo depois de decidida", () => {
    // situacaoExperiencia devolve null quando já foi decidida — serve para
    // avisar. Aqui o onboarding precisa do fato, decidido ou não.
    const r = fimDaExperiencia(
      colab({ dataAdmissao: "2026-01-10", experienciaDecididaEm: "2026-04-01" }), HOJE);
    expect(r.fim).not.toBeNull();
    expect(r.encerrada).toBe(true);
    expect(r.decidida).toBe(true);
  });

  it("quem saiu tem a experiência dada por decidida", () => {
    expect(fimDaExperiencia(colab({ dataAdmissao: "2026-05-06", dataDesligamento: "2026-06-22" }), HOJE).decidida)
      .toBe(true);
  });

  it("sem data de admissão não inventa prazo", () => {
    const r = fimDaExperiencia(colab({}), HOJE);
    expect(r.fim).toBeNull();
    expect(r.encerrada).toBe(false);
    expect(Number.isNaN(r.diasParaFim)).toBe(true);
  });

  it("a resposta não muda com a hora do dia", () => {
    const manha = fimDaExperiencia(colab({ dataAdmissao: "2026-08-04" }), new Date("2026-08-05T06:00:00"));
    const noite = fimDaExperiencia(colab({ dataAdmissao: "2026-08-04" }), new Date("2026-08-05T23:30:00"));
    expect(manha.diasParaFim).toBe(noite.diasParaFim);
  });
});
