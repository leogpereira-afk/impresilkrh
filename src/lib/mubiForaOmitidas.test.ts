/* O teto da lista "Contas fora da folha" precisa ser DECLARADO.
 *
 * A Edge Function devolve no máximo 80 contas recusadas por página e diz
 * quantas ficaram de fora (`contasForaOmitidas`). O cliente estava jogando esse
 * número fora: a tela mostrava 80 contas e parecia a lista inteira. Quem
 * procurasse ali a conta que sumiu — a faxina renumerada — e não achasse
 * concluiria que ela não existe. Lista que parece completa sem ser é pior que
 * lista curta declarada.
 *
 * Começa pelo caso ruim: perder o número no caminho.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const paginas: Record<number, unknown> = {};
vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "t" } } }) } },
  FN_MUBI_PAGAMENTOS: "https://exemplo/fn",
}));

beforeEach(() => {
  vi.stubGlobal("fetch", async (_u: string, init: { body: string }) => {
    const { page = 1 } = JSON.parse(init.body);
    return { ok: true, json: async () => paginas[page] ?? { linhas: [] } };
  });
});

const { buscarCompetenciaCompleta } = await import("./mubiPagamentos");

describe("o teto da lista de contas recusadas é declarado", () => {
  it("soma as omitidas de TODAS as páginas — não fica só com a última", () => {
    paginas[1] = { linhas: [], temMais: true, totalPaginas: 2, contasForaDaFolha: [{ plano: "2.6.1-Energia", quantos: 1, total: 900 }], contasForaOmitidas: 7 };
    paginas[2] = { linhas: [], temMais: false, totalPaginas: 2, contasForaDaFolha: [{ plano: "2.7.6-Serviços", quantos: 1, total: 2000 }], contasForaOmitidas: 5 };
    return buscarCompetenciaCompleta("2026-08").then((r) => {
      expect(r.contasForaOmitidas).toBe(12);
      expect(r.contasForaDaFolha.map((c) => c.plano)).toEqual(["2.7.6-Serviços", "2.6.1-Energia"]);
    });
  });

  it("função antiga no ar (sem o campo) vira zero, não NaN", () => {
    // `undefined + 1` daria NaN, e `NaN > 0` é falso — o aviso sumiria calado.
    paginas[1] = { linhas: [], temMais: false, totalPaginas: 1, contasForaDaFolha: [] };
    delete paginas[2];
    return buscarCompetenciaCompleta("2026-08").then((r) => {
      expect(r.contasForaOmitidas).toBe(0);
      expect(Number.isNaN(r.contasForaOmitidas)).toBe(false);
    });
  });

  it("nada omitido é zero — o aviso não aparece à toa", () => {
    paginas[1] = { linhas: [], temMais: false, totalPaginas: 1, contasForaDaFolha: [], contasForaOmitidas: 0 };
    delete paginas[2];
    return buscarCompetenciaCompleta("2026-08").then((r) => expect(r.contasForaOmitidas).toBe(0));
  });
});

describe('cobertura da resposta antiga', () => {
  it('não declara completa uma resposta que informa truncamento sem temMais', async () => {
    paginas[1] = { linhas: [], truncado: true, paginas: 8 };
    delete paginas[2];
    expect((await buscarCompetenciaCompleta('2026-01')).incompleta).toBe(true);
  });
});
