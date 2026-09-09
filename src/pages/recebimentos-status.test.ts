import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { tituloPago } from "@/lib/mubiPagamentos";
import { TIPOS_ENCARGO } from "@/lib/folha";
import type { Pagamento } from "@/data/types";

// Executa os seletores reais das telas, sem montar navegação ou coleções de
// produção. Assim o teste pega a omissão do filtro no consumidor, não só no helper.
function calcular<T>(arquivo: string, variavel: string, entrada: Record<string, unknown>): T {
  const fonte = ts.createSourceFile(arquivo, readFileSync(`src/pages/${arquivo}`, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let expressao: string | undefined;
  const visitar = (no: ts.Node) => {
    if (ts.isVariableDeclaration(no) && ts.isIdentifier(no.name) && no.name.text === variavel && no.initializer) {
      if (expressao) throw new Error(`Seletor ambíguo: ${variavel}`);
      expressao = no.initializer.getText(fonte);
    }
    ts.forEachChild(no, visitar);
  };
  const escopo = arquivo === "ColaboradorFicha.tsx"
    ? fonte.statements.find((no) => ts.isFunctionDeclaration(no) && no.name?.text === "AbaFinanceiro")
    : fonte;
  if (!escopo) throw new Error("AbaFinanceiro ausente");
  visitar(escopo);
  if (!expressao) throw new Error(`Seletor ausente: ${variavel}`);
  const codigo = ts.transpileModule(`return (${expressao});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const contexto = { tituloPago, TIPOS_ENCARGO, useMemo: (fn: () => unknown) => fn(), ...entrada };
  return new Function(...Object.keys(contexto), codigo)(...Object.values(contexto)) as T;
}

const pg = (id: string, statusErp?: string): Pagamento => ({
  id, colaboradorId: "ana", competencia: "2026-08", tipo: "Salário", valor: 100,
  dataPagamento: "2026-09-05", statusErp,
});
const pagamentos: Pagamento[] = [
  pg("pago", "PAGO"), pg("legado"),
  ...["ABERTO", "CANCELADO", "ESTORNADO", "NÃO PAGO", "NAO PAGO", "NÃO QUITADO", "AGENDADO"].map((s) => pg(s, s)),
  { ...pg("outra-pessoa", "PAGO"), colaboradorId: "bia" },
  { ...pg("encargo", "PAGO"), tipo: "FGTS", valor: 80 },
  { ...pg("encargo-aberto", "ABERTO"), tipo: "FGTS", valor: 900 },
];
const ids = (p: Pagamento[]) => p.map((x) => x.id);

describe("A05 — recebido nas telas exclui aberto/cancelado", () => {
  it("Painel: folha paga mantém escopo, legados e exclui encargos", () => {
    const r = calcular<Pagamento[]>("Painel.tsx", "pagsFolha", { pagamentos, idsBruto: new Set(["ana"]) });
    expect(ids(r)).toEqual(["pago", "legado"]);
    expect(r.reduce((s, p) => s + p.valor, 0)).toBe(200);
  });

  it("Painel pessoal: ganhos usam apenas recebimentos da pessoa", () => {
    expect(ids(calcular<Pagamento[]>("Painel.tsx", "meusPagamentos", { pagamentos, c: { id: "ana" } }))).toEqual(["pago", "legado"]);
  });

  it("Colaboradores: total, quantidade e composição respeitam status e competência", () => {
    const r = calcular<Map<string, { total: number; n: number; tipos: { tipo: string; valor: number }[] }>>("Colaboradores.tsx", "custoPorColab", {
      pagamentos: [...pagamentos, { ...pg("outro-mes", "PAGO"), competencia: "2026-07" }], mesCusto: "2026-08",
    });
    expect(r.get("ana")).toEqual({ total: 200, n: 2, tipos: [{ tipo: "Salário", valor: 200 }] });
    expect(r.get("bia")?.total).toBe(100);
  });

  it("Ficha: recebido e encargos à parte só contêm baixados", () => {
    const todos = calcular<Pagamento[]>("ColaboradorFicha.tsx", "todos", { pagamentos, c: { id: "ana" } });
    expect(ids(calcular<Pagamento[]>("ColaboradorFicha.tsx", "meus", { todos }))).toEqual(["pago", "legado"]);
    expect(ids(calcular<Pagamento[]>("ColaboradorFicha.tsx", "encargos", { todos }))).toEqual(["encargo"]);
    // O consumidor não remove itens da coleção que a auditoria usa.
    expect(pagamentos.some((p) => p.id === "ABERTO")).toBe(true);
  });
});
