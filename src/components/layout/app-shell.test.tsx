/* A BARRA LATERAL NÃO PODE SER REFEITA A CADA DESENHO.
 *
 * `NavConteudo` e `Rodape` eram declarados DENTRO do AppShell. Componente
 * escrito dentro de outro nasce com identidade nova a cada desenho, e o React
 * decide o que reaproveitar comparando o TIPO do elemento: tipo diferente = joga
 * fora e monta de novo. O <nav> é justamente o container que ROLA, com 24 itens
 * em 6 grupos no perfil do RH.
 *
 * O que a pessoa via: rolava a barra até "Custos de Colaboradores" lá embaixo,
 * clicava, e o menu pulava de volta ao topo — com outro item embaixo do cursor.
 * Recolher um grupo, que existe para encurtar o menu, fazia o mesmo. E quem anda
 * pelo teclado perdia o foco a cada clique, com o Tab recomeçando do topo da
 * página.
 *
 * O teste mede o que importa e é objetivo: o <nav> continua sendo o MESMO nó do
 * DOM depois de um redesenho. Marca-se o nó, força-se o redesenho e confere-se
 * se a marca sobreviveu — se o React o tivesse remontado, a marca teria ido
 * embora junto com o nó antigo.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "./app-shell";
import { ToastProvider } from "@/components/ui/toast";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SESSAO_KEY = "impresilk.rh.v1:sessao";

/** Marca gravada no nó do DOM: some junto com ele se houver remontagem. */
type NoMarcado = HTMLElement & { __marca?: string };

describe("AppShell — a barra lateral sobrevive ao redesenho", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.setItem(
      SESSAO_KEY,
      // Perfil de RH: é o que enxerga o menu inteiro, onde o problema aparecia.
      JSON.stringify({ perfil: "ADMIN_RH", colaboradorId: "1", visto: Date.now() }),
    );
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(
        <MemoryRouter initialEntries={["/painel"]}>
          <ToastProvider>
            <AppShell />
          </ToastProvider>
        </MemoryRouter>,
      );
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    window.localStorage.clear();
  });

  it("monta e mostra o menu", () => {
    // Se o AppShell tivesse quebrado no refactor, o app inteiro seria uma tela
    // branca — este caso é o alarme para isso.
    const nav = container.querySelector("nav");
    expect(nav).toBeTruthy();
    expect(nav!.querySelectorAll("a").length).toBeGreaterThan(10);
  });

  it("o <nav> continua sendo o mesmo nó depois de recolher um grupo", () => {
    const nav = container.querySelector("nav") as NoMarcado;
    nav.__marca = "antes";
    // Recolher um grupo é o gesto que mais doía: existe para encurtar o menu
    // longo, e era justamente ele que jogava a rolagem de volta ao topo.
    const grupo = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-expanded") !== null,
    );
    expect(grupo).toBeTruthy();
    act(() => grupo!.click());

    const depois = container.querySelector("nav") as NoMarcado;
    expect(depois.__marca).toBe("antes");
  });

  it("o foco não cai fora do menu ao recolher um grupo", () => {
    const grupo = Array.from(container.querySelectorAll("button")).find(
      (b) => b.getAttribute("aria-expanded") !== null,
    )!;
    act(() => grupo.focus());
    act(() => grupo.click());
    // O botão apertado continua existindo e com o foco: sem isso, o Tab
    // recomeçaria do topo da página a cada clique no menu.
    expect(document.activeElement).toBe(grupo);
  });
});
