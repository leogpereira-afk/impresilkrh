// OS IDS ANTERIORES DA PESSOA (auditoria de 12/10/2026, P1).
// O caso: a ficha teve o CPF corrigido e o admin trocou o ID (op `trocar`). O
// histórico mascara os dois valores, nada guardava o ID antigo e a régua só
// conferia os cadastros vivos: o ID antigo ficava LIVRE, e a ficha nova cujo
// CPF começasse por ele o recebia em silêncio (no PCP, a pessoa das O.S.
// antigas). A prova do auditor virou estes testes, contra a régua compartilhada
// e contra o handler REAL da function sync (src/test/servidorRh.ts).
// Todos os CPFs, IDs e nomes são FICTÍCIOS (o repositório é público).
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";
import { AVISO_CENTRAL_ID_NOVO, anterioresDe, idParaCadastro, idsAnteriores, juntarAnteriores } from "../../supabase/functions/_shared/idPessoa";

const CPF_A_CORRIGIDO = "987.654.321-00"; // ID do CPF de hoje: 987654
const CPF_OUTRO_123456 = "123.456.111-54"; // OUTRA pessoa cujo CPF começa por 123456 (o ID antigo)
const CPF_B = "654.321.987-46";           // ID 654321
const CPF_C = "111.222.333-96";           // ID 111222

const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Fictícia ${id}`, statusId: "ativo", ...extra });
const contrato = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Prestador Fictício ${id}`, funcao: "Montador", situacao: "ativo", contratoFim: "2099-12-31", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3, ...extra });
const lapide = (colecao: string, registro: Record<string, unknown>) => ({ colecao, id: registro.id, apagado: true, rh_versao: 7, registro: { ...registro, _apagado: true } });
const gravacoes = (s: ReturnType<typeof servidorRh>, colecao?: string) =>
  s.rpcs.filter((x) => x.nome === "rh_gravar_seguro" && (!colecao || x.args.p_colecao === colecao));
const ANTERIOR = [{ idPessoa: "123456", em: "2026-10-12T20:16:00.000Z", por: "admin-ficticio", como: "troca" }];
// A ficha 1 depois da troca: CPF corrigido, ID novo, o antigo guardado.
const trocada = (extra: Record<string, unknown> = {}) => ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "987654", idPessoaAnteriores: ANTERIOR, ...extra });
const MOTIVO = "CPF digitado errado no cadastro";

describe("a troca guarda o ID que sai", () => {
  it("o ID antigo vai para os IDs anteriores (com a data, sem o motivo), o histórico não o mostra e a troca avisa da Central", async () => {
    const rows = [linha("colaboradores", ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }))];
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "admin-ficticio", rows });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "987654", motivo: "estava errado" });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toContain(AVISO_CENTRAL_ID_NOVO);
    expect(r.body.aviso).toContain("Painel › Sistemas › Pessoas");
    const gravada = gravacoes(s, "colaboradores")[0].args.p_registro;
    expect(gravada.idPessoa).toBe("987654");
    expect(gravada.idPessoaAnteriores).toEqual([{ idPessoa: "123456", em: expect.any(String), por: "admin-ficticio", como: "troca" }]);
    expect(JSON.stringify(gravada.idPessoaAnteriores)).not.toContain("estava errado");
    const hist = gravacoes(s, "alteracoes")[0].args.p_registro;
    expect(hist.mudancas).toEqual([{ campo: "ID da pessoa", de: "•••", para: "•••" }]);
    expect(JSON.stringify(hist)).not.toContain("123456");
    expect(JSON.stringify(r.body)).not.toContain("—");
  });
  it("trocar de novo junta na lista (cada ID uma vez) e o contrato vivo do mesmo CPF recebe a mesma lista, sem o ID de hoje dele", async () => {
    const rows = [
      linha("colaboradores", trocada()),
      linha("freelancers", contrato("c1", { cpf: CPF_A_CORRIGIDO, idPessoa: "987654" })),
    ];
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "admin-ficticio", rows });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "222333", motivo: MOTIVO });
    expect(r.status).toBe(200);
    const lista = idsAnteriores(gravacoes(s, "colaboradores")[0].args.p_registro);
    expect(lista).toEqual(["123456", "987654"]);
    const doContrato = gravacoes(s, "freelancers")[0].args;
    expect(doContrato).toMatchObject({ p_id: "c1", p_versao: 3 });
    expect(doContrato.p_registro.idPessoa).toBe("987654"); // o ID do contrato não muda sozinho
    expect(idsAnteriores(doContrato.p_registro)).toEqual(["123456"]); // e a lista dele não traz o ID de hoje dele
  });
  it("contrato de freelancer não fala da Central (a conta da Central é da ficha)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("freelancers", contrato("c1", { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }))] });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "freelancers", id: "c1", idPessoa: "987654", motivo: MOTIVO });
    expect(r.status).toBe(200);
    expect(r.body.aviso ?? "").not.toContain("Central");
    expect(idsAnteriores(gravacoes(s, "freelancers")[0].args.p_registro)).toEqual(["123456"]);
  });
});

describe("o ID anterior de outra pessoa não é dado a ninguém", () => {
  it("régua: ficha nova cujo CPF começa pelo ID anterior da ficha 1 fica sem ID (a prova do auditor, agora fechada)", () => {
    const vivos = [{ colecao: "colaboradores", id: "f1", registro: trocada() }];
    const d = idParaCadastro({ colecao: "colaboradores", id: "f2", registro: ficha("f2", { cpf: CPF_OUTRO_123456 }) }, vivos);
    expect(d).toMatchObject({ idPessoa: "", motivo: "id-de-outra-pessoa", outro: { id: "f1", anterior: true } });
  });
  it("porta de dados: a ficha nova grava sem o ID, com o aviso de ID de outra pessoa, e nunca 4xx (vem da fila)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_OUTRO_123456 }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(r.body.idPessoa).toBeUndefined();
    expect(r.body.aviso).toMatch(/sem o ID da pessoa: o ID do CPF já foi de outra pessoa/);
    expect(gravacoes(s, "colaboradores")[0].args.p_registro).not.toHaveProperty("idPessoa");
  });
  it("vale também para a lápide: a pessoa apagada continua dona dos IDs anteriores dela", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_OUTRO_123456 }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toContain("já foi de outra pessoa");
    expect(gravacoes(s, "colaboradores")[0].args.p_registro).not.toHaveProperty("idPessoa");
  });
  it("a mesma pessoa (mesmo CPF) num contrato novo herda o ID de hoje e a lista", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato("c1", { cpf: CPF_A_CORRIGIDO }), baseVersao: 0 });
    expect(r.status).toBe(200);
    const p = gravacoes(s, "freelancers")[0].args.p_registro;
    expect(p.idPessoa).toBe("987654");
    expect(idsAnteriores(p)).toEqual(["123456"]);
  });
  it("o preencher (fichas antigas) e a prévia também recusam", async () => {
    const rows = [linha("colaboradores", trocada()), linha("colaboradores", ficha("f2", { cpf: CPF_OUTRO_123456 }))];
    const s = servidorRh({ perfil: "ADMIN_RH", rows });
    const previa = await s.call({ action: "idPessoa", op: "previa" });
    const item = (previa.body.itens as { id: string; idPessoa: string; motivo: string }[]).find((i) => i.id === "f2")!;
    expect(item).toMatchObject({ idPessoa: "", motivo: expect.stringContaining("já foi de outra pessoa") });
    const r = await s.call({ action: "idPessoa", op: "preencher", itens: [{ colecao: "colaboradores", id: "f2", idPessoa: "123456" }] });
    expect(r.body.gravados).toBe(0);
    // Nenhum ID; só a marca de bloqueio (revisão do 80e7d8f).
    const escritas = gravacoes(s, "colaboradores");
    expect(escritas).toHaveLength(1);
    expect(escritas[0].args.p_registro).not.toHaveProperty("idPessoa");
    expect(escritas[0].args.p_registro.idPessoaBloqueado).toBe("id-de-outra-pessoa");
  });
  it("o trocar recusa dar a alguém o ID anterior de outra pessoa (viva ou lápide)", async () => {
    for (const dona of [linha("colaboradores", trocada()), lapide("colaboradores", trocada())]) {
      const s = servidorRh({ perfil: "ADMIN_RH", rows: [dona, linha("colaboradores", ficha("f2", { cpf: CPF_B, idPessoa: "654321" }))] });
      const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f2", idPessoa: "123456", motivo: MOTIVO });
      expect(r.status).toBe(409);
      expect(r.body.erro).toContain("já foi de outra pessoa");
      expect(gravacoes(s)).toHaveLength(0);
    }
  });
  it("a própria pessoa pode voltar a um ID anterior dela, e ele sai da lista (a lista nunca traz o ID de hoje)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "123456", motivo: "A troca anterior foi engano" });
    expect(r.status).toBe(200);
    const p = gravacoes(s, "colaboradores")[0].args.p_registro;
    expect(p.idPessoa).toBe("123456");
    expect(idsAnteriores(p)).toEqual(["987654"]);
  });
});

/* VERIFICAÇÃO INDEPENDENTE DO CONSERTO (12/10/2026): a lápide da PRÓPRIA
   linha e o ID de hoje de quem saiu. Casos T1, T2, T2b e T11 do verificador,
   caso ruim primeiro. */
describe("a lápide da própria linha ocupada por outra pessoa: o ID e a lista de quem saiu nunca se perdem", () => {
  const CPF_X2 = "123.456.333-54"; // mais uma pessoa cujo CPF começa por 123456
  const naLinha = (s: ReturnType<typeof servidorRh>, id: string) => gravacoes(s).find((x) => x.args.p_id === id)?.args;
  it("T1 upsert: outro CPF que começa pelo ID anterior da lápide grava SEM ID, com aviso, e a lápide vai inteira para a linha de arquivo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_OUTRO_123456 }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toContain("já foi de outra pessoa");
    const nova = naLinha(s, "f1")!.p_registro;
    expect(nova).not.toHaveProperty("idPessoa");
    expect(nova).not.toHaveProperty("idPessoaAnteriores"); // a pessoa nova não herda a lista de quem saiu
    const arq = naLinha(s, "f1.saiu-v7")!;
    expect(arq).toMatchObject({ p_versao: 0, p_registro: { id: "f1.saiu-v7", arquivadaDe: "f1", _apagado: true, cpf: CPF_A_CORRIGIDO, idPessoa: "987654", idPessoaAnteriores: ANTERIOR } });
    // A linha de arquivo é gravada ANTES da linha da pessoa nova.
    expect(gravacoes(s).findIndex((x) => x.args.p_id === "f1.saiu-v7")).toBeLessThan(gravacoes(s).findIndex((x) => x.args.p_id === "f1"));
  });
  it("T1b o ID de hoje da lápide da própria linha também não passa para o outro CPF", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("f1", { cpf: CPF_OUTRO_123456, idPessoa: "123456" }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_X2 }), baseVersao: 0 });
    expect(r.body.aviso).toContain("já foi de outra pessoa");
    expect(naLinha(s, "f1")!.p_registro).not.toHaveProperty("idPessoa");
    expect(naLinha(s, "f1.saiu-v7")!.p_registro).toMatchObject({ idPessoa: "123456", cpf: CPF_OUTRO_123456 });
  });
  it("T2 retrato: o item que ocupa a lápide com outro CPF entra sem ID e sem lista, e a lápide entra inteira na linha de arquivo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("f1", { cpf: CPF_OUTRO_123456, idPessoaAnteriores: ANTERIOR })] } });
    const itens = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores;
    expect(itens[0]).not.toHaveProperty("idPessoa");
    expect(itens[0]).not.toHaveProperty("idPessoaAnteriores");
    expect(itens[1]).toMatchObject({ id: "f1.saiu-v7", _apagado: true, idPessoa: "987654", idPessoaAnteriores: ANTERIOR, cpf: CPF_A_CORRIGIDO });
  });
  it("T2b depois do retrato, a prévia não oferece à pessoa nova o ID de quem saiu", async () => {
    const arquivo = { ...trocada(), id: "f1.saiu-v7", arquivadaDe: "f1" };
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_OUTRO_123456 })), lapide("colaboradores", arquivo)] });
    const previa = await s.call({ action: "idPessoa", op: "previa" });
    const item = (previa.body.itens as { id: string; idPessoa: string; motivo: string }[]).find((i) => i.id === "f1")!;
    expect(item.idPessoa).toBe("");
    expect(item.motivo).toContain("já foi de outra pessoa");
    const r = await s.call({ action: "idPessoa", op: "preencher", itens: [{ colecao: "colaboradores", id: "f1", idPessoa: "123456" }] });
    expect(r.body.gravados).toBe(0);
  });
  it("a mesma pessoa (mesmo CPF) volta à lápide com o ID e a lista, sem linha de arquivo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A_CORRIGIDO }), baseVersao: 0 });
    expect(gravacoes(s)).toHaveLength(1);
    expect(naLinha(s, "f1")!.p_registro).toMatchObject({ idPessoa: "987654", idPessoaAnteriores: ANTERIOR });
  });
  it("lápide sobre lápide no retrato não apaga o ID nem a lista", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", trocada())] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [{ id: "f1", _apagado: true }] } });
    const itens = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores;
    expect(itens).toHaveLength(1);
    expect(itens[0]).toMatchObject({ idPessoa: "987654", idPessoaAnteriores: ANTERIOR });
  });
});

describe("o ID de HOJE de quem saiu (lápide de outra linha) é de outra pessoa", () => {
  const CPF_X2 = "123.456.333-54";
  const saiu = () => lapide("colaboradores", ficha("z9", { cpf: CPF_OUTRO_123456, idPessoa: "123456" }));
  it("T11 upsert: ficha nova com outro CPF de mesmo começo não recebe o ID de quem saiu", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [saiu(), linha("colaboradores", ficha("f3", { cpf: "123.456.222-00", idPessoa: "999999" }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f4", { cpf: CPF_X2 }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toContain("já foi de outra pessoa");
    expect(gravacoes(s, "colaboradores")[0].args.p_registro).not.toHaveProperty("idPessoa");
  });
  it("a mesma pessoa (mesmo CPF da lápide) numa ficha nova recebe o ID dela de volta", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [saiu()] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f4", { cpf: CPF_OUTRO_123456 }), baseVersao: 0 });
    expect(r.body.idPessoa).toBe("123456");
  });
  it("preencher, trocar e registrar recusam o ID de hoje de quem saiu", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [saiu(), linha("colaboradores", ficha("f4", { cpf: CPF_X2 })), linha("colaboradores", ficha("f5", { cpf: CPF_B, idPessoa: "654321" }))] });
    const previa = await s.call({ action: "idPessoa", op: "previa" });
    expect((previa.body.itens as { id: string; idPessoa: string }[]).find((i) => i.id === "f4")!.idPessoa).toBe("");
    expect((await s.call({ action: "idPessoa", op: "preencher", itens: [{ colecao: "colaboradores", id: "f4", idPessoa: "123456" }] })).body.gravados).toBe(0);
    // Nenhum ID; f4 só ganha a marca de bloqueio (revisão do 80e7d8f).
    expect(gravacoes(s, "colaboradores").map((g) => [g.args.p_id, g.args.p_registro.idPessoa, g.args.p_registro.idPessoaBloqueado])).toEqual([["f4", undefined, "id-de-outra-pessoa"]]);
    // Sem a ficha f4 (que também usaria o 123456 pelo CPF), quem recusa é a lápide.
    const s2 = servidorRh({ perfil: "ADMIN_RH", rows: [saiu(), linha("colaboradores", ficha("f5", { cpf: CPF_B, idPessoa: "654321" }))] });
    const t = await s2.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f5", idPessoa: "123456", motivo: MOTIVO });
    expect(t.status).toBe(409);
    expect(t.body.erro).toContain("já foi de outra pessoa");
    expect(t.body.erro).toContain("cadastro apagado");
    const g = await s2.call({ action: "idPessoa", op: "registrarAnterior", colecao: "colaboradores", id: "f5", idPessoa: "123456", motivo: MOTIVO });
    expect(g.status).toBe(409);
    expect(gravacoes(s2)).toHaveLength(0);
  });
  it("retrato: o item que revive a lápide com o mesmo CPF não leva o ID dela se ele for o ID de hoje de outra pessoa que saiu", async () => {
    const outraQueSaiu = lapide("colaboradores", ficha("z8", { cpf: CPF_C, idPessoa: "987654" }));
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide("colaboradores", ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "987654" })), outraQueSaiu] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("f1", { cpf: CPF_A_CORRIGIDO })] } });
    expect(s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores[0]).not.toHaveProperty("idPessoa");
  });
});

describe("só o servidor escreve a lista: envio sem o campo não apaga, envio com outra lista não entra", () => {
  it("edição comum da ficha (aparelho com a cópia de antes, sem o campo) mantém a lista gravada", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A_CORRIGIDO, nome: "Nome Novo Fictício" }), baseVersao: 3 });
    expect(r.status).toBe(200);
    const p = gravacoes(s)[0].args.p_registro;
    expect(p).toMatchObject({ nome: "Nome Novo Fictício", idPessoa: "987654", idPessoaAnteriores: ANTERIOR });
  });
  it("lista vazia ou forjada no envio é ignorada; ficha nova não traz lista própria", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: trocada({ idPessoaAnteriores: [] }), baseVersao: 3 });
    await s.call({ action: "upsert", colecao: "colaboradores", registro: trocada({ idPessoaAnteriores: [{ idPessoa: "111111", em: "", como: "troca" }] }), baseVersao: 3 });
    for (const g of gravacoes(s)) expect(g.args.p_registro.idPessoaAnteriores).toEqual(ANTERIOR);
    const nova = servidorRh({ perfil: "ADMIN_RH" });
    await nova.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f5", { cpf: CPF_C, idPessoaAnteriores: ["654321"] }), baseVersao: 0 });
    expect(gravacoes(nova)[0].args.p_registro).not.toHaveProperty("idPessoaAnteriores");
  });
  it("cadastro antigo sem ID que tem lista (contrato irmão) também a mantém", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("freelancers", contrato("c1", { cpf: CPF_A_CORRIGIDO, idPessoaAnteriores: ANTERIOR }))] });
    await s.call({ action: "upsert", colecao: "freelancers", registro: contrato("c1", { cpf: CPF_A_CORRIGIDO, funcao: "Instalador" }), baseVersao: 3 });
    expect(gravacoes(s, "freelancers")[0].args.p_registro.idPessoaAnteriores).toEqual(ANTERIOR);
  });
  it("a importação de retrato leva a lista do banco", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("f1", { cpf: CPF_A_CORRIGIDO })] } });
    expect(s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores[0]).toMatchObject({ idPessoa: "987654", idPessoaAnteriores: ANTERIOR });
  });
});

describe("quem recebe os IDs anteriores: a mesma régua do CPF", () => {
  const rows = [
    linha("colaboradores", trocada({ gestorId: "chefe" })),
    linha("colaboradores", ficha("bia", { cpf: CPF_B, idPessoa: "654321", gestorId: "chefe" })),
    linha("colaboradores", ficha("chefe", { cpf: CPF_C, idPessoa: "111222" })),
  ];
  const lista = async (perfil: string, pessoa: string) => {
    const s = servidorRh({ perfil, pessoa, rows });
    const r = await s.call({ action: "list", colecoes: ["colaboradores"] });
    return new Map((r.body.registros as { registro: Record<string, unknown> }[]).map((e) => [e.registro.id, e.registro]));
  };
  it("o colega e o gestor não recebem; a própria pessoa e o RH recebem", async () => {
    expect((await lista("COLABORADOR", "bia")).get("f1")).not.toHaveProperty("idPessoaAnteriores");
    expect((await lista("GESTOR", "chefe")).get("f1")).not.toHaveProperty("idPessoaAnteriores");
    expect((await lista("COLABORADOR", "f1")).get("f1")?.idPessoaAnteriores).toEqual(ANTERIOR);
    expect((await lista("ADMIN_RH", "chefe")).get("f1")?.idPessoaAnteriores).toEqual(ANTERIOR);
  });
});

describe("registrar o ID anterior de uma troca antiga (o caso real, pela tela)", () => {
  // A ficha teve o ID trocado antes deste campo existir: hoje só tem o ID novo.
  const semAnterior = () => linha("colaboradores", ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "987654" }));
  const registrar = (s: ReturnType<typeof servidorRh>, extra: Record<string, unknown> = {}) =>
    s.call({ action: "idPessoa", op: "registrarAnterior", colecao: "colaboradores", id: "f1", idPessoa: "123456", motivo: MOTIVO, ...extra });
  it("só o admin registra", async () => {
    for (const perfil of ["GESTOR", "COLABORADOR"]) {
      const s = servidorRh({ perfil, pessoa: "f1", rows: [semAnterior()] });
      expect((await registrar(s)).status).toBe(403);
      expect(gravacoes(s)).toHaveLength(0);
    }
  });
  it("grava com o carimbo do servidor, copia para o contrato do mesmo CPF e deixa a linha no histórico sem os valores", async () => {
    const rows = [semAnterior(), linha("freelancers", contrato("c1", { cpf: CPF_A_CORRIGIDO, idPessoa: "987654" }))];
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "admin-ficticio", rows });
    const r = await registrar(s);
    expect(r.status).toBe(200);
    expect(r.body.idPessoaAnteriores).toEqual(["123456"]);
    const p = gravacoes(s, "colaboradores")[0].args;
    expect(p).toMatchObject({ p_id: "f1", p_versao: 3, p_registro: { idPessoa: "987654", idPessoaAnteriores: [{ idPessoa: "123456", em: expect.any(String), por: "admin-ficticio", como: "registro" }] } });
    expect(idsAnteriores(gravacoes(s, "freelancers")[0].args.p_registro)).toEqual(["123456"]);
    const hist = gravacoes(s, "alteracoes")[0].args.p_registro;
    expect(hist).toMatchObject({ acao: "ALTEROU", registroId: "f1", mudancas: [{ campo: "IDs anteriores da pessoa", de: "•••", para: "•••" }] });
    expect(hist.detalhe).toContain(MOTIVO);
    expect(JSON.stringify(hist)).not.toContain("123456");
    expect(JSON.stringify(hist)).not.toContain("987654");
    // Depois do registro, a ficha nova com CPF que começa por 123456 fica sem ID.
    const depois = idParaCadastro({ colecao: "colaboradores", id: "f2", registro: ficha("f2", { cpf: CPF_OUTRO_123456 }) }, [{ colecao: "colaboradores", id: "f1", registro: p.p_registro }]);
    expect(depois).toMatchObject({ idPessoa: "", motivo: "id-de-outra-pessoa" });
  });
  it("recusa o que a régua recusa: motivo curto, ID fora do formato, o ID de hoje, repetido, e o ID que é ou foi de outra pessoa", async () => {
    const base = servidorRh({ perfil: "ADMIN_RH", rows: [semAnterior()] });
    expect((await registrar(base, { motivo: "curto" })).status).toBe(400);
    expect((await registrar(base, { idPessoa: "12345" })).status).toBe(400);
    expect((await registrar(base, { idPessoa: "987654" })).status).toBe(409);
    const repetido = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", trocada())] });
    expect((await registrar(repetido)).status).toBe(409);
    // Alguém já ganhou o ID antigo (ficha nova com CPF que começa por ele, sem ID gravado ainda).
    const tomado = servidorRh({ perfil: "ADMIN_RH", rows: [semAnterior(), linha("colaboradores", ficha("f2", { cpf: CPF_OUTRO_123456 }))] });
    const r = await registrar(tomado);
    expect(r.status).toBe(409);
    expect(r.body.erro).toContain("já é de outra pessoa");
    const deOutraLapide = servidorRh({ perfil: "ADMIN_RH", rows: [semAnterior(), lapide("colaboradores", ficha("f7", { cpf: CPF_B, idPessoa: "654321", idPessoaAnteriores: ANTERIOR }))] });
    expect((await registrar(deOutraLapide)).status).toBe(409);
    const semIdHoje = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_A_CORRIGIDO }))] });
    expect((await registrar(semIdHoje)).status).toBe(409);
    for (const s of [base, repetido, tomado, deOutraLapide, semIdHoje]) expect(gravacoes(s)).toHaveLength(0);
  });
});

describe("a lista em si", () => {
  it("lê só entradas de 6 dígitos, aceita o texto puro e junta sem repetir, ficando a mais antiga", () => {
    expect(idsAnteriores({ idPessoaAnteriores: ["123456", { idPessoa: "12345" }, { idPessoa: 654321 }, "x"] })).toEqual(["123456"]);
    expect(anterioresDe({ idPessoaAnteriores: "123456" })).toEqual([]);
    const junta = juntarAnteriores(
      [{ idPessoa: "123456", em: "2026-10-12T00:00:00.000Z", como: "troca" }],
      [{ idPessoa: "123456", em: "2026-10-01T00:00:00.000Z", como: "registro" }, { idPessoa: "222333", em: "2026-10-05T00:00:00.000Z", como: "troca" }],
    );
    expect(junta).toEqual([
      { idPessoa: "123456", em: "2026-10-01T00:00:00.000Z", como: "registro" },
      { idPessoa: "222333", em: "2026-10-05T00:00:00.000Z", como: "troca" },
    ]);
  });
});
