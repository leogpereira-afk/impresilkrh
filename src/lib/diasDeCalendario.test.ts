import { describe, it, expect } from "vitest";
import { diasDeCalendario } from "@/lib/format";

/* A conta de "quantos dias faltam" comparava a MEIA-NOITE da data alvo com a
   HORA ATUAL. O mesmo documento dizia "vence hoje" de manhã e "vencido há 1
   dia" depois das 12h — e o sino discordava da ficha sobre o mesmo papel, no
   mesmo instante. Estava reimplementada errada em cinco arquivos, enquanto
   format.ts já tinha a versão certa. */
describe("diasDeCalendario não muda de resposta durante o dia", () => {
  const alvo = "2026-08-04";
  it("responde 0 a qualquer hora do próprio dia", () => {
    for (const h of [0, 8, 12, 15, 23]) {
      expect(diasDeCalendario(alvo, new Date(2026, 7, 4, h, 30)), `${h}h`).toBe(0);
    }
  });
  it("ontem é -1 e amanhã é +1, a qualquer hora", () => {
    for (const h of [1, 13, 22]) {
      expect(diasDeCalendario("2026-08-03", new Date(2026, 7, 4, h))).toBe(-1);
      expect(diasDeCalendario("2026-08-05", new Date(2026, 7, 4, h))).toBe(1);
    }
  });
  it("sem data devolve NaN, não zero", () => {
    expect(Number.isNaN(diasDeCalendario(null))).toBe(true);
    expect(Number.isNaN(diasDeCalendario(""))).toBe(true);
  });
});

/* Guarda: se alguém reintroduzir a conta crua em vez de usar o helper, o teste
   reprova. Foi assim que o defeito se espalhou por cinco telas. */
describe("ninguém reimplementa a conta de dias na mão", () => {
  it("nenhum arquivo divide diferença de datas por 86400000 contra HOJE", () => {
    // import.meta.glob (Vite) lê o CONTEÚDO dos arquivos sem precisar do módulo
    // de arquivos do Node, que não existe no ambiente do teste.
    const arquivos = import.meta.glob("../{pages,lib,components}/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;

    const culpados = Object.entries(arquivos)
      .filter(([nome]) => !nome.includes(".test."))
      // getTime() - HOJE.getTime() dividido por um dia: a forma errada.
      .filter(([, src]) => /HOJE\.getTime\(\)\s*\)\s*\/\s*86_?400_?000/.test(src.replace(/\s+/g, " ")))
      .map(([nome]) => nome);

    expect(culpados, `use diasDeCalendario() em: ${culpados.join(", ")}`).toEqual([]);
  });
});
