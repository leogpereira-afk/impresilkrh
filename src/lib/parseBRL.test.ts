import { describe, it, expect } from "vitest";
import { parseBRL } from "@/lib/format";

describe("parseBRL", () => {
  it("O CASO QUE IMPORTA: formato brasileiro completo não vira NaN", () => {
    // Era o que fazia o salario sumir: "2.500,00" -> "2.500.00" -> NaN -> null.
    expect(parseBRL("2.500,00")).toBe(2500);
    expect(parseBRL("1.234.567,89")).toBe(1234567.89);
  });

  it("milhar sem decimal não vira número quebrado", () => {
    // "2.500" NAO pode virar 2.5.
    expect(parseBRL("2.500")).toBe(2500);
    expect(parseBRL("10.000")).toBe(10000);
  });

  it("número simples e com vírgula decimal", () => {
    expect(parseBRL("2500")).toBe(2500);
    expect(parseBRL("2500,50")).toBe(2500.5);
    expect(parseBRL("1234.56")).toBe(1234.56); // ponto decimal isolado
  });

  it("com R$ e espaços", () => {
    expect(parseBRL("R$ 2.500,00")).toBe(2500);
    expect(parseBRL(" 3000 ")).toBe(3000);
  });

  it("vazio ou lixo é null, não zero", () => {
    // Zero seria lido como "paga R$ 0"; null é "não informado".
    expect(parseBRL("")).toBeNull();
    expect(parseBRL("   ")).toBeNull();
    expect(parseBRL("abc")).toBeNull();
    expect(parseBRL(undefined as unknown as string)).toBeNull();
  });
});
