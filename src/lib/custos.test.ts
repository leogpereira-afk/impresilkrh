// Reconciliação da folha. Foi um erro aqui que gerou 98 pagamentos duplicados
// (R$ 62.576,49) quando a mesma planilha subiu duas vezes. A regra de subir de
// novo sem duplicar fica travada por teste.
import { describe, it, expect } from "vitest";
import { conciliarPagamentos, classificarPagamento } from "./custos";
import type { Pagamento } from "@/data/types";

const pg = (over: Partial<Pagamento> = {}): Pagamento =>
  ({
    id: `x${Math.random()}`,
    colaboradorId: "joao",
    competencia: "2026-06",
    tipo: "Salário",
    valor: 2500,
    dataPagamento: "2026-07-05",
    ...over,
  } as Pagamento);

describe("conciliarPagamentos", () => {
  it("subir a MESMA planilha de novo não duplica nada", () => {
    const atuais = [pg(), pg({ colaboradorId: "maria", valor: 3100 })];
    // mesmo conteúdo, ids novos (é o que o parser gera a cada importação)
    const denovo = atuais.map((p) => pg({ ...p, id: `novo-${p.id}` }));
    const r = conciliarPagamentos(atuais, denovo);
    expect(r.iguais).toHaveLength(2);
    expect(r.novos).toHaveLength(0);
    expect(r.alterados).toHaveLength(0);
    expect(r.ausentes).toHaveLength(0);
  });

  it("valor corrigido vira ALTERADO, não um lançamento novo", () => {
    const atuais = [pg({ valor: 2500 })];
    const corrigido = [pg({ valor: 2650 })];
    const r = conciliarPagamentos(atuais, corrigido);
    expect(r.alterados).toHaveLength(1);
    expect(r.alterados[0].novo.valor).toBe(2650);
    expect(r.novos).toHaveLength(0);
  });

  it("linha realmente nova entra como nova", () => {
    const r = conciliarPagamentos([pg()], [pg(), pg({ tipo: "Adiantamento", valor: 900 })]);
    expect(r.iguais).toHaveLength(1);
    expect(r.novos).toHaveLength(1);
    expect(r.novos[0].tipo).toBe("Adiantamento");
  });

  it("linha que sumiu da planilha aparece como ausente", () => {
    const r = conciliarPagamentos([pg(), pg({ tipo: "Adiantamento" })], [pg()]);
    expect(r.iguais).toHaveLength(1);
    expect(r.ausentes).toHaveLength(1);
    expect(r.ausentes[0].tipo).toBe("Adiantamento");
  });

  it("dois pagamentos IGUAIS no mesmo mês (ex.: 2 adiantamentos) são preservados", () => {
    const dois = [pg({ tipo: "Adiantamento", valor: 500 }), pg({ tipo: "Adiantamento", valor: 500 })];
    const r = conciliarPagamentos(dois, dois.map((p) => pg({ ...p, id: "outro" })));
    expect(r.iguais).toHaveLength(2); // multiconjunto: não colapsa em 1
    expect(r.novos).toHaveLength(0);
  });

  it("só a descrição mudou: continua sendo a mesma linha", () => {
    const r = conciliarPagamentos(
      [pg({ descricao: "Salario" })],
      [pg({ descricao: "Salário mensal" })],
    );
    expect(r.iguais).toHaveLength(1);
    expect(r.novos).toHaveLength(0);
  });

  it("primeira importação: tudo é novo", () => {
    const r = conciliarPagamentos([], [pg(), pg({ colaboradorId: "ana" })]);
    expect(r.novos).toHaveLength(2);
    expect(r.ausentes).toHaveLength(0);
  });
});

describe("classificarPagamento", () => {
  it("reconhece os tipos que aparecem na planilha do Mubisys", () => {
    expect(classificarPagamento("", "Adiantamento salarial")).toBe("Adiantamento");
    expect(classificarPagamento("", "Vale transporte")).toBe("Vale Transporte");
    expect(classificarPagamento("", "Salário mensal")).toBe("Salário");
  });

  it("o que não reconhece cai em Outros (nunca some da conta)", () => {
    expect(classificarPagamento("", "xyz coisa estranha")).toBe("Outros");
  });
});
