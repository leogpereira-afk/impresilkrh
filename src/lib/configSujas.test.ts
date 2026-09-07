// A config global sobe por PATCH (só o que mudou) e desce sem apagar o que
// ainda não subiu. Caso real de 07/09/2026: a config inteira de um aparelho
// defasado apagava os vínculos do ERP feitos em outro.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ token: "token-ficticio" }));
vi.mock("./auth", () => ({ MODO_JWT: true, tokenAtual: () => auth.token }));
vi.mock("./supabase", () => ({ FN_SYNC: "http://rh-teste.local/sync" }));

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-07T10:00:00Z")); vi.resetModules(); localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  vi.spyOn(window, "addEventListener").mockImplementation(() => {});
  vi.spyOn(document, "addEventListener").mockImplementation(() => {});
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function preparar() {
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "admin-ficticio");
  const dados = await import("./store"); const sync = await import("./sync");
  return { sessao, dados, sync };
}
const resposta = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

function servidor(falhaSetCfg = false) {
  const chamadas: { action: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    chamadas.push({ action: body.action, body });
    if (body.action === "setCfg") return falhaSetCfg ? new Response("erro", { status: 500 }) : resposta({ ok: true });
    if (body.action === "getCfg") return resposta({ config: { config: { empresaCidade: "Montes Claros", vinculosMubi: { "X": "y" } } } });
    return resposta({ ok: true, registros: [], rev: 1 });
  }));
  return chamadas;
}

it("sobe só as chaves que mudaram, não a config inteira", async () => {
  const chamadas = servidor();
  const { dados, sync } = await preparar();
  dados.salvarConfig({ vinculosMubiTitulo: { "1": "ana" } } as never);
  sync.enviarConfigNuvem();
  await vi.advanceTimersByTimeAsync(1600);
  const set = chamadas.filter((c) => c.action === "setCfg");
  expect(set).toHaveLength(1);
  expect(Object.keys(set[0].body.patch as object)).toEqual(["vinculosMubiTitulo"]);
  expect(set[0].body.config).toBeUndefined();
  expect(dados.chavesSujasDaConfig()).toEqual([]);
});

it("falha no envio mantém a chave suja; a próxima tentativa reenvia", async () => {
  const chamadas = servidor(true);
  const { dados, sync } = await preparar();
  dados.salvarConfig({ vinculosMubi: { "JOAO": "joao" } } as never);
  sync.enviarConfigNuvem();
  await vi.advanceTimersByTimeAsync(1600);
  expect(dados.chavesSujasDaConfig()).toEqual(["vinculosMubi"]);
  sync.enviarConfigNuvem();
  await vi.advanceTimersByTimeAsync(1600);
  expect(chamadas.filter((c) => c.action === "setCfg")).toHaveLength(2);
});

it("a config da nuvem não apaga o que ainda não subiu", async () => {
  servidor(true);
  const { dados } = await preparar();
  dados.salvarConfig({ vinculosMubi: { "JOAO": "joao" } } as never);
  dados.aplicarConfigDaNuvem({ vinculosMubi: { "X": "y" }, empresaCidade: "Montes Claros" } as never);
  const cfg = dados.obterConfig() as unknown as Record<string, unknown>;
  expect(cfg.vinculosMubi).toEqual({ "JOAO": "joao" }); // suja: fica a local
  expect(cfg.empresaCidade).toBe("Montes Claros"); // limpa: entra a da nuvem
});

it("chave que mudou de novo durante o envio continua suja", async () => {
  servidor();
  const { dados } = await preparar();
  dados.salvarConfig({ empresaCidade: "A" } as never);
  dados.confirmarChavesEnviadas({ empresaCidade: "B" } as never); // subiu "B", mas o valor atual é "A"
  expect(dados.chavesSujasDaConfig()).toEqual(["empresaCidade"]);
  dados.confirmarChavesEnviadas({ empresaCidade: "A" } as never);
  expect(dados.chavesSujasDaConfig()).toEqual([]);
});
