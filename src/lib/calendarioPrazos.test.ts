import { describe, it, expect } from "vitest";
import { parseData } from "@/lib/format";

/* O calendário passou a mostrar TODO vencimento do sistema: documento, NR,
   contrato de experiência e o prazo da CLT para conceder férias. Antes cada um
   vivia só na sua tela e quem abria o calendário para planejar o mês não via
   nenhum deles.

   Esta é a regra que decide se um prazo entra no mês em exibição. Ela é curta,
   mas erra fácil: mês em JS é 0-based, e uma data mal lida joga o vencimento
   para o mês errado — ou o some da tela. */
const noMes = (v: string | null | undefined, ano: number, mes: number) => {
  const dt = parseData(v);
  return dt && dt.getFullYear() === ano && dt.getMonth() === mes ? dt : null;
};

describe("o que entra no mês do calendário", () => {
  const AGO_2026 = [2026, 7] as const; // agosto é mês 7 (0-based)

  it("data pura do mês entra, com o dia certo", () => {
    const d = noMes("2026-08-20", ...AGO_2026);
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(20);
  });

  it("primeiro e último dia do mês entram", () => {
    expect(noMes("2026-08-01", ...AGO_2026)?.getDate()).toBe(1);
    expect(noMes("2026-08-31", ...AGO_2026)?.getDate()).toBe(31);
  });

  it("véspera e dia seguinte NÃO entram", () => {
    expect(noMes("2026-07-31", ...AGO_2026)).toBeNull();
    expect(noMes("2026-09-01", ...AGO_2026)).toBeNull();
  });

  it("mesmo mês de outro ANO não entra", () => {
    expect(noMes("2025-08-20", ...AGO_2026)).toBeNull();
    expect(noMes("2027-08-20", ...AGO_2026)).toBeNull();
  });

  it("ISO com hora entra pelo dia local, não pelo UTC", () => {
    // 20/08 ao meio-dia UTC é 09:00 em Brasília — mesmo dia.
    expect(noMes("2026-08-20T12:00:00.000Z", ...AGO_2026)?.getDate()).toBe(20);
  });

  it("sem data não entra, e não quebra", () => {
    expect(noMes(null, ...AGO_2026)).toBeNull();
    expect(noMes("", ...AGO_2026)).toBeNull();
    expect(noMes("data inválida", ...AGO_2026)).toBeNull();
  });

  it("fevereiro de ano bissexto entra no dia 29", () => {
    expect(noMes("2024-02-29", 2024, 1)?.getDate()).toBe(29);
  });

  it("dezembro é o mês 11, e janeiro do ano seguinte não se mistura", () => {
    expect(noMes("2026-12-31", 2026, 11)?.getDate()).toBe(31);
    expect(noMes("2027-01-01", 2026, 11)).toBeNull();
  });
});

/* A marca dos 45 dias do contrato de experiência é contada a partir do FIM
   (admissão + 90), voltando 45 — e não da admissão + 45. Dá no mesmo número,
   mas amarra as duas marcas à mesma origem: se um dia o limite dos 90 mudar,
   a marca do meio acompanha sozinha. */
describe("as duas marcas do contrato de experiência", () => {
  const marcas = (admissao: string) => {
    const adm = parseData(admissao)!;
    const fim = new Date(adm.getTime());
    fim.setDate(fim.getDate() + 90);
    const meio = new Date(fim.getTime());
    meio.setDate(meio.getDate() - 45);
    return { fim, meio };
  };

  it("admitido em 06/07/2026: 45 dias em 20/08 e 90 em 04/10", () => {
    const { fim, meio } = marcas("2026-07-06");
    expect(meio.toISOString().slice(0, 10)).toBe("2026-08-20");
    expect(fim.toISOString().slice(0, 10)).toBe("2026-10-04");
  });

  it("a marca do meio é sempre 45 dias depois da admissão", () => {
    for (const adm of ["2026-01-31", "2026-02-15", "2024-02-29", "2026-12-20"]) {
      const { meio } = marcas(adm);
      const esperado = new Date(parseData(adm)!.getTime());
      esperado.setDate(esperado.getDate() + 45);
      expect(meio.toISOString().slice(0, 10), adm).toBe(esperado.toISOString().slice(0, 10));
    }
  });

  it("atravessa a virada do ano sem perder dia", () => {
    const { fim } = marcas("2026-11-15");
    expect(fim.toISOString().slice(0, 10)).toBe("2027-02-13");
  });
});
