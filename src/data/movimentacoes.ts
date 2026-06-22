import type { Movimentacao } from "./types";
import { COLABORADORES } from "./colaboradores";
import { CARGOS } from "./cargos";

const nomeCargo = (id?: string | null) => CARGOS.find((c) => c.id === id)?.nome ?? "—";

const lista: Movimentacao[] = [];

// Admissão de cada colaborador da equipe
COLABORADORES.filter((c) => !c.ehDirecao).forEach((c) => {
  if (!c.dataAdmissao) return;
  lista.push({
    id: `mov-adm-${c.id}`,
    colaboradorId: c.id,
    tipo: "Admissão",
    data: c.dataAdmissao,
    descricao: `Admissão no cargo de ${nomeCargo(c.cargoId)}.`,
    cargoNovo: nomeCargo(c.cargoId),
    nivelNovo: c.nivelId ?? null,
    salarioNovo: c.salario ?? null,
    registradoPor: "Sistema (migração de base)",
  });
});

// Promoções (histórico real)
const promocoes = [
  { id: "bruno-dias-do-nascimento", de: "N3", para: "N4", data: "2023-06-01", sal: 2033.0, salAnt: 1872.5 },
  { id: "lucas-natalino-ferreira", de: "N3", para: "N4", data: "2022-09-01", sal: 2350.0, salAnt: 2150.0 },
  { id: "eberth-soares-santos", de: "N4", para: "N5", data: "2021-12-01", sal: 2668.79, salAnt: 2300.0 },
  { id: "nailton-antunes-da-silva", de: "N4", para: "N5", data: "2020-03-01", sal: 2588.06, salAnt: 2325.0 },
];
for (const p of promocoes) {
  lista.push({
    id: `mov-promo-${p.id}`,
    colaboradorId: p.id,
    tipo: "Promoção",
    data: p.data,
    descricao: `Promoção de nível ${p.de} para ${p.para} por desempenho consistente.`,
    nivelAnterior: p.de,
    nivelNovo: p.para,
    salarioAnterior: p.salAnt,
    salarioNovo: p.sal,
    registradoPor: "RH",
  });
}

// Desligamentos
COLABORADORES.filter((c) => c.dataDesligamento).forEach((c) => {
  lista.push({
    id: `mov-deslig-${c.id}`,
    colaboradorId: c.id,
    tipo: "Afastamento",
    data: c.dataDesligamento!,
    descricao: "Desligamento registrado. Processo de offboarding concluído.",
    registradoPor: "RH",
  });
});

export const MOVIMENTACOES: Movimentacao[] = lista;
