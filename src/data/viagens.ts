import type { Viagem } from "./types";
import { HOJE, addDias } from "./_gen";

const def = [
  { id: "v1", colaboradorId: "adriano-pinheiro-lima", destino: "Janaúba/MG", dias: 3, diaria: 90, offset: -25, status: "Concluída" },
  { id: "v2", colaboradorId: "douglas-thiago-silva", destino: "Pirapora/MG", dias: 2, diaria: 90, offset: -10, status: "Concluída" },
  { id: "v3", colaboradorId: "lucas-natalino-ferreira", destino: "Bocaiúva/MG", dias: 1, diaria: 80, offset: -1, status: "Em andamento" },
  { id: "v4", colaboradorId: "ronivon-cardoso-dos-santos", destino: "Salinas/MG", dias: 4, diaria: 100, offset: 5, status: "Aprovada" },
  { id: "v5", colaboradorId: "adriano-pinheiro-lima", destino: "Diamantina/MG", dias: 2, diaria: 90, offset: 12, status: "Planejada" },
  { id: "v6", colaboradorId: "douglas-thiago-silva", destino: "Curvelo/MG", dias: 3, diaria: 90, offset: 20, status: "Planejada" },
];

export const VIAGENS: Viagem[] = def.map((v) => {
  const inicio = addDias(HOJE, v.offset);
  return {
    id: v.id,
    colaboradorId: v.colaboradorId,
    destino: v.destino,
    dataInicio: inicio,
    dataFim: addDias(inicio, v.dias),
    dias: v.dias,
    valorDiaria: v.diaria,
    valorTotal: v.dias * v.diaria,
    finalidade: "Instalação e montagem em campo",
    status: v.status,
  };
});
