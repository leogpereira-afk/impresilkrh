import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
const chave = "impresilk.rh.v1:col:tarefas";
beforeEach(() => { localStorage.clear(); vi.resetModules(); vi.stubGlobal("indexedDB", new IDBFactory()); });
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

it("a cópia anterior é recuperável antes de liberar o espaço antigo", async () => {
  localStorage.setItem(chave, JSON.stringify([{ id: "legado", titulo: "Fictício" }]));
  localStorage.setItem("impresilk.rh.v1:sessao", "nao-copiar-sessao");
  const copia = await import("./copiaAnterior");
  await copia.prepararCopiaAnterior();
  expect(localStorage.getItem(chave)).toBeNull();
  const recuperado = await copia.lerCopiaAnterior();
  expect(JSON.parse(recuperado[chave])[0].id).toBe("legado");
  expect(recuperado["impresilk.rh.v1:sessao"]).toBeUndefined();
  expect(localStorage.getItem("impresilk.rh.v1:sessao")).toBe("nao-copiar-sessao");
});

it("falha na cópia mantém o conteúdo original intacto", async () => {
  localStorage.setItem(chave, "[]");
  vi.stubGlobal("indexedDB", { open: () => { throw new Error("indisponível"); } });
  const copia = await import("./copiaAnterior");
  await expect(copia.prepararCopiaAnterior()).rejects.toThrow();
  expect(localStorage.getItem(chave)).toBe("[]");
});
