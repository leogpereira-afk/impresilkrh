/* FICHA FREELANCER E CONTRATO DE FREELANCER SE ENXERGANDO (30/09/2026).
 *
 * Decisões do Léo: a tela de Freelancers lista a ficha de situação freelancer
 * que ainda não tem contrato (com "Criar contrato" preenchido), e Colaboradores,
 * no filtro Freelancer, mostra também os contratos ativos, fora das contagens.
 *
 * Os testes partem do que dá errado quando as duas pontas não concordam sobre
 * quem é a mesma pessoa: gente em dobro na lista, contrato inflando o quadro,
 * o "+N" do card sem bater com a lista, contrato aparecendo para quem não abre
 * /freelancers, e a ficha que continua "sem contrato" depois de o contrato
 * existir porque o CPF foi digitado com pontos.
 *
 * Dados fictícios: o repositório é público. Os CPFs abaixo têm os dígitos
 * verificadores certos, mas foram montados a partir de 900001001, cada um
 * com um ID de 6 dígitos diferente. */
import { describe, expect, it } from "vitest";
import type { Colaborador, Freelancer } from "@/data/types";
import {
  STATUS_DO_CONTRATO,
  ateQuando,
  camposDoContrato,
  celulaDoContrato,
  contratoDaFicha,
  contratoVigente,
  contratosDaTela,
  contratosForaDoCard,
  fichasSemContrato,
  juntarContratos,
  mesmaPessoa,
  soFiltroFreelancer,
} from "./freelancerNoQuadro";
import { podeVerContratosFreelancer } from "./rbac";
import { problemaCpfFreelancer } from "./freelancerContrato";

const HOJE = "2026-09-30";
const CPF_A = "900.001.001-29"; // ficha freelancer; o contrato vem só com dígitos
const CPF_B = "90000200263";    // contrato sem ficha
const CPF_C = "900.003.003-06"; // ficha freelancer sem contrato

const ficha = (extra: Partial<Colaborador>): Colaborador =>
  ({ id: "ficha", nome: "Ficha Fictícia", statusId: "freelancer", ...extra }) as Colaborador;
const contrato = (extra: Partial<Freelancer>): Freelancer =>
  ({ id: "ct", nome: "Prestador Fictício", funcao: "Montador", situacao: "ativo", contratoFim: "2026-12-31", ...extra }) as Freelancer;

const fichaA = ficha({ id: "fa", nome: "Alfa Freelancer Fictício", cpf: CPF_A, apelido: "alfa", telefone: "(38) 90000-0001", email: "alfa@exemplo.test" });
const fichaC = ficha({ id: "fc", nome: "Gama Freelancer Fictício", cpf: CPF_C });
const fichaAtiva = ficha({ id: "fx", nome: "Delta CLT Fictício", statusId: "ativo", cpf: "90000400432" });
const escopo = [fichaA, fichaC, fichaAtiva];

const kA = contrato({ id: "k-a", nome: "Alfa Freelancer Fictício", cpf: "90000100129" }); // mesma pessoa de fichaA
const kB = contrato({ id: "k-b", nome: "Beta Instalador Fictício", funcao: "Instalador", cpf: CPF_B });
const kSemCpf = contrato({ id: "k-s", nome: "Épsilon Instalador Fictício", funcao: "Instalador", cpf: "" });
const kEncerrado = contrato({ id: "k-e", nome: "Zeta Encerrado Fictício", cpf: "91000500594", situacao: "encerrado" });
const kVencido = contrato({ id: "k-v", nome: "Eta Vencido Fictício", cpf: "", contratoFim: "2026-09-29" });
const contratos = [kA, kB, kSemCpf, kEncerrado, kVencido];

/** A lista que a tela mostra no filtro Freelancer, sem outro recorte. */
const listaFreelancer = escopo.filter((c) => c.statusId === "freelancer");
const tela = (extra: Partial<Parameters<typeof contratosDaTela>[0]> = {}) =>
  contratosDaTela({
    podeVer: true, fStatus: "freelancer", foco: null, lista: listaFreelancer,
    contratos, hoje: HOJE, busca: "", comArea: false, ...extra,
  });

describe("a mesma pessoa nunca aparece duas vezes", () => {
  it("contrato do mesmo CPF da ficha, com CPF escrito de outro jeito, vira a tag da ficha, não outra linha", () => {
    const r = tela();
    expect(r.comContrato.get("fa")?.id).toBe("k-a");
    expect(r.avulsos.map((f) => f.id)).not.toContain("k-a");
    expect(r.avulsos.map((f) => f.id)).toEqual(["k-b", "k-s"]);
  });

  it("dois contratos vigentes do mesmo CPF sem ficha na lista viram uma linha só, a do fim mais distante", () => {
    const renovado = contrato({ id: "k-b2", nome: "Beta Instalador Fictício", funcao: "Instalador", cpf: "900.002.002-63", contratoFim: "2027-06-30" });
    const r = tela({ contratos: [kB, renovado] });
    expect(r.avulsos.map((f) => f.id)).toEqual(["k-b2"]);
  });

  it("CPFs diferentes são pessoas diferentes, mesmo que o contrato tenha nascido da ficha", () => {
    expect(mesmaPessoa(fichaA, { cpf: CPF_B, exColaboradorId: "fa" })).toBe(false);
  });

  it("sem CPF de um lado, vale a origem do contrato (exColaboradorId)", () => {
    const semCpf = ficha({ id: "fz", nome: "Teta Sem CPF Fictício" });
    expect(mesmaPessoa(semCpf, { cpf: "", exColaboradorId: "fz" })).toBe(true);
    expect(mesmaPessoa(semCpf, { cpf: "", exColaboradorId: "outra" })).toBe(false);
    expect(mesmaPessoa(semCpf, { cpf: "" })).toBe(false);
  });

  it("a ficha fora da lista (desligada ou em outra situação) não esconde o contrato vigente", () => {
    const r = tela({ lista: [fichaC] });
    expect(r.avulsos.map((f) => f.id)).toContain("k-a");
  });
});

describe("encerrado e vencido não aparecem em Colaboradores", () => {
  it("contrato encerrado não aparece, nem como linha nem como tag", () => {
    const encerradoDaFicha = contrato({ id: "k-ae", cpf: CPF_A, situacao: "encerrado" });
    const r = tela({ contratos: [kEncerrado, encerradoDaFicha] });
    expect(r.avulsos).toEqual([]);
    expect(r.comContrato.size).toBe(0);
  });

  it("vencido fica de fora; o último dia ainda vale", () => {
    expect(contratoVigente(kVencido, HOJE)).toBe(false);
    expect(contratoVigente(contrato({ contratoFim: HOJE }), HOJE)).toBe(true);
    expect(tela().avulsos.map((f) => f.id)).not.toContain("k-v");
  });
});

describe("o \"+N por contrato\" do card bate com a lista", () => {
  it("N é o número de linhas de contrato que o filtro Freelancer mostra", () => {
    const n = contratosForaDoCard(escopo, contratos, HOJE);
    expect(n).toBe(2);
    expect(n).toBe(tela().avulsos.length);
  });

  it("o contrato da mesma pessoa de uma ficha do card não soma de novo", () => {
    expect(contratosForaDoCard(escopo, [kA], HOJE)).toBe(0);
    expect(contratosForaDoCard(escopo, [kEncerrado, kVencido], HOJE)).toBe(0);
  });

  it("ficha desligada não absorve o contrato: a pessoa trabalha pelo contrato e é contada no +N", () => {
    const desligada = { ...fichaA, dataDesligamento: "2026-06-22" };
    expect(contratosForaDoCard([desligada, fichaC], [kA], HOJE)).toBe(1);
  });
});

describe("só no filtro Freelancer, só para quem abre /freelancers", () => {
  it("quem não pode ver /freelancers não recebe linha nem tag", () => {
    const r = tela({ podeVer: false });
    expect(r.avulsos).toEqual([]);
    expect(r.comContrato.size).toBe(0);
  });

  it("a guarda é a da rota: só ADMIN_RH, e o módulo desmarcado também fecha", () => {
    expect(podeVerContratosFreelancer({ perfil: "ADMIN_RH", colaboradorId: "rh" })).toBe(true);
    expect(podeVerContratosFreelancer({ perfil: "GESTOR", colaboradorId: "g" })).toBe(false);
    expect(podeVerContratosFreelancer({ perfil: "COLABORADOR", colaboradorId: "c" })).toBe(false);
    expect(podeVerContratosFreelancer(null)).toBe(false);
    expect(podeVerContratosFreelancer({ perfil: "ADMIN_RH", colaboradorId: "rh" }, new Set(["colaboradores"]))).toBe(false);
  });

  it("em Todos, em outro status e em Indisponíveis nada muda", () => {
    for (const [fStatus, foco] of [["", null], ["ativo", null], ["freelancer", "indisponiveis"], ["freelancer", "st:ativo"], ["", "st:ativo"]] as const) {
      expect(soFiltroFreelancer(fStatus, foco), `${fStatus}/${foco}`).toBe(false);
      expect(tela({ fStatus, foco }).avulsos, `${fStatus}/${foco}`).toEqual([]);
    }
    expect(soFiltroFreelancer("freelancer", null)).toBe(true);
    expect(soFiltroFreelancer("", "st:freelancer")).toBe(true);
    expect(soFiltroFreelancer("freelancer", "st:freelancer")).toBe(true);
  });

  it("a busca vale para o contrato; área marcada tira todos, e o PDF sabe quantos saíram", () => {
    const busca = tela({ busca: "instalador" });
    expect(busca.avulsos.map((f) => f.id)).toEqual(["k-b", "k-s"]);
    const soBeta = tela({ busca: "beta" });
    expect(soBeta.avulsos.map((f) => f.id)).toEqual(["k-b"]);
    expect(soBeta.foraDoRecorte).toBe(1);
    const comArea = tela({ comArea: true });
    expect(comArea.avulsos).toEqual([]);
    expect(comArea.foraDoRecorte).toBe(2);
  });
});

describe("o bloco \"No quadro como Freelancer, sem contrato\"", () => {
  it("some quando existe contrato do mesmo CPF, mesmo com o CPF formatado diferente", () => {
    expect(fichasSemContrato([fichaA, fichaC], []).map((c) => c.id)).toEqual(["fa", "fc"]);
    expect(fichasSemContrato([fichaA, fichaC], [kA]).map((c) => c.id)).toEqual(["fc"]);
    expect(fichasSemContrato([fichaA], [contrato({ cpf: " 900 001 001 29 " })])).toEqual([]);
  });

  it("contrato encerrado também tira a ficha do bloco (reabre-se o que existe, não se cria outro)", () => {
    expect(fichasSemContrato([fichaA], [contrato({ cpf: CPF_A, situacao: "encerrado" })])).toEqual([]);
  });

  it("não lista desligada, Direção nem quem está em outra situação", () => {
    const desligada = ficha({ id: "fd", cpf: "91000500594", dataDesligamento: "2026-01-10" });
    const inativa = ficha({ id: "fi", cpf: "91000500594", statusId: "inativo" });
    const direcao = ficha({ id: "fdi", ehDirecao: true });
    expect(fichasSemContrato([desligada, inativa, direcao, fichaAtiva], [])).toEqual([]);
  });

  it("ficha sem CPF sai do bloco pelo contrato criado a partir dela", () => {
    const semCpf = ficha({ id: "fz", nome: "Teta Sem CPF Fictício" });
    const rascunho = contratoDaFicha(semCpf, HOJE);
    expect(fichasSemContrato([semCpf], [])).toHaveLength(1);
    expect(fichasSemContrato([semCpf], [{ ...rascunho, id: "novo" } as Freelancer])).toEqual([]);
  });
});

describe("\"Criar contrato\" preenche e não salva", () => {
  it("o rascunho leva CPF, exColaboradorId e os contatos da ficha, sem id (a tela cria, não atualiza)", () => {
    const r = contratoDaFicha(fichaA, HOJE);
    expect(r).toMatchObject({
      nome: "Alfa Freelancer Fictício", apelido: "alfa", cpf: CPF_A,
      telefone: "(38) 90000-0001", email: "alfa@exemplo.test",
      exColaboradorId: "fa", situacao: "ativo", contratoInicio: HOJE,
    });
    expect(r.id).toBeUndefined();
  });

  it("a função e a data de fim ficam em branco para o Léo escolher", () => {
    const r = contratoDaFicha(fichaA, HOJE);
    expect(r.funcao).toBe("");
    expect(r.contratoFim).toBe("");
  });

  it("escolhida a função de instalador, a régua de CPF que já existe continua valendo", () => {
    const semCpf = contratoDaFicha(ficha({ id: "fz" }), HOJE);
    expect(problemaCpfFreelancer({ ...semCpf, funcao: "Instalador" }, null, { edicaoManual: true })).not.toBe("");
    expect(problemaCpfFreelancer({ ...contratoDaFicha(fichaA, HOJE), funcao: "Instalador" }, null, { edicaoManual: true })).toBe("");
  });
});

describe("a linha de contrato nos arquivos", () => {
  it("Status \"Freelancer (contrato)\", a função no lugar do cargo e vazio onde não há dado", () => {
    const campos = camposDoContrato(kSemCpf);
    expect(campos.Status).toBe(STATUS_DO_CONTRATO);
    expect(campos.Status).toBe("Freelancer (contrato)");
    expect(campos.Cargo).toBe("Instalador");
    expect(campos.ID).toBe("sem ID");
    expect(campos["E-mail"]).toBe("");
    expect(campos["Área"]).toBeUndefined();
  });

  it("a célula do contrato diz até quando e o CPF pendente, e nunca fica em branco", () => {
    expect(celulaDoContrato(kSemCpf)).toBe("Contrato até 31/12/2026 · CPF pendente");
    expect(celulaDoContrato(contrato({ contratoFim: "" }))).toBe("Contrato");
    expect(ateQuando(contrato({ contratoFim: "2027-01-05" }))).toBe("até 05/01/2027");
  });
});
