import { describe, expect, it } from "vitest";
import { chaveDoAlarme, classificarAlterados, diffAplicavel, mudouSobAPrevia, patchDeDesfazer, planoDeDesfazer, resumoDaPrevia, retratoAntesDeAplicar, type EntradaResumo, patchDeAplicacao } from "./previaFolha";
import { chefeDasMudancas, mudancas, type DiffPagamentos } from "./custos";
import type { Colaborador, Pagamento, RetratoFolha } from "@/data/types";

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
  it("base intacta depois de aplicar: restaura o alterado, apaga o novo e devolve o removido", () => {
    const r = retratoAntesDeAplicar(diff, new Set(["pg_up_1"]), "x");
    const atuais = [{ ...novo, atualizadoEm: "2026-09-07T12:00:01Z" } as Pagamento, { ...criado, _rhRev: 3 } as unknown as Pagamento];
    const p = planoDeDesfazer(r, atuais);
    expect(p.restaurar.map((x) => x.valor)).toEqual([400]);
    expect(p.apagar).toEqual(["mubi-2"]);
    // O removido VOLTA: o retrato tem o conteúdo e o id, e gravar de novo
    // ocupa a lápide do servidor (migração 202609070001).
    expect(p.recriar.map((x: Pagamento) => x.id)).toEqual(["pg_up_1"]);
    expect(p.recriar[0].valor).toBe(1000);
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

// ---------------------------------------------------------------------------
// Os buracos que a revisão adversarial de 07/09/2026 achou — cada um com o
// caso concreto que passava antes.
// ---------------------------------------------------------------------------
describe("freios que não podem afrouxar", () => {
  it("mês fechado que troca dinheiro de pessoa (saldo zero) continua pedindo conferência", () => {
    // Junho está fechado. R$ 1.000 saem da Ana e entram na Bia: delta = 0.
    const a = pg({ id: "mubi-90", colaboradorId: "ana", competencia: "2026-06" });
    const b = pg({ id: "mubi-90", colaboradorId: "bia", competencia: "2026-06" });
    const r = resumoDaPrevia(entrada({ alterados: [{ antigo: a, novo: b }] }, [a]));
    const mes = r.porMes.find((m) => m.competencia === "2026-06")!;
    expect(mes.delta).toBe(0);
    expect(mes.bruto).toBe(2000);
    expect(r.alarmes.some((x) => x.id === "mes-fechado")).toBe(true);
    expect(r.precisaConfirmar.some((x) => x.id === "mes-fechado")).toBe(true);
  });

  it("a linha do mês de DESTINO conta a mexida quando o lançamento troca de mês", () => {
    const a = pg({ id: "mubi-91", competencia: "2026-06", dataPagamento: "2026-07-15" });
    const b = pg({ id: "mubi-91", competencia: "2026-07", dataPagamento: "2026-07-16" });
    const r = resumoDaPrevia(entrada({ alterados: [{ antigo: a, novo: b }] }, [a]));
    expect(r.porMes.find((m) => m.competencia === "2026-07")!.mexe).toBe(1);
  });

  it("a chave do alarme muda quando a marcação muda — o 'Conferi' de 1 não vale para 2", () => {
    const a1 = pg({ id: "mubi-92" });
    const a2 = pg({ id: "mubi-93" });
    const so1 = resumoDaPrevia(entrada({ ausentes: [a1, a2] }, [a1, a2], { ausentesMarcados: new Set(["mubi-92"]) }));
    const os2 = resumoDaPrevia(entrada({ ausentes: [a1, a2] }, [a1, a2], { ausentesMarcados: new Set(["mubi-92", "mubi-93"]) }));
    const rem = (r: typeof so1) => r.precisaConfirmar.find((x) => x.id === "remocao")!;
    expect(rem(so1).quantos).toBe(1);
    expect(rem(os2).quantos).toBe(2);
    expect(chaveDoAlarme(rem(so1))).not.toBe(chaveDoAlarme(rem(os2)));
  });

  it("título cuja CONTA saiu da lista de folha vai para o balde próprio e remover fica bloqueado", () => {
    const a = pg({ id: "mubi-94", idMubi: "94" });
    const r = resumoDaPrevia(entrada({ ausentes: [a] }, [a], {
      ausentesMarcados: new Set(["mubi-94"]),
      foraDaFolha: new Set(["94"]),
    }));
    expect(r.ausentes.foraDaFolha.map((x) => x.id)).toEqual(["mubi-94"]);
    expect(r.ausentes.comIdErp).toHaveLength(0);
    expect(r.podeAplicar).toBe(false);
    expect(r.alarmes.find((x) => x.id === "ausente-sem-dono")?.nivel).toBe("bloqueia");
  });

  it("mudouSobAPrevia acusa o registro que outro aparelho editou entre a busca e o clique", () => {
    const antigo = pg({ id: "mubi-95", valor: 1000 });
    const novo = pg({ id: "mubi-95", valor: 1100 });
    const vivo = pg({ id: "mubi-95", valor: 1200 }); // veio pelo sync no meio
    const diff: DiffPagamentos = { iguais: [], alterados: [{ antigo, novo }], novos: [], ausentes: [] };
    expect(mudouSobAPrevia(diff, new Set(), [vivo])).toEqual([{ id: "mubi-95", motivo: "editado" }]);
    expect(mudouSobAPrevia(diff, new Set(), [antigo])).toEqual([]);
    expect(mudouSobAPrevia(diff, new Set(), [])).toEqual([{ id: "mubi-95", motivo: "sumiu" }]);
  });

  it("o retrato guarda o registro VIVO, não o que a busca viu", () => {
    const antigo = pg({ id: "mubi-96", valor: 1000 });
    const novo = pg({ id: "mubi-96", valor: 1100 });
    const vivo = pg({ id: "mubi-96", valor: 1200 });
    const diff: DiffPagamentos = { iguais: [], alterados: [{ antigo, novo }], novos: [], ausentes: [] };
    const r = retratoAntesDeAplicar(diff, new Set(), "2026-09-07T10:00:00.000Z", "teste", [vivo]);
    expect(r.tocados[0].antes!.valor).toBe(1200);
    expect(r.tocados[0].depois!.valor).toBe(1100);
  });

  it("desfazer limpa statusErp e pagoEm que a aplicação escreveu", () => {
    const antes = pg({ id: "mubi-97", valor: 1000 });
    expect(patchDeDesfazer(antes)).toMatchObject({ valor: 1000, statusErp: null, pagoEm: null });
  });

  it("desfazer devolve o registro que a aplicação escreveu, e pula o que foi editado depois", () => {
    const antes = pg({ id: "mubi-98", valor: 1000 });
    const depois = pg({ id: "mubi-98", valor: 1100 });
    expect(planoDeDesfazer({ id: "r", em: "x", competencias: [], tocados: [{ id: "mubi-98", antes, depois }] }, [depois]).restaurar).toHaveLength(1);
    const editadoDepois = pg({ id: "mubi-98", valor: 1234 });
    const p = planoDeDesfazer({ id: "r", em: "x", competencias: [], tocados: [{ id: "mubi-98", antes, depois }] }, [editadoDepois]);
    expect(p.restaurar).toHaveLength(0);
    expect(p.pulados[0].motivo).toBe("editado depois");
  });
});

/* ESCOLHER O QUE APLICAR — pedido do Léo em 07/09/2026, olhando o botão
   "Aplicar 7 alteração(ões)": "aqui eu tenho que escolher os que eu quero fazer
   e os que não quero; aqui fica obrigado a fazer".

   O filtro entra na ORIGEM do resumo. Se entrasse só no fim, a tela mostraria
   "vai mudar R$ 82 mil" e aplicaria outra coisa — pior que não deixar escolher. */
describe("desmarcar alterações na prévia", () => {
  const antigo = pg({ id: "mubi-1", valor: 1000 });
  const novoValor = pg({ id: "mubi-1", valor: 1500 });
  const outroAntigo = pg({ id: "mubi-2", colaboradorId: "bia", valor: 800 });
  const outroNovo = pg({ id: "mubi-2", colaboradorId: "bia", valor: 900 });
  const inedito = pg({ id: "mubi-3", colaboradorId: "bia", valor: 300 });
  const diff = {
    alterados: [{ antigo, novo: novoValor }, { antigo: outroAntigo, novo: outroNovo }],
    novos: [inedito],
  };
  const gravados = [antigo, outroAntigo];

  it("sem desmarcar nada, conta as três", () => {
    expect(resumoDaPrevia(entrada(diff, gravados)).contaNoBotao).toBe(3);
  });

  it("desmarcar uma alteração tira ela da conta do botão", () => {
    const r = resumoDaPrevia(entrada(diff, gravados, { excluidos: new Set(["mubi-1"]) }));
    expect(r.contaNoBotao).toBe(2);
    // A linha CONTINUA na lista, marcada como fora — some-la tiraria da pessoa
    // a chance de voltar atrás, e ela nem veria o que acabou de tirar.
    const todos = r.grupos.flatMap((g) => g.itens);
    expect(todos.map((i) => i.antigo.id).sort()).toEqual(["mubi-1", "mubi-2"]);
    expect(todos.find((i) => i.antigo.id === "mubi-1")!.fora).toBe(true);
    expect(todos.find((i) => i.antigo.id === "mubi-2")!.fora).toBe(false);
  });

  it("desmarcar um NOVO também tira", () => {
    const r = resumoDaPrevia(entrada(diff, gravados, { excluidos: new Set(["mubi-3"]) }));
    expect(r.contaNoBotao).toBe(2);
    expect(r.novos.map((n) => n.id)).toEqual(["mubi-3"]); // continua listado
    expect(r.excluidos.has("mubi-3")).toBe(true);
  });

  it("o TOTAL mostrado deixa de contar o que foi desmarcado", () => {
    // É o ponto todo: prometer um número e aplicar outro seria pior.
    const tudo = resumoDaPrevia(entrada(diff, gravados));
    const semUm = resumoDaPrevia(entrada(diff, gravados, { excluidos: new Set(["mubi-1"]) }));
    expect(tudo.totalDepois - semUm.totalDepois).toBe(500); // 1500 − 1000
    expect(semUm.delta).toBe(tudo.delta - 500);
  });

  it("desmarcar tudo deixa o botão sem nada a fazer", () => {
    const r = resumoDaPrevia(entrada(diff, gravados, { excluidos: new Set(["mubi-1", "mubi-2", "mubi-3"]) }));
    expect(r.contaNoBotao).toBe(0);
    // Tudo visível, tudo fora: o botão fica sem nada a fazer, mas a lista
    // continua na tela para a pessoa remarcar o que quiser.
    expect(r.grupos.flatMap((g) => g.itens).every((i) => i.fora)).toBe(true);
    expect(r.excluidos.size).toBe(3);
  });

  it("o ALARME do que foi desmarcado some junto — não se confirma o que não vai acontecer", () => {
    // Trocar de pessoa dispara "confirma". Desmarcada, a confirmação não faz
    // mais sentido: pedir para conferir algo que não vai ser aplicado treina a
    // pessoa a clicar em confirmar sem ler.
    const trocaPessoa = { antigo, novo: pg({ id: "mubi-1", colaboradorId: "bia", valor: 1000 }) };
    const comAlarme = resumoDaPrevia(entrada({ alterados: [trocaPessoa] }, gravados));
    expect(comAlarme.alarmes.some((a) => a.id === "muda-pessoa")).toBe(true);
    const semAlarme = resumoDaPrevia(entrada({ alterados: [trocaPessoa] }, gravados, { excluidos: new Set(["mubi-1"]) }));
    expect(semAlarme.alarmes.some((a) => a.id === "muda-pessoa")).toBe(false);
  });

  it("id que não existe na prévia não muda nada", () => {
    const r = resumoDaPrevia(entrada(diff, gravados, { excluidos: new Set(["nao-existe"]) }));
    expect(r.contaNoBotao).toBe(3);
  });

  it("conjunto vazio é igual a não passar nada", () => {
    const a = resumoDaPrevia(entrada(diff, gravados, { excluidos: new Set() }));
    const b = resumoDaPrevia(entrada(diff, gravados));
    expect(a.contaNoBotao).toBe(b.contaNoBotao);
    expect(a.totalDepois).toBe(b.totalDepois);
  });

  it("desmarcar NÃO mexe nos ausentes — quem some é escolhido no bloco próprio", () => {
    const some = pg({ id: "mubi-9", valor: 700 });
    const r = resumoDaPrevia(
      entrada({ ...diff, ausentes: [some] }, [...gravados, some], { excluidos: new Set(["mubi-1"]), ausentesMarcados: new Set(["mubi-9"]) }),
    );
    expect(r.ausentes.comIdErp.map((a) => a.id)).toEqual(["mubi-9"]);
  });
});

describe("tipo travado na tela", () => {
  const doErp = (over: Partial<Pagamento> = {}): Pagamento =>
    ({ id: "p1", colaboradorId: "ana", competencia: "2026-01", tipo: "Salário", valor: 530,
       dataPagamento: "2026-02-11", descricao: "DOCUMENTO SAVEIRO 2026 · 2.1.1-Salário", idMubi: "57913", ...over }) as Pagamento;

  it("a importação não propõe mudar o tipo que a tela travou", () => {
    const antes = doErp({ tipo: "Outros", tipoTravado: true });
    const novo = doErp({ tipo: "Salário" }); // o ERP continua dizendo Salário
    expect(mudancas(antes, novo).some((m) => m.campo === "tipo")).toBe(false);
  });

  it("sem a trava, a mudança de tipo continua aparecendo", () => {
    expect(mudancas(doErp({ tipo: "Outros" }), doErp({ tipo: "Salário" })).some((m) => m.campo === "tipo")).toBe(true);
  });

  it("aplicar mantém o tipo travado e a marca, e atualiza o resto", () => {
    const antes = doErp({ tipo: "Outros", tipoTravado: true, valor: 530 });
    const novo = doErp({ tipo: "Salário", valor: 545 });
    const patch = patchDeAplicacao(novo, antes);
    expect(patch.tipo).toBe("Outros");
    expect(patch.tipoTravado).toBe(true);
    expect(patch.valor).toBe(545);
  });

  it("sem trava, aplicar grava o tipo do ERP e não inventa a marca", () => {
    const patch = patchDeAplicacao(doErp({ tipo: "Salário" }), doErp({ tipo: "Outros" }));
    expect(patch.tipo).toBe("Salário");
    expect(patch.tipoTravado).toBeUndefined();
  });
});

describe("o que o botão promete é o que a gravação faz", () => {
  /* O filtro por desmarcados existia SÓ em `resumoDaPrevia` — a conta da TELA.
     A gravação partia do diff CRU: o botão dizia "Aplicar 57" e o clique
     gravava as 156, inclusive as recusadas. Nenhum teste pegou porque a
     cobertura de `excluidos` parava na regra e no desenho, nunca na escrita. */
  const p1 = { id: "a1", colaboradorId: "ana", competencia: "2026-07", tipo: "Salário", valor: 100 } as never;
  const p2 = { id: "a2", colaboradorId: "ana", competencia: "2026-07", tipo: "Salário", valor: 200 } as never;
  const n1 = { id: "n1", colaboradorId: "ana", competencia: "2026-07", tipo: "Diária", valor: 50 } as never;
  const n2 = { id: "n2", colaboradorId: "ana", competencia: "2026-07", tipo: "Diária", valor: 60 } as never;
  const cru = { iguais: [], alterados: [{ antigo: p1, novo: p1 }, { antigo: p2, novo: p2 }], novos: [n1, n2], ausentes: [] };

  it("sem nada desmarcado devolve o diff inteiro, na mesma referência", () => {
    expect(diffAplicavel(cru, new Set())).toBe(cru);
    expect(diffAplicavel(cru, undefined)).toBe(cru);
  });

  it("o desmarcado NÃO entra: nem alteração, nem novo", () => {
    const r = diffAplicavel(cru, new Set(["a1", "n2"]));
    expect(r.alterados.map((x) => x.antigo.id)).toEqual(["a2"]);
    expect(r.novos.map((n) => n.id)).toEqual(["n1"]);
  });

  it("com tudo desmarcado não sobra nada para gravar", () => {
    const r = diffAplicavel(cru, new Set(["a1", "a2", "n1", "n2"]));
    expect(r.alterados).toEqual([]);
    expect(r.novos).toEqual([]);
  });

  it("iguais e ausentes passam intactos — têm régua própria", () => {
    const c = { ...cru, iguais: [{ antigo: p1, novo: p1 }], ausentes: [p2] };
    const r = diffAplicavel(c, new Set(["a1", "a2", "n1", "n2"]));
    expect(r.iguais).toHaveLength(1);
    expect(r.ausentes).toHaveLength(1);
  });
});

describe("o removido volta", () => {
  const removido = (id: string, valor: number): Pagamento =>
    ({ id, colaboradorId: "ana", competencia: "2026-06", tipo: "Adiantamento", valor, dataPagamento: "2026-06-22", descricao: "adiantamento colaborador" }) as Pagamento;

  it("devolve o que a importação removeu, com o mesmo id e o mesmo valor", () => {
    // O caso real de 08/09/2026: o adiantamento de junho do Pedro Henrique
    // (R$ 770,40, vindo de planilha) foi removido e o Desfazer não o trazia.
    const r = { id: "r1", em: "2026-09-08T10:00:00Z", rotulo: "x", competencias: ["2026-06"], usado: false,
      tocados: [{ id: "pg_up_1", antes: removido("pg_up_1", 770.4), depois: null }] } as unknown as RetratoFolha;
    const p = planoDeDesfazer(r, []);
    expect(p.recriar).toHaveLength(1);
    expect(p.recriar[0]).toMatchObject({ id: "pg_up_1", valor: 770.4, tipo: "Adiantamento" });
    expect(p.restaurar).toHaveLength(0);
  });

  it("se ele já voltou por outro caminho, não duplica", () => {
    const r = { id: "r2", em: "2026-09-08T10:00:00Z", rotulo: "x", competencias: ["2026-06"], usado: false,
      tocados: [{ id: "pg_up_1", antes: removido("pg_up_1", 770.4), depois: null }] } as unknown as RetratoFolha;
    const p = planoDeDesfazer(r, [removido("pg_up_1", 770.4)]);
    expect(p.recriar).toHaveLength(0);
    expect(p.pulados).toEqual([{ id: "pg_up_1", motivo: "já desfeito" }]);
  });
});
