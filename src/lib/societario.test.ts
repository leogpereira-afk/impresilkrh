import { describe, expect, it } from "vitest";
import { ehLancamentoSocietario, ehSocio, tipoSocietario, TIPO_ARRENDAMENTO, TIPO_RETIRADA } from "./societario";

const pedro = { id: "pedro-ramos", ehDirecao: true, statusId: "direcao" };
const leo = { id: "leonardo-goncalves", ehDirecao: true, statusId: "direcao" };
const socioNovo = { id: "outro-socio", ehDirecao: true, statusId: "direcao" };
const funcionaria = { id: "fulana", ehDirecao: false, statusId: "ativo" };

describe("ehSocio", () => {
  it("direção entra pelos dois caminhos", () => {
    expect(ehSocio(pedro)).toBe(true);
    expect(ehSocio({ id: "x", statusId: "direcao" })).toBe(true);
    expect(ehSocio({ id: "x", ehDirecao: true })).toBe(true);
  });
  it("funcionário e nada não são sócio", () => {
    expect(ehSocio(funcionaria)).toBe(false);
    expect(ehSocio(null)).toBe(false);
    expect(ehSocio(undefined)).toBe(false);
  });
});

describe("tipoSocietario — a conta do ERP não manda em sócio", () => {
  it("o caso real: honorário do Pedro lançado em conta de folha vira Arrendamento", () => {
    // Era isto que aparecia como "FGTS" e "Freelancer (Empreita)" na prévia.
    expect(tipoSocietario("2.1.9-FGTS", pedro)).toBe(TIPO_ARRENDAMENTO);
    expect(tipoSocietario("2.11.1-Freelancer", pedro)).toBe(TIPO_ARRENDAMENTO);
    expect(tipoSocietario("2.1.11.4-Empreita", pedro)).toBe(TIPO_ARRENDAMENTO);
    expect(tipoSocietario("2.1.1-Salário", pedro)).toBe(TIPO_ARRENDAMENTO);
  });

  it("o sócio também tem plano de saúde, e esse continua sendo plano de saúde", () => {
    expect(tipoSocietario("2.14.1.1-Plano de Saúde", pedro)).toBe("Plano de Saúde");
    expect(tipoSocietario("2.1.20-Plano de Saúde", pedro)).toBe("Plano de Saúde");
    expect(tipoSocietario("2.1.20.1-Pró Vida", pedro)).toBe("Plano de Saúde");
    expect(tipoSocietario("2.1.20.2-Unimed", pedro)).toBe("Plano de Saúde");
  });

  it("cada sócio tem o nome do grupo dele no plano de contas", () => {
    expect(tipoSocietario("2.1.1-Salário", leo)).toBe(TIPO_RETIRADA);
    expect(tipoSocietario("2.1.1-Salário", socioNovo)).toBe(TIPO_ARRENDAMENTO);
  });

  it("quem não é sócio devolve null — quem decide é a conta", () => {
    expect(tipoSocietario("2.1.1-Salário", funcionaria)).toBeNull();
    expect(tipoSocietario("2.1.1-Salário", null)).toBeNull();
  });

  it("“família” não é “Amil” aqui também", () => {
    expect(tipoSocietario("2.1.1.2-Salário Família", pedro)).toBe(TIPO_ARRENDAMENTO);
  });

  it("conta sem nome não vira plano de saúde por acidente", () => {
    expect(tipoSocietario("2.1.9", pedro)).toBe(TIPO_ARRENDAMENTO);
    expect(tipoSocietario("", pedro)).toBe(TIPO_ARRENDAMENTO);
  });
});

describe("ehLancamentoSocietario", () => {
  it("só os dois tipos de sócio", () => {
    expect(ehLancamentoSocietario(TIPO_ARRENDAMENTO)).toBe(true);
    expect(ehLancamentoSocietario(TIPO_RETIRADA)).toBe(true);
    expect(ehLancamentoSocietario("Plano de Saúde")).toBe(false);
    expect(ehLancamentoSocietario("Salário")).toBe(false);
  });
});
