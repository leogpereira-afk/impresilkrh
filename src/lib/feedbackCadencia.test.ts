import { describe, it, expect } from "vitest";
import {
  cadenciaDe, ultimoFeedback, compararFila, CADENCIA_FEEDBACK_DIAS,
  bloqueio, combinadoEmAberto, combinadoVencido, cadenciaDaPessoa, montarConteudo,
  type FeedbackLike,
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

describe("bloqueio — o que não entra neste registro", () => {
  it("O CASO QUE IMPORTA: assédio e agressão vão para o canal próprio, não para cá", () => {
    // Lei 14.457/2022, art. 23: empresa com CIPA tem canal com sigilo. Denúncia
    // colada no histórico de desempenho é o pior desenho possível.
    expect(bloqueio("ele agrediu o colega na serralheria")).toBe("grave");
    expect(bloqueio("caso de assédio com a equipe")).toBe("grave");
    expect(bloqueio("chegou bêbado")).toBe("grave");
    expect(bloqueio("recusou o EPI de novo")).toBe("grave");
  });

  it("dado SENSÍVEL da LGPD (art. 11) também não entra", () => {
    expect(bloqueio("trouxe atestado médico")).toBe("sensivel");
    expect(bloqueio("está em tratamento de depressão")).toBe("sensivel");
    expect(bloqueio("entrou no sindicato")).toBe("sensivel");
    expect(bloqueio("por causa da gravidez")).toBe("sensivel");
  });

  it("respeita FRONTEIRA de palavra — bloqueio falso ensina a contornar a tela", () => {
    // "acidentalmente" não é "acidente"; "drogaria" não é "droga".
    expect(bloqueio("acidentalmente cortou a chapa menor")).toBeNull();
    expect(bloqueio("entregou na drogaria do centro")).toBeNull();
    expect(bloqueio("mediconhecimento")).toBeNull();
  });

  it("conversa normal de trabalho passa", () => {
    expect(bloqueio("soldou fora do esquadro e voltou para retrabalho")).toBeNull();
    expect(bloqueio("conferiu o projeto antes de cortar, ficou perfeito")).toBeNull();
  });

  it("texto vazio ou ausente não quebra", () => {
    expect(bloqueio("")).toBeNull();
    expect(bloqueio(undefined as unknown as string)).toBeNull();
  });
});

describe("combinado voltando", () => {
  const reg = (id: string, dias: number, extra: Record<string, unknown> = {}) => ({
    id, colaboradoresId: "p1", criadoEm: diasAtras(dias),
    ocorridoEm: diasAtras(dias).slice(0, 10), ...extra,
  }) as never;

  it("pega o combinado aberto mais recente", () => {
    const lista = [
      reg("velho", 200, { combinado: "A" }),
      reg("novo", 10, { combinado: "B" }),
    ];
    expect((combinadoEmAberto(lista) as unknown as { id: string })?.id).toBe("novo");
  });

  it("combinado com desfecho não está mais em aberto", () => {
    const lista = [reg("x", 10, { combinado: "A", desfecho: "resolveu" })];
    expect(combinadoEmAberto(lista)).toBeNull();
  });

  it("registro sem combinado não conta", () => {
    expect(combinadoEmAberto([reg("x", 5)])).toBeNull();
  });

  it("prazo passado = vencido", () => {
    const f = { combinado: "A", combinadoPrazo: diasAtras(5).slice(0, 10), criadoEm: diasAtras(40) };
    expect(combinadoVencido(f, HOJE)).toBe(true);
  });

  it('O CASO QUE IMPORTA: "na próxima peça" NUNCA vence por calendário', () => {
    // Foi o prazo que o encarregado pediu: vence no encontro, não no relógio.
    const f = { combinado: "A", combinadoPrazo: null, combinadoGatilho: "proxima-peca", criadoEm: diasAtras(400) };
    expect(combinadoVencido(f, HOJE)).toBe(false);
  });

  it("sem prazo e sem gatilho não vence", () => {
    expect(combinadoVencido({ combinado: "A", criadoEm: diasAtras(400) }, HOJE)).toBe(false);
  });
});

describe("cadenciaDaPessoa", () => {
  it("em experiência tem cadência mais curta que o padrão", () => {
    // Com 90 dias uniformes, o 1º feedback caía no MESMO dia em que o contrato
    // vira indeterminado — e a decisão de efetivar chegava sem conversa escrita.
    expect(cadenciaDaPessoa({ emExperiencia: true })).toBe(30);
    expect(cadenciaDaPessoa({ emExperiencia: true })).toBeLessThan(CADENCIA_FEEDBACK_DIAS);
  });

  it("com plano aberto, 45; sem nada, o padrão", () => {
    expect(cadenciaDaPessoa({ comPlanoAberto: true })).toBe(45);
    expect(cadenciaDaPessoa({})).toBe(CADENCIA_FEEDBACK_DIAS);
  });

  it("experiência manda sobre plano — é o prazo mais curto e o mais caro", () => {
    expect(cadenciaDaPessoa({ emExperiencia: true, comPlanoAberto: true })).toBe(30);
  });
});

describe("montarConteudo", () => {
  it("junta fato, efeito e combinado num texto legível", () => {
    const t = montarConteudo({
      oQueAconteceu: "Soldou fora do esquadro.", efeito: "Retrabalho",
      combinado: "Conferir o gabarito antes de soldar", combinadoPrazo: "2026-09-15",
    });
    expect(t).toContain("Soldou fora do esquadro.");
    expect(t).toContain("No que deu: Retrabalho.");
    expect(t).toContain("Conferir o gabarito");
    expect(t).toContain("15/09");
  });

  it('NÃO escreve "ele respondeu" — anotação unilateral como fala do trabalhador derruba o registro', () => {
    const t = montarConteudo({ oQueAconteceu: "x", efeito: "Retrabalho" });
    expect(t.toLowerCase()).not.toContain("respondeu");
  });

  it('"na próxima peça" aparece como gatilho, não como data', () => {
    const t = montarConteudo({
      oQueAconteceu: "x", combinado: "conferir", combinadoGatilho: "proxima-peca", combinadoPrazo: null,
    });
    expect(t).toContain("na próxima peça");
  });

  it("elogio sem combinado não inventa combinado", () => {
    const t = montarConteudo({ oQueAconteceu: "Entrou de primeira.", efeito: "Entrou de primeira" });
    expect(t).not.toContain("Combinado");
  });
});
