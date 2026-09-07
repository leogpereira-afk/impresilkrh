/* Ficha repetida: aproximar, escolher qual fica, transferir e só então apagar.
 *
 * Começa pelo caso ruim — e aqui o caso ruim é específico: a medida óbvia
 * (semelhança entre os nomes) pontua MAIS ALTO no falso positivo do que no
 * achado de verdade. Quem confiasse num limiar de semelhança juntaria duas
 * pessoas diferentes e ainda acharia que estava sendo rigoroso.
 *
 * Os nomes daqui são os do banco em 07/09/2026 (os mesmos que já aparecem em
 * consertoCadastro e na auditoria dos lançamentos). Os CPFs são inventados.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  tokensDoNome, nomeNormalizado, semelhanca, erroDeDigitacao, lacoEntre,
  aproximarCadastros, quemFica, avaliarExclusao, planoDeTransferencia,
  COLECOES_DA_PESSOA, COLECOES_TRILHA, COLECOES_CONTA, CONTAGEM_VAZIA,
  type FichaResumo, type ContagemFicha,
} from "./cadastrosDuplicados";

const ficha = (id: string, nome: string, extra: Partial<FichaResumo> = {}): FichaResumo => ({ id, nome, ...extra });

// As três fichas reais do José: mesmo homem, TRÊS CPFs diferentes.
const JOSE = [
  ficha("jose-adilando-pereira", "José Adilando Pereira", { apelido: "adilando", cpf: "10000000191", statusId: "ativo" }),
  ficha("jose-adilando", "José Adilando", { cpf: "20000000272", statusId: "inativo" }),
  ficha("jose-adilando-pereira-2", "Jose Adilando Pereira", { cpf: "30000000353", statusId: "inativo" }),
];
const DEMERVAL = [
  ficha("demerval-vieira", "Demerval Vieira", { apelido: "demer", cpf: "40000000434", statusId: "ativo" }),
  ficha("dermeval-vieira", "Dermeval Vieira", { cpf: "50000000515", statusId: "inativo" }),
  ficha("dermeval-vieira-2", "Dermeval Vieira (2)", { cpf: "60000000696", statusId: "inativo" }),
];

describe("o falso positivo que a semelhança sozinha não separa", () => {
  it("“ronaldo” parece MAIS com “reinaldo” do que “dermeval” com “demerval”", () => {
    // Se o critério fosse um limiar de semelhança, qualquer valor que juntasse
    // o Demerval juntaria também dois irmãos que não têm nada a ver.
    const achado = semelhanca("demerval vieira", "dermeval vieira");
    const armadilha = semelhanca("reinaldo barbosa moura", "ronaldo barbosa moura");
    expect(armadilha).toBeGreaterThan(achado);
  });

  it("Demerval × Dermeval: as mesmas letras fora de ordem — certeza alta", () => {
    const l = lacoEntre(DEMERVAL[0], DEMERVAL[1])!;
    expect(l.certeza).toBe("alta");
    expect(l.tipo).toBe("letras-trocadas");
    expect(l.explicacao).toContain("ordem trocada");
  });

  it("Reinaldo × Ronaldo Barbosa de Moura: nunca “alta”, só “confira”", () => {
    const l = lacoEntre(ficha("r1", "Reinaldo Barbosa de Moura"), ficha("r2", "Ronaldo Barbosa de Moura"))!;
    expect(l.certeza).toBe("media");
    expect(l.tipo).toBe("quase-igual");
  });

  it("erro de digitação: só as três formas que são a mesma palavra", () => {
    expect(erroDeDigitacao("demerval", "dermeval")).toContain("ordem trocada");
    expect(erroDeDigitacao("adilson", "adilsom")).toContain("uma letra diferente");
    expect(erroDeDigitacao("jhonata", "jhonnata")).toContain("dobrada");
    expect(erroDeDigitacao("reinaldo", "ronaldo")).toBeNull();
    expect(erroDeDigitacao("silva", "souza")).toBeNull();
    expect(erroDeDigitacao("ana", "ana")).toBeNull();
    // Curto demais não conta: com 3 letras qualquer troca vira anagrama fácil.
    expect(erroDeDigitacao("ana", "naa")).toBeNull();
  });
});

describe("o nome, do jeito que ele chega no cadastro", () => {
  it("o “(2)” que alguém pôs para não repetir o nome não separa ninguém", () => {
    expect(nomeNormalizado("Dermeval Vieira (2)")).toBe("dermeval vieira");
  });

  it("acento, caixa e espaço sobrando não fazem dois nomes", () => {
    expect(nomeNormalizado("José Adilando Pereira")).toBe(nomeNormalizado("JOSE ADILANDO PEREIRA "));
    expect(nomeNormalizado("Guilherme Pereira Araújo ")).toBe("guilherme pereira araujo");
  });

  it("partícula não distingue ninguém e sai fora", () => {
    expect(tokensDoNome("Reinaldo Barbosa de Moura")).toEqual(["reinaldo", "barbosa", "moura"]);
    expect(tokensDoNome("Arlen Fabiano Niz de Souza")).toEqual(["arlen", "fabiano", "niz", "souza"]);
  });

  it("nome vazio não vira nada", () => {
    expect(tokensDoNome("")).toEqual([]);
    expect(tokensDoNome(null)).toEqual([]);
    expect(tokensDoNome("   ")).toEqual([]);
  });
});

describe("o laço entre duas fichas", () => {
  it("CPF DIFERENTE não impede: é o caso do José, três fichas e três CPFs", () => {
    // Este é o motivo de a deduplicação não poder ser por CPF.
    expect(JOSE[0].cpf).not.toBe(JOSE[1].cpf);
    expect(lacoEntre(JOSE[0], JOSE[1])!.certeza).toBe("alta");
    expect(lacoEntre(JOSE[0], JOSE[2])!.tipo).toBe("mesmo-nome");
    expect(lacoEntre(JOSE[1], JOSE[2])!.tipo).toBe("nome-contido");
  });

  it("CPF igual manda, mesmo com nome que não parece", () => {
    const a = ficha("a", "Maria Inês", { cpf: "111.222.333-44" });
    const b = ficha("b", "Maria I. Souza", { cpf: "11122233344" });
    expect(lacoEntre(a, b)!.tipo).toBe("mesmo-cpf");
  });

  it("mesmo ID (os 6 primeiros do CPF) junta mesmo com o fim do CPF diferente", () => {
    const a = ficha("a", "Fulano de Tal", { cpf: "12345612345" });
    const b = ficha("b", "Beltrano Qualquer", { cpf: "12345699999" });
    const l = lacoEntre(a, b)!;
    expect(l.tipo).toBe("mesmo-id");
    expect(l.explicacao).toContain("123456");
  });

  it("CPF de enchimento (todos os dígitos iguais) não junta ninguém", () => {
    // "000.000.000-00" e "111.111.111-11" é o que se digita para o campo parar
    // de reclamar. Sem esta ressalva, duas fichas preenchidas assim têm o mesmo
    // CPF e o mesmo ID — e viravam a mesma pessoa. Achado ao testar: três
    // fichas com CPF inventado começando igual colapsaram num grupo só.
    expect(lacoEntre(ficha("a", "Saulo Rodrigues Ferreira", { cpf: "00000000000" }), ficha("b", "Charles Alves Dias", { cpf: "00000000000" }))).toBeNull();
    expect(lacoEntre(ficha("a", "Saulo Rodrigues Ferreira", { cpf: "11111111111" }), ficha("b", "Charles Alves Dias", { cpf: "11111111111" }))).toBeNull();
    // E não atrapalha quem tem CPF de verdade: o nome continua valendo.
    expect(lacoEntre(ficha("a", "Kelly Raissa Soares Ruas", { cpf: "00000000000" }), ficha("b", "Kelly Raissa Soares Ruas", { cpf: "00000000000" }))!.tipo).toBe("mesmo-nome");
  });

  it("nome de uma palavra só nunca “cabe dentro”: viraria parente de todo mundo", () => {
    const l = lacoEntre(ficha("t0", "Thiago"), ficha("t1", "Thiago Cardoso Rodrigues"))!;
    expect(l.certeza).toBe("media");
    expect(l.tipo).toBe("nome-incompleto");
  });

  it("gente sem nada a ver não vira laço nenhum", () => {
    expect(lacoEntre(ficha("a", "Adriano Nunes Araújo"), ficha("b", "Adriano Pinheiro Lima"))).toBeNull();
    expect(lacoEntre(ficha("a", "Marcos Rodrigues Lopes"), ficha("b", "Márcio Rafael Barbosa Souza"))).toBeNull();
    expect(lacoEntre(ficha("a", "Vinicius Muniz Leite Silva"), ficha("b", "Vinicius Silva Lins de Oliveira"))).toBeNull();
    expect(lacoEntre(ficha("a", "Hugo César Barbosa Gusmão"), ficha("b", "Hugo Vinicius Ramos de Araújo Veloso"))).toBeNull();
  });

  it("a ficha não é parente de si mesma", () => {
    expect(lacoEntre(JOSE[0], JOSE[0])).toBeNull();
  });
});

describe("agrupar", () => {
  const OUTROS = [
    ficha("reinaldo-barbosa-de-moura", "Reinaldo Barbosa de Moura"),
    ficha("ronaldo-barbosa-de-moura", "Ronaldo Barbosa de Moura"),
    ficha("thiago", "Thiago"),
    ficha("thiago-cardoso-rodrigues", "Thiago Cardoso Rodrigues"),
    ficha("thiago-ferreira-acacio", "Thiago Ferreira Acacio"),
    ficha("saulo-rodrigues-ferreira", "Saulo Rodrigues Ferreira"),
  ];
  const KELLY = [
    ficha("colaboradores_43ha4hms17l", "Kelly Raissa Soares Ruas", { apelido: "kelly" }),
    ficha("kelly-raissa-soares-ruas", "Kelly Raissa Soares Ruas"),
  ];
  const TODAS = [...JOSE, ...DEMERVAL, ...KELLY, ...OUTROS];

  it("acha exatamente os três grupos que existem — nem um a mais", () => {
    const { grupos } = aproximarCadastros(TODAS);
    expect(grupos.map((g) => g.fichas.length)).toEqual([3, 3, 2]);
    // Por id, e ordenado: dentro do grupo a ordem é de exibição (localeCompare)
    // e não é o que está sendo afirmado aqui.
    expect(grupos.map((g) => g.fichas.map((f) => f.id).sort())).toEqual([
      ["demerval-vieira", "dermeval-vieira", "dermeval-vieira-2"],
      ["jose-adilando", "jose-adilando-pereira", "jose-adilando-pereira-2"],
      ["colaboradores_43ha4hms17l", "kelly-raissa-soares-ruas"],
    ]);
  });

  it("as três do José entram no mesmo grupo, mesmo sem laço direto entre todas", () => {
    const { grupos } = aproximarCadastros(JOSE);
    expect(grupos).toHaveLength(1);
    expect(grupos[0].fichas.map((f) => f.id).sort()).toEqual(
      ["jose-adilando", "jose-adilando-pereira", "jose-adilando-pereira-2"],
    );
    expect(grupos[0].motivos.length).toBeGreaterThan(0);
  });

  it("Reinaldo e Ronaldo NÃO viram grupo — vão para “confira”", () => {
    const { grupos, conferir } = aproximarCadastros(OUTROS);
    expect(grupos.some((g) => g.fichas.some((f) => f.id.includes("moura")))).toBe(false);
    expect(conferir.some((p) => p.a.nome.startsWith("Reinaldo") && p.b.nome.startsWith("Ronaldo"))).toBe(true);
  });

  it("“Thiago” sai como PAR com cada Thiago, nunca como um grupo de três", () => {
    // Juntar os três num grupo afirmaria que os três são a mesma pessoa.
    const { grupos, conferir } = aproximarCadastros(OUTROS);
    expect(grupos.some((g) => g.fichas.some((f) => f.id === "thiago"))).toBe(false);
    expect(conferir.filter((p) => p.a.id === "thiago" || p.b.id === "thiago")).toHaveLength(2);
  });

  it("par que já caiu no mesmo grupo certo não vira dúvida de novo", () => {
    const { conferir } = aproximarCadastros(TODAS);
    const ids = new Set(conferir.flatMap((p) => [p.a.id, p.b.id]));
    for (const f of [...JOSE, ...DEMERVAL, ...KELLY]) expect(ids.has(f.id)).toBe(false);
  });

  it("ficha sozinha não vira grupo, e lista vazia não quebra", () => {
    expect(aproximarCadastros([ficha("x", "Saulo Rodrigues Ferreira")]).grupos).toEqual([]);
    expect(aproximarCadastros([])).toEqual({ grupos: [], conferir: [] });
  });

  it("a ordem de entrada não muda o resultado", () => {
    const a = aproximarCadastros(TODAS);
    const b = aproximarCadastros([...TODAS].reverse());
    expect(b.grupos.map((g) => g.fichas.map((f) => f.id).sort())).toEqual(a.grupos.map((g) => g.fichas.map((f) => f.id).sort()));
    expect(b.conferir).toHaveLength(a.conferir.length);
  });
});

describe("qual ficha fica — “manter os que têm dados lançados”", () => {
  const contarCom = (mapa: Record<string, Partial<ContagemFicha>>) => (id: string): ContagemFicha => ({ ...CONTAGEM_VAZIA, ...(mapa[id] ?? {}) });

  it("a que tem os lançamentos fica, mesmo estando inativa", () => {
    const e = quemFica(JOSE, contarCom({ "jose-adilando-pereira": { lancamentos: 31, dados: 11 } }))!;
    expect(e.id).toBe("jose-adilando-pereira");
    expect(e.provada).toBe(true);
    expect(e.disputa).toBe(false);
    expect(e.motivo).toContain("31");
  });

  it("duas fichas com lançamento é DISPUTA: apagar qualquer uma perde dinheiro", () => {
    const e = quemFica(JOSE, contarCom({ "jose-adilando-pereira": { lancamentos: 31 }, "jose-adilando": { lancamentos: 4 } }))!;
    expect(e.id).toBe("jose-adilando-pereira");
    expect(e.disputa).toBe(true);
    expect(e.motivo).toContain("Transfira");
  });

  it("sem lançamento nenhum, ganha quem tem outro registro", () => {
    const e = quemFica(JOSE, contarCom({ "jose-adilando": { dados: 3 } }))!;
    expect(e.id).toBe("jose-adilando");
    expect(e.provada).toBe(true);
  });

  it("nada em ficha nenhuma: sugere, mas avisa que não tem prova", () => {
    const e = quemFica(JOSE, () => CONTAGEM_VAZIA)!;
    expect(e.provada).toBe(false);
    expect(e.motivo).toContain("a escolha é sua");
    // Empate total cai no quadro: a ativa vem antes da inativa.
    expect(e.id).toBe("jose-adilando-pereira");
  });

  it("o desempate é estável: mesma resposta com a lista embaralhada", () => {
    const contar = contarCom({});
    expect(quemFica([...JOSE].reverse(), contar)!.id).toBe(quemFica(JOSE, contar)!.id);
  });

  it("lista vazia não devolve escolha", () => {
    expect(quemFica([], () => CONTAGEM_VAZIA)).toBeNull();
  });
});

describe("apagar tem de custar o que a ficha vale", () => {
  const c = (p: Partial<ContagemFicha>): ContagemFicha => ({ ...CONTAGEM_VAZIA, ...p });

  it("ficha realmente vazia: um clique basta", () => {
    const a = avaliarExclusao(c({}), false);
    expect(a.exigencia).toBe("clique");
    expect(a.recomendacao).toBe("apagar");
    expect(a.perde).toEqual([]);
  });

  it("só trilha (acessos e alterações) ainda é um clique — e ela FICA, apontando para o id morto", () => {
    // As fichas repetidas do José e da Kelly tinham 9 e 10 linhas de trilha, e
    // zero dado da pessoa. Contar trilha como conteúdo travaria a limpeza.
    const a = avaliarExclusao(c({ trilha: 9 }), false);
    expect(a.exigencia).toBe("clique");
    expect(a.recomendacao).toBe("apagar");
    expect(a.fica[0]).toContain("9");
    expect(a.fica[0]).toContain("trilha");
  });

  it("com registro da pessoa: precisa conferir a lista e o certo é transferir", () => {
    const a = avaliarExclusao(c({ dados: 5 }), true);
    expect(a.exigencia).toBe("conferir");
    expect(a.recomendacao).toBe("transferir");
    expect(a.perde).toEqual(["5 outro(s) registro(s) da pessoa"]);
  });

  it("com lançamento: exige digitar o id — e o id é o que distingue as fichas", () => {
    const a = avaliarExclusao(c({ lancamentos: 31, dados: 11 }), true);
    expect(a.exigencia).toBe("digitar-id");
    expect(a.recomendacao).toBe("transferir");
    expect(a.perde).toEqual(["31 lançamento(s) da folha", "11 outro(s) registro(s) da pessoa"]);
  });

  it("com dado e SEM para onde transferir, a recomendação é parar", () => {
    expect(avaliarExclusao(c({ lancamentos: 31 }), false).recomendacao).toBe("parar");
    expect(avaliarExclusao(c({ dados: 1 }), false).recomendacao).toBe("parar");
  });

  it("conta de acesso, subordinado e afilhado são impedimento, não aviso", () => {
    const a = avaliarExclusao(c({ contas: 1, subordinados: 2, afilhados: 3 }), true);
    expect(a.recomendacao).toBe("parar");
    expect(a.bloqueios).toHaveLength(3);
    expect(a.bloqueios[0]).toContain("Usuários e Permissões");
    expect(a.bloqueios[1]).toContain("gestor");
    expect(a.bloqueios[2]).toContain("padrinho");
  });

  it("impedimento manda mesmo em ficha vazia", () => {
    expect(avaliarExclusao(c({ contas: 1 }), false).recomendacao).toBe("parar");
  });
});

describe("transferir antes de apagar", () => {
  const registros = {
    pagamentos: [
      { id: "p1", colaboradorId: "jose-adilando" },
      { id: "p2", colaboradorId: "jose-adilando" },
      { id: "p3", colaboradorId: "jose-adilando-pereira" },
      { id: "p4", colaboradorId: "outra-pessoa" },
    ],
    documentos: [{ id: "d1", colaboradorId: "jose-adilando" }],
    acessos: [{ id: "a1", colaboradorId: "jose-adilando" }, { id: "a2", colaboradorId: "jose-adilando" }],
    alteracoes: [{ id: "h1", colaboradorId: "jose-adilando" }],
    usuarios: [{ id: "u1", colaboradorId: "jose-adilando" }],
    pontos: [
      { id: "2026-05::jose-adilando", colaboradorId: "jose-adilando", competencia: "2026-05" },
      { id: "2026-06::jose-adilando", colaboradorId: "jose-adilando", competencia: "2026-06" },
      { id: "2026-05::jose-adilando-pereira", colaboradorId: "jose-adilando-pereira", competencia: "2026-05" },
    ],
  };
  const plano = planoDeTransferencia("jose-adilando", "jose-adilando-pereira", registros);

  it("leva o que é da pessoa e deixa o que é de terceiro", () => {
    expect(plano.mover.find((m) => m.colecao === "pagamentos")!.ids).toEqual(["p1", "p2"]);
    expect(plano.mover.find((m) => m.colecao === "documentos")!.ids).toEqual(["d1"]);
  });

  it("trilha e conta de login NÃO mudam de dono — aparecem como o que fica", () => {
    for (const c of [...COLECOES_TRILHA, ...COLECOES_CONTA]) {
      expect(plano.mover.some((m) => m.colecao === c)).toBe(false);
    }
    expect(plano.ficam).toEqual([
      { colecao: "acessos", quantidade: 2 },
      { colecao: "alteracoes", quantidade: 1 },
      { colecao: "usuarios", quantidade: 1 },
    ]);
  });

  it("ponto de mês que o destino JÁ TEM vira conflito, não vira mês em dobro", () => {
    expect(plano.mover.find((m) => m.colecao === "pontos")!.ids).toEqual(["2026-06::jose-adilando"]);
    expect(plano.conflitos).toEqual([
      { colecao: "pontos", id: "2026-05::jose-adilando", motivo: expect.stringContaining("2026-05") },
    ]);
  });

  it("dois registros do mesmo mês na origem: o segundo também é conflito", () => {
    const p = planoDeTransferencia("a", "b", {
      pontos: [
        { id: "x1", colaboradorId: "a", competencia: "2026-07" },
        { id: "x2", colaboradorId: "a", competencia: "2026-07" },
      ],
    });
    expect(p.mover.find((m) => m.colecao === "pontos")!.ids).toEqual(["x1"]);
    expect(p.conflitos.map((c) => c.id)).toEqual(["x2"]);
  });

  it("o total é o que realmente muda de dono", () => {
    expect(plano.total).toBe(4); // p1, p2, d1, ponto de 06
  });

  it("transferir para si mesma (ou sem destino) não faz nada", () => {
    expect(planoDeTransferencia("a", "a", registros).total).toBe(0);
    expect(planoDeTransferencia("a", "", registros).mover).toEqual([]);
  });
});

describe("a lista de coleções cobre TUDO que aponta para uma pessoa", () => {
  /* Uma lista copiada à mão falha calada: a coleção esquecida não é contada, a
     ficha parece vazia e o registro dela vira órfão no primeiro clique em
     apagar. Era o buraco de lib/vinculos.ts, que não conhecia `pontos` nem
     `alteracoes`. Este teste lê o modelo de dados e reprova se alguém criar
     uma coleção nova com `colaboradorId` sem passar por aqui. */
  const tipos = fs.readFileSync("src/data/types.ts", "utf8");
  const mapa = fs.readFileSync("src/data/index.ts", "utf8");

  const tiposComDono = new Set<string>();
  let atual = "";
  for (const linha of tipos.split("\n")) {
    const m = /^\s*export interface (\w+)/.exec(linha);
    if (m) atual = m[1];
    if (/^\s*colaboradorId\??:/.test(linha) && atual) tiposComDono.add(atual);
  }

  const colecaoDoTipo = new Map<string, string>();
  const corpo = /export interface ColecaoMap \{([\s\S]*?)\n\}/.exec(mapa)?.[1] ?? "";
  for (const linha of corpo.split("\n")) {
    const m = /^\s*(\w+):\s*(\w+);/.exec(linha);
    if (m) colecaoDoTipo.set(m[2], m[1]);
  }

  it("achou o modelo de dados (senão o teste passaria à toa)", () => {
    expect(tiposComDono.size).toBeGreaterThan(20);
    expect(colecaoDoTipo.size).toBeGreaterThan(30);
    expect(tiposComDono.has("Pagamento")).toBe(true);
    expect(colecaoDoTipo.get("Pagamento")).toBe("pagamentos");
  });

  it("toda coleção com colaboradorId está numa das três listas", () => {
    const conhecidas = new Set<string>([...COLECOES_DA_PESSOA, ...COLECOES_TRILHA, ...COLECOES_CONTA]);
    const faltando = [...tiposComDono]
      .map((t) => colecaoDoTipo.get(t))
      .filter((c): c is string => !!c && !conhecidas.has(c));
    expect(faltando).toEqual([]);
  });

  it("e nenhuma das três listas inventa coleção que não existe", () => {
    const existentes = new Set(colecaoDoTipo.values());
    for (const c of [...COLECOES_DA_PESSOA, ...COLECOES_TRILHA, ...COLECOES_CONTA]) {
      expect(existentes.has(c), `coleção "${c}" não existe no ColecaoMap`).toBe(true);
    }
  });

  it("uma coleção não pode estar em duas listas ao mesmo tempo", () => {
    const todas = [...COLECOES_DA_PESSOA, ...COLECOES_TRILHA, ...COLECOES_CONTA];
    expect(new Set(todas).size).toBe(todas.length);
  });
});
