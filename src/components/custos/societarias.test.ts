import { describe, expect, it } from "vitest";
import { entradasDoSocio, sociosComMovimento } from "./societarias";
import type { Colaborador, ContaPlano, Pagamento } from "@/data/types";

const pedro = { id: "pedro-ramos", nome: "Pedro Ramos", ehDirecao: true, statusId: "direcao" } as Colaborador;
const pg = (competencia: string, valor: number, tipo = "Arrendamento"): Pagamento =>
  ({ id: `p${competencia}${valor}`, colaboradorId: "pedro-ramos", competencia, tipo, valor, dataPagamento: `${competencia}-20` });
const conta = (competencia: string, codigo: string, valor: number): ContaPlano =>
  ({ id: `pc_${competencia}_${codigo}`, competencia, codigo, nome: codigo, valor, folha: true });

describe("entradasDoSocio — um valor, uma fonte", () => {
  it("com lançamento gravado para a pessoa, a fonte é o Contas a Pagar", () => {
    const r = entradasDoSocio(pedro, [pg("2026-08", 6000), pg("2026-08", 5250)], [conta("2026-08", "2.14.1.2", 999)], "2026-08");
    expect(r.fonte).toBe("contas-a-pagar");
    expect(r.total).toBe(11250);
    expect(r.entradas.map((e) => e.valor)).toEqual([6000, 5250]);
  });
  it("sem lançamento, cai no plano do contador (2.14 do sócio) — nunca soma os dois", () => {
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
