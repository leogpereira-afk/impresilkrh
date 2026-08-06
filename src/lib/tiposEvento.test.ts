import { describe, it, expect } from "vitest";
import {
  tiposDisponiveis, validarNovoTipo, ehPersonalizado, normalizarNomeTipo, TIPOS_DE_FABRICA,
} from "@/lib/tiposEvento";

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

describe("ehPersonalizado", () => {
  it("os de fábrica não podem ser apagados", () => {
    for (const t of TIPOS_DE_FABRICA) expect(ehPersonalizado(t.nome)).toBe(false);
  });

  it("o que a empresa criou pode", () => {
    expect(ehPersonalizado("Vistoria de extintor")).toBe(true);
  });
});
