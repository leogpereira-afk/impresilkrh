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

  it("O CASO QUE IMPORTA: quem foi admitido HOJE já está em experiência", () => {
    // O quadro de Colaboradores escondia o recém-admitido (só entrava a partir
    // de 35 dias de casa). Quem cadastrava alguém não via a pessoa no bloco e
    // concluía, com razão, que o cadastro tinha se perdido. O relógio dos 90
    // dias corre desde o primeiro dia — então a conta vale desde o primeiro dia.
    const s = situacaoExperiencia(pessoa("2026-06-10"), new Date(2026, 5, 10))!;
    expect(s).not.toBeNull();
    expect(s.diasDeCasa).toBe(0);
    expect(s.situacao).toBe("primeiro-periodo");
    expect(s.diasParaFim).toBe(90);
  });

  it("quem entrou ontem ou anteontem também conta", () => {
    expect(situacaoExperiencia(pessoa("2026-06-09"), new Date(2026, 5, 10))!.diasDeCasa).toBe(1);
    expect(situacaoExperiencia(pessoa("2026-06-08"), new Date(2026, 5, 10))!.diasDeCasa).toBe(2);
  });

  it("admissão com data futura não entra (data digitada errada não vira aviso)", () => {
    expect(situacaoExperiencia(pessoa("2026-07-01"), new Date(2026, 5, 10))).toBeNull();
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
// ---------------------------------------------------------------------------
// Férias tiradas COM MUITO ATRASO precisam quitar o período. A conta antiga só
// olhava os gozos dentro de uma janela fixa de 24 meses a partir do direito;
// quem regularizou depois disso — justamente quem estava pior — nunca saía do
// "VENCIDAS há N dias", e a ficha ainda afirmava "por lei, o pagamento é em
// dobro" sobre um período já concedido. Agora cada dia gozado abate o período
// em aberto MAIS ANTIGO (FIFO), que é como se acerta férias atrasadas.
// ---------------------------------------------------------------------------
describe("situacaoFerias — férias atrasadas quitam o período (FIFO)", () => {
  const HOJE_F = new Date(2026, 7, 10); // 10/08/2026
  const gozo = (inicio: string, dias: number): Ferias =>
    ({ id: "g" + inicio, colaboradorId: "p1", dataInicio: inicio, diasGozados: dias, status: "Concluída" } as Ferias);

  it("O CASO QUE IMPORTA: tirou as férias 2 anos atrasado — o período mais antigo sai da lista", () => {
    // Admitido 13/01/2022 → 1º período vence 13/01/2024. Tirou 30 dias em
    // março/2025 (14 meses depois do limite). Antes: seguia "vencida há 940
    // dias" no MESMO período, como se nunca tivesse tirado.
    const semGozo = situacaoFerias(pessoa("2022-01-13"), [], HOJE_F)!;
    const comGozo = situacaoFerias(pessoa("2022-01-13"), [gozo("2025-03-03", 30)], HOJE_F)!;
    expect(semGozo.limiteConcessao.getFullYear()).toBe(2024);
    expect(comGozo.limiteConcessao.getFullYear()).toBe(2025); // andou para o período seguinte
    expect(comGozo.diasParaLimite).toBeGreaterThan(semGozo.diasParaLimite);
  });

  it("quem tirou 30 dias todo ano está em dia", () => {
    const s = situacaoFerias(pessoa("2022-01-13"),
      [gozo("2023-06-01", 30), gozo("2024-06-01", 30), gozo("2025-06-01", 30)], HOJE_F)!;
    expect(s.situacao).toBe("em-dia");
  });

  it("15+15 no mesmo período somam 30 e quitam", () => {
    const s = situacaoFerias(pessoa("2022-01-13"),
      [gozo("2023-06-01", 15), gozo("2023-11-01", 15)], HOJE_F)!;
    // O 1º período (limite 13/01/2024) está quitado: o aberto agora é o seguinte.
    expect(s.limiteConcessao.getFullYear()).toBe(2025);
  });

  it("meio período não quita: 15 dias deixam 15 em aberto", () => {
    const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2023-06-01", 15)], HOJE_F)!;
    expect(s.jaGozou).toBe(false);
    expect(s.diasEmAberto).toBe(15);
    expect(s.limiteConcessao.getFullYear()).toBe(2024); // ainda o 1º período
  });

  it("gozo grande transborda para o período seguinte", () => {
    // 60 dias de uma vez quitam dois períodos.
    const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2025-03-03", 60)], HOJE_F)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2026);
  });

  it("não quita período cujo direito ainda não tinha nascido na data do gozo", () => {
    // Gozo em 2023 não pode abater o período que só nasce em 2025.
    const s = situacaoFerias(pessoa("2022-01-13"), [gozo("2023-06-01", 30)], HOJE_F)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2025);
    expect(s.jaGozou).toBe(false);
  });

  it("férias canceladas não quitam nada", () => {
    const cancelada = { ...gozo("2025-03-03", 30), status: "Cancelada" } as Ferias;
    const s = situacaoFerias(pessoa("2022-01-13"), [cancelada], HOJE_F)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2024);
  });
});

// ---------------------------------------------------------------------------
// AGENDAR NÃO É GOZAR. Achado bloqueador da revisão de 10/08/2026: o FIFO
// creditava qualquer registro de férias ao período em aberto mais antigo sem
// perguntar se o gozo JÁ ACONTECEU. Bastava o RH agendar 30 dias para o ano que
// vem e o "VENCIDAS há N dias — pagamento em dobro" sumia no mesmo instante da
// ficha, do sino e do calendário. A dívida do art. 137 continuava lá, invisível.
// ---------------------------------------------------------------------------
describe("situacaoFerias — agendar não quita o período", () => {
  const HOJE_A = new Date(2026, 7, 10); // 10/08/2026
  const reg = (inicio: string, dias: number, status = "Concluída"): Ferias =>
    ({ id: "r" + inicio, colaboradorId: "p1", dataInicio: inicio, diasGozados: dias, status } as Ferias);

  it("O CASO QUE IMPORTA: agendar para o ano que vem NÃO apaga o vencido", () => {
    const semNada = situacaoFerias(pessoa("2023-12-06"), [], HOJE_A)!;
    expect(semNada.situacao).toBe("vencida");
    const comAgendamento = situacaoFerias(
      pessoa("2023-12-06"), [reg("2027-01-18", 30, "Agendada")], HOJE_A)!;
    expect(comAgendamento.situacao).toBe("vencida");
    expect(comAgendamento.limiteConcessao.getTime()).toBe(semNada.limiteConcessao.getTime());
  });

  it("o agendamento aparece na resposta, para a tela poder informar em vez de calar", () => {
    const s = situacaoFerias(pessoa("2023-12-06"), [reg("2027-01-18", 30, "Agendada")], HOJE_A)!;
    expect(s.diasAgendados).toBe(30);
    expect(s.agendadoPara?.getFullYear()).toBe(2027);
  });

  it("gozo que JÁ COMEÇOU continua quitando, mesmo em atraso", () => {
    const s = situacaoFerias(pessoa("2022-01-13"), [reg("2025-03-03", 30)], HOJE_A)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2025); // andou de período
  });

  it("gozo em curso (começou ontem, termina depois) já conta", () => {
    const s = situacaoFerias(pessoa("2022-01-13"), [reg("2026-08-09", 30)], HOJE_A)!;
    expect(s.limiteConcessao.getFullYear()).toBeGreaterThan(2024);
  });

  it("status Agendada mas com data JÁ PASSADA conta — o que vale é a data, não o rótulo", () => {
    // O texto do status é digitado à mão e ninguém volta para atualizá-lo.
    const s = situacaoFerias(pessoa("2022-01-13"), [reg("2025-03-03", 30, "Agendada")], HOJE_A)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2025);
  });
});

// ---------------------------------------------------------------------------
// Registro ANTIGO sem `diasGozados` (base importada) não pode apagar dias
// parciais já creditados: quem tirou 15 dos 30 continua devendo 15, e esses 15
// também são pagos em dobro.
// ---------------------------------------------------------------------------
describe("situacaoFerias — registro sem dias não engole crédito parcial", () => {
  const HOJE_B = new Date(2026, 7, 10);
  const reg = (inicio: string, dias: number): Ferias =>
    ({ id: "r" + inicio, colaboradorId: "p1", dataInicio: inicio, diasGozados: dias, status: "Concluída" } as Ferias);

  it("15 dias tirados + registro sem dias = ainda faltam 15", () => {
    const s = situacaoFerias(pessoa("2022-01-13"), [reg("2023-06-01", 15), reg("2023-11-01", 0)], HOJE_B)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2024); // ainda o mesmo período
    expect(s.jaGozou).toBe(false);
    expect(s.diasEmAberto).toBe(15);
  });

  it("registro sem dias em período INTOCADO continua quitando (não grita com base antiga)", () => {
    const s = situacaoFerias(pessoa("2022-01-13"), [reg("2023-06-01", 0)], HOJE_B)!;
    expect(s.limiteConcessao.getFullYear()).toBe(2025); // quitou o 1º e andou
  });
});

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

  it("O CASO DO ADILSON: 12 anos de casa, sem registro antigo, NÃO acusa dívida", () => {
    /* Medido na base real em 10/08/2026: o corte global valia 23/11/2023 por
       causa de UM registro solto, e o sistema acusava 12 das 32 pessoas no
       quadro. Adilson (admitido em 2014) recebia "VENCIDAS há 940 dias — o
       pagamento é em dobro" por períodos que o sistema nunca teve como conferir.
       Quem já estava na casa antes de o sistema existir só é julgado a partir do
       PRIMEIRO REGISTRO DELE. */
    const adilson = pessoa("2014-01-13");
    const cortePequeno = new Date(2023, 10, 23);      // 23/11/2023
    const hoje = new Date(2026, 7, 10);
    const s = situacaoFerias(adilson, [feriasEm("2026-12-14")], hoje, cortePequeno)!;
    expect(s.situacao).not.toBe("vencida");
  });

  it("mas a partir do 1º registro DELE, o sistema volta a julgar", () => {
    // Registro em 2023 → o período que nasce depois disso é observável.
    const antigo = pessoa("2014-01-13");
    const s = situacaoFerias(antigo, [feriasEm("2023-01-20")], new Date(2026, 7, 10), new Date(2023, 0, 1))!;
    expect(s.situacao).toBe("vencida");
  });

  it("quem entrou DEPOIS do corte é julgado normalmente, mesmo sem registro", () => {
    // A vida inteira dessa pessoa na empresa está sob observação: não ter
    // registro é achado de verdade, não falta de dado.
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
