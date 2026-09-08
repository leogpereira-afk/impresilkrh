import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { PreviaFolha } from "./previa-folha";
import { resumoDaPrevia } from "@/lib/previaFolha";
import type { Colaborador, Pagamento } from "@/data/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pg = (over: Partial<Pagamento> & { id: string }): Pagamento =>
  ({ colaboradorId: "ana", competencia: "2026-07", tipo: "Salário", valor: 1000, dataPagamento: "2026-08-05", descricao: "x · 2.1.1-Salário", idMubi: over.id.replace("mubi-", ""), ...over });
const pessoas: Record<string, Colaborador> = {
  ana: { id: "ana", nome: "Ana Silva", statusId: "ativo", dataAdmissao: "2020-01-01" } as Colaborador,
  saiu: { id: "saiu", nome: "Saiu Cedo", statusId: "inativo", dataAdmissao: "2019-01-01", dataDesligamento: "2026-03-31" } as Colaborador,
};

describe("PreviaFolha — diz o que muda e trava até conferir", () => {
  let container: HTMLDivElement;
  let root: Root;
  const trocaTipo = { antigo: pg({ id: "mubi-1", tipo: "Diária" }), novo: pg({ id: "mubi-1", tipo: "Comissão" }) };
  const renumera = { antigo: pg({ id: "mubi-2", descricao: "x · 2.1.11.1-Diária", tipo: "Diária" }), novo: pg({ id: "mubi-2", descricao: "x · 2.1.11.3-Diária", tipo: "Diária" }) };
  const novoFora = pg({ id: "mubi-3", colaboradorId: "saiu", tipo: "Salário", competencia: "2026-07" });
  const semDono = pg({ id: "mubi-4", idMubi: "4" });
  const gravados = [trocaTipo.antigo, renumera.antigo, semDono];
  const resumo = resumoDaPrevia({
    diff: { iguais: [], alterados: [trocaTipo, renumera], novos: [novoFora], ausentes: [semDono] },
    gravados, janela: new Set(["2026-07"]), ausentesMarcados: new Set(),
    colaboradorPor: (id) => pessoas[id], tiposEncargo: ["FGTS", "INSS"], hoje: new Date(2026, 8, 7), semDono: new Set(["4"]),
  });
  const confirmados = new Set<never>();

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(
        <PreviaFolha
          resumo={resumo} iguais={0} cobertura={{ truncado: false, pedidas: ["2026-07"], lidas: ["2026-07"], falhas: [] }}
          nomeDe={(id) => pessoas[id]?.nome ?? id}
          ausentesMarcados={new Set()} onMarcarAusente={() => {}} onMarcarBloco={() => {}}
          excluidos={new Set()} onExcluir={() => {}} onExcluirBloco={() => {}}
          confirmados={confirmados as never} onConfirmar={() => {}}
          salarios={[]} salariosMarcados={new Set()} onMarcarSalario={() => {}} cpfs={[]}
          onAplicar={() => {}} onCancelar={() => {}}
        />,
      );
    });
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const texto = () => document.body.textContent ?? "";

  it("a troca de tipo aparece como de → para, não como 'R$ X → R$ X'", () => {
    expect(texto()).toContain("Trocam de tipo");
    expect(texto()).toMatch(/tipo:\s*Diária\s*→\s*Comissão/);
  });
  it("a conta renumerada é dita como tal e não conta no botão", () => {
    expect(texto()).toContain("Conta renumerada pelo contador");
    /* A INTENÇÃO É A MESMA; o texto da tela é que mudou (08/09/2026, sessão
       vizinha). A asserção procurava a frase literal "não conta no botão", que
       a tela não diz mais — ela diz no próprio botão quantas alterações são só
       de texto/conta/id. Afirmar a frase velha deixava o main vermelho e
       travava o deploy de todo mundo (deploy.yml roda `npm run verificar`).
       Agora afirma o que o usuário lê de verdade, no lugar onde decide. */
    expect(texto()).toMatch(/Aplicar\s*2 alteração\(ões\)\s*·\s*1 só de texto\/conta\/id/);
    expect(texto()).toMatch(/2\.1\.11\.1-Diária\s*→\s*2\.1\.11\.3-Diária/);
  });
  it("o botão fica travado enquanto há aviso sem 'conferi'", () => {
    const botao = [...document.body.querySelectorAll("button")].find((b) => /Aplicar/.test(b.textContent ?? ""))!;
    expect(botao).toBeTruthy();
    expect(botao.disabled).toBe(true);
    expect(texto()).toContain("trocam de tipo");
    expect(texto()).toContain("não estava no quadro do mês");
  });
  it("o ausente que existe no ERP fica no bloco 'sem pessoa', sem caixa de remover", () => {
    expect(texto()).toContain("No ERP, mas sem pessoa nesta busca");
    const caixas = [...document.body.querySelectorAll('input[type="checkbox"]')].map((c) => c.getAttribute("aria-label") ?? "");
    expect(caixas.some((l) => l.startsWith("Remover Ana Silva"))).toBe(false);
  });
  it("o número de dinheiro está na tela", () => {
    expect(texto()).toContain("Pago à equipe nos meses da busca");
    expect(texto().replace(/\u00a0/g, " ")).toContain("R$ 1.000,00"); // formatBRL usa espaço duro
  });
});

/* ESCOLHER O QUE APLICAR — "aqui eu tenho que escolher os que eu quero fazer e
   os que não quero; aqui fica obrigado a fazer" (Léo, 07/09/2026). */
describe("PreviaFolha — dá para desmarcar linha a linha", () => {
  let container: HTMLDivElement;
  let root: Root;
  const antigo = pg({ id: "mubi-1", valor: 1000 });
  const novo = pg({ id: "mubi-1", valor: 1500 });
  const gravados = [antigo];
  const entrada = (excluidos: Set<string>) => resumoDaPrevia({
    diff: { iguais: [], alterados: [{ antigo, novo }], novos: [], ausentes: [] },
    gravados, janela: new Set(["2026-07"]), ausentesMarcados: new Set(), excluidos,
    colaboradorPor: (id) => pessoas[id], tiposEncargo: ["FGTS", "INSS"], hoje: new Date(2026, 8, 7), semDono: new Set(),
  });
  const desenhar = (excluidos: Set<string>, onExcluir: (id: string, fora: boolean) => void = () => {}) => {
    act(() => {
      root.render(
        <PreviaFolha
          resumo={entrada(excluidos)} iguais={0}
          nomeDe={(id) => pessoas[id]?.nome ?? id}
          ausentesMarcados={new Set()} onMarcarAusente={() => {}} onMarcarBloco={() => {}}
          excluidos={excluidos} onExcluir={onExcluir} onExcluirBloco={() => {}}
          confirmados={new Set() as never} onConfirmar={() => {}}
          salarios={[]} salariosMarcados={new Set()} onMarcarSalario={() => {}} cpfs={[]}
          onAplicar={() => {}} onCancelar={() => {}}
        />,
      );
    });
  };

  beforeEach(() => { container = document.createElement("div"); document.body.appendChild(container); act(() => { root = createRoot(container); }); });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  it("cada alteração tem sua caixa, marcada por padrão", () => {
    desenhar(new Set());
    const cx = document.body.querySelector("input[aria-label^='Aplicar a alteração']") as HTMLInputElement;
    expect(cx, "faltou a caixa por linha").toBeTruthy();
    expect(cx.checked).toBe(true);
  });

  it("desmarcar avisa quem chamou, com o id e o novo estado", () => {
    const vistos: [string, boolean][] = [];
    desenhar(new Set(), (id, fora) => vistos.push([id, fora]));
    const cx = document.body.querySelector("input[aria-label^='Aplicar a alteração']") as HTMLInputElement;
    act(() => { cx.click(); });
    expect(vistos).toEqual([["mubi-1", true]]);
  });

  it("desmarcada, a linha CONTINUA visível — riscada, não some", () => {
    desenhar(new Set(["mubi-1"]));
    expect((document.body.textContent ?? "")).toContain("Ana");
    const cx = document.body.querySelector("input[aria-label^='Aplicar a alteração']") as HTMLInputElement;
    expect(cx.checked).toBe(false);
  });

  it("o BOTÃO reflete a escolha — o número prometido é o que será aplicado", () => {
    desenhar(new Set());
    expect((document.body.textContent ?? "")).toContain("Aplicar 1 alteração(ões)");
    desenhar(new Set(["mubi-1"]));
    expect((document.body.textContent ?? "")).toContain("Nada a alterar");
  });

  it("o bloco mostra quantas ficaram de fora", () => {
    desenhar(new Set(["mubi-1"]));
    /* Mesma coisa: a tela passou a dizer "1 rejeitada(s)" no lugar de "1 fora". */
    expect((document.body.textContent ?? "")).toContain("1 rejeitada(s)");
  });
});

describe("aceitar algumas, rejeitar outras", () => {
  /* Pedido do Léo em 08/09/2026: "eu precisava rejeitar algumas coisas,
     aceitar outras e apagar o que não era necessário" — e a tela não deixava.
     O bloco "Novos lançamentos" não tinha caixa NENHUMA: os novos entravam
     obrigatoriamente, e são o maior volume da importação.

     O mais revelador: `previaFolha` já sabia excluí-los, com teste verde
     ("desmarcar um NOVO também tira"). A regra funcionava e a interface não
     oferecia o caminho — teste de regra verde não prova que a tela pergunta.
     Por isso esta suíte olha o DOM. */
  let container: HTMLDivElement;
  let root: Root;
  const excluidos = new Set<string>();
  const excluidosChamados: { id: string; fora: boolean }[] = [];
  const blocosChamados: { ids: string[]; fora: boolean }[] = [];
  const novoA = pg({ id: "mubi-10", tipo: "Salário" });
  const novoB = pg({ id: "mubi-11", tipo: "Adiantamento", valor: 500 });
  const resumo2 = resumoDaPrevia({
    diff: { iguais: [], alterados: [], novos: [novoA, novoB], ausentes: [] },
    gravados: [], janela: new Set(["2026-07"]), ausentesMarcados: new Set(),
    colaboradorPor: (id) => pessoas[id], tiposEncargo: ["FGTS", "INSS"], hoje: new Date(2026, 8, 7),
  });

  beforeEach(() => {
    excluidosChamados.length = 0; blocosChamados.length = 0;
    container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      root = createRoot(container);
      root.render(
        <PreviaFolha
          resumo={resumo2} iguais={0} cobertura={{ truncado: false, pedidas: ["2026-07"], lidas: ["2026-07"], falhas: [] }}
          nomeDe={(id) => pessoas[id]?.nome ?? id}
          ausentesMarcados={new Set()} onMarcarAusente={() => {}} onMarcarBloco={() => {}}
          excluidos={excluidos}
          onExcluir={(id, fora) => { excluidosChamados.push({ id, fora }); }}
          onExcluirBloco={(ids, fora) => { blocosChamados.push({ ids, fora }); }}
          confirmados={new Set() as never} onConfirmar={() => {}}
          salarios={[]} salariosMarcados={new Set()} onMarcarSalario={() => {}} cpfs={[]}
          onAplicar={() => {}} onCancelar={() => {}}
        />,
      );
    });
  });
  afterEach(() => { act(() => root.unmount()); container.remove(); });

  const caixaDe = (rotulo: string) =>
    [...document.body.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
      .find((c) => (c.getAttribute("aria-label") ?? "").includes(rotulo));

  it("cada lançamento NOVO tem a sua caixa — dá para rejeitar um e aceitar o outro", () => {
    const caixa = caixaDe("Aplicar o novo lançamento de Ana Silva");
    expect(caixa, "o bloco de novos precisa de caixa por linha").toBeTruthy();
    expect(caixa!.checked).toBe(true);
    act(() => { caixa!.click(); });
    expect(excluidosChamados).toEqual([{ id: "mubi-10", fora: true }]);
  });

  it("dá para aprovar o bloco inteiro SEM abrir a seção — a caixa fica no cabeçalho", () => {
    // Tudo nasce desmarcado; se a caixa do bloco morasse dentro do <details>,
    // aprovar as 99 linhas de texto/conta exigiria expandir tudo antes.
    const caixa = caixaDe("Aplicar os 2 lançamentos novos");
    expect(caixa, "a caixa do bloco de novos precisa estar no <summary>").toBeTruthy();
    expect(caixa!.closest("summary"), "a caixa tem de ficar no cabeçalho").toBeTruthy();
    act(() => { caixa!.click(); });
    expect(blocosChamados).toEqual([{ ids: ["mubi-10", "mubi-11"], fora: true }]);
  });

  it("“Nenhuma” zera a escolha para quem quer aceitar poucas", () => {
    // Sem isto, aceitar meia dúzia exigia desmarcar ~160 uma a uma — que é o
    // que fazia a tela parecer "tudo ou nada".
    const botao = [...document.body.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Nenhuma");
    expect(botao, "faltou o botão Nenhuma").toBeTruthy();
    act(() => { botao!.click(); });
    expect(blocosChamados[0].fora).toBe(true);
    expect(blocosChamados[0].ids).toEqual(expect.arrayContaining(["mubi-10", "mubi-11"]));
  });

  it("o contador diz quantas estão marcadas de quantas", () => {
    expect(document.body.textContent).toContain("2 de 2 marcadas para aplicar");
  });
});
