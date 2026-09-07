/* Os cards do quadro na tela de Colaboradores.
 *
 * Começa pelo caso ruim, que é o defeito REAL de 08/09/2026: o Osmane, marcado
 * como Freelancer, aparecia em "Indisponíveis · férias, atestado, afastamento…"
 * enquanto estava trabalhando. Um status novo não pode cair no balde do "hoje
 * não está" só por não constar de uma lista de presenças escrita à mão.
 */
import { describe, it, expect } from "vitest";
import { quadroPorSituacao, presenteHoje, STATUS_AUSENTE_HOJE } from "./quadroPorSituacao";
import type { Colaborador, StatusColaborador } from "@/data/types";

const p = (o: Partial<Colaborador> & { id: string }) => o as Colaborador;
const s = (id: string, nome: string, ordem: number, cor = "#000"): StatusColaborador =>
  ({ id, nome, cor, ordem, contaComoAtivo: true });

/* O cadastro REAL, lido do banco em 08/09/2026: 21 ativos, 7 em experiência,
   1 freelancer (Osmane), 1 atestado (Nailton), 3 direção, 19 desligados. */
const STATUS = [
  s("ativo", "Ativo", 1), s("experiencia", "Em experiência", 2), s("aviso", "Aviso prévio", 3),
  s("afastado", "Afastado", 4), s("inativo", "Inativo", 5), s("direcao", "Direção", 6),
  s("atestado-medico", "Atestado médico", 7), s("externo", "Externo", 7),
  s("abandono", "Abandono", 8), s("freelancer", "Freelancer", 9),
];
const varios = (n: number, statusId: string, pre: string) =>
  Array.from({ length: n }, (_, i) => p({ id: `${pre}${i}`, statusId }));

const CADASTRO = [
  ...varios(21, "ativo", "a"),
  ...varios(7, "experiencia", "e"),
  p({ id: "osmane", statusId: "freelancer" }),
  p({ id: "nailton", statusId: "atestado-medico" }),
  ...varios(3, "direcao", "d").map((x) => ({ ...x, ehDirecao: true })),
  ...varios(17, "inativo", "i").map((x) => ({ ...x, dataDesligamento: "2025-01-01" })),
  ...varios(2, "ativo", "z").map((x) => ({ ...x, dataDesligamento: "2026-06-22" })),
];

describe("o caso ruim: o status novo não pode virar Indisponível", () => {
  it("o Osmane, Freelancer, ganha card PRÓPRIO e não cai em Indisponíveis", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS);
    const free = r.presentes.find((g) => g.statusId === "freelancer");
    expect(free).toBeTruthy();
    expect(free!.quantidade).toBe(1);
    expect(r.indisponiveis).toBe(1); // só o Nailton, de atestado
  });

  it("um status que NINGUÉM previu nasce presente, com card próprio", () => {
    // É a prova de que a lista fechada é a das ausências, não a das presenças.
    // Se um dia o Léo criar "Estágio", ninguém precisa lembrar de vir aqui.
    const comNovo = [...CADASTRO, p({ id: "novo", statusId: "estagio" })];
    const r = quadroPorSituacao(comNovo, [...STATUS, s("estagio", "Estágio", 10)]);
    expect(r.presentes.map((g) => g.statusId)).toContain("estagio");
    expect(r.indisponiveis).toBe(1); // continua só o Nailton
  });

  it("cada id de STATUS_AUSENTE_HOJE realmente cai em Indisponíveis", () => {
    for (const id of STATUS_AUSENTE_HOJE) {
      const r = quadroPorSituacao([p({ id: "x", statusId: id })], STATUS);
      expect(r.presentes, `${id} deveria estar ausente`).toEqual([]);
      expect(r.indisponiveis).toBe(1);
    }
  });
});

describe("os números da tela em 08/09/2026", () => {
  it("21 ativos, 7 em experiência, 1 freelancer, 1 indisponível, 19 desligados, 30 na empresa", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS);
    expect(r.presentes.map((g) => [g.statusId, g.quantidade])).toEqual([
      ["ativo", 21], ["experiencia", 7], ["freelancer", 1],
    ]);
    expect(r.indisponiveis).toBe(1);
    expect(r.desligados).toBe(19); // 17 inativos + 2 com data de saída
    expect(r.naEmpresa).toBe(30);
  });

  it("o total é EXATAMENTE a soma dos cards — a linha embaixo não pode mentir", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS);
    const soma = r.presentes.reduce((t, g) => t + g.quantidade, 0) + r.indisponiveis;
    expect(soma).toBe(r.naEmpresa);
  });

  it("ninguém é contado duas vezes nem some: presentes + indisponíveis + desligados = todo mundo menos a direção", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS);
    const soma = r.presentes.reduce((t, g) => t + g.quantidade, 0) + r.indisponiveis + r.desligados;
    expect(soma).toBe(CADASTRO.filter((c) => !c.ehDirecao).length);
  });

  it("a Direção fica fora de tudo — decisão do Léo em 08/09/2026", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS);
    expect(r.presentes.some((g) => g.statusId === "direcao")).toBe(false);
    expect(r.naEmpresa).toBe(30); // não 33
  });
});

describe("férias e as bordas", () => {
  it("quem está de férias sai do card do status e vai para Indisponíveis", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS, new Set(["a0", "e0"]));
    expect(r.presentes.find((g) => g.statusId === "ativo")!.quantidade).toBe(20);
    expect(r.presentes.find((g) => g.statusId === "experiencia")!.quantidade).toBe(6);
    expect(r.indisponiveis).toBe(3);
    expect(r.naEmpresa).toBe(30); // férias não tira ninguém da empresa
  });

  it("freelancer de férias também conta como indisponível", () => {
    const r = quadroPorSituacao(CADASTRO, STATUS, new Set(["osmane"]));
    expect(r.presentes.some((g) => g.statusId === "freelancer")).toBe(false);
    expect(r.indisponiveis).toBe(2);
  });

  it("data de desligamento SOZINHA já desliga, mesmo com status do quadro", () => {
    // É a regra de `noQuadro`, e a causa nº 1 do achado da auditoria.
    const r = quadroPorSituacao([p({ id: "x", statusId: "ativo", dataDesligamento: "2026-01-01" })], STATUS);
    expect(r.naEmpresa).toBe(0);
    expect(r.desligados).toBe(1);
  });

  it("status apagado do cadastro mostra o id cru — a pessoa não some do total", () => {
    const r = quadroPorSituacao([p({ id: "x", statusId: "fantasma" })], STATUS);
    expect(r.presentes).toEqual([{ statusId: "fantasma", nome: "fantasma", cor: "#64748b", ordem: 9999, quantidade: 1 }]);
    expect(r.naEmpresa).toBe(1);
  });

  it("pessoa sem status nenhum aparece como 'Sem status', não some", () => {
    const r = quadroPorSituacao([p({ id: "x" })], STATUS);
    expect(r.presentes[0].nome).toBe("Sem status");
    expect(r.naEmpresa).toBe(1);
  });

  it("cadastro vazio não inventa card nenhum", () => {
    expect(quadroPorSituacao([], STATUS)).toEqual({ presentes: [], indisponiveis: 0, naEmpresa: 0, desligados: 0 });
  });

  it("os cards saem na ordem do status, não na ordem em que a gente apareceu", () => {
    const bagunca = [p({ id: "1", statusId: "freelancer" }), p({ id: "2", statusId: "ativo" }), p({ id: "3", statusId: "experiencia" })];
    expect(quadroPorSituacao(bagunca, STATUS).presentes.map((g) => g.statusId)).toEqual(["ativo", "experiencia", "freelancer"]);
  });
});

describe("presenteHoje — o filtro da lista concorda com os cards", () => {
  it("o freelancer está presente; o de atestado e o desligado, não", () => {
    expect(presenteHoje(p({ id: "o", statusId: "freelancer" }))).toBe(true);
    expect(presenteHoje(p({ id: "n", statusId: "atestado-medico" }))).toBe(false);
    expect(presenteHoje(p({ id: "z", statusId: "ativo", dataDesligamento: "2026-01-01" }))).toBe(false);
    expect(presenteHoje(p({ id: "i", statusId: "inativo" }))).toBe(false);
  });

  it("férias tira da presença", () => {
    expect(presenteHoje(p({ id: "a", statusId: "ativo" }), new Set(["a"]))).toBe(false);
  });

  it("bate pessoa a pessoa com a conta dos cards — as duas réguas não podem divergir", () => {
    const ferias = new Set(["a0", "osmane"]);
    const r = quadroPorSituacao(CADASTRO, STATUS, ferias);
    const contadosNoCard = r.presentes.reduce((t, g) => t + g.quantidade, 0);
    const contadosUmAUm = CADASTRO.filter((c) => !c.ehDirecao && presenteHoje(c, ferias)).length;
    expect(contadosUmAUm).toBe(contadosNoCard);
  });
});
