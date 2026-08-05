import { describe, it, expect } from "vitest";
import { ordemEstavel, aplicarOrdem } from "@/lib/ordemEstavel";

const item = (id: string, abertas: number, nome = id) => ({ id, abertas, nome });

describe("ordemEstavel — o cartão não pula debaixo do clique", () => {
  it("na primeira vez, ordena por mais pendências primeiro", () => {
    const ordem = ordemEstavel([item("a", 3), item("b", 12), item("c", 7)]);
    expect(ordem).toEqual(["b", "c", "a"]);
  });

  it("empate desempata por nome, sempre igual", () => {
    const ordem = ordemEstavel([item("z", 5, "Zeca"), item("a", 5, "Ana")]);
    expect(ordem).toEqual(["a", "z"]);
  });

  it("O CASO REAL: marcar um item do empatado NÃO troca os cartões de lugar", () => {
    // 05/08/2026: Candida e Victor empatados em 12. Marcar um documento na
    // Candida a levava para 11 e os dois trocavam de posição — quem clicou
    // passava a olhar o cartão de outra pessoa.
    const antes = ordemEstavel([
      item("candida", 12, "Candida"),
      item("victor", 12, "Victor"),
      item("daniel", 0, "Daniel"),
    ]);
    expect(antes).toEqual(["candida", "victor", "daniel"]);

    const depoisDoClique = ordemEstavel(
      [item("candida", 11, "Candida"), item("victor", 12, "Victor"), item("daniel", 0, "Daniel")],
      antes,
    );
    expect(depoisDoClique).toEqual(antes);
  });

  it("marcar TUDO de alguém também não move ninguém", () => {
    const antes = ordemEstavel([item("a", 5), item("b", 4)]);
    const depois = ordemEstavel([item("a", 0), item("b", 4)], antes);
    expect(depois).toEqual(["a", "b"]);
  });

  it("quem chega novo entra pelo critério, sem embaralhar quem já estava", () => {
    const antes = ["a", "b"];
    const ordem = ordemEstavel([item("a", 1), item("b", 2), item("novo", 99)], antes);
    expect(ordem).toEqual(["a", "b", "novo"]);
  });

  it("quem sai some da ordem", () => {
    const ordem = ordemEstavel([item("a", 1)], ["a", "sumiu"]);
    expect(ordem).toEqual(["a"]);
  });

  it("dois novos entram ordenados entre si", () => {
    const ordem = ordemEstavel([item("a", 1), item("n1", 3, "N1"), item("n2", 9, "N2")], ["a"]);
    expect(ordem).toEqual(["a", "n2", "n1"]);
  });
});

describe("aplicarOrdem — nada some da tela por causa da ordenação", () => {
  it("aplica a ordem pedida", () => {
    const itens = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(aplicarOrdem(itens, ["c", "a", "b"]).map((i) => i.id)).toEqual(["c", "a", "b"]);
  });

  it("item que NÃO está na ordem ainda assim aparece (rede de segurança)", () => {
    // Se a ordem ficar velha por um render, o pior resultado aceitável é o
    // cartão aparecer no fim — nunca desaparecer.
    const itens = [{ id: "a" }, { id: "surpresa" }];
    expect(aplicarOrdem(itens, ["a"]).map((i) => i.id)).toEqual(["a", "surpresa"]);
  });

  it("ordem com id que não existe mais não quebra", () => {
    expect(aplicarOrdem([{ id: "a" }], ["fantasma", "a"]).map((i) => i.id)).toEqual(["a"]);
  });
});
