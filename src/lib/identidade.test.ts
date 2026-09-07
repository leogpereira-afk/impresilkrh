import { describe, expect, it } from "vitest";
import { acharPorIdNoTexto, idPessoa, mapaDeIds } from "./identidade";
import type { Colaborador } from "@/data/types";

const col = (id: string, nome: string, cpf?: string) => ({ id, nome, cpf } as unknown as Colaborador);
// CPFs fictícios (não passam no dígito verificador de propósito)
const ana = col("ana", "Ana Lima", "123.456.000-99");
const bia = col("bia", "Bia Souza", "654321000-11");
const semCpf = col("caio", "Caio", "");

describe("idPessoa", () => {
  it("é os 6 primeiros dígitos do CPF, com ou sem pontuação", () => {
    expect(idPessoa("123.456.000-99")).toBe("123456");
    expect(idPessoa("12345600099")).toBe("123456");
  });
  it("sem CPF válido não há ID", () => {
    expect(idPessoa("")).toBeNull();
    expect(idPessoa("1234")).toBeNull();
    expect(idPessoa(undefined)).toBeNull();
  });
});

describe("mapaDeIds", () => {
  it("só entra quem tem ID único", () => {
    const m = mapaDeIds([ana, bia, semCpf, col("ana2", "Ana Repetida", "123456999-00")]);
    expect(m.has("654321")).toBe(true);
    expect(m.has("123456")).toBe(false); // dois cadastros com o mesmo ID: nenhum casa
  });
});

describe("acharPorIdNoTexto", () => {
  const ids = mapaDeIds([ana, bia]);
  it("ID explícito no texto", () => {
    expect(acharPorIdNoTexto("Salário ID 654321 agosto", ids)?.id).toBe("bia");
    expect(acharPorIdNoTexto("Comissão #123456", ids)?.id).toBe("ana");
    expect(acharPorIdNoTexto("id: 123456", ids)?.id).toBe("ana");
  });
  it("CPF inteiro no texto", () => {
    expect(acharPorIdNoTexto("Pagamento CPF 654.321.000-11", ids)?.id).toBe("bia");
  });
  it("6 dígitos soltos casam só quando são de UMA pessoa conhecida", () => {
    expect(acharPorIdNoTexto("Adiantamento 123456", ids)?.id).toBe("ana");
    expect(acharPorIdNoTexto("Adiantamento 123456 e 654321", ids)).toBeNull();
    expect(acharPorIdNoTexto("Adiantamento 999999", ids)).toBeNull();
  });
  it("datas e competências não viram ID", () => {
    expect(acharPorIdNoTexto("Salário 08/2026 venc 2026-09-05", ids)).toBeNull();
    expect(acharPorIdNoTexto("NF 1234567", ids)).toBeNull(); // 7 dígitos: não é ID
  });
  it("texto vazio ou sem pessoas cadastradas não casa", () => {
    expect(acharPorIdNoTexto("", ids)).toBeNull();
    expect(acharPorIdNoTexto("ID 123456", new Map())).toBeNull();
  });
});
