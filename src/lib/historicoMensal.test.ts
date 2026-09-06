import { describe, expect, it } from "vitest";
import { mesAnterior, resumirHistorico } from "./historicoMensal";

describe("resumirHistorico", () => {
  it("vazio não quebra e não inventa média", () => {
    const r = resumirHistorico([]);
    expect(r.meses).toBe(0);
    expect(r.media).toBe(0);
    expect(r.maior).toBeNull();
    expect(r.ultimoVsMedia).toBeNull();
    expect(r.linhas).toEqual([]);
  });

  it("um mês só: sem anterior, sem delta, barra cheia", () => {
    const r = resumirHistorico([{ competencia: "2026-08", valor: 3172.07 }]);
    expect(r.meses).toBe(1);
    expect(r.total).toBe(3172.07);
    expect(r.media).toBe(3172.07);
    expect(r.ultimoVsMedia).toBe(0);
    expect(r.linhas[0]).toMatchObject({ anterior: null, delta: null, pct: null, parcela: 1, lacuna: false, ano: 2026, primeiroDoAno: true });
  });

  it("ordena por competência mesmo recebendo fora de ordem", () => {
    const r = resumirHistorico([
      { competencia: "2026-08", valor: 300 },
      { competencia: "2026-06", valor: 100 },
      { competencia: "2026-07", valor: 200 },
    ]);
    expect(r.linhas.map((l) => l.competencia)).toEqual(["2026-06", "2026-07", "2026-08"]);
    expect(r.linhas[1]).toMatchObject({ anterior: 100, delta: 100, pct: 1 });
    expect(r.linhas[2]).toMatchObject({ anterior: 200, delta: 100, pct: 0.5 });
  });

  it("duas linhas do mesmo mês viram UM mês (soma), não dois", () => {
    const r = resumirHistorico([
      { competencia: "2026-08", valor: 100 },
      { competencia: "2026-08", valor: 50.5 },
    ]);
    expect(r.meses).toBe(1);
    expect(r.total).toBe(150.5);
  });

  it("buraco na série é marcado como lacuna — a comparação pula um mês sem lançamento", () => {
    const r = resumirHistorico([
      { competencia: "2026-05", valor: 100 },
      { competencia: "2026-07", valor: 120 },
    ]);
    expect(r.linhas[1].lacuna).toBe(true);
    expect(r.linhas[1].delta).toBe(20);
    const semBuraco = resumirHistorico([
      { competencia: "2025-12", valor: 100 },
      { competencia: "2026-01", valor: 120 },
    ]);
    expect(semBuraco.linhas[1].lacuna).toBe(false);
  });

  it("anterior zero não divide por zero: pct fica null, delta continua", () => {
    const r = resumirHistorico([
      { competencia: "2026-06", valor: 0 },
      { competencia: "2026-07", valor: 80 },
    ]);
    expect(r.linhas[1].pct).toBeNull();
    expect(r.linhas[1].delta).toBe(80);
  });

  it("maior, menor, último e último contra a média", () => {
    const r = resumirHistorico([
      { competencia: "2026-06", valor: 100 },
      { competencia: "2026-07", valor: 300 },
      { competencia: "2026-08", valor: 200 },
    ]);
    expect(r.maior).toEqual({ competencia: "2026-07", valor: 300 });
    expect(r.menor).toEqual({ competencia: "2026-06", valor: 100 });
    expect(r.ultimo).toEqual({ competencia: "2026-08", valor: 200 });
    expect(r.media).toBe(200);
    expect(r.ultimoVsMedia).toBe(0);
    expect(r.linhas.map((l) => l.parcela)).toEqual([1 / 3, 1, 2 / 3]);
  });

  it("empate no maior fica com o mais antigo", () => {
    const r = resumirHistorico([
      { competencia: "2026-06", valor: 100 },
      { competencia: "2026-07", valor: 100 },
    ]);
    expect(r.maior?.competencia).toBe("2026-06");
  });

  it("marca o primeiro mês de cada ano (divisor da lista)", () => {
    const r = resumirHistorico([
      { competencia: "2025-11", valor: 1 },
      { competencia: "2025-12", valor: 1 },
      { competencia: "2026-01", valor: 1 },
      { competencia: "2026-02", valor: 1 },
    ]);
    expect(r.linhas.map((l) => l.primeiroDoAno)).toEqual([true, false, true, false]);
  });

  it("mês anterior negativo não vira percentual de sinal trocado", () => {
    const r = resumirHistorico([
      { competencia: "2026-06", valor: -50 },
      { competencia: "2026-07", valor: 100 },
    ]);
    expect(r.linhas[1].delta).toBe(150);
    expect(r.linhas[1].pct).toBeNull();
  });

  it("valor negativo (estorno) não estoura a barra", () => {
    const r = resumirHistorico([
      { competencia: "2026-06", valor: -50 },
      { competencia: "2026-07", valor: 100 },
    ]);
    expect(r.linhas[0].parcela).toBe(0);
  });

  it("ignora ponto sem competência e valor não numérico vira zero", () => {
    const r = resumirHistorico([
      { competencia: "", valor: 999 },
      { competencia: "2026-08", valor: Number("abc") },
    ]);
    expect(r.meses).toBe(1);
    expect(r.total).toBe(0);
  });
});

describe("mesAnterior", () => {
  it("vira o ano", () => {
    expect(mesAnterior("2026-01")).toBe("2025-12");
    expect(mesAnterior("2026-08")).toBe("2026-07");
  });
  it("entrada inválida devolve vazio", () => {
    expect(mesAnterior("")).toBe("");
    expect(mesAnterior("abc")).toBe("");
  });
});
