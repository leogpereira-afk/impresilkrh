// VERIFICAÇÃO da correção da lápide (12/10/2026), dados fictícios: o carimbo da pessoa apagada não
// passa a outra pessoa, e o retrato segue a mesma régua do upsert. Caso ruim primeiro.
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";

const CPF_A = "123.456.789-09";            // ID 123456
const CPF_OUTRO_123456 = "123.456.111-54"; // outra pessoa, mesmo começo
const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Fictícia ${id}`, statusId: "ativo", ...extra });
const contrato = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Prestador Fictício ${id}`, funcao: "Montador", situacao: "ativo", contratoFim: "2099-12-31", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3, ...extra });
const lapide = (colecao: string, registro: Record<string, unknown>) => ({ colecao, id: registro.id, apagado: true, rh_versao: 7, registro: { ...registro, _apagado: true } });
const grav = (s: ReturnType<typeof servidorRh>, colecao?: string) => s.rpcs.filter((x) => x.nome === "rh_gravar_seguro" && (!colecao || x.args.p_colecao === colecao));
const carimbo = { idPessoa: "123456", idPessoaEm: "2026-10-12T12:00:00.000Z", idPessoaPor: "admin-ficticio", idPessoaMotivo: "Gravado pelo botão do admin (cadastros antigos)" };
const retratoDe = (s: ReturnType<typeof servidorRh>) => s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados;


describe("ID da pessoa: carimbo e retrato depois da lápide", () => {
  it("outro CPF com o mesmo começo ganha o ID do CPF dele, sem o carimbo (quem, quando, motivo) da pessoa apagada", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("f1", { cpf: CPF_A, ...carimbo }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", baseVersao: 0, registro: ficha("f1", { cpf: CPF_OUTRO_123456 }) });
    expect(r.status).toBe(200);
    const p = grav(s)[0].args.p_registro;
    expect(p.idPessoa).toBe("123456");
    expect(p.idPessoaPor).toBeUndefined();
    expect(p.idPessoaMotivo).toBeUndefined();
    expect(p.idPessoaEm).not.toBe(carimbo.idPessoaEm);
  });
  it("o mesmo CPF da lápide volta com o carimbo de antes", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("f1", { cpf: CPF_A, ...carimbo }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", baseVersao: 0, registro: ficha("f1", { cpf: CPF_A }) });
    expect(grav(s)[0].args.p_registro).toMatchObject(carimbo);
  });
  it("retrato: lápide do mesmo CPF com um contrato vivo desse CPF com outro ID entra sem ID, como no upsert", async () => {
    const rows = [lapide("colaboradores", ficha("f1", { cpf: CPF_A, ...carimbo })), linha("freelancers", contrato("c9", { cpf: CPF_A, idPessoa: "555555" }))];
    const up = servidorRh({ perfil: "ADMIN_RH", rows });
    await up.call({ action: "upsert", colecao: "colaboradores", baseVersao: 0, registro: ficha("f1", { cpf: CPF_A }) });
    expect(grav(up)[0].args.p_registro.idPessoa).toBeUndefined();
    const rt = servidorRh({ perfil: "ADMIN_RH", rows });
    await rt.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("f1", { cpf: CPF_A })] } });
    expect(retratoDe(rt).colaboradores[0].idPessoa).toBeUndefined();
  });
});
