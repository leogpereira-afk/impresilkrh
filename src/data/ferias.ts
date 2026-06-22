import type { Ferias } from "./types";
import { COLABORADORES } from "./colaboradores";
import { mulberry32, HOJE, addDias } from "./_gen";

// Férias — saldos, agendadas, em andamento e concluídas (para o painel e alertas CLT).
const ativos = COLABORADORES.filter((c) => !c.ehDirecao && c.statusId !== "inativo");
const lista: Ferias[] = [];

ativos.forEach((c, i) => {
  const rng = mulberry32(7000 + i * 53);
  const rint = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
  const r = rng();
  if (r < 0.25) {
    const inicio = addDias(HOJE, rint(-5, 20));
    lista.push({
      id: `fer-${c.id}`,
      colaboradorId: c.id,
      periodoAquisitivoInicio: "2025-01-01",
      periodoAquisitivoFim: "2025-12-31",
      dataInicio: inicio,
      dataRetorno: addDias(inicio, 30),
      diasGozados: 0,
      saldoDias: 30,
      status: new Date(inicio) <= HOJE ? "Em andamento" : "Agendada",
    });
  } else if (r < 0.5) {
    const inicio = addDias(HOJE, -rint(60, 200));
    lista.push({
      id: `fer-${c.id}`,
      colaboradorId: c.id,
      periodoAquisitivoInicio: "2024-01-01",
      periodoAquisitivoFim: "2024-12-31",
      dataInicio: inicio,
      dataRetorno: addDias(inicio, 15),
      diasGozados: 15,
      saldoDias: 15,
      status: "Concluída",
    });
  } else {
    lista.push({
      id: `fer-${c.id}`,
      colaboradorId: c.id,
      periodoAquisitivoInicio: "2025-06-01",
      periodoAquisitivoFim: "2026-05-31",
      diasGozados: 0,
      saldoDias: 30,
      status: "Em aberto",
    });
  }
});

export const FERIAS: Ferias[] = lista;
