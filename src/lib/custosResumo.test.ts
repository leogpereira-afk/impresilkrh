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

  /* Revisão adversarial de 06/09/2026 — os casos abaixo passavam errado. */

  it("mês que só tem FGTS/INSS não conta como 'anterior com folha'", () => {
    // Julho só teve encargo lançado: pago R$ 0. Comparar agosto com ele fazia a
    // tela anunciar que TODO o mês era aumento novo.
    const pags = [p("2026-06", "Salário", 5000), p("2026-07", "FGTS", 400), p("2026-08", "Salário", 5200)];
    expect(competenciaAnteriorComFolha("2026-08", pags, ENC)).toBe("2026-06");
    const v = variacaoMensal(pags, "2026-08", ENC);
    expect(v.compAnterior).toBe("2026-06");
    expect(v.delta).toBe(200); // e não 5.200
  });

  it("mês anterior que soma exatamente zero também é pulado", () => {
    const pags = [p("2026-06", "Salário", 900), p("2026-07", "Salário", 100), p("2026-07", "Outros", -100), p("2026-08", "Salário", 1000)];
    expect(competenciaAnteriorComFolha("2026-08", pags, ENC)).toBe("2026-06");
  });

  it("valor que chega como texto SOMA, não concatena", () => {
    const pags = [{ competencia: "2026-08", tipo: "Salário", valor: "100" as unknown as number },
                  { competencia: "2026-08", tipo: "Salário", valor: "200" as unknown as number }];
    expect(variacaoMensal(pags, "2026-08", ENC).pago).toBe(300); // era 100200
  });

  it("valor ilegível vira 0, não NaN que contamina o total", () => {
    const pags = [p("2026-08", "Salário", 100), { competencia: "2026-08", tipo: "Outros", valor: "abc" as unknown as number }];
    expect(variacaoMensal(pags, "2026-08", ENC).pago).toBe(100);
  });

  it("sem motor no sentido do delta, parcela é NULA — não 0%", () => {
    // quantosMaiores=0: não há o que listar, então não se afirma percentual.
    expect(variacaoMensal([p("2026-07", "Salário", 100), p("2026-08", "Salário", 200)], "2026-08", ENC, 0).parcelaDosMaiores).toBeNull();
  });

  it("mês anterior de total zero não vira comparação — e nunca sai Infinity", () => {
    /* Este teste mudou em 06/09/2026. Antes o mês de total zero era aceito como
       "anterior" e a defesa era só o pct nulo. Agora ele é pulado na origem: um
       mês que pagou R$ 0 faz a tela anunciar que 100% do mês atual é aumento
       novo, o que não ajuda ninguém. A defesa do pct continua de pé por baixo. */
    const pags = [p("2026-07", "Salário", 0), p("2026-08", "Salário", 500)];
    const v = variacaoMensal(pags, "2026-08", ENC);
    expect(v.temAnterior).toBe(false);
    expect(v.pct).toBeNull();
    expect(Number.isFinite(v.delta)).toBe(true);
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

  it("BUSCAR NÃO É APLICAR: busca achou 140 e nada gravado → 'falta aplicar', não 'não achou'", () => {
    // Este é o caminho normal: a busca automática ao abrir a tela grava
    // ultimaBuscaMubi e só avisa. Dizer "a busca não achou lançamento" era
    // afirmar o contrário do que aconteceu.
    const s = sinaisDaCompetencia({ ...base, gravados: 0, manuais: 0 }).find((x) => x.id === "folha")!;
    expect(s.tom).toBe("atencao");
    expect(s.valor).toBe("falta aplicar");
    expect(s.detalhe).toContain("achou 140 lançamento(s)");
    expect(s.detalhe).not.toMatch(/não achou/);
  });

  it("busca que de fato não achou nada é RUIM e diz isso", () => {
    const s = sinaisDaCompetencia({ ...base, gravados: 0, manuais: 0, ultimaBusca: { ...base.ultimaBusca, quantidade: 0 } }).find((x) => x.id === "folha")!;
    expect(s.tom).toBe("ruim");
    expect(s.detalhe).toMatch(/não achou/);
  });

  it("busca achou MAIS do que está gravado: avisa em vez de engolir no Math.max", () => {
    const s = sinaisDaCompetencia({ ...base, gravados: 100 }).find((x) => x.id === "folha")!;
    expect(s.tom).toBe("atencao");
    expect(s.detalhe).toContain("40 da busca ainda não estão gravados");
  });

  it("plural de 'manual'", () => {
    expect(sinaisDaCompetencia({ ...base, gravados: 143, manuais: 3 }).find((x) => x.id === "folha")!.detalhe).toContain("(3 manuais)");
    expect(sinaisDaCompetencia(base).find((x) => x.id === "folha")!.detalhe).toContain("(1 manual)");
  });

  it("data ilegível não deixa buraco na frase", () => {
    const s = sinaisDaCompetencia({ ...base, ultimaBusca: { ...base.ultimaBusca, em: "sei lá" } }).find((x) => x.id === "folha")!;
    expect(s.detalhe).toContain("na última busca");
    expect(s.detalhe).not.toMatch(/de {2}|\(\)/);
  });

  it("conciliação com data ilegível ou lista de meses vazia não imprime frase truncada", () => {
    const c = { em: "xx", competencias: [], iguais: 1, corrigidos: 0, novos: 0, mantidos: 0, removidos: 0 };
    const s = sinaisDaCompetencia({ ...base, ultimaConciliacao: c }).find((x) => x.id === "conciliacao")!;
    expect(s.valor).toBe("aplicada");
    expect(s.detalhe).toContain("de outra competência");
    expect(s.detalhe).not.toContain("cobriu ,");
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
    const c = { em: "2026-09-06T10:05:00", competencias: ["2026-07", "2026-08"], iguais: 1, corrigidos: 139, novos: 0, mantidos: 1, removidos: 0 };
    const s = sinaisDaCompetencia({ ...base, ultimaConciliacao: c }).find((x) => x.id === "conciliacao")!;
    expect(s.tom).toBe("ok");
    expect(s.valor).toBe("06/09 10:05");
    expect(s.detalhe).toBe("1 iguais · 139 corrigidos · 0 novos · 1 mantidos fora da busca");
  });

  it("conciliação que cobriu outros meses fica neutra e diz quais", () => {
    const c = { em: "2026-09-06T10:05:00", competencias: ["2026-06"], iguais: 1, corrigidos: 0, novos: 0, mantidos: 0, removidos: 2 };
    const s = sinaisDaCompetencia({ ...base, ultimaConciliacao: c }).find((x) => x.id === "conciliacao")!;
    expect(s.tom).toBe("neutro");
    expect(s.detalhe).toContain("2 removidos");
    expect(s.detalhe).toContain("cobriu 06/26, não este mês");
  });
});

describe("variação usa pagamentos efetivamente pagos", () => {
  it("ignora não pagos nos dois meses e pula competência só com pendências", () => {
    const pagos = [p("2026-06", "Salário", 1000), p("2026-08", "Salário", 1200)];
    const pags = [...pagos, ...["ABERTO", "NÃO PAGO", "NAO PAGO", "NÃO QUITADO", "PAGO CANCELADO", "ESTORNADO", "AGENDADO"].flatMap((statusErp) =>
      ["2026-06", "2026-07", "2026-08"].map((comp) => ({ ...p(comp, "Salário", 9000), statusErp })))];
    expect(competenciaAnteriorComFolha("2026-08", pags, ENC)).toBe("2026-06");
    expect(variacaoMensal(pags, "2026-08", ENC)).toEqual(variacaoMensal(pagos, "2026-08", ENC));
  });
});
