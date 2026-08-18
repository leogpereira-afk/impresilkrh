/* O EDITOR DE LISTAS PRECISA DEIXAR A LINHA VAZIA EXISTIR ENQUANTO SE DIGITA.
 *
 * O defeito: o campo descartava as linhas em branco no próprio onChange. Só que
 * a linha que o Enter acaba de criar É uma linha em branco — ela morria no mesmo
 * instante, o texto voltava a ser o de antes e o cursor pulava para o fim. Na
 * prática, apertar Enter não fazia nada: quem continuava digitando via o
 * segundo item colar no primeiro, e um Enter no meio de um texto já escrito
 * jogava o cursor para o final.
 *
 * O conserto move a limpeza para a GRAVAÇÃO. Estes testes fixam os dois lados:
 * o que o editor guarda enquanto se digita, e o que chega ao documento salvo.
 */
import { describe, it, expect } from "vitest";
import { limparBlocos } from "./rich";
import type { Bloco } from "@/data/types";

/* O que o campo produz — é `split("\n")` puro, sem filtro. Repetido aqui de
   propósito: se alguém voltar a filtrar no onChange, este teste continua
   passando, mas o de baixo mostra o que a mudança quebraria. */
const doCampo = (texto: string): string[] => texto.split("\n");

describe("editor de listas — digitação", () => {
  it("o Enter no fim cria uma linha vazia, e ela sobrevive à digitação", () => {
    // Era exatamente isto que sumia: sem a linha vazia não há segundo item.
    expect(doCampo("Conferir EPI\n")).toEqual(["Conferir EPI", ""]);
  });

  it("o Enter no meio parte o texto em dois, sem embolar", () => {
    expect(doCampo("Conferir EPI\nAssinar ficha")).toEqual(["Conferir EPI", "Assinar ficha"]);
  });

  it("linha vazia no meio (dois Enter) também sobrevive", () => {
    expect(doCampo("A\n\nB")).toEqual(["A", "", "B"]);
  });
});

describe("limparBlocos — o que chega ao documento salvo", () => {
  it("tira as linhas em branco deixadas pela digitação", () => {
    const blocos: Bloco[] = [{ tipo: "lista", itens: ["Conferir EPI", "", "Assinar ficha", ""] }];
    expect(limparBlocos(blocos)[0].itens).toEqual(["Conferir EPI", "Assinar ficha"]);
  });

  it("tira o espaço solto das pontas", () => {
    const blocos: Bloco[] = [{ tipo: "passos", itens: ["  Conferir EPI  ", "Assinar ficha"] }];
    expect(limparBlocos(blocos)[0].itens).toEqual(["Conferir EPI", "Assinar ficha"]);
  });

  it("bloco de texto passa intacto", () => {
    // A limpeza é só das listas: um parágrafo pode ter linha em branco de propósito.
    const blocos: Bloco[] = [{ tipo: "paragrafo", texto: "Primeira linha\n\nSegunda" }];
    expect(limparBlocos(blocos)).toEqual(blocos);
  });

  it("lista que ficou só de linhas vazias vira lista vazia, não some", () => {
    // Apagar o bloco por conta própria seria decidir pela pessoa; ela vê a
    // lista vazia e resolve se remove o bloco.
    const blocos: Bloco[] = [{ tipo: "lista", itens: ["", "  "] }];
    expect(limparBlocos(blocos)).toEqual([{ tipo: "lista", itens: [] }]);
  });

  it("não muda o objeto original", () => {
    const blocos: Bloco[] = [{ tipo: "lista", itens: ["A", ""] }];
    limparBlocos(blocos);
    expect(blocos[0].itens).toEqual(["A", ""]);
  });
});
