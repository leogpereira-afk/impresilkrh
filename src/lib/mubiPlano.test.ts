import { equivalenciasDeContas } from "./renumeracao";
import { describe, expect, it } from "vitest";
import { compararPlano, competenciaEhDoContador, ehContaPessoal, juntarContas, mesclarPlano, montarPlanoDoErp, type ContaMubi } from "./mubiPlano";
import type { ClasseCusto, ContaPlano } from "@/data/types";

const c = (codigo: string, valor: number, nome = codigo, quantos = 1): ContaMubi => ({ codigo, nome, valor, quantos });
const classes = new Map<string, ClasseCusto>([
  ["2.1.1", "individual"], ["2.1.11", "individual"], ["2.1.12", "individual"], ["2.1.20", "individual"],
  ["2.1.14", "rateio"], ["2.1.15", "rateio"], ["2.1.17", "rateio"], ["2.2.2", "rateio"],
  ["2.1.9", "encargo"],
]);

describe("juntarContas — páginas do mesmo mês", () => {
  it("soma a mesma conta vinda de duas páginas e ordena por código", () => {
    expect(juntarContas([[c("2.1.11", 100.5), c("2.1.1", 200)], [c("2.1.11", 50.25)]])).toEqual([
      { codigo: "2.1.1", nome: "2.1.1", valor: 200, quantos: 1 },
      { codigo: "2.1.11", nome: "2.1.11", valor: 150.75, quantos: 2 },
    ]);
  });
  it("ordena por número, não por texto: 2.1.2 vem antes de 2.1.11", () => {
    expect(juntarContas([[c("2.1.11", 1), c("2.1.2", 1), c("2.1.1", 1)]]).map((x) => x.codigo)).toEqual(["2.1.1", "2.1.2", "2.1.11"]);
  });
  it("nome vazio numa página não apaga o nome que veio na outra", () => {
    expect(juntarContas([[c("2.1.1", 1, "")], [c("2.1.1", 1, "Salário")]])[0].nome).toBe("Salário");
  });
});

describe("ehContaPessoal — o que já entra por pessoa não entra pelo plano", () => {
  it("classe individual, na conta ou no pai (o contador renumera subconta)", () => {
    expect(ehContaPessoal("2.1.1", "Salário", classes)).toBe(true);
    expect(ehContaPessoal("2.1.11.6", "Hora Extra", classes)).toBe(true);   // herda de 2.1.11
    expect(ehContaPessoal("2.1.12.1", "Comercial", classes)).toBe(true);    // herda de 2.1.12
  });
  it("pelo NOME, mesmo sem classe: a régua da folha", () => {
    expect(ehContaPessoal("2.9.9", "Comissão interna", new Map())).toBe(true);
    expect(ehContaPessoal("2.9.8", "Diária", new Map())).toBe(true);
    expect(ehContaPessoal("2.11.1", "Freelancer", new Map())).toBe(true);
  });
  it("coletivo e encargo NÃO são pessoais", () => {
    expect(ehContaPessoal("2.1.14", "Alimentação", classes)).toBe(false);
    expect(ehContaPessoal("2.1.15.4", "Aniversário do mês", classes)).toBe(false);
    expect(ehContaPessoal("2.1.9.1", "Regular", classes)).toBe(false);       // FGTS é encargo
    expect(ehContaPessoal("2.1.17", "Treinamentos", classes)).toBe(false);
    expect(ehContaPessoal("2.3.1", "Energia", new Map())).toBe(false);
  });
});

describe("montarPlanoDoErp — três baldes de fora, e o que entra vem marcado", () => {
  const erp = [
    c("2.1.1", 37850.05, "Salário"),               // pessoal (classe)
    c("2.1.11.1", 12314.95, "Comissão interna"),   // pessoal (pai 2.1.11 + nome)
    c("2.1.14", 2308.38, "Alimentação"),           // rateio → entra
    c("2.1.9.1", 15424.33, "Regular"),             // encargo → entra
    c("2.14.1.2", 6000, "Pedro Ramos Pereira"),    // societária → fora
    c("2.14.3.1", 1000, "Credinor"),               // 2.14 inteiro → fora
    c("3.1", 500, "Receita"),                      // não é do grupo 2 → não reconhecida
    c("ABC", 10, "Sem código"),                    // não é código → não reconhecida
  ];
  const r = montarPlanoDoErp(erp, "2026-08", classes);

  it("só coletivo e encargo entram, como folha e com origem erp", () => {
    expect(r.contas.map((x) => x.codigo)).toEqual(["2.1.14", "2.1.9.1"]);
    expect(r.contas[0]).toEqual({ id: "pc_2026-08_2.1.14", competencia: "2026-08", codigo: "2.1.14", nome: "Alimentação", valor: 2308.38, folha: true, origem: "erp" });
  });
  it("pessoal fica de fora, mas visível", () => {
    expect(r.pessoais.map((x) => x.codigo)).toEqual(["2.1.1", "2.1.11.1"]);
  });
  it("2.14 fica de fora — inclusive 2.14.3, que ehContaConfidencial ainda não cobre", () => {
    expect(r.societarias.map((x) => x.codigo)).toEqual(["2.14.1.2", "2.14.3.1"]);
  });
  it("código estranho não some: vai para não reconhecidas", () => {
    expect(r.naoReconhecidas.map((x) => x.codigo)).toEqual(["3.1", "ABC"]);
  });
  it("nada se perde: as quatro listas somam a entrada", () => {
    expect(r.contas.length + r.pessoais.length + r.societarias.length + r.naoReconhecidas.length).toBe(erp.length);
  });
  it("valor inválido não entra em lugar nenhum", () => {
    const x = montarPlanoDoErp([{ codigo: "2.1.14", nome: "x", valor: NaN, quantos: 1 }], "2026-08", classes);
    expect(x.contas).toEqual([]);
  });
});

const conta = (codigo: string, valor: number, extra: Partial<ContaPlano> = {}): ContaPlano =>
  ({ id: `pc_2026-06_${codigo}`, competencia: "2026-06", codigo, nome: codigo, valor, folha: true, ...extra });

describe("competenciaEhDoContador", () => {
  it("linha sem origem é da planilha; só ERP não é do contador", () => {
    expect(competenciaEhDoContador([conta("2.1.1", 1)], "2026-06")).toBe(true);
    expect(competenciaEhDoContador([conta("2.1.14", 1, { origem: "erp" })], "2026-06")).toBe(false);
    expect(competenciaEhDoContador([conta("2.1.14", 1, { origem: "erp" }), conta("2.1.1", 1)], "2026-06")).toBe(true);
    expect(competenciaEhDoContador([conta("2.1.1", 1)], "2026-07")).toBe(false);
  });
});

describe("mesclarPlano — entra o que veio, fica o que já existia", () => {
  it("substitui a mesma conta do mesmo mês, mantém outros meses e o que é do contador — e descarta a linha do ERP que não voltou", () => {
    const atual = [
      conta("2.1.14", 100, { origem: "erp" }), // volta com valor novo
      conta("2.1.9.1", 500, { origem: "erp" }), // NÃO voltou: era do ERP, sai (a versão velha carregava a classificação errada)
      conta("2.3.1", 40), // do contador, no mesmo mês: fica
      conta("2.1.14", 77, { competencia: "2026-05", id: "pc_2026-05_2.1.14" }), // outro mês: fica
    ];
    const novo = [conta("2.1.14", 120, { origem: "erp" }), conta("2.1.17", 30, { origem: "erp" })];
    const r = mesclarPlano(atual, novo, "2026-06");
    expect(r.map((x) => `${x.competencia}:${x.codigo}:${x.valor}`).sort()).toEqual([
      "2026-05:2.1.14:77", "2026-06:2.1.14:120", "2026-06:2.1.17:30", "2026-06:2.3.1:40",
    ]);
  });
  it("nunca apaga o que é do contador: conta que o ERP não trouxe continua", () => {
    expect(mesclarPlano([conta("2.1.9", 900)], [], "2026-06")).toHaveLength(1);
  });
  it("a linha societária que uma puxada antiga deixou passar SAI na puxada seguinte", () => {
    // 07/09/2026: 2.11.2.2 "Leonardo" entrou antes da equivalência; a puxada
    // nova (que já corta no servidor) não a traz — e ela não pode ficar.
    const atual = [conta("2.11.2.2", 28105.64, { origem: "erp" }), conta("2.1.9.1", 500, { origem: "erp" })];
    const novo = [conta("2.1.9.1", 500, { origem: "erp" })];
    expect(mesclarPlano(atual, novo, "2026-06").map((x) => x.codigo)).toEqual(["2.1.9.1"]);
  });
});

describe("compararPlano — os baldes do 'somem' e as confidenciais", () => {
  it("separa zeradas, contas-pai e folhas com dinheiro — e diz o R$ das que importam", () => {
    const atual = [
      conta("2", 1000, { folha: false }), conta("2.1", 1000, { folha: false }),
      conta("2.1.4", 0), conta("2.1.7", 0),
      conta("2.1.9", 900), conta("2.1.3", 100),
      conta("2.1.14", 56),
    ];
    const novo = [conta("2.1.14", 56, { origem: "erp" })];
    const r = compararPlano(atual, novo);
    expect(r.iguais).toBe(1);
    expect(r.somem).toBe(6);
    expect(r.somemZeradas).toBe(2);
    expect(r.somemPais).toBe(2);
    expect(r.somemComValor).toBe(2);
    expect(r.valorQueSome).toBe(1000);
  });
  it("quem não é master não vê linha 2.14 — e o total também não a inclui", () => {
    const atual = [conta("2.14.2", 35000), conta("2.1.14", 56)];
    const aberta = compararPlano(atual, [], {});
    const fechada = compararPlano(atual, [], { ocultarConfidenciais: true });
    expect(aberta.linhas.map((l) => l.codigo)).toEqual(["2.1.14", "2.14.2"]);
    expect(fechada.linhas.map((l) => l.codigo)).toEqual(["2.1.14"]);
    expect(fechada.confidenciaisOcultas).toBe(1);
    expect(fechada.totalAntes).toBe(56);
    expect(aberta.totalAntes).toBe(35056);
  });
  it("diferença de centavo não conta como mudança", () => {
    expect(compararPlano([conta("2.1.14", 100)], [conta("2.1.14", 100.004)]).mudaram).toBe(0);
  });
});

describe("montarPlanoDoErp com a equivalência de contas (renumeração de jul/2026)", () => {
  const REF = [
    { codigo: "2.1.14", nome: "Alimentação" },
    { codigo: "2.1.18", nome: "Minas Brasil" },
    { codigo: "2.2.2", nome: "Contribuição Sindical" },
    { codigo: "2.2.3", nome: "CDL" },
    { codigo: "2.14.2.2", nome: "Leonardo" },
    { codigo: "2.14.2.1", nome: "Contas pagas" },
  ];
  const HOJE = [
    { codigo: "2.1.14", nome: "Contribuição Sindical", valor: 2526.42, quantos: 1 },
    { codigo: "2.1.15.1", nome: "Minas Brasil", valor: 452.5, quantos: 1 },
    { codigo: "2.11.2.2", nome: "Leonardo", valor: 28105.64, quantos: 3 },
    { codigo: "2.2.2", nome: "CDL", valor: 89, quantos: 1 },
    { codigo: "2.99", nome: "Conta Nova", valor: 10, quantos: 1 },
  ];
  const classes = new Map<string, "individual" | "rateio" | "encargo" | "confidencial" | "ignorar">([["2.1.14", "rateio"], ["2.2.2", "rateio"], ["2.1.18", "individual"]]);
  const eq = equivalenciasDeContas(REF, HOJE, { prefixosConfidenciais: ["2.14"] });
  const r = montarPlanoDoErp(HOJE, "2026-07", classes, eq);

  it("classifica pelo código de referência: Minas Brasil (agora 2.1.15.1) é individual e sai do plano", () => {
    expect(r.pessoais.map((c) => c.codigo)).toEqual(["2.1.15.1"]);
  });
  it("a retirada do Leonardo, renumerada para fora de 2.14, é cortada como societária", () => {
    expect(r.societarias.map((c) => c.codigo)).toEqual(["2.11.2.2"]);
    expect(r.contas.some((c) => c.codigo === "2.11.2.2")).toBe(false);
  });
  it("a conta renumerada entra com o código de hoje e guarda o de referência", () => {
    const sind = r.contas.find((c) => c.codigo === "2.1.14")!;
    expect(sind.equivaleA).toBe("2.2.2");
    const cdl = r.contas.find((c) => c.codigo === "2.2.2")!;
    expect(cdl.equivaleA).toBe("2.2.3");
    expect(r.renumeradas).toBe(2);
  });
  it("conta sem par entra, mas é dita", () => {
    expect(r.semPar.map((c) => c.codigo)).toEqual(["2.99"]);
    expect(r.contas.find((c) => c.codigo === "2.99")?.equivaleA).toBeUndefined();
  });
  it("sem equivalência, comporta-se como antes (código literal)", () => {
    const sem = montarPlanoDoErp(HOJE, "2026-07", classes, null);
    expect(sem.renumeradas).toBe(0);
    expect(sem.semPar).toEqual([]);
    expect(sem.contas.some((c) => c.codigo === "2.11.2.2")).toBe(true); // é exatamente o furo que a equivalência fecha
  });
});
