// Todas as pessoas e ações destes testes são fictícias.
import { describe, expect, it } from "vitest";
import type { Colaborador, EventoCalendario } from "@/data/types";
import type { Sessao } from "./session";
import { MODELOS_ENDO } from "@/data/endomarketing";
import { defaultsColecoes } from "@/data";
import { agendaEndo, pessoasEndo, novaAcaoEndo, registrarAcaoEndo, acaoAtrasada, hojeEndo } from "./endomarketing";
import { servidorRh } from "@/test/servidorRh";
const pessoa = (patch: Partial<Colaborador>) => ({ id: "ficticia-a", nome: "Pessoa Fictícia", statusId: "ativo", dataNascimento: "2000-10-15", dataAdmissao: "2020-10-20", ...patch } as Colaborador);
const sessao = (perfil: Sessao["perfil"], colaboradorId = "ficticia-a") => ({ perfil, colaboradorId } as Sessao);

describe("agenda de pessoas", () => {
  it("não publica idade e distingue acolhimento de ano completo", () => {
    const agenda = agendaEndo([pessoa({ dataAdmissao: "2026-10-01" })], [], 2026);
    expect(agenda.find(m => m.tipo === "Acolhimento")?.detalhe).toContain("boas-vindas");
    expect(agenda.some(m => m.tipo === "Tempo de empresa")).toBe(false);
    expect(agenda.find(m => m.tipo === "Aniversário")?.detalhe).not.toMatch(/26|2000/);
    expect(agendaEndo([pessoa({})], [], 2026).find(m => m.tipo === "Tempo de empresa")?.detalhe).toBe("6 anos de empresa");
  });
  it("trata 29/02 sem deslocar março e ignora data inválida", () => {
    const p = pessoa({ dataNascimento: "2000-02-29", dataAdmissao: "2020-02-30" });
    expect(agendaEndo([p], [], 2026)).toMatchObject([{ data: "2026-02-28", detalhe: "Nascimento em 29/02; lembrete em 28/02" }]);
    expect(agendaEndo([p], [], 2028)[0].data).toBe("2028-02-29");
  });
  it("respeita escopo, afastados, desligados e admissão futura", () => {
    const lista = [pessoa({}), pessoa({ id: "ficticia-b", gestorId: "ficticia-a", statusId: "afastado" }), pessoa({ id: "ficticia-c", dataDesligamento: "2026-01-01" }), pessoa({ id: "ficticia-d", dataAdmissao: "2027-01-01" }), pessoa({ id: "ficticia-e" })];
    expect(pessoasEndo(null, lista, "2026-10-15")).toEqual([]);
    expect(pessoasEndo(sessao("GESTOR"), lista, "2026-10-15").map(p => p.id)).toEqual(["ficticia-a", "ficticia-b"]);
    expect(pessoasEndo(sessao("COLABORADOR"), lista, "2026-10-15").map(p => p.id)).toEqual(["ficticia-a"]);
    expect(pessoasEndo(sessao("ADMIN_RH"), lista, "2026-10-15")).toHaveLength(3);
  });
  it("não antecipa aniversário da empresa e respeita eventos recorrentes", () => {
    const eventos = [{ id: "recorrente", data: "2020-10-10", recorrenteAnual: true, tipo: "Comemorativa", titulo: "Evento fictício" }, { id: "unico", data: "2025-10-10", tipo: "Reunião", titulo: "Passado fictício" }] as EventoCalendario[];
    expect(agendaEndo([pessoa({ dataAdmissao: "2027-01-01" })], eventos, 2026)).toHaveLength(1);
    expect(agendaEndo([], eventos, 2026)[0].data).toBe("2026-10-10");
  });
  it("usa o dia local de São Paulo na virada UTC", () => { expect(hojeEndo(new Date("2026-10-16T01:00:00Z"))).toBe("2026-10-15"); });
});
describe("planejamento e histórico", () => {
  it("modelos nunca nascem como registros reais", () => {
    expect(MODELOS_ENDO.length).toBeGreaterThanOrEqual(14);
    expect(defaultsColecoes().endomarketing).toEqual([]);
    expect(novaAcaoEndo(MODELOS_ENDO[0]).checklist.every(i => !i.feito)).toBe(true);
  });
  it("exige só título e registra conclusão e reabertura preservando o checklist", () => {
    expect(() => registrarAcaoEndo(novaAcaoEndo(), undefined, "rh-ficticio")).toThrow("título");
    const criada = registrarAcaoEndo({ ...novaAcaoEndo(MODELOS_ENDO[0]), data: "2026-10-10" }, undefined, "rh-ficticio");
    expect(acaoAtrasada(criada, "2026-10-10")).toBe(false);
    expect(acaoAtrasada(criada, "2026-10-11")).toBe(true);
    const realizada = registrarAcaoEndo({ ...criada, situacao: "Realizada" }, criada, "rh-ficticio", new Date("2026-10-15T12:00:00Z"));
    expect(realizada.concluidaEm).toBe("2026-10-15T12:00:00.000Z");
    expect(acaoAtrasada(realizada, "2026-10-20")).toBe(false);
    const reaberta = registrarAcaoEndo({ ...realizada, situacao: "Planejada" }, realizada, "rh-ficticio");
    expect(reaberta.concluidaEm).toBeUndefined();
    expect(reaberta.historico.map(h => h.texto)).toEqual(["Ação criada · Planejada", "Planejada → Realizada", "Realizada → Planejada"]);
    expect(reaberta.checklist).toEqual(criada.checklist);
  });
});
describe("porta de dados do planejamento", () => {
  const registro = { ...novaAcaoEndo(MODELOS_ENDO[0]), id: "acao-ficticia", observacoes: "NOTA_INTERNA_FICTICIA" };
  const rows = [{ id: registro.id, colecao: "endomarketing", registro, apagado: false }];
  it.each(["COLABORADOR", "GESTOR"])("%s não recebe nem grava planejamento privado", async perfil => {
    const s = servidorRh({ perfil, rows });
    const leitura = await s.call({ action: "list", colecoes: ["endomarketing"] });
    expect(JSON.stringify(leitura.body)).not.toContain("NOTA_INTERNA_FICTICIA");
    const escrita = await s.call({ action: "upsert", colecao: "endomarketing", registro, baseVersao: 0, mutationId: "teste-endo" });
    expect(escrita.status).toBe(403);
    expect(s.rpcs).toEqual([]);
  });
  it("ADMIN_RH lê e enfileira a gravação pela porta existente", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows });
    const leitura = await s.call({ action: "list", colecoes: ["endomarketing"] });
    expect(leitura.status).toBe(200);
    expect(JSON.stringify(leitura.body)).toContain("NOTA_INTERNA_FICTICIA");
    expect((await s.call({ action: "upsert", colecao: "endomarketing", registro, baseVersao: 0, mutationId: "teste-endo" })).status).toBe(200);
    expect(s.rpcs.some(r => r.args.p_colecao === "endomarketing")).toBe(true);
  });
});
