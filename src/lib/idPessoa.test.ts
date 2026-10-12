// O ID DA PESSOA GRAVADO NA FICHA E NO CONTRATO (D-004 do RH, D-015 do PCP).
// Testes pelo caso ruim, contra a régua compartilhada e contra o handler REAL
// da function sync (src/test/servidorRh.ts). Todos os CPFs, IDs e nomes são
// FICTÍCIOS (o repositório é público).
import { describe, expect, it } from "vitest";
import { servidorRh } from "../test/servidorRh";
import {
  AVISO_ID_ANTIGO, AVISO_ID_MANTIDO, idDivergeDoCpf, idGravado, idParaCadastro, idQueVale,
} from "../../supabase/functions/_shared/idPessoa";
import { idDaPessoa } from "./identidade";

// CPFs fictícios com os verificadores certos.
const CPF_A = "123.456.789-09";      // ID 123456
const CPF_A_CORRIGIDO = "987.654.321-00"; // o mesmo cadastro, CPF digitado de novo: ID do CPF seria 987654
const CPF_OUTRO_123456 = "123.456.111-54"; // OUTRA pessoa cujo CPF também começa por 123456
const CPF_B = "654.321.987-46";      // ID 654321
const CPF_C = "111.222.333-96";      // ID 111222

const ficha = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Pessoa Fictícia ${id}`, statusId: "ativo", ...extra });
const contrato = (id: string, extra: Record<string, unknown> = {}) => ({ id, nome: `Prestador Fictício ${id}`, funcao: "Montador", situacao: "ativo", contratoFim: "2099-12-31", ...extra });
const linha = (colecao: string, registro: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({ colecao, id: registro.id, registro, apagado: false, rh_versao: 3, ...extra });
const gravacoes = (s: ReturnType<typeof servidorRh>, colecao?: string) =>
  s.rpcs.filter((x) => x.nome === "rh_gravar_seguro" && (!colecao || x.args.p_colecao === colecao));

describe("a régua do ID (compartilhada pela tela e pela porta de dados)", () => {
  it("cadastro novo recebe os 6 primeiros dígitos do CPF", () => {
    expect(idParaCadastro({ colecao: "colaboradores", id: "f1", registro: ficha("f1", { cpf: CPF_A }) }, [])).toEqual({ idPessoa: "123456" });
  });
  it("contrato do mesmo CPF herda o ID gravado na ficha, mesmo que o CPF de hoje dê outro", () => {
    const fichaCorrigida = { colecao: "colaboradores", id: "f1", registro: ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }) };
    const d = idParaCadastro({ colecao: "freelancers", id: "c1", registro: contrato("c1", { cpf: CPF_A_CORRIGIDO }) }, [fichaCorrigida]);
    expect(d).toEqual({ idPessoa: "123456", herdadoDe: { colecao: "colaboradores", id: "f1" } });
  });
  it("ID que já é de outra pessoa (CPF diferente) não é dado, nem pelo gravado nem pelo do CPF", () => {
    const gravado = { colecao: "colaboradores", id: "f1", registro: ficha("f1", { cpf: CPF_A, idPessoa: "123456" }) };
    const calculado = { colecao: "colaboradores", id: "f1", registro: ficha("f1", { cpf: CPF_A }) };
    for (const outro of [gravado, calculado]) {
      const d = idParaCadastro({ colecao: "colaboradores", id: "f2", registro: ficha("f2", { cpf: CPF_OUTRO_123456 }) }, [outro]);
      expect(d).toMatchObject({ idPessoa: "", motivo: "id-de-outra-pessoa", outro: { id: "f1" } });
    }
  });
  it("sem CPF não há ID; contrato com CPF que não confere também não", () => {
    expect(idParaCadastro({ colecao: "colaboradores", id: "f1", registro: ficha("f1") }, [])).toMatchObject({ idPessoa: "", motivo: "sem-cpf" });
    expect(idParaCadastro({ colecao: "freelancers", id: "c1", registro: contrato("c1", { cpf: "123.456.789-00" }) }, [])).toMatchObject({ idPessoa: "", motivo: "sem-cpf" });
  });
  it("mesmo CPF com IDs gravados diferentes em dois cadastros pede decisão", () => {
    const outros = [
      { colecao: "colaboradores", id: "f1", registro: ficha("f1", { cpf: CPF_A, idPessoa: "123456" }) },
      { colecao: "freelancers", id: "c9", registro: contrato("c9", { cpf: CPF_A, idPessoa: "555555" }) },
    ];
    expect(idParaCadastro({ colecao: "freelancers", id: "c1", registro: contrato("c1", { cpf: CPF_A }) }, outros)).toMatchObject({ idPessoa: "", motivo: "mesmo-cpf-com-ids-diferentes" });
  });
  it("vale o gravado; a marca aparece quando ele não bate com o CPF de hoje, e só com o CPF à vista", () => {
    const corrigida = { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" };
    expect(idQueVale("colaboradores", corrigida)).toBe("123456");
    expect(idDaPessoa(corrigida)).toBe("123456");
    expect(idDivergeDoCpf(corrigida)).toBe(true);
    expect(idDivergeDoCpf({ cpf: CPF_A, idPessoa: "123456" })).toBe(false);
    expect(idDivergeDoCpf({ idPessoa: "123456" })).toBe(false); // CPF podado: não há o que comparar
    expect(idDaPessoa({ cpf: CPF_B })).toBe("654321");           // sem o campo, o do CPF
    expect(idGravado({ idPessoa: "12345" })).toBe("");           // fora do formato não vale
    expect(idGravado({ idPessoa: 123456 })).toBe("");
  });
});

describe("porta de dados: o ID nasce na criação", () => {
  it("ficha nova ganha o ID do CPF, com carimbo do servidor, e a resposta devolve o ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(r.body.idPessoa).toBe("123456");
    const p = gravacoes(s)[0].args.p_registro;
    expect(p.idPessoa).toBe("123456");
    expect(typeof p.idPessoaEm).toBe("string");
  });
  it("contrato novo do mesmo CPF herda o ID da ficha (que teve o CPF corrigido)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }))] });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato("c1", { cpf: CPF_A_CORRIGIDO }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(gravacoes(s, "freelancers")[0].args.p_registro.idPessoa).toBe("123456");
  });
  it("ID de outra pessoa: grava o cadastro SEM o ID, com aviso, e nunca 4xx (a gravação vem da fila)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_A, idPessoa: "123456" }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_OUTRO_123456 }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toMatch(/sem o ID da pessoa/);
    expect(r.body.idPessoa).toBeUndefined();
    expect(gravacoes(s, "colaboradores")[0].args.p_registro).not.toHaveProperty("idPessoa");
  });
  it("ID de outra pessoa que o envio tenta forçar também não entra", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_A }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f2", { cpf: CPF_OUTRO_123456, idPessoa: "123456" }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(gravacoes(s, "colaboradores")[0].args.p_registro).not.toHaveProperty("idPessoa");
  });
  it("cadastro sem CPF nasce sem ID e sem aviso; ganha o ID quando o primeiro CPF chega", async () => {
    const s1 = servidorRh({ perfil: "ADMIN_RH" });
    const r1 = await s1.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1"), baseVersao: 0 });
    expect(r1.status).toBe(200);
    expect(r1.body.aviso).toBeUndefined();
    expect(gravacoes(s1)[0].args.p_registro).not.toHaveProperty("idPessoa");
    const s2 = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1"))] });
    const r2 = await s2.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_B }), baseVersao: 3 });
    expect(r2.status).toBe(200);
    expect(gravacoes(s2)[0].args.p_registro.idPessoa).toBe("654321");
  });
});

describe("porta de dados: o ID gravado não muda", () => {
  const gravada = () => linha("colaboradores", ficha("f1", { cpf: CPF_A, idPessoa: "123456", idPessoaEm: "2026-10-12T12:00:00.000Z", idPessoaMotivo: "Gravado pelo botão do admin (cadastros antigos)" }));
  it("CPF corrigido não muda o ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [gravada()] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }), baseVersao: 3 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBeUndefined();
    const p = gravacoes(s)[0].args.p_registro;
    expect(p.cpf).toBe(CPF_A_CORRIGIDO);
    expect(p.idPessoa).toBe("123456");
  });
  it("envio sem o campo (aparelho com a cópia de antes) não apaga o ID nem o carimbo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [gravada()] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A_CORRIGIDO }), baseVersao: 3 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBeUndefined();
    expect(r.body.idPessoa).toBe("123456");
    const p = gravacoes(s)[0].args.p_registro;
    expect(p).toMatchObject({ idPessoa: "123456", idPessoaEm: "2026-10-12T12:00:00.000Z", idPessoaMotivo: "Gravado pelo botão do admin (cadastros antigos)" });
  });
  it("envio com outro ID é descartado com aviso; o resto grava (nada de 422)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [gravada()] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A, idPessoa: "987654", idPessoaMotivo: "forjado", nome: "Nome Novo Fictício" }), baseVersao: 3 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(AVISO_ID_MANTIDO);
    const p = gravacoes(s)[0].args.p_registro;
    expect(p).toMatchObject({ idPessoa: "123456", nome: "Nome Novo Fictício", idPessoaMotivo: "Gravado pelo botão do admin (cadastros antigos)" });
  });
  it("a lápide guarda o ID, e reviver o cadastro não troca o ID", async () => {
    const lapide = { ...gravada(), apagado: true, registro: { ...gravada().registro, _apagado: true } };
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [lapide] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_B }), baseVersao: 0 });
    expect(r.status).toBe(200);
    expect(gravacoes(s)[0].args.p_registro.idPessoa).toBe("123456");
  });
  it("cadastro antigo (com CPF, sem o campo) não ganha ID numa edição comum: espera o botão do admin", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [linha("colaboradores", ficha("f1", { cpf: CPF_A }))] });
    const r = await s.call({ action: "upsert", colecao: "colaboradores", registro: ficha("f1", { cpf: CPF_A, idPessoa: "123456" }), baseVersao: 3 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(AVISO_ID_ANTIGO);
    expect(gravacoes(s)[0].args.p_registro).not.toHaveProperty("idPessoa");
  });
  it("a importação de retrato leva o ID do banco e não apaga o de ninguém", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [gravada(), linha("colaboradores", ficha("f2", { cpf: CPF_B }))] });
    const r = await s.call({ action: "aplicarRetrato", rev: 1, dados: { colaboradores: [ficha("f1", { cpf: CPF_A }), ficha("f2", { cpf: CPF_B, idPessoa: "654321" }), ficha("f3", { idPessoa: "222222" })] } });
    expect(r.status).toBe(200);
    const enviados = s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")!.args.p_dados.colaboradores;
    expect(enviados[0].idPessoa).toBe("123456");
    expect(enviados[1]).not.toHaveProperty("idPessoa");
    expect(enviados[2]).not.toHaveProperty("idPessoa");
  });
});

describe("quem vê o ID gravado: a mesma régua do CPF", () => {
  const rows = [
    linha("colaboradores", ficha("ana", { cpf: CPF_A, idPessoa: "123456", gestorId: "chefe" })),
    linha("colaboradores", ficha("bia", { cpf: CPF_B, idPessoa: "654321", gestorId: "chefe" })),
    linha("colaboradores", ficha("chefe", { cpf: CPF_C, idPessoa: "111222" })),
  ];
  const lista = async (perfil: string, pessoa: string) => {
    const s = servidorRh({ perfil, pessoa, rows });
    const r = await s.call({ action: "list", colecoes: ["colaboradores"] });
    return new Map((r.body.registros as { registro: Record<string, unknown> }[]).map((e) => [e.registro.id, e.registro]));
  };
  it("a própria pessoa vê o seu; o colega não vê o dela", async () => {
    const m = await lista("COLABORADOR", "ana");
    expect(m.get("ana")?.idPessoa).toBe("123456");
    expect(m.get("bia")).not.toHaveProperty("idPessoa");
  });
  it("o gestor vê a equipe sem o ID (como sem o CPF); o RH vê todos", async () => {
    const g = await lista("GESTOR", "chefe");
    expect(g.get("ana")).not.toHaveProperty("idPessoa");
    expect(g.get("ana")).not.toHaveProperty("cpf");
    const rh = await lista("ADMIN_RH", "chefe");
    expect(rh.get("bia")?.idPessoa).toBe("654321");
  });
});

describe("o botão do admin (prévia, preenchimento e troca)", () => {
  const base = () => [
    linha("colaboradores", ficha("f1", { cpf: CPF_A })),                                   // vai receber 123456
    linha("colaboradores", ficha("f2", { cpf: CPF_B, idPessoa: "654321" })),               // já tem: fica fora
    linha("colaboradores", ficha("f3", { cpf: CPF_C, statusId: "inativo", dataDesligamento: "2026-01-31" })), // desligada também recebe
    linha("freelancers", contrato("c1", { cpf: CPF_B })),                                  // herda 654321 da ficha
    linha("colaboradores", ficha("f4")),                                                    // sem CPF: pede decisão
  ];
  it("só o admin chama", async () => {
    for (const perfil of ["GESTOR", "COLABORADOR"]) {
      const s = servidorRh({ perfil, rows: base() });
      expect((await s.call({ action: "idPessoa", op: "previa" })).status).toBe(403);
    }
  });
  it("a prévia lista só quem não tem o ID, com o ID que vai gravar e os casos que pedem decisão", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: base() });
    const r = await s.call({ action: "idPessoa", op: "previa" });
    expect(r.status).toBe(200);
    expect(r.body.comId).toBe(1);
    const por = new Map((r.body.itens as { id: string }[]).map((i) => [i.id, i]));
    expect(por.has("f2")).toBe(false);
    expect(por.get("f1")).toMatchObject({ idPessoa: "123456", desligado: false });
    expect(por.get("f3")).toMatchObject({ idPessoa: "111222", desligado: true });
    expect(por.get("c1")).toMatchObject({ idPessoa: "654321", herdado: true });
    expect(por.get("f4")).toMatchObject({ idPessoa: "" });
    expect(JSON.stringify(r.body)).not.toContain("cpf");
    expect(gravacoes(s)).toHaveLength(0);
  });
  it("preencher grava só quem não tem o ID, só o ID conferido, e deixa a linha no histórico", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "f2", rows: base() });
    const r = await s.call({ action: "idPessoa", op: "preencher", itens: [
      { colecao: "colaboradores", id: "f1", idPessoa: "123456" },
      { colecao: "colaboradores", id: "f2", idPessoa: "999999" },   // já tem ID: não é tocado
      { colecao: "colaboradores", id: "f3", idPessoa: "000000" },   // ID diferente do conferido: pula
      { colecao: "freelancers", id: "c1", idPessoa: "654321" },
      { colecao: "colaboradores", id: "f4", idPessoa: "444444" },   // pede decisão: pula
    ] });
    expect(r.status).toBe(200);
    expect(r.body.gravados).toBe(2);
    expect(r.body.pulados.map((p: { id: string }) => p.id)).toEqual(["f2", "f3", "f4"]);
    const fichas = gravacoes(s, "colaboradores");
    expect(fichas).toHaveLength(1);
    expect(fichas[0].args).toMatchObject({ p_id: "f1", p_versao: 3, p_registro: { idPessoa: "123456", idPessoaPor: "f2" } });
    expect(typeof fichas[0].args.p_registro.idPessoaEm).toBe("string");
    expect(gravacoes(s, "freelancers")[0].args.p_registro.idPessoa).toBe("654321");
    const hist = gravacoes(s, "alteracoes");
    expect(hist).toHaveLength(1);
    expect(hist[0].args.p_registro).toMatchObject({ acao: "LOTE", qtd: 2, usuarioColaboradorId: "f2" });
  });
  it("preencher não passa por cima de quem mudou em outro aparelho", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: base(), rpcResposta: (nome, a) => (nome === "rh_gravar_seguro" && a.p_colecao === "colaboradores" ? { conflito: true } : undefined) });
    const r = await s.call({ action: "idPessoa", op: "preencher", itens: [{ colecao: "colaboradores", id: "f1", idPessoa: "123456" }] });
    expect(r.body.gravados).toBe(0);
    expect(r.body.pulados[0]).toMatchObject({ id: "f1", motivo: "o cadastro mudou em outro aparelho" });
    expect(gravacoes(s, "alteracoes")).toHaveLength(0);
  });
  it("trocar exige motivo e ID de 6 dígitos, e recusa o ID de outra pessoa", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: base() });
    expect((await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "222333", motivo: "curto" })).status).toBe(400);
    expect((await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "12345", motivo: "Cadastro criado com o CPF errado" })).status).toBe(400);
    const outro = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "654321", motivo: "Cadastro criado com o CPF errado" });
    expect(outro.status).toBe(409);
    expect(gravacoes(s)).toHaveLength(0);
  });
  it("trocar grava o ID novo com carimbo do servidor e a linha do histórico com o motivo", async () => {
    const rows = [linha("colaboradores", ficha("f1", { cpf: CPF_A_CORRIGIDO, idPessoa: "123456" }))];
    const s = servidorRh({ perfil: "ADMIN_RH", pessoa: "admin-ficticio", rows });
    const r = await s.call({ action: "idPessoa", op: "trocar", colecao: "colaboradores", id: "f1", idPessoa: "987654", motivo: "Cadastro criado com o CPF errado" });
    expect(r.status).toBe(200);
    expect(r.body.idPessoa).toBe("987654");
    const ficha1 = gravacoes(s, "colaboradores")[0].args;
    expect(ficha1).toMatchObject({ p_versao: 3, p_registro: { idPessoa: "987654", idPessoaPor: "admin-ficticio", idPessoaMotivo: "Cadastro criado com o CPF errado" } });
    const hist = gravacoes(s, "alteracoes")[0].args.p_registro;
    expect(hist).toMatchObject({ acao: "ALTEROU", colecao: "colaboradores", registroId: "f1", mudancas: [{ campo: "ID da pessoa", de: "123456", para: "987654" }] });
    expect(hist.detalhe).toContain("Cadastro criado com o CPF errado");
  });
});
