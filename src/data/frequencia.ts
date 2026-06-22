import type { Advertencia, Ausencia } from "./types";
import { COLABORADORES } from "./colaboradores";
import { mulberry32, HOJE, addDias } from "./_gen";

// Frequência (Módulo C) — advertências e absenteísmo. Dados sintéticos, porém
// determinísticos, ponderados pelo humor/risco para alimentar os relatórios.
const ativos = COLABORADORES.filter((c) => !c.ehDirecao && c.statusId !== "inativo");

const TIPOS_ADV = ["Verbal", "Escrita", "Suspensão"];
const MOTIVOS = [
  "Atrasos recorrentes",
  "Descumprimento de POP",
  "Falta não justificada",
  "Uso incorreto de EPI",
  "Conduta inadequada",
];

const adv: Advertencia[] = [];
ativos.forEach((c, i) => {
  const rng = mulberry32(13000 + i * 61);
  const propensao = c.humor === "Desmotivado" ? 0.6 : c.riscoSaida === "Alto" ? 0.3 : 0.06;
  if (rng() < propensao) {
    adv.push({
      id: `adv-${c.id}`,
      colaboradorId: c.id,
      tipo: TIPOS_ADV[Math.floor(rng() * TIPOS_ADV.length)],
      data: addDias(HOJE, -Math.floor(rng() * 200) - 5).slice(0, 10),
      motivo: MOTIVOS[Math.floor(rng() * MOTIVOS.length)],
      descricao: "Registro de advertência conforme política interna de conduta.",
      registradoPor: "RH",
      criadoEm: HOJE.toISOString(),
    });
  }
});
export const ADVERTENCIAS: Advertencia[] = adv;

const TIPOS_AUS = ["Falta", "Atraso", "Atestado", "Falta justificada", "Saída antecipada"];
const aus: Ausencia[] = [];
ativos.forEach((c, i) => {
  const rng = mulberry32(15000 + i * 97);
  const rint = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
  const base = c.humor === "Desmotivado" ? 6 : c.humor === "Estável" ? 3 : 1;
  const n = rint(0, base + 2);
  for (let k = 0; k < n; k++) {
    const tipo = TIPOS_AUS[Math.floor(rng() * TIPOS_AUS.length)];
    const justificada = tipo === "Atestado" || tipo === "Falta justificada" || rng() < 0.3;
    aus.push({
      id: `aus-${c.id}-${k}`,
      colaboradorId: c.id,
      data: addDias(HOJE, -rint(1, 180)).slice(0, 10),
      tipo,
      horas: tipo === "Atraso" || tipo === "Saída antecipada" ? rint(1, 4) : undefined,
      justificada,
      observacao: justificada ? "Justificada" : undefined,
    });
  }
});
export const AUSENCIAS: Ausencia[] = aus;
