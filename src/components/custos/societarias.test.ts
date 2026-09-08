import { describe, expect, it } from "vitest";
import { contasCandidatas, entradasDoSocio, sociosComMovimento } from "./societarias";
import { chaveContaSocio, NAO_E_DE_SOCIO } from "@/lib/custos";
import type { Colaborador, ContaPlano, Pagamento } from "@/data/types";

const pedro = { id: "pedro-ramos", nome: "Pedro Ramos", ehDirecao: true, statusId: "direcao" } as Colaborador;
const pg = (competencia: string, valor: number, tipo = "Arrendamento"): Pagamento =>
  ({ id: `p${competencia}${valor}`, colaboradorId: "pedro-ramos", competencia, tipo, valor, dataPagamento: `${competencia}-20` });
const conta = (competencia: string, codigo: string, valor: number): ContaPlano =>
  ({ id: `pc_${competencia}_${codigo}`, competencia, codigo, nome: codigo, valor, folha: true });

describe("entradasDoSocio — um valor, uma fonte", () => {
  /* A PRIORIDADE MUDOU EM 08/09/2026, e os dados reais mandaram.
   *
   * Era: qualquer lançamento no Contas a Pagar ganhava do plano. Em maio o
   * Leonardo tem UM título lá — "AMIL LEONARDO", R$ 3.146,27, plano de saúde —
   * e esse único título ganhou do plano do contador, que fecha o mês em
   * R$ 15.961,02. A tela mostrava 3.146,27, escondia R$ 12.814,75 e desenhava
   * uma queda de 93% que nunca existiu.
   *
   * As fontes não são equivalentes: o plano é o mês FECHADO; o Contas a Pagar
   * traz só os títulos que casaram com a pessoa pelo nome. */
  it("O CASO RUIM: um título solto não pode ganhar do mês fechado do contador", () => {
    const r = entradasDoSocio(
      pedro,
      [pg("2026-05", 3146.27, "Plano de Saúde")],
      [conta("2026-05", "2.14.1.2", 15961.02)],
      "2026-05",
    );
    expect(r.fonte).toBe("plano");
    expect(r.total).toBeCloseTo(15961.02, 2);
    // E o que ficou de fora é DECLARADO, não sumido.
    expect(r.outraFonte).toEqual({ fonte: "contas-a-pagar", total: 3146.27, linhas: 1 });
  });

  it("sem plano no mês, o Contas a Pagar entra", () => {
    const r = entradasDoSocio(pedro, [pg("2026-08", 6000), pg("2026-08", 5250)], [], "2026-08");
    expect(r.fonte).toBe("contas-a-pagar");
    expect(r.total).toBe(11250);
    expect(r.entradas.map((e) => e.valor)).toEqual([6000, 5250]);
    expect(r.outraFonte).toBeUndefined();
  });
  it("nunca soma as duas fontes — seria o mesmo dinheiro duas vezes", () => {
    const r = entradasDoSocio(pedro, [pg("2026-08", 6000)], [conta("2026-04", "2.14.1.2", 10539.3), conta("2026-04", "2.14.1", 500), conta("2026-04", "2.14.2.2", 777)], "2026-04");
    expect(r.fonte).toBe("plano");
    expect(r.total).toBe(11039.3);
    expect(r.entradas.map((e) => e.detalhe)).toEqual(["2.14.1.2", "2.14.1"]); // só o card dele, não o 2.14.2 do outro sócio
  });
  it("nada em lugar nenhum: zero e fonte nula", () => {
    expect(entradasDoSocio(pedro, [], [], "2026-05")).toEqual({ entradas: [], total: 0, fonte: null });
  });
});

/* SÓ QUEM TEM DINHEIRO APARECE (08/09/2026).
 *
 * Pedido do Léo olhando a tela: "a saída societárias pode ficar só Leonardo e
 * Pedro, o resto não precisa". No cadastro há TRÊS pessoas marcadas como
 * direção — a terceira não tem lançamento nenhum nem conta no plano, então a
 * aba dela é sempre R$ 0,00 e só ocupa espaço.
 *
 * A régua é o DINHEIRO, não os dois nomes escritos no código. Se um sócio novo
 * passar a receber, ele aparece sozinho; se um dos dois parar de vez, some. Nome
 * fixo aqui envelheceria no dia em que a sociedade mudasse.
 *
 * Começa pelo caso ruim: sumir com alguém que TEM dinheiro.
 */
describe("sociosComMovimento", () => {
  const leo = { id: "leonardo-goncalves", nome: "Leonardo Gonçalves", ehDirecao: true, statusId: "direcao" } as Colaborador;
  const ines = { id: "maria-ines", nome: "Maria Inês", ehDirecao: true, statusId: "direcao" } as Colaborador;
  const pgDe = (id: string, competencia: string, valor: number): Pagamento =>
    ({ id: `x${id}${competencia}`, colaboradorId: id, competencia, tipo: "Retirada", valor, dataPagamento: `${competencia}-05` }) as Pagamento;

  it("O CASO RUIM: sócio com lançamento em QUALQUER mês continua na lista", () => {
    // Nem que o mês aberto na tela seja outro: a aba não pode sumir só porque
    // o mês em foco está vazio.
    const r = sociosComMovimento([pedro, leo, ines], [pgDe("leonardo-goncalves", "2026-01", 55234.92)], []);
    expect(r.visiveis.map((s) => s.id)).toContain("leonardo-goncalves");
  });

  it("sócio que só existe no plano do contador também fica", () => {
    const r = sociosComMovimento([pedro, ines], [], [conta("2026-04", "2.14.1.2", 10539.3)]);
    expect(r.visiveis.map((s) => s.id)).toEqual(["pedro-ramos"]);
    expect(r.ocultos).toBe(1);
  });

  it("quem não tem dinheiro em lugar nenhum sai, e o quanto sai é declarado", () => {
    const r = sociosComMovimento([pedro, leo, ines], [pgDe("pedro-ramos", "2026-06", 37073.74), pgDe("leonardo-goncalves", "2026-06", 1)], []);
    expect(r.visiveis.map((s) => s.id)).toEqual(["pedro-ramos", "leonardo-goncalves"]);
    expect(r.ocultos).toBe(1);
  });

  it("valor zero não conta como movimento", () => {
    // Precisa de alguém COM dinheiro na mesma lista, senão cai na proteção
    // "ninguém tem nada, mostra todos" e o teste passaria pelo motivo errado —
    // foi o que aconteceu na primeira escrita dele.
    const r = sociosComMovimento([pedro, ines], [pgDe("pedro-ramos", "2026-06", 100), pgDe("maria-ines", "2026-06", 0)], []);
    expect(r.visiveis.map((s) => s.id)).toEqual(["pedro-ramos"]);
    expect(r.ocultos).toBe(1);
  });

  it("ninguém com dinheiro: mostra todos em vez de tela vazia", () => {
    // Esconder todo mundo deixaria a tela dizendo "nenhum sócio no cadastro",
    // que é mentira — eles existem, só não receberam nada.
    const r = sociosComMovimento([pedro, leo, ines], [], []);
    expect(r.visiveis.map((s) => s.id)).toEqual(["pedro-ramos", "leonardo-goncalves", "maria-ines"]);
    expect(r.ocultos).toBe(0);
  });

  it("Pedro e Leonardo primeiro, o resto em ordem de nome", () => {
    const r = sociosComMovimento([ines, leo, pedro], [
      pgDe("maria-ines", "2026-06", 10), pgDe("leonardo-goncalves", "2026-06", 10), pgDe("pedro-ramos", "2026-06", 10),
    ], []);
    expect(r.visiveis.map((s) => s.id)).toEqual(["pedro-ramos", "leonardo-goncalves", "maria-ines"]);
  });
});

/* O VÍNCULO À MÃO, que sobrevive à renumeração (08/09/2026).
 *
 * Em julho o contador moveu as retiradas do Leonardo de 2.14.2.2 para 2.11.2.2
 * e a equivalência automática NÃO resolveu: "Leonardo" aparece sob três pais
 * diferentes no plano — retirada num, antecipação de recebíveis noutro — então
 * o nome sozinho não identifica. R$ 28.105,64 de julho, R$ 30.641,92 de agosto
 * e R$ 60.745,30 de setembro ficaram fora da tela sem nada avisar.
 *
 * Adivinhar pelo nome seria pior que não achar: juntaria a antecipação de
 * recebíveis à retirada. Quando a máquina não sabe, quem sabe é o dono.
 *
 * Começa pelo caso ruim: o palpite que junta o que não é do mesmo bolso.
 */
describe("vínculo à mão de conta do plano ao sócio", () => {
  const leo = { id: "leonardo-goncalves", nome: "Leonardo Gonçalves", ehDirecao: true, statusId: "direcao" } as Colaborador;

  it("O CASO RUIM: sem o vínculo, a conta renumerada NÃO é adivinhada", () => {
    // 2.11.2.2 "Leonardo" não casa com o prefixo 2.14.2. e não tem equivaleA.
    const r = entradasDoSocio(leo, [], [conta("2026-07", "2.11.2.2", 28105.64)], "2026-07");
    expect(r.total).toBe(0);
    expect(r.fonte).toBeNull();
  });

  it("com o vínculo, julho aparece", () => {
    const r = entradasDoSocio(leo, [], [conta("2026-07", "2.11.2.2", 28105.64)], "2026-07", { [chaveContaSocio("2.11.2.2", "2.11.2.2")]: "leonardo" });
    expect(r.fonte).toBe("plano");
    expect(r.total).toBeCloseTo(28105.64, 2);
  });

  it("o vínculo TIRA a conta do outro card — senão o dinheiro apareceria duas vezes", () => {
    // 2.14.1.2 é do Pedro pelo prefixo; mandada à mão para o Leonardo, some do Pedro.
    const plano = [conta("2026-04", "2.14.1.2", 10539.3)];
    const v = { [chaveContaSocio("2.14.1.2", "2.14.1.2")]: "leonardo" };
    expect(entradasDoSocio(pedro, [], plano, "2026-04", v).total).toBe(0);
    expect(entradasDoSocio(leo, [], plano, "2026-04", v).total).toBeCloseTo(10539.3, 2);
  });

  it("conta vinculada entra no histórico e a pessoa volta a aparecer na lista", () => {
    const r = sociosComMovimento([leo], [], [conta("2026-07", "2.11.2.2", 28105.64)], { [chaveContaSocio("2.11.2.2", "2.11.2.2")]: "leonardo" });
    expect(r.visiveis.map((s) => s.id)).toEqual(["leonardo-goncalves"]);
  });
});

/* AS CANDIDATAS: o que a máquina mostra em vez de adivinhar (08/09/2026). */
describe("contasCandidatas", () => {
  const leo = { id: "leonardo-goncalves", nome: "Leonardo Gonçalves", ehDirecao: true, statusId: "direcao" } as Colaborador;
  const cJul = (codigo: string, nome: string, valor: number): ContaPlano =>
    ({ id: `pc_2026-07_${codigo}`, competencia: "2026-07", codigo, nome, valor, folha: true });

  it("O CASO RUIM: não junta os dois 'Leonardo' — mostra os dois para escolher", () => {
    // 2.11.2.2 é retirada; 2.13.5.1 é antecipação de recebíveis. Mesmo nome,
    // bolsos diferentes. Somar seria inventar dinheiro na conta do sócio.
    const r = contasCandidatas(
      [cJul("2.11.2.2", "Leonardo", 28105.64), cJul("2.13.5.1", "Leonardo", 10000)],
      "2026-07", [leo],
    );
    expect(r.map((c) => c.codigo)).toEqual(["2.11.2.2", "2.13.5.1"]);
  });

  it("some da lista assim que é vinculada — a decisão não volta a ser pedida", () => {
    const plano = [cJul("2.11.2.2", "Leonardo", 28105.64), cJul("2.13.5.1", "Leonardo", 10000)];
    const r = contasCandidatas(plano, "2026-07", [leo], { [chaveContaSocio("2.11.2.2", "Leonardo")]: "leonardo" });
    expect(r.map((c) => c.codigo)).toEqual(["2.13.5.1"]);
  });

  it("conta que não nomeia sócio nenhum não polui a lista", () => {
    const r = contasCandidatas([cJul("2.6.1", "Energia Elétrica", 9000)], "2026-07", [leo]);
    expect(r).toEqual([]);
  });

  it("linha zerada não é decisão a tomar", () => {
    const r = contasCandidatas([cJul("2.11.2.2", "Leonardo", 0)], "2026-07", [leo]);
    expect(r).toEqual([]);
  });
});

/* REMOVER E LANÇAR À MÃO (08/09/2026).
 *
 * Pedido do Léo: "ser possível remover se achar que não faz sentido" e "em cima
 * um botão lançamento manual".
 *
 * Antes só dava para TROCAR o dono de uma conta. Faltava o terceiro estado:
 * "esta conta não é de sócio nenhum" — o prefixo do plano puxa a conta e o Léo
 * discorda. E faltava poder acrescentar o que não passa nem pelo ERP nem pelo
 * plano do contador.
 *
 * Começa pelo caso ruim: o lançamento à mão sumir porque o mês tem plano.
 */
describe("remover uma conta do card", () => {
  const leo = { id: "leonardo-goncalves", nome: "Leonardo Gonçalves", ehDirecao: true, statusId: "direcao" } as Colaborador;

  it("O CASO RUIM: 'não é de sócio' não pode virar só uma troca de dono", () => {
    // Sem o terceiro estado, tirar do Pedro jogava no Leonardo (ou vice-versa).
    // A conta tem de sair dos DOIS.
    const plano = [conta("2026-04", "2.14.1.2", 10539.3)];
    const v = { [chaveContaSocio("2.14.1.2", "2.14.1.2")]: NAO_E_DE_SOCIO };
    expect(entradasDoSocio(pedro, [], plano, "2026-04", v).total).toBe(0);
    expect(entradasDoSocio(leo, [], plano, "2026-04", v).total).toBe(0);
  });

  it("sem apontamento nenhum, o prefixo do plano continua valendo", () => {
    expect(entradasDoSocio(pedro, [], [conta("2026-04", "2.14.1.2", 10539.3)], "2026-04").total).toBeCloseTo(10539.3, 2);
  });
});

describe("lançamento à mão", () => {
  const manual = (competencia: string, valor: number, rotulo = "Retirada extra") => ({
    id: `m${competencia}${valor}`, socioId: "pedro-ramos", competencia, rotulo, valor,
  });

  it("O CASO RUIM: soma mesmo quando o mês já vem do plano do contador", () => {
    // Se ele só entrasse na ausência de outra fonte, o Léo escreveria a linha,
    // ela não apareceria, e ele não saberia por quê.
    const r = entradasDoSocio(pedro, [], [conta("2026-04", "2.14.1.2", 10539.3)], "2026-04", {}, [manual("2026-04", 500)]);
    expect(r.fonte).toBe("plano");
    expect(r.total).toBeCloseTo(11039.3, 2);
    expect(r.entradas.find((e) => e.manual)?.valor).toBe(500);
  });

  it("soma também quando a fonte é o Contas a Pagar", () => {
    const r = entradasDoSocio(pedro, [pg("2026-08", 6000)], [], "2026-08", {}, [manual("2026-08", 250)]);
    expect(r.total).toBeCloseTo(6250, 2);
  });

  it("sozinho, ele é a fonte do mês — antes o mês ficava vazio", () => {
    const r = entradasDoSocio(pedro, [], [], "2026-09", {}, [manual("2026-09", 1200)]);
    expect(r.fonte).toBe("manual");
    expect(r.total).toBe(1200);
  });

  it("lançamento de OUTRO sócio ou de outro mês não entra", () => {
    const outros = [
      { ...manual("2026-04", 500), socioId: "leonardo-goncalves" },
      manual("2026-03", 900),
    ];
    expect(entradasDoSocio(pedro, [], [], "2026-04", {}, outros).total).toBe(0);
  });

  it("a linha à mão vem marcada — quem lê precisa saber que não veio de sistema", () => {
    const r = entradasDoSocio(pedro, [], [], "2026-04", {}, [manual("2026-04", 500)]);
    expect(r.entradas[0].manual).toBe(true);
  });
});

/* O NÚMERO SOZINHO NÃO IDENTIFICA A CONTA (08/09/2026).
 *
 * Achado da revisão adversarial dos meus próprios consertos. Eu tinha gravado o
 * vínculo do sócio só pelo CÓDIGO, valendo em todos os meses — repetindo o erro
 * que eu mesmo consertei horas antes em contaQueParou.ts.
 *
 * Nos dados reais são 25+ códigos com dois nomes diferentes em meses
 * diferentes, e um deles vive dentro do próprio card do sócio: 2.14.2.1 é
 * "Contas Pagas" em junho e "LGP" em janeiro.
 *
 * Começa pelo caso ruim: o clique num mês estragar outro mês.
 */
describe("o vínculo é da CONTA, não do número", () => {
  const leo = { id: "leonardo-goncalves", nome: "Leonardo Gonçalves", ehDirecao: true, statusId: "direcao" } as Colaborador;
  const c = (competencia: string, codigo: string, nome: string, valor: number): ContaPlano =>
    ({ id: `pc_${competencia}_${codigo}`, competencia, codigo, nome, valor, folha: true });

  it("O CASO RUIM: 'não é daqui' num mês não pode apagar outra conta de mesmo número", () => {
    // 2.14.2.1 = "Contas Pagas" em junho (R$ 0) e "LGP" em janeiro (R$ 328).
    // Tirar a de junho não pode levar a de janeiro junto.
    const plano = [c("2026-06", "2.14.2.1", "Contas Pagas", 0), c("2026-01", "2.14.2.1", "LGP", 328)];
    const v = { [chaveContaSocio("2.14.2.1", "Contas Pagas")]: NAO_E_DE_SOCIO };
    expect(entradasDoSocio(leo, [], plano, "2026-01", v).total).toBe(328);
  });

  it("apontar em julho não puxa o mesmo número de outro mês", () => {
    const plano = [c("2026-07", "2.11.2.2", "Leonardo", 28105.64), c("2026-05", "2.11.2.2", "Munk / Guindaste", 1820)];
    const v = { [chaveContaSocio("2.11.2.2", "Leonardo")]: "leonardo" };
    expect(entradasDoSocio(leo, [], plano, "2026-07", v).total).toBeCloseTo(28105.64, 2);
    expect(entradasDoSocio(leo, [], plano, "2026-05", v).total).toBe(0);
  });

  it("mas continua valendo em TODOS os meses em que a conta é a mesma", () => {
    // É isto que faz o apontamento sobreviver à renumeração — o ponto todo dele.
    const plano = [c("2026-07", "2.11.2.2", "Leonardo", 28105.64), c("2026-08", "2.11.2.2", "Leonardo", 30641.92)];
    const v = { [chaveContaSocio("2.11.2.2", "Leonardo")]: "leonardo" };
    expect(entradasDoSocio(leo, [], plano, "2026-08", v).total).toBeCloseTo(30641.92, 2);
  });

  it("acento e caixa não separam a mesma conta", () => {
    const plano = [c("2026-07", "2.9.9", "Combustível", 100)];
    const v = { [chaveContaSocio("2.9.9", "COMBUSTIVEL")]: "leonardo" };
    expect(entradasDoSocio(leo, [], plano, "2026-07", v).total).toBe(100);
  });
});
