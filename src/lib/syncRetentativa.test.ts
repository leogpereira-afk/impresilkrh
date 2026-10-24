// Servidor e registros exclusivamente fictícios; nenhuma conexão produtiva.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("./auth", () => ({ MODO_JWT: true, tokenAtual: () => "token-ficticio" }));
vi.mock("./supabase", () => ({ FN_SYNC: "http://rh-teste.local/sync" }));
beforeEach(() => {
  vi.resetModules(); localStorage.clear(); vi.stubGlobal("indexedDB", undefined);
  vi.spyOn(window, "addEventListener").mockImplementation(() => {});
  vi.spyOn(document, "addEventListener").mockImplementation(() => {});
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function prepararFalha() {
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "conta-ficticia");
  const dados = await import("./store");
  dados.definirColecaoDinamica("tarefas", [{ id: "t-ficticia", titulo: "Antes", _rhRev: 7 }]);
  const sync = await import("./sync");
  dados.atualizarEm("tarefas", "t-ficticia", { titulo: "Depois" });
  const pedidos: Record<string, any>[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    pedidos.push(JSON.parse(String(options?.body)));
    return new Response(JSON.stringify({ erro: "Serviço fictício temporariamente indisponível" }), { status: 503 });
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  for (let i = 0; i < 25; i++) await sync.trySync();
  expect(sync.falhasSync()).toHaveLength(1);
  return { dados, sync, pedidos };
}

it("retenta a mesma operação da versão 7 após 25 falhas sem fabricar conflito", async () => {
  const { dados, sync, pedidos } = await prepararFalha();
  const enviado = pedidos[0];
  expect(sync.falhasSync()[0]).toMatchObject({ baseVersao: 7, mutationId: enviado.mutationId });
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); sync.retentarFalhas();
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const pedido = JSON.parse(String(options?.body)); pedidos.push(pedido);
    return new Response(JSON.stringify(pedido.baseVersao === 7 ? { ok: true, versao: 8 } : { conflito: true, servidor: { colecao: "tarefas", registro: { id: "t-ficticia", titulo: "Antes", _rhRev: 7 } } }));
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); await sync.trySync();
  expect(pedidos[pedidos.length - 1]).toMatchObject({ baseVersao: 7, mutationId: enviado.mutationId, registro: enviado.registro });
  expect(sync.conflitosSync()).toHaveLength(0); expect(sync.pendentesSync()).toBe(0);
  expect(dados.obterDinamico("tarefas")[0]).toMatchObject({ titulo: "Depois", _rhRev: 8 });
});

it("preserva conflito real quando o servidor mudou desde a versão da tentativa", async () => {
  const { dados, sync } = await prepararFalha();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); sync.retentarFalhas();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ conflito: true, servidor: { colecao: "tarefas", registro: { id: "t-ficticia", titulo: "Alteração concorrente", _rhRev: 9 } } }))));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); await sync.trySync();
  expect(sync.conflitosSync()).toHaveLength(1);
  expect(dados.obterDinamico("tarefas")[0].titulo).toBe("Depois");
});

it("edição posterior substitui a falha antiga sem reutilizar a identidade dela", async () => {
  const { dados, sync, pedidos } = await prepararFalha();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  dados.atualizarEm("tarefas", "t-ficticia", { titulo: "Mais recente" });
  expect(sync.falhasSync()).toHaveLength(0);
  expect(sync.retentarFalhas()).toBe(0);
  const fila = JSON.parse(localStorage.getItem("impresilk.sync.fila:conta:conta-ficticia:ADMIN_RH")!);
  expect(fila).toHaveLength(1); expect(fila[0].mutationId).not.toBe(pedidos[0].mutationId);
});

it("não deixa falha antiga retentável depois de confirmar uma edição que a substituiu", async () => {
  const { dados, sync } = await prepararFalha();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (key.includes("impresilk.sync.falhas")) throw new Error("Quota fictícia na caixa de falhas");
    return original.call(this, key, value);
  });
  dados.atualizarEm("tarefas", "t-ficticia", { titulo: "Mais recente" });
  quota.mockRestore();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: true, versao: 8 }))));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true); await sync.trySync();
  expect(sync.pendentesSync()).toBe(0); expect(sync.falhasSync()).toHaveLength(0);
  expect(sync.retentarFalhas()).toBe(0);
});
