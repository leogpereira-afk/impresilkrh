// A régua de paginação do Mubisys mora na Edge Function (que não roda aqui),
// então o teste importa o arquivo compartilhado direto.
import { describe, expect, it } from "vitest";
import { decidirPaginacao } from "../../supabase/functions/_shared/paginacao";

describe("decidirPaginacao", () => {
  it("quando o ERP declara o total, obedece", () => {
    expect(decidirPaginacao({ itens: 500, totalDeclarado: 3, pagina: 1 })).toEqual({ totalPaginas: 3, paginacaoInferida: false, temMais: true });
    expect(decidirPaginacao({ itens: 12, totalDeclarado: 3, pagina: 3 })).toEqual({ totalPaginas: 3, paginacaoInferida: false, temMais: false });
  });

  it("sem declaração, página CURTA não encerra — só a vazia", () => {
    // Era aqui que a folha sumia do plano: 250 títulos numa página de 500 e a
    // varredura parava, com o resto do mês ficando para trás em silêncio.
    expect(decidirPaginacao({ itens: 250, totalDeclarado: 0, pagina: 1 }).temMais).toBe(true);
    expect(decidirPaginacao({ itens: 0, totalDeclarado: 0, pagina: 4 }).temMais).toBe(false);
  });

  it("sem declaração, avisa que o total é palpite", () => {
    expect(decidirPaginacao({ itens: 250, totalDeclarado: 0, pagina: 1 }).paginacaoInferida).toBe(true);
    expect(decidirPaginacao({ itens: 250, totalDeclarado: 2, pagina: 1 }).paginacaoInferida).toBe(false);
  });

  it("página vazia na primeira chamada não vira 'tem mais'", () => {
    expect(decidirPaginacao({ itens: 0, totalDeclarado: 0, pagina: 1 })).toEqual({ totalPaginas: 1, paginacaoInferida: true, temMais: false });
  });

  it("modo antigo (sem página pedida) não quebra", () => {
    expect(decidirPaginacao({ itens: 500, totalDeclarado: 0, pagina: 0 }).totalPaginas).toBe(2);
    expect(decidirPaginacao({ itens: 0, totalDeclarado: 0, pagina: 0 }).totalPaginas).toBe(1);
  });

  it("total declarado inválido cai no palpite, não em zero páginas", () => {
    expect(decidirPaginacao({ itens: 10, totalDeclarado: NaN as unknown as number, pagina: 1 })).toEqual({ totalPaginas: 2, paginacaoInferida: true, temMais: true });
  });
});
