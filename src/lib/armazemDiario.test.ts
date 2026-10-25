import { expect, it } from "vitest";
import { criarDiario, recuperarDiario } from "./armazemDiario";

it("compacta o retrato sem base preservando Unicode e todos os caracteres", () => {
  const valor = JSON.stringify(Array.from({ length: 500 }, (_, i) => ({ id: `teste-${i}`, nome: "João fictício ✨", texto: "Informação de teste\n".repeat(20) })));
  const diario = criarDiario(valor);
  expect(JSON.parse(diario).v).toBe(2);
  expect(diario.length).toBeLessThan(valor.length / 5);
  expect(recuperarDiario(diario)).toBe(valor);
});

it("continua lendo diários antigos completos e exclusões", () => {
  expect(recuperarDiario(JSON.stringify({ valor: "Antes" }))).toBe("Antes");
  expect(recuperarDiario(criarDiario(null))).toBeNull();
});

it("recusa um diário compacto ilegível em vez de produzir coleção vazia", () => {
  expect(() => recuperarDiario(JSON.stringify({ v: 2, gzip: "invalido!" }))).toThrow();
});
