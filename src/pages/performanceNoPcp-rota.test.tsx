/* F25 (01/10/2026): PERFORMANCE SAI DO MENU, E O ENDEREÇO ANTIGO NÃO QUEBRA.
 *
 * Até a F25 o menu do RH tinha "Performance" em Estrutura e financeiro, e a
 * rota /performance abria a apuração própria do RH (só para o RH). Agora o
 * programa das equipes mora no PCP. Este teste troca de propósito o que valia
 * antes:
 *  - o menu não tem mais o item, para nenhum perfil;
 *  - a busca de telas não acha mais "performance" nem "bonificação";
 *  - quem abre /performance (endereço salvo, link antigo) cai no aviso com o
 *    caminho do PCP, e não no "Acesso restrito" nem no Painel.
 *
 * Monta o App de verdade (rotas, AppShell, sessão e store reais), sem banco:
 * o store começa vazio e nada é sincronizado. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import App from "@/App";
import { entrar, sair } from "@/lib/session";
import type { Perfil } from "@/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let el: HTMLDivElement | null = null;
let root: Root | null = null;

async function abrir(perfil: Perfil, caminho: string, esperar = "mudou para o PCP") {
  entrar(perfil, "1");
  el = document.createElement("div");
  document.body.append(el);
  await act(async () => {
    root = createRoot(el!);
    root.render(<MemoryRouter initialEntries={[caminho]}><App /></MemoryRouter>);
  });
  // A página é carregada sob demanda (lazy): espera o texto ou o fim das tentativas.
  for (let i = 0; i < 50 && !el.textContent?.includes(esperar); i++) {
    await act(async () => { await new Promise((r) => setTimeout(r, 10)); });
  }
  return el;
}

afterEach(() => {
  if (root) act(() => root!.unmount());
  el?.remove();
  root = null; el = null;
  sair();
  window.localStorage.clear();
});

describe("F25: Performance fora do menu do RH", () => {
  it.each(["ADMIN_RH", "GESTOR"] as const)("%s: /performance mostra o aviso com o link do PCP", async (perfil) => {
    const tela = await abrir(perfil, "/performance");
    expect(tela.textContent).toContain("O programa das equipes mudou para o PCP");
    expect(tela.textContent).not.toContain("Acesso restrito");
    expect(tela.querySelector('a[href="https://leogpereira-afk.github.io/impresilk/"]')).toBeTruthy();
    // Antes era a apuração do RH: estes controles não existem mais.
    expect(tela.textContent).not.toMatch(/Incluir pessoa|Critérios e valores|Mês de apuração/);
  });

  it("o menu do RH não tem mais o item Performance (antes: Estrutura e financeiro)", async () => {
    const tela = await abrir("ADMIN_RH", "/performance");
    const menus = Array.from(tela.querySelectorAll("nav"));
    expect(menus.length).toBeGreaterThan(0);
    const links = menus.flatMap((n) => Array.from(n.querySelectorAll("a")));
    expect(links.length).toBeGreaterThan(10);
    expect(links.some((a) => a.getAttribute("href") === "/performance")).toBe(false);
    expect(links.some((a) => a.textContent?.trim() === "Performance")).toBe(false);
    // O grupo continua no menu com os outros itens.
    expect(links.some((a) => a.getAttribute("href") === "/custos")).toBe(true);
  });

  it("a busca de telas (Ctrl+K) não oferece mais Performance", async () => {
    await abrir("ADMIN_RH", "/painel", "Painel");
    await act(async () => { window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true })); });
    // Sem termo, a busca lista todas as telas da sessão: é o índice do sistema.
    const itens = () => Array.from(document.body.querySelectorAll("li button")).map((b) => b.textContent ?? "");
    expect(itens().some((t) => t.startsWith("Financeiro do RH"))).toBe(true);
    expect(itens().some((t) => t.startsWith("Performance"))).toBe(false);
    // Os apelidos antigos ("bonificacao", "bonus", "instaladores") também não levam lá.
    const campo = document.body.querySelector<HTMLInputElement>('input[aria-label="Buscar tela"]')!;
    const digitar = (termo: string) => act(async () => {
      const definir = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      definir.call(campo, termo);
      campo.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // Controle: a digitação chega à busca ("folha" é apelido do Financeiro do RH).
    await digitar("folha");
    expect(itens().some((t) => t.startsWith("Financeiro do RH"))).toBe(true);
    for (const termo of ["performance", "bonificacao", "bonus", "instaladores"]) {
      await digitar(termo);
      expect(itens().some((t) => t.startsWith("Performance"))).toBe(false);
    }
  });
});
