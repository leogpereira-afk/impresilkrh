/* Repor os status da semente que o cadastro não tem.
 *
 * Começa pelo caso ruim: repor o que JÁ EXISTE. Um segundo "Freelancer" com id
 * diferente espalharia as pessoas entre dois status de mesmo nome — e como o
 * headcount lê `contaComoAtivo` do status apontado, metade delas sumiria do
 * quadro sem nada na tela dizer por quê.
 */
import { describe, it, expect } from "vitest";
import { statusPadraoFaltando } from "./statusPadrao";
import { STATUS } from "@/data/status";
import type { StatusColaborador } from "@/data/types";

const s = (o: Partial<StatusColaborador> & { id: string }): StatusColaborador => ({
  nome: o.id, cor: "#000", contaComoAtivo: true, ordem: 1, ...o,
});

/* O cadastro REAL do Léo, lido do banco em 07/09/2026: tem dois status que a
   semente não tem (atestado-medico e abandono) e NÃO tem o freelancer. */
const BANCO_DO_LEO = [
  s({ id: "ativo", nome: "Ativo", ordem: 1 }),
  s({ id: "experiencia", nome: "Em experiência", ordem: 2 }),
  s({ id: "aviso", nome: "Aviso prévio", ordem: 3 }),
  s({ id: "afastado", nome: "Afastado", ordem: 4 }),
  s({ id: "inativo", nome: "Inativo", contaComoAtivo: false, ordem: 5 }),
  s({ id: "direcao", nome: "Direção", contaComoAtivo: false, ordem: 6 }),
  s({ id: "atestado-medico", nome: "Atestado médico", ordem: 7 }),
  s({ id: "externo", nome: "Externo", contaComoAtivo: false, ordem: 7 }),
  s({ id: "abandono", nome: "Abandono", ordem: 8 }),
];

describe("o caso ruim: não repor o que já está lá", () => {
  it("cadastro completo não tem nada a repor", () => {
    expect(statusPadraoFaltando(STATUS)).toEqual([]);
  });

  it("NÃO repropõe um status que o Léo já criou na mão com outro id", () => {
    // Pela tela o id sai de slug(nome) — mas se um dia sair diferente, o nome
    // ainda barra o duplicado.
    const jaTem = [...BANCO_DO_LEO, s({ id: "freela", nome: "Freelancer", ordem: 9 })];
    expect(statusPadraoFaltando(jaTem).map((x) => x.id)).toEqual([]);
  });

  it("o nome bate sem acento, sem caixa e sem espaço sobrando", () => {
    const jaTem = [...BANCO_DO_LEO, s({ id: "x", nome: "  FREELANCER  ", ordem: 9 })];
    expect(statusPadraoFaltando(jaTem)).toEqual([]);
  });
});

describe("o que falta no cadastro do Léo hoje", () => {
  it("é só o Freelancer — os dois status extras dele não são tocados", () => {
    const faltando = statusPadraoFaltando(BANCO_DO_LEO);
    expect(faltando.map((x) => x.id)).toEqual(["freelancer"]);
    expect(faltando[0].contaComoAtivo).toBe(true); // o Léo quer eles NO quadro
    expect(faltando[0].nome).toBe("Freelancer");
  });

  it("não devolve nada que apague ou mexa nos status existentes", () => {
    const antes = JSON.stringify(BANCO_DO_LEO);
    statusPadraoFaltando(BANCO_DO_LEO);
    expect(JSON.stringify(BANCO_DO_LEO)).toBe(antes);
  });
});

describe("a ordem proposta nunca cai em cima de uma ocupada", () => {
  it("mantém a ordem da semente quando o número está livre", () => {
    // No banco do Léo o 9 está livre — é o primeiro depois do abandono (8).
    expect(statusPadraoFaltando(BANCO_DO_LEO)[0].ordem).toBe(9);
  });

  it("empurra para o fim quando o número da semente já é de outro", () => {
    const ocupado = [...BANCO_DO_LEO, s({ id: "outro", nome: "Outro", ordem: 9 })];
    const [f] = statusPadraoFaltando(ocupado);
    expect(f.id).toBe("freelancer");
    expect(f.ordem).toBe(10); // maior existente (9) + 1
  });

  it("repor DOIS de uma vez não devolve os dois no mesmo número", () => {
    // Cadastro que perdeu externo e freelancer, com o 7 e o 9 ocupados.
    const magro = [
      s({ id: "ativo", nome: "Ativo", ordem: 1 }),
      s({ id: "experiencia", nome: "Em experiência", ordem: 2 }),
      s({ id: "aviso", nome: "Aviso prévio", ordem: 3 }),
      s({ id: "afastado", nome: "Afastado", ordem: 4 }),
      s({ id: "inativo", nome: "Inativo", ordem: 5 }),
      s({ id: "direcao", nome: "Direção", ordem: 6 }),
      s({ id: "atestado-medico", nome: "Atestado médico", ordem: 7 }),
      s({ id: "abandono", nome: "Abandono", ordem: 9 }),
    ];
    const f = statusPadraoFaltando(magro);
    expect(f.map((x) => x.id)).toEqual(["externo", "freelancer"]);
    expect(new Set(f.map((x) => x.ordem)).size).toBe(2);
    expect(f.map((x) => x.ordem)).toEqual([10, 11]);
  });
});
