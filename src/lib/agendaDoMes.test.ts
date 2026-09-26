/* A agenda lateral: de hoje em diante no mês atual.
 *
 * Começa pelo caso ruim: o que passou NÃO pode sumir. Ele sai da vista, mas
 * volta pelo botão -- esconder sem saída é o mesmo que apagar.
 */
import { describe, it, expect } from "vitest";
import { separarAgenda } from "./agendaDoMes";

const hoje = new Date(2026, 8, 26, 12); // 26/09/2026
const itens = [1, 2, 25, 26, 29].map((dia) => ({ dia, titulo: `evento ${dia}` }));

describe("o caso ruim: o que passou sai da vista, mas não some", () => {
  it("a soma das duas listas é tudo", () => {
    const s = separarAgenda(itens, 2026, 8, null, hoje);
    expect([...s.passados, ...s.aVista].map((i) => i.dia)).toEqual([1, 2, 25, 26, 29]);
  });
});

describe("mês atual", () => {
  it("começa HOJE: o evento de hoje fica à vista", () => {
    const s = separarAgenda(itens, 2026, 8, null, hoje);
    expect(s.aVista.map((i) => i.dia)).toEqual([26, 29]);
    expect(s.passados.map((i) => i.dia)).toEqual([1, 2, 25]);
  });
});

describe("fora do mês atual não há corte", () => {
  it("mês passado navegado: tudo à vista", () => {
    expect(separarAgenda(itens, 2026, 7, null, hoje).aVista).toHaveLength(5);
  });
  it("mês que vem: tudo à vista", () => {
    expect(separarAgenda(itens, 2026, 9, null, hoje).aVista).toHaveLength(5);
  });
  it("mesmo mês de OUTRO ano também não corta", () => {
    expect(separarAgenda(itens, 2025, 8, null, hoje).passados).toHaveLength(0);
  });
});

describe("dia clicado", () => {
  it("mostra aquele dia, mesmo que já tenha passado", () => {
    const s = separarAgenda(itens, 2026, 8, 2, hoje);
    expect(s.aVista.map((i) => i.dia)).toEqual([2]);
    expect(s.passados).toHaveLength(0);
  });
});
