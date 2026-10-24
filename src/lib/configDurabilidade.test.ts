import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

beforeEach(() => {
  vi.resetModules(); localStorage.clear(); vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("BroadcastChannel", undefined);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function preparar() {
  const armazem = await import("./armazemLocal"); await armazem.prontoArmazem();
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "conta-ficticia");
  const dados = await import("./store");
  dados.salvarConfig({ empresaNome: "Antes Fictício" }); dados.confirmarChavesEnviadas({ empresaNome: "Antes Fictício" });
  await armazem.confirmarArmazem();
  return { dados, armazem };
}

it("recusa salvar configuração se não puder guardar as chaves que a protegem da nuvem", async () => {
  const { dados, armazem } = await preparar();
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key.includes("config%3Asujas")) throw new DOMException("Quota fictícia", "QuotaExceededError");
    return original.call(this, key, value);
  });
  expect(() => dados.salvarConfig({ empresaNome: "Depois Fictício" })).toThrow();
  expect(dados.obterConfig().empresaNome).toBe("Antes Fictício");
  quota.mockRestore(); await armazem.confirmarArmazem();
  vi.resetModules(); const reaberto = await import("./armazemLocal"); await reaberto.prontoArmazem();
  expect((await import("./store")).obterConfig().empresaNome).toBe("Antes Fictício");
});

it("recusa configuração sem espaço e mantém as pendências anteriores", async () => {
  const { dados, armazem } = await preparar();
  dados.salvarConfig({ empresaCidade: "Cidade Fictícia" }); await armazem.confirmarArmazem();
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key.includes("config%3Aconta")) throw new DOMException("Quota fictícia", "QuotaExceededError");
    return original.call(this, key, value);
  });
  expect(() => dados.salvarConfig({ empresaNome: "Depois Fictício" })).toThrow();
  expect(dados.obterConfig().empresaNome).toBe("Antes Fictício");
  expect(dados.chavesSujasDaConfig()).toEqual(["empresaCidade"]);
  quota.mockRestore(); await armazem.confirmarArmazem();
});

it("a conta seguinte não herda proteção nem envio pendente da anterior", async () => {
  const { dados, armazem } = await preparar();
  dados.salvarConfig({ empresaNome: "Alteração da conta A" });
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "outra-ficticia");
  expect(dados.chavesSujasDaConfig()).toEqual([]);
  dados.aplicarConfigDaNuvem({ empresaNome: "Configuração remota B" });
  expect(dados.obterConfig().empresaNome).toBe("Configuração remota B");
  sessao.entrar("ADMIN_RH", "conta-ficticia");
  expect(dados.chavesSujasDaConfig()).toEqual(["empresaNome"]);
  expect(dados.obterConfig().empresaNome).toBe("Alteração da conta A");
  await armazem.confirmarArmazem();
});

it("migra flags legadas somente quando existe uma única configuração com conta", async () => {
  const { dados, armazem } = await preparar();
  armazem.gravarArmazem("impresilk.rh.v1:config:sujas", '{"empresaNome":true}');
  expect(dados.chavesSujasDaConfig()).toEqual(["empresaNome"]);
  expect(armazem.lerArmazem("impresilk.rh.v1:config:sujas")).toBeNull();
  await armazem.confirmarArmazem();
});

it("legado sem proprietário inequívoco preserva proteção, mas não autoriza envio por outra conta", async () => {
  const { dados, armazem } = await preparar();
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "outra-ficticia");
  dados.aplicarConfigDaNuvem({ empresaNome: "Configuração remota B" });
  armazem.gravarArmazem("impresilk.rh.v1:config:sujas", '{"empresaNome":true}');
  expect(dados.chavesSujasDaConfig()).toEqual([]);
  dados.aplicarConfigDaNuvem({ empresaNome: "Novo valor remoto" });
  expect(dados.obterConfig().empresaNome).toBe("Configuração remota B");
  expect(armazem.lerArmazem("impresilk.rh.v1:config:sujas")).toBe('{"empresaNome":true}');
  await armazem.confirmarArmazem();
});

it("o boot com IndexedDB preserva flags globais que ainda estavam no localStorage antigo", async () => {
  localStorage.setItem("impresilk.rh.v1:config:conta:conta-ficticia:ADMIN_RH", '{"empresaNome":"Alteração offline fictícia"}');
  localStorage.setItem("impresilk.rh.v1:config:sujas", '{"empresaNome":true}');
  const armazem = await import("./armazemLocal"); await armazem.prontoArmazem();
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "conta-ficticia");
  const dados = await import("./store");
  expect(dados.chavesSujasDaConfig()).toEqual(["empresaNome"]);
  dados.aplicarConfigDaNuvem({ empresaNome: "Valor antigo da nuvem" });
  expect(dados.obterConfig().empresaNome).toBe("Alteração offline fictícia");
  await armazem.confirmarArmazem();
});
