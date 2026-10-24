import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Toggle } from "./form";
import { CampoEditavel } from "./campo-editavel";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("Controles com nome, estado e orientação acessíveis", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("anuncia e alterna o estado do interruptor", () => {
    function Exemplo() {
      const [ativo, setAtivo] = useState(false);
      return <Toggle checked={ativo} onChange={setAtivo} label="Usuário ativo" />;
    }
    act(() => root.render(<Exemplo />));
    const controle = container.querySelector<HTMLButtonElement>("button")!;
    expect(controle.getAttribute("role")).toBe("switch");
    expect(controle.getAttribute("aria-checked")).toBe("false");
    expect(controle.textContent).toContain("Usuário ativo");
    act(() => controle.click());
    expect(controle.getAttribute("aria-checked")).toBe("true");
  });

  it.each(["texto", "numero", "data", "select"] as const)("associa o editor %s ao nome e à dica do campo", (tipo) => {
    act(() => root.render(<dl><CampoEditavel label="Campo de exemplo" exibicao="Valor atual" valor="" tipo={tipo} opcoes={[{ valor: "A", rotulo: "Opção A" }]} dica="Orientação do campo" onSalvar={() => {}} /></dl>));
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    const editor = container.querySelector<HTMLInputElement | HTMLSelectElement>("input,select")!;
    const nomeId = editor.getAttribute("aria-labelledby");
    expect(nomeId).toBeTruthy();
    expect(document.getElementById(nomeId!)?.textContent).toBe("Campo de exemplo");
    expect(document.getElementById(editor.getAttribute("aria-describedby")!)?.textContent).toBe("Orientação do campo");
  });

  it("associa o erro ao editor e preserva o valor recusado", () => {
    act(() => root.render(<dl><CampoEditavel label="Nome" exibicao="Valor atual" valor="Atual" onSalvar={() => "Confira o nome informado"} /></dl>));
    act(() => container.querySelector<HTMLButtonElement>("button")!.click());
    const editor = container.querySelector<HTMLInputElement>("input")!;
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(editor, "Recusado");
      editor.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(editor.value).toBe("Recusado");
    expect(editor.getAttribute("aria-invalid")).toBe("true");
    const erro = document.getElementById(editor.getAttribute("aria-describedby")!);
    expect(erro?.textContent).toBe("Confira o nome informado");
    expect(erro?.getAttribute("role")).toBe("alert");
  });
});
