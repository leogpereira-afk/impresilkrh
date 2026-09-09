import { describe, it, expect } from "vitest";
import { mesDaEquipe, resumoDaEquipe, pesoDaPessoa, porPessoaNoMes } from "./provisaoEquipe";

const p = (competencia: string, colaboradorId: string, tipo: string, valor: number) => ({ competencia, colaboradorId, tipo, valor });

describe("mesDaEquipe", () => {
  it("soma o pago às pessoas e provisiona só sobre salário + adiantamento", () => {
    const m = mesDaEquipe([p("2026-08", "a", "Salário", 1000), p("2026-08", "a", "Adiantamento", 500), p("2026-08", "a", "Diária", 100)], "2026-08");
    expect(m.pago).toBe(1600);
    expect(m.base).toBe(1500);
    // 8% + 8,33% + 11,11% sobre 1500
    expect(m.provisoes).toBeCloseTo(1500 * 0.08 + 1500 * (1 / 12) + 1500 * (1 / 12) * (4 / 3), 2);
    expect(m.estimado).toBeCloseTo(m.pago + m.provisoes, 2);
  });

  it("FGTS lançado é custo da empresa: fica fora do pago e dentro da provisão", () => {
    const m = mesDaEquipe([p("2026-08", "a", "Salário", 1000), p("2026-08", "a", "FGTS", 300)], "2026-08");
    expect(m.pago).toBe(1000);
    expect(m.provisoes).toBeCloseTo(1000 * 0.08 + 1000 * (1 / 12) + 1000 * (1 / 12) * (4 / 3) + 300, 2);
  });

  it("conta pessoas distintas, não lançamentos", () => {
    const m = mesDaEquipe([p("2026-08", "a", "Salário", 1), p("2026-08", "a", "Diária", 1), p("2026-08", "b", "Salário", 1)], "2026-08");
    expect(m.pessoas).toBe(2);
  });

  it("mês sem lançamento é zero em tudo, sem quebrar", () => {
    const m = mesDaEquipe([p("2026-08", "a", "Salário", 1000)], "2026-07");
    expect(m).toMatchObject({ pago: 0, provisoes: 0, estimado: 0, pessoas: 0 });
  });
});

describe("resumoDaEquipe", () => {
  const base = [
    ...[1, 2, 3].map((i) => p(`2026-0${i}`, "a", "Salário", 1000)),
    p("2026-03", "b", "Salário", 1000),
  ];

  it("a série vai só até a competência pedida", () => {
    const r = resumoDaEquipe(base, "2026-02");
    expect(r.serie.map((m) => m.competencia)).toEqual(["2026-01", "2026-02"]);
    expect(r.competencia).toBe("2026-02");
  });

  it("mês sem lançamento não entra na série como zero", () => {
    const r = resumoDaEquipe([p("2026-01", "a", "Salário", 1000), p("2026-03", "a", "Salário", 1000)], "2026-03");
    expect(r.serie.map((m) => m.competencia)).toEqual(["2026-01", "2026-03"]);
    expect(r.mediaEstimada).toBeCloseTo(r.serie[0].estimado, 2);
  });

  it("a janela guarda os últimos N meses", () => {
    const muitos = Array.from({ length: 15 }, (_, i) => p(`2025-${String(i + 1).padStart(2, "0")}`, "a", "Salário", 100));
    const r = resumoDaEquipe(muitos, "2025-15", 12);
    expect(r.serie).toHaveLength(12);
    expect(r.serie[0].competencia).toBe("2025-04");
  });

  it("aponta o pico e a projeção do ano", () => {
    const r = resumoDaEquipe(base, "2026-03");
    expect(r.competenciaDoPico).toBe("2026-03");
    expect(r.projecaoAno).toBeCloseTo(r.mediaEstimada * 12, 2);
  });

  it("diz quanto o mês foge da média", () => {
    const r = resumoDaEquipe(base, "2026-03");
    expect(r.pctSobreMedia).not.toBeNull();
    expect(r.pctSobreMedia!).toBeGreaterThan(0);
  });

  it("sem nenhum lançamento, média e percentual não inventam número", () => {
    const r = resumoDaEquipe([], "2026-03");
    expect(r.mediaEstimada).toBe(0);
    expect(r.pctSobreMedia).toBeNull();
    expect(r.mediaPorPessoa).toBe(0);
  });
});

describe("pesoDaPessoa", () => {
  it("a soma dos pesos de todos fecha 1", () => {
    const pags = [p("2026-08", "a", "Salário", 1000), p("2026-08", "b", "Salário", 3000), p("2026-08", "b", "Diária", 200)];
    const pa = pesoDaPessoa(pags, "2026-08", "a")!;
    const pb = pesoDaPessoa(pags, "2026-08", "b")!;
    expect(pa + pb).toBeCloseTo(1, 6);
    expect(pb).toBeGreaterThan(pa);
  });

  it("mês zerado não vira divisão por zero", () => {
    expect(pesoDaPessoa([], "2026-08", "a")).toBeNull();
  });
});

describe("porPessoaNoMes", () => {
  const pags = [
    p("2026-08", "a", "Salário", 1000),
    p("2026-08", "b", "Salário", 3000),
    p("2026-08", "b", "Diária", 200),
    p("2026-07", "a", "Salário", 999),
  ];

  it("a soma das pessoas fecha com o estimado do mês", () => {
    const lista = porPessoaNoMes(pags, "2026-08");
    const mes = mesDaEquipe(pags, "2026-08");
    expect(lista.reduce((s, x) => s + x.estimado, 0)).toBeCloseTo(mes.estimado, 6);
  });

  it("vem do maior para o menor e não traz outro mês", () => {
    const lista = porPessoaNoMes(pags, "2026-08");
    expect(lista.map((x) => x.colaboradorId)).toEqual(["b", "a"]);
    expect(lista).toHaveLength(2);
  });

  it("mês sem ninguém devolve lista vazia", () => {
    expect(porPessoaNoMes(pags, "2026-01")).toEqual([]);
  });
});

describe("títulos em aberto no ERP", () => {
  it("ficam fora do pago do mês, com a parcela em aberto dita à parte", () => {
    const pags = [
      { competencia: "2026-09", colaboradorId: "a", tipo: "Salário", valor: 1000, statusErp: "PAGO" },
      { competencia: "2026-09", colaboradorId: "b", tipo: "Salário", valor: 700, statusErp: "ABERTO" },
      { competencia: "2026-09", colaboradorId: "c", tipo: "Salário", valor: 300 }, // legado, sem estado
    ];
    const m = mesDaEquipe(pags, "2026-09");
    expect(m.pago).toBe(1300);
    expect(m.emAberto).toBe(700);
  });
});

describe("agregações contam somente títulos pagos", () => {
  it("exclui não pagos da base, FGTS, pessoas, pesos e médias sem diluir a série", () => {
    const pagos = [p("2026-08", "a", "Salário", 1000), { ...p("2026-08", "b", "Diária", 500), statusErp: "PAGO" }];
    const rejeitados = ["ABERTO", "CANCELADO", "PAGO ESTORNADO", "NÃO PAGO", "NAO PAGO", "NÃO QUITADO", "AGENDADO"];
    const pags = [...pagos, ...rejeitados.flatMap((statusErp, i) => [
      { ...p("2026-08", `fora-${i}`, "Salário", 9000), statusErp },
      { ...p("2026-08", `fora-${i}`, "FGTS", 700), statusErp },
      { ...p("2026-07", `fora-${i}`, "Salário", 9000), statusErp },
    ])];
    const esperado = mesDaEquipe(pagos, "2026-08");
    expect(mesDaEquipe(pags, "2026-08")).toMatchObject({ pago: esperado.pago, base: esperado.base, provisoes: esperado.provisoes, pessoas: 2 });
    expect(porPessoaNoMes(pags, "2026-08")).toEqual(porPessoaNoMes(pagos, "2026-08"));
    expect(pesoDaPessoa(pags, "2026-08", "fora-0")).toBe(0);
    expect(pesoDaPessoa(pags, "2026-08", "a")).toBe(pesoDaPessoa(pagos, "2026-08", "a"));
    const resumo = resumoDaEquipe(pags, "2026-08");
    expect(resumo.serie.map((m) => m.competencia)).toEqual(["2026-08"]);
    expect(resumo.mediaEstimada).toBe(esperado.estimado);
  });
});
