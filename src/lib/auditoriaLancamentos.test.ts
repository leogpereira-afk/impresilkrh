import { describe, expect, it } from "vitest";
import { auditarLancamentos, ROTULO_REGRA, COMO_CORRIGIR, ROTULO_ONDE } from "./auditoriaLancamentos";
import type { Colaborador, Pagamento } from "@/data/types";

const pg = (over: Partial<Pagamento> & { id: string }): Pagamento =>
  ({ colaboradorId: "ana", competencia: "2026-06", tipo: "Salário", valor: 1000, dataPagamento: "2026-07-05", descricao: "Pagamento salário · 2.1.1-Salário", idMubi: over.id.replace(/\D/g, "") || "1", ...over });
const col = (over: Partial<Colaborador> & { id: string; nome: string }): Colaborador =>
  ({ statusId: "ativo", dataAdmissao: "2020-01-01", ehDirecao: false, ...over } as Colaborador);
const ana = col({ id: "ana", nome: "Ana" });
const achado = (r: ReturnType<typeof auditarLancamentos>, regra: string) => r.achados.filter((a) => a.regra === regra);

describe("auditoria dos lançamentos", () => {
  it("acusa tipo que não bate com a conta e diz para qual tipo consertar", () => {
    const p = pg({ id: "p1", tipo: "Diária", descricao: "COMISSÃO · 2.1.11.1-Comissão interna" });
    const r = auditarLancamentos([p], [ana]);
    expect(achado(r, "classificacao")[0].conserto).toEqual({ campo: "tipo", para: "Comissão" });
  });

  it("o tipo do sócio manda sobre a conta do ERP", () => {
    const socio = col({ id: "pedro-ramos", nome: "Pedro Ramos", statusId: "direcao", ehDirecao: true });
    const p = pg({ id: "p2", colaboradorId: "pedro-ramos", tipo: "Arrendamento", descricao: "Honorário · 2.1.1-Salário" });
    expect(achado(auditarLancamentos([p], [socio]), "classificacao")).toHaveLength(0);
  });

  it("competência que não bate com o vencimento vira erro com o mês certo", () => {
    const p = pg({ id: "p3", competencia: "2026-07", dataPagamento: "2026-07-05" }); // dia 5 ⇒ junho
    expect(achado(auditarLancamentos([p], [ana]), "competencia")[0].conserto).toEqual({ campo: "competencia", para: "2026-06" });
  });

  it("o mesmo título do ERP em dois registros é erro, e o valor repetido é o excesso", () => {
    const a = pg({ id: "p4", idMubi: "555" });
    const b = pg({ id: "p5", idMubi: "555" });
    const r = achado(auditarLancamentos([a, b], [ana]), "duplicado-erp")[0];
    expect(r.pagamentoIds).toEqual(["p4", "p5"]);
    expect(r.valor).toBe(1000);
  });

  it("dois títulos iguais em DIAS diferentes não são duplicata (duas diárias)", () => {
    const a = pg({ id: "p6", idMubi: "1", tipo: "Diária", valor: 63.25, dataPagamento: "2026-07-05" });
    const b = pg({ id: "p7", idMubi: "2", tipo: "Diária", valor: 63.25, dataPagamento: "2026-07-06" });
    expect(achado(auditarLancamentos([a, b], [ana]), "possivel-duplicata")).toHaveLength(0);
  });

  it("dois títulos iguais no MESMO dia acendem a luz amarela", () => {
    const a = pg({ id: "p8", idMubi: "1", tipo: "Diária", valor: 63.25, dataPagamento: "2026-07-05" });
    const b = pg({ id: "p9", idMubi: "2", tipo: "Diária", valor: 63.25, dataPagamento: "2026-07-05" });
    expect(achado(auditarLancamentos([a, b], [ana]), "possivel-duplicata")).toHaveLength(1);
  });

  it("pago depois do desligamento acusa o CADASTRO, não cada linha", () => {
    const saiu = col({ id: "bruno", nome: "Bruno", statusId: "inativo", dataDesligamento: "2025-10-10" });
    const ps = ["2026-01", "2026-02", "2026-03"].map((m, i) => pg({ id: `d${i}`, colaboradorId: "bruno", competencia: m, dataPagamento: `${m}-20` }));
    const r = auditarLancamentos(ps, [saiu]);
    expect(achado(r, "cadastro")).toHaveLength(1);
    expect(achado(r, "cadastro")[0].detalhe).toContain("desligado em 2025-10");
  });

  it("inativo sem data de desligamento e ativo com data são achados de cadastro", () => {
    const semData = col({ id: "paulo", nome: "Paulo", statusId: "inativo", dataDesligamento: undefined });
    const contraditorio = col({ id: "dem", nome: "Demerval", statusId: "ativo", dataDesligamento: "2026-06-22" });
    const r = auditarLancamentos([pg({ id: "x1", colaboradorId: "paulo" }), pg({ id: "x2", colaboradorId: "dem" })], [semData, contraditorio]);
    expect(achado(r, "cadastro")).toHaveLength(2);
  });

  it("primeiro salário no mês da admissão NÃO é achado (regra 16→15)", () => {
    const novo = col({ id: "charles", nome: "Charles", dataAdmissao: "2025-12-01" });
    const p = pg({ id: "c1", colaboradorId: "charles", competencia: "2025-11", dataPagamento: "2025-12-05" });
    expect(achado(auditarLancamentos([p], [novo]), "cadastro")).toHaveLength(0);
  });

  it("pagamento com vencimento anterior à admissão É achado", () => {
    const novo = col({ id: "thiago", nome: "Thiago", dataAdmissao: "2026-07-29" });
    const p = pg({ id: "t1", colaboradorId: "thiago", competencia: "2026-05", dataPagamento: "2026-06-05" });
    expect(achado(auditarLancamentos([p], [novo]), "cadastro")[0].detalhe).toContain("anterior à admissão");
  });

  it("quem estava no quadro e não teve nada aparece com os meses", () => {
    const outra = col({ id: "larissa", nome: "Larissa" });
    const r = auditarLancamentos([pg({ id: "a1", competencia: "2026-06" }), pg({ id: "a2", competencia: "2026-07", dataPagamento: "2026-08-05" })], [ana, outra]);
    const f = achado(r, "sem-lancamento")[0];
    expect(f.colaboradorId).toBe("larissa");
    expect(f.competencias).toEqual(["2026-06", "2026-07"]);
  });

  it("mês com adiantamento e sem salário é aviso, não erro", () => {
    const p = pg({ id: "s1", tipo: "Adiantamento", descricao: "Adiantamento Colaborador · 2.1.2-Adiantamento" });
    const f = achado(auditarLancamentos([p], [ana]), "sem-salario")[0];
    expect(f.gravidade).toBe("aviso");
  });

  it("lançamento de quem não está no cadastro é erro", () => {
    expect(achado(auditarLancamentos([pg({ id: "o1", colaboradorId: "fantasma" })], [ana]), "orfao")).toHaveLength(1);
  });

  it("só considera títulos efetivamente pagos na auditoria financeira", () => {
    const aberto = pg({ id: "aberto", statusErp: "EM ABERTO", idMubi: "101" });
    const pago = pg({ id: "pago", statusErp: "PAGO", idMubi: "102" });
    const r = auditarLancamentos([aberto, pago], [ana]);

    expect(r.resumo.linhas).toBe(1);
    expect(achado(r, "classificacao")).toHaveLength(0);
    expect(achado(r, "possivel-duplicata")).toHaveLength(0);
  });

  it("valor zero é erro", () => {
    expect(achado(auditarLancamentos([pg({ id: "v1", valor: 0 })], [ana]), "valor")).toHaveLength(1);
  });

  it("a faixa de competências limita a varredura", () => {
    const velho = pg({ id: "g1", competencia: "2025-01", dataPagamento: "2025-02-05" });
    const novo = pg({ id: "g2", competencia: "2026-06" });
    const r = auditarLancamentos([velho, novo], [ana], { de: "2026-01" });
    expect(r.resumo.linhas).toBe(1);
    expect(r.resumo.competencias).toEqual(["2026-06"]);
  });

  it("lançamento à mão sem conta e sem ERP não vira achado — é a natureza dele", () => {
    const p = pg({ id: "m1", idMubi: undefined, descricao: "Faxina - 03/2026", tipo: "Limpeza/Faxina", dataPagamento: "2026-07-05" });
    const r = auditarLancamentos([p], [ana]);
    expect(achado(r, "classificacao")).toHaveLength(0);
    expect(achado(r, "conta-desconhecida")).toHaveLength(0);
  });

  it("o resumo conta por regra, por gravidade e quantos têm conserto automático", () => {
    const r = auditarLancamentos([pg({ id: "r1", tipo: "Diária", descricao: "x · 2.1.1-Salário" }), pg({ id: "r2", valor: -5 })], [ana]);
    expect(r.resumo.consertaveis).toBe(1);
    expect(r.resumo.porGravidade.erro).toBeGreaterThanOrEqual(2);
    expect(r.resumo.linhas).toBe(2);
  });
});

/* COMO CORRIGIR — o pedido de 07/09/2026: "mostra esses defeitos mas não mostra
   como corrigir". Apontar sem dizer o que fazer joga o trabalho todo em quem lê.
   Estes testes existem para regra nova não chegar à tela muda. */
describe("como corrigir", () => {
  it("toda regra que a auditoria sabe apontar sabe dizer como se conserta", () => {
    for (const regra of Object.keys(ROTULO_REGRA) as (keyof typeof ROTULO_REGRA)[]) {
      const c = COMO_CORRIGIR[regra];
      expect(c, `regra "${regra}" sem instrução de conserto`).toBeTruthy();
      expect(c.causa.length, `causa vazia em "${regra}"`).toBeGreaterThan(20);
      expect(c.passos.length, `sem passos em "${regra}"`).toBeGreaterThan(0);
      expect(ROTULO_ONDE[c.onde], `onde inválido em "${regra}"`).toBeTruthy();
    }
  });

  it("nenhum passo é vago: todos dizem uma ação concreta", () => {
    for (const [regra, c] of Object.entries(COMO_CORRIGIR)) {
      for (const passo of c.passos) {
        expect(passo.length, `passo curto demais em "${regra}"`).toBeGreaterThan(30);
        // "verifique se está tudo certo" é o tipo de passo que não ajuda ninguém.
        expect(passo.toLowerCase(), `passo vago em "${regra}"`).not.toMatch(/tudo certo|se necess[áa]rio|caso contr[áa]rio apenas/);
      }
    }
  });

  it("só as regras com conserto determinístico prometem o botão automático", () => {
    // Prometer "automático" onde o botão não resolve é pior que não prometer:
    // a pessoa clica, nada muda, e ela perde a confiança no painel inteiro.
    const automaticas = Object.entries(COMO_CORRIGIR).filter(([, c]) => c.onde === "automatico").map(([r]) => r).sort();
    expect(automaticas).toEqual(["classificacao", "competencia"]);
  });

  it("o achado de cadastro manda para a ficha, que é onde a data se acerta", () => {
    expect(COMO_CORRIGIR.cadastro.onde).toBe("ficha");
    expect(COMO_CORRIGIR.cadastro.passos.join(" ")).toContain("Desligar pelo último pagamento");
  });

  it("mês no quadro sem lançamento manda olhar 'Não encontrados' ANTES de mexer no cadastro", () => {
    // A ordem importa: mexer na data de admissão para calar o aviso, quando a
    // causa era vínculo não casado, estraga o cadastro e esconde o problema.
    const passos = COMO_CORRIGIR["sem-lancamento"].passos;
    expect(passos[0]).toContain("Não encontrados");
    expect(passos.findIndex((p) => p.includes("admissão"))).toBeGreaterThan(0);
  });

  it("conta não reconhecida manda conferir a conta completa no Mubisys", () => {
    expect(COMO_CORRIGIR["conta-desconhecida"].onde).toBe("erp");
    expect(COMO_CORRIGIR["conta-desconhecida"].passos.join(" ")).toContain("Mubisys");
  });
});

describe("ligado pelo nome, não pelo ID", () => {
  it("pagamento casado por nome/descrição vira aviso; por CPF/ID não", () => {
    const porNome = pg({ id: "n1", casadoPor: "nome" });
    const porDesc = pg({ id: "n2", casadoPor: "descricao", idMubi: "2" });
    const porCpf = pg({ id: "n3", casadoPor: "cpf", idMubi: "3" });
    const semMarca = pg({ id: "n4", idMubi: "4" });
    const r = achado(auditarLancamentos([porNome, porDesc, porCpf, semMarca], [ana]), "casado-pelo-nome");
    // Um achado só, com os dois dentro: o Mubisys não manda CPF em título
    // nenhum, e uma linha por lançamento afogaria a tela.
    expect(r).toHaveLength(1);
    expect(r[0].pagamentoIds.sort()).toEqual(["n1", "n2"]);
    expect(r[0].valor).toBe(2000);
    expect(r.every((a) => a.gravidade === "aviso")).toBe(true);
    expect(ROTULO_REGRA["casado-pelo-nome"]).toBeTruthy();
  });
});

/* REVISÃO ADVERSARIAL DE 07/09/2026 — a auditoria acusava quem saiu de verdade.
   TIPOS_DE_QUEM_SAIU estava declarada no arquivo e nunca era usada: `ultima`
   era o máximo de TODAS as competências. Como o FGTS/INSS individualizado cai
   SEMPRE na competência seguinte (guia vence dia 20, janela 16→15), todo
   desligado com encargo no nome dele virava erro vermelho — enquanto o quadro
   verde da mesma tela, que filtra as verbas, não o listava. Dois blocos, duas
   respostas opostas sobre a mesma ficha. */
describe("cadastro × pagamentos: o acerto de quem saiu não é contradição", () => {
  const saiu = col({ id: "s", nome: "Saiu Mesmo", statusId: "inativo", dataDesligamento: "2026-06-22" });

  it("rescisão, férias, 13º e FGTS depois da saída NÃO viram achado", () => {
    const pags = [
      pg({ id: "r1", colaboradorId: "s", competencia: "2026-06", tipo: "Salário" }),
      pg({ id: "r2", colaboradorId: "s", competencia: "2026-07", tipo: "Rescisão" }),
      pg({ id: "r3", colaboradorId: "s", competencia: "2026-07", tipo: "Férias" }),
      pg({ id: "r4", colaboradorId: "s", competencia: "2026-08", tipo: "FGTS" }),
      pg({ id: "r5", colaboradorId: "s", competencia: "2026-08", tipo: "INSS" }),
    ];
    expect(achado(auditarLancamentos(pags, [saiu]), "cadastro")).toEqual([]);
  });

  it("SALÁRIO depois da saída continua sendo achado — esse é o defeito real", () => {
    const pags = [
      pg({ id: "s1", colaboradorId: "s", competencia: "2026-08", tipo: "Salário" }),
    ];
    expect(achado(auditarLancamentos(pags, [saiu]), "cadastro")).toHaveLength(1);
  });

  it("quem SÓ tem acerto de saída não vira 'inativo sem data'", () => {
    const semData = col({ id: "n", nome: "Sem Data", statusId: "inativo" });
    const pags = [pg({ id: "n1", colaboradorId: "n", competencia: "2026-07", tipo: "Rescisão" })];
    expect(achado(auditarLancamentos(pags, [semData]), "cadastro")).toEqual([]);
  });
});

describe("mês que ainda não fechou não tem falta", () => {
  // 07/09/2026: a competência 2026-08 só fecha em 15/09, e a de setembro só
  // começa a receber no dia 20. Sem esta régua, a tela acusava 27 pessoas "no
  // quadro sem lançamento" em setembro e dizia que o salário "parou de vir".
  const HOJE = new Date(2026, 8, 7);
  const bia = col({ id: "bia", nome: "Bia", dataAdmissao: "2020-01-01" });

  it("não acusa quem está no quadro e ainda não recebeu no mês aberto", () => {
    const p = pg({ id: "p1", colaboradorId: "ana", competencia: "2026-09", tipo: "Bônus", dataPagamento: "2026-09-20" });
    const r = auditarLancamentos([p], [ana, bia], { hoje: HOJE });
    expect(achado(r, "sem-lancamento")).toHaveLength(0);
    expect(achado(r, "sem-salario")).toHaveLength(0);
  });

  it("continua acusando o mês que já fechou", () => {
    const p = pg({ id: "p2", colaboradorId: "ana", competencia: "2026-06", tipo: "Diária", dataPagamento: "2026-06-20" });
    const r = auditarLancamentos([p], [ana, bia], { hoje: HOJE });
    expect(achado(r, "sem-salario")[0].competencias).toEqual(["2026-06"]);
    expect(achado(r, "sem-lancamento")[0].colaboradorId).toBe("bia");
  });
});

describe("títulos gêmeos", () => {
  it("mesmo valor e mesmo dia com descrições diferentes NÃO é duplicata", () => {
    // Três plantões de agosto (dias 15, 22 e 29) pagos juntos em 04/09.
    const base = { colaboradorId: "ana", competencia: "2026-08", tipo: "Diária", valor: 63.25, dataPagamento: "2026-09-04" };
    const ps = [
      pg({ ...base, id: "d1", idMubi: "63647", descricao: "Plantão 15/agosto · 2.1.11.3-Diária" }),
      pg({ ...base, id: "d2", idMubi: "63655", descricao: "Plantão 22/agosto · 2.1.11.3-Diária" }),
      pg({ ...base, id: "d3", idMubi: "63670", descricao: "Plantão 29/agosto · 2.1.11.3-Diária" }),
    ];
    expect(achado(auditarLancamentos(ps, [ana], { hoje: new Date(2026, 8, 7) }), "possivel-duplicata")).toHaveLength(0);
  });

  it("mesma descrição, mesmo valor e mesmo dia continua sendo suspeita", () => {
    const base = { colaboradorId: "ana", competencia: "2026-08", tipo: "Diária", valor: 63.25, dataPagamento: "2026-09-04", descricao: "Plantão 15/agosto · 2.1.11.3-Diária" };
    const ps = [pg({ ...base, id: "d1", idMubi: "1" }), pg({ ...base, id: "d2", idMubi: "2" })];
    expect(achado(auditarLancamentos(ps, [ana], { hoje: new Date(2026, 8, 7) }), "possivel-duplicata")).toHaveLength(1);
  });
});

describe("datas trocadas no cadastro", () => {
  it("desligamento anterior à admissão é erro — some do quadro sem explicação", () => {
    const samuel = col({ id: "sam", nome: "Samuel", dataAdmissao: "2026-08-12", dataDesligamento: "2026-08-06", statusId: "inativo" });
    const p = pg({ id: "s1", colaboradorId: "sam", competencia: "2026-08", tipo: "Diária", valor: 393.57, dataPagamento: "2026-08-21" });
    const a = achado(auditarLancamentos([p], [samuel], { hoje: new Date(2026, 8, 7) }), "cadastro")[0];
    expect(a.detalhe).toContain("datas trocadas");
  });

  it("datas na ordem certa não viram achado", () => {
    const ok = col({ id: "ok", nome: "OK", dataAdmissao: "2026-01-10", dataDesligamento: "2026-08-06", statusId: "inativo" });
    const p = pg({ id: "o1", colaboradorId: "ok", competencia: "2026-07", tipo: "Salário", dataPagamento: "2026-08-05" });
    expect(achado(auditarLancamentos([p], [ok], { hoje: new Date(2026, 8, 7) }), "cadastro")).toHaveLength(0);
  });
});

describe("a régua do dia 15", () => {
  // A competência 2026-09 recebe até 15/10 (competenciaPagto("2026-10-15") = "2026-09").
  // O dia 15 INTEIRO é janela aberta; só a partir do dia 16 é falta.
  const bia = col({ id: "bia", nome: "Bia", dataAdmissao: "2020-01-01" });
  const p = pg({ id: "s1", colaboradorId: "ana", competencia: "2026-09", tipo: "Bônus", dataPagamento: "2026-09-20" });

  it("no dia 15, às 9 da manhã, ainda não acusa falta", () => {
    const r = auditarLancamentos([p], [ana, bia], { hoje: new Date(2026, 9, 15, 9, 0) });
    expect(achado(r, "sem-lancamento")).toHaveLength(0);
    expect(achado(r, "sem-salario")).toHaveLength(0);
  });

  it("no dia 16 acusa", () => {
    const r = auditarLancamentos([p], [ana, bia], { hoje: new Date(2026, 9, 16, 0, 1) });
    expect(achado(r, "sem-lancamento")).toHaveLength(1);
  });
});

describe("conta que já voltou não está parada", () => {
  it("conta com lançamento no mês aberto não vira 'parou de vir'", () => {
    const faxina = (comp: string, dia: string) => pg({ id: `f${comp}`, competencia: comp, tipo: "Limpeza/Faxina", valor: 500, dataPagamento: dia, descricao: "Faxina · 2.3.2.1-Limpeza Escritório", idMubi: `m${comp}` });
    const ps = [faxina("2026-05", "2026-06-05"), faxina("2026-06", "2026-07-05"), faxina("2026-07", "2026-08-05"), faxina("2026-09", "2026-10-05")];
    // Em 07/10 o último mês fechado é agosto; a faxina não veio em agosto, mas
    // voltou em setembro — dizer "parou" seria mandar procurar o que já chegou.
    const r = auditarLancamentos(ps, [ana], { hoje: new Date(2026, 9, 7) });
    expect(achado(r, "conta-parou")).toHaveLength(0);
  });
});
