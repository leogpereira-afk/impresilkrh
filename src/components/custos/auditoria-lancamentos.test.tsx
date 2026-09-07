/* A auditoria na TELA: apontar sem dizer como corrigir joga o trabalho todo em
 * quem lê. Pedido do Léo em 07/09/2026, olhando o painel: "mostra esses
 * defeitos mas não mostra como corrigir".
 *
 * Estes testes renderizam o painel de verdade e conferem que o "ver" abre com
 * a instrução — não só com a lista de nomes.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { AuditoriaLancamentos } from "./auditoria-lancamentos";
import { COMO_CORRIGIR } from "@/lib/auditoriaLancamentos";
import type { Colaborador, Pagamento } from "@/data/types";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Uma pessoa paga até agosto com o cadastro dizendo que ela saiu em março: é o
// achado "Cadastro contradiz os pagamentos" — os 8 erros da tela do Léo.
const pessoas: Colaborador[] = [
  { id: "ana", nome: "Ana Silva", statusId: "inativo", dataAdmissao: "2020-01-01", dataDesligamento: "2026-03-31" } as Colaborador,
];
const pagamentos: Pagamento[] = [
  { id: "p1", colaboradorId: "ana", competencia: "2026-08", tipo: "Salário", valor: 2000, dataPagamento: "2026-09-05", idMubi: "1" } as Pagamento,
];

describe("Auditoria dos lançamentos — o painel diz como corrigir", () => {
  let container: HTMLDivElement;
  let root: Root;

  const render = () => {
    act(() => {
      root.render(
        <AuditoriaLancamentos pagamentos={pagamentos} colaboradores={pessoas} onCorrigir={() => {}} />,
      );
    });
  };
  const clicarEm = (texto: string) => {
    const alvo = [...container.querySelectorAll("button")].find((b) => (b.textContent ?? "").includes(texto));
    expect(alvo, `não achei o botão "${texto}"`).toBeTruthy();
    act(() => { alvo!.dispatchEvent(new MouseEvent("click", { bubbles: true })); });
  };

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("achou o cadastro que contradiz os pagamentos", () => {
    render();
    expect(container.textContent).toContain("Cadastro contradiz os pagamentos");
  });

  it("ANTES de abrir, a instrução não polui a lista", () => {
    render();
    expect(container.textContent).not.toContain("Como corrigir");
  });

  it("ao abrir o grupo, mostra causa e passos — não só os nomes", () => {
    render();
    clicarEm("Cadastro contradiz os pagamentos");
    const t = container.textContent ?? "";
    expect(t).toContain("Como corrigir");
    expect(t).toContain(COMO_CORRIGIR.cadastro.causa);
    for (const passo of COMO_CORRIGIR.cadastro.passos) expect(t).toContain(passo);
    expect(t).toContain("Ana Silva"); // a lista continua lá
  });

  it("diz ONDE se resolve", () => {
    render();
    clicarEm("Cadastro contradiz os pagamentos");
    expect(container.textContent).toContain("Resolve na ficha da pessoa");
  });

  it("os passos vêm numerados, na ordem em que devem ser feitos", () => {
    render();
    clicarEm("Cadastro contradiz os pagamentos");
    const ol = container.querySelector("ol");
    expect(ol, "os passos precisam ser uma lista ordenada").toBeTruthy();
    const itens = [...ol!.querySelectorAll("li")].map((li) => li.textContent);
    expect(itens).toEqual(COMO_CORRIGIR.cadastro.passos);
  });

  it("fecha de novo ao clicar outra vez", () => {
    render();
    clicarEm("Cadastro contradiz os pagamentos");
    expect(container.textContent).toContain("Como corrigir");
    clicarEm("Cadastro contradiz os pagamentos");
    expect(container.textContent).not.toContain("Como corrigir");
  });

  it("não promete o botão automático onde ele não resolve", () => {
    // O achado de cadastro é decisão humana. Oferecer "Corrigir automático"
    // aqui faria a pessoa clicar, nada mudar, e desconfiar do painel inteiro.
    render();
    clicarEm("Cadastro contradiz os pagamentos");
    const dentro = container.querySelector("ol")!.closest("div")!;
    expect(dentro.textContent).not.toContain("Corrigir");
  });

  /* O outro lado da mesma régua: onde o conserto automático EXISTE, o botão
     tem de estar ali, junto da instrução. Sem este teste, "não promete" acima
     passaria mesmo se o botão tivesse sumido de todos os lugares. */
  it("onde o conserto automático existe, o botão aparece junto da instrução", () => {
    // Conta do ERP diz Salário, lançamento gravado como Diária: determinístico.
    const errado: Pagamento[] = [
      { id: "p2", colaboradorId: "bia", competencia: "2026-08", tipo: "Diária", valor: 100,
        dataPagamento: "2026-09-05", descricao: "pgto · 2.1.1-Salário", idMubi: "2" } as Pagamento,
    ];
    const bia: Colaborador[] = [
      { id: "bia", nome: "Bia Souza", statusId: "ativo", dataAdmissao: "2020-01-01" } as Colaborador,
    ];
    act(() => {
      root.render(<AuditoriaLancamentos pagamentos={errado} colaboradores={bia} onCorrigir={() => {}} />);
    });
    clicarEm("Tipo ≠ conta do ERP");
    const t = container.textContent ?? "";
    expect(t).toContain("Tem conserto automático");
    expect(t).toContain(COMO_CORRIGIR.classificacao.causa);
    const dentro = container.querySelector("ol")!.closest("div")!;
    expect(dentro.textContent).toContain("Corrigir");
  });
});
