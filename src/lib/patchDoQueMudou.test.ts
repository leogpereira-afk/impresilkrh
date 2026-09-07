import { describe, expect, it } from "vitest";
import { patchDoQueMudou } from "./patchDoQueMudou";

describe("patchDoQueMudou", () => {
  const antes = { nome: "Serralheiro", descricao: "solda", faixas: [0, 0, 0, 0, 0], salario: 2000, telefone: "1" };

  it("manda só o campo que mudou", () => {
    expect(patchDoQueMudou(antes, { ...antes, salario: 2500 })).toEqual({ salario: 2500 });
  });

  it("campo não tocado não vai — mesmo que o retrato esteja velho", () => {
    // O pull trouxe faixas novas para o store; o formulário ainda tem [0,0,0,0,0].
    // Como o formulário não mexeu nelas, elas não entram no patch e não apagam nada.
    expect(patchDoQueMudou(antes, { ...antes, nome: "Serralheiro Sênior" })).toEqual({ nome: "Serralheiro Sênior" });
  });

  it("'nunca' fica de fora mesmo que tenha mudado; 'sempre' entra mesmo igual", () => {
    const p = patchDoQueMudou(antes, { ...antes, faixas: [1, 2, 3, 4, 5], salario: 2000 }, { nunca: ["faixas"], sempre: ["salario"] });
    expect(p).toEqual({ salario: 2000 });
  });

  it("undefined e null valem o mesmo que ausente", () => {
    const antes = { a: null, b: undefined } as { a: string | null; b: string | null | undefined };
    expect(patchDoQueMudou(antes, { a: undefined, b: null })).toEqual({});
  });

  it("objeto e lista comparam pelo conteúdo", () => {
    expect(patchDoQueMudou({ f: [1, 2] }, { f: [1, 2] })).toEqual({});
    expect(patchDoQueMudou({ f: [1, 2] }, { f: [2, 1] })).toEqual({ f: [2, 1] });
  });
});
