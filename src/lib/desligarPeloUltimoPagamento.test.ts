import { describe, expect, it } from "vitest";
import { desligamentosPeloUltimoPagamento, fimDoMes } from "./desligarPeloUltimoPagamento";
import type { Colaborador } from "@/data/types";

const col = (over: Partial<Colaborador> & { id: string; nome: string }): Colaborador => ({ statusId: "ativo", ...over } as Colaborador);
const pg = (colaboradorId: string, competencia: string) => ({ colaboradorId, competencia });

describe("fimDoMes", () => {
  it("acerta fevereiro, bissexto e meses de 31", () => {
    expect(fimDoMes("2026-02")).toBe("2026-02-28");
    expect(fimDoMes("2028-02")).toBe("2028-02-29");
    expect(fimDoMes("2026-03")).toBe("2026-03-31");
    expect(fimDoMes("2026-06")).toBe("2026-06-30");
  });
});

describe("desligamentosPeloUltimoPagamento", () => {
  const pessoas = [
    col({ id: "bruno", nome: "Bruno", statusId: "inativo", dataDesligamento: "2025-10-04" }), // data errada
    col({ id: "paulo", nome: "Paulo", statusId: "inativo" }), // sem data
    col({ id: "ana", nome: "Ana", statusId: "ativo" }), // recebe até hoje
    col({ id: "demerval", nome: "Demerval", statusId: "ativo", dataDesligamento: "2026-06-22" }), // último pagamento em agosto: manual
    col({ id: "certo", nome: "Certo", statusId: "inativo", dataDesligamento: "2026-02-28" }), // já está certo
    col({ id: "pedro-ramos", nome: "Pedro", statusId: "direcao", ehDirecao: true }),
    col({ id: "semnada", nome: "Sem Nada", statusId: "inativo" }),
  ];
  const pags = [
    pg("bruno", "2026-01"), pg("bruno", "2026-03"),
    pg("paulo", "2026-05"),
    pg("ana", "2026-08"),
    pg("demerval", "2026-08"),
    pg("certo", "2026-02"),
    pg("pedro-ramos", "2026-03"),
  ];
  const r = desligamentosPeloUltimoPagamento(pessoas, pags, "2026-06");

  it("corrige a data errada pelo último mês com lançamento", () => {
    const b = r.find((x) => x.colaboradorId === "bruno")!;
    expect(b.para).toEqual({ statusId: "inativo", dataDesligamento: "2026-03-31" });
    expect(b.muda).toBe("data");
  });

  it("preenche a data de quem está inativo sem data", () => {
    expect(r.find((x) => x.colaboradorId === "paulo")!.para.dataDesligamento).toBe("2026-05-31");
  });

  it("quem recebeu depois do limite fica de fora (decisão manual)", () => {
    expect(r.some((x) => x.colaboradorId === "ana")).toBe(false);
    expect(r.some((x) => x.colaboradorId === "demerval")).toBe(false);
  });

  it("quem já está certo, direção e quem não tem lançamento ficam de fora", () => {
    expect(r.some((x) => ["certo", "pedro-ramos", "semnada"].includes(x.colaboradorId))).toBe(false);
  });

  it("ativo que parou de receber vira inativo com a data", () => {
    const r2 = desligamentosPeloUltimoPagamento([col({ id: "x", nome: "X", statusId: "ativo" })], [pg("x", "2026-04")], "2026-06");
    expect(r2[0].muda).toBe("ambos");
    expect(r2[0].para.dataDesligamento).toBe("2026-04-30");
  });

  it("ordena pelo último mês e depois pelo nome", () => {
    expect(r.map((x) => x.colaboradorId)).toEqual(["bruno", "paulo"]);
  });

  it("saída anotada com o dia real dentro do último mês FICA como está", () => {
    const certoNoDia = col({ id: "d", nome: "Dia Real", statusId: "inativo", dataDesligamento: "2026-03-15" });
    expect(desligamentosPeloUltimoPagamento([certoNoDia], [pg("d", "2026-03")], "2026-06")).toEqual([]);
  });

  it("ativo com a saída anotada no mês certo: só o status muda, o dia é preservado", () => {
    const ativo = col({ id: "e", nome: "Ativo", statusId: "ativo", dataDesligamento: "2026-03-15" });
    const r2 = desligamentosPeloUltimoPagamento([ativo], [pg("e", "2026-03")], "2026-06");
    expect(r2[0].muda).toBe("status");
    expect(r2[0].para.dataDesligamento).toBe("2026-03-15");
  });

  it("limite inválido não propõe nada", () => {
    expect(desligamentosPeloUltimoPagamento(pessoas, pags, "junho")).toEqual([]);
  });
});
