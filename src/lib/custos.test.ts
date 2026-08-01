// Reconciliação da folha. Foi um erro aqui que gerou 98 pagamentos duplicados
// (R$ 62.576,49) quando a mesma planilha subiu duas vezes. A regra de subir de
// novo sem duplicar fica travada por teste.
import { describe, it, expect } from "vitest";
import { conciliarPagamentos, classificarPagamento, conferirCompetencia, competenciasComDados } from "./custos";
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

// A tela mostrava julho/2026 com 27 adiantamentos e zero salário sem explicar
// nada, e parecia dado perdido — era só o salário que ainda não tinha vencido.
// Estes testes travam a diferença entre "ainda não chegou a data" e "faltou".
describe("conferirCompetencia", () => {
  const pessoas = [
    { id: "joao", nome: "João Silva" },
    { id: "maria", nome: "Maria Souza" },
    { id: "ana", nome: "Ana Lima" },
  ];
  const adiant = (cid: string, comp = "2026-07") => pg({ colaboradorId: cid, competencia: comp, tipo: "Adiantamento", valor: 800 });
  const salario = (cid: string, comp = "2026-07") => pg({ colaboradorId: cid, competencia: comp, tipo: "Salário", valor: 1600 });

  it("mês corrente sem salário é ESPERA, não buraco (o caso de julho/2026)", () => {
    const pags = [adiant("joao"), adiant("maria"), adiant("ana")];
    // 01/08: a competência de julho só fecha em 15/08
    const r = conferirCompetencia("2026-07", pags, pessoas, new Date(2026, 7, 1));
    expect(r.estado).toBe("aguardando");
    expect(r.detalhe).toContain("05/08");
    expect(r.semSalario).toHaveLength(3);
  });

  it("depois de a competência fechar, o mesmo mês vira INCOMPLETO", () => {
    const pags = [adiant("joao"), adiant("maria"), adiant("ana")];
    const r = conferirCompetencia("2026-07", pags, pessoas, new Date(2026, 7, 16));
    expect(r.estado).toBe("incompleta");
    expect(r.titulo).toContain("nenhum salário");
  });

  it("o dia 15 ainda é janela aberta (não fecha no meio do próprio dia)", () => {
    const r = conferirCompetencia("2026-07", [adiant("joao")], pessoas, new Date(2026, 7, 15, 23, 59));
    expect(r.estado).toBe("aguardando");
  });

  it("mês completo não avisa nada", () => {
    const pags = [adiant("joao"), salario("joao"), adiant("maria"), salario("maria")];
    const r = conferirCompetencia("2026-07", pags, pessoas, new Date(2026, 7, 20));
    expect(r.estado).toBe("completa");
    expect(r.semSalario).toHaveLength(0);
  });

  it("aponta pelo NOME quem ficou só com adiantamento", () => {
    const pags = [adiant("joao"), salario("joao"), adiant("maria"), adiant("ana")];
    const r = conferirCompetencia("2026-07", pags, pessoas, new Date(2026, 7, 20));
    expect(r.estado).toBe("incompleta");
    expect(r.semSalario.map((s) => s.nome)).toEqual(["Ana Lima", "Maria Souza"]);
  });

  it("rescisão conta como salário do mês — desligado não vira alarme falso", () => {
    const pags = [adiant("joao"), pg({ colaboradorId: "joao", competencia: "2026-07", tipo: "Rescisão", valor: 3000 })];
    const r = conferirCompetencia("2026-07", pags, pessoas, new Date(2026, 7, 20));
    expect(r.estado).toBe("completa");
  });

  it("salário sem adiantamento é normal (admissão no meio do mês) e não avisa", () => {
    const r = conferirCompetencia("2026-07", [salario("ana")], pessoas, new Date(2026, 7, 20));
    expect(r.estado).toBe("completa");
  });

  it("competência sem nenhum pagamento não inventa aviso", () => {
    const r = conferirCompetencia("2026-07", [adiant("joao", "2026-06")], pessoas, new Date(2026, 7, 20));
    expect(r.estado).toBe("completa");
  });

  it("competência inválida não quebra", () => {
    expect(conferirCompetencia("", [adiant("joao")], pessoas).estado).toBe("completa");
    expect(conferirCompetencia("2026-13", [adiant("joao")], pessoas).estado).toBe("completa");
  });
});

describe("competenciasComDados", () => {
  const conta = (competencia: string) => ({ competencia }) as never;

  it("mostra o mês que tem folha mas ainda não tem plano de contas", () => {
    const r = competenciasComDados([conta("2026-06")], [{ competencia: "2026-07" }, { competencia: "2025-08" }]);
    expect(r).toEqual(["2025-08", "2026-06", "2026-07"]);
  });

  it("não repete o mês que existe nos dois", () => {
    expect(competenciasComDados([conta("2026-06")], [{ competencia: "2026-06" }])).toEqual(["2026-06"]);
  });
});

// Pagamento em dinheiro não existe no ERP — e a prévia da varredura listava o
// lançamento manual como "fora do ERP", com o remover-em-massa ao lado. Estes
// testes garantem que dinheiro lançado à mão nunca entra na lista de remoção,
// mas continua adotável se o título um dia aparecer no Mubisys.
describe("lançamento manual × conciliação", () => {
  const doErp = (over: Partial<Pagamento> = {}): Pagamento =>
    pg({ idMubi: `t${Math.random()}`, ...over });

  it("manual NÃO vira 'ausente do ERP' (fluxo com id do ERP)", () => {
    const manual = pg({ id: "x1", manual: true, tipo: "Salário", valor: 500 });
    const r = conciliarPagamentos([manual], [doErp({ colaboradorId: "outro" })], new Set(["2026-06"]));
    expect(r.ausentes).toHaveLength(0);
  });

  it("prefixo pg_man_ conta como manual mesmo sem o campo (registros antigos)", () => {
    const antigo = pg({ id: "pg_man_adilson_adi_2026_06", valor: 782.17 });
    const r = conciliarPagamentos([antigo], [doErp({ colaboradorId: "outro" })], new Set(["2026-06"]));
    expect(r.ausentes).toHaveLength(0);
  });

  it("manual também fica fora dos ausentes no fluxo da planilha", () => {
    const manual = pg({ id: "x2", manual: true });
    const r = conciliarPagamentos([manual], [pg({ id: "n1", colaboradorId: "outra-pessoa" })]);
    expect(r.ausentes).toHaveLength(0);
  });

  it("não-manual continua aparecendo como ausente (a proteção não esconde erro real)", () => {
    const comum = pg({ id: "x3" });
    const r = conciliarPagamentos([comum], [doErp({ colaboradorId: "outro" })], new Set(["2026-06"]));
    expect(r.ausentes).toHaveLength(1);
  });

  it("manual é ADOTADO quando o título aparece no ERP igual (ganha idMubi, não duplica)", () => {
    const manual = pg({ id: "pg_man_teste", manual: true, valor: 782.17, dataPagamento: "2026-06-22" });
    const titulo = doErp({ valor: 782.17, dataPagamento: "2026-06-22", idMubi: "999" });
    const r = conciliarPagamentos([manual], [titulo], new Set(["2026-06"]));
    expect(r.novos).toHaveLength(0);
    expect(r.alterados).toHaveLength(1);
    expect(r.alterados[0].antigo.id).toBe("pg_man_teste");
    expect(r.alterados[0].novo.idMubi).toBe("999");
  });
});
