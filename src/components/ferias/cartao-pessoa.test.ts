/* Os selos do cartão de férias.
 *
 * Começa pelo caso ruim: saldo DESCONHECIDO virar "0 dias livres". Zero parece
 * resposta ("essa pessoa não tem férias") e é falta de informação ("ninguém
 * lançou o histórico"). Quem lê o cartão decide diferente em cada caso.
 */
import { describe, it, expect } from "vitest";
import { selosDaPessoa, situacaoDaPessoa, textoAoLadoDoSelo, type DadosDoCartao } from "./cartao-pessoa";

const pessoa = (o: Partial<DadosDoCartao["resumo"]> & { prazos?: number; fase?: string } = {}): DadosDoCartao => ({
  resumo: { disponivel: 30, agendados: 0, ...o },
  prazos: Array.from({ length: o.prazos ?? 0 }),
  proxima: { fase: o.fase ?? "sem-marcacao", texto: "qualquer" },
});

describe("o caso ruim: saldo desconhecido não vira zero", () => {
  it("disponivel null mostra 'Saldo a conferir', em âmbar", () => {
    const [saldo] = selosDaPessoa(pessoa({ disponivel: null }));
    expect(saldo).toEqual({ texto: "Saldo a conferir", tom: "ambar" });
  });

  it("zero de verdade continua zero", () => {
    expect(selosDaPessoa(pessoa({ disponivel: 0 }))[0].texto).toBe("0 dias livres");
  });

  it("o aviso de prazo não some quando há outros selos", () => {
    const s = selosDaPessoa(pessoa({ agendados: 10, prazos: 2 }));
    // "para conferir" é o pedido de ação: sem ele parece só um prazo correndo.
    expect(s.map((x) => x.texto)).toContain("2 aquisitivo(s) com prazo para conferir");
    expect(s.find((x) => x.texto.includes("prazo"))!.tom).toBe("ambar");
  });
});

describe("os outros selos", () => {
  it("direito a confirmar fica em âmbar e diz isso", () => {
    const [saldo] = selosDaPessoa(pessoa({ disponivel: 30, referencia: true }));
    expect(saldo.texto).toContain("direito a confirmar");
    expect(saldo.tom).toBe("ambar");
  });

  it("reservas só aparecem quando existem", () => {
    expect(selosDaPessoa(pessoa({ agendados: 0 })).some((x) => x.texto.includes("reservad"))).toBe(false);
    expect(selosDaPessoa(pessoa({ agendados: 15 })).map((x) => x.texto)).toContain("15 dias reservados");
  });

  it("singular: 1 dia livre, 1 dia reservado", () => {
    const s = selosDaPessoa(pessoa({ disponivel: 1, agendados: 1 })).map((x) => x.texto);
    expect(s).toEqual(["1 dia livre", "1 dia reservado"]);
  });
});

describe("o selo não repete o texto", () => {
  const de = (fase: string, texto: string): DadosDoCartao => ({ resumo: { disponivel: 0, agendados: 0 }, prazos: [], proxima: { fase, texto } });

  it("de férias: o selo diz 'De férias' e o texto fica só com o retorno", () => {
    expect(textoAoLadoDoSelo(de("em-curso", "De férias · volta em 11 dias"))).toBe("volta em 11 dias");
    expect(textoAoLadoDoSelo(de("em-curso", "De férias · retorno não informado"))).toBe("retorno não informado");
  });

  it("agendada e sem marcação: o texto fica inteiro", () => {
    expect(textoAoLadoDoSelo(de("futuro", "Faltam 13 dias"))).toBe("Faltam 13 dias");
    expect(textoAoLadoDoSelo(de("sem-marcacao", "Sem férias marcadas"))).toBe("Sem férias marcadas");
  });
});

describe("a situação", () => {
  it("de férias agora é verde; agendada é azul; sem marcação não tem selo", () => {
    expect(situacaoDaPessoa(pessoa({ fase: "em-curso" }))).toEqual({ texto: "De férias", tom: "verde" });
    expect(situacaoDaPessoa(pessoa({ fase: "futuro" }))).toEqual({ texto: "Agendada", tom: "azul" });
    expect(situacaoDaPessoa(pessoa({ fase: "sem-marcacao" }))).toBeNull();
  });
});
