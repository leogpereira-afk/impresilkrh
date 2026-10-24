/* A01: pull real contra a function executada no harness. Todos os dados são fictícios. */
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { servidorRh } from "@/test/servidorRh";
vi.mock("./auth", () => ({ MODO_JWT: true, tokenAtual: () => "token-ficticio" }));
vi.mock("./supabase", () => ({ FN_SYNC: "http://rh-teste.local/sync" }));
beforeEach(() => {
  vi.useFakeTimers(); vi.resetModules(); localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  vi.spyOn(window, "addEventListener").mockImplementation(() => {});
  vi.spyOn(document, "addEventListener").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

it("falha no mapa em list misto preserva dados e revisão; a próxima leitura retenta e aplica a máscara", async () => {
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "rh-ficticio");
  const dados = await import("./store"); const sync = await import("./sync");
  const disco = await import("./armazemLocal");
  const local = await import("./armazenamentoUsuario");
  dados.aplicarSemSync(() => {
    dados.definirColecaoDinamica("planoContas", [{ id: "conta-local", codigo: "8.7", nome: "Conta Local Fictícia" }]);
    dados.definirColecaoDinamica("areas", [{ id: "area-local", nome: "Área Local Fictícia" }]);
  });
  disco.gravarArmazem(local.chaveLocal("impresilk.sync.rev"), JSON.stringify({ rev: 0, porColecao: { planoContas: 0, areas: 0 } }));
  const rows = [
    { id: true, config: { vinculosSocioConta: { "8.8|conta ficticia": "socio-ficticio" } } },
    { colecao: "planoContas", id: "conta-privada", registro: { id: "conta-privada", codigo: "8.8", nome: "Conta Fictícia", valor: 123 } },
    { colecao: "areas", id: "area-nova", registro: { id: "area-nova", nome: "Área Nova Fictícia" } },
  ];
  let servidor = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows, erroConsulta: ["config_global"] });
  const pedidos: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    if (body.action === "rev") return new Response(JSON.stringify({ rev: 1, porColecao: { planoContas: 1, areas: 1 } }));
    pedidos.push(body);
    const r = await servidor.call(body);
    return new Response(JSON.stringify(r.body), { status: r.status });
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await sync.pull();
  expect(sync.statusSync()).toBe("erro");
  expect(dados.obter("planoContas").map(r => r.id)).toEqual(["conta-local"]);
  expect(dados.obter("areas").map(r => r.id)).toEqual(["area-local"]);
  expect(JSON.parse(local.lerLocal("impresilk.sync.rev")!).rev).toBe(0);
  servidor = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows });
  await sync.pull();
  expect(pedidos).toHaveLength(2);
  expect(sync.statusSync()).toBe("ok");
  expect(dados.obter("planoContas")).toEqual([]);
  expect(dados.obter("areas").map(r => r.id)).toEqual(["area-nova"]);
  expect(JSON.parse(local.lerLocal("impresilk.sync.rev")!).rev).toBe(1);
});
