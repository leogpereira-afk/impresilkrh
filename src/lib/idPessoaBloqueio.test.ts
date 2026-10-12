// A MARCA DE BLOQUEIO, A DEVOLUÇÃO DO ID E A LINHA DE ARQUIVO (verificação
// independente do 0f3ef4d, 12/10/2026; casos V1, V5, V6 e V7b do verificador
// e D1 a D4 da sessão principal). Testes pelo caso ruim, contra a régua
// compartilhada e contra o handler REAL da function sync (src/test/servidorRh.ts).
// Todos os CPFs, IDs e nomes são FICTÍCIOS (o repositório é público).
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";
import { idBloqueado, idQueVale, idsAnteriores } from "../../supabase/functions/_shared/idPessoa";
import { idDaFicha, mapaPessoasPorId } from "../../supabase/functions/_shared/programacao";
import { idDaPessoa } from "./identidade";

const CPF_A = "987.654.321-00";  // ID 987654
const CPF_A2 = "987.654.999-11"; // o mesmo começo: a MESMA pessoa com o CPF corrigido nos últimos dígitos
const CPF_X = "123.456.111-54";  // ID 123456
const CPF_B = "654.321.987-46";  // ID 654321
const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Fictícia ${id}`, statusId: "ativo", ...extra });
const contrato = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Prestador Fictício ${id}`, funcao: "Montador", situacao: "ativo", contratoFim: "2099-12-31", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3 });
const lapide = (colecao: string, registro: Record<string, unknown>, versao = 7) => ({ colecao, id: registro.id, apagado: true, rh_versao: versao, registro: { ...registro, _apagado: true } });
const gravacoes = (s: ReturnType<typeof servidorRh>, colecao?: string) =>
  s.rpcs.filter((x) => x.nome === "rh_gravar_seguro" && (!colecao || x.args.p_colecao === colecao));
const naLinha = (s: ReturnType<typeof servidorRh>, id: string) => gravacoes(s).find((x) => x.args.p_id === id)?.args;
const ANT = [{ idPessoa: "123456", em: "2026-10-12T20:16:00.000Z", por: "admin-ficticio", como: "troca" }];
const trocada = () => ficha("f1", { cpf: CPF_A, idPessoa: "987654", idPessoaAnteriores: ANT });
const arquivoDe = (registro: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  lapide("colaboradores", { ...registro, id: `${String(registro.id)}.saiu-v7`, arquivadaDe: registro.id, ...extra }, 1);
const MOTIVO = "Voltou com o CPF corrigido no cadastro";

describe("D1: cadastro sem ID por decisão da régua leva a marca idPessoaBloqueado (o PCP não calcula pelo CPF)", () => {
  it("ficha nova cujo CPF começa pelo ID anterior de outra pessoa: sem ID e com a marca \"id-de-outra-pessoa\"", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_X }), baseVersao: 0 });
    expect(r.status).toBe(200);
    const p = naLinha(s, "f2")!.p_registro;
    expect(p).not.toHaveProperty("idPessoa");
    expect(p.idPessoaBloqueado).toBe("id-de-outra-pessoa");
    // Quem calcula pelo CPF não calcula para ele: a tela, rh-programacao e rh-performance.
    expect(idQueVale("colaboradores", p)).toBe("");
    expect(idDaPessoa(p)).toBeNull();
    expect(idDaFicha(p.idPessoa, p.cpf, p.idPessoaBloqueado)).toBe("");
    expect(mapaPessoasPorId([{ id: "f2", registro: p }]).size).toBe(0);
  });
  it("o mesmo CPF com IDs diferentes em outros cadastros: a marca \"mesmo-cpf-com-ids-diferentes\"", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_B, idPessoa: "654321" })), linha("freelancers", contrato("c1", { cpf: CPF_B, idPessoa: "222333" }))] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_B }), baseVersao: 0 });
    expect(naLinha(s, "f2")!.p_registro.idPessoaBloqueado).toBe("mesmo-cpf-com-ids-diferentes");
  });
  it("sem CPF não há marca (não há o que calcular), e cadastro que ganha ID nasce sem marca mesmo se o envio a forjar", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f3"), baseVersao: 0 });
    expect(naLinha(s, "f3")!.p_registro).not.toHaveProperty("idPessoaBloqueado");
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f4", { cpf: CPF_B, idPessoaBloqueado: "id-de-outra-pessoa" }), baseVersao: 0 });
    expect(naLinha(s, "f4")!.p_registro).toMatchObject({ idPessoa: "654321" });
    expect(naLinha(s, "f4")!.p_registro).not.toHaveProperty("idPessoaBloqueado");
  });
  it("só o servidor escreve: envio sem o campo mantém a marca; envio que tenta tirar ou trocar a marca também", async () => {
    const marcada = ficha("f2", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" });
    for (const envio of [ficha("f2", { cpf: CPF_X, nome: "Nome Novo Fictício" }), { ...marcada, idPessoaBloqueado: "" }, { ...marcada, idPessoaBloqueado: "mesmo-cpf-com-ids-diferentes" }]) {
      const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", marcada)] });
      const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: envio, baseVersao: 3 });
      expect(r.status).toBe(200);
      expect(naLinha(s, "f2")!.p_registro.idPessoaBloqueado).toBe("id-de-outra-pessoa");
    }
  });
  it("não é sensível: o gestor da equipe recebe a marca sem o CPF (é só o motivo, sem número)", async () => {
    const s = servidorRh({ perfil: "GESTOR", pessoa: "chefe", rows: [linha("colaboradores", ficha("f2", { cpf: CPF_X, gestorId: "chefe", idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    const r = await s.call({ action: "list", colecoes: ["colaboradores"] });
    const f2 = (r.body.registros as { registro: Record<string, unknown> }[])[0].registro;
    expect(f2.idPessoaBloqueado).toBe("id-de-outra-pessoa");
    expect(f2).not.toHaveProperty("cpf");
  });
  it("a marca some quando o admin dá o ID (trocar e preencher)", async () => {
    const marcada = ficha("f2", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" });
    const t = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", marcada)] });
    expect((await t.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f2", idPessoa: "555666", motivo: MOTIVO })).status).toBe(200);
    expect(naLinha(t, "f2")!.p_registro).toMatchObject({ idPessoa: "555666" });
    expect(naLinha(t, "f2")!.p_registro).not.toHaveProperty("idPessoaBloqueado");
    // A dona do ID saiu do caminho (não há mais conflito): o preencher grava e tira a marca.
    const p = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", marcada)] });
    const r = await p.call({ action: "idPessoa", op: "preencher", itens: [{ colecao: "colaboradores", id: "f2", idPessoa: "123456" }] });
    expect(r.body.gravados).toBe(1);
    expect(naLinha(p, "f2")!.p_registro).not.toHaveProperty("idPessoaBloqueado");
  });
  it("retrato: quem entra sem ID e com o CPF de outra pessoa ganha a marca; a marca do banco fica", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada()), linha("colaboradores", ficha("f3", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" }))] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [trocada(), ficha("f2", { cpf: "123.456.777-00" }), ficha("f3", { cpf: CPF_X }), ficha("f4", { cpf: CPF_B })] } });
    const itens = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores as Record<string, unknown>[];
    const por = new Map(itens.map((i) => [i.id, i]));
    expect(por.get("f2")!.idPessoaBloqueado).toBe("id-de-outra-pessoa");
    expect(por.get("f3")!.idPessoaBloqueado).toBe("id-de-outra-pessoa");
    expect(por.get("f4")).not.toHaveProperty("idPessoaBloqueado");
    expect(por.get("f1")).not.toHaveProperty("idPessoaBloqueado");
  });
});

describe("D2: a mesma pessoa volta na mesma linha com o CPF corrigido (V6): o admin devolve o ID", () => {
  // Depois do upsert: a linha de arquivo com o ID de quem saiu, e a ficha sem ID, marcada.
  const depois = (extra: unknown[] = []) => [
    linha("colaboradores", ficha("f1", { cpf: CPF_A2, idPessoaBloqueado: "id-de-outra-pessoa" })),
    arquivoDe(trocada()),
    ...extra,
  ];
  const devolver = (s: ReturnType<typeof servidorRh>, extra: Record<string, unknown> = {}) =>
    s.call({ action: "idPessoa", op: "devolverId", colecao: "colaboradores", id: "f1", idPessoa: "987654", motivo: MOTIVO, mesmaPessoa: true, ...extra });
  it("o caso: reviver a lápide com o CPF corrigido grava sem ID e com a marca; o trocar recusa o ID dela", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A2 }), baseVersao: 0 });
    expect(r.body.aviso).toContain("já foi de outra pessoa");
    expect(naLinha(s, "f1.saiu-v7")!.p_registro).toMatchObject({ idPessoa: "987654", cpf: CPF_A });
    expect(naLinha(s, "f1")!.p_registro).toMatchObject({ idPessoaBloqueado: "id-de-outra-pessoa" });
    const t = servidorRh({ perfil: "ADMIN_RH", rows: depois() });
    expect((await t.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "987654", motivo: MOTIVO })).status).toBe(409);
  });
  it("devolverId: só o admin, com motivo e com a confirmação de que é a mesma pessoa", async () => {
    const g = servidorRh({ perfil: "GESTOR", rows: depois() });
    expect((await devolver(g)).status).toBe(403);
    const s = servidorRh({ perfil: "ADMIN_RH", rows: depois() });
    expect((await devolver(s, { mesmaPessoa: false })).status).toBe(400);
    expect((await devolver(s, { mesmaPessoa: "sim" })).status).toBe(400);
    expect((await devolver(s, { motivo: "curto" })).status).toBe(400);
    expect(gravacoes(s)).toHaveLength(0);
  });
  it("devolve o ID da linha de arquivo desta linha, com a lista, tira a marca, marca o arquivo e deixa o histórico sem os valores", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "admin-ficticio", rows: depois() });
    const r = await devolver(s);
    expect(r.status).toBe(200);
    expect(r.body.aviso).toContain("Painel › Sistemas › Pessoas");
    const f1 = naLinha(s, "f1")!;
    expect(f1).toMatchObject({ p_versao: 3, p_registro: { idPessoa: "987654", idPessoaPor: "admin-ficticio", idPessoaMotivo: MOTIVO, cpf: CPF_A2 } });
    expect(f1.p_registro).not.toHaveProperty("idPessoaBloqueado");
    expect(idsAnteriores(f1.p_registro)).toEqual(["123456"]);
    const arq = naLinha(s, "f1.saiu-v7")!;
    expect(arq).toMatchObject({ p_versao: 0, p_registro: { _apagado: true, devolvidoA: "f1", idPessoa: "987654", cpf: CPF_A } });
    // O cadastro antes do arquivo: o ID nunca fica livre no meio.
    expect(gravacoes(s).findIndex((x) => x.args.p_id === "f1")).toBeLessThan(gravacoes(s).findIndex((x) => x.args.p_id === "f1.saiu-v7"));
    const hist = gravacoes(s, "alteracoes")[0].args.p_registro;
    expect(hist).toMatchObject({ acao: "ALTEROU", registroId: "f1", mudancas: [{ campo: "ID da pessoa", de: "•••", para: "•••" }] });
    expect(JSON.stringify(hist)).not.toContain("987654");
    expect(JSON.stringify(hist)).not.toContain("123456");
  });
  it("nunca o ID de outra linha: o da lápide de outra ficha e o de outro cadastro vivo são recusados", async () => {
    const outraLapide = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_A2, idPessoaBloqueado: "id-de-outra-pessoa" })), arquivoDe(ficha("f8", { cpf: CPF_A, idPessoa: "987654" }))] });
    const r1 = await devolver(outraLapide);
    expect(r1.status).toBe(409);
    expect(r1.body.erro).toContain("desta linha");
    const outroVivo = servidorRh({ perfil: "ADMIN_RH", rows: depois([linha("colaboradores", ficha("f7", { cpf: CPF_B, idPessoa: "987654" }))]) });
    const r2 = await devolver(outroVivo);
    expect(r2.status).toBe(409);
    expect(r2.body.erro).toContain("já é de outra pessoa");
    for (const s of [outraLapide, outroVivo]) expect(gravacoes(s)).toHaveLength(0);
  });
  it("depois da devolução, outro cadastro novo do mesmo CPF herda o ID (o arquivo devolvido sai da régua) e outra pessoa continua sem ele", async () => {
    const vivaDevolvida = linha("colaboradores", ficha("f1", { cpf: CPF_A2, idPessoa: "987654", idPessoaAnteriores: ANT }));
    const arquivoDevolvido = arquivoDe(trocada(), { devolvidoA: "f1" });
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [vivaDevolvida, arquivoDevolvido] });
    // (ficha, não contrato: o contrato exige CPF com os verificadores certos, e o fictício não tem)
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f6", { cpf: CPF_A2 }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("987654");
    expect(idsAnteriores(naLinha(s, "f6")!.p_registro)).toEqual(["123456"]);
    const o = servidorRh({ perfil: "ADMIN_RH", rows: [vivaDevolvida, arquivoDevolvido] });
    await o.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f5", { cpf: CPF_X }), baseVersao: 0 });
    expect(naLinha(o, "f5")!.p_registro).toMatchObject({ idPessoaBloqueado: "id-de-outra-pessoa" });
  });
});

describe("D3: quem volta em OUTRA linha com o mesmo CPF recebe o ID e a lista da lápide (V5)", () => {
  it("a linha dela foi ocupada: a ficha nova do mesmo CPF recebe o ID e a lista da linha de arquivo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_X, idPessoaBloqueado: "id-de-outra-pessoa" })), arquivoDe(trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f9", { cpf: CPF_A }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("987654");
    expect(idsAnteriores(naLinha(s, "f9")!.p_registro)).toEqual(["123456"]);
  });
  it("o ID trocado de quem saiu volta com ela (não o do CPF), e o do CPF fica na lista", async () => {
    const saiu = lapide("colaboradores", ficha("f1", { cpf: CPF_A, idPessoa: "555666", idPessoaAnteriores: [{ idPessoa: "987654", em: "2026-10-01T00:00:00.000Z", como: "troca" }] }));
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [saiu] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f9", { cpf: CPF_A }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("555666");
    expect(idsAnteriores(naLinha(s, "f9")!.p_registro)).toEqual(["987654"]);
  });
});

describe("D4: o retrato não atrapalha a linha de arquivo (V7b)", () => {
  it("item com o id da linha de arquivo é deixado de fora; a linha de arquivo entra inteira, uma vez só", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("f1", { cpf: CPF_X }), { id: "f1.saiu-v7", _apagado: true }] } });
    const itens = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores as Record<string, unknown>[];
    expect(itens.map((i) => i.id)).toEqual(["f1", "f1.saiu-v7"]);
    expect(itens[1]).toMatchObject({ idPessoa: "987654", cpf: CPF_A, idPessoaAnteriores: ANT, arquivadaDe: "f1", _apagado: true });
  });
  it("com a linha de arquivo já no banco, o item com o id dela não a sobrescreve", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_X })), arquivoDe(trocada())] });
    await s.call({ action: "aplicarRetrato", rev: 1, substituir: true, dados: { colaboradores: [ficha("f1", { cpf: CPF_X }), ficha("f1.saiu-v7", { cpf: CPF_B })] } });
    const itens = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores as Record<string, unknown>[];
    expect(itens.map((i) => i.id)).toEqual(["f1"]);
    expect(idBloqueado(itens[0])).toBe("id-de-outra-pessoa"); // e a ficha da outra pessoa fica marcada
  });
});

describe("V1: outra pessoa ocupa a vaga: a linha de arquivo é gravada primeiro, inteira", () => {
  it("arquivo primeiro, pessoa nova sem ID, sem lista e com a marca", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_X }), baseVersao: 0 });
    expect(r.status).toBe(200);
    const [arq, nova] = gravacoes(s, "colaboradores").map((x) => x.args);
    expect(arq).toMatchObject({ p_id: "f1.saiu-v7", p_versao: 0, p_registro: { _apagado: true, arquivadaDe: "f1", idPessoa: "987654", cpf: CPF_A } });
    expect(nova.p_id).toBe("f1");
    expect(nova.p_registro).not.toHaveProperty("idPessoa");
    expect(nova.p_registro).not.toHaveProperty("idPessoaAnteriores");
    expect(nova.p_registro.idPessoaBloqueado).toBe("id-de-outra-pessoa");
  });
});
