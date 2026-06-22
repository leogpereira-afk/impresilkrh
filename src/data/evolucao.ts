import type { EtapaEvolucao } from "./types";
import { COLABORADORES } from "./colaboradores";

// Gamificação da evolução de cargo (v3) — etapas que vão sendo marcadas; a % evolui.
const alvos = COLABORADORES.filter(
  (c) => !c.ehDirecao && c.statusId !== "inativo" && c.potencial === "Alto" && c.nivelId,
).slice(0, 8);

const ETAPAS_PADRAO = [
  "Domínio técnico consolidado no nível atual",
  "Bater as metas por 2 ciclos consecutivos",
  "Reduzir retrabalho ao alvo do cargo",
  "Conduzir um projeto/frente sem supervisão",
  "Apoiar e orientar um colega (mentoria)",
  "Avaliação de desempenho no limiar do próximo nível",
];

const lista: EtapaEvolucao[] = [];
alvos.forEach((c, idx) => {
  const n = c.nivelId ? parseInt(c.nivelId.slice(1)) : 1;
  const alvo = n < 5 ? `N${n + 1}` : "N5";
  ETAPAS_PADRAO.forEach((t, i) => {
    lista.push({
      id: `evo-${c.id}-${i}`,
      colaboradorId: c.id,
      titulo: t,
      concluida: i < (idx % 4) + 1,
      ordem: i,
      cargoAlvo: alvo,
    });
  });
});

export const EVOLUCAO: EtapaEvolucao[] = lista;
