import { afterEach, beforeEach, expect, it, vi } from "vitest";

beforeEach(() => { localStorage.clear(); vi.resetModules(); });
afterEach(() => localStorage.clear());

it("trocar de usuário não entrega dados que o anterior baixou", async () => {
  const sessao = await import("./session");
  const dados = await import("./store");
  sessao.entrar("ADMIN_RH", "admin-ficticio");
  dados.definirColecaoDinamica("pagamentos", [{ id: "p1", colaboradorId: "outra-pessoa", valor: 123 }]);
  sessao.sair();
  sessao.entrar("COLABORADOR", "pessoa-ficticia");
  expect(dados.obter("pagamentos")).toHaveLength(0);
  sessao.sair();
  sessao.entrar("ADMIN_RH", "admin-ficticio");
  expect(dados.obter("pagamentos").map(p => p.id)).toEqual(["p1"]);
});

it("redução de perfil não reutiliza o retrato administrativo", async () => {
  const sessao = await import("./session");
  const dados = await import("./store");
  sessao.entrar("ADMIN_RH", "pessoa-ficticia");
  dados.definirColecaoDinamica("pagamentos", [{ id: "p1", valor: 123 }]);
  sessao.entrar("COLABORADOR", "pessoa-ficticia");
  expect(dados.obter("pagamentos")).toHaveLength(0);
});

it("a base antiga de dono não identificado fica preservada sem entrar na nova sessão", async () => {
  localStorage.setItem("impresilk.rh.v1:col:pagamentos", JSON.stringify([{ id: "legado", valor: 123 }]));
  const sessao = await import("./session");
  const dados = await import("./store");
  sessao.entrar("COLABORADOR", "pessoa-ficticia");
  expect(dados.obter("pagamentos")).toHaveLength(0);
  expect(JSON.parse(localStorage.getItem("impresilk.rh.v1:col:pagamentos")!)).toHaveLength(1);
});
