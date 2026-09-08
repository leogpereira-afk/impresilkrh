import { describe, expect, it } from "vitest";
import { codigoDoPlano, nomeDoPlano, planoDaDescricao, tipoDoPlanoErp } from "./tipoDoPlano";
import { juntarForaDaFolha, normalizarLinhas, type LinhaMubi } from "./mubiPagamentos";

// Toda combinação (conta do ERP → tipo) que existe HOJE na base, tirada do banco
// em 06/09/2026 com `split_part(descricao, ' · ', 2)`. Se o contador criar uma
// conta nova, ela entra aqui junto com o tipo que o RH espera.
const MATRIZ_REAL: [string, string][] = [
  ["2.1.1-Salário", "Salário"],
  ["2.1.2-Adiantamento", "Adiantamento"],
  ["2.1.3-Férias", "Férias"],
  ["2.1.4-13º Salário", "13º Salário"],
  ["2.1.5-Vale Transporte", "Vale Transporte"],
  ["2.1.6-Rescisão", "Rescisão"],
  ["2.1.9.1-Regular", "FGTS"],
  ["2.1.11-Horas Extras", "Horas Extras"],
  // numeração ATÉ junho/2026
  ["2.1.11.1-Diária", "Diária"],
  ["2.1.11.4-Hora Extra", "Horas Extras"],
  // numeração DE julho/2026 em diante — o contador renumerou
  ["2.1.11.1-Comissão interna", "Comissão"],
  ["2.1.11.2-Bônus", "Bônus"],
  ["2.1.11.3-Diária", "Diária"],
  ["2.1.11.4-Empreita", "Freelancer (Empreita)"],
  ["2.1.11.6-Hora Extra", "Horas Extras"],
  ["2.1.11.7-Incentivo de Viagens", "Incentivo de Viagens"],
  ["2.1.12-Comissão Interna", "Comissão"],
  ["2.1.12.1-Comercial", "Comissão"],
  ["2.1.12.2-Bônus", "Bônus"],
  ["2.1.13-Incentivo de Produtividade", "Incentivo de Produtividade"],
  ["2.1.14-Alimentação", "Alimentação"],
  ["2.1.16-Prestação de Serviços", "Prestação de Serviços"],
  ["2.1.19-Incentivo de Viagens", "Incentivo de Viagens"],
  ["2.11.1-Freelancer", "Freelancer (Empreita)"],
  ["2.3.2.1-Limpeza Escritório", "Limpeza/Faxina"],
];

describe("tipoDoPlanoErp — o nome da conta manda", () => {
  it.each(MATRIZ_REAL)("%s → %s", (plano, tipo) => {
    expect(tipoDoPlanoErp(plano)).toBe(tipo);
  });

  it("a MESMA subconta muda de tipo quando o contador troca o nome (renumeração de jul/2026)", () => {
    expect(tipoDoPlanoErp("2.1.11.1-Diária")).toBe("Diária");
    expect(tipoDoPlanoErp("2.1.11.1-Comissão interna")).toBe("Comissão");
    expect(tipoDoPlanoErp("2.1.11.3-Limpeza")).toBe("Limpeza/Faxina");
    expect(tipoDoPlanoErp("2.1.11.3-Diária")).toBe("Diária");
  });

  it("limpeza é categoria própria, venha de onde vier", () => {
    expect(tipoDoPlanoErp("2.1.11.5-Limpeza")).toBe("Limpeza/Faxina");
    expect(tipoDoPlanoErp("2.1.16.1-Faxina")).toBe("Limpeza/Faxina");
    expect(tipoDoPlanoErp("2.3.2.2-Limpeza Produção")).toBe("Limpeza/Faxina");
  });

  it("ignora acento, caixa e espaço a mais", () => {
    expect(tipoDoPlanoErp("2.1.11.1-COMISSAO   INTERNA")).toBe("Comissão");
    expect(tipoDoPlanoErp("2.1.3-férias")).toBe("Férias");
    expect(tipoDoPlanoErp("2.1.11.6-hora extra")).toBe("Horas Extras");
  });

  it("13º e Adiantamento vêm antes de Salário", () => {
    expect(tipoDoPlanoErp("2.1.4-13º Salário")).toBe("13º Salário");
    expect(tipoDoPlanoErp("2.1.4-Décimo Terceiro Salário")).toBe("13º Salário");
    expect(tipoDoPlanoErp("2.1.2-Adiantamento de Salário")).toBe("Adiantamento");
  });

  it("subconta sem nome que diga algo herda do pai pelo código", () => {
    expect(tipoDoPlanoErp("2.1.9.1-Regular")).toBe("FGTS");
    expect(tipoDoPlanoErp("2.1.9.2-Empréstimo Trabalhador")).toBe("FGTS");
    expect(tipoDoPlanoErp("2.1.20.1-Pró Vida")).toBe("Plano de Saúde");
  });

  // A ordem de POR_NOME é regra de dinheiro: cada um destes já esteve errado
  // numa versão do arquivo (revisão adversarial de 06/09/2026).
  it("nome que cita a guia é encargo: FGTS/INSS ganham de Rescisão", () => {
    expect(tipoDoPlanoErp("2.1.9.3-FGTS Rescisório")).toBe("FGTS");
    expect(tipoDoPlanoErp("2.1.9.3-Multa Rescisória FGTS")).toBe("FGTS");
    expect(tipoDoPlanoErp("2.1.10.1-INSS Rescisão")).toBe("INSS");
    expect(tipoDoPlanoErp("2.1.6-Rescisão")).toBe("Rescisão");
  });

  it("“Adiantamento de Férias” é Férias, não Adiantamento", () => {
    expect(tipoDoPlanoErp("2.1.3.1-Adiantamento de Férias")).toBe("Férias");
    expect(tipoDoPlanoErp("2.1.2-Adiantamento de Salário")).toBe("Adiantamento");
    expect(tipoDoPlanoErp("2.1.2-Adiantamento")).toBe("Adiantamento");
  });

  it("“família” não é “Amil”: Salário Família não vira Plano de Saúde", () => {
    expect(tipoDoPlanoErp("2.1.1.2-Salário Família")).toBe("Salário");
    expect(tipoDoPlanoErp("2.1.23-Auxílio Família")).toBe("Outros");
    expect(tipoDoPlanoErp("2.1.20-Amil")).toBe("Plano de Saúde");
    expect(tipoDoPlanoErp("2.1.20.2-Amil Saúde")).toBe("Plano de Saúde");
  });

  it("rescisão de férias fica em Rescisão (o mês do acerto manda)", () => {
    expect(tipoDoPlanoErp("2.1.6.1-Férias Rescisórias")).toBe("Rescisão");
  });

  it("2.1.11.x com nome desconhecido vira Outros — visível — e não Horas Extras", () => {
    expect(tipoDoPlanoErp("2.1.11.9-Verba nova")).toBe("Outros");
    expect(tipoDoPlanoErp("2.1.11.9-")).toBe("Outros");
  });

  it("sem nome e sem código conhecido, devolve o que foi pedido como reserva", () => {
    expect(tipoDoPlanoErp("")).toBe("Outros");
    expect(tipoDoPlanoErp("9.9-Coisa", "Reserva")).toBe("Reserva");
    expect(tipoDoPlanoErp("", "")).toBe("Outros");
  });

  it("codigoDoPlano / nomeDoPlano", () => {
    expect(codigoDoPlano("2.1.11.1-Comissão interna")).toBe("2.1.11.1");
    expect(nomeDoPlano("2.1.11.1-Comissão interna")).toBe("Comissão interna");
    expect(nomeDoPlano("2.1.11.1")).toBe("");
    expect(codigoDoPlano(" 2.1.1 - Salário ")).toBe("2.1.1");
  });
});

describe("planoDaDescricao — a conta gravada na descrição", () => {
  it("pega o último pedaço quando é uma conta", () => {
    expect(planoDaDescricao("COMISSÃO AGOSTO · 2.1.11.1-Comissão interna")).toBe("2.1.11.1-Comissão interna");
    expect(planoDaDescricao("2.1.1-Salário")).toBe("2.1.1-Salário");
  });
  it("descrição sem conta (planilha antiga, lançamento manual) devolve vazio", () => {
    expect(planoDaDescricao("Lançamento manual")).toBe("");
    expect(planoDaDescricao("Pagamento · sem conta")).toBe("");
    expect(planoDaDescricao(null)).toBe("");
  });
});

describe("juntarForaDaFolha — o que o filtro recusou, somado de várias páginas", () => {
  it("junta a mesma conta de páginas/meses diferentes", () => {
    expect(juntarForaDaFolha([
      [{ plano: "2.4.7-Limpeza", quantos: 1, total: 300 }],
      [{ plano: "2.4.7-Limpeza", quantos: 2, total: 600.5 }, { plano: "2.9.1-Empreita", quantos: 1, total: 100 }],
    ])).toEqual([
      { plano: "2.4.7-Limpeza", quantos: 3, total: 900.5 },
      { plano: "2.9.1-Empreita", quantos: 1, total: 100 },
    ]);
  });
  it("página de função antiga (sem o campo) não quebra", () => {
    expect(juntarForaDaFolha([undefined, undefined])).toEqual([]);
  });

  /* O destaque "parece nome de gente" (07/09/2026): a conta que o filtro de
     folha recusou mas cujo nome parece uma pessoa é a candidata a folha
     escondida — foi assim que a faxina sumiu quando o contador renumerou o
     plano. Começa pelo caso ruim: carimbar resposta que ninguém apurou. */
  it("página que não sabe do campo NÃO ganha um 'não parece gente'", () => {
    // Função antiga (sem redeploy) não manda `pareceGente`. Gravar `false`
    // aqui seria afirmar que alguém olhou e descartou — e ninguém olhou.
    const [conta] = juntarForaDaFolha([[{ plano: "2.4.7-Limpeza", quantos: 1, total: 300 }]]);
    expect("pareceGente" in conta).toBe(false);
  });

  it("basta um mês suspeitar para a conta ficar destacada nos outros", () => {
    const [conta] = juntarForaDaFolha([
      [{ plano: "2.7.5.2-Marcella Laiara", quantos: 1, total: 300 }],
      [{ plano: "2.7.5.2-Marcella Laiara", quantos: 1, total: 300, pareceGente: true }],
    ]);
    expect(conta.pareceGente).toBe(true);
    expect(conta.total).toBeCloseTo(600, 2);
  });

  it("nome de gente vem antes, mesmo valendo menos", () => {
    expect(juntarForaDaFolha([[
      { plano: "2.6.1-Energia Elétrica", quantos: 9, total: 9000 },
      { plano: "2.7.5.2-Marcella Laiara", quantos: 1, total: 300, pareceGente: true },
    ]]).map((c) => c.plano)).toEqual(["2.7.5.2-Marcella Laiara", "2.6.1-Energia Elétrica"]);
  });

  it("estorno grande não vai para o fim da fila por ser negativo", () => {
    // Ordenar por `b.total - a.total` jogava -8000 para depois de +50: o maior
    // buraco do mês ficava no rodapé, e o teto de 80 contas podia cortá-lo.
    expect(juntarForaDaFolha([[
      { plano: "2.9.1-Empreita", quantos: 1, total: 50 },
      { plano: "2.3.9-Estorno", quantos: 1, total: -8000 },
    ]]).map((c) => c.plano)).toEqual(["2.3.9-Estorno", "2.9.1-Empreita"]);
  });
});

describe("normalizarLinhas — o cliente decide o tipo, não a função no ar", () => {
  const linha = (planoContas: string, tipo: string): LinhaMubi => ({
    idMubi: "1", nome: "FULANA", ehColaborador: true, cpfCnpj: null, planoContas, tipo,
    descricao: "", valor: 1, dataVencimento: "2026-08-20", dataPagamento: null, status: "", formaPagamento: "", centroCusto: "",
  });
  it("corrige o tipo errado que uma função antiga mandou", () => {
    expect(normalizarLinhas([linha("2.1.11.1-Comissão interna", "Diária")])[0].tipo).toBe("Comissão");
    expect(normalizarLinhas([linha("2.1.11.3-Diária", "Limpeza/Faxina")])[0].tipo).toBe("Diária");
  });
  it("mantém o tipo da função só quando o ERP não mandou conta nenhuma", () => {
    expect(normalizarLinhas([linha("", "Estágio/Bolsa")])[0].tipo).toBe("Estágio/Bolsa");
    expect(normalizarLinhas([linha("", "")])[0].tipo).toBe("Outros");
  });

  it("conta que o ERP mandou e nós não reconhecemos vira Outros — não herda o palpite da função antiga", () => {
    // Com a função velha no ar, "2.1.11.9-Verba nova" volta como "Horas Extras"
    // (prefixo 2.1.11). Aceitar isso repetiria em silêncio o erro de julho.
    expect(normalizarLinhas([linha("2.1.11.9-Verba nova", "Horas Extras")])[0].tipo).toBe("Outros");
  });
  it("não mexe no resto da linha", () => {
    const l = linha("2.1.1-Salário", "Salário");
    expect(normalizarLinhas([l])[0]).toEqual({ ...l, tipo: "Salário" });
  });
});
