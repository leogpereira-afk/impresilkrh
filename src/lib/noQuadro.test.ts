// "Quem saiu não aparece nas telas de cobrança" era uma regra que cada tela
// inventava do seu jeito — e cada tela errava de um jeito diferente. Estes
// testes travam a régua única E impedem que uma tela nova volte a inventar a
// sua, o que é como o problema nasceu.
import { describe, it, expect } from "vitest";
import { noQuadro } from "./dominio";
import type { Colaborador } from "@/data/types";

const c = (over: Partial<Colaborador> = {}): Colaborador =>
  ({ id: "x", nome: "Fulano", statusId: "ativo", ...over }) as Colaborador;

describe("noQuadro", () => {
  it("quem está trabalhando entra", () => {
    expect(noQuadro(c())).toBe(true);
  });

  it("inativo sai", () => {
    expect(noQuadro(c({ statusId: "inativo" }))).toBe(false);
  });

  it("quem tem data de desligamento sai, mesmo que o status não tenha sido trocado", () => {
    // Foi este caso que escapou da régua antiga: o RH lança o desligamento e
    // esquece de mudar o status, e a pessoa continua sendo cobrada por exame.
    expect(noQuadro(c({ statusId: "ativo", dataDesligamento: "2026-05-30" }))).toBe(false);
  });

  it("AFASTADO continua: ele volta, e o exame dele tem de estar em dia", () => {
    expect(noQuadro(c({ statusId: "afastado" }))).toBe(true);
  });

  it("DIREÇÃO continua: sócio faz exame ocupacional igual", () => {
    // Diferente de contaHeadcount, que tira a direção porque lá a pergunta é
    // "quantas pessoas temos no quadro".
    expect(noQuadro(c({ ehDirecao: true }))).toBe(true);
  });
});

// Vitest expõe import.meta.glob (Vite): lê o CONTEÚDO de todas as telas sem
// precisar do módulo de arquivos do Node, que não existe no ambiente do teste.
describe("nenhuma tela inventa a própria régua", () => {
  it('não existe `statusId !== "inativo"` solto em pages/ nem components/', () => {
    const arquivos = import.meta.glob("../{pages,components}/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    const suspeitos = Object.entries(arquivos)
      .filter(([nome]) => !nome.includes(".test."))
      .filter(([, txt]) => txt.includes('statusId !== "inativo"'))
      .map(([nome]) => nome);
    // Quem precisar da regra usa `noQuadro` de lib/dominio.
    expect(suspeitos).toEqual([]);
    // A varredura tem de ter lido algo: um glob que não casa nada passaria
    // vazio e o teste viraria enfeite.
    expect(Object.keys(arquivos).length).toBeGreaterThan(15);
  });
});
