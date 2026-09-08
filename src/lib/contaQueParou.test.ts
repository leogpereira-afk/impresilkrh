/* A conta que pagava gente e parou.
 *
 * O caso real (07/09/2026): o Léo disse "os últimos custos de limpeza não estão
 * na ficha dos funcionários". A faxina para em junho/2026 — Barbara e Marcella
 * continuam ativas e recebendo salário, adiantamento e comissão em julho e
 * agosto, então não é problema de casar nome. A conta 2.3.2.1-Limpeza
 * Escritório simplesmente deixou de aparecer, e nada na tela dizia isso.
 *
 * Começa pelo caso ruim: acusar sumiço de conta que nunca foi hábito. Alarme
 * que dispara à toa é alarme que ninguém lê.
 */
import { describe, it, expect } from "vitest";
import { contasQuePararam, planoDaDescricao, distanciaEmMeses } from "./contaQueParou";
import type { Pagamento } from "@/data/types";

const p = (competencia: string, descricao: string, valor: number, colaboradorId = "barbara") =>
  ({ competencia, descricao, valor, colaboradorId }) as Pagamento;
const nomes: Record<string, string> = { barbara: "Barbara Patrícia F. Vasconcelos", marcella: "Marcella Laiara Rocha Farias" };
const nomeDe = (id: string) => nomes[id] ?? id;

const FAXINA = "Faxina · 2.3.2.1-Limpeza Escritório";

describe("o caso ruim: não acusar o que nunca foi hábito", () => {
  it("conta que apareceu UMA vez e sumiu não é achado", () => {
    const pags = [p("2026-01", FAXINA, 300)];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("duas aparições ainda não são hábito (o piso é três)", () => {
    const pags = [p("2026-01", FAXINA, 300), p("2026-02", FAXINA, 300)];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("conta que AINDA está vindo não é achado", () => {
    const pags = ["2026-05", "2026-06", "2026-07", "2026-08"].map((c) => p(c, FAXINA, 300));
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("lançamento sem plano na descrição não vira conta nenhuma", () => {
    const pags = ["2026-01", "2026-02", "2026-03"].map((c) => p(c, "Faxina do mês", 300));
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("competência inválida não entra na conta", () => {
    const pags = [p("lixo", FAXINA, 300), p("", FAXINA, 300), p("2026-13", FAXINA, 300)];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("sem 'até' válido, não afirma nada", () => {
    const pags = ["2026-01", "2026-02", "2026-03"].map((c) => p(c, FAXINA, 300));
    expect(contasQuePararam(pags, "", nomeDe)).toEqual([]);
    expect(contasQuePararam(pags, "2026", nomeDe)).toEqual([]);
  });
});

describe("o caso real da faxina", () => {
  const pags = [
    p("2026-03", FAXINA, 450), p("2026-03", FAXINA, 300, "marcella"),
    p("2026-04", FAXINA, 75),
    p("2026-05", FAXINA, 300), p("2026-05", FAXINA, 300, "marcella"),
    p("2026-06", FAXINA, 355), p("2026-06", FAXINA, 375, "marcella"),
    // julho e agosto: salário chega, faxina não
    p("2026-07", "Pagamento de salário · 2.1.1-Salário", 955.76),
    p("2026-08", "Pagamento de salário · 2.1.1-Salário", 484.44),
  ];
  const [achado] = contasQuePararam(pags, "2026-08", nomeDe);

  it("acha a conta da limpeza, com o rótulo que a pessoa reconhece", () => {
    expect(achado.codigo).toBe("2.3.2.1");
    expect(achado.rotulo).toBe("2.3.2.1-Limpeza Escritório");
  });

  it("diz desde quando parou e há quantos meses", () => {
    expect(achado.ultimaComp).toBe("2026-06");
    expect(achado.mesesParada).toBe(2);
    expect(achado.meses).toBe(4); // mar, abr, mai, jun
  });

  it("diz o tamanho do que está faltando", () => {
    expect(achado.total).toBeCloseTo(2155, 2);
    expect(achado.mediaMensal).toBeCloseTo(538.75, 2);
  });

  it("nomeia quem recebia — é a pergunta seguinte de quem lê", () => {
    expect(achado.pessoas).toContain("Barbara Patrícia F. Vasconcelos");
    expect(achado.pessoas).toContain("Marcella Laiara Rocha Farias");
  });

  it("a conta de salário, que continua vindo, NÃO aparece", () => {
    expect(contasQuePararam(pags, "2026-08", nomeDe).map((c) => c.codigo)).toEqual(["2.3.2.1"]);
  });
});

describe("ordem e leitura", () => {
  it("o que some mais dinheiro por mês vem primeiro", () => {
    const grande = ["2026-01", "2026-02", "2026-03"].map((c) => p(c, "x · 2.1.12-Comissão Interna", 4000));
    const pequena = ["2026-01", "2026-02", "2026-03"].map((c) => p(c, FAXINA, 300));
    const r = contasQuePararam([...pequena, ...grande], "2026-08", nomeDe);
    expect(r.map((c) => c.codigo)).toEqual(["2.1.12", "2.3.2.1"]);
  });

  it("competência posterior ao 'até' é ignorada — a régua é o mês fechado", () => {
    const pags = [...["2026-01", "2026-02", "2026-03"].map((c) => p(c, FAXINA, 300)), p("2026-09", FAXINA, 300)];
    // Olhando até agosto, a de setembro não existe: a conta continua parada.
    expect(contasQuePararam(pags, "2026-08", nomeDe)[0].mesesParada).toBe(5);
    // Olhando até setembro, ela voltou.
    expect(contasQuePararam(pags, "2026-09", nomeDe)).toEqual([]);
  });
});

describe("as peças soltas", () => {
  it("o plano sai depois do ponto do meio", () => {
    expect(planoDaDescricao("Faxina · 2.3.2.1-Limpeza Escritório")).toBe("2.3.2.1-Limpeza Escritório");
    expect(planoDaDescricao("Sem plano nenhum")).toBe("");
    expect(planoDaDescricao(null)).toBe("");
  });

  it("distância em meses atravessa o ano", () => {
    expect(distanciaEmMeses("2025-11", "2026-02")).toBe(3);
    expect(distanciaEmMeses("2026-06", "2026-08")).toBe(2);
    expect(distanciaEmMeses("2026-08", "2026-08")).toBe(0);
  });
});
