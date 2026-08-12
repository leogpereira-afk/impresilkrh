import { describe, it, expect } from "vitest";
import { posicaoNaFaixa } from "@/lib/posicaoNaFaixa";

const FAIXA = [2000, 2500, 3000, 3500, 4000]; // piso 2000, teto 4000

describe("posicaoNaFaixa", () => {
  it("no piso fica no começo da régua; no teto, no fim", () => {
    expect(posicaoNaFaixa(2000, FAIXA)!.pct).toBe(0);
    expect(posicaoNaFaixa(4000, FAIXA)!.pct).toBe(100);
  });

  it("no meio da faixa fica no meio da régua", () => {
    expect(posicaoNaFaixa(3000, FAIXA)!.pct).toBe(50);
  });

  it("O CASO QUE IMPORTA: N1 e N5 deixam de ser a mesma coisa", () => {
    // Os dois são "Dentro" pelo enquadramento; a régua é o que mostra que um
    // tem espaço para crescer no cargo e o outro já chegou ao teto.
    const n1 = posicaoNaFaixa(2000, FAIXA)!;
    const n5 = posicaoNaFaixa(4000, FAIXA)!;
    expect(n1.enquadramento).toBe(n5.enquadramento);
    expect(n1.pct).not.toBe(n5.pct);
  });

  it("acima do teto: bolinha presa no fim, mas marcada como fora", () => {
    const r = posicaoNaFaixa(5000, FAIXA)!;
    expect(r.pct).toBe(100);
    expect(r.foraDaFaixa).toBe(true);
    expect(r.enquadramento).toBe("Acima");
  });

  it("abaixo do piso: presa no começo, e marcada como fora", () => {
    const r = posicaoNaFaixa(1900, FAIXA)!;
    expect(r.pct).toBe(0);
    expect(r.foraDaFaixa).toBe(true);
  });

  it("bem abaixo do piso vira Crítico", () => {
    expect(posicaoNaFaixa(1500, FAIXA)!.enquadramento).toBe("Crítico");
  });

  it("faixa de valor único não divide por zero", () => {
    const r = posicaoNaFaixa(3000, [3000, 3000, 3000, 3000, 3000])!;
    expect(Number.isFinite(r.pct)).toBe(true);
    expect(r.pct).toBe(50);
  });

  it("sem salário ou sem faixa, não inventa posição", () => {
    expect(posicaoNaFaixa(null, FAIXA)).toBeNull();
    expect(posicaoNaFaixa(undefined, FAIXA)).toBeNull();
    expect(posicaoNaFaixa(3000, [])).toBeNull();
    expect(posicaoNaFaixa(3000, undefined)).toBeNull();
  });

  it("salário inválido não vira NaN na tela", () => {
    expect(posicaoNaFaixa(NaN, FAIXA)).toBeNull();
    expect(posicaoNaFaixa(Infinity, FAIXA)).toBeNull();
  });
});
