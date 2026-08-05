import { describe, it, expect } from "vitest";
import { separarVigentes, foiSubstituida } from "@/lib/nrVigente";

const c = (id: string, colab: string, nr: string, dataTreinamento: string) =>
  ({ id, colaboradorId: colab, nr, dataTreinamento });

describe("separarVigentes — renovar para de cobrar o antigo", () => {
  it("O CASO QUE IMPORTA: renovou a NR-35, a antiga sai da cobrança", () => {
    // Sem isto, o certificado velho segue contando como "vencida" para sempre e
    // o painel diz que há risco onde a pessoa está em dia.
    const velha = c("1", "joao", "NR-35", "2023-01-10");
    const nova = c("2", "joao", "NR-35", "2026-01-10");
    const r = separarVigentes([velha, nova]);
    expect(r.vigentes).toEqual([nova]);
    expect(r.substituidas).toEqual([velha]);
  });

  it("NRs diferentes da mesma pessoa não se substituem", () => {
    const nr35 = c("1", "joao", "NR-35", "2026-01-10");
    const nr10 = c("2", "joao", "NR-10", "2023-01-10");
    expect(separarVigentes([nr35, nr10]).vigentes).toHaveLength(2);
    expect(separarVigentes([nr35, nr10]).substituidas).toHaveLength(0);
  });

  it("a mesma NR de pessoas diferentes não se substitui", () => {
    const joao = c("1", "joao", "NR-35", "2026-01-10");
    const maria = c("2", "maria", "NR-35", "2023-01-10");
    expect(separarVigentes([joao, maria]).substituidas).toHaveLength(0);
  });

  it("três renovações: só a última vale, as outras viram histórico", () => {
    const a = c("1", "joao", "NR-10", "2020-05-01");
    const b = c("2", "joao", "NR-10", "2022-05-01");
    const z = c("3", "joao", "NR-10", "2024-05-01");
    const r = separarVigentes([a, b, z]);
    expect(r.vigentes).toEqual([z]);
    expect(r.substituidas).toEqual([a, b]);
  });

  it("a ordem da lista não muda o resultado", () => {
    const velha = c("1", "joao", "NR-35", "2023-01-10");
    const nova = c("2", "joao", "NR-35", "2026-01-10");
    expect(separarVigentes([velha, nova]).vigentes[0].id).toBe("2");
    expect(separarVigentes([nova, velha]).vigentes[0].id).toBe("2");
  });

  it("empate na data: fica a lançada por último, sempre a mesma", () => {
    const primeira = c("1", "joao", "NR-06", "2026-03-01");
    const segunda = c("2", "joao", "NR-06", "2026-03-01");
    expect(separarVigentes([primeira, segunda]).vigentes[0].id).toBe("2");
  });

  it("sem data de treinamento não derruba a conta", () => {
    const semData = { id: "1", colaboradorId: "joao", nr: "NR-06", dataTreinamento: null };
    const comData = c("2", "joao", "NR-06", "2026-03-01");
    expect(separarVigentes([semData as never, comData]).vigentes[0].id).toBe("2");
  });

  it("lista vazia não quebra", () => {
    expect(separarVigentes([]).vigentes).toEqual([]);
  });

  it("foiSubstituida responde por linha", () => {
    const velha = c("1", "joao", "NR-35", "2023-01-10");
    const nova = c("2", "joao", "NR-35", "2026-01-10");
    expect(foiSubstituida(velha, [velha, nova])).toBe(true);
    expect(foiSubstituida(nova, [velha, nova])).toBe(false);
  });
});
