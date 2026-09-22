/* A lista de colaboradores em PDF (22/09/2026).
 *
 * Pedido do Léo: "ver em lista e baixar os dados via PDF para usar em outras
 * coisas". O "em outras coisas" é o que manda: o papel sai da tela e vai viver
 * sozinho — vira anexo, entra em reunião, volta daqui a três meses.
 *
 * Por isso os testes começam pelo caso ruim: um PDF filtrado que parece o
 * quadro inteiro. Quem exporta quase sempre exportou filtrado, e quem recebe
 * não tem como saber.
 */
import { describe, it, expect } from "vitest";
import {
  COLUNAS,
  descreverCobertura,
  descreverFiltros,
  linhaDoColaborador,
  camposDaFicha,
  montarColaboradoresPdf,
  montarFichasPdf,
  nomeDoArquivo,
  omissoesDaFicha,
  type ApoioDaLinha,
} from "./colaboradoresPdf";
import type { Colaborador } from "@/data/types";

const apoio: ApoioDaLinha = {
  nomeCargo: (c) => (c.cargoId === "aux" ? "Auxiliar de Produção" : ""),
  nomeArea: (a) => (a === "prod" ? "Produção" : ""),
  nomeNivel: (n) => (n === "jr" ? "Júnior" : ""),
  nomeStatus: (s) => (s === "ativo" ? "Ativo" : s === "inativo" ? "Desligado" : ""),
  nomeDe: (id) => (id === "pedro-ramos" ? "Pedro Ramos" : ""),
};

const pessoa = (extra: Partial<Colaborador> = {}): Colaborador =>
  ({
    id: "barbara-patricia-f-vasconcelos",
    nome: "Barbara Patrícia F. Vasconcelos",
    cpf: "14807012345",
    cargoId: "aux",
    areaId: "prod",
    nivelId: "jr",
    statusId: "ativo",
    dataAdmissao: "2024-03-11",
    email: "barbara@impresilk.com.br",
    telefone: "(31) 99999-0000",
    ...extra,
  }) as Colaborador;

describe("o caso ruim: papel filtrado com cara de quadro inteiro", () => {
  it("sem filtro nenhum, DIZ que é o quadro inteiro — não fica calado", () => {
    // Silêncio aqui seria lido como "é tudo", que é justamente a conclusão
    // perigosa quando na verdade estava filtrado.
    expect(descreverFiltros({})).toBe("Sem filtro: todo o quadro visível");
    expect(descreverFiltros()).toBe("Sem filtro: todo o quadro visível");
  });

  it("cada filtro da tela aparece no papel", () => {
    expect(descreverFiltros({ busca: "barbara" })).toContain('busca "barbara"');
    expect(descreverFiltros({ areas: ["Produção"] })).toContain("área Produção");
    expect(descreverFiltros({ areas: ["Produção", "Comercial"] })).toContain("áreas Produção, Comercial");
    expect(descreverFiltros({ status: "Férias" })).toContain("status Férias");
    expect(descreverFiltros({ cardSelecionado: "card Indisponíveis" })).toContain("card Indisponíveis");
    expect(descreverFiltros({ incluiInativos: true })).toContain("incluindo desligados");
  });

  it("vários filtros juntos entram todos, na ordem da tela", () => {
    const r = descreverFiltros({ busca: "ana", areas: ["Produção"], status: "Ativo", incluiInativos: true });
    expect(r).toBe("Recorte: busca \"ana\" · área Produção · status Ativo · incluindo desligados");
  });

  it("busca só de espaço não conta como filtro", () => {
    expect(descreverFiltros({ busca: "   " })).toBe("Sem filtro: todo o quadro visível");
  });
});

describe("quantos ficaram de fora, e por quê", () => {
  it("diz o que o recorte tirou E o que o acesso tirou — são coisas diferentes", () => {
    // 12 no papel, 30 que a pessoa podia ver, 93 no cadastro inteiro.
    const r = descreverCobertura(12, 30, 93);
    expect(r).toContain("12 colaborador(es) neste documento");
    expect(r).toContain("18 fora pelo recorte");
    expect(r).toContain("63 fora do seu acesso ou da direção");
  });

  it("sem nada de fora, não inventa ressalva", () => {
    expect(descreverCobertura(30, 30, 30)).toBe("30 colaborador(es) neste documento");
  });

  it("número torto não vira negativo na cara de quem lê", () => {
    // Defensivo: se o escopo vier menor que o mostrado (ordem de render), a
    // frase não pode dizer "-3 fora pelo recorte".
    expect(descreverCobertura(30, 10, 5)).toBe("30 colaborador(es) neste documento");
  });
});

describe("a linha de cada pessoa", () => {
  it("O ID VEM PRIMEIRO — é a chave para cruzar com outra planilha", () => {
    // Regra da casa: a pessoa é o ID, o nome só exibe. Num papel que vai ser
    // cruzado com outra lista, o nome repete e muda de grafia; o id não.
    const l = linhaDoColaborador(pessoa(), "cadastro", apoio);
    expect(l[0]).toBe("148070");
    expect(l[1]).toBe("Barbara Patrícia F. Vasconcelos");
  });

  it("cadastro sem CPF vira 'sem ID', nunca célula vazia", () => {
    expect(linhaDoColaborador(pessoa({ cpf: "" }), "cadastro", apoio)[0]).toBe("sem ID");
    expect(linhaDoColaborador(pessoa({ cpf: undefined }), "cadastro", apoio)[0]).toBe("sem ID");
  });

  it("campo vazio vira travessão — branco no papel parece erro de impressão", () => {
    const l = linhaDoColaborador(pessoa({ email: "", telefone: undefined, areaId: undefined }), "cadastro", apoio);
    expect(l).not.toContain("");
    expect(l.filter((x) => x === "—").length).toBeGreaterThan(0);
  });

  it("a data sai no formato que se lê aqui, e data inválida não vira lixo", () => {
    expect(linhaDoColaborador(pessoa(), "cadastro", apoio)[5]).toBe("11/03/2024");
    expect(linhaDoColaborador(pessoa({ dataAdmissao: "" }), "cadastro", apoio)[5]).toBe("—");
    expect(linhaDoColaborador(pessoa({ dataAdmissao: "11/03/2024" }), "cadastro", apoio)[5]).toBe("—");
  });

  it("motivação ZERO é valor, não ausência", () => {
    // 0% é um dado legítimo e preocupante. Virar travessão esconderia
    // exatamente a pessoa que mais precisa aparecer.
    const l = linhaDoColaborador(pessoa({ motivacao: 0 }), "comportamental", apoio);
    expect(l[3]).toBe("0%");
    expect(linhaDoColaborador(pessoa({ motivacao: undefined }), "comportamental", apoio)[3]).toBe("—");
  });

  it("cada visão tem tantas colunas quanto o cabeçalho promete", () => {
    for (const visao of ["cadastro", "custo", "comportamental"] as const) {
      expect(linhaDoColaborador(pessoa(), visao, apoio)).toHaveLength(COLUNAS[visao].length);
    }
  });

  it("custo sem lançamento no mês é travessão, não R$ 0,00", () => {
    // Zero não é resultado: "não teve custo" e "não busquei o mês" têm a mesma
    // cara, e no papel ninguém pode perguntar.
    const semCusto = linhaDoColaborador(pessoa(), "custo", apoio);
    expect(semCusto[3]).toBe("—");
    const comCusto = linhaDoColaborador(pessoa(), "custo", {
      ...apoio,
      custoDe: () => ({ total: "R$ 3.240,00", lancamentos: 4 }),
    });
    expect(comCusto[3]).toBe("R$ 3.240,00");
    expect(comCusto[4]).toBe("4");
  });
});

describe("o nome do arquivo", () => {
  it("diz a visão e a data, e não tem espaço", () => {
    const n = nomeDoArquivo("cadastro", "2026-09-22T13:40:00.000Z");
    expect(n).toBe("Impresilk-Colaboradores-cadastro-2026-09-22.pdf");
    expect(n).not.toContain(" ");
  });

  it("visões diferentes não se sobrescrevem na pasta de downloads", () => {
    const hoje = "2026-09-22T13:40:00.000Z";
    const nomes = (["cadastro", "custo", "comportamental"] as const).map((v) => nomeDoArquivo(v, hoje));
    expect(new Set(nomes).size).toBe(3);
  });
});

/* O PAPEL SAINDO DE VERDADE.
 *
 * A tela de Colaboradores exige login, então não dá para eu clicar no botão.
 * Esta é a prova honesta que sobra: rodar o MESMO gerador do navegador (jsPDF
 * + autoTable) e conferir o que saiu — não uma imitação da biblioteca, que
 * provaria só a minha aritmética.
 */
describe("o PDF sai mesmo", () => {
  const pedido = (extra = {}) => ({
    lista: [pessoa(), pessoa({ id: "outro", nome: "José Adilando Pereira", cpf: "98765432100", email: "" })],
    visao: "cadastro" as const,
    apoio,
    noEscopo: 30,
    totalCadastro: 93,
    agora: new Date("2026-09-22T13:40:00.000Z"),
    quem: "Leonardo Gonçalves",
    ...extra,
  });

  it("gera um PDF válido, com página e as duas linhas", async () => {
    const r = await montarColaboradoresPdf(pedido());
    expect(r.linhas).toBe(2);
    expect(r.arquivo).toBe("Impresilk-Colaboradores-cadastro-2026-09-22.pdf");
    expect(r.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
    // Assinatura de arquivo PDF: se não começa com %PDF, não é PDF.
    expect(r.doc.output("datauristring").startsWith("data:application/pdf")).toBe(true);
  });

  it("o recorte e a cobertura vão para o documento, não só para o retorno", async () => {
    const r = await montarColaboradoresPdf(pedido({ filtros: { busca: "ana", incluiInativos: true } }));
    expect(r.recorte).toContain('busca "ana"');
    expect(r.cobertura).toContain("28 fora pelo recorte");
    expect(r.cobertura).toContain("63 fora do seu acesso");
  });

  it("lista vazia não gera papel em branco sem explicação", async () => {
    // Página muda em branco é pior que nenhuma: quem abre acha que o sistema
    // não achou ninguém OU que quebrou, e não tem como distinguir.
    const r = await montarColaboradoresPdf(pedido({ lista: [] }));
    expect(r.linhas).toBe(0);
    expect(r.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });

  it("as três visões geram, e a de custo nomeia a competência", async () => {
    for (const visao of ["cadastro", "custo", "comportamental"] as const) {
      const r = await montarColaboradoresPdf(pedido({ visao, competencia: "Ago/2026" }));
      expect(r.doc.getNumberOfPages()).toBeGreaterThanOrEqual(1);
      expect(r.arquivo).toContain(visao);
    }
  });

  it("muita gente vira várias páginas — não corta no fim da primeira", async () => {
    const muitos = Array.from({ length: 120 }, (_, i) =>
      pessoa({ id: `p${i}`, nome: `Pessoa Número ${i} da Silva Sauro`, cpf: String(100000000 + i).padStart(11, "0") }),
    );
    const r = await montarColaboradoresPdf(pedido({ lista: muitos }));
    expect(r.linhas).toBe(120);
    expect(r.doc.getNumberOfPages()).toBeGreaterThan(1);
  });
});

/* A FICHA COMPLETA (22/09/2026).
 *
 * Pedido do Léo depois de ver a lista de 9 colunas: "o cadastro quero com tudo
 * que tem preenchido dele".
 *
 * Duas coisas podem dar errado aqui, e as duas são graves: o papel mostrar MAIS
 * do que a tela mostra (vazamento), ou mostrar MENOS sem avisar (uma ficha sem
 * salário se lê como "não tem salário", que é afirmação falsa sobre a pessoa).
 * Os testes começam por essas duas.
 */
const TUDO = {
  cpf: "14807012345", apelido: "barbara", dataNascimento: "1995-06-02", sexo: "Feminino",
  cnh: "AB", cidade: "Contagem", enderecoRua: "Rua das Flores", enderecoNumero: "120",
  enderecoBairro: "Centro", enderecoCep: "32000-000", conjugeNome: "João", qtdFilhos: 2,
  matriculaEsocial: "0001", valeTransporte: true, salario: 2800, adicionais: 300,
  refMin: 2400, refMax: 3200, enquadramento: "Dentro",
  perfilComportamental: "Sanguíneo", humor: "Motivado", motivacao: 80,
  riscoSaida: "Baixo", potencial: "Alto", pontosFortes: "Organização",
  contatoEmergencia: { nome: "Maria", parentesco: "Mãe", telefone: "(31) 98888-7777" },
  filhos: [{ nome: "Ana", nascimento: "2018-04-02" }],
} as Partial<Colaborador>;

const achar = (gs: ReturnType<typeof camposDaFicha>, rotulo: string) =>
  gs.flatMap((g) => g.campos).find(([r]) => r === rotulo)?.[1];

describe("a ficha não mostra mais do que a tela", () => {
  it("O CASO RUIM: sem permissão, salário e faixa saem MASCARADOS, não em claro", () => {
    const g = camposDaFicha(pessoa(TUDO), apoio, { sensiveis: false, gestao: true }, (n) => `R$ ${n}`);
    expect(achar(g, "Salário")).toBe("•••••");
    expect(achar(g, "Faixa do cargo")).toBe("•••••");
    // E o valor não pode reaparecer em campo nenhum. (Comparo VALOR a valor:
    // procurar "3200" no JSON inteiro acusava o CEP 32000-000 — asserção
    // larga demais, que falhava por coincidência de dígitos.)
    const valores = g.flatMap((x) => x.campos).map(([, v]) => v);
    expect(valores).not.toContain("R$ 2800");
    expect(valores).not.toContain("R$ 2400 a R$ 3200");
  });

  it("O CASO RUIM: sem permissão de gestão, o bloco inteiro não existe", () => {
    // Perfil, humor, motivação, risco e potencial nunca vão para o próprio
    // colaborador — a régua da tela diz isso e o papel obedece.
    const g = camposDaFicha(pessoa(TUDO), apoio, { sensiveis: true, gestao: false });
    expect(g.find((x) => x.grupo === "Gestão de pessoas")).toBeUndefined();
    expect(JSON.stringify(g)).not.toContain("Sanguíneo");
    expect(JSON.stringify(g)).not.toContain("Alto");
  });

  it("com permissão, os dois blocos aparecem inteiros", () => {
    const g = camposDaFicha(pessoa(TUDO), apoio, { sensiveis: true, gestao: true }, (n) => `R$ ${n}`);
    expect(achar(g, "Salário")).toBe("R$ 2800");
    expect(achar(g, "Faixa do cargo")).toBe("R$ 2400 a R$ 3200");
    expect(achar(g, "Perfil comportamental")).toBe("Sanguíneo");
    expect(achar(g, "Motivação")).toBe("80%");
  });
});

describe("o que a permissão tirou é DITO, não calado", () => {
  it("avisa quando havia remuneração e o acesso não deixou ver", () => {
    const r = omissoesDaFicha(pessoa(TUDO), { sensiveis: false, gestao: true });
    expect(r).toContain("remuneração");
  });

  it("avisa quando havia dado de gestão e o acesso não deixou ver", () => {
    const r = omissoesDaFicha(pessoa(TUDO), { sensiveis: true, gestao: false });
    expect(r).toContain("gestão de pessoas");
  });

  it("NÃO inventa aviso quando o campo simplesmente não estava preenchido", () => {
    // Avisar "há remuneração que você não vê" numa ficha que não tem salário
    // seria mentira na direção contrária — e ensinaria a ignorar o aviso.
    const vazio = pessoa({ salario: undefined, adicionais: undefined, refMin: undefined, refMax: undefined });
    expect(omissoesDaFicha(vazio, { sensiveis: false, gestao: false })).toBe("");
  });

  it("com acesso total, não há aviso nenhum", () => {
    expect(omissoesDaFicha(pessoa(TUDO), { sensiveis: true, gestao: true })).toBe("");
  });
});

describe("só o que está preenchido", () => {
  const perm = { sensiveis: true, gestao: true };

  it("campo vazio NÃO vira linha — 40 travessões escondem os 12 dados que existem", () => {
    const g = camposDaFicha(pessoa({ email: "", telefone: "", cpf: "" }), apoio, perm);
    const rotulos = g.flatMap((x) => x.campos).map(([r]) => r);
    expect(rotulos).not.toContain("E-mail");
    expect(rotulos).not.toContain("CPF");
  });

  it("grupo sem nada preenchido some inteiro, nem como título vazio", () => {
    const g = camposDaFicha(pessoa({ conjugeNome: "", qtdFilhos: 0, filhos: [] }), apoio, perm);
    expect(g.find((x) => x.grupo === "Família")).toBeUndefined();
  });

  it("os compostos viram texto legível, não [object Object]", () => {
    const g = camposDaFicha(pessoa(TUDO), apoio, perm);
    expect(achar(g, "Contato de emergência")).toBe("Maria · Mãe · (31) 98888-7777");
    expect(achar(g, "Nomes dos filhos")).toBe("Ana · 02/04/2018");
    expect(achar(g, "Endereço")).toBe("Rua das Flores, 120");
    expect(JSON.stringify(g)).not.toContain("object Object");
  });

  it("gestor e padrinho saem pelo NOME, não pelo id", () => {
    const g = camposDaFicha(pessoa({ gestorId: "pedro-ramos" }), apoio, perm);
    expect(achar(g, "Gestor")).toBe("Pedro Ramos");
  });

  it("zero filhos não é 'preenchido' — mas vale transporte 'não' é", () => {
    const g = camposDaFicha(pessoa({ qtdFilhos: 0, valeTransporte: false }), apoio, perm);
    expect(achar(g, "Filhos")).toBeUndefined();
    expect(achar(g, "Vale transporte")).toBe("Não");
  });
});

describe("as fichas saem em papel", () => {
  it("uma página por pessoa, mais a capa", async () => {
    const r = await montarFichasPdf({
      lista: [pessoa(TUDO), pessoa({ id: "b", nome: "José Adilando Pereira", cpf: "98765432100" })],
      visao: "cadastro", apoio, noEscopo: 2, totalCadastro: 93,
      agora: new Date("2026-09-22T13:40:00.000Z"),
      permissaoDe: () => ({ sensiveis: true, gestao: true }),
      fmtDinheiro: (n) => `R$ ${n},00`,
    });
    // Capa + pelo menos uma folha por pessoa. A ficha muito preenchida ocupa
    // duas, então o piso é 3 e não um número fixo.
    expect(r.doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
    expect(r.arquivo).toContain("fichas");
    expect(r.doc.output("datauristring").startsWith("data:application/pdf")).toBe(true);
  });

  it("ficha sem nada preenchido não vira folha muda", async () => {
    const r = await montarFichasPdf({
      lista: [{ id: "x", nome: "Só o Nome" } as Colaborador],
      visao: "cadastro", apoio: { ...apoio, nomeCargo: () => "", nomeArea: () => "", nomeNivel: () => "", nomeStatus: () => "" },
      noEscopo: 1, totalCadastro: 1,
      agora: new Date("2026-09-22T13:40:00.000Z"),
      permissaoDe: () => ({ sensiveis: true, gestao: true }),
    });
    expect(r.doc.getNumberOfPages()).toBe(2);
  });

  it("mais gente, mais folhas — ninguém fica de fora do maço", async () => {
    const base = {
      visao: "cadastro" as const, apoio, noEscopo: 9, totalCadastro: 93,
      agora: new Date("2026-09-22T13:40:00.000Z"),
      permissaoDe: () => ({ sensiveis: true, gestao: true }),
    };
    const tres = await montarFichasPdf({ ...base, lista: Array.from({ length: 3 }, (_, i) => pessoa({ id: `p${i}` })) });
    const nove = await montarFichasPdf({ ...base, lista: Array.from({ length: 9 }, (_, i) => pessoa({ id: `p${i}` })) });
    expect(nove.doc.getNumberOfPages()).toBeGreaterThan(tres.doc.getNumberOfPages());
    expect(nove.linhas).toBe(9);
  });
});
