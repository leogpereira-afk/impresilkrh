import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
beforeEach(() => { localStorage.clear(); vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it("anexos de uma conta não ficam disponíveis para a seguinte", async () => {
  const sessao = await import("./session");
  const arquivos = await import("./blobstore");
  sessao.entrar("ADMIN_RH", "admin-ficticio");
  expect(await arquivos.putBlob("doc:d1", "data:application/pdf;base64,ZmFrZQ==")).toBe(true);
  sessao.entrar("COLABORADOR", "pessoa-ficticia");
  expect(await arquivos.getBlob("doc:d1")).toBeNull();
  sessao.entrar("ADMIN_RH", "admin-ficticio");
  expect(await arquivos.getBlob("doc:d1")).toBe("data:application/pdf;base64,ZmFrZQ==");
});
