/* HORA EXTRA LANÇADA À MÃO — o que a tela de Custos precisa acertar.
 *
 * O pedido veio do RH: "nessa aba de HE seria melhor ele calcular, tipo a
 * planilha — eu coloco o dia, a hora, o nome do funcionário e o salário, aí ele
 * calcula". Com uma condição: o valor tem de continuar editável, "porque tem
 * horas que tem bônus".
 *
 * A conta em si (salário ÷ 220 × fator × horas) já existia e não muda. O que
 * estes testes fixam é o que ESTAVA faltando e é onde dá para errar dinheiro:
 * ler a duração digitada sem transformar erro em R$ 0,00, e não deixar um
 * acréscimo manual se disfarçar de valor calculado.
 */
import { describe, it, expect } from "vitest";
import {
  minutosDaDuracao, diferencaDoCalculo, calcularHoraExtra,
  DIVISOR_MENSAL_PADRAO, FATOR_HE_PADRAO,
} from "./pontoFolha";

describe("duração digitada", () => {
  it("lê o formato da planilha do RH", () => {
    expect(minutosDaDuracao("02:50")).toBe(170);
    expect(minutosDaDuracao("01:00")).toBe(60);
    expect(minutosDaDuracao("01:30")).toBe(90);
    expect(minutosDaDuracao("05:00")).toBe(300);
  });

  it("aceita jornada longa (mais de 24h no acumulado do mês)", () => {
    expect(minutosDaDuracao("48:30")).toBe(2910);
  });

  it("aceita horas decimais com vírgula, que é como muita gente digita", () => {
    expect(minutosDaDuracao("2,5")).toBe(150);
    expect(minutosDaDuracao("3")).toBe(180);
  });

  it("RECUSA em vez de adivinhar — é aqui que se erra dinheiro", () => {
    // "2.50" seria 2h30 ou 2,5 horas? Adivinhar erra em reais.
    expect(minutosDaDuracao("2.50")).toBeNull();
    expect(minutosDaDuracao("abc")).toBeNull();
    expect(minutosDaDuracao("02:70")).toBeNull(); // 70 minutos não existe
    expect(minutosDaDuracao("")).toBeNull();
    expect(minutosDaDuracao(null)).toBeNull();
  });

  it("o que não se entende vira null, NUNCA zero", () => {
    /* `horaParaMin` do importador devolve 0 para lixo — e 0 minuto daria um
       lançamento de R$ 0,00, gravado em silêncio, com a digitação errada. */
    expect(minutosDaDuracao("xx:yy")).not.toBe(0);
    expect(minutosDaDuracao("xx:yy")).toBeNull();
  });
});

describe("a conta, com os números reais da planilha", () => {
  it("salário 2.800 e 02:50 de hora extra a +50%", () => {
    const r = calcularHoraExtra({ salario: 2800, minutos: 170 });
    // 2800 ÷ 220 = 12,7273/h · × 1,5 = 19,0909 · × 2,8333h = 54,09
    expect(r.valorHoraNormal).toBeCloseTo(12.73, 2);
    expect(r.valor).toBeCloseTo(54.09, 2);
    expect(r.semSalario).toBe(false);
  });

  it("salário 2.140 e 05:00 a +50%", () => {
    const r = calcularHoraExtra({ salario: 2140, minutos: 300 });
    // 2140 ÷ 220 × 1,5 × 5 = 72,95
    expect(r.valor).toBeCloseTo(72.95, 2);
  });

  it("domingo/feriado dobra a hora, não soma 50%", () => {
    // 2140 ÷ 220 × 2 × 5h = 97,27 (contra 72,95 no dia útil).
    expect(calcularHoraExtra({ salario: 2140, minutos: 300, fator: 2 }).valor).toBeCloseTo(97.27, 2);
    expect(calcularHoraExtra({ salario: 2140, minutos: 300, fator: 1.5 }).valor).toBeCloseTo(72.95, 2);
  });

  it("sem salário no cadastro avisa, não devolve zero mudo", () => {
    const r = calcularHoraExtra({ salario: null, minutos: 170 });
    expect(r.semSalario).toBe(true);
    expect(r.valor).toBe(0);
  });

  it("o divisor e o fator padrão continuam sendo os decididos", () => {
    // Se alguém mexer nisso, o valor de TODA hora extra muda: que quebre aqui.
    expect(DIVISOR_MENSAL_PADRAO).toBe(220);
    expect(FATOR_HE_PADRAO).toBe(1.5);
  });
});

describe("bônus por cima do calculado", () => {
  it("acréscimo aparece como diferença", () => {
    // Calculou 54,09 e o RH pagou 80,00: os 25,91 são o bônus.
    expect(diferencaDoCalculo(80, 54.09)).toBeCloseTo(25.91, 2);
  });

  it("valor menor também aparece, com sinal", () => {
    expect(diferencaDoCalculo(50, 54.09)).toBeCloseTo(-4.09, 2);
  });

  it("centavo de arredondamento não é bônus", () => {
    expect(diferencaDoCalculo(54.09, 54.09)).toBe(0);
    expect(diferencaDoCalculo(54.093, 54.09)).toBe(0);
  });

  it("sem cálculo (sem salário) não inventa diferença", () => {
    // Quem digitou o valor à mão porque não há salário no cadastro não pode
    // ver "R$ 80,00 de bônus" — não houve conta nenhuma para comparar.
    expect(diferencaDoCalculo(80, 0)).toBe(0);
  });
});
