/* AS DUAS TELAS DE VERDADE: Colaboradores no filtro Freelancer e o bloco
 * "No quadro como Freelancer, sem contrato" em Freelancers (30/09/2026).
 *
 * A regra tem teste próprio (lib/freelancerNoQuadro.test.ts). Aqui o que se
 * prova é o consumidor: a tela montada, com as coleções e a sessão trocadas
 * por dados fictícios, mostra o que a regra decidiu. É onde o erro costuma
 * morar: a regra certa e a tela contando por conta própria, o card somando o
 * contrato, o botão que "só preenche" chamando o criar, o arquivo exportado
 * dizendo outra coisa que a lista.
 *
 * Nada aqui toca banco nem armazenamento: store, sessão, domínio e toast são
 * trocados por dublês. Dados fictícios (o repositório é público); os CPFs têm
 * dígitos verificadores certos, montados a partir de 900001001, cada um com
 * um ID diferente. */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Colaborador, Freelancer } from "@/data/types";
import type { PedidoDePdf } from "@/lib/colaboradoresPdf";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const estado = vi.hoisted(() => ({
  sessao: null as { perfil: "ADMIN_RH" | "GESTOR" | "COLABORADOR"; colaboradorId: string } | null,
  colecoes: {} as Record<string, unknown[]>,
  vazio: [] as unknown[],
  dominio: {} as Record<string, unknown>,
  criar: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  atualizar: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  remover: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  toast: null as unknown as ReturnType<typeof import("vitest").vi.fn>,
  pedidoPdf: null as unknown,
  pedidoFichas: null as unknown,
}));

vi.mock("@/lib/store", async (orig) => ({
  ...(await orig<typeof import("@/lib/store")>()),
  useColecao: (nome: string) => ({
    items: estado.colecoes[nome] ?? estado.vazio,
    criar: estado.criar, atualizar: estado.atualizar, remover: estado.remover,
    criarOuAtualizar: () => {}, definir: () => {},
  }),
}));
vi.mock("@/lib/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/session")>()),
  useSessao: () => estado.sessao,
}));
vi.mock("@/lib/dominio", async (orig) => ({
  ...(await orig<typeof import("@/lib/dominio")>()),
  useDominio: () => estado.dominio,
}));
vi.mock("@/components/ui/toast", async (orig) => ({
  ...(await orig<typeof import("@/components/ui/toast")>()),
  useToast: () => estado.toast,
}));
/* O PDF de verdade é montado (montarColaboradoresPdf), só não é salvo: o
   jsdom não baixa arquivo. O pedido fica guardado para conferir o que a tela
   mandou. */
vi.mock("@/lib/colaboradoresPdf", async (orig) => {
  const real = await orig<typeof import("@/lib/colaboradoresPdf")>();
  return {
    ...real,
    exportarColaboradoresPdf: async (p: PedidoDePdf) => {
      estado.pedidoPdf = p;
      const { doc, ...resto } = await real.montarColaboradoresPdf(p);
      void doc;
      return resto;
    },
    exportarFichasPdf: async (p: Parameters<typeof real.montarFichasPdf>[0]) => {
      estado.pedidoFichas = p;
      const { doc, ...resto } = await real.montarFichasPdf(p);
      void doc;
      return resto;
    },
  };
});

import Colaboradores from "./Colaboradores";
import Freelancers from "./Freelancers";

const CPF_A = "900.001.001-29";
const CPF_C = "90000300306";

const pessoa = (extra: Partial<Colaborador>): Colaborador =>
  ({ statusId: "freelancer", dataAdmissao: "2020-01-02", areaId: "producao", gestorId: "gestor-ficticio", ...extra }) as Colaborador;
const fichaA = pessoa({ id: "fa", nome: "Alfa Freelancer Fictício", cpf: CPF_A, apelido: "alfa", telefone: "(38) 90000-0001", email: "alfa@exemplo.test" });
const fichaC = pessoa({ id: "fc", nome: "Gama Freelancer Fictício", cpf: CPF_C });
const fichaClt = pessoa({ id: "fx", nome: "Delta CLT Fictício", statusId: "ativo", cpf: "90000400432" });
const gestor = pessoa({ id: "gestor-ficticio", nome: "Gestor Fictício", statusId: "ativo", gestorId: undefined, cpf: "91000500594" });
const COLABS = [fichaA, fichaC, fichaClt, gestor];

const contrato = (extra: Partial<Freelancer>): Freelancer =>
  ({ funcao: "Montador", situacao: "ativo", contratoInicio: "2026-09-01", contratoFim: "2026-12-31", ...extra }) as Freelancer;
// Mesmo CPF da fichaA, só com dígitos, e com outro nome: se vazar como linha, aparece.
const kA = contrato({ id: "k-a", nome: "Alfa Nome no Contrato", cpf: "90000100129" });
const kB = contrato({ id: "k-b", nome: "Beta Instalador Fictício", funcao: "Instalador", cpf: "90000200263" });
const kS = contrato({ id: "k-s", nome: "Épsilon Instalador Fictício", funcao: "Instalador", cpf: "" });
const kE = contrato({ id: "k-e", nome: "Zeta Encerrado Fictício", situacao: "encerrado", cpf: "" });
const kV = contrato({ id: "k-v", nome: "Eta Vencido Fictício", contratoFim: "2026-01-31", cpf: "" });
const CONTRATOS = [kA, kB, kS, kE, kV];

function dominioFalso(colaboradores: Colaborador[]) {
  const status = [
    { id: "ativo", nome: "Ativo", cor: "#16a34a", ordem: 1 },
    { id: "freelancer", nome: "Freelancer", cor: "#7c3aed", ordem: 3 },
    { id: "inativo", nome: "Inativo", cor: "#64748b", ordem: 9 },
  ];
  const statusById = new Map(status.map((s) => [s.id, s]));
  const colabById = new Map(colaboradores.map((c) => [c.id, c]));
  return {
    areas: [{ id: "producao", nome: "Produção" }],
    status, statusById, colaboradores, colabById, cargoById: new Map(),
    nomeArea: (id?: string) => (id === "producao" ? "Produção" : ""),
    nomeCargo: () => "Cargo Fictício",
    nomeNivel: () => "",
    nomeStatus: (id?: string) => statusById.get(id ?? "")?.nome ?? "",
    corStatus: (id?: string) => statusById.get(id ?? "")?.cor ?? "#64748b",
    enquadrarColab: () => "Sem dados",
    subareaDe: () => "Geral",
    nomeColab: (id: string) => colabById.get(id)?.nome ?? "",
  };
}

let el: HTMLDivElement;
let root: Root;
beforeEach(() => {
  estado.sessao = { perfil: "ADMIN_RH", colaboradorId: "rh-ficticio" };
  estado.colecoes = { freelancers: CONTRATOS };
  estado.dominio = dominioFalso(COLABS);
  estado.criar = vi.fn();
  estado.atualizar = vi.fn();
  estado.remover = vi.fn();
  estado.toast = vi.fn();
  estado.pedidoPdf = null;
  estado.pedidoFichas = null;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-30T12:00:00-03:00"));
  el = document.createElement("div");
  document.body.append(el);
  root = createRoot(el);
});
afterEach(() => {
  act(() => root.unmount());
  el.remove();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

/* A chave nova a cada montagem força o roteador a nascer de novo: o
   MemoryRouter só lê `initialEntries` ao montar, e trocar a URL por render
   deixaria a tela no endereço anterior sem avisar. */
let montagem = 0;
const montar = (tela: React.ReactNode, url: string) =>
  act(() => root.render(<MemoryRouter key={++montagem} initialEntries={[url]}>{tela}</MemoryRouter>));
const tabela = () => el.querySelector("table") as HTMLTableElement;
const linhaCom = (texto: string) => [...tabela().querySelectorAll("tbody tr")].find((tr) => tr.textContent?.includes(texto));
const ultima = (a: string[]) => a[a.length - 1];
const lerBlob = (b: Blob) =>
  new Promise<string>((ok) => {
    const leitor = new FileReader();
    leitor.onload = () => ok(String(leitor.result));
    leitor.readAsText(b);
  });
const vezes = (raiz: Element, texto: string) => (raiz.textContent ?? "").split(texto).length - 1;
const cardFreelancer = () =>
  [...el.querySelectorAll("button")].find((b) => b.querySelector(".text-xl") && b.textContent?.includes("Freelancer"))!;
const totalNaEmpresa = () =>
  [...el.querySelectorAll("p")].find((p) => /pessoas? na empresa hoje/.test(p.textContent ?? "") && p.querySelector("strong"))!.textContent!;

describe("Colaboradores no filtro Freelancer", () => {
  it("a ficha com contrato do mesmo CPF aparece UMA vez, com a tag; os outros contratos ativos em linha própria", () => {
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    const t = tabela();
    expect(vezes(t, "Alfa Freelancer Fictício")).toBe(1);
    expect(t.textContent).not.toContain("Alfa Nome no Contrato");
    expect(linhaCom("Alfa Freelancer Fictício")!.textContent).toContain("Contrato");
    expect(linhaCom("Gama Freelancer Fictício")!.textContent).not.toContain("Contrato");

    const beta = linhaCom("Beta Instalador Fictício")!;
    expect(beta.textContent).toContain("Contrato de freelancer");
    expect(beta.textContent).toContain("Freelancer (contrato)");
    expect(beta.textContent).toContain("Instalador");
    expect(beta.textContent).toContain("até 31/12/2026");
    expect(beta.querySelector("a")!.getAttribute("href")).toBe("/freelancers?contrato=k-b");
    expect(beta.textContent).not.toContain("CPF pendente");
    expect(linhaCom("Épsilon Instalador Fictício")!.textContent).toContain("CPF pendente");

    // A lista do celular diz o mesmo, sem duplicar a pessoa.
    const celular = el.querySelector('[aria-label="Pessoas encontradas"]')!;
    expect(vezes(celular, "Alfa Freelancer Fictício")).toBe(1);
    expect(celular.textContent).toContain("Beta Instalador Fictício");
  });

  it("contrato encerrado e contrato vencido não aparecem", () => {
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    expect(el.textContent).not.toContain("Zeta Encerrado Fictício");
    expect(el.textContent).not.toContain("Eta Vencido Fictício");
  });

  it("contrato não entra nas contagens: card e total são os mesmos com e sem contrato; o +N bate com as linhas", () => {
    estado.colecoes = { freelancers: [] };
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    const cardSem = cardFreelancer().querySelector(".text-xl")!.textContent;
    const totalSem = totalNaEmpresa();
    expect(cardFreelancer().textContent).not.toContain("por contrato");

    estado.colecoes = { freelancers: CONTRATOS };
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    expect(cardFreelancer().querySelector(".text-xl")!.textContent).toBe(cardSem);
    expect(cardSem).toBe("2");
    expect(totalNaEmpresa()).toBe(totalSem);
    expect(totalSem).toMatch(/^4 pessoas na empresa hoje/);

    const linhasDeContrato = [...tabela().querySelectorAll("tbody tr")].filter((tr) => tr.textContent?.includes("Freelancer (contrato)"));
    expect(linhasDeContrato).toHaveLength(2);
    expect(cardFreelancer().textContent).toContain(`+${linhasDeContrato.length} por contrato`);
    // O cabeçalho conta à parte.
    expect(el.textContent).toContain("2 colaborador(es) no seu escopo de acesso. Mais 2 contrato(s) de freelancer, fora do quadro.");
  });

  it("clicar no card Freelancer também é o filtro Freelancer", () => {
    montar(<Colaboradores />, "/colaboradores");
    act(() => cardFreelancer().click());
    expect(linhaCom("Beta Instalador Fictício")).toBeTruthy();
    expect(vezes(tabela(), "Alfa Freelancer Fictício")).toBe(1);
  });

  it("em Todos e em outro status nada muda", () => {
    for (const url of ["/colaboradores", "/colaboradores?status=ativo"]) {
      montar(<Colaboradores />, url);
      expect(tabela().textContent, url).not.toContain("Beta Instalador Fictício");
      expect(tabela().textContent, url).not.toContain("Freelancer (contrato)");
      expect(tabela().textContent, url).not.toContain("Contrato");
    }
  });

  it("quem não pode abrir /freelancers não vê linha de contrato, tag nem +N", () => {
    estado.sessao = { perfil: "GESTOR", colaboradorId: "gestor-ficticio" };
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    expect(vezes(tabela(), "Alfa Freelancer Fictício")).toBe(1);
    expect(el.textContent).not.toContain("Beta Instalador Fictício");
    expect(el.textContent).not.toContain("Freelancer (contrato)");
    expect(tabela().textContent).not.toContain("Contrato");
    expect(el.textContent).not.toContain("por contrato");
  });

  it("GESTOR com o módulo freelancers liberado continua sem ver: o perfil da rota é só ADMIN_RH", () => {
    estado.sessao = { perfil: "GESTOR", colaboradorId: "gestor-ficticio" };
    estado.colecoes = { freelancers: CONTRATOS, usuarios: [{ id: "u", colaboradorId: "gestor-ficticio", ativo: true, permissoes: ["freelancers", "colaboradores"] }] };
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    expect(el.textContent).not.toContain("Beta Instalador Fictício");
  });
});

describe("os arquivos mostram o que a tela mostra", () => {
  it("CSV: coluna do contrato, linha de contrato com Status próprio e vazia onde não há dado", async () => {
    let blob: Blob | null = null;
    const criarUrl = vi.fn((b: Blob) => { blob = b; return "blob:ficticio"; });
    Object.assign(URL, { createObjectURL: criarUrl, revokeObjectURL: vi.fn() });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    try {
      montar(<Colaboradores />, "/colaboradores?status=freelancer");
      const botao = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("Exportar CSV"))!;
      act(() => botao.click());
      const texto = (await lerBlob(blob!)).replace(/^\uFEFF/, "");
      const [cab, ...linhas] = texto.split("\r\n");
      const colunas = cab.split(";");
      expect(ultima(colunas)).toBe("Contrato de freelancer");
      const doNome = (nome: string) => linhas.find((l) => l.startsWith(`"${nome}"`))!;
      const beta = doNome("Beta Instalador Fictício").split(";");
      expect(beta).toHaveLength(colunas.length);
      expect(beta[colunas.indexOf("Status")]).toBe('"Freelancer (contrato)"');
      expect(beta[colunas.indexOf("Cargo")]).toBe('"Instalador"');
      expect(beta[colunas.indexOf("Área")]).toBe('""');
      expect(beta[colunas.indexOf("Admissão")]).toBe('""');
      expect(ultima(beta)).toBe('"Contrato até 31/12/2026"');
      expect(ultima(doNome("Épsilon Instalador Fictício").split(";"))).toBe('"Contrato até 31/12/2026 · CPF pendente"');
      expect(ultima(doNome("Alfa Freelancer Fictício").split(";"))).toBe('"Contrato até 31/12/2026"');
      expect(ultima(doNome("Gama Freelancer Fictício").split(";"))).toBe('""');
      expect(texto).not.toContain("Alfa Nome no Contrato");
      expect(texto).not.toContain("Zeta Encerrado");
      expect(linhas).toHaveLength(4);
    } finally {
      clique.mockRestore();
    }
  });

  it("PDF da lista: os mesmos contratos, e a cobertura conta à parte sem mentir o recorte", async () => {
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    const botao = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("PDF da lista"))!;
    await act(async () => { botao.click(); await vi.dynamicImportSettled(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const p = estado.pedidoPdf as PedidoDePdf;
    expect(p).toBeTruthy();
    expect(p.lista.map((c) => c.id)).toEqual(["fa", "fc"]);
    expect(p.contratos!.avulsos.map((f) => f.id)).toEqual(["k-b", "k-s"]);
    expect(p.contratos!.comContrato.get("fa")?.id).toBe("k-a");
    const { montarColaboradoresPdf } = await vi.importActual<typeof import("@/lib/colaboradoresPdf")>("@/lib/colaboradoresPdf");
    const r = await montarColaboradoresPdf(p);
    expect(r.linhas).toBe(4);
    expect(r.cobertura).toContain("2 colaborador(es) neste documento");
    expect(r.cobertura).toContain("mais 2 contrato(s) de freelancer, fora do quadro");
    expect(r.doc.output()).toContain("Freelancer \\(contrato\\)");
  });

  it("PDF com a busca tirando um contrato: diz quantos o recorte tirou", async () => {
    const { montarColaboradoresPdf, linhaDoContrato } = await vi.importActual<typeof import("@/lib/colaboradoresPdf")>("@/lib/colaboradoresPdf");
    const apoio = { nomeCargo: () => "", nomeArea: () => "", nomeNivel: () => "", nomeStatus: () => "Freelancer" };
    const r = await montarColaboradoresPdf({
      lista: [], visao: "cadastro", apoio, noEscopo: 4, totalCadastro: 4,
      contratos: { comContrato: new Map(), avulsos: [kB], foraDoRecorte: 1 },
    });
    expect(r.linhas).toBe(1);
    expect(r.cobertura).toContain("1 contrato(s) fora pelo recorte acima");
    // Sem traço onde o contrato não tem o dado: o traço diria "em branco na ficha".
    expect(linhaDoContrato(kB, "cadastro")).toEqual(["900002", "Beta Instalador Fictício", "Instalador", "", "", "", "Freelancer (contrato)", "", ""]);
    expect(linhaDoContrato(kS, "custo")).toEqual(["sem ID", "Épsilon Instalador Fictício", "", "", "", "Freelancer (contrato)"]);
  });

  it("sem contrato na lista, o PDF sai como antes (mesmas colunas, mesma cobertura)", async () => {
    montar(<Colaboradores />, "/colaboradores?status=ativo");
    const botao = [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("PDF da lista"))!;
    await act(async () => { botao.click(); await vi.dynamicImportSettled(); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const p = estado.pedidoPdf as PedidoDePdf;
    expect(p.contratos).toBeUndefined();
  });
});

/* O formulário do contrato: os campos são achados pelo rótulo, como a pessoa acha. */
const campo = (rotulo: string) =>
  [...document.body.querySelectorAll("label")]
    .find((l) => l.querySelector(".label")?.textContent?.trim().startsWith(rotulo))
    ?.querySelector("input, select, textarea") as HTMLInputElement;
function digitar(input: HTMLInputElement, valor: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, valor);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const blocoSemContrato = () =>
  [...el.querySelectorAll("h2")].find((h) => h.textContent === "No quadro como Freelancer, sem contrato");

describe("Freelancers: ficha no quadro sem contrato", () => {
  it("lista as fichas freelancer sem contrato; some quando há contrato do mesmo CPF, com outra formatação", () => {
    estado.colecoes = { freelancers: [] };
    montar(<Freelancers />, "/freelancers");
    const bloco = blocoSemContrato()!.closest(".space-y-3")!;
    expect(bloco.textContent).toContain("Alfa Freelancer Fictício");
    expect(bloco.textContent).toContain("Gama Freelancer Fictício");
    expect(bloco.textContent).not.toContain("Delta CLT Fictício");

    estado.colecoes = { freelancers: [kA] }; // CPF só com dígitos; a ficha tem pontos
    montar(<Freelancers />, "/freelancers");
    const depois = blocoSemContrato()!.closest(".space-y-3")!;
    expect(depois.textContent).not.toContain("Alfa Freelancer Fictício");
    expect(depois.textContent).toContain("Gama Freelancer Fictício");

    estado.colecoes = { freelancers: [kA, contrato({ id: "k-c", nome: "Gama no Contrato", cpf: "900.003.003-06", situacao: "encerrado" })] };
    montar(<Freelancers />, "/freelancers");
    expect(blocoSemContrato()).toBeUndefined();
  });

  it("\"Criar contrato\" abre o formulário com CPF e origem, e não grava nada sozinho", () => {
    estado.colecoes = { freelancers: [] };
    montar(<Freelancers />, "/freelancers");
    const item = [...el.querySelectorAll("li")].find((li) => li.textContent?.includes("Alfa Freelancer Fictício"))!;
    const botao = [...item.querySelectorAll("button")].find((b) => b.textContent?.includes("Criar contrato"))!;
    expect(botao.className).toContain("min-h-10");
    act(() => botao.click());

    expect(campo("Nome").value).toBe("Alfa Freelancer Fictício");
    expect(campo("CPF").value).toBe(CPF_A);
    expect(campo("Apelido").value).toBe("alfa");
    expect(campo("Telefone").value).toBe("(38) 90000-0001");
    expect(campo("E-mail").value).toBe("alfa@exemplo.test");
    expect(campo("Função").value).toBe("");
    expect(campo("Vale até").value).toBe("");
    expect(document.body.textContent).toContain("Nada foi gravado ainda");
    expect(estado.criar).not.toHaveBeenCalled();
    expect(estado.atualizar).not.toHaveBeenCalled();

    // Só o Salvar grava, e leva o CPF e a origem. O apelido da própria ficha não barra.
    digitar(campo("Função"), "Instalador");
    digitar(campo("Vale até"), "2026-12-31");
    const salvar = [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Salvar")!;
    act(() => salvar.click());
    expect(estado.toast.mock.calls.filter(([, tipo]) => tipo === "erro")).toEqual([]);
    expect(estado.criar).toHaveBeenCalledTimes(1);
    expect(estado.criar.mock.calls[0][0]).toMatchObject({ cpf: CPF_A, exColaboradorId: "fa", apelido: "alfa", funcao: "Instalador" });
    expect(estado.criar.mock.calls[0][0].id).toBeUndefined();
  });

  it("o apelido de OUTRA pessoa continua barrado", () => {
    estado.colecoes = { freelancers: [] };
    montar(<Freelancers />, "/freelancers");
    const item = [...el.querySelectorAll("li")].find((li) => li.textContent?.includes("Gama Freelancer Fictício"))!;
    act(() => [...item.querySelectorAll("button")].find((b) => b.textContent?.includes("Criar contrato"))!.click());
    digitar(campo("Apelido"), "alfa");
    digitar(campo("Vale até"), "2026-12-31");
    act(() => [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Salvar")!.click());
    expect(estado.criar).not.toHaveBeenCalled();
    expect(estado.toast.mock.calls.some(([msg, tipo]) => tipo === "erro" && String(msg).includes("alfa"))).toBe(true);
  });

  it("instalador sem CPF na ficha: a régua que já existe não deixa salvar", () => {
    estado.colecoes = { freelancers: [] };
    estado.dominio = dominioFalso([pessoa({ id: "fs", nome: "Teta Sem CPF Fictício" })]);
    montar(<Freelancers />, "/freelancers");
    act(() => [...el.querySelectorAll("button")].find((b) => b.textContent?.includes("Criar contrato"))!.click());
    digitar(campo("Função"), "Instalador");
    digitar(campo("Vale até"), "2026-12-31");
    act(() => [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Salvar")!.click());
    expect(estado.criar).not.toHaveBeenCalled();
  });

  it("quem chega pela linha de Colaboradores vê o contrato destacado", () => {
    montar(<Freelancers />, "/freelancers?contrato=k-b");
    expect(el.querySelector("#contrato-k-b")!.className).toContain("bg-amber-50");
    expect(el.querySelector("#contrato-k-s")!.className).not.toContain("bg-amber-50");
  });
});


describe("foto do freelancer nas telas conectadas", () => {
  const foto = "data:image/jpeg;base64,Zm90bw==";
  it("contrato usa a foto da ficha, e a ação de foto fica visível ao RH", () => {
    estado.dominio = dominioFalso(COLABS.map(c => c.id === fichaA.id ? { ...c, fotoDataUrl: foto } : c));
    montar(<Freelancers />, "/freelancers");
    expect(linhaCom(kA.nome)?.querySelector("img")?.src).toBe(foto);
    expect(el.querySelector(`button[aria-label="Foto de ${kA.nome}"]`)).not.toBeNull();
  });
  it("contrato sem ficha exibe a mesma foto na tabela e na lista do celular", () => {
    estado.colecoes.freelancers = CONTRATOS.map(c => c.id === kB.id ? { ...c, fotoDataUrl: foto } : c);
    montar(<Colaboradores />, "/colaboradores?status=freelancer");
    expect(linhaCom(kB.nome)?.querySelector("img")?.src).toBe(foto);
    expect(el.querySelector('[aria-label="Pessoas encontradas"] img[alt="Beta Instalador Fictício"]')?.getAttribute("src")).toBe(foto);
  });
});
