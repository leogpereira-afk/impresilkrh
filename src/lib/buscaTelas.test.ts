/* A busca só serve se aguentar como as pessoas digitam de verdade: sem acento,
   por pedaço do meio, e pelo nome que a casa usa — não pelo rótulo formal. */
import { describe, it, expect } from "vitest";
import { buscarTelas, normalizar, APELIDOS, type TelaBuscavel } from "./buscaTelas";

const TELAS: TelaBuscavel[] = [
  { href: "/painel", label: "Painel", grupo: "Visão geral" },
  { href: "/ferias", label: "Férias", grupo: "Pessoas" },
  { href: "/ponto", label: "Frequência e Advertências", grupo: "Pessoas" },
  { href: "/sst", label: "Saúde e Segurança (SST)", grupo: "Pessoas" },
  { href: "/custos", label: "Custos de Colaboradores", grupo: "Cargos & Custos" },
  { href: "/carreira", label: "Carreira e Salários", grupo: "Cargos & Custos" },
  { href: "/colaboradores", label: "Colaboradores", grupo: "Pessoas" },
];
const achou = (termo: string) => buscarTelas(TELAS, termo).map((t) => t.href);

describe("normalizar", () => {
  it("tira acento e caixa", () => {
    expect(normalizar("Férias")).toBe("ferias");
    expect(normalizar("  SAÚDE  ")).toBe("saude");
  });
});

describe("busca de telas", () => {
  it("sem termo, devolve tudo — o painel vazio é o índice do sistema", () => {
    expect(buscarTelas(TELAS, "")).toHaveLength(TELAS.length);
    expect(buscarTelas(TELAS, "   ")).toHaveLength(TELAS.length);
  });

  it("acha sem digitar acento", () => {
    expect(achou("ferias")[0]).toBe("/ferias");
    expect(achou("saude")[0]).toBe("/sst");
  });

  it("acha por pedaço do meio do nome", () => {
    expect(achou("custo")).toContain("/custos");
    expect(achou("colaborad")).toContain("/colaboradores");
  });

  it("acha pelo nome que a CASA usa, não o do menu", () => {
    // Ninguém procura "Frequência e Advertências" — procura "ponto".
    expect(achou("ponto")).toContain("/ponto");
    // Nem "Saúde e Segurança" — procura "aso" ou "exame".
    expect(achou("aso")).toContain("/sst");
    expect(achou("exame")).toContain("/sst");
    expect(achou("onboarding")).toEqual([]); // essa tela não está nesta lista de teste
  });

  it("quem começa com o termo vem ANTES de quem só o contém", () => {
    /* "car" está em "Carreira" (começo) e em "Colaboradores"? não — mas está
       nos apelidos de /custos. O rótulo que começa tem de ganhar. */
    expect(achou("carr")[0]).toBe("/carreira");
  });

  it("rótulo ganha de apelido", () => {
    // "salario" é apelido de /custos E aparece no rótulo de "Carreira e Salários".
    expect(achou("salario")[0]).toBe("/carreira");
    expect(achou("salario")).toContain("/custos");
  });

  it("acha pelo nome do grupo", () => {
    expect(achou("visao geral")).toContain("/painel");
  });

  it("o que não existe devolve vazio, sem inventar", () => {
    expect(achou("xyzabc")).toEqual([]);
  });

  it("toda rota com apelido usa caminho começando com barra", () => {
    // Erro de digitação aqui faria o apelido nunca casar, em silêncio.
    for (const href of Object.keys(APELIDOS)) expect(href.startsWith("/")).toBe(true);
  });

  it("apelidos são gravados sem acento — senão nunca casam", () => {
    /* A busca normaliza o termo digitado E o apelido, mas gravar com acento
       esconde o descuido; este teste mantém a lista honesta. */
    for (const [href, lista] of Object.entries(APELIDOS)) {
      for (const a of lista) {
        expect(a, `${href}: "${a}" tem acento ou maiúscula`).toBe(normalizar(a));
      }
    }
  });
});
