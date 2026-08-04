// Regras da CLT — é aqui que erro custa dinheiro de verdade (férias pagas em
// dobro, contrato que vira indeterminado). Os testes fixam a data de "hoje" para
// o resultado não mudar conforme o dia em que rodarem.
import { describe, it, expect } from "vitest";
import { situacaoFerias, situacaoExperiencia, inicioDoHistorico } from "./clt";
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

// ---------------------------------------------------------------------------
// Achados da conferência das abas (2026-07-31): três buracos que custavam
// dinheiro ou poluíam o histórico. Ficam fixos aqui.
// ---------------------------------------------------------------------------
describe("clt — correções da conferência", () => {
  const pessoa = (extra: Partial<Colaborador> = {}): Colaborador =>
    ({ id: "x", nome: "Teste", dataAdmissao: "2023-01-10", ...extra }) as Colaborador;

  it("férias pela METADE não quitam o período (os 15 restantes também pagam em dobro)", () => {
    const hoje = new Date(2025, 0, 5); // 5/1/2025, dentro da janela de concessão
    const meio = situacaoFerias(pessoa(), [
      { id: "f1", colaboradorId: "x", dataInicio: "2024-03-10", dataRetorno: "2024-03-25", diasGozados: 15, saldoDias: 15, status: "Concluída" },
    ], hoje);
    expect(meio?.jaGozou).toBe(false);
    expect(meio?.diasEmAberto).toBe(15);

    const cheio = situacaoFerias(pessoa(), [
      { id: "f1", colaboradorId: "x", dataInicio: "2024-03-10", dataRetorno: "2024-04-09", diasGozados: 30, saldoDias: 0, status: "Concluída" },
    ], hoje);
    expect(cheio?.jaGozou).toBe(true);
    expect(cheio?.diasEmAberto).toBe(0);
  });

  it("base antiga sem diasGozados continua contando como gozada (não vira alarme falso)", () => {
    const s = situacaoFerias(pessoa(), [
      { id: "f1", colaboradorId: "x", dataInicio: "2024-03-10", dataRetorno: "2024-04-09", diasGozados: 0, saldoDias: 0, status: "Concluída" },
    ], new Date(2025, 0, 5));
    expect(s?.jaGozou).toBe(true);
  });

  it("quem foi desligado tem o relógio parado na saída, não em hoje", () => {
    const saiu = pessoa({ dataDesligamento: "2024-06-30", statusId: "inativo" });
    const a = situacaoFerias(saiu, [], new Date(2025, 0, 5));
    const b = situacaoFerias(saiu, [], new Date(2026, 6, 31)); // 18 meses depois
    expect(a?.diasParaLimite).toBe(b?.diasParaLimite);
  });

  it("experiência já decidida para de pedir decisão (não duplica a movimentação)", () => {
    const adm = "2026-05-20";
    const hoje = new Date(2026, 7, 5); // dia 77
    expect(situacaoExperiencia(pessoa({ dataAdmissao: adm }), hoje)).not.toBeNull();
    expect(situacaoExperiencia(pessoa({ dataAdmissao: adm, experienciaDecididaEm: "2026-08-04", statusId: "ativo" }), hoje)).toBeNull();
  });

  it("desligado não recebe mais aviso de contrato de experiência", () => {
    const hoje = new Date(2026, 7, 5);
    expect(situacaoExperiencia(pessoa({ dataAdmissao: "2026-05-20", dataDesligamento: "2026-07-15", statusId: "inativo" }), hoje)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Corte de histórico: o sistema não pode afirmar "venceu" sobre um período do
// qual ele não tem registro nenhum. Medido em produção: das 12 pessoas
// apontadas como vencidas, as 12 tinham o limite anterior ao primeiro registro
// do banco — o alerta era 100% ruído.
// ---------------------------------------------------------------------------
describe("situacaoFerias — sem histórico no sistema", () => {
  const HOJE_TESTE = new Date(2026, 7, 4);          // 04/08/2026
  const inicioBase = new Date(2025, 11, 6);         // 06/12/2025, como na produção

  it("dez anos de casa e nenhum registro antigo: NÃO diz que venceu", () => {
    const adilson = pessoa("2014-01-13");
    const s = situacaoFerias(adilson, [feriasEm("2026-02-13")], HOJE_TESTE, inicioBase)!;
    expect(s.situacao).not.toBe("vencida");
  });

  it("sem o corte, o mesmo caso continua acusando vencida (o bug de antes)", () => {
    const adilson = pessoa("2014-01-13");
    const s = situacaoFerias(adilson, [feriasEm("2026-02-13")], HOJE_TESTE)!;
    expect(s.situacao).toBe("vencida");
  });

  it("período DENTRO do histórico continua vencendo normalmente", () => {
    // Admitido em 2024: direito em 2025, limite em 2026 — tudo depois do corte.
    const novato = pessoa("2024-01-10");
    const s = situacaoFerias(novato, [], new Date(2026, 6, 1), new Date(2023, 0, 1))!;
    expect(s.situacao).toBe("vencida");
  });

  it("sem corte informado, o comportamento é o de sempre", () => {
    const s = situacaoFerias(pessoa("2024-01-10"), [], new Date(2026, 6, 1))!;
    expect(s.situacao).toBe("vencida");
  });

  it("quem gozou de verdade segue em dia, com ou sem corte", () => {
    const c = pessoa("2024-01-10");
    const gozo = [feriasEm("2025-03-01"), feriasEm("2025-03-01")];
    const s = situacaoFerias(c, gozo, new Date(2026, 6, 1), inicioBase)!;
    expect(["em-dia", "sem-registro"]).toContain(s.situacao);
  });
});

describe("inicioDoHistorico", () => {
  it("é o registro de férias mais antigo que existe", () => {
    const fs = [feriasEm("2026-02-13"), feriasEm("2025-12-06"), feriasEm("2026-01-06")];
    expect(inicioDoHistorico(fs)!.toISOString().slice(0, 10)).toBe("2025-12-06");
  });
  it("base vazia não tem histórico", () => {
    expect(inicioDoHistorico([])).toBeNull();
  });
  it("registro sem data não atrapalha", () => {
    const f = { ...feriasEm("2026-02-13"), dataInicio: null } as never;
    expect(inicioDoHistorico([f, feriasEm("2025-12-06")])!.toISOString().slice(0, 10)).toBe("2025-12-06");
  });
});
