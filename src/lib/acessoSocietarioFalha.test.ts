/* A01: dados fictícios. Falha só na consulta do mapa; demais tabelas respondem. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { servidorRh } from "@/test/servidorRh";
import { MASTER_COLAB_ID } from "./rbac";

const conta = { id: "conta-ficticia", codigo: "8.8", nome: "Conta Fictícia", valor: 123 };
const rows = [
  { id: true, config: { vinculosSocioConta: { "8.8|conta ficticia": "socio-ficticio" } } },
  { colecao: "planoContas", id: conta.id, registro: conta, apagado: false },
  { colecao: "areas", id: "area-ficticia", registro: { id: "area-ficticia", nome: "Área Fictícia" } },
];
afterEach(() => vi.restoreAllMocks());

describe("A01: indisponibilidade do mapa não abre a conta societária", () => {
  it("recusa o plano com 503 se o mapa falhar, inclusive quando a consulta mistura coleções", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const normal = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows });
    expect((await normal.call({ action: "list", colecoes: ["planoContas"] })).body.registros).toEqual([]);
    const falha = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows, erroConsulta: ["config_global"] });
    for (const colecoes of [["planoContas"], ["areas", "planoContas"], undefined]) {
      const r = await falha.call({ action: "list", colecoes });
      expect(r.status).toBe(503);
      expect(r.body.erro).toMatch(/vínculos societários/);
      expect(r.body.registros).toBeUndefined();
      expect(JSON.stringify(r.body)).not.toContain(conta.nome);
    }
  });

  it("mantém coleções independentes disponíveis quando só o mapa falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows, erroConsulta: ["config_global"] });
    const r = await s.call({ action: "list", colecoes: ["areas"] });
    expect(r.status).toBe(200);
    expect(r.body.registros).toEqual([{ colecao: "areas", registro: { id: "area-ficticia", nome: "Área Fictícia" } }]);
  });

  it("mapa legitimamente vazio permite conta comum e o master não depende dessa consulta", async () => {
    const vazio = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows: rows.slice(1) });
    const r = await vazio.call({ action: "list", colecoes: ["planoContas"] });
    expect(r.status).toBe(200);
    expect(r.body.registros[0].registro).toEqual(conta);
    const master = servidorRh({ perfil: "ADMIN_RH", pessoa: MASTER_COLAB_ID, rows, erroConsulta: ["config_global"] });
    const m = await master.call({ action: "list", colecoes: ["planoContas"] });
    expect(m.status).toBe(200);
    expect(m.body.registros[0].registro).toEqual(conta);
  });

  it("não devolve conta desconhecida no conflito de uma gravação enquanto o mapa falha", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "rh-ficticio", rows, erroConsulta: ["config_global"],
      rpcResposta: () => ({ conflito: true, servidor: { colecao: "planoContas", registro: conta } }),
    });
    const r = await s.call({ action: "upsert", colecao: "planoContas", registro: { id: conta.id, codigo: "8.9" } });
    expect(r.status).toBe(403);
    expect(r.body.servidor).toBeUndefined();
    expect(s.rpcs).toEqual([]);
  });
});
