import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Card, CardBody, CardHeader, SecaoColapsavel } from "./card";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root | undefined;
let container: HTMLDivElement;
function montar(children: React.ReactNode) {
  container = document.createElement("div"); document.body.append(container);
  act(() => { root = createRoot(container); root.render(children); });
}
afterEach(() => { act(() => root?.unmount()); container?.remove(); localStorage.clear(); });
const nome = (el: Element) => el.getAttribute("aria-labelledby")?.split(" ").map(id => document.getElementById(id)?.textContent).join(" ");

describe("recolhimento acessível dos cartões", () => {
  it("identifica a seta e o corpo de cada cartão sem misturar títulos", () => {
    montar(<><Card><CardHeader title="Quadro fictício"/><CardBody>Detalhe alfa</CardBody></Card><Card><CardHeader title="Agenda fictícia"/><CardBody>Detalhe beta</CardBody></Card></>);
    const setas = [...container.querySelectorAll("button[aria-labelledby]")];
    expect(setas.map(nome)).toEqual(["Recolher Quadro fictício", "Recolher Agenda fictícia"]);
    const ids = setas.map(b => b.getAttribute("aria-controls"));
    expect(new Set(ids).size).toBe(2);
    expect(document.getElementById(ids[0]!)?.textContent).toBe("Detalhe alfa");
    act(() => (setas[0] as HTMLButtonElement).click());
    expect(nome(setas[0])).toBe("Expandir Quadro fictício");
    expect(setas[0].getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("Detalhe alfa");
    expect(container.textContent).toContain("Detalhe beta");
  });
  it("identifica todos os corpos quando um cartão tem mais de um", () => {
    montar(<Card><CardHeader title="Importação fictícia"/><CardBody>Resumo</CardBody><CardBody>Prévia</CardBody></Card>);
    const seta = container.querySelector("button[aria-labelledby]")!;
    const ids = seta.getAttribute("aria-controls")!.split(" ");
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.map(id => document.getElementById(id)?.textContent)).toEqual(["Resumo", "Prévia"]);
  });
  it("preserva a escolha salva ao remontar o cartão", () => {
    const card = <Card idPersistencia="ficticio"><CardHeader title="Análise fictícia"/><CardBody>Detalhe salvo</CardBody></Card>;
    montar(card);
    act(() => container.querySelector<HTMLButtonElement>("button[aria-labelledby]")!.click());
    act(() => root!.render(null)); act(() => root!.render(card));
    expect(container.textContent).not.toContain("Detalhe salvo");
    expect(container.querySelector("button[aria-labelledby]")?.getAttribute("aria-expanded")).toBe("false");
  });
  it("vincula o controle da seção ao conteúdo e mantém a ação independente", () => {
    montar(<SecaoColapsavel title="Seção fictícia" action={<button>Editar</button>}>Detalhes</SecaoColapsavel>);
    const seta = container.querySelector<HTMLButtonElement>("button[aria-labelledby]")!;
    expect(nome(seta)).toBe("Recolher Seção fictícia");
    expect(document.getElementById(seta.getAttribute("aria-controls")!)?.textContent).toBe("Detalhes");
    act(() => seta.click());
    expect(container.textContent).not.toContain("Detalhes");
    expect(container.textContent).toContain("Editar");
  });
});
