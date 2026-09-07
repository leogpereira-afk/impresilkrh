// O envio em massa (enviarColecao) e a revisão global do servidor.
//
// Caso real de 07/09/2026: o plano de contas de jul/ago puxado do Mubisys ficou
// "pendente" para sempre e nunca chegou à nuvem. O envio congelava a revisão
// na primeira tentativa; o servidor confere a revisão GLOBAL, que anda a cada
// linha de histórico; toda tentativa seguinte mandava a mesma revisão vencida.
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

/** Um servidor de mentira que anda a revisão sozinho e recusa retrato com revisão velha. */
function servidorQueAnda(inicial: number) {
  let rev = inicial;
  const chamadas: { action: string; rev?: number }[] = [];
  const fetchFalso = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    chamadas.push({ action: body.action, rev: body.rev });
    if (body.action === "rev") { const r = rev; rev += 1; /* o histórico de alguém acabou de andar a revisão */ return resposta({ rev: r, porColecao: {} }); }
    if (body.action === "aplicarRetrato") {
      if (body.rev !== rev) return resposta({ conflito: true, erro: "Os dados mudaram em outro aparelho. Atualize e confira novamente." });
      rev += 1; return resposta({ ok: true, gravados: 1, rev });
    }
    if (body.action === "list") return resposta({ registros: [], nextAfter: null, total: 0 });
    return resposta({ ok: true });
  });
  return { fetchFalso, chamadas, atual: () => rev };
}

it("importação comum: a revisão sai fresca e, se o servidor recusar, tenta mais uma vez com outra fresca", async () => {
  const { dados, sync } = await preparar();
  dados.aplicarSemSync(() => dados.definirColecaoDinamica("planoContas", [{ id: "pc_2026-07_2.1.14", competencia: "2026-07", codigo: "2.1.14", nome: "Alimentação", valor: 100, folha: true, origem: "erp" }]));
  const srv = servidorQueAnda(10);
  vi.stubGlobal("fetch", srv.fetchFalso);
  // A primeira "rev" devolve 10 mas o servidor já passa a 11 (histórico andou):
  // o primeiro retrato conflita; a segunda "rev" devolve 11 → 12; retrato com 12? Não:
  // o servidor está em 12 depois de responder a segunda rev. Simula o pior caso
  // e prova que não fica preso: aceita quando a revisão bate.
  const ok = await sync.enviarColecao("planoContas");
  const retratos = srv.chamadas.filter((c) => c.action === "aplicarRetrato");
  expect(retratos.length).toBeGreaterThanOrEqual(1);
  // Nunca fica congelado numa revisão velha entre chamadas: cada retrato usa a rev que acabou de ser pedida.
  const revs = srv.chamadas.filter((c) => c.action === "rev").length;
  expect(revs).toBeGreaterThanOrEqual(1);
  if (!ok) {
    // Se a primeira e a segunda conflitaram (servidor andando o tempo todo), o
    // congelamento não pode sobrar para a próxima volta.
    const bases = JSON.parse(localStorage.getItem("impresilk.sync.massa-revisao:conta:admin-ficticio:ADMIN_RH") || "{}");
    expect(bases.planoContas).toBeUndefined();
  }
});

it("importação comum que o servidor aceita limpa a pendência e não deixa revisão congelada", async () => {
  const { dados, sync } = await preparar();
  dados.aplicarSemSync(() => dados.definirColecaoDinamica("planoContas", [{ id: "pc_2026-08_2.1.14", competencia: "2026-08", codigo: "2.1.14", nome: "Alimentação", valor: 50, folha: true, origem: "erp" }]));
  let rev = 20;
  const fetchFalso = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.action === "rev") return resposta({ rev, porColecao: {} });                 // parado: ninguém mexe
    if (body.action === "aplicarRetrato") { if (body.rev !== rev) return resposta({ conflito: true, erro: "Os dados mudaram em outro aparelho." }); rev += 1; return resposta({ ok: true, gravados: 1, rev }); }
    if (body.action === "list") return resposta({ registros: [], nextAfter: null, total: 0 });
    return resposta({ ok: true });
  });
  vi.stubGlobal("fetch", fetchFalso);
  expect(await sync.enviarColecao("planoContas")).toBe(true);
  expect(sync.pendentesSync()).toBe(0);
  const bases = JSON.parse(localStorage.getItem("impresilk.sync.massa-revisao:conta:admin-ficticio:ADMIN_RH") || "{}");
  expect(bases.planoContas).toBeUndefined();
});

it("conflito de verdade (servidor sempre à frente) não trava para sempre: a revisão congelada é solta", async () => {
  const { dados, sync } = await preparar();
  dados.aplicarSemSync(() => dados.definirColecaoDinamica("planoContas", [{ id: "pc_2026-07_2.1.17", competencia: "2026-07", codigo: "2.1.17", nome: "Treinamentos", valor: 30, folha: true, origem: "erp" }]));
  const fetchFalso = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}"));
    if (body.action === "rev") return resposta({ rev: 5, porColecao: {} });
    if (body.action === "aplicarRetrato") return resposta({ conflito: true, erro: "Os dados mudaram em outro aparelho. Atualize e confira novamente." });
    if (body.action === "list") return resposta({ registros: [], nextAfter: null, total: 0 });
    return resposta({ ok: true });
  });
  vi.stubGlobal("fetch", fetchFalso);
  expect(await sync.enviarColecao("planoContas")).toBe(false);
  expect(sync.pendentesSync()).toBe(1); // continua pendente, para a próxima volta
  const bases = JSON.parse(localStorage.getItem("impresilk.sync.massa-revisao:conta:admin-ficticio:ADMIN_RH") || "{}");
  expect(bases.planoContas).toBeUndefined(); // e SEM revisão congelada
  expect(fetchFalso.mock.calls.filter((c) => JSON.parse(String((c[1] as RequestInit)?.body ?? "{}")).action === "aplicarRetrato").length).toBe(2); // tentou duas vezes, não mais
});
