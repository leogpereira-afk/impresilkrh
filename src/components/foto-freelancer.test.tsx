import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Colaborador, Freelancer } from "@/data/types";

const estado = vi.hoisted(() => ({
  fichas: [] as Colaborador[], contratos: [] as Freelancer[],
  atualizarFicha: vi.fn(), atualizarContrato: vi.fn(), comprimir: vi.fn(), toast: vi.fn(),
}));
vi.mock("@/lib/store", () => ({ useColecao: (nome: string) => nome === "colaboradores"
  ? { items: estado.fichas, atualizar: estado.atualizarFicha }
  : { items: estado.contratos, atualizar: estado.atualizarContrato } }));
vi.mock("@/lib/imagem", () => ({ comprimirImagem: estado.comprimir }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => estado.toast }));
// A regra só usa a comparação pura do módulo; não montar seu domínio/store.
vi.mock("@/lib/dominio", () => ({ noQuadro: () => true }));
import { FotoFreelancer } from "./foto-freelancer";
import { Avatar } from "./ui/misc";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const foto = "data:image/jpeg;base64,Zm90bw==";
const contrato: Freelancer = { id: "contrato", nome: "Pessoa fictícia", cpf: "90000100129", situacao: "ativo" };
let host: HTMLDivElement, root: Root;
const fechar = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  estado.fichas = [];
  estado.contratos = [contrato];
  estado.comprimir.mockResolvedValue(foto);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
const montar = () => act(() => root.render(<FotoFreelancer contrato={contrato} fechar={fechar} />));
const botao = (texto: string) => [...document.querySelectorAll("button")].find(b => b.textContent === texto)!;
async function arquivo(file = new File(["foto"], "foto.jpg", { type: "image/jpeg" })) {
  const input = document.querySelector('input[type="file"]')!;
  Object.defineProperty(input, "files", { configurable: true, value: [file] });
  await act(async () => input.dispatchEvent(new Event("change", { bubbles: true })));
}

describe("editor da foto compartilhada", () => {
  it("prévia não grava; salvar grava só a ficha, inclusive ex-colaborador", async () => {
    estado.fichas = [{ id: "ficha", cpf: "900.001.001-29", nome: "Pessoa", dataDesligamento: "2026-01-01" } as Colaborador];
    montar(); await arquivo();
    expect(estado.atualizarFicha).not.toHaveBeenCalled();
    expect(document.querySelector("img")?.src).toBe(foto);
    act(() => botao("Salvar foto").click());
    expect(estado.atualizarFicha).toHaveBeenCalledWith("ficha", { fotoDataUrl: foto });
    expect(estado.atualizarContrato).not.toHaveBeenCalled();
  });
  it("sem ficha salva no contrato e cancelar não salva nada", async () => {
    montar(); await arquivo();
    act(() => botao("Cancelar").click());
    expect(estado.atualizarContrato).not.toHaveBeenCalled();
    act(() => botao("Salvar foto").click());
    expect(estado.atualizarContrato).toHaveBeenCalledWith("contrato", { fotoDataUrl: foto });
  });
  it("remoção atualiza a fonte e não restaura cópia antiga do contrato", () => {
    estado.fichas = [{ id: "ficha", cpf: contrato.cpf, fotoDataUrl: foto } as Colaborador];
    montar(); act(() => botao("Remover foto").click());
    expect(estado.atualizarFicha).not.toHaveBeenCalled();
    act(() => botao("Salvar foto").click());
    expect(estado.atualizarFicha).toHaveBeenCalledWith("ficha", { fotoDataUrl: null });
  });
  it("recusa imagem inválida e bloqueia cadastro ambíguo", async () => {
    montar(); await arquivo(new File(["texto"], "arquivo.txt", { type: "text/plain" }));
    expect(estado.comprimir).not.toHaveBeenCalled();
    expect(botao("Salvar foto").disabled).toBe(true);
    estado.fichas = ["um", "dois"].map(id => ({ id, cpf: contrato.cpf }) as Colaborador);
    montar(); expect(document.querySelector('input[type="file"]')).toBeNull();
    expect(botao("Salvar foto").disabled).toBe(true);
  });
  it("troca de vínculo durante a edição não grava na ficha errada", async () => {
    montar(); await arquivo();
    estado.fichas = [{ id: "nova-ficha", cpf: contrato.cpf } as Colaborador]; montar();
    expect(botao("Salvar foto").disabled).toBe(true);
  });
  it("Avatar volta a exibir a foto após trocar uma imagem quebrada", () => {
    act(() => root.render(<Avatar nome="Pessoa" foto="quebrada" />));
    act(() => host.querySelector("img")!.dispatchEvent(new Event("error")));
    expect(host.querySelector("img")).toBeNull();
    act(() => root.render(<Avatar nome="Pessoa" foto={foto} />));
    expect(host.querySelector("img")?.src).toBe(foto);
  });
});
