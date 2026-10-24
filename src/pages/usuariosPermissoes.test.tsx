/* A02: formulário real e store local, sem backend. Todos os dados são fictícios. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it } from "vitest";
import PainelControle from "./PainelControle";
import { ToastProvider } from "@/components/ui/toast";
import { aplicarSemSync, definirColecao, obter } from "@/lib/store";
import { entrar, sair } from "@/lib/session";
import { modulosLiberados } from "@/lib/rbac";
import type { Usuario } from "@/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let el: HTMLDivElement;
let root: Root;
const usuario = { id: "usuario-ficticio", nome: "Gestor Fictício", email: "gestor@example.invalid", perfil: "GESTOR", colaboradorId: "gestor-ficticio", ativo: true, criadoEm: "2026-10-01" } as Usuario;
beforeEach(() => {
  entrar("ADMIN_RH", "rh-ficticio");
  el = document.createElement("div"); document.body.append(el); root = createRoot(el);
});
afterEach(() => { act(() => root.unmount()); el.remove(); sair(); localStorage.clear(); });
const clicar = async (texto: string) => {
  const botao = [...document.body.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent?.trim() === texto);
  expect(botao, texto).toBeTruthy();
  await act(async () => botao!.click());
};
async function editar(permissoes?: string[]) {
  aplicarSemSync(() => definirColecao("usuarios", [{ ...usuario, ...(permissoes === undefined ? {} : { permissoes }) }]));
  await act(async () => root.render(<MemoryRouter initialEntries={["/painel-controle?aba=usuarios"]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ToastProvider><PainelControle /></ToastProvider></MemoryRouter>));
  await act(async () => el.querySelector<HTMLButtonElement>('button[aria-label="Editar usuário"]')!.click());
}
it("salvar usuário legado sem mexer em módulos preserva a ausência da lista", async () => {
  await editar();
  await clicar("Salvar");
  expect(obter("usuarios")[0]).not.toHaveProperty("permissoes");
  expect(modulosLiberados({ perfil: "GESTOR", colaboradorId: usuario.colaboradorId! }, obter("usuarios"))).toBeNull();
});
it("desligar Acesso total salva lista vazia e efetivamente bloqueia módulos opcionais", async () => {
  await editar(["*"]);
  await clicar("Acesso total (*)");
  await clicar("Salvar");
  expect(obter("usuarios")[0].permissoes).toEqual([]);
  expect(modulosLiberados({ perfil: "GESTOR", colaboradorId: usuario.colaboradorId! }, obter("usuarios"))).toEqual(new Set());
});
it("marcar Acesso total grava o marcador explícito e cancelar preserva o cadastro", async () => {
  await editar([]);
  await clicar("Acesso total (*)");
  await clicar("Cancelar");
  expect(obter("usuarios")[0].permissoes).toEqual([]);
  await act(async () => el.querySelector<HTMLButtonElement>('button[aria-label="Editar usuário"]')!.click());
  await clicar("Acesso total (*)");
  await clicar("Salvar");
  expect(obter("usuarios")[0].permissoes).toEqual(["*"]);
});
