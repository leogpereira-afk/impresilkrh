/* Gráfico sem dado vira uma linha curta.
 *
 * Começa pelo caso ruim ao contrário: um gráfico COM dado não pode sumir. O
 * atalho perigoso aqui é tratar "valor negativo" ou "um único valor" como
 * vazio -- um saldo negativo na folha é exatamente o que precisa aparecer.
 */
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { BarrasVerticais, BarrasColoridas, Rosca, BarrasDuplas, temAlgumValor } from "./charts";

beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => { act(() => root?.unmount()); host?.remove(); root = null; host = null; });
const desenhar = (el: React.ReactElement) => {
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host); act(() => root!.render(el));
  return host.textContent ?? "";
};

describe("o caso ruim: dado que existe não some", () => {
  it("valor negativo conta como dado", () => {
    expect(temAlgumValor([0, -1200])).toBe(true);
  });
  it("um único valor diferente de zero basta", () => {
    expect(temAlgumValor([0, 0, 3, 0])).toBe(true);
  });
});

describe("o que é vazio", () => {
  it("lista vazia, tudo zero, nulo e texto que não é número", () => {
    expect(temAlgumValor([])).toBe(false);
    expect(temAlgumValor([0, 0, 0])).toBe(false);
    expect(temAlgumValor([null, undefined, NaN, "x"])).toBe(false);
  });

  it("os quatro gráficos desenham a linha curta, e não eixos vazios", () => {
    // tudo zero não é "sem dados": zero pode ser a resposta
    expect(desenhar(<BarrasVerticais data={[{ nome: "A", valor: 0 }]} />)).toBe("Todos os valores estão zerados.");
    act(() => root?.unmount());
    expect(desenhar(<BarrasColoridas data={[]} />)).toBe("Sem dados para mostrar.");
    act(() => root?.unmount());
    expect(desenhar(<Rosca data={[{ nome: "A", valor: 0, cor: "#000" }]} vazio="Sem notas no ciclo." />)).toBe("Sem notas no ciclo.");
    act(() => root?.unmount());
    expect(
      desenhar(<BarrasDuplas data={[{ nome: "A", a: 0, b: 0 }]} serieA={{ nome: "a", cor: "#000" }} serieB={{ nome: "b", cor: "#111" }} />),
    ).toBe("Todos os valores estão zerados.");
  });
});
