import { describe, it, expect } from "vitest";
import {
  cadenciaDe, ultimoFeedback, compararFila, CADENCIA_FEEDBACK_DIAS, type FeedbackLike,
} from "@/lib/feedbackCadencia";

const HOJE = new Date(2026, 7, 10); // 10/08/2026
const diasAtras = (n: number) => new Date(HOJE.getTime() - n * 86_400_000).toISOString();
const fb = (id: string, dias: number, tipo = "Contínuo"): FeedbackLike =>
  ({ id, colaboradorId: "p1", criadoEm: diasAtras(dias), tipo });

describe("ultimoFeedback", () => {
  it("pega o mais recente, não o último da lista", () => {
    expect(ultimoFeedback([fb("velho", 200), fb("novo", 10), fb("meio", 90)])?.id).toBe("novo");
  });

  it("lista vazia devolve null", () => {
    expect(ultimoFeedback([])).toBeNull();
  });

  it("registro sem data não atrapalha", () => {
    const sujo = { id: "x", colaboradorId: "p1", criadoEm: "" };
    expect(ultimoFeedback([sujo, fb("bom", 5)])?.id).toBe("bom");
  });
});

describe("cadenciaDe", () => {
  it("O CASO QUE IMPORTA: quem entrou esta semana e nunca teve feedback NÃO está atrasado", () => {
    // Tratar isso como dívida encheria a fila de gente que acabou de chegar e
    // esvaziaria o sentido do aviso.
    const r = cadenciaDe([], diasAtras(7).slice(0, 10), HOJE);
    expect(r.situacao).toBe("nunca");
    expect(r.diasParaProximo).toBeGreaterThan(0);
  });

  it("quem está na casa há mais que a cadência e nunca teve feedback fica ATRASADO", () => {
    const r = cadenciaDe([], diasAtras(200).slice(0, 10), HOJE);
    expect(r.situacao).toBe("atrasado");
    expect(r.diasParaProximo).toBeLessThan(0);
  });

  it("feedback recente = em dia", () => {
    const r = cadenciaDe([fb("a", 10)], diasAtras(900).slice(0, 10), HOJE);
    expect(r.situacao).toBe("em-dia");
    expect(r.diasDesde).toBe(10);
    expect(r.ultimo?.id).toBe("a");
  });

  it("passou da cadência desde o último = atrasado", () => {
    const r = cadenciaDe([fb("a", CADENCIA_FEEDBACK_DIAS + 5)], null, HOJE);
    expect(r.situacao).toBe("atrasado");
    expect(r.diasParaProximo).toBe(-5);
  });

  it("chegando a hora avisa antes de estourar", () => {
    const r = cadenciaDe([fb("a", CADENCIA_FEEDBACK_DIAS - 10)], null, HOJE);
    expect(r.situacao).toBe("a-vencer");
  });

  it("no dia exato da cadência ainda não está atrasado", () => {
    const r = cadenciaDe([fb("a", CADENCIA_FEEDBACK_DIAS)], null, HOJE);
    expect(r.diasParaProximo).toBe(0);
    expect(r.situacao).toBe("a-vencer");
  });

  it("sem feedback E sem admissão: diz que não sabe, não inventa prazo", () => {
    const r = cadenciaDe([], null, HOJE);
    expect(r.situacao).toBe("nunca");
    expect(r.diasDesde).toBeNull();
    expect(r.diasParaProximo).toBeNull();
  });

  it("o feedback manda sobre a admissão", () => {
    // Admitida há 900 dias, mas com feedback há 5: está em dia.
    const r = cadenciaDe([fb("a", 5)], diasAtras(900).slice(0, 10), HOJE);
    expect(r.situacao).toBe("em-dia");
    expect(r.diasDesde).toBe(5);
  });

  it("data ilegível não derruba a conta", () => {
    const r = cadenciaDe([], "isso não é data", HOJE);
    expect(r.situacao).toBe("nunca");
    expect(r.diasDesde).toBeNull();
  });
});

describe("compararFila", () => {
  it("atrasado vem antes de nunca, que vem antes de a-vencer e em-dia", () => {
    const ordem = [
      cadenciaDe([fb("x", 5)], null, HOJE),                      // em-dia
      cadenciaDe([], diasAtras(300).slice(0, 10), HOJE),         // atrasado
      cadenciaDe([], diasAtras(3).slice(0, 10), HOJE),           // nunca
      cadenciaDe([fb("y", CADENCIA_FEEDBACK_DIAS - 5)], null, HOJE), // a-vencer
    ].sort(compararFila).map((c) => c.situacao);
    expect(ordem).toEqual(["atrasado", "nunca", "a-vencer", "em-dia"]);
  });

  it("dentro do mesmo grupo, quem espera há mais tempo vem primeiro", () => {
    const a = cadenciaDe([fb("a", 200)], null, HOJE);
    const b = cadenciaDe([fb("b", 400)], null, HOJE);
    expect([a, b].sort(compararFila)[0].diasDesde).toBe(400);
  });
});
