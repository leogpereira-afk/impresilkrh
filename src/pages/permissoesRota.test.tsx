/* A02: navegação e URL do App real, com dados fictícios e backend desativado. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it } from "vitest";
import App from "@/App";
import { entrar, sair } from "@/lib/session";
import { aplicarSemSync, definirColecao } from "@/lib/store";
import type { Usuario } from "@/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let el: HTMLDivElement | undefined;
let root: Root | undefined;
afterEach(() => { if (root) act(() => root!.unmount()); el?.remove(); sair(); localStorage.clear(); root = undefined; });
async function abrir(caminho: string, permissoes: string[]) {
  entrar("GESTOR", "gestor-ficticio");
  aplicarSemSync(() => definirColecao("usuarios", [{ id: "u-ficticio", colaboradorId: "gestor-ficticio", ativo: true, permissoes } as Usuario]));
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
  await act(async () => root!.render(<MemoryRouter initialEntries={[caminho]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><App /></MemoryRouter>));
  for (let i = 0; i < 50 && !el.querySelector("main")?.textContent?.includes("Acesso restrito"); i++) {
    await act(async () => new Promise(r => setTimeout(r, 5)));
  }
  return el;
}
it("lista vazia retira Férias do menu e bloqueia a URL direta", async () => {
  const tela = await abrir("/ferias", []);
  expect(tela.querySelector('nav a[href="/ferias"]')).toBeNull();
  expect(tela.querySelector("main")?.textContent).toContain("Acesso restrito");
  expect(tela.querySelector('nav a[href="/meu-perfil"]')).not.toBeNull();
});
it("Acesso total não concede ao gestor a página de cargos reservada ao RH", async () => {
  const tela = await abrir("/cargos", ["*"]);
  expect(tela.querySelector('nav a[href="/cargos"]')).toBeNull();
  expect(tela.querySelector("main")?.textContent).toContain("Acesso restrito");
  expect(tela.querySelector('nav a[href="/ferias"]')).not.toBeNull();
});
