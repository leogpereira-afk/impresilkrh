import { describe, expect, it } from "vitest";
import { faltasDoMes, noQuadroEm, pagosForaDoQuadro, quadroDoMes, quantosNoQuadro } from "./quadroNoMes";
import type { Colaborador } from "@/data/types";

const c = (over: Partial<Colaborador> & { id: string; nome: string }): Colaborador =>
  ({ statusId: "ativo", ...over }) as Colaborador;

describe("noQuadroEm", () => {
  it("quem entrou depois não conta no mês anterior", () => {
    const x = c({ id: "a", nome: "A", dataAdmissao: "2026-07-10" });
    expect(noQuadroEm(x, "2026-06")).toBe(false);
    expect(noQuadroEm(x, "2026-07")).toBe(true);
    expect(noQuadroEm(x, "2026-08")).toBe(true);
  });

  it("quem saiu conta no mês da saída e some depois", () => {
    const x = c({ id: "b", nome: "B", statusId: "inativo", dataAdmissao: "2024-01-05", dataDesligamento: "2026-06-20" });
    expect(noQuadroEm(x, "2026-05")).toBe(true);
    expect(noQuadroEm(x, "2026-06")).toBe(true);   // trabalhou parte do mês
    expect(noQuadroEm(x, "2026-07")).toBe(false);
  });

  it("direção nunca é quadro", () => {
    expect(noQuadroEm(c({ id: "d", nome: "D", ehDirecao: true, dataAdmissao: "2020-01-01" }), "2026-06")).toBe(false);
  });

  it("sem data de admissão, presume-se que já estava — sumir gente é pior", () => {
    expect(noQuadroEm(c({ id: "e", nome: "E" }), "2026-01")).toBe(true);
  });

  it("inativo sem data de desligamento sai (não dá para saber quando)", () => {
    expect(noQuadroEm(c({ id: "f", nome: "F", statusId: "inativo" }), "2026-06")).toBe(false);
  });

  it("competência vazia não conta ninguém", () => {
    expect(noQuadroEm(c({ id: "g", nome: "G" }), "")).toBe(false);
  });
});

describe("quadroDoMes / quantosNoQuadro — o divisor muda com o mês", () => {
  const equipe = [
    c({ id: "velha", nome: "Velha", dataAdmissao: "2020-01-01" }),
    c({ id: "nova", nome: "Nova", dataAdmissao: "2026-08-01" }),
    c({ id: "saiu", nome: "Saiu", statusId: "inativo", dataAdmissao: "2019-01-01", dataDesligamento: "2026-06-30" }),
    c({ id: "chefe", nome: "Chefe", ehDirecao: true }),
  ];
  it("junho tem duas, agosto tem duas, e não são as mesmas", () => {
    expect(quadroDoMes(equipe, "2026-06").map((x) => x.id)).toEqual(["saiu", "velha"]);
    expect(quadroDoMes(equipe, "2026-08").map((x) => x.id)).toEqual(["nova", "velha"]);
    expect(quantosNoQuadro(equipe, "2026-07")).toBe(1);
  });
});

describe("faltasDoMes", () => {
  const equipe = [
    c({ id: "paga", nome: "Paga", dataAdmissao: "2020-01-01" }),
    c({ id: "vazia", nome: "Vazia", dataAdmissao: "2020-01-01" }),
    c({ id: "meia", nome: "Meia", dataAdmissao: "2020-01-01" }),
    c({ id: "futura", nome: "Futura", dataAdmissao: "2026-09-01" }),
  ];
  const pg = (colaboradorId: string, tipo: string) => ({ colaboradorId, competencia: "2026-08", tipo });

  it("aponta quem não tem nada e quem só tem adiantamento", () => {
    const f = faltasDoMes(equipe, [pg("paga", "Salário"), pg("meia", "Adiantamento")], "2026-08");
    expect(f.map((x) => x.colaborador.id)).toEqual(["meia", "vazia"]);
    expect(f.find((x) => x.colaborador.id === "vazia")).toMatchObject({ semLancamento: true, soAdiantamento: false });
    expect(f.find((x) => x.colaborador.id === "meia")).toMatchObject({ semLancamento: false, soAdiantamento: true });
  });

  it("quem ainda não entrou não é falta", () => {
    expect(faltasDoMes(equipe, [], "2026-08").some((x) => x.colaborador.id === "futura")).toBe(false);
  });

  it("rescisão e férias fecham o mês sozinhas", () => {
    expect(faltasDoMes(equipe, [pg("vazia", "Rescisão"), pg("meia", "Férias"), pg("paga", "Salário")], "2026-08")).toEqual([]);
  });

  it("marca quem está sem data de admissão, porque a presença dele é presumida", () => {
    const f = faltasDoMes([c({ id: "z", nome: "Z" })], [], "2026-08");
    expect(f[0]).toMatchObject({ semDataAdmissao: true, semLancamento: true });
  });
});

describe("pagosForaDoQuadro", () => {
  it("acerto de quem já saiu aparece na lista", () => {
    const equipe = [c({ id: "ex", nome: "Ex", statusId: "inativo", dataAdmissao: "2020-01-01", dataDesligamento: "2026-06-30" })];
    expect(pagosForaDoQuadro(equipe, [{ colaboradorId: "ex", competencia: "2026-07" }], "2026-07").map((x) => x.id)).toEqual(["ex"]);
    expect(pagosForaDoQuadro(equipe, [{ colaboradorId: "ex", competencia: "2026-06" }], "2026-06")).toEqual([]);
  });
  it("sócio não entra (o dinheiro dele não é folha)", () => {
    const equipe = [c({ id: "s", nome: "S", ehDirecao: true })];
    expect(pagosForaDoQuadro(equipe, [{ colaboradorId: "s", competencia: "2026-07" }], "2026-07")).toEqual([]);
  });
});
