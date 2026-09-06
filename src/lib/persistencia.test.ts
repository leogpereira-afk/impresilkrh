import { beforeEach, afterEach, expect, it, vi } from "vitest";
beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); });

it("falta de espaço não confirma um cadastro que só existe na memória", async () => {
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "pessoa-ficticia");
  const dados = await import("./store");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota fictícia"); });
  expect(() => dados.criarEm("tarefas", { id: "t1", titulo: "A" })).toThrow();
  expect(dados.obter("tarefas")).toHaveLength(0);
});

it("uma falha ao guardar a fila desfaz a edição que não poderá ser enviada", async () => {
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "pessoa-ficticia");
  const dados = await import("./store");
  dados.definirColecaoDinamica("tarefas", [{ id: "t1", titulo: "Antes" }]);
  dados.registrarMutacao(() => { throw new Error("fila sem espaço"); });
  expect(() => dados.atualizarEm("tarefas", "t1", { titulo: "Depois" })).toThrow();
  expect(dados.obter("tarefas")[0].titulo).toBe("Antes");
});
