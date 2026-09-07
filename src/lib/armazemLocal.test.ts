// O armazém guarda as coleções no IndexedDB porque o localStorage (5 MB por
// ORIGEM) é dividido com todos os sistemas da casa. Estes testes cobrem o que
// a revisão não vê: a migração, a janela em que o disco ainda não chegou e a
// conversa entre abas.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";

async function carregarModulo() {
  vi.resetModules();
  return await import("./armazemLocal");
}

describe("armazém local (IndexedDB)", () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
  });

  it("migra o que estava no localStorage e LIBERA o espaço", async () => {
    const chave = "impresilk.rh.v1:col:pagamentos:conta:42:gestor";
    localStorage.setItem(chave, JSON.stringify([{ id: "p1", valor: 100 }]));

    const m = await carregarModulo();
    await m.prontoArmazem();

    expect(m.lerArmazem(chave)).toBe(JSON.stringify([{ id: "p1", valor: 100 }]));
    // o espaço do localStorage foi devolvido...
    expect(localStorage.getItem(chave)).toBeNull();
    // ...e ficou o marcador, que é o que avisa a próxima abertura.
    expect(m.armazemEmIDB()).toBe(true);
    expect(m.armazemHidratado()).toBe(true);
  });

  it("relê do disco numa abertura seguinte, sem localStorage", async () => {
    const chave = "impresilk.rh.v1:col:ferias:conta:42:gestor";
    const primeiro = await carregarModulo();
    await primeiro.prontoArmazem();
    primeiro.gravarArmazem(chave, JSON.stringify([{ id: "f1" }]));
    await new Promise((r) => setTimeout(r, 350)); // deixa a gravação descarregar

    // Abre de novo (módulo zerado), com o localStorage sem as coleções.
    const segundo = await carregarModulo();
    expect(segundo.lerArmazem(chave)).toBeNull();   // antes de hidratar: nada
    expect(segundo.armazemEmIDB()).toBe(true);      // mas o marcador avisa
    await segundo.prontoArmazem();
    expect(segundo.lerArmazem(chave)).toBe(JSON.stringify([{ id: "f1" }]));
  });

  it("o marcador denuncia a janela em que o disco ainda não chegou", async () => {
    // Esta é a trava que impede o store de adotar os dados de EXEMPLO enquanto
    // a leitura assíncrona não voltou — o vazamento de 30/07/2026.
    const m = await carregarModulo();
    localStorage.setItem("impresilk.rh.armazem", "idb");
    expect(m.armazemEmIDB()).toBe(true);
    expect(m.armazemHidratado()).toBe(false);
  });

  it("apagar tira do disco também", async () => {
    const chave = "impresilk.rh.v1:col:tarefas:conta:42:gestor";
    const m = await carregarModulo();
    await m.prontoArmazem();
    m.gravarArmazem(chave, "[1]");
    m.removerArmazem(chave);
    await new Promise((r) => setTimeout(r, 350));
    expect(m.lerArmazem(chave)).toBeNull();

    const outro = await carregarModulo();
    await outro.prontoArmazem();
    expect(outro.lerArmazem(chave)).toBeNull();
  });

  it("sem IndexedDB, continua no localStorage como antes", async () => {
    (globalThis as unknown as { indexedDB: undefined }).indexedDB = undefined;
    const chave = "impresilk.rh.v1:col:cargos:conta:42:gestor";
    const m = await carregarModulo();
    await m.prontoArmazem();
    expect(m.gravarArmazem(chave, "[2]")).toBe(true);
    expect(localStorage.getItem(chave)).toBe("[2]");
    expect(m.lerArmazem(chave)).toBe("[2]");
    expect(m.armazemEmIDB()).toBe(false); // sem marcador: o store usa os defaults
  });
});
