import { describe, it, expect } from "vitest";
import { decomporFaltas } from "@/pages/Ponto";
import type { PontoDia } from "@/data/types";

const dia = (data: string, situacao: PontoDia["situacao"], faltasMin = 0): PontoDia =>
  ({ data, situacao, faltasMin, normaisMin: 0, extrasMin: 0 });

/* Corrigir um dia para "Atestado" AUMENTAVA o desconto ~20% em vez de zerar:
   os minutos daquele dia continuavam no total do mês e, ao deixarem de ser
   falta de dia inteiro, caíam no balde de ATRASO — cobrado por hora e com
   reflexo de DSR. O rodapé do próprio modal promete o contrário. */
describe("decomporFaltas — corrigir o dia não pode aumentar o desconto", () => {
  const mes = (situacaoDoDia15: PontoDia["situacao"]) => ({
    faltasMin: 528,                       // 08:48, o dia inteiro
    dias: [
      dia("2026-07-14", "normal"),
      dia("2026-07-15", situacaoDoDia15, 528),
      dia("2026-07-16", "normal"),
    ],
  });

  it("como falta: um dia cheio, nenhum atraso", () => {
    const r = decomporFaltas(mes("falta"));
    expect(r.diasCheios).toBe(1);
    expect(r.minutosAtraso).toBe(0);
  });

  it("virou atestado: ZERA tudo — nem dia cheio, nem atraso", () => {
    const r = decomporFaltas(mes("atestado"));
    expect(r.diasCheios).toBe(0);
    expect(r.minutosAtraso).toBe(0);   // era 528 → 8,8h cobradas por hora
  });

  it("abono, férias, feriado e folga também não descontam", () => {
    for (const s of ["abono", "ferias", "feriado", "folga"] as const) {
      expect(decomporFaltas(mes(s)).minutosAtraso, s).toBe(0);
    }
  });

  it("atraso de verdade num dia normal continua contando", () => {
    const r = decomporFaltas({
      faltasMin: 45,
      dias: [dia("2026-07-14", "normal", 45), dia("2026-07-15", "normal")],
    });
    expect(r.minutosAtraso).toBe(45);
    expect(r.diasCheios).toBe(0);
  });

  it("falta cheia e atraso no mesmo mês somam cada um no seu balde", () => {
    const r = decomporFaltas({
      faltasMin: 573,
      dias: [dia("2026-07-14", "falta", 528), dia("2026-07-15", "normal", 45)],
    });
    expect(r.diasCheios).toBe(1);
    expect(r.minutosAtraso).toBe(45);
  });

  it("sem detalhe diário, cai na sobra do total (ficha lançada à mão)", () => {
    const r = decomporFaltas({ faltasMin: 120, dias: [] });
    expect(r.minutosAtraso).toBe(120);
    expect(r.temDetalhe).toBe(false);
  });

  it("feriados do PDF continuam sendo colhidos", () => {
    const r = decomporFaltas({ faltasMin: 0, dias: [dia("2026-07-09", "feriado")] });
    expect(r.feriadosISO).toEqual(["2026-07-09"]);
  });
});
