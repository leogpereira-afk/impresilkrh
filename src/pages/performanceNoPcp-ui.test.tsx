/* F25 (01/10/2026): A TELA PERFORMANCE DO RH VIROU AVISO, E SÓ LÊ.
 *
 * O programa das equipes (ranking, pontos, comissão e prêmios) mora no PCP.
 * O endereço /performance continua de pé e mostra o caminho do PCP. As
 * apurações antigas (performanceCiclos) ficam no banco e aparecem ao RH só para
 * consulta, em PDF.
 *
 * O que se prova aqui é a tela montada, pelo caso ruim: com uma apuração antiga
 * guardada (inclusive com vínculo de O.S. e proposta aprovada), a tela não
 * oferece campo nem botão que grave, e baixar o PDF não chama nenhuma escrita
 * do store. Quem não é RH vê o aviso e não vê as apurações.
 *
 * Nada aqui toca banco nem armazenamento: store, sessão, domínio, toast e PDF
 * são dublês. Dados fictícios (o repositório é público). */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CicloPerformance } from "@/data/performance";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const estado = vi.hoisted(() => ({
  sessao: null as { perfil: "ADMIN_RH" | "GESTOR" | "COLABORADOR"; colaboradorId: string } | null,
  colecoes: {} as Record<string, unknown[]>,
  escritas: [] as string[],
  pdf: [] as unknown[],
  toast: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
}));

vi.mock("@/lib/store", async (orig) => ({
  ...(await orig<typeof import("@/lib/store")>()),
  useColecao: (nome: string) => {
    const anota = (acao: string) => () => { estado.escritas.push(`${acao}:${nome}`); };
    return {
      items: estado.colecoes[nome] ?? [],
      criar: anota("criar"), atualizar: anota("atualizar"), remover: anota("remover"),
      criarOuAtualizar: anota("criarOuAtualizar"), definir: anota("definir"),
    };
  },
}));
vi.mock("@/lib/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/session")>()),
  useSessao: () => estado.sessao,
}));
vi.mock("@/lib/dominio", async (orig) => ({
  ...(await orig<typeof import("@/lib/dominio")>()),
  useDominio: () => ({
    colabById: new Map([["pessoa-ficticia", { id: "pessoa-ficticia", nome: "Pessoa Fictícia", cpf: "90000100129" }]]),
    nomeColab: (id: string) => (id === "pessoa-ficticia" ? "Pessoa Fictícia" : "—"),
  }),
}));
vi.mock("@/components/ui/toast", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/toast")>()),
  useToast: () => estado.toast,
}));
/* O jsdom não baixa arquivo: o pedido de PDF fica guardado para conferir. */
vi.mock("@/lib/performancePdf", async (orig) => ({
  ...(await orig<typeof import("@/lib/performancePdf")>()),
  exportarPerformance: async (c: CicloPerformance, nome: (id: string) => string) => {
    estado.pdf.push({ competencia: c.competencia, nome: nome("pessoa-ficticia") });
  },
}));

import Performance, { URL_PCP } from "./Performance";

const regra = { pesos: { entrega: 35, qualidade: 30, prazo: 20, colaboracao: 15 }, notaMinima: 60, qualidadeMinima: 70, tetoIndividual: 300, orcamento: 1000, referencia: "" };
const cicloAntigo: CicloPerformance = {
  id: "ciclo-2026-08",
  competencia: "2026-08",
  regra,
  pessoas: [{
    colaboradorId: "pessoa-ficticia", habitual: 1, meta: 2, colaboracao: [100, 100, 100], evidenciaColaboracao: "teste", contexto: "",
    aprovacao: { valor: 150, nota: 80, em: "2026-08-31T12:00:00-03:00", por: "rh-ficticio", justificativa: "teste", regra },
  }],
  entregas: [{
    id: "e1", colaboradorId: "pessoa-ficticia", participacao: 60, complexidade: 2, evidencia: "teste", aceite: true, qualidade: "sem_retrabalho", prazo: "no_prazo", justificativa: "",
    os: { id: "os-teste", numero: "TESTE-1", cliente: "Cliente Fictício", servico: "", finalizadaEm: "2026-08-10", prazo: "", equipe: ["Equipe Fictícia"], retrabalho: false, baixaAutomatica: false, atualizadoEm: "2026-08-10" },
  }],
  historico: [],
  atualizadoEm: "2026-08-31T12:00:00-03:00",
};

let el: HTMLDivElement;
let root: Root;
const montar = () => act(() => {
  root = createRoot(el);
  root.render(<MemoryRouter initialEntries={["/performance"]}><Performance /></MemoryRouter>);
});
const texto = () => el.textContent ?? "";
const botoes = () => Array.from(el.querySelectorAll("button")).map((b) => b.textContent?.trim());

beforeEach(() => {
  estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "rh-ficticio" };
  estado.colecoes = { performanceCiclos: [cicloAntigo] };
  estado.escritas = [];
  estado.pdf = [];
  estado.toast = vi.fn();
  el = document.createElement("div");
  document.body.append(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
});

describe("Performance do RH depois da F25", () => {
  it("mostra o aviso e o caminho do PCP, que abre em outra aba", () => {
    montar();
    expect(texto()).toContain("O programa das equipes mudou para o PCP");
    expect(texto()).toContain("aba Performance");
    const link = el.querySelector<HTMLAnchorElement>(`a[href="${URL_PCP}"]`);
    expect(link).toBeTruthy();
    expect(link!.target).toBe("_blank");
    expect(link!.rel).toContain("noopener");
    expect(URL_PCP).toBe("https://leogpereira-afk.github.io/impresilk/");
  });

  it("RH: a apuração antiga aparece só para consulta, sem campo e sem botão que grave", () => {
    montar();
    expect(texto()).toContain("Apurações antigas guardadas no RH (1)");
    expect(texto()).toContain("08/2026");
    expect(texto()).toContain("1 pessoa(s) · 1 vínculo(s) de O.S. · 1 proposta(s) aprovada(s)");
    // Nenhum campo editável e nenhum botão além do PDF. A tela antiga tinha
    // "Incluir pessoa", "Critérios e valores", "Aprovar" e "Reabrir".
    expect(el.querySelectorAll("input, select, textarea").length).toBe(0);
    expect(botoes()).toEqual(["Baixar PDF"]);
    expect(texto()).not.toMatch(/Incluir pessoa|Critérios e valores|Vincular O\.S\.|Aprovar proposta|Reabrir/);
    expect(estado.escritas).toEqual([]);
  });

  it("baixar o PDF da apuração antiga não grava nada", async () => {
    montar();
    const baixar = Array.from(el.querySelectorAll("button")).find((b) => b.textContent?.includes("Baixar PDF"))!;
    await act(async () => { baixar.click(); });
    expect(estado.pdf).toEqual([{ competencia: "2026-08", nome: "Pessoa Fictícia · ID 900001" }]);
    expect(estado.escritas).toEqual([]);
    expect(estado.toast).not.toHaveBeenCalled();
  });

  it("RH sem apuração guardada: só o aviso", () => {
    estado.colecoes = { performanceCiclos: [] };
    montar();
    expect(texto()).toContain("O programa das equipes mudou para o PCP");
    expect(texto()).not.toContain("Apurações antigas");
    expect(botoes()).toEqual([]);
  });

  it.each(["GESTOR", "COLABORADOR"] as const)("%s vê o aviso e não vê as apurações do RH", (perfil) => {
    estado.sessao = { perfil, colaboradorId: "pessoa-ficticia" };
    montar();
    expect(texto()).toContain("O programa das equipes mudou para o PCP");
    expect(texto()).not.toContain("Apurações antigas");
    expect(texto()).not.toContain("Acesso restrito");
  });

  it("texto sem travessão", () => {
    montar();
    expect(texto()).not.toContain("—");
  });
});
