// Fluxos completos com store real e pessoas fictícias; nenhuma chamada à produção.
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Colaborador } from "@/data/types";
import type { Sessao } from "@/lib/session";
const estado = vi.hoisted(() => ({ sessao: { perfil: "ADMIN_RH", colaboradorId: "rh-ficticio" } as Sessao }));
vi.mock("@/lib/session", () => ({ useSessao: () => estado.sessao, obterSessao: () => estado.sessao }));
import { definirColecao, obter, registrarMutacao } from "@/lib/store";
import { novaAcaoEndo } from "@/lib/endomarketing";
import Endomarketing from "./Endomarketing";
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let el: HTMLDivElement;
const clicar = async (texto: string) => { const b = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === texto); expect(b, texto).toBeTruthy(); await act(async () => b!.click()); };
const preencher = async (seletor: string, valor: string) => {
  const campo = document.querySelector(seletor) as HTMLInputElement;
  expect(campo).toBeTruthy();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(campo, valor); campo.dispatchEvent(new Event("input", { bubbles: true })); });
};
const montar = async () => act(async () => root.render(<MemoryRouter><Endomarketing /></MemoryRouter>));
beforeEach(() => {
  estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "rh-ficticio" };
  localStorage.clear(); sessionStorage.clear();
  definirColecao("colaboradores", [{ id: "rh-ficticio", nome: "Responsável Fictício", idPessoa: "000001", statusId: "ativo", dataAdmissao: "2020-01-01" }] as Colaborador[]);
  definirColecao("eventos", []); definirColecao("endomarketing", []);
  registrarMutacao(() => {});
  el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el);
});
afterEach(() => { act(() => root.unmount()); el.remove(); vi.restoreAllMocks(); });
it("cria, conclui, reabre e conserva os dados ao remontar a tela", async () => {
  const fila = vi.fn(); registrarMutacao(fila);
  await montar(); await clicar("Nova ação");
  await preencher('input[maxlength="160"]', "Ação fictícia de escuta");
  await clicar("Salvar ação");
  const a = obter("endomarketing")[0];
  expect(a.titulo).toBe("Ação fictícia de escuta");
  expect(fila).toHaveBeenCalledWith("endomarketing", "upsert", a.id, 0);
  expect(Object.keys(localStorage).some(k => k.includes("endomarketing"))).toBe(true);
  await clicar("Ações e bem-estar"); await clicar("Marcar realizada");
  expect(obter("endomarketing")[0].concluidaEm).toBeTruthy();
  await clicar("Realizada"); await clicar("Reabrir"); await clicar("Abertas");
  expect(obter("endomarketing")[0].historico).toHaveLength(3);
  await act(async () => root.render(<MemoryRouter><div /></MemoryRouter>)); await montar();
  expect(document.body.textContent).toContain("Ação fictícia de escuta");
});
it("não oferece edição nem ações privadas para o gestor mesmo se houver cópia em memória", async () => {
  estado.sessao = { perfil: "GESTOR", colaboradorId: "gestor-ficticio" };
  definirColecao("endomarketing", [{ ...novaAcaoEndo(), id: "ficticia", titulo: "NOTA_PRIVADA_FICTICIA" }]);
  await montar();
  expect(document.body.textContent).not.toContain("Nova ação");
  await clicar("Ações e bem-estar");
  expect(document.body.textContent).not.toContain("NOTA_PRIVADA_FICTICIA");
  expect(document.body.textContent).toContain("internos ao perfil de RH");
});
it("recusa sobrescrever edição que mudou enquanto o formulário estava aberto", async () => {
  const a = { ...novaAcaoEndo(), id: "concorrencia", titulo: "Ação fictícia" };
  definirColecao("endomarketing", [a]); await montar(); await clicar("Ações e bem-estar");
  const abrir = document.querySelector('[aria-label="Abrir ação: Ação fictícia"]') as HTMLButtonElement;
  await act(async () => abrir.click());
  await act(async () => definirColecao("endomarketing", [{ ...a, titulo: "Edição mais recente" }]));
  await clicar("Salvar ação");
  expect(document.querySelector('[role="alert"]')?.textContent).toContain("foi atualizada");
  expect(obter("endomarketing")[0].titulo).toBe("Edição mais recente");
});
