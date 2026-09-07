import { describe, expect, it } from "vitest";
import { classificarAlterados, planoDeDesfazer, resumoDaPrevia, retratoAntesDeAplicar, type EntradaResumo } from "./previaFolha";
import { chefeDasMudancas, mudancas, type DiffPagamentos } from "./custos";
import type { Colaborador, Pagamento } from "@/data/types";

const HOJE = new Date(2026, 8, 7); // 07/09/2026: até jul/2026 está fechado, ago fecha em 15/09
const pg = (over: Partial<Pagamento> & { id: string }): Pagamento =>
  ({ colaboradorId: "ana", competencia: "2026-06", tipo: "Salário", valor: 1000, dataPagamento: "2026-07-05", descricao: "Pagamento salário · 2.1.1-Salário", idMubi: over.id.replace("mubi-", ""), ...over });
const pessoas: Record<string, Colaborador> = {
  ana: { id: "ana", nome: "Ana", statusId: "ativo", dataAdmissao: "2020-01-01" } as Colaborador,
  bia: { id: "bia", nome: "Bia", statusId: "ativo", dataAdmissao: "2020-01-01" } as Colaborador,
  saiu: { id: "saiu", nome: "Saiu", statusId: "inativo", dataAdmissao: "2019-01-01", dataDesligamento: "2026-03-31" } as Colaborador,
  socio: { id: "socio", nome: "Sócio", statusId: "direcao", ehDirecao: true } as Colaborador,
};
const entrada = (diff: Partial<DiffPagamentos>, gravados: Pagamento[], extra: Partial<EntradaResumo> = {}): EntradaResumo => ({
  diff: { iguais: [], alterados: [], novos: [], ausentes: [], ...diff },
  gravados,
  janela: new Set(["2026-06", "2026-07"]),
  ausentesMarcados: new Set(),
  colaboradorPor: (id) => pessoas[id],
  tiposEncargo: ["FGTS", "INSS"],
  hoje: HOJE,
  ...extra,
});

describe("mudancas — o que mudou, campo a campo", () => {
  it("só o código da conta mudou (renumeração do contador): natureza renumeração, silenciosa", () => {
    const a = pg({ id: "mubi-1", tipo: "Diária", descricao: "Plantão · 2.1.11.1-Diária" });
    const b = pg({ id: "mubi-1", tipo: "Diária", descricao: "Plantão · 2.1.11.3-Diária" });
    expect(mudancas(a, b)).toEqual([{ campo: "conta", de: "2.1.11.1-Diária", para: "2.1.11.3-Diária" }]);
    expect(classificarAlterados({ iguais: [], alterados: [{ antigo: a, novo: b }], novos: [], ausentes: [] })[0].natureza).toBe("renumeracao");
  });
  it("o caso de julho: conta renumerada E tipo trocado — o chefe é o tipo, nunca só o valor", () => {
    const a = pg({ id: "mubi-2", tipo: "Diária", descricao: "x · 2.1.11.1-Diária", valor: 70 });
    const b = pg({ id: "mubi-2", tipo: "Comissão", descricao: "x · 2.1.11.1-Comissão interna", valor: 70 });
    const m = mudancas(a, b);
    expect(m.map((x) => x.campo)).toEqual(["tipo", "conta"]);
    expect(chefeDasMudancas(m)).toBe("tipo");
  });
  it("troca de pessoa e de mês aparecem com de → para", () => {
    const a = pg({ id: "mubi-3", colaboradorId: "ana", competencia: "2026-06", dataPagamento: "2026-07-15" });
    const b = pg({ id: "mubi-3", colaboradorId: "bia", competencia: "2026-07", dataPagamento: "2026-07-16" });
    expect(mudancas(a, b)).toEqual([
      { campo: "pessoa", de: "ana", para: "bia" },
      { campo: "mes", de: "2026-06", para: "2026-07" },
      { campo: "data", de: "2026-07-15", para: "2026-07-16" },
    ]);
  });
  it("status só conta quando os dois lados o têm", () => {
    const a = pg({ id: "mubi-4" });
    const b = { ...pg({ id: "mubi-4" }), statusErp: "PAGO" } as Pagamento;
    expect(mudancas(a, b)).toEqual([]);
    const c = { ...a, statusErp: "ABERTO" } as Pagamento;
    expect(mudancas(c, b)).toEqual([{ campo: "status", de: "ABERTO", para: "PAGO" }]);
  });
  it("adoção de id, sem mais nada, é 'adocao'", () => {
    const a = pg({ id: "pg_up_1", idMubi: undefined });
    const b = pg({ id: "pg_up_1", idMubi: "900" });
    expect(mudancas(a, b)).toEqual([{ campo: "adocao", de: "—", para: "900" }]);
  });
});

describe("resumoDaPrevia — quanto cada mês muda, e o que pede confirmação", () => {
  it("base igual a si mesma: nada muda, nada no botão, pode aplicar", () => {
    const g = [pg({ id: "mubi-1" }), pg({ id: "mubi-2", competencia: "2026-07" })];
    const r = resumoDaPrevia(entrada({ iguais: g.map((p) => ({ antigo: p, novo: p })) }, g));
    expect(r.delta).toBe(0);
    expect(r.contaNoBotao).toBe(0);
    expect(r.podeAplicar).toBe(true);
    expect(r.alarmes).toEqual([]);
    expect(r.porMes.map((m) => [m.competencia, m.hoje, m.depois])).toEqual([["2026-06", 1000, 1000], ["2026-07", 1000, 1000]]);
  });

  it("renumeração de conta não conta no botão e não mexe em dinheiro", () => {
    const antigo = pg({ id: "mubi-1", descricao: "x · 2.1.11.1-Diária", tipo: "Diária" });
    const novo = pg({ id: "mubi-1", descricao: "x · 2.1.11.3-Diária", tipo: "Diária" });
    const r = resumoDaPrevia(entrada({ alterados: [{ antigo, novo }] }, [antigo]));
    expect(r.silenciosos).toBe(1);
    expect(r.contaNoBotao).toBe(0);
    expect(r.grupos[0].natureza).toBe("renumeracao");
    expect(r.delta).toBe(0);
  });

  it("título de junho vai para julho: junho cai, julho sobe, e junho (fechado) pede confirmação", () => {
    const antigo = pg({ id: "mubi-1", competencia: "2026-06" });
    const novo = pg({ id: "mubi-1", competencia: "2026-07", dataPagamento: "2026-07-16" });
    const outro = pg({ id: "mubi-9", competencia: "2026-06", valor: 9000 });
    const r = resumoDaPrevia(entrada({ alterados: [{ antigo, novo }], iguais: [{ antigo: outro, novo: outro }] }, [antigo, outro]));
    const jun = r.porMes.find((m) => m.competencia === "2026-06")!;
    const jul = r.porMes.find((m) => m.competencia === "2026-07")!;
    expect([jun.hoje, jun.depois, jun.fechada]).toEqual([10000, 9000, true]);
    expect([jul.hoje, jul.depois]).toEqual([0, 1000]);
    expect(r.alarmes.map((a) => a.id)).toEqual(expect.arrayContaining(["mes-fechado", "muda-mes"]));
    expect(r.alarmes.find((a) => a.id === "mes-fechado")?.nivel).toBe("confirma"); // −10% > 5%
    expect(r.contaNoBotao).toBe(1);
  });

  it("troca de pessoa: o total do mês não muda, mas pede confirmação", () => {
    const antigo = pg({ id: "mubi-1", colaboradorId: "ana" });
    const novo = pg({ id: "mubi-1", colaboradorId: "bia" });
    const r = resumoDaPrevia(entrada({ alterados: [{ antigo, novo }] }, [antigo]));
    expect(r.porMes[0].delta).toBe(0);
    expect(r.precisaConfirmar.map((a) => a.id)).toContain("muda-pessoa");
  });

  it("novo salário para quem saiu em março é suspeito; rescisão é acerto", () => {
    const salario = pg({ id: "mubi-5", colaboradorId: "saiu", competencia: "2026-07", tipo: "Salário" });
    const rescisao = pg({ id: "mubi-6", colaboradorId: "saiu", competencia: "2026-07", tipo: "Rescisão" });
    const r = resumoDaPrevia(entrada({ novos: [salario, rescisao] }, []));
    const fora = r.alarmes.filter((a) => a.id === "fora-do-quadro");
    expect(fora.find((a) => a.nivel === "confirma")?.ids).toEqual(["mubi-5"]);
    expect(fora.find((a) => a.nivel === "avisa")?.ids).toEqual(["mubi-6"]);
  });

  it("ausente cujo título existe no ERP (sem dono) marcado para remover BLOQUEIA", () => {
    const a = pg({ id: "mubi-7", idMubi: "7" });
    const r = resumoDaPrevia(entrada({ ausentes: [a] }, [a], { ausentesMarcados: new Set(["mubi-7"]), semDono: new Set(["7"]) }));
    expect(r.ausentes.semDono).toEqual([a]);
    expect(r.podeAplicar).toBe(false);
    expect(r.alarmes.find((x) => x.id === "ausente-sem-dono")?.nivel).toBe("bloqueia");
  });

  it("ausentes separados em três: com id do ERP, sem id (planilha), sem dono", () => {
    const comId = pg({ id: "mubi-8", idMubi: "8" });
    const semId = pg({ id: "pg_up_1", idMubi: undefined });
    const semDono = pg({ id: "mubi-9", idMubi: "9" });
    const r = resumoDaPrevia(entrada({ ausentes: [comId, semId, semDono] }, [comId, semId, semDono], { semDono: new Set(["9"]) }));
    expect(r.ausentes.comIdErp.map((p) => p.id)).toEqual(["mubi-8"]);
    expect(r.ausentes.semId.map((p) => p.id)).toEqual(["pg_up_1"]);
    expect(r.ausentes.semDono.map((p) => p.id)).toEqual(["mubi-9"]);
  });

  it("remover registro sem id pede confirmação própria, e a remoção sempre pede confirmação", () => {
    const semId = pg({ id: "pg_up_1", idMubi: undefined, competencia: "2026-07" });
    const r = resumoDaPrevia(entrada({ ausentes: [semId] }, [semId], { ausentesMarcados: new Set(["pg_up_1"]) }));
    // Julho está fechado em 07/09 e perderia 100%: o mês fechado também pede confirmação — é o certo.
    expect(r.precisaConfirmar.map((a) => a.id).sort()).toEqual(["mes-fechado", "remocao", "sem-id-removido"]);
    expect(r.porMes.find((m) => m.competencia === "2026-07")?.depois).toBe(0);
    expect(r.contaNoBotao).toBe(1);
  });

  it("busca parcial só avisa — mas bloqueia se houver remoção marcada", () => {
    const a = pg({ id: "mubi-1", competencia: "2026-07" });
    const busca = { truncado: false, pedidas: ["2026-06", "2026-07"], lidas: ["2026-07"], falhas: ["2026-06"] };
    expect(resumoDaPrevia(entrada({ ausentes: [a] }, [a], { busca })).alarmes.find((x) => x.id === "busca-parcial")?.nivel).toBe("avisa");
    const r = resumoDaPrevia(entrada({ ausentes: [a] }, [a], { busca, ausentesMarcados: new Set(["mubi-1"]) }));
    expect(r.podeAplicar).toBe(false);
  });

  it("encargo (FGTS) e sócio não entram na régua de dinheiro da equipe", () => {
    const fgts = pg({ id: "mubi-10", tipo: "FGTS", valor: 500 });
    const socio = pg({ id: "mubi-11", colaboradorId: "socio", tipo: "Arrendamento", valor: 6000 });
    const r = resumoDaPrevia(entrada({ novos: [fgts, socio] }, []));
    expect(r.porMes[0].depois).toBe(0);
    expect(r.contaNoBotao).toBe(2); // continuam sendo linhas gravadas
  });

  it("mês aberto que salta mais de 25% pede confirmação", () => {
    const hoje = pg({ id: "mubi-1", competencia: "2026-08", valor: 1000 });
    const novo = pg({ id: "mubi-2", competencia: "2026-08", valor: 400 });
    const r = resumoDaPrevia(entrada({ novos: [novo] }, [hoje]));
    expect(r.porMes.find((m) => m.competencia === "2026-08")?.fechada).toBe(false);
    expect(r.alarmes.find((a) => a.id === "mes-varia")?.nivel).toBe("confirma");
  });
});

describe("retrato e desfazer", () => {
  const antigo = pg({ id: "mubi-1", valor: 400 });
  const novo = pg({ id: "mubi-1", valor: 450 });
  const criado = pg({ id: "mubi-2", competencia: "2026-07" });
  const removido = pg({ id: "pg_up_1", idMubi: undefined });
  const diff: DiffPagamentos = { iguais: [], alterados: [{ antigo, novo }], novos: [criado], ausentes: [removido] };

  it("o retrato guarda só o tocado, com antes e depois", () => {
    const r = retratoAntesDeAplicar(diff, new Set(["pg_up_1"]), "2026-09-07T12:00:00.000Z");
    expect(r.competencias).toEqual(["2026-06", "2026-07"]);
    expect(r.tocados.map((t) => [t.id, !!t.antes, !!t.depois])).toEqual([["mubi-1", true, true], ["mubi-2", false, true], ["pg_up_1", true, false]]);
    expect(r.tocados[0].depois?.valor).toBe(450);
  });
  it("remoção não marcada fica fora do retrato", () => {
    expect(retratoAntesDeAplicar(diff, new Set(), "x").tocados.some((t) => t.id === "pg_up_1")).toBe(false);
  });
  it("base intacta depois de aplicar: restaura o alterado, apaga o novo, e o removido não volta por aqui", () => {
    const r = retratoAntesDeAplicar(diff, new Set(["pg_up_1"]), "x");
    const atuais = [{ ...novo, atualizadoEm: "2026-09-07T12:00:01Z" } as Pagamento, { ...criado, _rhRev: 3 } as unknown as Pagamento];
    const p = planoDeDesfazer(r, atuais);
    expect(p.restaurar.map((x) => x.valor)).toEqual([400]);
    expect(p.apagar).toEqual(["mubi-2"]);
    expect(p.semVolta.map((x) => x.id)).toEqual(["pg_up_1"]);
    expect(p.pulados).toEqual([]);
  });
  it("editado depois da importação: pula e diz por quê; já desfeito também", () => {
    const r = retratoAntesDeAplicar(diff, new Set(), "x");
    const p = planoDeDesfazer(r, [{ ...novo, valor: 999 }, antigoIgualAoAntes()]);
    expect(p.pulados).toEqual(expect.arrayContaining([{ id: "mubi-1", motivo: "editado depois" }, { id: "mubi-2", motivo: "já desfeito" }]));
    function antigoIgualAoAntes(): Pagamento { return { ...antigo, id: "mubi-3" }; }
  });
  it("desfazer duas vezes: a segunda não tem nada a fazer", () => {
    const r = retratoAntesDeAplicar(diff, new Set(), "x");
    const p = planoDeDesfazer(r, [antigo]);
    expect(p.restaurar).toEqual([]);
    expect(p.pulados.map((x) => x.motivo)).toEqual(["já desfeito", "já desfeito"]);
  });
});
