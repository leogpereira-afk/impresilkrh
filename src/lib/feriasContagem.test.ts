import { describe, it, expect } from "vitest";
import { contagem, prazoDeConcessao, statusIncoerente, limiteDeConcessao } from "@/lib/feriasContagem";
import { parseData } from "@/lib/format";

/* Datas ancoradas no meio-dia LOCAL. Meia-noite escorrega de dia em fuso à
   frente de UTC, e foi assim que a CI (que roda em UTC) ficou vermelha enquanto
   tudo passava aqui. A suíte também fixa TZ no vite.config. */
const dia = (s: string) => new Date(`${s}T12:00:00`);

const HOJE = dia("2026-08-04"); // terça

const gozo = (inicio: string | null, retorno: string | null) => ({
  dataInicio: inicio,
  dataRetorno: retorno,
});

describe("contagem — quanto falta para as férias", () => {
  it("gozo futuro conta os dias que faltam", () => {
    const c = contagem(gozo("2026-08-20", "2026-09-19"), HOJE);
    expect(c.fase).toBe("futuro");
    expect(c.dias).toBe(16);
    expect(c.texto).toBe("Faltam 16 dias");
  });

  it("um dia antes fala em português, não em número", () => {
    expect(contagem(gozo("2026-08-05", "2026-09-04"), HOJE).texto).toBe("Começa amanhã");
  });

  it("o próprio dia do início já é férias, não véspera", () => {
    const c = contagem(gozo("2026-08-04", "2026-09-03"), HOJE);
    expect(c.fase).toBe("em-curso");
    expect(c.dias).toBe(30);
  });

  it("no meio do gozo conta o que falta para voltar", () => {
    const c = contagem(gozo("2026-07-20", "2026-08-19"), HOJE);
    expect(c.fase).toBe("em-curso");
    expect(c.texto).toBe("De férias · volta em 15 dias");
  });

  it("volta amanhã", () => {
    expect(contagem(gozo("2026-07-06", "2026-08-05"), HOJE).texto).toBe("De férias · volta amanhã");
  });

  it("O DIA DO RETORNO já é dia de trabalho — não conta como férias", () => {
    // Regra que o app usa em todo lugar: dataRetorno é o dia em que a pessoa
    // volta ao trabalho. Tratar como <= punha de férias quem já estava na mesa.
    const c = contagem(gozo("2026-07-05", "2026-08-04"), HOJE);
    expect(c.fase).toBe("voltou");
    expect(c.texto).toBe("Voltou hoje");
  });

  it("depois do retorno conta há quantos dias voltou", () => {
    const c = contagem(gozo("2026-06-19", "2026-07-19"), HOJE);
    expect(c.fase).toBe("voltou");
    expect(c.dias).toBe(16);
    expect(c.texto).toBe("Voltou há 16 dias");
  });

  it("sem data de gozo não inventa contagem", () => {
    const c = contagem(gozo(null, null), HOJE);
    expect(c.fase).toBe("sem-gozo");
    expect(c.dias).toBe(0);
  });

  it("com início e sem retorno, diz que está de férias sem chutar o fim", () => {
    const c = contagem(gozo("2026-07-20", null), HOJE);
    expect(c.fase).toBe("em-curso");
    expect(c.texto).toContain("retorno não informado");
  });

  it("RETORNO ANTES DO INÍCIO vira aviso, não número negativo", () => {
    // Já apareceu na tela como "-31 dia(s)".
    const c = contagem(gozo("2026-09-01", "2026-08-01"), HOJE);
    expect(c.fase).toBe("datas-trocadas");
    expect(c.dias).toBe(0);
  });

  it("a resposta não muda com a hora do dia", () => {
    // O bug clássico: subtrair instantes faz "faltam 16" virar "faltam 15"
    // depois do meio-dia. Manhã e noite têm de dar o mesmo número.
    const manha = contagem(gozo("2026-08-20", "2026-09-19"), new Date("2026-08-04T06:00:00"));
    const noite = contagem(gozo("2026-08-20", "2026-09-19"), new Date("2026-08-04T23:30:00"));
    expect(manha.dias).toBe(noite.dias);
  });

  it("atravessa a virada do ano sem perder um dia", () => {
    const c = contagem(gozo("2027-01-05", "2027-02-04"), dia("2026-12-26"));
    expect(c.dias).toBe(10);
  });
});

describe("prazoDeConcessao — o relógio do pagamento em dobro", () => {
  const aberto = (aqFim: string) => ({ status: "Em aberto", periodoAquisitivoFim: aqFim });

  it("o limite é 12 meses depois do FIM do aquisitivo (art. 134)", () => {
    expect(parseData(limiteDeConcessao("2026-05-31"))!.getFullYear()).toBe(2027);
    expect(parseData(limiteDeConcessao("2026-05-31"))!.getMonth()).toBe(4); // maio
    expect(parseData(limiteDeConcessao("2026-05-31"))!.getDate()).toBe(31);
  });

  it("o caso real da base: aquisitivo até 31/05/2026 ainda tem folga", () => {
    // 13 pessoas estão exatamente assim. A coluna CLT mostrava só um travessão,
    // como se não houvesse prazo nenhum correndo.
    const p = prazoDeConcessao(aberto("2026-05-31"), HOJE);
    expect(p.situacao).toBe("no-prazo");
    expect(p.dias).toBe(300);
    expect(p.texto).toBe("Vence em 300 dias");
  });

  it("dentro da janela de 60 dias vira alerta", () => {
    const p = prazoDeConcessao(aberto("2025-09-15"), HOJE);
    expect(p.situacao).toBe("a-vencer");
    expect(p.dias).toBeLessThanOrEqual(60);
  });

  it("passou do limite: diz há quantos dias, sem sinal negativo no texto", () => {
    const p = prazoDeConcessao(aberto("2025-01-31"), HOJE);
    expect(p.situacao).toBe("vencido");
    expect(p.dias).toBeLessThan(0);
    expect(p.texto).toMatch(/^Vencido há \d+ dias?$/);
  });

  it("período já gozado não tem prazo correndo", () => {
    expect(prazoDeConcessao({ status: "Concluída", periodoAquisitivoFim: "2020-01-31" }, HOJE).situacao)
      .toBe("sem-prazo");
  });

  it("sem período aquisitivo lançado, não há o que cobrar", () => {
    expect(prazoDeConcessao({ status: "Em aberto", periodoAquisitivoFim: null }, HOJE).situacao)
      .toBe("sem-prazo");
  });

  it("prazo anterior ao início do histórico é desconhecido, não vencido", () => {
    // Das 12 pessoas que o app acusava de férias vencidas, TODAS as 12 tinham o
    // limite anterior ao primeiro registro do banco: o alerta era 100% ruído.
    const p = prazoDeConcessao(aberto("2015-01-31"), HOJE, dia("2024-12-23"));
    expect(p.situacao).toBe("sem-prazo");
  });
});

describe("statusIncoerente — quando o status contradiz as datas", () => {
  it("o caso real: Em andamento com retorno em julho", () => {
    // Ricardo, Sally e Thiago estavam assim em 04/08/2026 — a tela dizia que
    // três pessoas estavam de férias enquanto trabalhavam.
    const aviso = statusIncoerente(
      { status: "Em andamento", dataInicio: "2026-06-21", dataRetorno: "2026-07-21" },
      HOJE,
    );
    expect(aviso).toContain("Em andamento");
    expect(aviso).toContain("21/07/2026");
  });

  it("Concluída durante o gozo também é contradição", () => {
    expect(
      statusIncoerente({ status: "Concluída", dataInicio: "2026-07-20", dataRetorno: "2026-08-19" }, HOJE),
    ).toContain("acontecendo agora");
  });

  it("Agendada depois de o gozo ter começado", () => {
    expect(
      statusIncoerente({ status: "Agendada", dataInicio: "2026-07-20", dataRetorno: "2026-08-19" }, HOJE),
    ).toContain("já começou");
  });

  it("Concluída para um gozo que nem começou", () => {
    expect(
      statusIncoerente({ status: "Concluída", dataInicio: "2026-09-01", dataRetorno: "2026-10-01" }, HOJE),
    ).toContain("só começa");
  });

  it("o que está coerente não vira aviso", () => {
    expect(statusIncoerente({ status: "Em andamento", dataInicio: "2026-07-20", dataRetorno: "2026-08-19" }, HOJE)).toBeNull();
    expect(statusIncoerente({ status: "Concluída", dataInicio: "2026-06-19", dataRetorno: "2026-07-19" }, HOJE)).toBeNull();
    expect(statusIncoerente({ status: "Agendada", dataInicio: "2026-09-01", dataRetorno: "2026-10-01" }, HOJE)).toBeNull();
  });

  it("registro sem gozo e registro invertido não geram falso alarme", () => {
    expect(statusIncoerente({ status: "Em aberto", dataInicio: null, dataRetorno: null }, HOJE)).toBeNull();
    expect(statusIncoerente({ status: "Agendada", dataInicio: "2026-09-01", dataRetorno: "2026-08-01" }, HOJE)).toBeNull();
  });
});
