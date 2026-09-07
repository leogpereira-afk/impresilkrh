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
    expect(texto()).toContain("não conta no botão");
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
