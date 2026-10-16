// Anexos e pessoas fictícios; nenhuma comunicação com produção.
import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { AnexoEndo } from "@/data/endomarketing";
const mocks = vi.hoisted(() => ({ put: vi.fn(), get: vi.fn(), enviar: vi.fn(), buscar: vi.fn() }));
vi.mock("@/lib/blobstore", () => ({ putBlob: mocks.put, getBlob: mocks.get }));
vi.mock("@/lib/sync", () => ({ enviarArquivoNuvem: mocks.enviar, buscarArquivoNuvem: mocks.buscar }));
import { AnexosEndo, validarArquivoEndo } from "./anexos";
(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root; let el: HTMLDivElement; let salvos: AnexoEndo[];
function Tela() { const [a, set] = useState<AnexoEndo[]>([]); return <AnexosEndo anexos={a} onChange={v => { salvos = v; set(v); }} />; }
beforeEach(async () => { vi.resetAllMocks(); salvos = []; mocks.put.mockResolvedValue(true); mocks.enviar.mockResolvedValue(false); el = document.createElement("div"); document.body.appendChild(el); root = createRoot(el); await act(async () => root.render(<Tela />)); });
afterEach(() => { act(() => root.unmount()); el.remove(); });
async function anexar() {
  const input = el.querySelector("input")!;
  await act(async () => {
    Object.defineProperty(input, "files", { value: [new File(["conteúdo fictício"], "arte-ficticia.pdf", { type: "application/pdf" })] });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise(r => setTimeout(r, 30));
  });
}
it("limita arquivos aos formatos e tamanho aceitos pelo RH", () => {
  expect(validarArquivoEndo({ name: "arte.pdf", size: 10 * 1024 * 1024 })).toBeNull();
  expect(validarArquivoEndo({ name: "arte.pdf", size: 10 * 1024 * 1024 + 1 })).toBeTruthy();
  expect(validarArquivoEndo({ name: "arquivo.html", size: 100 })).toBeTruthy();
  expect(validarArquivoEndo({ name: "arquivo.txt", size: 100 })).toBeTruthy();
});
it("falha local impede criar referência quebrada ou enviar arquivo", async () => {
  mocks.put.mockResolvedValue(false); await anexar();
  expect(salvos).toEqual([]); expect(mocks.enviar).not.toHaveBeenCalled();
});
it("guarda referência offline, permite reenviar e desvincular sem apagar arquivo", async () => {
  await anexar(); expect(salvos).toHaveLength(1);
  expect(salvos[0]).toMatchObject({ nome: "arte-ficticia.pdf", naNuvem: false });
  expect(JSON.stringify(salvos)).not.toContain("base64");
  expect(el.textContent).toContain("Só neste aparelho");
  mocks.get.mockResolvedValue("data:application/pdf;base64,ZmFrZQ=="); mocks.enviar.mockResolvedValue(true);
  await act(async () => [...el.querySelectorAll("button")].find(b => b.textContent === "Enviar à nuvem")!.click());
  expect(salvos[0].naNuvem).toBe(true);
  await act(async () => (el.querySelector('[aria-label="Desvincular arte-ficticia.pdf"]') as HTMLButtonElement).click());
  expect(salvos).toEqual([]);
});
