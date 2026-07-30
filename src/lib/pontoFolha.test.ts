// Ponto → dinheiro. Erro aqui paga a pessoa errado (ou desconta a mais), então
// cada regra fica travada por teste — começando pelos casos ruins.
import { describe, it, expect } from "vitest";
import {
  valorHora, calcularHoraExtra, calcularFalta, diasDaCompetencia, minutosEntre,
  horasDecimais, DIVISOR_MENSAL_PADRAO,
} from "./pontoFolha";

describe("valorHora", () => {
  it("salário 2000 ÷ 220 = 9,09", () => {
    expect(valorHora(2000)).toBe(9.09);
  });

  // Reinaldo e Karen estão sem salário no cadastro real: não pode explodir nem
  // inventar valor — tem que dar 0 e ser sinalizado como pendência.
  it("sem salário devolve 0 (não quebra)", () => {
    expect(valorHora(null)).toBe(0);
    expect(valorHora(undefined)).toBe(0);
    expect(valorHora(0)).toBe(0);
  });

  it("salário negativo ou lixo não vira valor negativo", () => {
    expect(valorHora(-2000)).toBe(0);
    expect(valorHora(NaN)).toBe(0);
  });

  it("divisor zerado cai no padrão em vez de dividir por zero", () => {
    expect(valorHora(2200, 0)).toBe(valorHora(2200, DIVISOR_MENSAL_PADRAO));
    expect(Number.isFinite(valorHora(2200, 0))).toBe(true);
  });
});

describe("calcularHoraExtra", () => {
  // Caso do exemplo combinado com o usuário: 5h37 com salário 2000.
  it("5h37 a +50% com salário 2000 = R$ 76,63", () => {
    const r = calcularHoraExtra({ salario: 2000, minutos: 337, fator: 1.5 });
    expect(r.valorHoraNormal).toBe(9.09);
    expect(r.valorHoraExtra).toBe(13.64);
    expect(r.valor).toBeCloseTo(76.63, 1);
    expect(r.semSalario).toBe(false);
  });

  it("+100% paga o dobro da hora normal", () => {
    const r = calcularHoraExtra({ salario: 2000, minutos: 60, fator: 2 });
    expect(r.valorHoraExtra).toBe(18.18);
    expect(r.valor).toBe(18.18);
  });

  it("sem salário marca semSalario para a tela avisar", () => {
    const r = calcularHoraExtra({ salario: null, minutos: 337 });
    expect(r.valor).toBe(0);
    expect(r.semSalario).toBe(true);
  });

  it("zero minutos não gera valor", () => {
    expect(calcularHoraExtra({ salario: 2000, minutos: 0 }).valor).toBe(0);
  });

  it("minutos negativos não viram crédito", () => {
    expect(calcularHoraExtra({ salario: 2000, minutos: -120 }).valor).toBe(0);
  });
});

describe("diasDaCompetencia", () => {
  // Julho/2026: 31 dias, começa numa quarta. Domingos: 5,12,19,26 = 4.
  it("julho/2026 tem 23 dias úteis e 4 domingos", () => {
    const r = diasDaCompetencia("2026-07");
    expect(r.totalDias).toBe(31);
    expect(r.repouso).toBe(4);
    expect(r.uteis).toBe(23);
  });

  it("feriado no meio da semana vira repouso e sai dos úteis", () => {
    const semFeriado = diasDaCompetencia("2026-07");
    const comFeriado = diasDaCompetencia("2026-07", ["2026-07-09"]); // uma quinta
    expect(comFeriado.uteis).toBe(semFeriado.uteis - 1);
    expect(comFeriado.repouso).toBe(semFeriado.repouso + 1);
  });

  it("competência inválida devolve zeros em vez de NaN", () => {
    expect(diasDaCompetencia("")).toEqual({ uteis: 0, repouso: 0, totalDias: 0 });
    expect(diasDaCompetencia("2026-13")).toEqual({ uteis: 0, repouso: 0, totalDias: 0 });
  });
});

describe("calcularFalta", () => {
  // 09h47 de falta, salário 2000, julho/2026 (23 úteis, 4 domingos).
  it("desconta as horas e o reflexo no DSR", () => {
    const r = calcularFalta({ salario: 2000, minutos: 587, competencia: "2026-07" });
    expect(r.valorHoras).toBeCloseTo(88.93, 1);
    // DSR = 88,93 / 23 × 4 ≈ 15,47
    expect(r.dsr).toBeCloseTo(15.47, 1);
    expect(r.total).toBeCloseTo(104.4, 1);
    expect(r.total).toBeGreaterThan(r.valorHoras); // reflexo sempre soma
  });

  it("comDsr=false desconta só as horas", () => {
    const r = calcularFalta({ salario: 2000, minutos: 587, competencia: "2026-07", comDsr: false });
    expect(r.dsr).toBe(0);
    expect(r.total).toBe(r.valorHoras);
  });

  // Competência inválida não pode gerar DSR do nada (divisão por zero úteis).
  it("competência inválida não inventa DSR", () => {
    const r = calcularFalta({ salario: 2000, minutos: 587, competencia: "xx" });
    expect(r.dsr).toBe(0);
    expect(Number.isFinite(r.total)).toBe(true);
  });

  it("sem falta não desconta nada", () => {
    const r = calcularFalta({ salario: 2000, minutos: 0, competencia: "2026-07" });
    expect(r.total).toBe(0);
  });
});

describe("minutosEntre", () => {
  it("18:00 → 21:30 = 210 min", () => {
    expect(minutosEntre("18:00", "21:30")).toBe(210);
  });

  it("vira meia-noite: 22:00 → 02:00 = 4h", () => {
    expect(minutosEntre("22:00", "02:00")).toBe(240);
  });

  it("horário vazio ou inválido devolve 0 em vez de NaN", () => {
    expect(minutosEntre("", "21:30")).toBe(0);
    expect(minutosEntre("18:00", "")).toBe(0);
    expect(minutosEntre("25:00", "26:00")).toBe(0);
    expect(minutosEntre("18h", "21h")).toBe(0);
  });

  it("mesmo horário é zero, não 24 horas", () => {
    expect(minutosEntre("08:00", "08:00")).toBe(0);
  });
});

describe("horasDecimais", () => {
  it("337 min = 5,62 h", () => {
    expect(horasDecimais(337)).toBe(5.62);
  });
});
