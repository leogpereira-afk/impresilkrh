// REVISÃO INDEPENDENTE DO 80e7d8f (12/10/2026): as provas R1a a R5 do revisor,
// trazidas como estão (caso ruim primeiro), e os testes do conserto.
// CPFs, IDs e nomes FICTÍCIOS (o repositório é público).
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";
import { idQueVale } from "../../supabase/functions/_shared/idPessoa";
import { mapaPessoasPorId } from "../../supabase/functions/_shared/programacao";
import { projetarOrdem } from "../../supabase/functions/_shared/performanceOS";
import { acharPorIdNoTexto, mapaDeIds } from "./identidade";
import { conferirComMubisys } from "./conferenciaMubiRh";
import { lacoEntre } from "./cadastrosDuplicados";

const CPF_A = "987.654.321-00";
const CPF_X = "123.456.111-54";
const CPF_X2 = "123.456.777-00";
const CPF_X3 = "123.456.888-00";
const CPF_B = "654.321.987-46";
const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Ficticia ${id}`, statusId: "ativo", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3 });
const lapide = (colecao: string, registro: Record<string, unknown>, versao = 7) => ({ colecao, id: registro.id, apagado: true, rh_versao: versao, registro: { ...registro, _apagado: true } });
const naLinha = (s: ReturnType<typeof servidorRh>, id: string) => s.rpcs.find((x) => x.nome === "rh_gravar_seguro" && x.args.p_id === id)?.args;
const ANT = [{ idPessoa: "123456", em: "2026-10-12T20:16:00.000Z", por: "admin-ficticio", como: "troca" }];
const trocada = () => ficha("f1", { cpf: CPF_A, idPessoa: "987654", idPessoaAnteriores: ANT });
const MOTIVO = "Voltou com o CPF corrigido no cadastro";

describe("R1: ficha viva sem ID e sem marca (gravada antes do 80e7d8f) continua sem marca", () => {
  it("editar a ficha bloqueada no 0f3ef4d nao poe a marca: o ID do CPF (de outra pessoa) continua valendo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_X }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_X, nome: "Outro Nome Ficticio" }), baseVersao: 3 });
    const p = naLinha(s, "f2")!.p_registro;
    expect(idQueVale("colaboradores", p)).toBe(""); // falha: "123456", o ID anterior de f1
    expect(p.idPessoaBloqueado).toBe("id-de-outra-pessoa");
  });
  it("ficha viva sem ID troca o CPF para um que comeca pelo ID de outra pessoa: sem marca", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_B }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_X }), baseVersao: 3 });
    // Terceira revisão (D-004): o CPF corrigido não muda o ID. O ID que valia (o do
    // CPF antigo, 654321) fica gravado; o 123456 (anterior de f1) não é dado a f2.
    expect(naLinha(s, "f2")!.p_registro).toMatchObject({ idPessoa: "654321", cpf: CPF_X });
    expect(naLinha(s, "f2")!.p_registro).not.toHaveProperty("idPessoaBloqueado");
  });
});

describe("R2: devolverId aceita cadastro que nao tem a marca e ja tem o proprio ID", () => {
  it("outra pessoa (outro CPF, ID proprio) na linha recebe o ID de quem saiu", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [
      linha("colaboradores", ficha("f1", { cpf: CPF_B, idPessoa: "654321" })),
      lapide("colaboradores", { ...trocada(), id: "f1.saiu-v7", arquivadaDe: "f1" }, 1),
    ] });
    const r = await s.call({ action: "idPessoa", op: "devolverId", colecao: "colaboradores", id: "f1", idPessoa: "987654", motivo: MOTIVO, mesmaPessoa: true });
    expect(r.status).toBe(409); // falha: 200, f1 passa a ser 987654 e 654321 vira anterior
  });
});

describe("R3: lapide sem ID gravado (saiu antes do ID gravado) nao entra na regua", () => {
  it("pessoa nova com o mesmo comeco de CPF de quem saiu recebe o ID dela", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("g1", { cpf: CPF_X }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g3", { cpf: CPF_X3 }), baseVersao: 0 });
    expect(r.body.idPessoa).toBeUndefined(); // falha: "123456"
  });
  it("a marca tira de g2 a protecao incidental que ele dava ao ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("g1", { cpf: CPF_X })), linha("colaboradores", ficha("g2", { cpf: CPF_X2, idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g3", { cpf: CPF_X3 }), baseVersao: 0 });
    expect(r.body.idPessoa).toBeUndefined(); // falha: "123456"
  });
});

describe("R4: casamento de pagamento do ERP calcula pelo CPF, sem a marca e sem o gravado", () => {
  it("titulo com 'ID 123456' (de quem saiu) casa com a ficha marcada", () => {
    const f2 = { ...ficha("f2", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }) } as never;
    expect(acharPorIdNoTexto("Rescisao ID 123456", mapaDeIds([f2]))).toBeNull(); // falha: f2
  });
  it("ficha com ID gravado diferente do CPF nao casa pelo gravado", () => {
    const f1 = { ...trocada(), cpf: CPF_X, idPessoa: "987654" } as never;
    expect(acharPorIdNoTexto("Adiantamento ID 987654", mapaDeIds([f1]))).not.toBeNull(); // falha: null
  });
});

describe("R5 (documenta): ficha marcada some da bonificacao sem aviso", () => {
  it("O.S. com o ID do CPF da ficha marcada nao tem participante do RH nem aviso", () => {
    const porId = mapaPessoasPorId([{ id: "f2", registro: ficha("f2", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }) }]);
    const os = projetarOrdem({ id: "os1", equipe: ["123456"], instalacao: {} }, "2026-10-12", porId);
    expect(os).not.toHaveProperty("participantesRH");
    expect(os.equipe).toEqual(["123456"]);
  });
});

describe("o conserto da revisão: o resto do caminho", () => {
  const gravacoes = (s: ReturnType<typeof servidorRh>) => s.rpcs.filter((x) => x.nome === "rh_gravar_seguro");
  it("o preencher grava a marca em quem a régua bloqueia (sem ID), com a mesma confirmação", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_X })), linha("colaboradores", ficha("f3", { cpf: CPF_B }))] });
    const previa = await s.call({ action: "idPessoa", op: "previa" });
    const f2 = (previa.body.itens as { id: string; bloqueio: string | null; marcado: boolean }[]).find((i) => i.id === "f2")!;
    expect(f2).toMatchObject({ bloqueio: "id-de-outra-pessoa", marcado: false });
    const r = await s.call({ action: "idPessoa", op: "preencher", itens: [{ colecao: "colaboradores", id: "f3", idPessoa: "654321" }] });
    expect(r.body).toMatchObject({ gravados: 1, marcados: 1 });
    expect(naLinha(s, "f2")!.p_registro).toMatchObject({ idPessoaBloqueado: "id-de-outra-pessoa" });
    expect(naLinha(s, "f2")!.p_registro).not.toHaveProperty("idPessoa");
    // Só marcar (nenhum ID a gravar) também vale.
    const so = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_X }))] });
    expect((await so.call({ action: "idPessoa", op: "preencher", itens: [] })).body.marcados).toBe(1);
  });
  it("ficha marcada cujo CPF foi corrigido para um livre: a marca fica até o admin dar o ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_B }), baseVersao: 3 });
    expect(naLinha(s, "f2")!.p_registro).toMatchObject({ cpf: CPF_B, idPessoaBloqueado: "id-de-outra-pessoa" });
    expect(naLinha(s, "f2")!.p_registro).not.toHaveProperty("idPessoa");
  });
  it("devolverId recusa quem não está marcado, mesmo sem ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [
      linha("colaboradores", ficha("f1", { cpf: CPF_B })),
      lapide("colaboradores", { ...trocada(), id: "f1.saiu-v7", arquivadaDe: "f1" }, 1),
    ] });
    const r = await s.call({ action: "idPessoa", op: "devolverId", colecao: "colaboradores", id: "f1", idPessoa: "987654", motivo: MOTIVO, mesmaPessoa: true });
    expect(r.status).toBe(409);
    expect(gravacoes(s)).toHaveLength(0);
  });
  it("arquivosDaLinha: só o admin; nome, CPF mascarado e o ID de quem estava na linha (também quem saiu antes do ID gravado)", async () => {
    const rows = [
      linha("colaboradores", ficha("f1", { cpf: CPF_X2, idPessoaBloqueado: "id-de-outra-pessoa" })),
      lapide("colaboradores", { ...ficha("f1", { cpf: CPF_X }), id: "f1.saiu-v7", arquivadaDe: "f1" }, 1),
      lapide("colaboradores", { ...trocada(), id: "f8.saiu-v2", arquivadaDe: "f8" }, 1),
    ];
    expect((await servidorRh({ perfil: "GESTOR", rows }).call({ action: "idPessoa", op: "arquivosDaLinha", colecao: "colaboradores", id: "f1" })).status).toBe(403);
    const r = await servidorRh({ perfil: "ADMIN_RH", rows }).call({ action: "idPessoa", op: "arquivosDaLinha", colecao: "colaboradores", id: "f1" });
    expect(r.body.itens).toEqual([{ id: "f1.saiu-v7", nome: "Pessoa Ficticia f1", cpf: "123.456.***-54", idPessoa: "123456", devolvido: false, saiuEm: "" }]);
    expect(JSON.stringify(r.body)).not.toContain("111");
    // E a devolução aceita o ID do CPF de quem saiu antes do ID gravado.
    const s = servidorRh({ perfil: "ADMIN_RH", rows });
    const d = await s.call({ action: "idPessoa", op: "devolverId", colecao: "colaboradores", id: "f1", idPessoa: "123456", motivo: MOTIVO, mesmaPessoa: true });
    expect(d.status).toBe(409); // 123456 também é ID anterior de f8 (outra linha): nunca de outra pessoa
    expect(d.body.erro).toContain("já foi de outra pessoa");
    // Sem a f8, a devolução do ID do CPF de quem saiu antes do ID gravado passa.
    const ok = servidorRh({ perfil: "ADMIN_RH", rows: rows.slice(0, 2) });
    const d2 = await ok.call({ action: "idPessoa", op: "devolverId", colecao: "colaboradores", id: "f1", idPessoa: "123456", motivo: MOTIVO, mesmaPessoa: true });
    expect(d2.status).toBe(200);
    expect(naLinha(ok, "f1")!.p_registro).toMatchObject({ idPessoa: "123456", cpf: CPF_X2 });
    expect(naLinha(ok, "f1")!.p_registro).not.toHaveProperty("idPessoaBloqueado");
    expect(naLinha(ok, "f1.saiu-v7")!.p_registro).toMatchObject({ devolvidoA: "f1" });
  });
  it("lápide sem ID gravado: a mesma pessoa (mesmo CPF) volta e recebe o ID dela (D3 continua)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("g1", { cpf: CPF_X }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("g9", { cpf: CPF_X }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("123456");
  });
  it("a ficha marcada não segura o ID contra a dona dele: quem saiu volta com o mesmo CPF e recebe o ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("p1", { cpf: CPF_A, idPessoa: "987654" })), linha("colaboradores", ficha("q1", { cpf: "987.654.555-00", idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("p2", { cpf: CPF_A }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("987654");
    // e o trocar devolve à dona um ID anterior dela, mesmo com a ficha marcada no caminho
    const t = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    expect((await t.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "123456", motivo: MOTIVO })).status).toBe(200);
  });
  it("pagamento do ERP: os IDs anteriores e o CPF inteiro casam com a mesma pessoa; dois números da mesma pessoa não confundem", () => {
    const f1 = { ...trocada(), cpf: CPF_X } as never;
    const ids = mapaDeIds([f1]);
    expect(acharPorIdNoTexto("Acerto ID 123456", ids)).toBe(f1);
    expect(acharPorIdNoTexto(`Recibo ${CPF_X}`, ids)).toBe(f1);
    expect(acharPorIdNoTexto("Valores 987654 e 123456", ids)).toBe(f1);
  });
  it("conferência com o Mubisys: CPF inteiro primeiro; a ficha marcada não casa pelo começo do CPF de outra pessoa", () => {
    const leitura = { linhas: [{ nome: "Outra Pessoa Ficticia", cpf: "123.456.999-00" }] } as never;
    const c = conferirComMubisys([{ id: "f2", nome: "Pessoa Ficticia f2", cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }], leitura);
    expect(c.pares).toHaveLength(0);
    const c2 = conferirComMubisys([{ id: "f1", nome: "Pessoa Ficticia f1", cpf: CPF_X, idPessoa: "987654" }], { linhas: [{ nome: "Nome Diferente Ficticio", cpf: "987.654.321-00" }] } as never);
    expect(c2.pares[0]).toMatchObject({ casadoPor: "id" });
  });
  it("cadastros duplicados: a ficha marcada não vira 'mesmo ID' de quem tem o começo do CPF dela", () => {
    expect(lacoEntre({ id: "a", nome: "Ana Ficticia", cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }, { id: "b", nome: "Bia Ficticia", cpf: CPF_X2 })).toBeNull();
  });
});
