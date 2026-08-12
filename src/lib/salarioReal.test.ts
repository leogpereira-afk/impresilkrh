import { describe, it, expect } from "vitest";
import {
  ultimaCompetenciaFechada, salarioPorPessoa, resumoDoCargo, posicaoEntre, mesProporcional,
  type PagamentoLike,
} from "@/lib/salarioReal";

const p = (colaboradorId: string, competencia: string, tipo: string, valor: number): PagamentoLike =>
  ({ colaboradorId, competencia, tipo, valor });

describe("ultimaCompetenciaFechada", () => {
  it("O CASO QUE IMPORTA: mês só com adiantamento NÃO conta como fechado", () => {
    /* Medido em 10/08/2026: 2026-07 tinha 29 adiantamentos e ZERO salários. Usar
       o mês mais recente mostraria ~40% do que se paga, e uma proposta de
       contratação sairia pela metade. */
    const pgs = [
      p("a", "2026-06", "Salário", 1500), p("a", "2026-06", "Adiantamento", 1000),
      p("a", "2026-07", "Adiantamento", 1000),
    ];
    expect(ultimaCompetenciaFechada(pgs)).toBe("2026-06");
  });

  it("pega a mais recente entre as fechadas", () => {
    const pgs = [p("a", "2026-01", "Salário", 1), p("a", "2026-05", "Salário", 1), p("a", "2026-03", "Salário", 1)];
    expect(ultimaCompetenciaFechada(pgs)).toBe("2026-05");
  });

  it("sem nenhum salário lançado, devolve null em vez de inventar mês", () => {
    expect(ultimaCompetenciaFechada([p("a", "2026-07", "Adiantamento", 1000)])).toBeNull();
    expect(ultimaCompetenciaFechada([])).toBeNull();
  });

  it("rubrica variável não fecha o mês", () => {
    const pgs = [p("a", "2026-07", "Horas Extras", 300), p("a", "2026-07", "Comissão", 500)];
    expect(ultimaCompetenciaFechada(pgs)).toBeNull();
  });
});

describe("salarioPorPessoa", () => {
  it("soma as DUAS metades do salário", () => {
    // Adiantamento (~dia 20) + saldo (5º dia útil) = o salário do mês.
    const pgs = [p("a", "2026-06", "Adiantamento", 1000), p("a", "2026-06", "Salário", 1500)];
    expect(salarioPorPessoa(pgs, "2026-06").get("a")).toBe(2500);
  });

  it("ignora rubrica variável — não é o que se combina numa contratação", () => {
    const pgs = [
      p("a", "2026-06", "Salário", 2000),
      p("a", "2026-06", "Horas Extras", 800),
      p("a", "2026-06", "Comissão", 500),
      p("a", "2026-06", "13º Salário", 2000),
    ];
    expect(salarioPorPessoa(pgs, "2026-06").get("a")).toBe(2000);
  });

  it("ignora outras competências", () => {
    const pgs = [p("a", "2026-06", "Salário", 2000), p("a", "2026-05", "Salário", 9999)];
    expect(salarioPorPessoa(pgs, "2026-06").get("a")).toBe(2000);
  });

  it("separa por pessoa", () => {
    const pgs = [p("a", "2026-06", "Salário", 2000), p("b", "2026-06", "Salário", 3000)];
    const m = salarioPorPessoa(pgs, "2026-06");
    expect(m.get("a")).toBe(2000);
    expect(m.get("b")).toBe(3000);
  });

  it("valor ausente não vira NaN", () => {
    const pgs = [{ colaboradorId: "a", competencia: "2026-06", tipo: "Salário", valor: null }];
    expect(salarioPorPessoa(pgs, "2026-06").get("a")).toBe(0);
  });
});

describe("resumoDoCargo", () => {
  it("usa MEDIANA, não média — um salário fora da curva não torce a proposta", () => {
    // Média seria 3400; a mediana descreve o cargo de verdade.
    const r = resumoDoCargo([2000, 2100, 2200, 2300, 12400])!;
    expect(r.mediana).toBe(2200);
    expect(r.menor).toBe(2000);
    expect(r.maior).toBe(12400);
    expect(r.quantos).toBe(5);
  });

  it("mediana com número par de pessoas é a média das duas do meio", () => {
    expect(resumoDoCargo([2000, 2200, 2400, 2600])!.mediana).toBe(2300);
  });

  it("uma pessoa só: menor, maior e mediana são ela", () => {
    const r = resumoDoCargo([2500])!;
    expect([r.menor, r.mediana, r.maior]).toEqual([2500, 2500, 2500]);
  });

  it("cargo sem ninguém pago devolve null em vez de zero", () => {
    // Zero seria lido como "paga R$ 0", que é diferente de "não sei".
    expect(resumoDoCargo([])).toBeNull();
    expect(resumoDoCargo([0, 0])).toBeNull();
  });
});

describe("posicaoEntre", () => {
  it("menor fica no começo, maior no fim, meio no meio", () => {
    expect(posicaoEntre(2000, 2000, 4000)).toBe(0);
    expect(posicaoEntre(4000, 2000, 4000)).toBe(100);
    expect(posicaoEntre(3000, 2000, 4000)).toBe(50);
  });

  it("todos iguais (ou uma pessoa só) não divide por zero", () => {
    expect(posicaoEntre(2500, 2500, 2500)).toBe(50);
  });

  it("fora do intervalo fica preso nas pontas", () => {
    expect(posicaoEntre(9999, 2000, 4000)).toBe(100);
    expect(posicaoEntre(10, 2000, 4000)).toBe(0);
  });
});

describe("mesProporcional", () => {
  const C = "2026-06";
  it("O CASO QUE IMPORTA: admitido no meio do mês tem salário proporcional", () => {
    // Foi o que produziu "menor R$ 474,42" num cargo de 7 pessoas.
    expect(mesProporcional({ dataAdmissao: "2026-06-17" }, C)).toBe(true);
  });

  it("desligado no meio do mês também", () => {
    expect(mesProporcional({ dataAdmissao: "2020-01-01", dataDesligamento: "2026-06-10" }, C)).toBe(true);
  });

  it("mês inteiro trabalhado não é proporcional", () => {
    expect(mesProporcional({ dataAdmissao: "2020-01-01" }, C)).toBe(false);
    expect(mesProporcional({ dataAdmissao: "2026-05-31" }, C)).toBe(false);
  });

  it("desligado DEPOIS do mês não afeta aquele mês", () => {
    expect(mesProporcional({ dataAdmissao: "2020-01-01", dataDesligamento: "2026-08-01" }, C)).toBe(false);
  });

  it("sem datas, assume mês inteiro — não inventa proporcionalidade", () => {
    expect(mesProporcional({}, C)).toBe(false);
  });
});
