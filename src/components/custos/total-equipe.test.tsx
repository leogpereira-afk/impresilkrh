import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TotalEquipe } from "./total-equipe";
import { resumoDaEquipe, pesoDaPessoa } from "@/lib/provisaoEquipe";
import { formatBRL } from "@/lib/format";

const pagamentos = [
  { competencia: "2026-07", colaboradorId: "a", tipo: "Salário", valor: 800 },
  { competencia: "2026-08", colaboradorId: "a", tipo: "Salário", valor: 1000 },
  { competencia: "2026-08", colaboradorId: "b", tipo: "Freelancer (Empreita)", valor: 1000 },
  { competencia: "2026-08", colaboradorId: "c", tipo: "Salário", valor: 700, statusErp: "ABERTO" },
];
const resumo = resumoDaEquipe(pagamentos, "2026-08");
const texto = (comEncargos: boolean) => {
  const el = document.createElement("div");
  el.innerHTML = renderToStaticMarkup(<TotalEquipe resumo={resumo} pessoaNome="Ana" pessoaPeso={pesoDaPessoa(pagamentos, "2026-08", "a")} comEncargos={comEncargos} />);
  return el.textContent!;
};

describe("TotalEquipe — base explícita dos indicadores", () => {
  it("sem provisões, média usa pago e participação nomeia a base estimada", () => {
    const t = texto(false);
    expect(t).toContain(`Média por pessoa${formatBRL(1000)}`);
    expect(t).toContain("do custo estimado (com provisões)");
    expect(t).toContain("sobre a média do estimado");
    expect(t).toContain("fora dos totais acima");
    expect(t).not.toContain("entra na folha do mês");
  });

  it("com provisões, média e participação seguem o estimado", () => {
    const t = texto(true);
    expect(t).toContain(`Média por pessoa${formatBRL(resumo.estimado / resumo.pessoas)}`);
    expect(t).toContain("deste total");
  });
});
