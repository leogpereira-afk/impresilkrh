/* O ID DA PESSOA NA TELA (D-004): o selo da ficha, o selo <Pessoa> das
 * conferências e o botão do admin, montados com dublês (nada de banco).
 * Dados, CPFs e IDs fictícios. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const estado = vi.hoisted(() => ({
  dominio: { colabById: new Map<string, unknown>() } as Record<string, unknown>,
  toast: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  previa: null as unknown,
  preencher: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));
vi.mock("@/lib/dominio", async (orig) => ({
  ...(await orig<typeof import("@/lib/dominio")>()),
  useDominio: () => estado.dominio,
}));
vi.mock("@/components/ui/toast", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/toast")>()),
  useToast: () => estado.toast,
}));
vi.mock("@/lib/sync", () => ({
  previaIdPessoa: async () => estado.previa,
  preencherIdPessoa: (...a: unknown[]) => estado.preencher(...a),
  trocarIdPessoa: async () => ({ idPessoa: "000000" }),
}));

import { SeloIdPessoa, PreencherIdPessoa } from "./id-pessoa";
import { Pessoa } from "@/components/ui/pessoa";

const CPF_A = "123.456.789-09";          // fictício: ID 123456
const CPF_A_CORRIGIDO = "987.654.321-00"; // fictício

let raiz: Root; let el: HTMLDivElement;
beforeEach(() => {
  el = document.createElement("div"); document.body.appendChild(el); raiz = createRoot(el);
  estado.toast = vi.fn(); estado.preencher = vi.fn(async () => ({ gravados: 1, pulados: [] }));
});
afterEach(() => { act(() => raiz.unmount()); el.remove(); document.body.innerHTML = ""; });
const desenhar = async (no: React.ReactNode) => { await act(async () => { raiz.render(no); }); };
const texto = () => document.body.textContent ?? "";

describe("selo do ID na ficha", () => {
  it("mostra o ID gravado mesmo com o CPF corrigido, com a marca do PCP", async () => {
    await desenhar(<SeloIdPessoa cadastro={{ id: "f1", cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }} colecao="colaboradores" />);
    expect(texto()).toContain("ID 123456");
    expect(texto()).toContain("ID diferente do CPF");
    expect(texto()).not.toContain("trocar ID");
  });
  it("sem o campo, mostra o do CPF dizendo que é do CPF, sem marca", async () => {
    await desenhar(<SeloIdPessoa cadastro={{ id: "f1", cpf: CPF_A }} colecao="colaboradores" />);
    expect(texto()).toContain("ID 123456(do CPF)");
    expect(texto()).not.toContain("diferente");
  });
  it("quem não vê o CPF não vê o ID nem a marca (a porta poda os dois)", async () => {
    await desenhar(<SeloIdPessoa cadastro={{ id: "f1" }} colecao="colaboradores" />);
    expect(texto()).toBe("");
  });
  it("só o admin tem o botão de trocar, e a troca pede motivo", async () => {
    await desenhar(<SeloIdPessoa cadastro={{ id: "f1", nome: "Pessoa Fictícia", cpf: CPF_A, idPessoa: "123456" }} colecao="colaboradores" podeTrocar />);
    const botao = [...document.querySelectorAll("button")].find((b) => b.textContent === "trocar ID")!;
    // Régua de dedo da casa: controle com 40 px de altura (era h-7, 28 px).
    expect(botao.className).toContain("min-h-10");
    expect(botao.className).not.toMatch(/(^|\s)h-7(\s|$)/);
    await act(async () => { botao.click(); });
    expect(texto()).toContain("Trocar o ID da pessoa");
    const confirmar = [...document.querySelectorAll("button")].find((b) => b.textContent === "Trocar o ID")!;
    expect(confirmar.disabled).toBe(true);
  });
});

describe("selo <Pessoa> das conferências", () => {
  it("usa o ID gravado na ficha e marca a divergência", async () => {
    estado.dominio = { colabById: new Map([["f1", { id: "f1", nome: "Pessoa Fictícia", cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }]]) };
    await desenhar(<Pessoa colaboradorId="f1" />);
    expect(texto()).toContain("123456");
    expect(texto()).toContain("ID diferente do CPF");
  });
});

describe("botão do admin: Gravar o ID nas fichas antigas", () => {
  it("mostra a lista antes, separa os casos que pedem decisão, e grava só os conferidos", async () => {
    estado.previa = { total: 3, comId: 0, itens: [
      { colecao: "colaboradores", id: "f1", nome: "Pessoa Fictícia Um", desligado: false, idPessoa: "123456", herdado: false, motivo: null, outro: null },
      { colecao: "freelancers", id: "c1", nome: "Prestador Fictício", desligado: false, idPessoa: "123456", herdado: true, motivo: null, outro: null },
      { colecao: "colaboradores", id: "f4", nome: "Pessoa Sem CPF Fictícia", desligado: false, idPessoa: "", herdado: false, motivo: "sem CPF que dê o ID", outro: null },
    ] };
    await desenhar(<PreencherIdPessoa />);
    const abrir = [...document.querySelectorAll("button")].find((b) => b.textContent === "Gravar o ID nas fichas antigas")!;
    await act(async () => { abrir.click(); });
    expect(texto()).toContain("Pedem decisão");
    expect(texto()).toContain("Pessoa Sem CPF Fictícia");
    expect(estado.preencher).not.toHaveBeenCalled();
    const gravar = [...document.querySelectorAll("button")].find((b) => b.textContent === "Gravar 2 IDs")!;
    await act(async () => { gravar.click(); });
    expect(estado.preencher).toHaveBeenCalledTimes(1);
    const enviados = estado.preencher.mock.calls[0][0] as { id: string }[];
    expect(enviados.map((i) => i.id)).toEqual(["f1", "c1"]);
  });
});
