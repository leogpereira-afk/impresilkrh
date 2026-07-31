// Trava do campo de salário editável na ficha.
//
// O leitor de dinheiro (valorDigitado) precisa ADIVINHAR quando o texto mistura
// ponto e vírgula, e adivinhar errado em salário custa 100×. Estes testes fixam
// o que passa e o que é recusado antes de chegar ao leitor.
import { describe, it, expect } from "vitest";
import { dinheiroAmbiguo, valorDigitado } from "@/lib/pontoFolha";

describe("dinheiroAmbiguo", () => {
  it("aceita o que gente digita de verdade", () => {
    for (const bom of ["2500", "2500,38", "2.500,38", "1.234.567,89", "R$ 2.500,38", "2500.38", "1.050"]) {
      expect(dinheiroAmbiguo(bom), bom).toBe(false);
    }
  });

  it("recusa o ponto de milhar junto com o ponto de centavo (erro de 100x)", () => {
    // "2.500.38" seria lido como 250038 — R$ 250 mil no lugar de R$ 2.500,38.
    expect(dinheiroAmbiguo("2.500.38")).toBe(true);
    expect(valorDigitado("2.500.38")).toBe(250038); // o motivo da trava existir
  });

  it("recusa o formato americano colado de planilha", () => {
    // "2,500.38" seria lido como 2,50 — mil vezes menos.
    expect(dinheiroAmbiguo("2,500.38")).toBe(true);
    expect(valorDigitado("2,500.38")).toBeCloseTo(2.50038, 5);
  });

  it("recusa centavo com três casas e vírgula repetida", () => {
    expect(dinheiroAmbiguo("2500,384")).toBe(true);
    expect(dinheiroAmbiguo("2,5,38")).toBe(true);
  });

  it("recusa texto que não é número", () => {
    for (const ruim of ["abc", "2500x", "R$", "2500-38"]) {
      expect(dinheiroAmbiguo(ruim), ruim).toBe(true);
    }
  });

  it("os salários gravados voltam iguais ao reabrir o campo", () => {
    // O editor abre com String(salario); o valor tem de sobreviver ao ciclo.
    for (const s of [1518, 1955.43, 2215.38, 3000, 12500.5]) {
      const texto = String(s);
      expect(dinheiroAmbiguo(texto), texto).toBe(false);
      expect(valorDigitado(texto), texto).toBe(s);
    }
  });
});
