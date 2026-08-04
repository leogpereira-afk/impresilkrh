import { describe, it, expect } from "vitest";
import {
  validarAgendamento, validarPeriodo, retornoDe, diasEntre, inicioProibido,
  temErro, erros, MIN_FRACAO_DIAS, MAX_ABONO_DIAS,
} from "@/lib/feriasAgenda";
import type { Ferias } from "@/data/types";

/* Compara pelo dia LOCAL, nunca por toISOString().
   toISOString() converte para UTC: em fuso à frente de UTC, a meia-noite local
   de 20/08 vira 19/08 e o teste reprova sem que nada esteja errado no código.
   Foi assim que a CI (que roda em UTC) ficou vermelha enquanto tudo passava
   aqui. O app já tem diaLocalISO para isso — o teste usa a mesma régua. */
const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;


// Segunda-feira, para os casos que não são sobre dia da semana.
const SEG = new Date("2026-09-07T12:00:00");
const dia = (s: string) => new Date(`${s}T12:00:00`);

const periodo = (inicio: string, retorno: string, extra: Partial<Ferias> = {}): Ferias => ({
  id: "f" + inicio, colaboradorId: "c1", dataInicio: dia(inicio).toISOString(),
  dataRetorno: dia(retorno).toISOString(), diasGozados: 0, saldoDias: 0,
  status: "Agendada", ...extra,
});

describe("contas de data", () => {
  it("30 dias a partir de 01/09 devolvem ao trabalho em 01/10", () => {
    expect(localISO(retornoDe(dia("2026-09-01"), 30))).toBe("2026-10-01");
  });

  it("atravessa a virada do ano sem perder um dia", () => {
    expect(localISO(retornoDe(dia("2026-12-20"), 30))).toBe("2027-01-19");
  });

  it("atravessa o horário de verão sem cair no dia anterior", () => {
    // A conta antiga somava dias com o relógio na meia-noite; numa virada de
    // fuso isso devolvia o dia anterior. Ancorada no meio-dia, não acontece.
    expect(localISO(retornoDe(dia("2026-02-01"), 15))).toBe("2026-02-16");
  });

  it("mede os dias entre as duas datas", () => {
    expect(diasEntre(dia("2026-09-01"), dia("2026-10-01"))).toBe(30);
    expect(diasEntre(dia("2026-09-01"), dia("2026-09-16"))).toBe(15);
  });
});

describe("art. 134 §3 — quando NÃO pode começar", () => {
  it("sexta, sábado e domingo são barrados", () => {
    expect(inicioProibido(dia("2026-09-04"))).toBe(true);  // sexta
    expect(inicioProibido(dia("2026-09-05"))).toBe(true);  // sábado
    expect(inicioProibido(dia("2026-09-06"))).toBe(true);  // domingo
  });
  it("de segunda a quinta pode", () => {
    for (const d of ["2026-09-07", "2026-09-08", "2026-09-09", "2026-09-10"]) {
      expect(inicioProibido(dia(d))).toBe(false);
    }
  });
  it("é aviso, não erro: a empresa pode ter feriado próprio", () => {
    const a = validarAgendamento({ inicio: dia("2026-09-04"), dias: 30 });
    expect(temErro(a)).toBe(false);
    expect(a.some((x) => x.nivel === "aviso")).toBe(true);
  });
});

describe("quantidade de dias", () => {
  it("30 dias direto é o caso normal e passa limpo", () => {
    expect(validarAgendamento({ inicio: SEG, dias: 30 })).toEqual([]);
  });

  it("mais de 30 é recusado", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 45 }))).toBe(true);
  });

  it("999 dias — o número que o formulário aceitava — é recusado", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 999 }))).toBe(true);
  });

  it("zero e negativo são recusados", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 0 }))).toBe(true);
    expect(temErro(validarAgendamento({ inicio: SEG, dias: -5 }))).toBe(true);
  });

  it("meio dia de férias não existe", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 7.5 }))).toBe(true);
  });

  it("sem data de início, recusa e nem tenta o resto", () => {
    const a = validarAgendamento({ inicio: null, dias: 30 });
    expect(erros(a)).toHaveLength(1);
  });
});

describe("art. 134 §1 — fracionamento", () => {
  it("15 dias é período partido válido", () => {
    expect(validarAgendamento({ inicio: SEG, dias: 15 })).toEqual([]);
  });

  it("menos de 5 dias não pode", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: MIN_FRACAO_DIAS - 1 }))).toBe(true);
  });

  it("exatamente 5 dias pode", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: MIN_FRACAO_DIAS }))).toBe(false);
  });

  it("um quarto período é recusado", () => {
    const a = validarAgendamento({ inicio: SEG, dias: 5, fracoesExistentes: 3, diasJaLancados: 25 });
    expect(temErro(a)).toBe(true);
  });

  it("15+15 fecha os 30 e o segundo passa", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 15, diasJaLancados: 15, fracoesExistentes: 1 }))).toBe(false);
  });
});

describe("saldo do período aquisitivo", () => {
  it("não deixa passar dos 30 somando com o que já foi lançado", () => {
    const a = validarAgendamento({ inicio: SEG, dias: 20, diasJaLancados: 15 });
    expect(temErro(a)).toBe(true);
    expect(erros(a)[0].texto).toContain("Sobram 15");
  });

  it("o que sobra exato passa", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 15, diasJaLancados: 15 }))).toBe(false);
  });

  it("abono vendido desconta do que pode ser gozado", () => {
    // 10 vendidos + 20 gozados = 30. Pedir 25 estoura.
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 25, abono: 10 }))).toBe(true);
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 20, abono: 10 }))).toBe(false);
  });

  it("abono acima de um terço é recusado", () => {
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 20, abono: MAX_ABONO_DIAS + 1 }))).toBe(true);
  });
});

describe("sobreposição com outro período da mesma pessoa", () => {
  const outros = [periodo("2026-09-01", "2026-10-01")];

  it("período que cai dentro de outro é recusado", () => {
    expect(temErro(validarAgendamento({ inicio: dia("2026-09-10"), dias: 5, outros }))).toBe(true);
  });

  it("período que começa antes e invade também", () => {
    expect(temErro(validarAgendamento({ inicio: dia("2026-08-25"), dias: 10, outros }))).toBe(true);
  });

  it("começar no dia do retorno do outro está livre", () => {
    expect(temErro(validarAgendamento({ inicio: dia("2026-10-01"), dias: 15, outros }))).toBe(false);
  });

  it("período cancelado não atrapalha", () => {
    const cancelado = [periodo("2026-09-01", "2026-10-01", { status: "Cancelada" })];
    expect(temErro(validarAgendamento({ inicio: dia("2026-09-10"), dias: 5, outros: cancelado }))).toBe(false);
  });

  it("editando, o registro não briga consigo mesmo", () => {
    const a = validarAgendamento({ inicio: dia("2026-09-01"), dias: 30, outros, ignorarId: outros[0].id });
    expect(temErro(a)).toBe(false);
  });

  it("registro sem datas não gera falso positivo", () => {
    const semDatas = [periodo("2026-09-01", "2026-10-01", { dataInicio: null, dataRetorno: null })];
    expect(temErro(validarAgendamento({ inicio: SEG, dias: 30, outros: semDatas }))).toBe(false);
  });
});

describe("validarPeriodo — o par de datas da edição", () => {
  it("RETORNO ANTES DO INÍCIO é recusado (era gravável)", () => {
    const a = validarPeriodo(dia("2026-09-01"), dia("2026-08-01"));
    expect(temErro(a)).toBe(true);
    expect(erros(a)[0].texto).toContain("depois do início");
  });

  it("mesmo dia não é férias", () => {
    expect(temErro(validarPeriodo(dia("2026-09-01"), dia("2026-09-01")))).toBe(true);
  });

  it("período normal de 30 dias passa", () => {
    expect(validarPeriodo(dia("2026-09-01"), dia("2026-10-01"))).toEqual([]);
  });

  it("mais de 30 dias entre as datas é recusado", () => {
    expect(temErro(validarPeriodo(dia("2026-09-01"), dia("2026-10-15")))).toBe(true);
  });

  it("AS DUAS VAZIAS é período em aberto — não trava a gravação", () => {
    // 13 dos 31 registros da empresa estão assim: saldo de 30 dias, nenhum gozo
    // agendado. Exigir as datas deixava esses registros impossíveis de salvar.
    expect(validarPeriodo(null, null)).toEqual([]);
    expect(temErro(validarPeriodo(null, null))).toBe(false);
  });

  it("cobra as duas datas quando falta alguma", () => {
    expect(erros(validarPeriodo(null, dia("2026-10-01")))).toHaveLength(1);
    expect(erros(validarPeriodo(dia("2026-09-01"), null))).toHaveLength(1);
  });
});
