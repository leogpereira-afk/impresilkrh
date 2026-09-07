import { describe, expect, it } from "vitest";
import { desligamentosPeloUltimoPagamento, fimDoMes } from "./desligarPeloUltimoPagamento";
import type { Colaborador } from "@/data/types";

const col = (over: Partial<Colaborador> & { id: string; nome: string }): Colaborador => ({ statusId: "ativo", ...over } as Colaborador);
const pg = (colaboradorId: string, competencia: string, tipo = "Salário") => ({ colaboradorId, competencia, tipo });

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

/* REVISÃO ADVERSARIAL DE 07/09/2026 — a data anotada à mão era sobrescrita.
   A régua antiga era o MÊS bater. Mas o FGTS e o INSS individualizados caem na
   competência SEGUINTE (a guia vence no dia 20 e a janela é 16→15), então quem
   saiu no meio de abril, com encargo lançado em maio, tinha a saída empurrada
   para 31/05 — 46 dias a mais no quadro, no relógio de férias e no turnover,
   dentro de um lote que a tela mostrava como "só ajuste de data". */
describe("data de saída já anotada é intocável", () => {
  it("saída em 15/04 com encargo na competência de maio CONTINUA 15/04", () => {
    const pessoas = [col({ id: "x", nome: "Xis", statusId: "inativo", dataDesligamento: "2026-04-15" })];
    const pags = [pg("x", "2026-04"), pg("x", "2026-05", "FGTS")];
    expect(desligamentosPeloUltimoPagamento(pessoas, pags, "2026-06")).toEqual([]);
  });

  /* Este teste eu escrevi errado na primeira tentativa: afirmava que data
     anotada NUNCA é sobrescrita. Mas corrigir data errada é o propósito desta
     função — dois testes antigos provaram isso na hora. O defeito real era
     mais estreito: o encargo do mês seguinte contava como "último mês". */
  it("data anotada em mês anterior ao último SALÁRIO continua sendo corrigida", () => {
    const pessoas = [col({ id: "x", nome: "Xis", statusId: "ativo", dataDesligamento: "2026-01-10" })];
    const [r] = desligamentosPeloUltimoPagamento(pessoas, [pg("x", "2026-05")], "2026-06");
    expect(r.para.dataDesligamento).toBe("2026-05-31");
  });

  it("quem NÃO tem data continua recebendo o fim do último mês pago", () => {
    const pessoas = [col({ id: "y", nome: "Ipsilon", statusId: "inativo" })];
    const [r] = desligamentosPeloUltimoPagamento(pessoas, [pg("y", "2026-04")], "2026-06");
    expect(r.para.dataDesligamento).toBe("2026-04-30");
    expect(r.muda).toBe("data");
  });
});
