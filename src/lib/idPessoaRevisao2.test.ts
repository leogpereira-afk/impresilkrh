// SEGUNDA REVISÃO DO 36a7427 (12/10/2026): as provas S1 a S3 do revisor,
// trazidas para o ramo (caso ruim primeiro). CPFs, IDs e nomes FICTÍCIOS.
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";
import { conferirComMubisys } from "./conferenciaMubiRh";

const CPF_X = "123.456.111-54";   // dono por direito do 123456 (sem ID gravado)
const CPF_X2 = "123.456.777-00";  // outra pessoa, mesmo começo
const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Ficticia ${id}`, statusId: "ativo", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3 });
const lapide = (colecao: string, registro: Record<string, unknown>, versao = 7) => ({ colecao, id: registro.id, apagado: true, rh_versao: versao, registro: { ...registro, _apagado: true } });
const naLinha = (s: ReturnType<typeof servidorRh>, id: string) => s.rpcs.find((x) => x.nome === "rh_gravar_seguro" && x.args.p_id === id)?.args;
const marcada = () => linha("colaboradores", ficha("f2", { cpf: CPF_X2, idPessoaBloqueado: "id-de-outra-pessoa" }));

describe("S1: a ficha marcada segura o ID do CPF contra o dono por direito sem ID gravado", () => {
  it("a ficha viva antiga do dono (sem ID gravado) ganha a marca ao ser editada", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X })), marcada()] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_X, telefone: "0000" }), baseVersao: 3 });
    expect(naLinha(s, "g1")!.p_registro).not.toHaveProperty("idPessoaBloqueado"); // falha: "id-de-outra-pessoa"
  });
  it("o preencher deixa o dono sem o proprio ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X })), marcada()] });
    const r = await s.call({ action: "idPessoa", op: "previa" });
    const g1 = (r.body.itens as { id: string; idPessoa: string }[]).find((i) => i.id === "g1")!;
    expect(g1.idPessoa).toBe("123456"); // falha: ""
  });
  it("o dono que saiu antes do ID gravado volta em outra linha e fica sem o proprio ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("g1", { cpf: CPF_X })), marcada()] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g9", { cpf: CPF_X }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("123456"); // falha: undefined, marcado
  });
  it("o mesmo dono revive a propria linha e fica sem o proprio ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("g1", { cpf: CPF_X })), marcada()] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_X }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("123456"); // falha
  });
  it("o trocar tambem recusa dar ao dono o ID do CPF dele", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X })), marcada()] });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "g1", idPessoa: "123456", motivo: "O ID do CPF e dele desde a admissao" });
    expect(r.status).toBe(200); // falha: 409
  });
});

describe("S2: conferencia com o Mubisys pelo ID anterior", () => {
  it("CPF do Mubisys com o comeco de F2 (marcada) casa com F1, que teve esse ID", () => {
    const f1 = { id: "f1", nome: "Pessoa Um", cpf: "987.654.321-00", idPessoa: "987654", idPessoaAnteriores: [{ idPessoa: "123456", em: "2026-10-01T00:00:00.000Z", como: "troca" }] };
    const f2 = { id: "f2", nome: "Pessoa Dois", cpf: CPF_X2, idPessoaBloqueado: "id-de-outra-pessoa" };
    const c = conferirComMubisys([f1, f2] as never, { linhas: [{ nome: "Pessoa Dois", cpf: "123.456.999-99" }] } as never);
    // O 123456 é anterior de f1 e começo do CPF de f2: não decide. Casa pelo nome
    // com f2, e f1 não vira par (o JSON inteiro traz f1 na lista "só no RH").
    expect(c.pares.map((p) => p.ficha.id)).toEqual(["f2"]);
    expect(c.pares[0].casadoPor).toBe("nome");
  });
});

describe("S3: trocar em cadastro sem ID gravado nao guarda o ID do CPF que o PCP usava", () => {
  it("o ID do CPF vai para os anteriores", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X }))] });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "g1", idPessoa: "999999", motivo: "CPF digitado errado no cadastro" });
    expect(r.status).toBe(200);
    const ant = (naLinha(s, "g1")!.p_registro.idPessoaAnteriores ?? []) as { idPessoa: string }[];
    expect(ant.map((a) => a.idPessoa)).toContain("123456"); // falha: []
  });
});
