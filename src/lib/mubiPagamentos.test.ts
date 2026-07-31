// Casamento dos pagamentos do ERP com o cadastro. Errar aqui joga salário na
// pessoa errada (ou some do custo dela), então os casos são os REAIS que
// apareceram na conferência de julho/2026 contra o Mubisys.
import { describe, it, expect } from "vitest";
import { casarColaborador, montarPagamento, competenciaDe, montarPrevia, type LinhaMubi } from "./mubiPagamentos";
import type { Colaborador } from "@/data/types";

const c = (id: string, nome: string) => ({ id, nome }) as Colaborador;

const CADASTRO = [
  c("c1", "Adriano Pinheiro Lima"),
  c("c2", "Adriano Nunes Araújo"),          // xará do c1 no primeiro nome
  c("c3", "Barbara Patrícia F. Vasconcelos"), // cadastro ABREVIADO
  c("c4", "Pedro Henrique Golçalves Pereira"), // cadastro com erro de digitação
  c("c5", "Candida Eliza David Barros"),
  c("c6", "Vinicius Silva Lins de Oliveira"),
  c("c7", "Jessica Fernanda Souza Sampaio"), // cadastro sem o "de" que o ERP usa
];

const linha = (nome: string, extra: Partial<LinhaMubi> = {}): LinhaMubi => ({
  idMubi: "1", nome, ehColaborador: true, cpfCnpj: null,
  planoContas: "2.1.1-Salário", tipo: "Salário", descricao: "",
  valor: 100, dataVencimento: "2026-07-05", dataPagamento: "2026-07-05",
  status: "Pago", formaPagamento: "PIX", centroCusto: "", ...extra,
});

describe("casarColaborador", () => {
  it("casa nome idêntico", () => {
    expect(casarColaborador("Adriano Pinheiro Lima", CADASTRO, {})?.id).toBe("c1");
  });

  it("ignora acento e caixa (o ERP escreve tudo em maiúscula, sem acento)", () => {
    expect(casarColaborador("ADRIANO NUNES ARAUJO", CADASTRO, {})?.id).toBe("c2");
  });

  it('resolve o cadastro ABREVIADO: "Barbara Patrícia F." x nome por extenso no ERP', () => {
    expect(casarColaborador("BARBARA PATRICIA FERREIRA VASCONCELOS", CADASTRO, {})?.id).toBe("c3");
  });

  // O Mubisys corta o nome em 30 caracteres — casos REAIS de julho/2026.
  it("casa nome CORTADO em 30 caracteres pelo ERP", () => {
    expect(casarColaborador("BARBARA PATRICIA FERREIRA VASC", CADASTRO, {})?.id).toBe("c3");
    expect(casarColaborador("VINICIUS SILVA LINS DE OLIVEIR", CADASTRO, {})?.id).toBe("c6");
    expect(casarColaborador("JESSICA FERNANDA DE SOUZA SAMP", CADASTRO, {})?.id).toBe("c7");
  });

  it('conectivo a mais no ERP ("DE SOUZA" x "Souza") não atrapalha', () => {
    expect(casarColaborador("JESSICA FERNANDA DE SOUZA SAMPAIO", CADASTRO, {})?.id).toBe("c7");
  });

  // Caso real: o cadastro tem "Golçalves" e o ERP "GONCALVES". Nenhuma regra
  // automática deve adivinhar isso — é para cair no vínculo manual.
  it("NÃO adivinha quando o cadastro tem erro de digitação", () => {
    expect(casarColaborador("PEDRO HENRIQUE GONCALVES PEREIRA", CADASTRO, {})).toBeNull();
  });

  // Só o primeiro nome é perigoso: "KELLY" e "REINALDO" aparecem assim no ERP.
  it("um nome só nunca casa sozinho", () => {
    expect(casarColaborador("KELLY", CADASTRO, {})).toBeNull();
    expect(casarColaborador("REINALDO", [...CADASTRO, c("c9", "Reinaldo Tadeu Campos")], {})).toBeNull();
  });

  it("o vínculo salvo pelo RH resolve o caso do erro de digitação", () => {
    const vinculos = { "PEDRO HENRIQUE GONCALVES PEREIRA": "c4" };
    expect(casarColaborador("PEDRO HENRIQUE GONCALVES PEREIRA", CADASTRO, vinculos)?.id).toBe("c4");
  });

  it("nome de fornecedor não vira colaborador", () => {
    expect(casarColaborador("DROGARIA MINAS BRASIL - CENTRO", CADASTRO, {})).toBeNull();
    expect(casarColaborador("SUPER TRIGO", CADASTRO, {})).toBeNull();
  });

  it('"COLABORADORES" (genérico) não casa com ninguém', () => {
    expect(casarColaborador("COLABORADORES", CADASTRO, {})).toBeNull();
  });

  it("nome vazio não casa", () => {
    expect(casarColaborador("", CADASTRO, {})).toBeNull();
    expect(casarColaborador("   ", CADASTRO, {})).toBeNull();
  });

  // Se dois do cadastro cabem no mesmo nome, quem decide é o RH — não o palpite.
  it("na dúvida entre dois candidatos, não escolhe", () => {
    const dois = [c("x1", "Ana Silva"), c("x2", "Ana Silva Souza")];
    expect(casarColaborador("ANA SILVA SOUZA", dois, {})?.id).toBe("x2");
    // "ANA SILVA" sozinho só cabe em x1 (x2 exige o token SOUZA)
    expect(casarColaborador("ANA SILVA", dois, {})?.id).toBe("x1");
  });

  it("vínculo salvo apontando para alguém que saiu do cadastro é ignorado", () => {
    expect(casarColaborador("FULANO SUMIU", CADASTRO, { "FULANO SUMIU": "cX" })).toBeNull();
  });
});

describe("montarPagamento", () => {
  it("usa o id do título do ERP (reimportar atualiza, não duplica)", () => {
    const p = montarPagamento(linha("Adriano Pinheiro Lima", { idMubi: "53063" }), "c1");
    expect(p.id).toBe("mubi-53063");
    expect(p.colaboradorId).toBe("c1");
    expect(p.competencia).toBe("2026-06"); // vence 05/07 → competência de junho
    expect(p.valor).toBe(100);
  });

  // A competência tem de sair pela MESMA regra da planilha (vencimento até o dia
  // 15 = mês anterior). Se este teste voltar a esperar o mês cru do vencimento, a
  // importação do ERP duplica a folha inteira em cima do que já está gravado.
  it("a competência segue a regra da planilha: vencimento até o dia 15 é do mês anterior", () => {
    expect(competenciaDe(linha("x", { dataVencimento: "2026-07-05" }))).toBe("2026-06");
    expect(competenciaDe(linha("x", { dataVencimento: "2026-07-31" }))).toBe("2026-07");
    expect(competenciaDe(linha("x", { dataVencimento: "2026-08-01" }))).toBe("2026-07");
  });

  it("a virada é entre os dias 15 e 16, e o mês 01 volta para dezembro do ano anterior", () => {
    expect(competenciaDe(linha("x", { dataVencimento: "2026-07-15" }))).toBe("2026-06");
    expect(competenciaDe(linha("x", { dataVencimento: "2026-07-16" }))).toBe("2026-07");
    expect(competenciaDe(linha("x", { dataVencimento: "2026-01-10" }))).toBe("2025-12");
  });

  it("título sem vencimento não inventa competência", () => {
    expect(competenciaDe(linha("x", { dataVencimento: "" }))).toBe("");
  });
});

describe("montarPrevia", () => {
  it("separa vinculado, sem vínculo e despesa coletiva (sem nome)", () => {
    const linhas = [
      linha("Adriano Pinheiro Lima", { valor: 2000 }),
      linha("PEDRO HENRIQUE GONCALVES PEREIRA", { valor: 1500 }),
      linha("", { valor: 90, descricao: "bolo de aniversário" }),
    ];
    const r = montarPrevia(linhas, CADASTRO, {});
    expect(r.vinculadas).toHaveLength(1);
    expect(r.semVinculo).toHaveLength(1);
    expect(r.semNome).toHaveLength(1);
    expect(r.totalVinculado).toBe(2000);
    expect(r.totalSemVinculo).toBe(1500);
    expect(r.totalSemNome).toBe(90);
  });

  // O total das três partes tem que fechar com o que veio do ERP: dinheiro não
  // pode sumir silenciosamente entre a busca e a tela.
  it("nada se perde: a soma das partes é o total recebido", () => {
    const linhas = [linha("Adriano Pinheiro Lima", { valor: 10 }), linha("XPTO LTDA", { valor: 20 }), linha("", { valor: 30 })];
    const r = montarPrevia(linhas, CADASTRO, {});
    expect(r.totalVinculado + r.totalSemVinculo + r.totalSemNome).toBe(60);
  });
});
