import { afterEach, beforeEach, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ token: "token-ficticio" }));
vi.mock("./auth", () => ({ MODO_JWT: true, tokenAtual: () => auth.token }));
vi.mock("./supabase", () => ({ FN_SYNC: "http://rh-teste.local/sync" }));

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T10:00:00Z")); vi.resetModules(); localStorage.clear();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  // Os testes acionam o sincronizador diretamente; não deixam ouvintes de outro caso.
  vi.spyOn(window, "addEventListener").mockImplementation(() => {});
  vi.spyOn(document, "addEventListener").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ config: null, ok: true }))));
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear(); });

async function preparar() {
  const sessao = await import("./session"); sessao.entrar("ADMIN_RH", "admin-ficticio");
  const dados = await import("./store"); const sync = await import("./sync");
  return { sessao, dados, sync };
}
const resposta = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

it("confirmar A não remove B salvo no mesmo milissegundo durante o envio", async () => {
  const { dados, sync } = await preparar();
  dados.criarEm("tarefas", { id: "t1", titulo: "A", colaboradorId: "ana" });
  let confirmar!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(resolve => { confirmar = resolve; })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const envio = sync.trySync();
  dados.atualizarEm("tarefas", "t1", { titulo: "B" });
  confirmar(resposta({ ok: true, versao: 1 })); await envio;
  expect(sync.pendentesSync()).toBe(1);
  expect(dados.obter("tarefas")[0].titulo).toBe("B");
  const pendente = JSON.parse(localStorage.getItem("impresilk.sync.fila:conta:admin-ficticio:ADMIN_RH")!);
  expect(pendente[0].baseVersao).toBe(1);
});

it("excluir mantém na fila a versão que foi lida antes de remover localmente", async () => {
  const { dados } = await preparar();
  dados.aplicarSemSync(() => dados.definirColecaoDinamica("tarefas", [{ id: "t1", _rhRev: 4 }]));
  dados.removerEm("tarefas", "t1");
  const fila = JSON.parse(localStorage.getItem("impresilk.sync.fila:conta:admin-ficticio:ADMIN_RH")!);
  expect(fila[0].tipo).toBe("delete"); expect(fila[0].baseVersao).toBe(4);
});

it("o usuário seguinte não recebe a fila de envios do anterior", async () => {
  const { dados, sync, sessao } = await preparar();
  dados.criarEm("tarefas", { id: "t1", titulo: "A" }); expect(sync.pendentesSync()).toBe(1);
  sessao.entrar("COLABORADOR", "pessoa-ficticia"); expect(sync.pendentesSync()).toBe(0);
});

it("uma recusa dentro de HTTP 200 mantém a alteração pendente", async () => {
  const { dados, sync } = await preparar();
  dados.criarEm("tarefas", { id: "t1", titulo: "A" });
  vi.stubGlobal("fetch", vi.fn(async () => resposta({ ok: false, erro: "Gravação recusada" })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await sync.trySync(); expect(sync.pendentesSync()).toBe(1);
});

it("resposta da sessão anterior não altera os dados de quem entrou depois", async () => {
  const { dados, sync, sessao } = await preparar();
  let entregar!: (r: Response) => void;
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const { action } = JSON.parse(String(options?.body));
    return action === "rev" ? resposta({ rev: 2, porColecao: { pagamentos: 2 } })
      : new Promise<Response>(resolve => { entregar = resolve; });
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const puxando = sync.pull();
  for (let i = 0; i < 20 && !entregar; i++) await Promise.resolve();
  expect(entregar).toBeTypeOf("function");
  sessao.entrar("COLABORADOR", "pessoa-ficticia");
  entregar(resposta({ registros: [{ colecao: "pagamentos", registro: { id: "p1", valor: 123 } }], nextAfter: null }));
  await puxando; expect(dados.obter("pagamentos")).toHaveLength(0);
});

it("uma falha de leitura não anuncia sincronização concluída", async () => {
  const { sync } = await preparar();
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ erro: "Leitura indisponível" }), { status: 500 })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await expect(sync.sincronizarAgora()).rejects.toThrow();
  await sync.trySync();
  expect(sync.statusSync()).toBe("erro");
});

it("limpeza recusada pela nuvem preserva os dados e a fila locais", async () => {
  const { dados, sync } = await preparar();
  dados.criarEm("tarefas", { id: "t1", titulo: "Preservar" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ erro: "Indisponível" }), { status: 500 })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const r = await sync.apagarColecoes(["tarefas"]);
  expect(r[0].erroNuvem).toBe(true);
  expect(dados.obter("tarefas")).toHaveLength(1);
  expect(sync.pendentesSync()).toBe(1);
});

it("resposta com cursor repetido preserva o retrato local e informa erro", async () => {
  const { dados, sync } = await preparar();
  dados.aplicarSemSync(() => dados.definirColecao("tarefas", [{ id: "t1", titulo: "Preservar", colaboradorId: "ana" }] as any));
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => JSON.parse(String(options?.body)).action === "rev"
    ? resposta({ rev: 2, porColecao: { tarefas: 2 } }) : resposta({ registros: [], nextAfter: "tarefas::repetido" })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await sync.pull();
  expect(sync.statusSync()).toBe("erro");
  expect(dados.obter("tarefas")).toHaveLength(1);
});

it("resolver um conflito reenvia com a versão recebida e uma nova identificação", async () => {
  const { dados, sync } = await preparar();
  dados.aplicarSemSync(() => dados.definirColecaoDinamica("tarefas", [{ id: "t1", titulo: "Local", _rhRev: 1 }]));
  dados.atualizarEm("tarefas", "t1", { titulo: "Meu ajuste" });
  const enviados: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const pedido = JSON.parse(String(options?.body)); enviados.push(pedido);
    return enviados.length === 1 ? resposta({ conflito: true, servidor: { colecao: "tarefas", registro: { id: "t1", titulo: "Outro ajuste", _rhRev: 4 } } }) : resposta({ ok: true, versao: 5 });
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await sync.trySync(); expect(sync.conflitosSync()).toHaveLength(1);
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  sync.sobrescreverServidor("tarefas", "t1");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await sync.trySync();
  expect(enviados[1].baseVersao).toBe(4);
  expect(enviados[1].mutationId).toBeTypeOf("string");
  expect(enviados[1].mutationId).not.toBe(enviados[0].mutationId);
  expect(enviados[1].registro.titulo).toBe("Meu ajuste");
  expect(sync.pendentesSync()).toBe(0);
});

it("escolher versão local não restaura silenciosamente um registro arquivado", async () => {
  const { dados, sync } = await preparar();
  dados.criarEm("tarefas", { id: "t1", titulo: "Local" });
  vi.stubGlobal("fetch", vi.fn(async () => resposta({ conflito: true, servidor: { colecao: "tarefas", registro: { id: "t1", _apagado: true, _rhRev: 2 } } })));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  await sync.trySync();
  expect(() => sync.sobrescreverServidor("tarefas", "t1")).toThrow(/arquivad/i);
  expect(sync.conflitosSync()).toHaveLength(1);
  expect(dados.obter("tarefas")[0].titulo).toBe("Local");
});

it("a limpeza de duas coleções é confirmada numa única transação", async () => {
  const { dados, sync } = await preparar();
  dados.criarEm("tarefas", { id: "t1", titulo: "A" });
  dados.criarEm("documentos", { id: "d1", nome: "B" });
  const pedidos: any[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_url, options) => {
    const p = JSON.parse(String(options?.body)); pedidos.push(p);
    if (p.action === "rev") return resposta({ rev: 7 });
    if (p.action === "resumo") return resposta({ contagem: { tarefas: 1, documentos: 1 } });
    return resposta({ ok: true, copia: 123 });
  }));
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  const r = await sync.apagarColecoes(["tarefas", "documentos"]);
  expect(pedidos.filter(p => !["rev", "resumo"].includes(p.action))).toEqual([{ action: "aplicarRetrato", dados: { tarefas: [], documentos: [] }, rev: 7, substituir: true }]);
  expect(r.map(x => x.apagadosNuvem)).toEqual([1, 1]);
  expect(dados.obter("tarefas")).toHaveLength(0); expect(dados.obter("documentos")).toHaveLength(0);
  expect(sync.pendentesSync()).toBe(0);
});
