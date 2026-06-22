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
// Promoções (histórico) — derivadas de colaboradores sênior ativos do quadro real.
const datasPromo = ["2023-06-01", "2022-09-01", "2021-12-01", "2020-03-01", "2024-02-01"];
const promoviveis = COLABORADORES.filter(
  (c) => !c.ehDirecao && c.statusId !== "inativo" && (c.nivelId === "N4" || c.nivelId === "N5"),
).slice(0, 5);
promoviveis.forEach((c, i) => {
  const para = c.nivelId!;
  const de = `N${Math.max(1, parseInt(para.slice(1)) - 1)}`;
  const sal = c.salario ?? 2000;
  lista.push({
    id: `mov-promo-${c.id}`,
    colaboradorId: c.id,
    tipo: "Promoção",
    data: datasPromo[i] ?? "2023-01-01",
    descricao: `Promoção de nível ${de} para ${para} por desempenho consistente.`,
    nivelAnterior: de,
    nivelNovo: para,
    salarioAnterior: +(sal * 0.9).toFixed(2),
    salarioNovo: sal,
    registradoPor: "RH",
  });
});

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
