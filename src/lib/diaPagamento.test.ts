import { describe, it, expect } from "vitest";
import {
  nEsimoDiaUtil, diaDoPagamento, diaDoAdiantamento, feriadosDe, ehDiaUtil,
  DIA_ADIANTAMENTO,
} from "@/lib/diaPagamento";

const semFeriado = feriadosDe([]);
const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("5º dia útil — a data do salário (art. 459)", () => {
  it("agosto/2026 começa num sábado: o 5º útil é dia 7", () => {
    // 01 sáb, 02 dom, 03 seg(1º), 04 ter(2º), 05 qua(3º), 06 qui(4º), 07 sex(5º)
    expect(dia(diaDoPagamento(2026, 7, semFeriado))).toBe("2026-08-07");
  });

  it("setembro/2026 começa numa terça: o 5º útil é dia 7", () => {
    // 01 ter(1º), 02 qua(2º), 03 qui(3º), 04 sex(4º), 05 sáb, 06 dom, 07 seg(5º)
    expect(dia(diaDoPagamento(2026, 8, semFeriado))).toBe("2026-09-07");
  });

  it("mês que começa na segunda: o 5º útil é a sexta, dia 5", () => {
    expect(dia(diaDoPagamento(2026, 5, semFeriado))).toBe("2026-06-05"); // 01/06/2026 é segunda
  });

  it("feriado no meio empurra o pagamento", () => {
    // 07/09 (Independência) é o 5º útil de setembro. Com ele como feriado,
    // o 5º passa a ser o dia 8.
    const comFeriado = feriadosDe([{ tipo: "Feriado", data: "2026-09-07", recorrenteAnual: true }]);
    expect(dia(diaDoPagamento(2026, 8, comFeriado))).toBe("2026-09-08");
  });

  it("feriado que se repete todo ano vale em qualquer ano", () => {
    const natal = feriadosDe([{ tipo: "Feriado", data: "2020-12-25", recorrenteAnual: true }]);
    expect(ehDiaUtil(new Date(2026, 11, 25), natal)).toBe(false);
    expect(ehDiaUtil(new Date(2030, 11, 25), natal)).toBe(false);
  });

  it("feriado NÃO recorrente vale só no ano dele", () => {
    const pontual = feriadosDe([{ tipo: "Feriado", data: "2026-10-15", recorrenteAnual: false }]);
    expect(ehDiaUtil(new Date(2026, 9, 15), pontual)).toBe(false);
    expect(ehDiaUtil(new Date(2027, 9, 15), pontual)).toBe(true);
  });

  it("evento que não é feriado não muda a conta", () => {
    const reuniao = feriadosDe([{ tipo: "Reunião", data: "2026-08-05", recorrenteAnual: false }]);
    expect(dia(diaDoPagamento(2026, 7, reuniao))).toBe("2026-08-07");
  });

  it("fim de semana nunca é dia útil", () => {
    expect(ehDiaUtil(new Date(2026, 7, 1), semFeriado)).toBe(false); // sábado
    expect(ehDiaUtil(new Date(2026, 7, 2), semFeriado)).toBe(false); // domingo
    expect(ehDiaUtil(new Date(2026, 7, 3), semFeriado)).toBe(true);  // segunda
  });

  it("todo mês de 2026 tem 5º dia útil, e ele nunca passa do dia 9", () => {
    for (let m = 0; m < 12; m++) {
      const d = diaDoPagamento(2026, m, semFeriado);
      expect(d, `mês ${m + 1}`).not.toBeNull();
      expect(d!.getDate(), `mês ${m + 1}`).toBeLessThanOrEqual(9);
    }
  });

  it("pedir mais dias úteis do que o mês tem devolve null, não uma data errada", () => {
    expect(nEsimoDiaUtil(2026, 1, 40, semFeriado)).toBeNull();
    expect(nEsimoDiaUtil(2026, 1, 0, semFeriado)).toBeNull();
  });
});

describe("dia 20 — o adiantamento", () => {
  it("no dia útil, é o próprio 20", () => {
    expect(dia(diaDoAdiantamento(2026, 7, semFeriado))).toBe("2026-08-20"); // quinta
    expect(DIA_ADIANTAMENTO).toBe(20);
  });

  it("caindo no domingo, antecipa para a sexta", () => {
    // 20/09/2026 é domingo -> 18/09 (sexta)
    expect(dia(diaDoAdiantamento(2026, 8, semFeriado))).toBe("2026-09-18");
  });

  it("caindo no sábado, antecipa para a sexta", () => {
    // 20/06/2026 é sábado -> 19/06 (sexta)
    expect(dia(diaDoAdiantamento(2026, 5, semFeriado))).toBe("2026-06-19");
  });

  it("feriado no dia 20 também antecipa", () => {
    const f = feriadosDe([{ tipo: "Feriado", data: "2026-08-20", recorrenteAnual: false }]);
    expect(dia(diaDoAdiantamento(2026, 7, f))).toBe("2026-08-19");
  });

  it("nunca ATRASA — a data devolvida é sempre <= 20", () => {
    for (let m = 0; m < 12; m++) {
      expect(diaDoAdiantamento(2026, m, semFeriado).getDate(), `mês ${m + 1}`).toBeLessThanOrEqual(20);
    }
  });
});
