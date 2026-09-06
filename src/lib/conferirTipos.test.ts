import { describe, expect, it } from "vitest";
import { conferirTipos } from "./conferirTipos";
import type { Pagamento } from "@/data/types";

const pag = (id: string, tipo: string, descricao: string | undefined, extra: Partial<Pagamento> = {}): Pagamento => ({
  id, colaboradorId: "fulana", competencia: "2026-08", tipo, valor: 100, dataPagamento: "2026-08-20", descricao, idMubi: "1", ...extra,
});

describe("conferirTipos", () => {
  it("vazio: nada a conferir, nada divergente", () => {
    expect(conferirTipos([])).toEqual({ conferiveis: 0, semConta: 0, divergencias: [], porTroca: [] });
  });

  it("o caso real de agosto/2026: comissão gravada como Diária", () => {
    const r = conferirTipos([pag("mubi-1", "Diária", "COMISSÃO AGOSTO · 2.1.11.1-Comissão interna")]);
    expect(r.conferiveis).toBe(1);
    expect(r.divergencias).toHaveLength(1);
    expect(r.divergencias[0]).toMatchObject({ id: "mubi-1", de: "Diária", para: "Comissão", plano: "2.1.11.1-Comissão interna", valor: 100 });
    expect(r.porTroca).toEqual([{ de: "Diária", para: "Comissão", quantos: 1, valor: 100 }]);
  });

  it("lançamento certo não aparece", () => {
    const r = conferirTipos([pag("a", "Salário", "Pagamento salário · 2.1.1-Salário"), pag("b", "Diária", "2.1.11.3-Diária")]);
    expect(r.conferiveis).toBe(2);
    expect(r.divergencias).toEqual([]);
  });

  it("manual e planilha antiga (sem conta na descrição) ficam FORA — nunca são 'corrigidos'", () => {
    const r = conferirTipos([
      pag("pg_man_1", "Comissão", "Lançamento manual", { idMubi: null, manual: true }),
      pag("pg_0003", "Salário", undefined, { idMubi: null }),
      pag("pg_0004", "Diária", "Diária viagem · sem conta", { idMubi: null }),
    ]);
    expect(r.semConta).toBe(3);
    expect(r.conferiveis).toBe(0);
    expect(r.divergencias).toEqual([]);
  });

  it("ordena do mês mais recente para o mais antigo e agrupa as trocas", () => {
    const r = conferirTipos([
      pag("j1", "Limpeza/Faxina", "2.1.11.3-Diária", { competencia: "2026-07", colaboradorId: "b" }),
      pag("a1", "Limpeza/Faxina", "2.1.11.3-Diária", { competencia: "2026-08", colaboradorId: "z" }),
      pag("a2", "Horas Extras", "2.1.11.4-Empreita", { competencia: "2026-08", colaboradorId: "a", valor: 50.5 }),
      pag("j2", "Limpeza/Faxina", "2.1.11.3-Diária", { competencia: "2026-07", colaboradorId: "a" }),
    ]);
    expect(r.divergencias.map((d) => d.id)).toEqual(["a2", "a1", "j2", "j1"]);
    expect(r.porTroca).toEqual([
      { de: "Limpeza/Faxina", para: "Diária", quantos: 3, valor: 300 },
      { de: "Horas Extras", para: "Freelancer (Empreita)", quantos: 1, valor: 50.5 },
    ]);
  });

  it("conta desconhecida mantém o tipo gravado (não vira divergência por falta de regra)", () => {
    const r = conferirTipos([pag("x", "Estágio/Bolsa", "Bolsa · 9.9.9-Coisa sem nome conhecido")]);
    expect(r.divergencias).toEqual([]);
  });
});
