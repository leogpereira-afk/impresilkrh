import { expect, it } from "vitest";
import { defaultsColecoes } from "./index";
import { PLANO_CONTAS } from "./planoContas";
import { PAGAMENTOS } from "./pagamentos";

it("o aplicativo público nasce sem pessoas, contas ou dados de movimento", () => {
  const dados = defaultsColecoes();
  for (const nome of ["colaboradores", "usuarios", "pagamentos", "planoContas", "documentos", "candidatos", "pontos"] as const) {
    expect(dados[nome].length, nome).toBe(0);
  }
});

it("não há folha nem lançamentos financeiros embutidos nos módulos de dados", () => {
  expect(PLANO_CONTAS.length).toBe(0);
  expect(PAGAMENTOS.length).toBe(0);
});
