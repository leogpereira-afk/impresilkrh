import { describe, expect, it } from "vitest";
import { compararPlano, juntarContas, montarPlanoDoErp, type ContaMubi } from "./mubiPlano";
import type { ContaPlano } from "@/data/types";

const c = (codigo: string, valor: number, nome = codigo, quantos = 1): ContaMubi => ({ codigo, nome, valor, quantos });

describe("juntarContas — páginas do mesmo mês", () => {
  it("soma a mesma conta vinda de duas páginas e ordena por código", () => {
    expect(juntarContas([
      [c("2.1.11", 100.5), c("2.1.1", 200)],
      [c("2.1.11", 50.25)],
    ])).toEqual([
      { codigo: "2.1.1", nome: "2.1.1", valor: 200, quantos: 1 },
      { codigo: "2.1.11", nome: "2.1.11", valor: 150.75, quantos: 2 },
    ]);
  });

  it("ordena por número, não por texto: 2.1.2 vem antes de 2.1.11", () => {
    const r = juntarContas([[c("2.1.11", 1), c("2.1.2", 1), c("2.1.1", 1)]]);
    expect(r.map((x) => x.codigo)).toEqual(["2.1.1", "2.1.2", "2.1.11"]);
  });

  it("nome vazio numa página não apaga o nome que veio na outra", () => {
    const r = juntarContas([[c("2.1.1", 1, "")], [c("2.1.1", 1, "Salário")]]);
    expect(r[0].nome).toBe("Salário");
  });

  it("nada a juntar devolve lista vazia", () => {
    expect(juntarContas([])).toEqual([]);
    expect(juntarContas([[]])).toEqual([]);
  });
});

describe("montarPlanoDoErp", () => {
  it("vira registro do plano com id estável e origem marcada", () => {
    const [x] = montarPlanoDoErp([c("2.1.15.4", 411.444, "Aniversário do mês")], "2026-08");
    expect(x).toEqual({
      id: "pc_2026-08_2.1.15.4", competencia: "2026-08", codigo: "2.1.15.4",
      nome: "Aniversário do mês", valor: 411.44, folha: true, origem: "erp",
    });
  });

  it("conta-pai e conta-filha convivem, as duas como folha", () => {
    // No ERP cada título está em UMA conta: 2.1.11 e 2.1.11.4 não se sobrepõem.
    // Marcar a pai como não-folha jogaria fora o que foi lançado direto nela.
    const r = montarPlanoDoErp([c("2.1.11", 1000), c("2.1.11.4", 400)], "2026-08");
    expect(r.every((x) => x.folha)).toBe(true);
    expect(r.reduce((s, x) => s + x.valor, 0)).toBe(1400);
  });

  it("conta sem código ou com valor inválido não entra", () => {
    expect(montarPlanoDoErp([c("", 10), { codigo: "2.1.1", nome: "x", valor: NaN, quantos: 1 }], "2026-08")).toEqual([]);
  });

  it("nome vazio cai para o código, para a linha nunca aparecer anônima", () => {
    expect(montarPlanoDoErp([c("2.1.9", 5, "")], "2026-08")[0].nome).toBe("2.1.9");
  });
});

describe("compararPlano — o que muda se o ERP entrar no lugar", () => {
  const conta = (codigo: string, valor: number, nome = codigo): ContaPlano =>
    ({ id: `pc_2026-06_${codigo}`, competencia: "2026-06", codigo, nome, valor, folha: true });

  it("mês vazio: tudo é conta nova", () => {
    const r = compararPlano([], [conta("2.1.1", 100)]);
    expect(r).toMatchObject({ novas: 1, iguais: 0, mudaram: 0, somem: 0, totalAntes: 0, totalDepois: 100 });
    expect(r.linhas[0]).toMatchObject({ estado: "nova", antes: null, depois: 100, dif: null });
  });

  it("separa igual, mudou, nova e some", () => {
    const r = compararPlano(
      [conta("2.1.1", 100), conta("2.1.2", 50), conta("2.1.9", 900, "FGTS")],
      [conta("2.1.1", 100), conta("2.1.2", 75), conta("2.1.14", 20)],
    );
    expect({ iguais: r.iguais, mudaram: r.mudaram, novas: r.novas, somem: r.somem }).toEqual({ iguais: 1, mudaram: 1, novas: 1, somem: 1 });
    const porCodigo = Object.fromEntries(r.linhas.map((l) => [l.codigo, l]));
    expect(porCodigo["2.1.2"]).toMatchObject({ estado: "mudou", antes: 50, depois: 75, dif: 25 });
    // A que some é a que mais importa: importar SUBSTITUI a competência, e o
    // contador lança provisão (FGTS) que não existe em contas a pagar.
    expect(porCodigo["2.1.9"]).toMatchObject({ estado: "some", antes: 900, depois: null, dif: null, nome: "FGTS" });
  });

  it("diferença de centavo não conta como mudança", () => {
    const r = compararPlano([conta("2.1.1", 100)], [conta("2.1.1", 100.004)]);
    expect(r.iguais).toBe(1);
    expect(r.mudaram).toBe(0);
  });

  it("o total só soma as contas folha (não duplica pai + filha da planilha)", () => {
    const pai: ContaPlano = { ...conta("2.1.11", 1400), folha: false };
    const r = compararPlano([pai, conta("2.1.11.4", 400)], []);
    expect(r.totalAntes).toBe(400);
  });

  it("ordena por número dentro do código", () => {
    const r = compararPlano([], [conta("2.1.11", 1), conta("2.1.2", 1)]);
    expect(r.linhas.map((l) => l.codigo)).toEqual(["2.1.2", "2.1.11"]);
  });
});
