/* F07 do PCP (caminho B, decisão do dono de 29/09/2026): o contrato de
 * freelancer de quem instala passa a exigir CPF, porque é dele que sai o ID de
 * 6 dígitos que o PCP usa para dar o ponto. Os testes partem dos casos ruins:
 * instalador sem CPF, CPF digitado errado, função escrita de outro jeito, e o
 * contrato antigo que não pode ser apagado nem travar a importação.
 * Dados fictícios: o repositório é público. */
import { describe, expect, it } from "vitest";
import { cpfPendente, cpfValido, ehFuncaoInstalacao, exigeCpf, idDoContrato, problemaCpfFreelancer, MSG_CPF_INSTALADOR, MSG_CPF_INVALIDO } from "../../supabase/functions/_shared/freelancerContrato";
import { servidorRh } from "../test/servidorRh";

const CPF_OK = "300.005.987-39";   // fictício, verificadores certos
const CPF_ERRADO = "300.005.987-38";
const contrato = (extra: Record<string, unknown> = {}) => ({ id: "fl-1", nome: "Prestador Fictício", funcao: "Instalador", situacao: "ativo", contratoFim: "2099-12-31", ...extra });

describe("régua do CPF do contrato de freelancer", () => {
  it("função de instalação escrita de qualquer jeito exige CPF", () => {
    for (const f of ["Instalador", "instaladora", "Instalação", "INSTALACAO", " instalador de ACM "]) expect(ehFuncaoInstalacao(f), f).toBe(true);
    for (const f of ["Montador", "Designer", "", null]) expect(ehFuncaoInstalacao(f), String(f)).toBe(false);
  });
  it("instalador sem CPF não grava; com CPF válido, grava e o ID sai dele", () => {
    expect(problemaCpfFreelancer(contrato())).toBe(MSG_CPF_INSTALADOR);
    expect(problemaCpfFreelancer(contrato({ cpf: "   " }))).toBe(MSG_CPF_INSTALADOR);
    expect(problemaCpfFreelancer(contrato({ cpf: CPF_OK }))).toBe("");
    expect(idDoContrato(contrato({ cpf: CPF_OK }))).toBe("300005");
  });
  it("CPF com verificador errado não passa em contrato nenhum (viraria o ID de outra pessoa)", () => {
    expect(cpfValido(CPF_ERRADO)).toBe(false);
    expect(cpfValido("111.111.111-11")).toBe(false);
    expect(problemaCpfFreelancer(contrato({ cpf: CPF_ERRADO }))).toBe(MSG_CPF_INVALIDO);
    expect(problemaCpfFreelancer(contrato({ funcao: "Designer", cpf: CPF_ERRADO }))).toBe(MSG_CPF_INVALIDO);
    expect(idDoContrato(contrato({ cpf: CPF_ERRADO }))).toBe("");
  });
  it("outra função ou contrato encerrado não exige CPF", () => {
    expect(problemaCpfFreelancer(contrato({ funcao: "Montador" }))).toBe("");
    expect(problemaCpfFreelancer(contrato({ situacao: "encerrado" }))).toBe("");
    expect(exigeCpf(contrato({ situacao: "encerrado" }))).toBe(false);
  });
  it("contrato antigo de instalador sem CPF aparece como pendente", () => {
    expect(cpfPendente(contrato())).toBe(true);
    expect(cpfPendente(contrato({ cpf: CPF_OK }))).toBe(false);
    expect(cpfPendente(contrato({ situacao: "encerrado" }))).toBe(false);
  });
});

describe("porta de dados do RH: contrato de instalador sem CPF", () => {
  it("é recusado sem gravar, com o motivo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato() });
    expect(r.status).toBe(422);
    expect(r.body.erro).toBe(MSG_CPF_INSTALADOR);
    expect(s.rpcs.filter((x) => x.nome === "rh_gravar_seguro")).toHaveLength(0);
  });
  it("com CPF válido, grava", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato({ cpf: CPF_OK }) });
    expect(r.status).toBe(200);
    expect(s.rpcs.filter((x) => x.nome === "rh_gravar_seguro")).toHaveLength(1);
  });
  it("encerrar o contrato antigo sem CPF continua possível", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato({ situacao: "encerrado" }) });
    expect(r.status).toBe(200);
  });
  it("a importação de retrato não barra o contrato antigo sem CPF (nada é apagado)", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "aplicarRetrato", dados: { freelancers: [contrato()] }, rev: 1 });
    expect(r.status).toBe(200);
    expect(s.rpcs.find((x) => x.nome === "rh_aplicar_retrato")?.args.p_dados.freelancers).toHaveLength(1);
  });
  it("apagar (lápide) não confere CPF", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [{ colecao: "freelancers", id: "fl-1", registro: contrato(), apagado: false }] });
    const r = await s.call({ action: "delete", colecao: "freelancers", id: "fl-1" });
    expect(r.status).toBe(200);
  });
});

/* Revisão da F07: a porta barrava QUALQUER gravação de contrato fora da régua,
 * até a que não mexe no CPF. Apagar a ficha do responsável limpa o
 * `responsavelId` do contrato (cadastros.tsx), a fila manda o registro
 * inteiro e o 422 deixava o banco apontando para a ficha apagada. */
describe("porta de dados do RH: barra só o que cria ou piora a falta de CPF", () => {
  const gravado = (registro: Record<string, unknown>) => [{ colecao: "freelancers", id: "fl-1", registro, apagado: false }];
  const upsert = async (antes: Record<string, unknown>, depois: Record<string, unknown>) => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: gravado(antes) });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: depois });
    return { r, gravou: s.rpcs.filter((x) => x.nome === "rh_gravar_seguro").length };
  };
  it("limpar o responsável de um contrato de instalador sem CPF grava", async () => {
    const antes = contrato({ responsavelId: "ficha-apagada" });
    const { r, gravou } = await upsert(antes, { ...antes, responsavelId: null });
    expect(r.status).toBe(200);
    expect(gravou).toBe(1);
  });
  it("renovar a data de um contrato de instalador sem CPF (aba antiga) grava e segue pendente", async () => {
    const antes = contrato({ contratoFim: "2026-10-31" });
    const renovado = { ...antes, contratoFim: "2027-03-31" };
    const { r } = await upsert(antes, renovado);
    expect(r.status).toBe(200);
    expect(cpfPendente(renovado)).toBe(true);
  });
  it("contrato antigo de Designer com CPF de verificador errado continua editável", async () => {
    const antes = contrato({ funcao: "Designer", cpf: CPF_ERRADO });
    const { r } = await upsert(antes, { ...antes, valor: 900 });
    expect(r.status).toBe(200);
  });
  it("encerrar contrato com CPF de verificador errado é possível, na porta e na tela", async () => {
    const antes = contrato({ funcao: "Designer", cpf: CPF_ERRADO });
    const { r } = await upsert(antes, { ...antes, situacao: "encerrado" });
    expect(r.status).toBe(200);
    const inst = contrato({ cpf: CPF_ERRADO });
    expect(problemaCpfFreelancer({ ...inst, situacao: "encerrado" }, inst, { edicaoManual: true })).toBe("");
  });
  it("o que piora continua barrado: CPF trocado errado, instalador reativado sem CPF, Designer que vira instalador sem CPF", async () => {
    const valido = contrato({ cpf: CPF_OK });
    expect((await upsert(valido, { ...valido, cpf: CPF_ERRADO })).r.status).toBe(422);
    const encerrado = contrato({ situacao: "encerrado" });
    const reativa = await upsert(encerrado, { ...encerrado, situacao: "ativo" });
    expect(reativa.r.status).toBe(422);
    expect(reativa.r.body.erro).toBe(MSG_CPF_INSTALADOR);
    expect(reativa.gravou).toBe(0);
    const designer = contrato({ funcao: "Designer" });
    expect((await upsert(designer, { ...designer, funcao: "Instalador" })).r.status).toBe(422);
    const designerDv = contrato({ funcao: "Designer", cpf: CPF_ERRADO });
    expect((await upsert(designerDv, { ...designerDv, funcao: "Instalador" })).r.body.erro).toBe(MSG_CPF_INVALIDO);
  });
  it("contrato apagado (lápide) que volta conta como novo", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [{ colecao: "freelancers", id: "fl-1", registro: contrato(), apagado: true }] });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato() });
    expect(r.status).toBe(422);
  });
  it("na tela, abrir o contrato de instalador sem CPF e salvar pede o CPF", () => {
    const antes = contrato();
    const editado = { ...antes, valor: 10 };
    expect(problemaCpfFreelancer(editado, antes, { edicaoManual: true })).toBe(MSG_CPF_INSTALADOR);
    expect(problemaCpfFreelancer(editado, antes)).toBe("");
  });
});
