import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuscaTelas } from "./busca-telas";
import type { TelaBuscavel } from "@/lib/buscaTelas";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Somente destinos fictícios: não há sessão nem chamada ao servidor.
const TELAS: TelaBuscavel[] = [
  { href: "/tela-a", label: "Tela A de demonstração", grupo: "Demonstração" },
  { href: "/tela-b", label: "Tela B com título longo para navegação", grupo: "Demonstração" },
  { href: "/tela-c", label: "Tela C de demonstração", grupo: "Demonstração" },
];

function RotaAtual() {
  return <output data-rota>{useLocation().pathname}</output>;
}

describe("Busca de telas acessível", () => {
  let container: HTMLDivElement;
  let root: Root;
  const fechar = vi.fn();
  const scrollOriginal = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");

  const montar = (telas = TELAS, aberto = true) => {
    act(() => root.render(
      <MemoryRouter initialEntries={["/inicio"]}>
        <BuscaTelas telas={telas} aberto={aberto} onFechar={fechar} />
        <RotaAtual />
      </MemoryRouter>,
    ));
  };
  const input = () => document.querySelector<HTMLInputElement>('input[aria-label="Buscar tela"]')!;
  const opcoes = () => [...document.querySelectorAll<HTMLElement>('[role="option"]')];
  const selecionada = () => document.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
  const tecla = (key: string) => act(() => {
    input().dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });
  const digitar = (valor: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), valor);
    input().dispatchEvent(new Event("input", { bubbles: true }));
  });

  beforeEach(() => {
    fechar.mockClear();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    montar();
  });

  afterEach(() => {
    act(() => root?.unmount());
    container?.remove();
    if (scrollOriginal) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", scrollOriginal);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    vi.restoreAllMocks();
  });

  it("associa o campo à lista e anuncia a opção selecionada mantendo o foco no campo", () => {
    const campo = input();
    expect(campo.getAttribute("role")).toBe("combobox");
    expect(campo.getAttribute("aria-expanded")).toBe("true");
    const lista = document.getElementById(campo.getAttribute("aria-controls")!);
    expect(lista?.getAttribute("role")).toBe("listbox");
    expect(campo.getAttribute("aria-activedescendant")).toBe(selecionada()?.id);
    expect(selecionada()?.textContent).toContain(TELAS[0].label);
    expect(document.activeElement).toBe(campo);
    expect(lista?.querySelector("button,a,input")).toBeNull();
    expect(document.querySelector('[role="status"]')?.textContent).toContain("3 telas");
  });

  it("mantém seleção e foco coerentes por setas e abre o resultado pelo Enter", () => {
    tecla("ArrowUp");
    expect(selecionada()?.textContent).toContain(TELAS[0].label);
    tecla("ArrowDown");
    expect(selecionada()?.textContent).toContain(TELAS[1].label);
    expect(input().getAttribute("aria-activedescendant")).toBe(selecionada()?.id);
    expect(document.activeElement).toBe(input());
    tecla("Enter");
    expect(fechar).toHaveBeenCalledOnce();
    expect(container.querySelector("[data-rota]")?.textContent).toBe("/tela-b");
  });

  it("não seleciona nem navega sem resultados e volta à primeira opção ao limpar", () => {
    digitar("zzzinexistente");
    tecla("ArrowDown");
    tecla("ArrowUp");
    tecla("Enter");
    expect(opcoes()).toHaveLength(0);
    expect(input().hasAttribute("aria-activedescendant")).toBe(false);
    expect(document.querySelector('[role="status"]')?.textContent).toContain("Nenhuma tela");
    expect(fechar).not.toHaveBeenCalled();
    digitar("");
    tecla("ArrowUp");
    expect(selecionada()?.textContent).toContain(TELAS[0].label);
    expect(input().getAttribute("aria-activedescendant")).toBe(selecionada()?.id);
  });

  it("permite apontar e clicar no resultado sem mover o foco para um controle aninhado", () => {
    const destino = opcoes()[1];
    expect(destino).toBeTruthy();
    act(() => destino.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })));
    expect(selecionada()).toBe(destino);
    const pressionar = new MouseEvent("mousedown", { bubbles: true, cancelable: true });
    act(() => destino.dispatchEvent(pressionar));
    expect(pressionar.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
    act(() => destino.click());
    expect(container.querySelector("[data-rota]")?.textContent).toBe("/tela-b");
    expect(fechar).toHaveBeenCalledOnce();
  });

  it("limita os resultados às props e ajusta a seleção quando o acesso recebido muda", () => {
    tecla("ArrowDown");
    tecla("ArrowDown");
    montar([TELAS[0]]);
    expect(opcoes()).toHaveLength(1);
    expect(input().getAttribute("aria-activedescendant")).toBe(selecionada()?.id);
    expect(selecionada()?.textContent).toContain(TELAS[0].label);
    expect(document.querySelector('[role="listbox"]')?.textContent).not.toContain(TELAS[2].label);
    tecla("Enter");
    expect(container.querySelector("[data-rota]")?.textContent).toBe("/tela-a");
  });

  it("reabre com busca limpa e permite fechar por Escape", () => {
    digitar("Tela B");
    montar(TELAS, false);
    montar();
    expect(input().value).toBe("");
    expect(opcoes()).toHaveLength(3);
    expect(selecionada()?.textContent).toContain(TELAS[0].label);
    tecla("Escape");
    expect(fechar).toHaveBeenCalledOnce();
  });
});
