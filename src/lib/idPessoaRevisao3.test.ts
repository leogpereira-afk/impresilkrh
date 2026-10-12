// TERCEIRA REVISÃO (do 3bd2741, 12/10/2026): a prova T1 do revisor, trazida
// para o ramo (caso ruim primeiro), e os testes do conserto. CPFs, IDs e nomes FICTÍCIOS.
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";

const CPF_X = "123.456.111-54", CPF_X2 = "123.456.777-00", CPF_X3 = "123.456.888-00", CPF_Y = "555.666.111-00";
const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Ficticia ${id}`, statusId: "ativo", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3 });
const naLinha = (s: ReturnType<typeof servidorRh>, id: string) => s.rpcs.find((x) => x.nome === "rh_gravar_seguro" && x.args.p_id === id)?.args;

describe("T1: cadastro antigo (ID so pelo CPF) tem o CPF corrigido pela ficha: o ID que o PCP usava fica livre", () => {
  it("upsert: o ID do CPF antigo nao fica guardado e vai para outra pessoa", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X })), linha("colaboradores", ficha("f2", { cpf: CPF_X2, idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_Y }), baseVersao: 3 });
    const g1 = naLinha(s, "g1")!.p_registro;
    expect.soft(JSON.stringify(g1)).toContain("123456"); // falha: nem idPessoa nem anteriores
    // Depois: a pessoa nova de mesmo comeco recebe o ID das O.S. antigas de g1.
    const t = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", g1), linha("colaboradores", ficha("f2", { cpf: CPF_X2, idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    const r = await t.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f3", { cpf: CPF_X3 }), baseVersao: 0 });
    expect(r.body.idPessoa).toBeUndefined(); // falha: "123456"
  });
  it("retrato: o mesmo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X }))] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("g1", { cpf: CPF_Y })] } });
    const itens = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores as Record<string, unknown>[];
    expect(JSON.stringify(itens[0])).toContain("123456"); // falha
  });
});

describe("o conserto: CPF corrigido em cadastro sem ID gravado (D-004)", () => {
  it("o ID que valia fica gravado, com o carimbo do servidor", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_Y }), baseVersao: 3 });
    expect(r.body.idPessoa).toBe("123456");
    expect(naLinha(s, "g1")!.p_registro).toMatchObject({ cpf: CPF_Y, idPessoa: "123456", idPessoaEm: expect.any(String) });
  });
  it("o ID que valia é de outra pessoa: fica sem ID, com a marca, e o ID vai para os anteriores dele; nunca 4xx", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X })), linha("colaboradores", ficha("h1", { cpf: CPF_X2, idPessoa: "123456" }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_Y }), baseVersao: 3 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toContain("outra pessoa");
    const g1 = naLinha(s, "g1")!.p_registro;
    expect(g1).not.toHaveProperty("idPessoa");
    expect(g1.idPessoaBloqueado).toBe("id-de-outra-pessoa");
    expect((g1.idPessoaAnteriores as { idPessoa: string }[]).map((a) => a.idPessoa)).toEqual(["123456"]);
  });
  it("o mesmo CPF (ou o mesmo começo) não grava nada: espera o botão do admin, como antes", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_X }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_X, nome: "Outro Nome Ficticio" }), baseVersao: 3 });
    expect(naLinha(s, "g1")!.p_registro).not.toHaveProperty("idPessoa");
  });
  it("o contrato do mesmo CPF antigo (a mesma pessoa, ainda sem corrigir) não conta como outra pessoa", async () => {
    const CPF_V = "123.456.789-09"; // fictício com os verificadores certos
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("g1", { cpf: CPF_V })), linha("freelancers", { id: "c1", nome: "Prestador Ficticio", cpf: CPF_V, situacao: "ativo" })] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g1", { cpf: CPF_Y }), baseVersao: 3 });
    expect(r.body.idPessoa).toBe("123456");
  });
});

describe("o contrato de freelancer: a lápide segura o ID do CPF pela régua do PCP (idDoCadastroRH)", () => {
  const CPF_V = "987.654.321-00";   // fictício, confere
  const CPF_INV = "987.654.999-11"; // fictício, não confere
  it("contrato apagado com CPF que não confere não segura nada (o PCP também não dava ID a ele)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [{ colecao: "freelancers", id: "c1", apagado: true, rh_versao: 7, registro: { id: "c1", nome: "Prestador Ficticio", cpf: CPF_INV, _apagado: true } }] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f5", { cpf: "987.654.555-00" }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("987654");
  });
  it("contrato apagado com CPF que confere segura o ID do CPF dele", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [{ colecao: "freelancers", id: "c1", apagado: true, rh_versao: 7, registro: { id: "c1", nome: "Prestador Ficticio", cpf: CPF_V, _apagado: true } }] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f5", { cpf: "987.654.555-00" }), baseVersao: 0 });
    expect(r.body.idPessoa).toBeUndefined();
    expect(naLinha(s, "f5")!.p_registro.idPessoaBloqueado).toBe("id-de-outra-pessoa");
  });
});
