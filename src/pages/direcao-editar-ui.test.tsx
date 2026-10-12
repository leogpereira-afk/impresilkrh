/* A FICHA DA DIREÇÃO TEM CAMINHO ATÉ O EDITAR (pedido do dono de 12/10/2026:
 * "a parte de direcao nao tem como editar da direcao").
 *
 * O caso ruim, antes do conserto: a ficha de quem é da Direção (ehDirecao)
 * podia ser editada em /colaboradores/:id, mas nenhuma tela levava até ela. A
 * lista de Colaboradores tira a Direção (ela fica fora do quadro) e o Meu
 * perfil só mostrava os dados, sem Editar. O dono, da Direção e admin do RH,
 * abria o Meu perfil e não achava como mudar nível, gestor e enquadramento.
 *
 * Aqui as telas de verdade são montadas, com o domínio de verdade
 * (useDominio) alimentado por coleções fictícias. Store, sessão e toast são
 * dublês; nada toca banco nem armazenamento. Dados fictícios (o repositório é
 * público): nomes inventados, CPFs com dígitos verificadores certos montados a
 * partir de 900001001. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Colaborador } from "@/data/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const estado = vi.hoisted(() => ({
  sessao: null as { perfil: "ADMIN_RH" | "GESTOR" | "COLABORADOR"; colaboradorId: string } | null,
  colecoes: {} as Record<string, unknown[]>,
  vazio: [] as unknown[],
  fn: () => {},
}));

vi.mock("@/lib/store", async (orig) => ({
  ...(await orig<typeof import("@/lib/store")>()),
  useColecao: (nome: string) => ({
    items: estado.colecoes[nome] ?? estado.vazio,
    criar: estado.fn, atualizar: estado.fn, remover: estado.fn,
    criarOuAtualizar: estado.fn, definir: estado.fn,
  }),
}));
vi.mock("@/lib/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/session")>()),
  useSessao: () => estado.sessao,
}));
vi.mock("@/components/ui/toast", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/toast")>()),
  useToast: () => estado.fn,
}));

import MeuPerfil from "./MeuPerfil";
import Colaboradores from "./Colaboradores";
import ColaboradorFicha from "./ColaboradorFicha";

const pessoa = (extra: Partial<Colaborador>): Colaborador =>
  ({ statusId: "ativo", dataAdmissao: "2020-01-02", areaId: "producao", ...extra }) as Colaborador;
const diretor = pessoa({
  id: "dir-a", nome: "Diretor Alfa Fictício", cpf: "90000100129", ehDirecao: true,
  statusId: "direcao", areaId: "direcao", cargoLivre: "Diretor Fictício",
});
const diretora = pessoa({
  id: "dir-b", nome: "Diretora Beta Fictícia", cpf: "90000200263", ehDirecao: true,
  statusId: "direcao", areaId: "direcao", cargoLivre: "Diretora Fictícia",
});
const rh = pessoa({ id: "rh-g", nome: "Gama do RH Fictício", cpf: "90000300306", gestorId: "dir-a" });
const operador = pessoa({ id: "op-d", nome: "Delta Operador Fictício", cpf: "90000400432", gestorId: "rh-g" });
const COLABS = [diretor, diretora, rh, operador];

const COLECOES = {
  colaboradores: COLABS,
  areas: [
    { id: "direcao", nome: "Direção" },
    { id: "producao", nome: "Produção" },
  ],
  status: [
    { id: "ativo", nome: "Ativo", cor: "#16a34a", ordem: 1 },
    { id: "direcao", nome: "Direção", cor: "#0f172a", ordem: 8 },
    { id: "inativo", nome: "Inativo", cor: "#64748b", ordem: 9 },
  ],
};

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  estado.colecoes = COLECOES;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-12T12:00:00-03:00"));
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

let montagem = 0;
const montar = (url: string) =>
  act(() =>
    root.render(
      <MemoryRouter key={++montagem} initialEntries={[url]}>
        <Routes>
          <Route path="/meu-perfil" element={<MeuPerfil />} />
          <Route path="/colaboradores" element={<Colaboradores />} />
          <Route path="/colaboradores/:id" element={<ColaboradorFicha />} />
        </Routes>
      </MemoryRouter>,
    ),
  );
const linkEditarMinhaFicha = () =>
  [...el.querySelectorAll("a")].find((a) => a.textContent?.includes("Editar minha ficha"));
const secaoDirecao = () => el.querySelector('section[aria-label="Direção"]');
const dialogo = () => document.body.querySelector('[role="dialog"]');

describe("Meu perfil: o caminho para editar a própria ficha", () => {
  it("o admin do RH que é da Direção tem o Editar minha ficha, e ele abre a ficha já na edição", () => {
    estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "dir-a" };
    montar("/meu-perfil");
    const link = linkEditarMinhaFicha();
    expect(link, "sem caminho do Meu perfil para editar a ficha").toBeTruthy();
    expect(link!.getAttribute("href")).toBe("/colaboradores/dir-a");

    act(() => link!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })));
    expect(el.textContent).toContain("Ficha · Diretor Alfa Fictício");
    expect(dialogo()?.textContent).toContain("Editar colaborador");
  });

  it("quem não edita fichas (colaborador, gestor) não vê o botão", () => {
    estado.sessao = { perfil: "COLABORADOR", colaboradorId: "op-d" };
    montar("/meu-perfil");
    expect(el.textContent).toContain("Meu perfil · Delta Operador Fictício");
    expect(linkEditarMinhaFicha()).toBeUndefined();

    estado.sessao = { perfil: "GESTOR", colaboradorId: "dir-b" };
    montar("/meu-perfil");
    expect(el.textContent).toContain("Meu perfil · Diretora Beta Fictícia");
    expect(linkEditarMinhaFicha()).toBeUndefined();
  });

  it("o pedido de edição não abre o modal para quem não pode editar", () => {
    estado.sessao = { perfil: "GESTOR", colaboradorId: "dir-b" };
    act(() =>
      root.render(
        <MemoryRouter initialEntries={[{ pathname: "/colaboradores/dir-b", state: { editar: true } }]}>
          <Routes><Route path="/colaboradores/:id" element={<ColaboradorFicha />} /></Routes>
        </MemoryRouter>,
      ),
    );
    expect(el.textContent).toContain("Ficha · Diretora Beta Fictícia");
    expect(dialogo()).toBeNull();
  });
});

describe("Colaboradores: a Direção em grupo próprio, fora do quadro", () => {
  it("o RH vê o grupo Direção com as fichas clicáveis", () => {
    estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "rh-g" };
    montar("/colaboradores");
    const secao = secaoDirecao();
    expect(secao, "a lista não mostra a Direção").toBeTruthy();
    expect(secao!.textContent).toContain("2 fichas");
    const links = [...secao!.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(links).toHaveLength(2);
    expect(links[0][0]).toContain("Diretor Alfa Fictício");
    expect(links[0][1]).toBe("/colaboradores/dir-a");
    expect(links[1][1]).toBe("/colaboradores/dir-b");
  });

  it("a Direção continua fora da contagem, do total na empresa e da tabela", () => {
    estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "rh-g" };
    montar("/colaboradores");
    expect(el.textContent).toContain("2 colaborador(es) no seu escopo de acesso.");
    const total = [...el.querySelectorAll("p")].find((p) => /pessoas? na empresa hoje/.test(p.textContent ?? "") && p.querySelector("strong"));
    expect(total!.textContent).toMatch(/^2 pessoas na empresa hoje/);
    const tabela = el.querySelector("table")!;
    expect(tabela.textContent).toContain("Delta Operador Fictício");
    expect(tabela.textContent).not.toContain("Diretor Alfa Fictício");
    expect(tabela.textContent).not.toContain("Diretora Beta Fictícia");
    // Nem os cards de presença contam a Direção.
    const cardAtivo = [...el.querySelectorAll("button")].find((b) => b.querySelector(".text-xl") && b.textContent?.includes("Ativo"))!;
    expect(cardAtivo.querySelector(".text-xl")!.textContent).toBe("2");
  });

  it("a busca filtra o grupo, e um filtro do quadro (status) o tira de cena", () => {
    estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "rh-g" };
    montar("/colaboradores");
    const busca = el.querySelector('input[placeholder^="Buscar"]') as HTMLInputElement;
    const digitar = (v: string) =>
      act(() => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(busca, v);
        busca.dispatchEvent(new Event("input", { bubbles: true }));
      });
    digitar("beta");
    expect(secaoDirecao()!.textContent).toContain("1 ficha ");
    expect(secaoDirecao()!.textContent).toContain("Diretora Beta Fictícia");
    expect(secaoDirecao()!.textContent).not.toContain("Diretor Alfa Fictício");
    // Só a Direção bateu: a lista do quadro diz isso, sem fingir que não achou nada.
    expect(el.textContent).toContain("Só a Direção, acima, bate com a busca.");
    digitar("ninguém com este nome");
    expect(secaoDirecao()).toBeNull();

    montar("/colaboradores?status=ativo");
    expect(secaoDirecao()).toBeNull();
  });

  it("quem não vê a ficha da Direção continua sem ver o grupo", () => {
    estado.sessao = { perfil: "COLABORADOR", colaboradorId: "op-d" };
    montar("/colaboradores");
    expect(secaoDirecao()).toBeNull();
    expect(el.textContent).not.toContain("Diretor Alfa Fictício");

    // O gestor vê só a própria equipe: a Direção de cima não aparece.
    estado.sessao = { perfil: "GESTOR", colaboradorId: "rh-g" };
    montar("/colaboradores");
    expect(secaoDirecao()).toBeNull();
    expect(el.textContent).not.toContain("Diretor Alfa Fictício");
  });
});
