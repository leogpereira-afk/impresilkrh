import { describe, it, expect } from "vitest";
import { exameDuplicado, quantosIguais, type ExameLike } from "@/lib/exameDuplicado";

const e = (id: string, colab: string, cat: string, venc: string): ExameLike =>
  ({ id, colaboradorId: colab, categoria: cat, dataVencimento: venc });

// O caso real de 10/08/2026, reconstruído do backup.
const DANIEL = [
  e("doc-aso-daniel", "daniel", "Exame Periódico", "2027-01-16"),
  e("doc-exame-daniel", "daniel", "Exame Periódico", "2026-08-07"),
  e("documentos_21fk", "daniel", "Exame Periódico", "2027-01-16"),
  e("documentos_7jws", "daniel", "Exame Periódico", "2027-01-16"),
];

describe("exameDuplicado", () => {
  it("O CASO QUE IMPORTA: mudar a data para uma que já existe acusa o conflito", () => {
    // Foi assim que a terceira linha nasceu: o registro 7jws vencia 16/07/2026
    // e foi movido para 16/01/2027, onde já havia dois.
    const antes = DANIEL.filter((x) => x.id !== "documentos_7jws");
    const alvo = e("documentos_7jws", "daniel", "Exame Periódico", "2027-01-16");
    expect(exameDuplicado(antes, alvo)?.id).toBeTruthy();
  });

  it("mudar a CATEGORIA para uma que já colide também acusa", () => {
    // O outro caminho: um ASO virou "Exame Periódico" numa edição.
    const antes = [e("outro", "daniel", "Exame Periódico", "2027-01-16")];
    const alvo = e("doc-aso-daniel", "daniel", "ASO", "2027-01-16");
    expect(exameDuplicado(antes, alvo)).toBeNull(); // como ASO, não colide
    expect(exameDuplicado(antes, { ...alvo, categoria: "Exame Periódico" })?.id).toBe("outro");
  });

  it("editar o próprio registro NÃO acusa conflito consigo mesmo", () => {
    // Senão salvar duas vezes seguidas passaria a reclamar.
    const alvo = e("documentos_21fk", "daniel", "Exame Periódico", "2027-01-16");
    expect(exameDuplicado([alvo], alvo)).toBeNull();
  });

  it("mesma data e mesma categoria, pessoas diferentes: não é duplicata", () => {
    const outros = [e("x", "joao", "ASO", "2027-01-16")];
    expect(exameDuplicado(outros, e("y", "maria", "ASO", "2027-01-16"))).toBeNull();
  });

  it("mesma pessoa e mesma data, tipos diferentes: não é duplicata", () => {
    // 18 pessoas estão nessa situação hoje (um ASO + um Exame Periódico).
    const outros = [e("x", "joao", "ASO", "2027-01-26")];
    expect(exameDuplicado(outros, e("y", "joao", "Exame Periódico", "2027-01-26"))).toBeNull();
  });

  it("hora na data não atrapalha a comparação", () => {
    const outros = [{ id: "x", colaboradorId: "joao", categoria: "ASO", dataVencimento: "2027-01-16T12:00:00.000Z" }];
    expect(exameDuplicado(outros, e("y", "joao", "ASO", "2027-01-16"))?.id).toBe("x");
  });

  it("sem os três campos não afirma nada", () => {
    const outros = [e("x", "joao", "ASO", "2027-01-16")];
    expect(exameDuplicado(outros, { id: "y", colaboradorId: "joao", categoria: "ASO", dataVencimento: null })).toBeNull();
    expect(exameDuplicado(outros, { id: "y", colaboradorId: null, categoria: "ASO", dataVencimento: "2027-01-16" })).toBeNull();
    expect(exameDuplicado(outros, { id: "y", colaboradorId: "joao", categoria: "", dataVencimento: "2027-01-16" })).toBeNull();
  });

  it("lista vazia não quebra", () => {
    expect(exameDuplicado([], e("y", "joao", "ASO", "2027-01-16"))).toBeNull();
  });
});

describe("quantosIguais", () => {
  it("conta o alvo junto — no caso do Daniel, três", () => {
    const antes = DANIEL.filter((x) => x.id !== "documentos_7jws");
    const alvo = e("documentos_7jws", "daniel", "Exame Periódico", "2027-01-16");
    expect(quantosIguais(antes, alvo)).toBe(3);
  });

  it("sem nenhum igual, é um", () => {
    expect(quantosIguais([], e("y", "joao", "ASO", "2027-01-16"))).toBe(1);
  });
});
