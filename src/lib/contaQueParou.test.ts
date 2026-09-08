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
import { contasQuePararam, planoDaDescricao, distanciaEmMeses, nomeComparavel } from "./contaQueParou";
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

/* A RENUMERAÇÃO (07/09/2026). O contador trocou os números do plano em julho, e
 * a regra agrupando por CÓDIGO passou a acusar 9 contas paradas — 4 delas só
 * tinham mudado de número. A limpeza, que é o achado de verdade, ficava em
 * ÚLTIMO na lista por ser a menor. Alarme que enterra o achado é pior que
 * alarme nenhum.
 *
 * Os casos abaixo são os dados reais do banco, não inventados. */
describe("mudou de número não é parou", () => {
  const tresMeses = (plano: string, valor: number) =>
    ["2026-04", "2026-05", "2026-06"].map((c) => p(c, `x · ${plano}`, valor));

  it("o mesmo nome sob código novo: a conta velha NÃO é acusada", () => {
    // 2.1.12-Comissão Interna (até jun) virou 2.1.11.1-Comissão interna (jul).
    const pags = [
      ...tresMeses("2.1.12-Comissão Interna", 4000),
      p("2026-07", "x · 2.1.11.1-Comissão interna", 1593.62),
      p("2026-08", "x · 2.1.11.1-Comissão interna", 12314.95),
    ];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("o caso real da hora extra: 2.1.11 → 2.1.11.6 não é acusado", () => {
    // 2.1.11-Horas Extras (R$ 44.904 no ano) → 2.1.11.6-Hora Extra. Aqui DUAS
    // guardas cobrem: o plural e o pai/filho. Por isso o teste abaixo isola o
    // plural — senão eu estaria provando uma regra com a outra.
    const pags = [
      ...tresMeses("2.1.11-Horas Extras", 7000),
      p("2026-07", "x · 2.1.11.6-Hora Extra", 1598.55),
    ];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("só o plural, sem parentesco de código, já segura o alarme", () => {
    // Código de outro galho de propósito: se o plural falhar, nada mais salva.
    const pags = [
      ...tresMeses("2.1.11-Horas Extras", 7000),
      p("2026-07", "x · 2.4.9-Hora Extra", 1598.55),
    ];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("conta que virou pai de subcontas não é conta parada", () => {
    // 2.11.1-Freelancer parou em abril; 2.11.1.1 e 2.11.1.2 começaram depois.
    const pags = [
      ...["2026-02", "2026-03", "2026-04"].map((c) => p(c, "x · 2.11.1-Freelancer", 1300)),
      p("2026-07", "x · 2.11.1.2-Pedro Ramos Pereira", 6704.25),
    ];
    expect(contasQuePararam(pags, "2026-08", nomeDe)).toEqual([]);
  });

  it("o mesmo NÚMERO com outro significado não vira uma conta só", () => {
    // 2.1.11.1 era "Diária" até junho e virou "Comissão interna" em julho.
    // Somar os dois daria uma conta de R$ 15.264 que nunca existiu.
    const pags = [
      ...tresMeses("2.1.11.1-Diária", 450),
      p("2026-07", "x · 2.1.11.1-Comissão interna", 1593.62),
      p("2026-08", "x · 2.1.11.1-Comissão interna", 12314.95),
    ];
    const r = contasQuePararam(pags, "2026-08", nomeDe);
    // A Diária parou de verdade (o nome não reapareceu em lugar nenhum) e é
    // acusada com o SEU total, sem a comissão junto.
    expect(r.map((c) => c.rotulo)).toEqual(["2.1.11.1-Diária"]);
    expect(r[0].total).toBeCloseTo(1350, 2);
  });

  it("a limpeza continua sendo achado — ela não reapareceu em lugar nenhum", () => {
    const pags = [
      ...tresMeses("2.3.2.1-Limpeza Escritório", 350),
      ...tresMeses("2.1.12-Comissão Interna", 4000),
      p("2026-07", "x · 2.1.11.1-Comissão interna", 1593.62),
      p("2026-07", "x · 2.1.1-Salário", 33186.84),
    ];
    // Das duas que sumiram do plano velho, só a limpeza é notícia.
    expect(contasQuePararam(pags, "2026-08", nomeDe).map((c) => c.codigo)).toEqual(["2.3.2.1"]);
  });
});

describe("nomeComparavel", () => {
  it("iguala o que o contador escreveu diferente", () => {
    expect(nomeComparavel("Comissão Interna")).toBe(nomeComparavel("Comissão interna"));
    expect(nomeComparavel("Horas Extras")).toBe(nomeComparavel("Hora Extra"));
    expect(nomeComparavel("Incentivo de Viagens")).toBe(nomeComparavel("incentivo de viagens"));
  });

  it("não iguala o que é diferente de verdade", () => {
    expect(nomeComparavel("Diária")).not.toBe(nomeComparavel("Comissão interna"));
    expect(nomeComparavel("Hora Extra")).not.toBe(nomeComparavel("Empreita"));
    // "Bônus" não é plural, mas termina em s e perde o s como qualquer outra.
    // Não atrapalha: o corte é simétrico, então ela continua casando consigo
    // mesma escrita de qualquer jeito — que é para o que a régua serve.
    expect(nomeComparavel("Bônus")).toBe(nomeComparavel("BONUS"));
    expect(nomeComparavel("Bônus")).not.toBe(nomeComparavel("Diária"));
    // O corte só vale para palavra com MAIS de 3 letras — sigla curta fica
    // inteira. Acima disso ela cai no corte igual às outras ("Fgts" → "fgt"),
    // e tudo bem: o corte é simétrico e nenhuma outra conta da casa vira "fgt".
    expect(nomeComparavel("Gps")).toBe("gps");
    expect(nomeComparavel("Fgts")).toBe(nomeComparavel("FGTS"));
  });
});
