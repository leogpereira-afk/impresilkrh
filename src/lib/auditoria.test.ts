// O histórico é testemunha: se ele mentir ou tiver buraco, é pior do que não
// existir. Estes testes travam as três regras que o tornam confiável — não
// inventar mudança, não vazar segredo, e não deixar a importação da máquina
// enterrar o que a pessoa fez.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { diferencas, valorLegivel, nomeDoRegistro, emLote, auditar, definirEscritorDeHistorico, rotuloColecao } from "./auditoria";

vi.mock("./session", () => ({ obterSessao: () => ({ colaboradorId: "leo", perfil: "ADMIN_RH" }) }));
vi.mock("./store", () => ({ obterDinamico: () => [{ id: "leo", nome: "Leonardo" }] }));

type Linha = { acao: string; recurso: string; detalhe?: string; qtd?: number; colecao?: string; mudancas?: { campo: string; de: string; para: string }[]; usuarioNome: string };
let gravadas: Linha[] = [];
beforeEach(() => {
  gravadas = [];
  definirEscritorDeHistorico((l) => gravadas.push(l as unknown as Linha));
});
afterEach(() => definirEscritorDeHistorico(null));

describe("diferencas", () => {
  it("lista só o que mudou de verdade", () => {
    const d = diferencas({ nome: "Ana", salario: 1000 }, { nome: "Ana", salario: 1500 });
    // salário é sensível: registra que MUDOU, nunca o valor
    expect(d.mudancas).toEqual([{ campo: "Salário", de: "•••", para: "•••" }]);
    expect(d.total).toBe(1);
  });

  it("carimbo de atualização não é mudança", () => {
    expect(diferencas({ nome: "Ana", atualizadoEm: "a" }, { nome: "Ana", atualizadoEm: "b" }).mudancas).toEqual([]);
  });

  it("senha muda mas o valor NUNCA aparece", () => {
    const d = diferencas({ senhaHash: "abc123" }, { senhaHash: "xyz789" });
    expect(d.mudancas).toEqual([{ campo: "senhaHash", de: "•••", para: "•••" }]);
    expect(JSON.stringify(d)).not.toContain("abc123");
    expect(JSON.stringify(d)).not.toContain("xyz789");
  });

  it("objeto igual em conteúdo não vira mudança falsa", () => {
    expect(diferencas({ end: { rua: "A" } }, { end: { rua: "A" } }).mudancas).toEqual([]);
    expect(diferencas({ end: { rua: "A" } }, { end: { rua: "B" } }).mudancas).toHaveLength(1);
  });

  it("campo que nasce e campo que some entram os dois", () => {
    const d = diferencas({ nome: "Ana" }, { nome: "Ana", email: "a@x.com" });
    expect(d.mudancas).toEqual([{ campo: "E-mail", de: "—", para: "a@x.com" }]);
  });

  it("não deixa a lista crescer sem fim", () => {
    const antes: Record<string, unknown> = {}; const depois: Record<string, unknown> = {};
    for (let i = 0; i < 40; i++) { antes[`c${i}`] = i; depois[`c${i}`] = i + 1; }
    const r = diferencas(antes, depois);
    expect(r.mudancas.length).toBeLessThanOrEqual(12);
    // ...mas o TOTAL real vai junto: cortar em silêncio é mentir com número
    expect(r.total).toBe(40);
  });
});

describe("valorLegivel", () => {
  it("traduz para quem lê, não para quem programa", () => {
    expect(valorLegivel(true)).toBe("sim");
    expect(valorLegivel(false)).toBe("não");
    expect(valorLegivel(null)).toBe("—");
    expect(valorLegivel("")).toBe("—");
    expect(valorLegivel([1, 2, 3])).toBe("(lista com 3)");
    expect(valorLegivel(["custos", "ferias"])).toBe("custos, ferias");
    expect(valorLegivel({ a: 1 })).toBe("(alterado)");
  });

  it("texto gigante não estoura a linha", () => {
    expect(valorLegivel("x".repeat(200)).length).toBeLessThanOrEqual(61);
  });
});

describe("nomeDoRegistro", () => {
  it("prefere o nome; sem nome, cai no id", () => {
    expect(nomeDoRegistro({ nome: "Ana Lima" }, "x1")).toBe("Ana Lima");
    expect(nomeDoRegistro({ titulo: "Férias 2026" }, "x1")).toBe("Férias 2026");
    expect(nomeDoRegistro({}, "x1")).toBe("x1");
    expect(nomeDoRegistro(null, "x1")).toBe("x1");
  });
});

describe("auditar", () => {
  it("registra criação com o nome de quem fez", () => {
    auditar({ colecao: "colaboradores", acao: "criou", id: "c1", depois: { nome: "Ana" } });
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0].acao).toBe("CRIOU");
    expect(gravadas[0].recurso).toBe("Colaborador: Ana");
    expect(gravadas[0].usuarioNome).toBe("Leonardo");
  });

  it("o próprio histórico não é auditado (senão é recursão infinita)", () => {
    auditar({ colecao: "acessos", acao: "criou", id: "a1", depois: { recurso: "x" } });
    expect(gravadas).toHaveLength(0);
  });

  it("regravar o mesmo valor não vira linha", () => {
    auditar({ colecao: "colaboradores", acao: "alterou", id: "c1", antes: { nome: "Ana" }, depois: { nome: "Ana" } });
    expect(gravadas).toHaveLength(0);
  });

  it("remoção guarda o que foi removido", () => {
    auditar({ colecao: "pagamentos", acao: "removeu", id: "p1", antes: { descricao: "Faxina 03/2026" } });
    expect(gravadas[0].acao).toBe("REMOVEU");
    expect(gravadas[0].recurso).toContain("Faxina 03/2026");
  });
});

describe("emLote", () => {
  it("centenas de escritas viram UMA linha com os números", () => {
    emLote("Aplicou a folha do ERP", () => {
      for (let i = 0; i < 300; i++) auditar({ colecao: "pagamentos", acao: "criou", id: `p${i}`, depois: { nome: "x" } });
      for (let i = 0; i < 12; i++) auditar({ colecao: "pagamentos", acao: "alterou", id: `q${i}`, antes: { valor: 1 }, depois: { valor: 2 } });
      auditar({ colecao: "pagamentos", acao: "removeu", id: "r1", antes: { valor: 1 } });
    });
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0].acao).toBe("LOTE");
    expect(gravadas[0].qtd).toBe(313);
    expect(gravadas[0].detalhe).toBe("300 novo(s) · 12 alterado(s) · 1 removido(s)");
  });

  it("lote que não escreveu nada não deixa linha vazia", () => {
    emLote("Aplicou a folha", () => { /* nada mudou */ });
    expect(gravadas).toHaveLength(0);
  });

  it("volta ao normal depois do lote", () => {
    emLote("x", () => auditar({ colecao: "pagamentos", acao: "criou", id: "p1", depois: {} }));
    auditar({ colecao: "colaboradores", acao: "criou", id: "c1", depois: { nome: "Ana" } });
    expect(gravadas).toHaveLength(2);
    expect(gravadas[1].acao).toBe("CRIOU");
  });

  it("erro dentro do lote não deixa o agrupamento ligado para sempre", () => {
    expect(() => emLote("x", () => { throw new Error("falhou"); })).toThrow("falhou");
    auditar({ colecao: "colaboradores", acao: "criou", id: "c1", depois: { nome: "Ana" } });
    expect(gravadas[gravadas.length - 1]?.acao).toBe("CRIOU");
  });

  it("lote dentro de lote continua sendo um só", () => {
    emLote("fora", () => {
      auditar({ colecao: "pagamentos", acao: "criou", id: "p1", depois: {} });
      emLote("dentro", () => auditar({ colecao: "pagamentos", acao: "criou", id: "p2", depois: {} }));
    });
    expect(gravadas).toHaveLength(1);
    expect(gravadas[0].recurso).toBe("fora");
    expect(gravadas[0].qtd).toBe(2);
  });
});

describe("rotuloColecao", () => {
  it("fala português; nome desconhecido passa como está", () => {
    expect(rotuloColecao("colaboradores")).toBe("Colaborador");
    expect(rotuloColecao("xyz")).toBe("xyz");
  });
});

// Achados da revisão adversarial de 02/08/2026 — cada um vira teste, para o
// conserto não se desfazer sozinho na próxima mudança.
describe("o que a revisão pegou", () => {
  it("BLOQUEADOR: CPF e salário nunca vão em texto claro (o histórico sincroniza)", () => {
    const d = diferencas(
      { cpf: "12345678901", salario: 3200, conjugeNome: "Fernanda", enderecoRua: "Rua A" },
      { cpf: "98765432100", salario: 3800, conjugeNome: "Marta", enderecoRua: "Rua B" },
    );
    const cru = JSON.stringify(d);
    for (const segredo of ["12345678901", "98765432100", "3200", "3800", "Fernanda", "Marta", "Rua A", "Rua B"]) {
      expect(cru).not.toContain(segredo);
    }
    expect(d.mudancas.every((m) => m.de === "•••" && m.para === "•••")).toBe(true);
    expect(d.total).toBe(4); // o FATO de terem mudado continua registrado
  });

  it("pesquisa anônima continua anônima", () => {
    auditar({ colecao: "respostasPesquisa", acao: "criou", id: "r1", depois: { nota: 8 } });
    expect(gravadas).toHaveLength(0);
  });

  it("salvar o formulário sem mexer em nada não inventa mudança", () => {
    expect(diferencas({ nome: "Ana" }, { nome: "Ana", filhos: [], observacao: "", conjuge: null }).total).toBe(0);
    auditar({ colecao: "colaboradores", acao: "alterou", id: "c1", antes: { nome: "Ana" }, depois: { nome: "Ana", filhos: [] } });
    expect(gravadas).toHaveLength(0);
  });

  it("o corte prioriza cargo e perfil, não a ordem alfabética", () => {
    const antes: Record<string, unknown> = { cargoId: "a", perfil: "COLABORADOR" };
    const depois: Record<string, unknown> = { cargoId: "b", perfil: "ADMIN_RH" };
    for (let i = 0; i < 30; i++) { antes[`aaa${i}`] = i; depois[`aaa${i}`] = i + 1; }
    const campos = diferencas(antes, depois).mudancas.map((m) => m.campo);
    expect(campos.slice(0, 2)).toEqual(["Cargo", "Perfil"]);
  });

  it("o lote guarda a chave CRUA da coleção (o filtro da tela compara com ela)", () => {
    emLote("Importou o ponto", () => {
      auditar({ colecao: "pontos", acao: "criou", id: "p1", depois: {} });
    });
    expect(gravadas[0].colecao).toBe("pontos");
  });

  it("módulos concedidos aparecem pelo NOME, não pela contagem", () => {
    const d = diferencas({ modulos: ["ferias"] }, { modulos: ["ferias", "custos"] });
    expect(d.mudancas[0]).toEqual({ campo: "Módulos", de: "ferias", para: "custos, ferias" });
  });

  it("carimbo de importação não vira mudança (reimportar o mesmo PDF não polui)", () => {
    expect(diferencas({ importadoEm: "a", nome: "X" }, { importadoEm: "b", nome: "X" }).total).toBe(0);
  });
});
