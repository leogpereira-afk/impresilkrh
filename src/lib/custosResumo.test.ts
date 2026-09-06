/* O topo da tela de Custos — variação mensal e semáforo.
 *
 * Números da auditoria de 06/09/2026, que é o caso real que motivou isto:
 * agosto pagou R$ 82.343,64 contra R$ 61.659,93 em julho (+R$ 20.683,71,
 * +33,5%); a base salário+adiantamento subiu só R$ 758,26; diárias
 * (+12.314,95) e horas extras (+6.581,57) explicam ~91% da alta.
 *
 * Começa pelo caso ruim: zero que não é resultado.
 */
import { describe, it, expect } from "vitest";
import { variacaoMensal, competenciaAnteriorComFolha, sinaisDaCompetencia } from "./custosResumo";

const ENC = ["FGTS", "INSS"];
const p = (competencia: string, tipo: string, valor: number, colaboradorId = "c1") => ({ competencia, tipo, valor, colaboradorId });

describe("variação mensal — o caso ruim primeiro", () => {
  it("mês sem anterior NÃO inventa variação (temAnterior=false, pct=null)", () => {
    const v = variacaoMensal([p("2026-08", "Salário", 1000)], "2026-08", ENC);
    expect(v.temAnterior).toBe(false);
    expect(v.compAnterior).toBeNull();
    expect(v.pct).toBeNull();
    expect(v.parcelaDosMaiores).toBeNull();
    expect(v.pago).toBe(1000);
    expect(v.delta).toBe(1000); // contra zero: o número existe, o percentual não
  });

  it("anterior é o último mês COM folha, não 'mês − 1'", () => {
    // Setembro sem lançamento não vira comparação de outubro: pula para agosto.
    const pags = [p("2026-08", "Salário", 100), p("2026-10", "Salário", 120)];
    expect(competenciaAnteriorComFolha("2026-10", pags)).toBe("2026-08");
    expect(competenciaAnteriorComFolha("2026-08", pags)).toBeNull();
    expect(variacaoMensal(pags, "2026-10", ENC).compAnterior).toBe("2026-08");
  });

  it("anterior com total zero → pct nulo, nunca Infinity", () => {
    const pags = [p("2026-07", "Salário", 0), p("2026-08", "Salário", 500)];
    const v = variacaoMensal(pags, "2026-08", ENC);
    expect(v.temAnterior).toBe(true);
    expect(v.pct).toBeNull();
    expect(v.delta).toBe(500);
  });

  it("FGTS/INSS lançados são custo da empresa: ficam fora do 'pago'", () => {
    const pags = [p("2026-08", "Salário", 1000), p("2026-08", "FGTS", 80)];
    expect(variacaoMensal(pags, "2026-08", ENC).pago).toBe(1000);
  });
});

describe("variação mensal — os números de agosto/2026", () => {
  // Reconstrução fiel dos deltas da auditoria (por tipo), sobre uma base de julho.
  const jul = [
    p("2026-07", "Salário", 40000), p("2026-07", "Adiantamento", 17000),
    p("2026-07", "Diárias", 1000), p("2026-07", "Horas Extras", 1500),
    p("2026-07", "Limpeza/Faxina", 500), p("2026-07", "Freelancer (Empreita)", 300),
    p("2026-07", "Férias", 1359.93),
  ];
  const ago = [
    p("2026-08", "Salário", 40500), p("2026-08", "Adiantamento", 17258.26), // base +758,26
    p("2026-08", "Diárias", 13314.95),          // +12.314,95
    p("2026-08", "Horas Extras", 8081.57),      // +6.581,57
    p("2026-08", "Limpeza/Faxina", 2119.95),    // +1.619,95
    p("2026-08", "Freelancer (Empreita)", 936.65), // +636,65
    p("2026-08", "Férias", 90.61),              // −1.269,32
  ];
  const v = variacaoMensal([...jul, ...ago], "2026-08", ENC);

  it("total, delta e percentual batem com o parecer", () => {
    expect(v.pagoAnterior).toBeCloseTo(61659.93, 2);
    expect(v.pago).toBeCloseTo(82301.99, 2);
    expect(v.delta).toBeCloseTo(20642.06, 2);
    expect(v.pct!).toBeGreaterThan(0.33);
    expect(v.pct!).toBeLessThan(0.34);
  });

  it("a base sobe pouco e o resto é fora da base", () => {
    expect(v.deltaBase).toBeCloseTo(758.26, 2);
    expect(v.deltaForaDaBase).toBeCloseTo(v.delta - 758.26, 2);
  });

  it("motores ordenados por |delta|, com o sinal certo", () => {
    expect(v.motores.map((m) => m.tipo).slice(0, 3)).toEqual(["Diárias", "Horas Extras", "Limpeza/Faxina"]);
    expect(v.motores.find((m) => m.tipo === "Férias")!.delta).toBeCloseTo(-1269.32, 2);
  });

  it("os dois maiores no MESMO sentido explicam ~91% — a queda de férias não conta", () => {
    // (12.314,95 + 6.581,57) / 20.642,06 = 0,9155
    expect(v.parcelaDosMaiores!).toBeGreaterThan(0.91);
    expect(v.parcelaDosMaiores!).toBeLessThan(0.92);
  });

  it("tipo que não mudou não aparece como motor", () => {
    const iguais = [p("2026-07", "Salário", 100), p("2026-08", "Salário", 100), p("2026-08", "Diárias", 50)];
    const m = variacaoMensal(iguais, "2026-08", ENC).motores;
    expect(m.map((x) => x.tipo)).toEqual(["Diárias"]);
  });

  it("parcela nunca passa de 1 mesmo quando quedas compensam", () => {
    // Sobe 1000 em diárias, cai 900 em férias: delta 100; os maiores no sentido
    // explicam 1000/100 = 10× → trava em 1.
    const pags = [p("2026-07", "Férias", 900), p("2026-08", "Diárias", 1000)];
    expect(variacaoMensal(pags, "2026-08", ENC).parcelaDosMaiores).toBe(1);
  });
});

describe("semáforo — zero não é resultado", () => {
  const base = {
    comp: "2026-08",
    gravados: 141,
    manuais: 1,
    contasNoPlano: 0,
    conferencia: { estado: "completa" as const, semSalario: [] },
    ultimaBusca: { competencia: "2026-08", em: "2026-09-06T10:00:00", quantidade: 140, consultados: 140, naoCasados: 0 },
    ultimaConciliacao: null,
  };

  it("mês com folha e sem plano de contas é RUIM e diz 'indisponível', não zero", () => {
    const s = sinaisDaCompetencia(base).find((x) => x.id === "plano")!;
    expect(s.tom).toBe("ruim");
    expect(s.valor).toBe("ausente");
    expect(s.detalhe).toMatch(/INDISPON/);
  });

  it("mês sem folha e sem plano é neutro — não há o que cobrar", () => {
    const s = sinaisDaCompetencia({ ...base, gravados: 0, manuais: 0 }).find((x) => x.id === "plano")!;
    expect(s.tom).toBe("neutro");
  });

  it("explica o 141 contra 140: 1 gravado fora desta busca, e é manual", () => {
    const s = sinaisDaCompetencia(base).find((x) => x.id === "folha")!;
    expect(s.tom).toBe("ok");
    expect(s.valor).toBe("141 gravados");
    expect(s.detalhe).toContain("140 vinculado(s)");
    expect(s.detalhe).toContain("1 gravado(s) fora desta busca (1 manual)");
  });

  it("busca cortada ou título sem dono rebaixa a folha para atenção", () => {
    expect(sinaisDaCompetencia({ ...base, ultimaBusca: { ...base.ultimaBusca, truncado: true } }).find((x) => x.id === "folha")!.tom).toBe("atencao");
    expect(sinaisDaCompetencia({ ...base, ultimaBusca: { ...base.ultimaBusca, naoCasados: 3 } }).find((x) => x.id === "folha")!.tom).toBe("atencao");
  });

  it("sem lançamento nenhum é RUIM, e diz se a busca já olhou este mês", () => {
    const s = sinaisDaCompetencia({ ...base, gravados: 0, manuais: 0 }).find((x) => x.id === "folha")!;
    expect(s.tom).toBe("ruim");
    expect(s.detalhe).toMatch(/não achou/);
  });

  it("busca de OUTRO mês não vale como 'atualizado' para este", () => {
    const s = sinaisDaCompetencia({ ...base, comp: "2026-07" }).find((x) => x.id === "folha")!;
    expect(s.tom).toBe("neutro");
    expect(s.detalhe).toMatch(/outro mês/);
  });

  it("pendências: aguardando é atenção, incompleta é ruim, e soma título sem dono", () => {
    const duas = [{ id: "a", nome: "A" }, { id: "b", nome: "B" }];
    const ag = sinaisDaCompetencia({ ...base, conferencia: { estado: "aguardando", semSalario: duas } }).find((x) => x.id === "pendencias")!;
    expect(ag.tom).toBe("atencao");
    expect(ag.valor).toBe("2");
    const inc = sinaisDaCompetencia({ ...base, conferencia: { estado: "incompleta", semSalario: duas } }).find((x) => x.id === "pendencias")!;
    expect(inc.tom).toBe("ruim");
    const comTitulos = sinaisDaCompetencia({ ...base, ultimaBusca: { ...base.ultimaBusca, naoCasados: 4 } }).find((x) => x.id === "pendencias")!;
    expect(comTitulos.valor).toBe("4");
    expect(comTitulos.tom).toBe("atencao");
  });

  it("título sem dono de OUTRO mês não vira pendência deste", () => {
    const s = sinaisDaCompetencia({ ...base, comp: "2026-07", ultimaBusca: { ...base.ultimaBusca, naoCasados: 4 } }).find((x) => x.id === "pendencias")!;
    expect(s.valor).toBe("nenhuma");
  });

  it("conciliação: nunca aplicada é neutro; aplicada neste mês é ok e mostra o placar", () => {
    expect(sinaisDaCompetencia(base).find((x) => x.id === "conciliacao")!.tom).toBe("neutro");
    const c = { em: "2026-09-06T10:05:00", competencias: ["2026-07", "2026-08"], iguais: 1, corrigidos: 139, novos: 0, mantidos: 1, removidos: 0, valorNovos: 0, valorCorrigidos: 0 };
    const s = sinaisDaCompetencia({ ...base, ultimaConciliacao: c }).find((x) => x.id === "conciliacao")!;
    expect(s.tom).toBe("ok");
    expect(s.valor).toBe("06/09 10:05");
    expect(s.detalhe).toBe("1 iguais · 139 corrigidos · 0 novos · 1 mantidos fora da busca");
  });

  it("conciliação que cobriu outros meses fica neutra e diz quais", () => {
    const c = { em: "2026-09-06T10:05:00", competencias: ["2026-06"], iguais: 1, corrigidos: 0, novos: 0, mantidos: 0, removidos: 2, valorNovos: 0, valorCorrigidos: 0 };
    const s = sinaisDaCompetencia({ ...base, ultimaConciliacao: c }).find((x) => x.id === "conciliacao")!;
    expect(s.tom).toBe("neutro");
    expect(s.detalhe).toContain("2 removidos");
    expect(s.detalhe).toContain("cobriu 06/26, não este mês");
  });
});
