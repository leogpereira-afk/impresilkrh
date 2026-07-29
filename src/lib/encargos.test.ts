// Encargos da folha. Erro aqui aparece direto no custo por pessoa e no
// fechamento contra o DRE — então cada regra fica travada por teste.
import { describe, it, expect } from "vitest";
import { baseEncargos, calcularEncargos, ehContaDeFuncionarios, FGTS_PCT } from "./encargos";

const l = (tipo: string, valor: number) => ({ tipo, valor });

describe("baseEncargos", () => {
  it("soma salário e adiantamento (juntos = 1 salário)", () => {
    expect(baseEncargos([l("Salário", 2000), l("Adiantamento", 500)])).toBe(2500);
  });

  it("NÃO inclui Limpeza/Faxina — decisão do Leonardo: entra no pago, não no encargo", () => {
    expect(baseEncargos([l("Salário", 2000), l("Limpeza e Faxina", 300)])).toBe(2000);
  });

  it("ignora horas extras e comissão na base", () => {
    expect(baseEncargos([l("Salário", 2000), l("Horas Extras", 400), l("Comissão", 900)])).toBe(2000);
  });

  it("sem lançamento nenhum, base zero (não quebra)", () => {
    expect(baseEncargos([])).toBe(0);
  });
});

describe("calcularEncargos", () => {
  it("FGTS é 8% do bruto", () => {
    const e = calcularEncargos([l("Salário", 1000)]);
    expect(e.fgts).toBeCloseTo(80, 6);
    expect(FGTS_PCT).toBe(0.08);
  });

  it("13º provisiona 1/12", () => {
    expect(calcularEncargos([l("Salário", 1200)]).decimoTerceiro).toBeCloseTo(100, 6);
  });

  it("férias provisionam 1/12 + 1/3 constitucional", () => {
    const e = calcularEncargos([l("Salário", 1200)]);
    expect(e.ferias).toBeCloseTo(133.33, 1); // 100 + 1/3
  });

  it("FGTS lançado (rescisão) SOMA ao estimado, não substitui", () => {
    const semRescisao = calcularEncargos([l("Salário", 1000)]);
    const comRescisao = calcularEncargos([l("Salário", 1000)], 500);
    expect(comRescisao.total).toBeCloseTo(semRescisao.total + 500, 6);
    expect(comRescisao.fgts).toBeCloseTo(80, 6); // o estimado continua igual
  });

  it("o total é a soma das partes", () => {
    const e = calcularEncargos([l("Salário", 3000), l("Adiantamento", 1000)], 250);
    expect(e.total).toBeCloseTo(e.fgts + e.decimoTerceiro + e.ferias + e.fgtsLancado, 6);
    expect(e.bruto).toBe(4000);
  });
});

describe("ehContaDeFuncionarios", () => {
  it("pega as contas do grupo de pessoal", () => {
    expect(ehContaDeFuncionarios("2.1.01")).toBe(true);
    expect(ehContaDeFuncionarios("2.1.99.03")).toBe(true);
  });

  it("NÃO pega 2.10/2.11/2.12 — foi esse bug que descasou o RH do DRE", () => {
    expect(ehContaDeFuncionarios("2.10")).toBe(false);
    expect(ehContaDeFuncionarios("2.11.05")).toBe(false);
    expect(ehContaDeFuncionarios("2.12")).toBe(false);
  });

  it("outros grupos ficam de fora", () => {
    expect(ehContaDeFuncionarios("3.1.01")).toBe(false);
    expect(ehContaDeFuncionarios("")).toBe(false);
  });
});
