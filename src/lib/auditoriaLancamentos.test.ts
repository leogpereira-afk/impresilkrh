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
});
