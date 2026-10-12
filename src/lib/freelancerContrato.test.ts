/* F07 do PCP (caminho B, decisão do dono de 29/09/2026): o contrato de
 * freelancer de quem instala passa a exigir CPF, porque é dele que sai o ID de
 * 6 dígitos que o PCP usa para dar o ponto. Os testes partem dos casos ruins:
 * instalador sem CPF, CPF digitado errado, função escrita de outro jeito, e o
 * contrato antigo que não pode ser apagado nem travar a importação.
 * Dados fictícios: o repositório é público. */
import { describe, expect, it } from "vitest";
import { cpfPendente, cpfValido, ehFuncaoInstalacao, exigeCpf, idDoContrato, problemaCpfFreelancer, MSG_CPF_INSTALADOR, MSG_CPF_INVALIDO, AVISO_CPF_MANTIDO, AVISO_CPF_PENDENTE, AVISO_CPF_RECUSADO_MANTIDO, AVISO_CPF_RECUSADO_SEM } from "../../supabase/functions/_shared/freelancerContrato";
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

/* A porta de dados recebe a gravação da FILA do aparelho: ela nunca responde
 * 4xx para a régua do CPF (o 422 prendia a fila e deixava o contrato só no
 * aparelho). Grava sem o que a régua recusa, com aviso, e devolve o registro. */
const gravadoNoBanco = (s: ReturnType<typeof servidorRh>) =>
  s.rpcs.filter((x) => x.nome === "rh_gravar_seguro").map((x) => x.args.p_registro as Record<string, unknown>);

describe("porta de dados do RH: contrato de instalador sem CPF", () => {
  it("é salvo como está, fica com CPF pendente, e a resposta avisa e devolve o registro", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato({ valor: 700 }) });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(AVISO_CPF_PENDENTE);
    const [gravou] = gravadoNoBanco(s);
    expect(gravou).toMatchObject({ id: "fl-1", funcao: "Instalador", valor: 700 });
    expect(cpfPendente(gravou)).toBe(true);
    expect(gravou.idPessoa).toBeUndefined();
    expect(r.body.registro).toMatchObject({ id: "fl-1", valor: 700 });
  });
  it("com CPF válido, grava sem aviso e sem devolver o registro", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato({ cpf: CPF_OK }) });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBeUndefined();
    expect(r.body.registro).toBeUndefined();
    expect(s.rpcs.filter((x) => x.nome === "rh_gravar_seguro")).toHaveLength(1);
  });
  it("contrato novo com CPF que não confere: grava sem ele, guarda o digitado em cpfRecusado e não dá ID", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH" });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato({ cpf: CPF_ERRADO }) });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(`${AVISO_CPF_RECUSADO_SEM} ${AVISO_CPF_PENDENTE}`);
    const [gravou] = gravadoNoBanco(s);
    expect(gravou.cpf).toBe("");
    expect(gravou.cpfRecusado).toBe(CPF_ERRADO);
    expect(gravou.idPessoa).toBeUndefined();
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
  it("o que piora não entra no banco, e nada do resto se perde: CPF válido trocado por um errado", async () => {
    const valido = contrato({ cpf: CPF_OK, idPessoa: "300005" });
    const s = servidorRh({ perfil: "ADMIN_RH", rows: gravado(valido) });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: { ...valido, cpf: CPF_ERRADO, valor: 1200 } });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(AVISO_CPF_RECUSADO_MANTIDO);
    const [gravou] = gravadoNoBanco(s);
    expect(gravou).toMatchObject({ cpf: CPF_OK, cpfRecusado: CPF_ERRADO, valor: 1200, idPessoa: "300005" });
    expect(r.body.registro).toMatchObject({ cpf: CPF_OK, cpfRecusado: CPF_ERRADO });
  });
  it("envio sem CPF não apaga o CPF válido do instalador", async () => {
    const valido = contrato({ cpf: CPF_OK });
    const { r } = await upsert(valido, { ...valido, cpf: "", valor: 50 });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(AVISO_CPF_MANTIDO);
    expect(r.body.registro).toMatchObject({ cpf: CPF_OK, valor: 50 });
  });
  it("instalador reativado sem CPF e Designer que vira instalador: salvos como digitados, com CPF pendente e aviso", async () => {
    const encerrado = contrato({ situacao: "encerrado" });
    const reativa = await upsert(encerrado, { ...encerrado, situacao: "ativo" });
    expect(reativa.r.status).toBe(200);
    expect(reativa.r.body.aviso).toBe(AVISO_CPF_PENDENTE);
    expect(reativa.r.body.registro).toMatchObject({ situacao: "ativo" });
    expect(reativa.gravou).toBe(1);
    const designer = contrato({ funcao: "Designer" });
    const virou = await upsert(designer, { ...designer, funcao: "Instalador" });
    expect(virou.r.status).toBe(200);
    expect(virou.r.body.registro).toMatchObject({ funcao: "Instalador" });
    // CPF errado que já estava gravado: não é "recusado" de novo, só pendente.
    const designerDv = contrato({ funcao: "Designer", cpf: CPF_ERRADO });
    const virouDv = await upsert(designerDv, { ...designerDv, funcao: "Instalador" });
    expect(virouDv.r.body.aviso).toBe(AVISO_CPF_PENDENTE);
    expect(virouDv.r.body.registro.cpfRecusado).toBeUndefined();
  });
  it("contrato apagado (lápide) que volta conta como novo: salvo com CPF pendente", async () => {
    const s = servidorRh({ perfil: "ADMIN_RH", rows: [{ colecao: "freelancers", id: "fl-1", registro: contrato(), apagado: true }] });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: contrato() });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBe(AVISO_CPF_PENDENTE);
  });
  it("o CPF certo resolve o recusado: o lembrete sai do contrato", async () => {
    const antes = contrato({ cpfRecusado: CPF_ERRADO });
    const s = servidorRh({ perfil: "ADMIN_RH", rows: gravado(antes) });
    const r = await s.call({ action: "upsert", colecao: "freelancers", registro: { ...antes, cpf: CPF_OK } });
    expect(r.status).toBe(200);
    expect(r.body.aviso).toBeUndefined();
    const [gravou] = gravadoNoBanco(s);
    expect(gravou.cpf).toBe(CPF_OK);
    expect("cpfRecusado" in gravou).toBe(false);
  });
  it("na tela, abrir o contrato de instalador sem CPF e salvar pede o CPF", () => {
    const antes = contrato();
    const editado = { ...antes, valor: 10 };
    expect(problemaCpfFreelancer(editado, antes, { edicaoManual: true })).toBe(MSG_CPF_INSTALADOR);
    expect(problemaCpfFreelancer(editado, antes)).toBe("");
  });
});
