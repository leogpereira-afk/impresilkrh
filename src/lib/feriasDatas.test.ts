import { describe, it, expect } from "vitest";
import { parseData, diaLocalISO } from "@/lib/format";

/* O banco guarda a MESMA informação em três convenções, todas no mesmo
   registro e às vezes no mesmo campo:
     dataInicio/dataRetorno  →  "2026-02-13T12:00:00.000Z"  (17 registros)
                             →  "2026-12-25T15:00:00.000Z"  (1 registro)
                             →  ausente                      (13 registros)
     periodoAquisitivo*      →  "2024-01-01"                 (31 registros)

   A tela converte ISO → campo de data com isoParaInput e volta com
   inputParaIso. Este teste percorre a ida e a volta com cada uma dessas formas:
   se alguma volta com o dia trocado, a edição "buga a data" sem ninguém tocar
   nela. */
const isoParaInput = (iso?: string | null) => { const d = parseData(iso); return d ? diaLocalISO(d) : ""; };
const inputParaIso = (v: string) => (v ? new Date(`${v}T12:00:00`).toISOString() : null);

describe("ida e volta das datas de férias", () => {
  const casos: [string, string | null, string][] = [
    ["meio-dia UTC (17 registros da produção)", "2026-02-13T12:00:00.000Z", "2026-02-13"],
    ["meio-dia local convertido (1 registro)",  "2025-12-25T15:00:00.000Z", "2025-12-25"],
    ["data pura (período aquisitivo)",          "2024-01-01",               "2024-01-01"],
    ["fim de ano em UTC",                       "2025-12-31T12:00:00.000Z", "2025-12-31"],
    ["primeiro de janeiro em UTC",              "2026-01-01T12:00:00.000Z", "2026-01-01"],
    ["29 de fevereiro (bissexto)",              "2024-02-29T12:00:00.000Z", "2024-02-29"],
    ["sem data (período em aberto)",            null,                       ""],
  ];

  for (const [nome, guardado, esperadoNoCampo] of casos) {
    it(`${nome}: aparece no campo como ${esperadoNoCampo || "(vazio)"}`, () => {
      expect(isoParaInput(guardado)).toBe(esperadoNoCampo);
    });
  }

  it("salvar sem tocar na data NÃO muda o dia", () => {
    for (const [, guardado] of casos) {
      if (!guardado) continue;
      const noCampo = isoParaInput(guardado);
      const regravado = inputParaIso(noCampo);
      // o dia tem que sobreviver à volta, mesmo que a hora mude de convenção
      expect(isoParaInput(regravado), guardado).toBe(noCampo);
    }
  });

  it("campo vazio grava null, e não uma data inválida", () => {
    expect(inputParaIso("")).toBeNull();
  });

  it("meia-noite UTC seria o caso perigoso — documenta o porquê da âncora", () => {
    // Se algum dia entrar "2026-02-13T00:00:00.000Z" no banco, em Brasília
    // (UTC-3) isso é 21:00 do dia 12 e o campo mostraria o dia ERRADO. Nenhum
    // registro está assim hoje; o teste existe para o dia em que alguém gravar
    // com meia-noite achando que tanto faz.
    expect(isoParaInput("2026-02-13T00:00:00.000Z")).toBe("2026-02-12");
  });
});

// ---------------------------------------------------------------------------
// A resposta de "está de férias hoje?" não pode depender da HORA em que a
// pessoa abriu a tela. Antes dependia: o banco guarda 12:00Z (09:00 em
// Brasília) e a tela regravava 15:00Z (12:00 aqui) — o mesmo período respondia
// coisas diferentes às 10h30 conforme já tivesse passado pelo modal ou não.
// ---------------------------------------------------------------------------
import { feriasEmCurso } from "@/lib/ferias";
import type { Ferias } from "@/data/types";

const reg = (inicio: string, retorno: string): Ferias => ({
  id: "f1", colaboradorId: "c1", dataInicio: inicio, dataRetorno: retorno,
  diasGozados: 30, saldoDias: 0, status: "Em andamento",
});

describe("feriasEmCurso não muda de resposta ao longo do dia", () => {
  const AS_HORAS = [0, 8, 10.5, 11.99, 12, 14, 23.99];
  const horaDo = (h: number) => new Date(2026, 7, 4, Math.floor(h), Math.round((h % 1) * 60));

  it("mesmo período, guardado nas DUAS convenções da base, responde igual", () => {
    const meioDiaUTC = reg("2026-08-04T12:00:00.000Z", "2026-09-03T12:00:00.000Z");
    const meioDiaLocal = reg("2026-08-04T15:00:00.000Z", "2026-09-03T15:00:00.000Z");
    const dataPura = reg("2026-08-04", "2026-09-03");
    for (const h of AS_HORAS) {
      const agora = horaDo(h);
      expect(feriasEmCurso(meioDiaUTC, agora), `${h}h UTC`).toBe(true);
      expect(feriasEmCurso(meioDiaLocal, agora), `${h}h local`).toBe(true);
      expect(feriasEmCurso(dataPura, agora), `${h}h pura`).toBe(true);
    }
  });

  it("no dia do retorno a pessoa já voltou, a qualquer hora", () => {
    const f = reg("2026-08-04T12:00:00.000Z", "2026-09-03T12:00:00.000Z");
    for (const h of AS_HORAS) {
      expect(feriasEmCurso(f, new Date(2026, 8, 3, Math.floor(h))), `${h}h`).toBe(false);
    }
  });

  it("na véspera do início ainda não está de férias, a qualquer hora", () => {
    const f = reg("2026-08-04T12:00:00.000Z", "2026-09-03T12:00:00.000Z");
    for (const h of AS_HORAS) {
      expect(feriasEmCurso(f, new Date(2026, 7, 3, Math.floor(h))), `${h}h`).toBe(false);
    }
  });
});
