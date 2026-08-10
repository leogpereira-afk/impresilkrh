import { describe, it, expect } from "vitest";
import {
  tiposDisponiveis, validarNovoTipo, normalizarNomeTipo, TIPOS_DE_FABRICA,
} from "@/lib/tiposEvento";

/* Os tipos DERIVADOS do calendário (Calendario.tsx os passa como `reservados`).
   A lib não os conhece sozinha — é justamente daí que veio o defeito. */
const DERIVADOS = [
  "Aniversário", "Tempo de empresa", "Documento vence", "NR vence",
  "Experiência", "Férias — prazo CLT", "Férias", "Pagamento",
];

describe("tiposDisponiveis", () => {
  it("sem nada criado, devolve só os de fábrica", () => {
    expect(tiposDisponiveis()).toEqual(TIPOS_DE_FABRICA);
    expect(tiposDisponiveis([])).toEqual(TIPOS_DE_FABRICA);
  });

  it("os de fábrica vêm primeiro e os criados em ordem alfabética", () => {
    const r = tiposDisponiveis([
      { nome: "Vistoria de extintor", cor: "#f00" },
      { nome: "Alvará vence", cor: "#0f0" },
    ]);
    expect(r.slice(0, TIPOS_DE_FABRICA.length)).toEqual(TIPOS_DE_FABRICA);
    expect(r.slice(TIPOS_DE_FABRICA.length).map((t) => t.nome)).toEqual([
      "Alvará vence",
      "Vistoria de extintor",
    ]);
  });

  it("personalizado com nome de um de fábrica é IGNORADO", () => {
    // Senão o seletor mostraria "Reunião" duas vezes e a cor dependeria de qual
    // das duas o código achasse primeiro.
    const r = tiposDisponiveis([{ nome: "Reunião", cor: "#f00" }]);
    expect(r).toHaveLength(TIPOS_DE_FABRICA.length);
    expect(r.find((t) => t.nome === "Reunião")!.cor).toBe("#16334f");
  });

  it("não deixa entrar dois com o mesmo nome", () => {
    const r = tiposDisponiveis([
      { nome: "Vistoria", cor: "#f00" },
      { nome: "Vistoria", cor: "#0f0" },
    ]);
    expect(r.filter((t) => t.nome === "Vistoria")).toHaveLength(1);
  });

  it("ignora nome vazio ou só espaço, e não quebra sem cor", () => {
    const r = tiposDisponiveis([
      { nome: "   ", cor: "#f00" },
      { nome: "Sem cor", cor: "" },
    ]);
    expect(r.some((t) => t.nome === "Sem cor")).toBe(true);
    expect(r.find((t) => t.nome === "Sem cor")!.cor).toBeTruthy();
    expect(r).toHaveLength(TIPOS_DE_FABRICA.length + 1);
  });
});

describe("normalizarNomeTipo", () => {
  it("tira espaço das pontas e junta espaço repetido", () => {
    expect(normalizarNomeTipo("  Vistoria   de   extintor ")).toBe("Vistoria de extintor");
  });
});

describe("validarNovoTipo", () => {
  it("nome vazio não passa", () => {
    expect(validarNovoTipo("   ")).toEqual({ ok: false, motivo: "Dê um nome ao tipo." });
  });

  it("nome repetido não passa, nem com caixa diferente", () => {
    const r = validarNovoTipo("reuniÃO");
    expect(r.ok).toBe(false);
    const r2 = validarNovoTipo("Vistoria", [{ nome: "vistoria", cor: "#f00" }]);
    expect(r2.ok).toBe(false);
  });

  it("nome longo demais não passa", () => {
    expect(validarNovoTipo("x".repeat(41)).ok).toBe(false);
    expect(validarNovoTipo("x".repeat(40)).ok).toBe(true);
  });

  it("nome novo passa", () => {
    expect(validarNovoTipo("Vistoria de extintor")).toEqual({ ok: true });
  });
});

describe("nomes reservados pela tela (os tipos derivados)", () => {
  it("O CASO QUE IMPORTA: não dá para criar um tipo com nome de derivado", () => {
    // Sem os reservados, "Aniversário" era aceito: entrava na config, colidia com
    // o derivado de mesmo nome na legenda, e a cor passava a depender de qual dos
    // dois o código encontrasse primeiro.
    for (const nome of DERIVADOS) {
      const r = validarNovoTipo(nome, [], DERIVADOS);
      expect(r.ok, `"${nome}" deveria ser recusado`).toBe(false);
    }
  });

  it("recusa derivado com caixa e espaço diferentes", () => {
    expect(validarNovoTipo("  aniversÁrio  ", [], DERIVADOS).ok).toBe(false);
  });

  it("um nome livre continua passando", () => {
    expect(validarNovoTipo("Vistoria de extintor", [], DERIVADOS)).toEqual({ ok: true });
  });

  it("personalizado com nome de derivado não entra no seletor", () => {
    const r = tiposDisponiveis([{ nome: "Pagamento", cor: "#f00" }], DERIVADOS);
    expect(r).toHaveLength(TIPOS_DE_FABRICA.length);
  });

  it("sem passar reservados, o comportamento antigo segue valendo (fábrica só)", () => {
    expect(validarNovoTipo("Reunião").ok).toBe(false);
    expect(validarNovoTipo("Aniversário").ok).toBe(true);
  });
});
