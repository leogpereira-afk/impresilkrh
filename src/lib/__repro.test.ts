import { describe, it, expect } from "vitest";
import { definirColecao, criarEm, atualizarEm, useColecao } from "@/lib/store";
import type { Tarefa } from "@/data/types";

const doc = (i: number): Tarefa => ({
  id: `doc-${i}`, colaboradorId: "c1", tipo: "Admissão",
  titulo: `Doc: item ${i}`, responsavel: "RH", concluida: false, concluidaEm: null, ordem: i,
} as Tarefa);

describe("REPRO: marcar um item do checklist desmarca os outros?", () => {
  it("dois toggles seguidos mantêm os dois marcados", () => {
    definirColecao("tarefas", [doc(1), doc(2), doc(3), doc(4), doc(5), doc(6), doc(7)]);

    atualizarEm("tarefas", "doc-2", { concluida: true, concluidaEm: new Date().toISOString() });
    let itens = (globalThis as any).__nada ?? null;
    // lê pelo mesmo caminho da tela
    const ler = () => JSON.parse(window.localStorage.getItem("impresilk.rh.v1:col:tarefas") || "[]");
    let apos1 = ler().filter((t: any) => t.concluida).map((t: any) => t.id);
    console.log("  depois do 1o toggle, concluidos:", apos1);

    atualizarEm("tarefas", "doc-5", { concluida: true, concluidaEm: new Date().toISOString() });
    let apos2 = ler().filter((t: any) => t.concluida).map((t: any) => t.id);
    console.log("  depois do 2o toggle, concluidos:", apos2);

    void itens; void useColecao;
    expect(apos2.sort()).toEqual(["doc-2", "doc-5"]);
  });
});
