import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";

const linha = (colecao: string, id: string, registro: Record<string, unknown> = {}) => ({ colecao, id, registro: { id, ...registro }, apagado: false });

describe("permissões efetivas da função RH", () => {
  it("colaborador não apaga dados financeiros nem documentos de colegas", async () => {
    for (const col of ["planoContas", "documentos", "avaliacoes", "pontos"]) {
      const s = servidorRh({ rows: [linha(col, "outro", { colaboradorId: "bia" })] });
      expect((await s.call({ action: "delete", colecao: col, id: "outro" })).status, col).toBe(403);
      expect(s.escritas).toHaveLength(0); expect(s.arquivos).toHaveLength(0);
    }
  });
  it("colaborador não cria ou altera o próprio pagamento", async () => {
    const s = servidorRh();
    expect((await s.call({ action: "upsert", colecao: "pagamentos", registro: { id: "p1", colaboradorId: "ana", valor: 100 } })).status).toBe(403);
    expect(s.escritas).toHaveLength(0);
  });
  it("mudar o dono no envio não toma o registro de outra pessoa", async () => {
    const s = servidorRh({ rows: [linha("aceites", "a1", { colaboradorId: "bia" })] });
    expect((await s.call({ action: "upsert", colecao: "aceites", registro: { id: "a1", colaboradorId: "ana" } })).status).toBe(403);
    expect(s.escritas).toHaveLength(0);
  });
  it("a autoria de um histórico não pode ser forjada usando o alvo como próprio", async () => {
    const s = servidorRh();
    expect((await s.call({ action: "upsert", colecao: "acessos", registro: { id: "log1", usuarioColaboradorId: "bia", colaboradorId: "ana" } })).status).toBe(403);
  });
  it("documento pessoal não pode ser baixado ou substituído por colega", async () => {
    const s = servidorRh({ rows: [linha("documentos", "d1", { colaboradorId: "bia" })] });
    expect((await s.call({ action: "getPhoto", id: "doc:d1" })).status).toBe(403);
    expect((await s.call({ action: "putPhoto", id: "doc:d1", dataUrl: "data:application/pdf;base64,ZmFrZQ==" })).status).toBe(403);
    expect(s.arquivos).toHaveLength(0);
  });
  it("colaborador consulta o próprio documento e material institucional", async () => {
    const s = servidorRh({ rows: [linha("documentos", "d1", { colaboradorId: "ana" }), linha("repositorio", "r1")] });
    expect((await s.call({ action: "getPhoto", id: "doc:d1" })).status).toBe(200);
    expect((await s.call({ action: "getPhoto", id: "doc:r1" })).status).toBe(200);
  });
  it("leitura indisponível não parece configuração ou revisão vazia", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", erroConsulta: true });
    for (const action of ["getCfg", "rev"]) expect((await s.call({ action })).status).toBe(500);
  });
  it("gestor não consulta avaliações fora da sua hierarquia", async () => {
    const s = servidorRh({ perfil: "GESTOR", rows: [
      linha("colaboradores", "ana"), linha("colaboradores", "bia", { gestorId: "ana" }), linha("colaboradores", "caio", { gestorId: "outro-gestor" }),
      linha("avaliacoes", "av1", { colaboradorId: "bia" }), linha("avaliacoes", "av2", { colaboradorId: "caio" }),
    ] });
    const r = await s.call({ action: "list", colecoes: ["avaliacoes"] });
    expect(r.status).toBe(200); expect(r.body.registros.map((x: any) => x.registro.id)).toEqual(["av1"]);
  });
  it("o organograma recebe só os campos profissionais dos colegas", async () => {
    const s = servidorRh({ rows: [linha("colaboradores", "bia", { nome: "Bia fictícia", salario: 1000, cpf: "ficticio", email: "ficticio", riscoSaida: "alto", humor: "triste", dataNascimento: "1990-01-01", cargoId: "cargo" })] });
    const r = await s.call({ action: "list", colecoes: ["colaboradores"] });
    expect(r.body.registros[0].registro).toEqual({ id: "bia", nome: "Bia fictícia", cargoId: "cargo", statusId: "ativo" });
  });
  it("edição e exclusão autorizadas passam a revisão e a autoria ao banco", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("tarefas", "t1")] });
    expect((await s.call({ action: "upsert", colecao: "tarefas", registro: { id: "t1", titulo: "Fictício" }, baseVersao: 1, mutationId: "m1" })).status).toBe(200);
    expect((await s.call({ action: "delete", colecao: "tarefas", id: "t1", baseVersao: 2, mutationId: "m2" })).status).toBe(200);
    expect(s.rpcs.map(x => [x.nome, x.args.p_versao, x.args.p_mutacao, x.args.p_apagar])).toEqual([["rh_gravar_seguro", 1, "auth-ficticio:m1", false], ["rh_gravar_seguro", 2, "auth-ficticio:m2", true]]);
    expect(s.escritas).toHaveLength(0); expect(s.arquivos).toHaveLength(0);
  });
  it("paginação adulterada e coleção desconhecida são recusadas", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    expect((await s.call({ action: "list", after: "tarefas::x),colecao.neq.x" })).status).toBe(400);
    expect((await s.call({ action: "upsert", colecao: "outra_base", registro: { id: "x" } })).status).toBe(400);
    expect(s.rpcs).toHaveLength(0);
  });
});
