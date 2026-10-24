import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Campo, Input, Select, Textarea } from "./form";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Fixtures exclusivamente fictícias para associações e comportamento do formulário. */
describe("Campo com rótulo e ajuda acessíveis", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  function textoReferenciado(el: Element, atributo: string) {
    return (el.getAttribute(atributo) ?? "").split(/\s+/).filter(Boolean)
      .map(id => document.getElementById(id)?.textContent?.trim()).join(" ");
  }

  it.each(["input", "select", "textarea"] as const)("associa nome e ajuda ao %s sem misturar os textos", tipo => {
    act(() => root.render(<Campo label="Campo de exemplo" hint="Orientação do exemplo">
      {tipo === "input" ? <Input /> : tipo === "select" ? <Select><option>Opção fictícia</option></Select> : <Textarea />}
    </Campo>));
    const controle = container.querySelector("input,select,textarea")!;
    expect(textoReferenciado(controle, "aria-labelledby")).toBe("Campo de exemplo");
    expect(textoReferenciado(controle, "aria-describedby")).toBe("Orientação do exemplo");
    expect(container.querySelector("label")?.control).toBe(controle);
  });

  it("mantém o rótulo do controle dentro de um wrapper com botão auxiliar", () => {
    const aoAcionar = vi.fn();
    act(() => root.render(<Campo label="Equipe de exemplo" hint="Nome da equipe">
      <div><Input /><button type="button" onClick={aoAcionar}>Salvar equipe</button></div>
    </Campo>));
    const controle = container.querySelector("input")!;
    expect(container.querySelector("label")?.control).toBe(controle);
    expect(textoReferenciado(controle, "aria-labelledby")).toBe("Equipe de exemplo");
    act(() => container.querySelector("button")!.click());
    expect(aoAcionar).toHaveBeenCalledTimes(1);
  });

  it("passa nome e ajuda por contexto sem injetar props em componentes externos", () => {
    let propriedades: string[] = [];
    function ControleExterno(props: { valor: string }) {
      propriedades = Object.keys(props);
      return <div><Input defaultValue={props.valor} /></div>;
    }
    act(() => root.render(<Campo label="Código fictício" hint="Orientação do código"><ControleExterno valor="Exemplo" /></Campo>));
    const controle = container.querySelector("input")!;
    expect(propriedades).toEqual(["valor"]);
    expect(textoReferenciado(controle, "aria-labelledby")).toBe("Código fictício");
    expect(textoReferenciado(controle, "aria-describedby")).toBe("Orientação do código");
    expect(controle.value).toBe("Exemplo");
  });

  it("preserva IDs e nomes fornecidos e acrescenta a ajuda às descrições existentes", () => {
    act(() => root.render(<>
      <p id="descricao-existente">Descrição prévia</p><span id="rotulo-existente">Rótulo prévio</span>
      <Campo label="Nome genérico" hint="Nova orientação">
        <Input id="controle-existente" aria-labelledby="rotulo-existente" aria-describedby="descricao-existente descricao-existente" />
      </Campo>
      <Campo label="Segundo nome genérico" hint="Segunda orientação"><Input aria-label="Nome específico" /></Campo>
    </>));
    const [primeiro, segundo] = container.querySelectorAll("input");
    expect(primeiro.id).toBe("controle-existente");
    expect(primeiro.getAttribute("aria-labelledby")).toBe("rotulo-existente");
    expect(textoReferenciado(primeiro, "aria-describedby")).toBe("Descrição prévia Nova orientação");
    expect(segundo.getAttribute("aria-label")).toBe("Nome específico");
    expect(segundo.hasAttribute("aria-labelledby")).toBe(false);
  });

  it("não compartilha IDs entre controles nem os envolve em um único label", () => {
    act(() => root.render(<Campo label="Período" hint="Datas do exemplo"><div>
      <Input type="date" aria-label="Início" /><Input type="date" aria-label="Fim" />
    </div></Campo>));
    const controles = [...container.querySelectorAll("input")];
    expect(new Set(controles.map(c => c.id)).size).toBe(2);
    expect(controles.every(c => c.id.length > 0)).toBe(true);
    expect(controles.map(c => c.getAttribute("aria-label"))).toEqual(["Início", "Fim"]);
    expect(controles.map(c => textoReferenciado(c, "aria-describedby"))).toEqual(["Datas do exemplo", "Datas do exemplo"]);
    expect(container.querySelector("label")).toBeNull();
  });

  it("associa controles nativos e conserva ref e evento do arquivo", () => {
    const ref = createRef<HTMLInputElement>();
    const aoTrocar = vi.fn();
    act(() => root.render(<Campo label="Arquivo de exemplo" hint="Formato do arquivo"><div>
      <input ref={ref} type="file" onChange={aoTrocar} />
    </div></Campo>));
    const controle = container.querySelector("input")!;
    expect(ref.current).toBe(controle);
    expect(container.querySelector("label")?.control).toBe(controle);
    expect(textoReferenciado(controle, "aria-describedby")).toBe("Formato do arquivo");
    act(() => controle.dispatchEvent(new Event("change", { bubbles: true })));
    expect(aoTrocar).toHaveBeenCalledTimes(1);
  });

  it("preserva o label próprio do checkbox e evita labels aninhados", () => {
    const aoTrocar = vi.fn();
    act(() => root.render(<Campo label="Repetição" hint="Periodicidade do exemplo">
      <label><input type="checkbox" onChange={aoTrocar} />Repete todo ano</label>
    </Campo>));
    const controle = container.querySelector("input")!;
    expect(container.querySelector("label label")).toBeNull();
    expect(controle.getAttribute("aria-labelledby")).toBeNull();
    expect(controle.labels?.[0].textContent).toBe("Repete todo ano");
    expect(textoReferenciado(controle, "aria-describedby")).toBe("Periodicidade do exemplo");
    act(() => controle.labels![0].click());
    expect(controle.checked).toBe(true);
    expect(aoTrocar).toHaveBeenCalledTimes(1);
  });

  it("não acrescenta validação HTML nem invalida campos pelo estado visual", () => {
    act(() => root.render(<form><Campo label="Nome" obrigatorio estado="falta"><Input defaultValue="" /></Campo>
      <Campo label="Opcional" obrigatorio><Input aria-required={false} aria-invalid="grammar" /></Campo>
    </form>));
    const [primeiro, segundo] = container.querySelectorAll("input");
    expect(primeiro.required).toBe(false);
    expect(primeiro.getAttribute("aria-required")).toBe("true");
    expect(document.getElementById(primeiro.getAttribute("aria-labelledby")!)?.textContent).toBe("Nome");
    expect(primeiro.hasAttribute("aria-invalid")).toBe(false);
    expect(container.querySelector("form")!.checkValidity()).toBe(true);
    expect(segundo.getAttribute("aria-required")).toBe("false");
    expect(segundo.getAttribute("aria-invalid")).toBe("grammar");
  });

  it.each([true, false])("não exige filtros ou opções de grupo obrigatório (wrapper: %s)", wrapper => {
    act(() => root.render(<Campo label="Pessoas" obrigatorio hint="Escolha pelo menos uma">
      {wrapper ? <div><Input aria-label="Filtrar por nome" /></div> : <Input aria-label="Filtrar por nome" />}
      <div><label><input type="checkbox" />Pessoa fictícia A</label><label><input type="checkbox" />Pessoa fictícia B</label></div>
    </Campo>));
    expect([...container.querySelectorAll("input")].every(c => !c.hasAttribute("aria-required") && !c.required)).toBe(true);
    expect(container.querySelector(".label")?.textContent).toContain("*");
  });

  it("atualiza as referências quando a dica sai e mantém IDs após renderizar novamente", () => {
    act(() => root.render(<Campo label="Exemplo" hint="Ajuda temporária"><Input /></Campo>));
    const id = container.querySelector("input")!.id;
    act(() => root.render(<Campo label="Exemplo"><Input /></Campo>));
    expect(container.querySelector("input")!.id).toBe(id);
    expect(container.querySelector("input")!.hasAttribute("aria-describedby")).toBe(false);
  });

  it("campos internos não herdam a orientação do campo externo", () => {
    act(() => root.render(<Campo label="Grupo externo" hint="Ajuda externa"><Campo label="Campo interno" hint="Ajuda interna"><Input /></Campo></Campo>));
    const controle = container.querySelector("input")!;
    expect(textoReferenciado(controle, "aria-labelledby")).toBe("Campo interno");
    expect(textoReferenciado(controle, "aria-describedby")).toBe("Ajuda interna");
  });

  it("preserva controles independentes que não utilizam Campo", () => {
    act(() => root.render(<><Input aria-label="Busca" /><Select aria-label="Filtro"><option>Todos</option></Select><Textarea id="notas" aria-label="Notas" /></>));
    const controles = [...container.querySelectorAll("input,select,textarea")];
    expect(controles.map(c => c.id)).toEqual(["", "", "notas"]);
    expect(controles.every(c => !c.hasAttribute("aria-required") && !c.hasAttribute("aria-describedby") && !c.hasAttribute("aria-labelledby"))).toBe(true);
  });
});
