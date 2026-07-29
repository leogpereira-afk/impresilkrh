// Regras da CLT — é aqui que erro custa dinheiro de verdade (férias pagas em
// dobro, contrato que vira indeterminado). Os testes fixam a data de "hoje" para
// o resultado não mudar conforme o dia em que rodarem.
import { describe, it, expect } from "vitest";
import { situacaoFerias, situacaoExperiencia } from "./clt";
import type { Colaborador, Ferias } from "@/data/types";

const pessoa = (dataAdmissao: string): Colaborador =>
  ({ id: "p1", nome: "Teste", dataAdmissao, statusId: "ativo" } as Colaborador);
const feriasEm = (dataInicio: string, status = "Concluída"): Ferias =>
  ({ id: "f1", colaboradorId: "p1", dataInicio, status } as Ferias);

describe("situacaoFerias", () => {
  it("não calcula antes de 1 ano de casa (direito ainda não nasceu)", () => {
    const hoje = new Date(2026, 5, 1); // 01/06/2026
    expect(situacaoFerias(pessoa("2025-10-01"), [], hoje)).toBeNull();
  });

  it("sem admissão, não inventa prazo", () => {
    expect(situacaoFerias(pessoa(""), [], new Date(2026, 5, 1))).toBeNull();
  });

  it("logo após o primeiro ano, o prazo de conceder é 1 ano à frente", () => {
    const hoje = new Date(2026, 0, 15); // 15/01/2026
    const s = situacaoFerias(pessoa("2025-01-01"), [], hoje)!;
    expect(s.direitoDesde.getFullYear()).toBe(2026);
    expect(s.limiteConcessao.getFullYear()).toBe(2027);
    expect(s.jaGozou).toBe(false);
    expect(s.situacao).toBe("em-dia"); // ainda falta muito para o limite
  });

  it("marca A VENCER quando faltam 90 dias ou menos para o limite", () => {
    // direito nasceu em 01/01/2026, limite 01/01/2027; hoje 15/11/2026 (~47 dias)
    const s = situacaoFerias(pessoa("2025-01-01"), [], new Date(2026, 10, 15))!;
    expect(s.situacao).toBe("a-vencer");
    expect(s.diasParaLimite).toBeGreaterThan(0);
    expect(s.diasParaLimite).toBeLessThanOrEqual(90);
  });

  it("marca VENCIDA depois do limite — é o caso do pagamento em dobro", () => {
    // direito em 01/01/2026, limite 01/01/2027; hoje 01/03/2027
    const s = situacaoFerias(pessoa("2025-01-01"), [], new Date(2027, 2, 1))!;
    expect(s.situacao).toBe("vencida");
    expect(s.diasParaLimite).toBeLessThan(0);
  });

  it("quem já gozou dentro do período fica EM DIA mesmo perto do limite", () => {
    const s = situacaoFerias(pessoa("2025-01-01"), [feriasEm("2026-07-10")], new Date(2026, 10, 15))!;
    expect(s.jaGozou).toBe(true);
    expect(s.situacao).toBe("em-dia");
  });

  it("férias CANCELADAS não contam como gozadas", () => {
    const s = situacaoFerias(pessoa("2025-01-01"), [feriasEm("2026-07-10", "Cancelada")], new Date(2026, 10, 15))!;
    expect(s.jaGozou).toBe(false);
    expect(s.situacao).toBe("a-vencer");
  });

  it("férias ANTERIORES ao direito atual não contam (é do período passado)", () => {
    // direito nasceu 01/01/2026; férias gozadas em 2025 são do ciclo anterior
    const s = situacaoFerias(pessoa("2024-01-01"), [feriasEm("2025-06-01")], new Date(2026, 10, 15))!;
    expect(s.jaGozou).toBe(false);
  });
});

describe("situacaoExperiencia", () => {
  it("nos primeiros dias não incomoda ninguém", () => {
    const s = situacaoExperiencia(pessoa("2026-06-01"), new Date(2026, 5, 10))!;
    expect(s.situacao).toBe("primeiro-periodo");
  });

  it("perto dos 45 dias, avisa para decidir a prorrogação", () => {
    const s = situacaoExperiencia(pessoa("2026-05-01"), new Date(2026, 5, 14))!; // ~44 dias
    expect(s.situacao).toBe("decidir-prorrogacao");
  });

  it("faltando 15 dias ou menos, avisa para efetivar ou desligar", () => {
    // admissão 01/04/2026 → 90 dias caem em 30/06; hoje 20/06 = 10 dias
    const s = situacaoExperiencia(pessoa("2026-04-01"), new Date(2026, 5, 20))!;
    expect(s.situacao).toBe("decidir-efetivacao");
    expect(s.diasParaFim).toBeLessThanOrEqual(15);
  });

  it("passou dos 90 dias: contrato virou indeterminado", () => {
    const s = situacaoExperiencia(pessoa("2026-01-01"), new Date(2026, 3, 5))!; // ~94 dias
    expect(s.situacao).toBe("expirou");
    expect(s.diasParaFim).toBeLessThan(0);
  });

  it("para de avisar quando já passou muito tempo (não vira ruído eterno)", () => {
    expect(situacaoExperiencia(pessoa("2024-01-01"), new Date(2026, 5, 1))).toBeNull();
  });
});
