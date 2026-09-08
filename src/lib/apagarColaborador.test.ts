/* Apagar um cadastro: contar ANTES de perguntar.
 *
 * O perigo não é o clique, é o clique sem saber o tamanho. Uma ficha carrega
 * folha, documentos, ponto, feedbacks. "Tem certeza?" ninguém lê; "somem 73
 * lançamentos de folha" faz parar.
 *
 * Começa pelo caso ruim: apagar sem ver o que vai junto.
 */
import { describe, it, expect } from "vitest";
import {
  inventarioDaPessoa, resumoDoQueSome, exigeDigitarProva, provaConfere, impedimentoParaApagar,
  COLECOES_DA_PESSOA, ROTULO_COLECAO,
} from "./apagarColaborador";

const r = (colaboradorId: string, n: number) => Array.from({ length: n }, () => ({ colaboradorId }));

describe("o inventário conta o que some junto", () => {
  it("conta por coleção, só o que é DA pessoa", () => {
    const inv = inventarioDaPessoa("ana", "Ana Silva", {
      pagamentos: [...r("ana", 73), ...r("bia", 40)],
      documentos: r("ana", 5),
      pontos: r("bia", 12),
    });
    expect(inv.total).toBe(78);
    expect(inv.linhas.map((l) => [l.colecao, l.quantidade])).toEqual([["pagamentos", 73], ["documentos", 5]]);
  });

  it("coleção sem registro da pessoa não vira linha de zero — zero é ruído", () => {
    const inv = inventarioDaPessoa("ana", "Ana", { pagamentos: r("bia", 3), documentos: r("ana", 1) });
    expect(inv.linhas.map((l) => l.colecao)).toEqual(["documentos"]);
  });

  it("coleção que a tela não passou simplesmente não entra — não inventa zero", () => {
    const inv = inventarioDaPessoa("ana", "Ana", { pagamentos: r("ana", 2) });
    expect(inv.linhas).toHaveLength(1);
    expect(inv.total).toBe(2);
  });

  it("o maior número vem primeiro: é ele que faz parar", () => {
    const inv = inventarioDaPessoa("ana", "Ana", {
      documentos: r("ana", 5), pagamentos: r("ana", 73), ferias: r("ana", 12),
    });
    expect(inv.linhas.map((l) => l.quantidade)).toEqual([73, 12, 5]);
  });

  it("marca o que carrega DINHEIRO, que é o que dói mais perder", () => {
    const inv = inventarioDaPessoa("ana", "Ana", {
      pagamentos: r("ana", 10), lancamentos: r("ana", 3), viagens: r("ana", 2), documentos: r("ana", 4),
    });
    expect(inv.totalComDinheiro).toBe(15);
    expect(inv.linhas.find((l) => l.colecao === "documentos")!.temDinheiro).toBe(false);
  });

  it("ficha vazia dá total zero, sem quebrar", () => {
    const inv = inventarioDaPessoa("nova", "Nova", { pagamentos: [], documentos: [] });
    expect(inv.total).toBe(0);
    expect(inv.linhas).toEqual([]);
  });

  it("registro sem colaboradorId não conta para ninguém", () => {
    const inv = inventarioDaPessoa("ana", "Ana", { pagamentos: [{}, { colaboradorId: null }, { colaboradorId: "ana" }] });
    expect(inv.total).toBe(1);
  });
});

describe("quem aponta para a pessoa — a ponta que quebra calada", () => {
  it("acha quem tem essa pessoa como gestor ou padrinho", () => {
    const pessoas = [
      { id: "ana", nome: "Ana" },
      { id: "b", nome: "Bruno", gestorId: "ana" },
      { id: "c", nome: "Carla", padrinhoId: "ana" },
      { id: "d", nome: "Dinho", gestorId: "outro" },
    ];
    const inv = inventarioDaPessoa("ana", "Ana", {}, pessoas);
    expect(inv.apontamPraEla).toEqual([
      { id: "b", nome: "Bruno", papel: "gestor" },
      { id: "c", nome: "Carla", papel: "padrinho" },
    ]);
  });

  it("quem é gestor E padrinho aparece nos dois papéis", () => {
    const pessoas = [{ id: "ana", nome: "Ana" }, { id: "b", nome: "Bruno", gestorId: "ana", padrinhoId: "ana" }];
    expect(inventarioDaPessoa("ana", "Ana", {}, pessoas).apontamPraEla).toHaveLength(2);
  });

  it("a própria pessoa não conta como apontando para si", () => {
    const pessoas = [{ id: "ana", nome: "Ana", gestorId: "ana", padrinhoId: "ana" }];
    expect(inventarioDaPessoa("ana", "Ana", {}, pessoas).apontamPraEla).toEqual([]);
  });

  it("sem a lista de colaboradores, não inventa apontamento", () => {
    expect(inventarioDaPessoa("ana", "Ana", {}).apontamPraEla).toEqual([]);
  });
});

describe("a frase que a pessoa lê antes de confirmar", () => {
  it("ficha vazia diz que some só o cadastro", () => {
    const inv = inventarioDaPessoa("nova", "Nova", {});
    expect(resumoDoQueSome(inv)).toContain("some só o cadastro");
  });

  it("diz o total, os três maiores e quantos têm dinheiro", () => {
    const inv = inventarioDaPessoa("ana", "Ana", {
      pagamentos: r("ana", 73), documentos: r("ana", 5), ferias: r("ana", 3), pontos: r("ana", 2), feedbacks: r("ana", 1),
    });
    const t = resumoDoQueSome(inv);
    expect(t).toContain("Somem 84 registro(s)");
    expect(t).toContain("73 lançamentos de folha");
    expect(t).toContain("e mais 2 tipo(s)");
    expect(t).toContain("73 desses registros carregam valor em dinheiro");
  });

  it("sem dinheiro nenhum, não fala de dinheiro", () => {
    const inv = inventarioDaPessoa("ana", "Ana", { documentos: r("ana", 4) });
    expect(resumoDoQueSome(inv)).not.toContain("dinheiro");
  });

  it("usa o nome que a pessoa entende, não o da coleção", () => {
    const inv = inventarioDaPessoa("ana", "Ana", { pdis: r("ana", 2), certificacoesNr: r("ana", 1) });
    const t = resumoDoQueSome(inv);
    expect(t).toContain("planos de desenvolvimento");
    expect(t).not.toContain("pdis");
  });
});

describe("quando exigir que digite o nome", () => {
  it("ficha com dinheiro SEMPRE exige — mesmo um único lançamento", () => {
    expect(exigeDigitarProva(inventarioDaPessoa("a", "A", { pagamentos: r("a", 1) }))).toBe(true);
  });

  it("ficha com histórico grande exige, mesmo sem dinheiro", () => {
    expect(exigeDigitarProva(inventarioDaPessoa("a", "A", { documentos: r("a", 10) }))).toBe(true);
    expect(exigeDigitarProva(inventarioDaPessoa("a", "A", { documentos: r("a", 9) }))).toBe(false);
  });

  it("ficha vazia NÃO exige — é o duplicado que se apaga sem atrito", () => {
    // Cobra digitar o nome para apagar uma ficha de zero registro é atrito que
    // faz a pessoa desistir de limpar duplicata, que é o caso mais comum.
    expect(exigeDigitarProva(inventarioDaPessoa("a", "A", {}))).toBe(false);
  });
});

describe("a prova digitada é o ID, não o nome", () => {
  /* A conferência era pelo NOME, e o nome não prova nada justamente onde este
     botão mais é usado: no cadastro há TRÊS fichas "José Adilando Pereira" e
     TRÊS "Dermeval Vieira". Quem abrisse a ficha errada e digitasse o nome
     passava igualzinho — e apagava os 31 pagamentos da ficha boa. */
  it("o nome NÃO abre a porta: duas fichas homônimas, ids diferentes", () => {
    expect(provaConfere("José Adilando Pereira", "jose-adilando-pereira")).toBe(false);
    expect(provaConfere("jose-adilando-pereira", "jose-adilando-pereira-2")).toBe(false);
    expect(provaConfere("jose-adilando-pereira-2", "jose-adilando-pereira-2")).toBe(true);
  });

  it("tolera espaço sobrando e caixa — o que não dá é aceitar uma coisa por outra", () => {
    expect(provaConfere("  JOSE-ADILANDO-PEREIRA ", "jose-adilando-pereira")).toBe(true);
    expect(provaConfere("colaboradores_43ha4hms17l", "colaboradores_43ha4hms17l")).toBe(true);
  });

  it("recusa vazio e parcial", () => {
    expect(provaConfere("", "ana-silva")).toBe(false);
    expect(provaConfere("   ", "ana-silva")).toBe(false);
    expect(provaConfere("ana", "ana-silva")).toBe(false);
  });
});

describe("conta de login segura a exclusão", () => {
  const r = (dono: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, colaboradorId: dono }));

  it("com conta de acesso, apagar pela ficha fica impedido — como já era na aba Cadastros", () => {
    const inv = inventarioDaPessoa("a", "A", { usuarios: r("a", 1) });
    expect(impedimentoParaApagar(inv)).toContain("Usuários e Permissões");
  });

  it("conta DESATIVADA não impede — senão o aviso vira beco sem saída", () => {
    /* O aviso manda "desative em Painel de Controle → Usuários e Permissões".
       Só que desativar grava `ativo: false` e NÃO apaga a linha: contando
       todas, a pessoa fazia exatamente o que o aviso pedia e a ficha continuava
       travada, para sempre. */
    const inv = inventarioDaPessoa("a", "A", { usuarios: [{ id: "u1", colaboradorId: "a", ativo: false }] });
    expect(impedimentoParaApagar(inv)).toBeNull();
    expect(inv.contas).toEqual([]);
  });

  it("uma conta ativa entre desativadas ainda impede", () => {
    const inv = inventarioDaPessoa("a", "A", {
      usuarios: [
        { id: "u1", colaboradorId: "a", ativo: false },
        { id: "u2", colaboradorId: "a", ativo: true },
      ],
    });
    expect(impedimentoParaApagar(inv)).toContain("1 conta(s)");
  });

  it("sem conta, nada impede", () => {
    expect(impedimentoParaApagar(inventarioDaPessoa("a", "A", { pagamentos: r("a", 3) }))).toBeNull();
  });

  it("a conta NÃO entra no total do que some — ela é impedimento, não perda", () => {
    const inv = inventarioDaPessoa("a", "A", { usuarios: r("a", 1), documentos: r("a", 2) });
    expect(inv.total).toBe(2);
    expect(inv.contas).toEqual([{ colecao: "usuarios", rotulo: "contas de acesso ao sistema", quantidade: 1, temDinheiro: false }]);
  });
});

describe("trilha não some junto com a ficha", () => {
  const r = (dono: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `x${i}`, colaboradorId: dono }));

  it("acessos e alterações ficam de fora do que some — e fora do total", () => {
    /* As fichas repetidas do José e da Kelly tinham 9 e 10 linhas de trilha e
       ZERO dado de pessoa. Contando trilha como conteúdo, uma ficha vazia
       exigia digitar a prova e o aviso dizia "Somem 10 registro(s)" — número
       falso, e a trilha (append-only) ia junto com lápide para a nuvem. */
    const inv = inventarioDaPessoa("a", "A", { acessos: r("a", 9), alteracoes: r("a", 2) });
    expect(inv.total).toBe(0);
    expect(inv.linhas).toEqual([]);
    expect(exigeDigitarProva(inv)).toBe(false);
    expect(inv.trilha.map((l) => l.colecao)).toEqual(["acessos", "alteracoes"]);
    expect(resumoDoQueSome(inv)).toContain("não tem nenhum registro");
  });
});

describe("a lista de coleções não pode envelhecer calada", () => {
  it("toda coleção da pessoa tem rótulo em português", () => {
    for (const col of COLECOES_DA_PESSOA) {
      expect(ROTULO_COLECAO[col], `coleção "${col}" sem rótulo legível`).toBeTruthy();
    }
  });

  it("as siglas e nomes de código têm tradução — 'pdis' não diz nada a ninguém", () => {
    /* Só cobra tradução onde o nome da coleção NÃO é uma palavra que a pessoa
       usa. "documentos" já é português e fica igual; "pdis" e "certificacoesNr"
       não podem chegar assim na tela. */
    for (const col of ["pdis", "certificacoesNr", "acessos", "evolucao", "aceites", "fechamentos", "lancamentos", "respostasPesquisa", "contatos"]) {
      expect(ROTULO_COLECAO[col], `"${col}" precisa de tradução`).not.toBe(col);
    }
  });
});
