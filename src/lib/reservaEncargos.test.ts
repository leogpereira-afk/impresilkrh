import { describe, expect, it } from "vitest";
import { anosComFolha, encargosDoMes, encargosPorPessoa, reservaDoAno, taxaDaReserva, type OpcoesAno } from "./reservaEncargos";

const p = (competencia: string, colaboradorId: string, tipo: string, valor: number) => ({ competencia, colaboradorId, tipo, valor });
const FGTS = 0.08, P13 = 1 / 12, FER = (1 / 12) * 1.3333;

describe("encargosDoMes", () => {
  it("provisiona só sobre salário + adiantamento, e o depósito é 13º + férias + FGTS", () => {
    const m = encargosDoMes([p("2026-08", "a", "Salário", 1000), p("2026-08", "a", "Adiantamento", 500), p("2026-08", "a", "Diária", 100)], "2026-08");
    expect(m.base).toBe(1500);
    expect(m.fgts).toBeCloseTo(1500 * FGTS, 6);
    expect(m.decimoTerceiro).toBeCloseTo(1500 * P13, 6);
    expect(m.ferias).toBeCloseTo(1500 * FER, 6);
    expect(m.deposito).toBeCloseTo(1500 * (FGTS + P13 + FER), 6);
    expect(m.pessoas).toBe(1);
    expect(m.temFolha).toBe(true);
  });

  it("sem FGTS no depósito, o depósito é só 13º + férias (o FGTS continua calculado)", () => {
    const m = encargosDoMes([p("2026-08", "a", "Salário", 1000)], "2026-08", { incluirFgts: false });
    expect(m.deposito).toBeCloseTo(1000 * (P13 + FER), 6);
    expect(m.fgts).toBeCloseTo(80, 6);
  });

  it("separa o acerto que a reserva funda (13º, férias) do que ela não cobre (rescisão, FGTS rescisório)", () => {
    const m = encargosDoMes([
      p("2026-08", "a", "Salário", 1000), p("2026-08", "a", "FGTS", 300),
      p("2026-08", "b", "Férias", 900), p("2026-08", "b", "Rescisão", 1800), p("2026-08", "c", "13º Salário", 500),
    ], "2026-08");
    expect(m.deposito).toBeCloseTo(1000 * (FGTS + P13 + FER), 6); // FGTS lançado não é provisão
    expect(m.acertosDaReserva).toBe(1400); // 900 férias + 500 do 13º
    expect(m.acertosFora).toBe(2100);      // 1800 rescisão + 300 FGTS rescisório
    expect(m.acertosPorTipo[0]).toEqual({ tipo: "Rescisão", valor: 1800 });
    expect(m.pessoas).toBe(1); // b e c não têm base no mês
  });

  it("mês sem salário nem adiantamento não tem folha (diária sozinha não é folha)", () => {
    const m = encargosDoMes([p("2026-08", "a", "Diária", 100)], "2026-08");
    expect(m.temFolha).toBe(false);
    expect(m.deposito).toBe(0);
  });
});

describe("taxaDaReserva", () => {
  it("é a soma das taxas de lib/encargos, com ou sem FGTS", () => {
    expect(taxaDaReserva({ incluirFgts: true })).toBeCloseTo(FGTS + P13 + FER, 10);
    expect(taxaDaReserva({ incluirFgts: false })).toBeCloseTo(P13 + FER, 10);
  });
});

describe("encargosPorPessoa", () => {
  it("a soma das pessoas fecha com o mês, do maior para o menor, sem quem não tem base", () => {
    const pags = [p("2026-08", "a", "Salário", 1000), p("2026-08", "b", "Salário", 3000), p("2026-08", "c", "Diária", 50)];
    const pessoas = encargosPorPessoa(pags, "2026-08");
    expect(pessoas.map((x) => x.colaboradorId)).toEqual(["b", "a"]);
    expect(pessoas.reduce((s, x) => s + x.deposito, 0)).toBeCloseTo(encargosDoMes(pags, "2026-08").deposito, 6);
  });
});

describe("reservaDoAno", () => {
  // Jan–Ago completos (R$ 1.000 de salário), setembro só com adiantamento de
  // R$ 400 (o mês corrente, que ainda vai fechar), novembro com um 13º pago.
  const ano = [
    ...[1, 2, 3, 4, 5, 6, 7, 8].map((m) => p(`2026-${String(m).padStart(2, "0")}`, "a", "Salário", 1000)),
    p("2026-09", "a", "Adiantamento", 400),
    p("2026-11", "a", "13º Salário", 500),
  ];
  // 20/09/2026: a janela de setembro (fecha em 15/10) ainda está aberta.
  const EM_SETEMBRO = new Date(2026, 8, 20);
  const DEPOIS = new Date(2026, 10, 1); // 01/11: a janela de setembro já fechou
  const o = (extra: Partial<OpcoesAno> = {}): OpcoesAno => ({ incluirFgts: true, hoje: EM_SETEMBRO, ...extra });
  const mes = 1000 * (FGTS + P13 + FER);

  it("12 linhas, uma por mês, com a origem certa", () => {
    const r = reservaDoAno(ano, 2026, o());
    expect(r.meses).toHaveLength(12);
    expect(r.meses.map((m) => m.origem)).toEqual([
      "folha", "folha", "folha", "folha", "folha", "folha", "folha", "folha",
      "parcial", "estimado", "estimado", "estimado",
    ]);
  });

  it("janela aberta é 'a fechar' (sobe sozinho); janela fechada é 'buraco' (não sobe)", () => {
    expect(reservaDoAno(ano, 2026, o()).meses[8].origem).toBe("parcial");
    expect(reservaDoAno(ano, 2026, o({ hoje: DEPOIS })).meses[8].origem).toBe("buraco");
  });

  it("UMA pessoa com adiantamento e sem salário NÃO derruba o mês", () => {
    // Era o furo da primeira régua: ela perguntava a um diagnóstico por pessoa.
    // Junho e julho/2026 dos dados reais têm exatamente esse caso.
    const comUmaPendente = [...ano, p("2026-06", "b", "Adiantamento", 300)];
    const r = reservaDoAno(comUmaPendente, 2026, o());
    expect(r.meses[5].origem).toBe("folha");
    expect(r.meses[5].aDepositar).toBeCloseTo(1300 * (FGTS + P13 + FER), 6);
  });

  it("folha que veio pela metade do quadro é 'buraco', mesmo com salário lançado", () => {
    // 3 pessoas com base num mês em que o quadro tinha 10: falta gente.
    const quadroDe = () => 10;
    const r = reservaDoAno(ano, 2026, o({ quadroDe }));
    expect(r.meses[0].origem).toBe("buraco");
    // Sem saber o quadro, o mês continua contando como completo.
    expect(reservaDoAno(ano, 2026, o()).meses[0].origem).toBe("folha");
  });

  it("a média usa só os meses completos: o mês pela metade não puxa o depósito para baixo", () => {
    const r = reservaDoAno(ano, 2026, o());
    expect(r.mediaMensal).toBeCloseTo(mes, 6);
    expect(r.baseDaMedia).toEqual({ meses: 8, de: "2026-01", ate: "2026-08", furos: 0 });
  });

  it("a faixa da média avisa quantos meses do meio ficaram de fora", () => {
    const comFuro = [...ano.filter((x) => x.competencia !== "2026-04"), p("2026-04", "a", "Adiantamento", 400)];
    const r = reservaDoAno(comFuro, 2026, o());
    expect(r.baseDaMedia.meses).toBe(7);
    expect(r.baseDaMedia.furos).toBe(1);
  });

  it("no mês pela metade, o que DEPOSITAR é a média — não a metade que já entrou", () => {
    const r = reservaDoAno(ano, 2026, o());
    const set = r.meses[8];
    expect(set.deposito).toBeCloseTo(400 * (FGTS + P13 + FER), 6); // o que a folha do mês gerou
    expect(set.aDepositar).toBeCloseTo(mes, 6);                    // o que levar ao banco
  });

  it("mês pela metade que já passou da média mantém o próprio valor", () => {
    const gordo = [...ano.filter((x) => x.competencia !== "2026-09"), p("2026-09", "a", "Adiantamento", 5000)];
    const r = reservaDoAno(gordo, 2026, o());
    expect(r.meses[8].aDepositar).toBeCloseTo(5000 * (FGTS + P13 + FER), 6);
  });

  it("regra anual = 12 meses inteiros: completos + o que falta nos pela metade + estimados", () => {
    const r = reservaDoAno(ano, 2026, o());
    expect(r.realizado).toBeCloseTo(8 * mes, 6);
    expect(r.completado).toBeCloseTo(mes, 6);
    expect(r.estimado).toBeCloseTo(3 * mes, 6);
    expect(r.totalAno).toBeCloseTo(12 * mes, 6);
    expect(r.mesesCompletos).toBe(8);
    expect(r.mesesPelaMetade).toBe(1);
    expect(r.mesesEstimados).toBe(3);
  });

  it("acertos do ano vêm separados: o que a reserva funda e o que ela não cobre", () => {
    const comRescisao = [...ano, p("2026-07", "a", "Rescisão", 1800), p("2026-07", "a", "FGTS", 600)];
    const r = reservaDoAno(comRescisao, 2026, o());
    expect(r.acertosDaReserva).toBe(500);
    expect(r.acertosFora).toBe(2400);
  });

  it("mês estimado mostra as três parcelas na proporção da média, e elas fecham com o depósito", () => {
    const r = reservaDoAno(ano, 2026, o());
    const out = r.meses[9];
    expect(out.origem).toBe("estimado");
    expect(out.base).toBeCloseTo(1000, 6);
    expect(out.fgts + out.decimoTerceiro + out.ferias).toBeCloseTo(out.aDepositar, 6);
  });

  it("sem FGTS no depósito, a estimativa também fica sem ele", () => {
    const r = reservaDoAno(ano, 2026, o({ incluirFgts: false }));
    expect(r.mediaMensal).toBeCloseTo(1000 * (P13 + FER), 6);
    expect(r.meses[9].aDepositar).toBeCloseTo(1000 * (P13 + FER), 6);
    expect(r.meses[9].base).toBeCloseTo(1000, 6);
    expect(r.meses[9].decimoTerceiro + r.meses[9].ferias).toBeCloseTo(r.meses[9].aDepositar, 6);
  });

  it("ano sem folha usa a média dos últimos 12 meses completos, e diz de que faixa", () => {
    const r = reservaDoAno(ano, 2027, o());
    expect(r.baseDaMedia).toEqual({ meses: 8, de: "2026-01", ate: "2026-08", furos: 0 });
    expect(r.meses.every((m) => m.origem === "estimado")).toBe(true);
    expect(r.totalAno).toBeCloseTo(12 * mes, 6);
  });

  it("a média é janela móvel: em janeiro do ano novo ela não vira 'o mês de janeiro sozinho'", () => {
    const doisAnos = [
      ...[9, 10, 11, 12].map((m) => p(`2025-${m}`, "a", "Salário", 1000)),
      p("2026-01", "a", "Salário", 400), // janeiro atípico (férias)
    ];
    const r = reservaDoAno(doisAnos, 2026, o());
    expect(r.baseDaMedia.meses).toBe(5);
    expect(r.mediaMensal).toBeCloseTo(((4 * 1000 + 400) / 5) * (FGTS + P13 + FER), 6);
  });

  it("sem nenhuma folha em lugar nenhum, o ano é vazio — não é zero", () => {
    const r = reservaDoAno([], 2026, o());
    expect(r.meses.every((m) => m.origem === "vazio")).toBe(true);
    expect(r.mediaMensal).toBe(0);
    expect(r.totalAno).toBe(0);
    expect(r.baseDaMedia).toEqual({ meses: 0, de: null, ate: null, furos: 0 });
  });

  it("sem média nenhuma, o mês pela metade fica com o próprio valor (não inventa)", () => {
    const so = [p("2026-09", "a", "Adiantamento", 400)];
    const r = reservaDoAno(so, 2026, o());
    expect(r.mediaMensal).toBe(0);
    expect(r.meses[8].origem).toBe("parcial");
    expect(r.meses[8].aDepositar).toBeCloseTo(400 * (FGTS + P13 + FER), 6);
  });
});

describe("anosComFolha", () => {
  it("lista os anos em ordem, sem repetir", () => {
    expect(anosComFolha([p("2025-12", "a", "Salário", 1), p("2026-01", "a", "Salário", 1), p("2026-05", "a", "Diária", 1)])).toEqual([2025, 2026]);
  });
});
