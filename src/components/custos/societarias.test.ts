import { describe, expect, it } from "vitest";
import { entradasDoSocio } from "./societarias";
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
