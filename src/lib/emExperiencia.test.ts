/* Quem está em contrato de experiência — a régua que Colaboradores e
 * Onboarding e offboarding agora dividem.
 *
 * Começa pelo caso ruim, que é o motivo de esta função existir: as duas telas
 * contavam por conta própria. Uma dizia 6 e a outra 5, ninguém era avisado, e a
 * partir daí o Léo não confiava em nenhuma das duas. O teste aqui fixa a regra
 * única; quem quiser mudar a conta muda num lugar só e vê o efeito nos dois.
 *
 * As datas são absolutas de propósito. "Hoje" entra como parâmetro em toda
 * chamada — teste de prazo que usa o relógio da máquina passa hoje e quebra
 * sozinho daqui a três meses, num dia em que ninguém mexeu em nada.
 */
import { describe, it, expect } from "vitest";
import { quemEstaEmExperiencia, proximoFimDeExperiencia } from "./emExperiencia";
import type { Colaborador } from "@/data/types";

const p = (o: Partial<Colaborador> & { id: string }) => o as Colaborador;

/** 23/09/2026, ao meio-dia: o mesmo ancoramento que `parseData` usa. */
const HOJE = new Date(2026, 8, 23, 12);

/* Admitido em 01/09/2026: 90 dias caem em 30/11/2026, faltam 68. */
const RECEM = p({ id: "recem", nome: "Recém", dataAdmissao: "2026-09-01", statusId: "experiencia" });
/* Admitido em 01/07/2026: vence em 29/09/2026, faltam 6 — é o mais urgente. */
const QUASE = p({ id: "quase", nome: "Quase", dataAdmissao: "2026-07-01", statusId: "experiencia" });

describe("o caso ruim: duas telas, duas contas", () => {
  it("a mesma lista dá o mesmo resultado — é só isto que a função promete", () => {
    const um = quemEstaEmExperiencia([RECEM, QUASE], HOJE).map((x) => x.c.id);
    const outro = quemEstaEmExperiencia([QUASE, RECEM], HOJE).map((x) => x.c.id);
    expect(um).toEqual(outro);
  });

  it("ordena por quem VENCE PRIMEIRO, não pela ordem do cadastro", () => {
    // O cartão mostra o primeiro da lista. Ordenado por nome ou por id, ele
    // mostraria um prazo qualquer e o urgente ficaria escondido no meio.
    expect(quemEstaEmExperiencia([RECEM, QUASE], HOJE).map((x) => x.c.id)).toEqual(["quase", "recem"]);
  });
});

describe("quem entra na conta", () => {
  it("conta quem tem o relógio correndo, com o dia do fim junto", () => {
    const [x] = quemEstaEmExperiencia([QUASE], HOJE);
    expect(x.sit.fim.toLocaleDateString("pt-BR")).toBe("29/09/2026");
    expect(x.sit.diasParaFim).toBe(6);
  });

  it("a Direção fica de fora — fundador não faz experiência", () => {
    const socio = p({ id: "socio", nome: "Sócio", dataAdmissao: "2026-09-01", ehDirecao: true });
    expect(quemEstaEmExperiencia([socio], HOJE)).toHaveLength(0);
  });

  it("quem já saiu fica de fora, mesmo com a ficha ainda marcada", () => {
    const saiu = p({ ...QUASE, id: "saiu", dataDesligamento: "2026-09-10" });
    expect(quemEstaEmExperiencia([saiu], HOJE)).toHaveLength(0);
  });

  it("experiência já decidida sai da conta — não há mais o que decidir", () => {
    const efetivado = p({ ...QUASE, id: "efetivado", experienciaDecididaEm: "2026-09-15" });
    expect(quemEstaEmExperiencia([efetivado], HOJE)).toHaveLength(0);
  });

  it("sem data de admissão não entra: não há prazo para mostrar", () => {
    // Inventar um prazo aqui seria pior que omitir. Quem avisa que esta pessoa
    // sumiu da conta da CLT é o bloco "sem admissão", na tela de Colaboradores.
    const sem = p({ id: "sem", nome: "Sem data", statusId: "experiencia" });
    expect(quemEstaEmExperiencia([sem], HOJE)).toHaveLength(0);
  });

  it("admissão marcada para o futuro ainda não começou", () => {
    const futuro = p({ id: "futuro", nome: "Futuro", dataAdmissao: "2026-10-05" });
    expect(quemEstaEmExperiencia([futuro], HOJE)).toHaveLength(0);
  });

  it("O CASO RUIM: quem passou do prazo há pouco CONTINUA aparecendo", () => {
    // É o caso que mais custa: passar dos 90 dias sem decidir transforma o
    // contrato em indeterminado sozinho. Sumir da tela justamente aí é perder
    // o aviso no único momento em que ele valia alguma coisa.
    const venceu = p({ id: "venceu", nome: "Venceu", dataAdmissao: "2026-06-20" });
    const [x] = quemEstaEmExperiencia([venceu], HOJE);
    expect(x).toBeTruthy();
    expect(x.sit.situacao).toBe("expirou");
    expect(x.sit.diasParaFim).toBeLessThan(0);
  });

  it("passado muito tempo do prazo, para de avisar — senão vira ruído eterno", () => {
    const antigo = p({ id: "antigo", nome: "Antigo", dataAdmissao: "2026-01-10" });
    expect(quemEstaEmExperiencia([antigo], HOJE)).toHaveLength(0);
  });

  it("o status marcado à mão NÃO manda na conta, mas vem junto para exibir", () => {
    // O relógio corre pelas datas. Quem foi admitido há 20 dias está em
    // experiência mesmo com a ficha dizendo "Ativo".
    const semMarca = p({ id: "sem-marca", nome: "Sem marca", dataAdmissao: "2026-09-03", statusId: "ativo" });
    const [x] = quemEstaEmExperiencia([semMarca], HOJE);
    expect(x).toBeTruthy();
    expect(x.marcado).toBe(false);
  });
});

describe("a frase do cartão", () => {
  it("sem ninguém, não inventa frase", () => {
    expect(proximoFimDeExperiencia([])).toBe("");
  });

  it("diz o dia e quantos faltam de quem vence primeiro", () => {
    const f = proximoFimDeExperiencia(quemEstaEmExperiencia([RECEM, QUASE], HOJE));
    expect(f).toContain("29/09/2026");
    expect(f).toContain("6 dia");
  });

  it("O CASO RUIM: prazo vencido não vira 'faltam -3 dias'", () => {
    // O sinal de menos passa batido numa linha de 11pt, e o caso urgente fica
    // com a cara do tranquilo.
    const venceu = p({ id: "venceu", nome: "Venceu", dataAdmissao: "2026-06-20" });
    const f = proximoFimDeExperiencia(quemEstaEmExperiencia([venceu], HOJE));
    expect(f).toContain("venceu em");
    expect(f).not.toContain("-");
  });

  it("vencendo HOJE é dito com todas as letras", () => {
    const hoje = p({ id: "hoje", nome: "Hoje", dataAdmissao: "2026-06-25" });
    const [x] = quemEstaEmExperiencia([hoje], HOJE);
    expect(x.sit.diasParaFim).toBe(0);
    expect(proximoFimDeExperiencia([x])).toContain("HOJE");
  });
});
