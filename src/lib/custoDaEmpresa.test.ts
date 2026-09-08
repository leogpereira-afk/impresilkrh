/* Custo da empresa × custo da pessoa.
 *
 * Os casos vêm da tela que o Léo mandou em 07/09/2026 (a lista "vincular este
 * título a...") e dos 9 FGTS individuais que estão no banco.
 *
 * Começa pelo caso ruim: mandar para o rateio um pagamento que é DE ALGUÉM.
 * Isso é pior que o problema original — o dinheiro some do custo da pessoa e
 * ninguém nunca mais procura por ele.
 */
import { describe, it, expect } from "vitest";
import { ehCustoDaEmpresa, ehRazaoSocial, sobrasDoTexto, textoUtil } from "./custoDaEmpresa";

describe("o caso ruim: pagamento de alguém NUNCA vira custo da empresa", () => {
  it("adiantamento sem nome continua individual — falta vincular, não é rateio", () => {
    // Linha real da tela: R$ 726,66. É de uma pessoa; só ninguém escreveu quem.
    expect(ehCustoDaEmpresa("", "Adiantamento de dias trabalhados de novo colaborador")).toBe(false);
  });

  it("os três com nome na descrição continuam individuais", () => {
    expect(ehCustoDaEmpresa("", "Rescisão de Kelly")).toBe(false);
    expect(ehCustoDaEmpresa("", "Adiantamento para Michele referente à 07/2026")).toBe(false);
    expect(ehCustoDaEmpresa("", "Pagamento de salário de Fabio Leonardo ainda sem cadastro")).toBe(false);
  });

  it("os 9 FGTS individuais do banco continuam individuais", () => {
    for (const d of [
      "FGTS RECISÃO OSMANE", "ftgts Camila", "FGTS OSMANE", "fgts Camila",
      "emanuelle · 2.1.9.1-Regular",
    ]) {
      expect(ehCustoDaEmpresa("", d), d).toBe(false);
    }
  });

  it("texto sem documento nenhum não é da empresa, por mais genérico que seja", () => {
    expect(ehCustoDaEmpresa("", "Pagamento")).toBe(false);
    expect(ehCustoDaEmpresa("", "referente à folha de julho")).toBe(false);
    expect(ehCustoDaEmpresa("", "")).toBe(false);
    expect(ehCustoDaEmpresa(null, null)).toBe(false);
  });
});

describe("as duas linhas que o Léo apontou", () => {
  it("a guia de FGTS da folha inteira é da empresa", () => {
    expect(ehCustoDaEmpresa("", "FGTS")).toBe(true);
    expect(ehCustoDaEmpresa("FGTS", "FGTS")).toBe(true);
  });

  it("DARF é da empresa", () => {
    expect(ehCustoDaEmpresa("", "DARF")).toBe(true);
  });

  it("as outras guias da folha também", () => {
    for (const d of ["GPS", "GRF", "GRRF", "INSS", "IRRF", "Guia de recolhimento", "eSocial", "DAE"]) {
      expect(ehCustoDaEmpresa("", d), d).toBe(true);
    }
  });

  it("guia com mês, número e acento no meio continua sendo guia", () => {
    expect(ehCustoDaEmpresa("", "GUIA FGTS 07/2026")).toBe(true);
    expect(ehCustoDaEmpresa("", "Contribuição previdenciária — competência julho")).toBe(true);
    expect(ehCustoDaEmpresa("", "FGTS RESCISÃO")).toBe(true);
  });

  it("o sufixo do plano de contas não conta como sobra", () => {
    // Se contasse, todo título teria "sobra" e nada seria coletivo.
    expect(ehCustoDaEmpresa("", "FGTS · 2.1.9.1-Regular")).toBe(true);
    expect(textoUtil("", "FGTS · 2.1.9.1-Regular").trim()).toBe("FGTS");
  });
});

describe("o VALOR não entra na regra, de propósito", () => {
  it("guia grande e encargo individual grande são separados pelo TEXTO", () => {
    /* Tentador usar o valor: a guia foi R$ 5.515,62 e o encargo individual
       costuma ser R$ 150. Mas o FGTS de rescisão do Osmane foi R$ 3.262,03 e é
       de uma pessoa só — valor grande não prova coletivo. A função nem recebe
       o valor, para ninguém ser tentado a usá-lo. */
    expect(ehCustoDaEmpresa("", "FGTS")).toBe(true);
    expect(ehCustoDaEmpresa("", "FGTS RECISÃO OSMANE")).toBe(false);
    expect(ehCustoDaEmpresa.length).toBe(2); // nome e descrição — nada de valor
  });
});

describe("as sobras, que são o que decide", () => {
  it("mostra exatamente o que sobrou de nome", () => {
    expect(sobrasDoTexto("", "FGTS RECISÃO OSMANE")).toEqual(["osmane"]);
    expect(sobrasDoTexto("", "Rescisão de Kelly")).toEqual(["kelly"]);
    expect(sobrasDoTexto("", "FGTS")).toEqual([]);
  });

  it("número, mês e letra solta não são nome de gente", () => {
    expect(sobrasDoTexto("", "FGTS 07/2026 julho")).toEqual([]);
    expect(sobrasDoTexto("", "FGTS a b c")).toEqual([]);
  });

  it("acento e caixa não mudam o resultado", () => {
    expect(sobrasDoTexto("", "CONTRIBUIÇÃO PREVIDENCIÁRIA")).toEqual([]);
    expect(ehCustoDaEmpresa("", "contribuição previdenciária")).toBe(true);
  });

  it("a origem também é lida, não só a descrição", () => {
    expect(ehCustoDaEmpresa("FGTS", "")).toBe(true);
    expect(ehCustoDaEmpresa("OSMANE", "FGTS")).toBe(false);
  });
});

/* FORNECEDOR: "isso é custo de empresa" (Léo, 07/09/2026, olhando a CEMIG na
   fila de vincular). Fornecedor sem CNPJ no título caía pedindo vínculo, e não
   há a quem vincular — a conta de luz não é de ninguém da equipe. */
describe("razão social não é nome de gente", () => {
  it("a CEMIG que o Léo apontou", () => {
    expect(ehCustoDaEmpresa("CEMIG DISTRIBUICAO S/A", "")).toBe(true);
    expect(ehRazaoSocial("CEMIG DISTRIBUICAO S/A")).toBe(true);
  });

  it("as formas jurídicas mais comuns", () => {
    for (const n of [
      "PADARIA CENTRAL LTDA", "TRANSPORTES ALFA EIRELI", "COMERCIO DE PECAS ME",
      "GRAFICA BETA EPP", "JOSE DA SILVA MEI", "CIA DE SANEAMENTO",
      "OFICINA DO ZE LTDA", "POSTO IPIRANGA S.A.",
    ]) expect(ehCustoDaEmpresa(n, ""), n).toBe(true);
  });

  it("CONTROLE: nenhum dos nomes reais do cadastro bate", () => {
    /* Conferido no banco em 07/09/2026: zero batidas entre os 93. Se algum dia
       entrar alguém chamado "Sá" ou "Mendes Cia", este teste cai antes de a
       pessoa sumir da folha. */
    for (const n of [
      "José Adilando Pereira", "Demerval Vieira", "Osmane Vinicius Nepomuceno Oliveira",
      "Camila Cristina Rodrigues Costa Magalhães", "Kelly Raissa Soares Ruas",
      "Jefferson Matheus Matarazzo R. Silva", "Maria Sales", "Ana Paula Menezes",
      "Marcos Sampaio", "Luis Fernando Soares Silva",
    ]) expect(ehRazaoSocial(n), n).toBe(false);
  });

  it("marcador fraco SÓ vale no fim — no meio pode ser pedaço de nome", () => {
    expect(ehRazaoSocial("EMPRESA X SA")).toBe(true);
    expect(ehRazaoSocial("Sa Pereira dos Santos")).toBe(false);
    expect(ehRazaoSocial("Me Livre Comunicacao")).toBe(false); // "comunicacao" não é marcador
  });

  it("a razão social vale mesmo sem palavra de imposto no texto", () => {
    // Era esse o buraco: a regra antiga só pegava documento de recolhimento.
    expect(ehCustoDaEmpresa("CEMIG DISTRIBUICAO S/A", "Energia elétrica")).toBe(true);
  });

  it("nome vazio não vira empresa", () => {
    expect(ehRazaoSocial("")).toBe(false);
    expect(ehRazaoSocial(null)).toBe(false);
  });
});

/* A GUIA COM ORIGEM PREENCHIDA (07/09/2026).
 *
 * O Léo mandou o print da lista que pede vínculo individual, com a guia de
 * FGTS de R$ 5.515,62 e o DARF de R$ 5.330,85 dentro dela: "esse aqui é do
 * custo global e caiu no custo individual".
 *
 * A guarda já existia e citava esses mesmos R$ 5.515,62 no comentário — mas ela
 * exige que NÃO SOBRE nenhuma palavra além das do documento. Quando o ERP manda
 * a origem vazia, a guia é reconhecida; quando manda qualquer origem, a palavra
 * vira "sobra" e veta. E a origem de uma guia nunca é o dono do dinheiro: é a
 * leva genérica ("COLABORADORES") ou quem RECEBE o recolhimento (a Caixa, a
 * Receita). Jogar a guia do mês numa pessoa estouraria o custo dela.
 *
 * Começa pelo caso ruim: engolir calado a guia que nomeia uma pessoa de verdade.
 */
describe("a guia não vira custo individual só porque a origem veio preenchida", () => {
  it("O CASO RUIM: guia que nomeia uma pessoa continua pedindo vínculo", () => {
    // Se sobrar nome de gente, a guia NÃO é engolida — ela aparece na lista
    // para alguém decidir. Perder isso seria trocar um defeito por outro pior.
    expect(ehCustoDaEmpresa("MARCELLA LAIARA ROCHA FARIAS", "FGTS")).toBe(false);
    expect(ehCustoDaEmpresa("BARBARA PATRICIA", "DARF")).toBe(false);
    expect(ehCustoDaEmpresa("", "FGTS Rescisório João da Silva")).toBe(false);
  });

  it("a leva genérica do ERP não é uma pessoa", () => {
    expect(ehCustoDaEmpresa("COLABORADORES", "FGTS")).toBe(true);
    expect(ehCustoDaEmpresa("COLABORADORES", "DARF")).toBe(true);
    expect(ehCustoDaEmpresa("FUNCIONARIOS", "GPS")).toBe(true);
  });

  it("quem RECEBE a guia não é uma pessoa", () => {
    expect(ehCustoDaEmpresa("CAIXA ECONOMICA FEDERAL", "FGTS")).toBe(true);
    expect(ehCustoDaEmpresa("RECEITA FEDERAL", "DARF")).toBe(true);
    // A contribuição sindical existe no plano da casa; "ISSQN" eu tinha posto
    // aqui sem conferir que a palavra está no vocabulário de documentos — não
    // está, e um teste sobre caso inventado não prova nada.
    expect(ehCustoDaEmpresa("SINDICATO DOS TRABALHADORES", "Contribuição Sindical")).toBe(true);
  });

  it("origem vazia continua funcionando — o conserto não pode quebrar o que já ia", () => {
    expect(ehCustoDaEmpresa("", "FGTS")).toBe(true);
    expect(ehCustoDaEmpresa("", "DARF")).toBe(true);
    expect(ehCustoDaEmpresa("GUIA FGTS", "FGTS")).toBe(true);
  });

  it("sem documento nenhum, essas palavras não classificam nada sozinhas", () => {
    // "Caixa" fora do contexto de guia é caixa de papelão, e "colaboradores"
    // sozinho não diz que a despesa é da empresa.
    expect(ehCustoDaEmpresa("CAIXA", "Compra de material")).toBe(false);
    expect(ehCustoDaEmpresa("COLABORADORES", "Confraternização")).toBe(false);
    expect(ehCustoDaEmpresa("Pix", "Despesa faxina")).toBe(false);
  });
});
