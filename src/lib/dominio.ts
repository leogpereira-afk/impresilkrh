// Lógica de domínio (pura) + hook de lookups reativos. Usado por todos os módulos.
import { useMemo } from "react";
import { useColecao } from "./store";
import type { Cargo, Colaborador, StatusColaborador } from "@/data/types";
import { MAPA_SENIORIDADE } from "./constants";

export type Enquadramento = "Crítico" | "Abaixo" | "Dentro" | "Acima";

// Enquadramento do salário frente à faixa do cargo (N1→N5). Apêndice C.
export function enquadrar(salario: number | null | undefined, faixas?: number[]): Enquadramento {
  if (salario == null || !faixas || faixas.length === 0) return "Dentro";
  const min = faixas[0];
  const max = faixas[faixas.length - 1];
  if (salario < min * 0.92) return "Crítico";
  if (salario < min) return "Abaixo";
  if (salario > max) return "Acima";
  return "Dentro";
}

export function indiceNivel(nivelId?: string | null): number {
  if (!nivelId) return 0;
  const n = parseInt(nivelId.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export function senioridadeDe(nivelId?: string | null): string {
  return nivelId ? MAPA_SENIORIDADE[nivelId] ?? "—" : "—";
}

export function faixaNoNivel(cargo?: Cargo, nivelId?: string | null): number | null {
  if (!cargo || !nivelId) return null;
  const i = indiceNivel(nivelId) - 1;
  return cargo.faixas[i] ?? null;
}

export function contaHeadcount(c: Colaborador, statusById: Map<string, StatusColaborador>): boolean {
  if (c.ehDirecao) return false;
  if (c.dataDesligamento) return false;
  const s = c.statusId ? statusById.get(c.statusId) : undefined;
  return s?.contaComoAtivo ?? false;
}

// Hook de domínio: coleções de referência + mapas e helpers de rótulo.
export function useDominio() {
  const { items: areas } = useColecao("areas");
  const { items: cargos } = useColecao("cargos");
  const { items: niveis } = useColecao("niveis");
  const { items: status } = useColecao("status");
  const { items: colaboradores } = useColecao("colaboradores");

  return useMemo(() => {
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const cargoById = new Map(cargos.map((c) => [c.id, c]));
    const nivelById = new Map(niveis.map((n) => [n.id, n]));
    const statusById = new Map(status.map((s) => [s.id, s]));
    const colabById = new Map(colaboradores.map((c) => [c.id, c]));

    const nomeArea = (id?: string | null) => (id ? areaById.get(id)?.nome ?? "—" : "—");
    const nomeCargo = (c: Colaborador) =>
      c.cargoLivre ?? (c.cargoId ? cargoById.get(c.cargoId)?.nome ?? "—" : "—");
    const nomeNivel = (id?: string | null) => (id ? nivelById.get(id)?.codigo ?? "—" : "—");
    const nomeColab = (id?: string | null) => (id ? colabById.get(id)?.nome ?? "—" : "—");
    const corStatus = (id?: string | null) => (id ? statusById.get(id)?.cor ?? "#64748b" : "#64748b");
    const nomeStatus = (id?: string | null) => (id ? statusById.get(id)?.nome ?? "—" : "—");

    const ativos = colaboradores.filter((c) => contaHeadcount(c, statusById));
    const faixaColab = (c: Colaborador) =>
      c.cargoId ? faixaNoNivel(cargoById.get(c.cargoId), c.nivelId) : null;
    const enquadrarColab = (c: Colaborador): Enquadramento => {
      const cargo = c.cargoId ? cargoById.get(c.cargoId) : undefined;
      if (c.enquadramento) return c.enquadramento as Enquadramento;
      return enquadrar(c.salario, cargo?.faixas);
    };

    return {
      areas, cargos, niveis, status, colaboradores,
      areaById, cargoById, nivelById, statusById, colabById,
      nomeArea, nomeCargo, nomeNivel, nomeColab, corStatus, nomeStatus,
      ativos, faixaColab, enquadrarColab,
    };
  }, [areas, cargos, niveis, status, colaboradores]);
}

export type Dominio = ReturnType<typeof useDominio>;
