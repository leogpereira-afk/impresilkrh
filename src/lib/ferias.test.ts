// "Está de férias hoje" tem que sair das datas, não do texto do status — o
// status é preenchido à mão e envelhece. Os casos abaixo são os reais do banco
// em 31/07/2026, que é quando o defeito apareceu: dois períodos em curso ainda
// escritos "Agendada" e três já terminados ainda escritos "Em andamento".
import { describe, it, expect } from "vitest";
import { feriasEmCurso } from "./ferias";
import type { Ferias } from "@/data/types";

const HOJE = new Date(2026, 6, 31); // 31/07/2026
const periodo = (dataInicio: string, dataRetorno: string | null, status: string): Ferias =>
  ({ id: "f", colaboradorId: "c", dataInicio, dataRetorno, status } as Ferias);

describe("feriasEmCurso", () => {
  it("conta quem está fora agora mesmo que o status ainda diga Agendada", () => {
    // Raphael 07/07→06/08 e Daniel 08/07→07/08, ambos gravados como "Agendada".
    expect(feriasEmCurso(periodo("2026-07-07", "2026-08-06", "Agendada"), HOJE)).toBe(true);
    expect(feriasEmCurso(periodo("2026-07-08", "2026-08-07", "Agendada"), HOJE)).toBe(true);
  });

  it("não conta período já terminado, mesmo escrito Em andamento", () => {
    expect(feriasEmCurso(periodo("2026-06-21", "2026-07-21", "Em andamento"), HOJE)).toBe(false);
  });

  it("não conta período que ainda vai começar", () => {
    expect(feriasEmCurso(periodo("2026-08-10", "2026-09-09", "Agendada"), HOJE)).toBe(false);
  });

  it("no dia do retorno a pessoa já está de volta", () => {
    expect(feriasEmCurso(periodo("2026-07-01", "2026-07-31", "Em andamento"), HOJE)).toBe(false);
    expect(feriasEmCurso(periodo("2026-07-01", "2026-08-01", "Em andamento"), HOJE)).toBe(true);
  });

  it("respeita a decisão de quem lançou: Concluída/Cancelada não estão de férias", () => {
    expect(feriasEmCurso(periodo("2026-07-07", "2026-08-06", "Concluída"), HOJE)).toBe(false);
    expect(feriasEmCurso(periodo("2026-07-07", "2026-08-06", "Cancelada"), HOJE)).toBe(false);
  });

  it("sem data de retorno não afirma que a pessoa está fora", () => {
    expect(feriasEmCurso(periodo("2026-07-07", null, "Em andamento"), HOJE)).toBe(false);
  });
});
