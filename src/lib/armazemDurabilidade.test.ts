// Todos os registros e contas deste ensaio são fictícios.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { IDBDatabase, IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { webcrypto } from "node:crypto";

const chave = "impresilk.rh.v1:col:tarefas:conta:conta-ficticia:ADMIN_RH";
const esperar = () => new Promise(resolve => setTimeout(resolve, 350));
async function abrir() { vi.resetModules(); const m = await import("./armazemLocal"); await m.prontoArmazem(); return m; }
async function prepararDisco(valor: string) {
  await new Promise<void>((resolve, reject) => {
    const abrir = indexedDB.open("impresilk.rh.dados", 1);
    abrir.onupgradeneeded = () => abrir.result.createObjectStore("chaves");
    abrir.onsuccess = () => {
      const db = abrir.result; const tx = db.transaction("chaves", "readwrite");
      tx.objectStore("chaves").put(valor, chave);
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
    abrir.onerror = () => reject(abrir.error);
  });
}
beforeEach(() => {
  localStorage.clear(); vi.resetModules();
  vi.stubGlobal("indexedDB", new IDBFactory()); vi.stubGlobal("BroadcastChannel", undefined);
  vi.stubGlobal("crypto", webcrypto);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("recebe a nuvem direto no disco com diário sem espaço e reabre com a mesma cópia", async () => {
  const pagina = await abrir();
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota fictícia", "QuotaExceededError"); });
  expect(await pagina.receberArmazem(chave, "conteudo remoto ficticio", () => true)).toBe(true);
  expect(pagina.lerArmazem(chave)).toBe("conteudo remoto ficticio");
  quota.mockRestore();
  expect((await abrir()).lerArmazem(chave)).toBe("conteudo remoto ficticio");
});

it("confirma edição e fila juntas mesmo quando não cabe nenhum byte no diário", async () => {
  await prepararDisco("antes"); const pagina = await abrir();
  const fila = chave + "-fila";
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota fictícia", "QuotaExceededError"); });
  await pagina.executarEdicaoLocal(() => {
    expect(pagina.gravarArmazem(chave, "depois")).toBe(true);
    expect(pagina.lerArmazem(chave)).toBe("depois");
    expect(pagina.gravarArmazem(fila, "mutacao ficticia")).toBe(true);
  });
  expect(pagina.estadoArmazem()).toBe("ok"); quota.mockRestore();
  const reaberta = await abrir();
  expect(reaberta.lerArmazem(chave)).toBe("depois"); expect(reaberta.lerArmazem(fila)).toBe("mutacao ficticia");
});

it("transação de edição abortada não confirma coleção nem fila", async () => {
  await prepararDisco("antes"); const pagina = await abrir();
  const original = IDBObjectStore.prototype.put;
  const abortar = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args) {
    const req = original.apply(this, args); if (args[1] === chave) this.transaction.abort(); return req;
  });
  await expect(pagina.executarEdicaoLocal(() => {
    pagina.gravarArmazem(chave, "depois"); pagina.gravarArmazem(chave + "-fila", "mutacao ficticia");
  })).rejects.toThrow();
  abortar.mockRestore();
  expect(pagina.lerArmazem(chave)).toBe("antes");
  const reaberta = await abrir(); expect(reaberta.lerArmazem(chave)).toBe("antes"); expect(reaberta.lerArmazem(chave + "-fila")).toBeNull();
});

it("callback recusado e escrita concorrente não deixam uma edição parcial", async () => {
  await prepararDisco("antes"); const pagina = await abrir();
  await expect(pagina.executarEdicaoLocal(() => { pagina.gravarArmazem(chave, "rascunho"); throw new Error("recusada"); })).rejects.toThrow("recusada");
  expect(pagina.lerArmazem(chave)).toBe("antes");
  const original = IDBObjectStore.prototype.put;
  const alterar = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args) {
    const req = original.apply(this, args); if (args[1] === chave && args[0] === "rascunho") pagina.gravarArmazem(chave, "edicao concorrente"); return req;
  });
  await expect(pagina.executarEdicaoLocal(() => { pagina.gravarArmazem(chave, "rascunho"); })).rejects.toThrow();
  alterar.mockRestore(); await pagina.confirmarArmazem();
  expect((await abrir()).lerArmazem(chave)).toBe("edicao concorrente");
});

it("recebimento abortado não aparece na tela nem substitui o dado confirmado", async () => {
  await prepararDisco("antes"); const pagina = await abrir();
  const original = IDBObjectStore.prototype.put;
  const abortar = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = original.apply(this, args); if (args[1] === chave) this.transaction.abort(); return request;
  });
  await expect(pagina.receberArmazem(chave, "depois", () => true)).rejects.toThrow();
  expect(pagina.lerArmazem(chave)).toBe("antes");
  abortar.mockRestore(); expect((await abrir()).lerArmazem(chave)).toBe("antes");
});

it("edição durante o recebimento vence e permanece recuperável mesmo fechando a página", async () => {
  await prepararDisco("antes"); const pagina = await abrir();
  const original = IDBObjectStore.prototype.put;
  const editar = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = original.apply(this, args);
    if (args[1] === chave && args[0] === "nuvem") pagina.gravarArmazem(chave, "edicao pendente");
    return request;
  });
  expect(await pagina.receberArmazem(chave, "nuvem", () => true)).toBe(false);
  expect(pagina.lerArmazem(chave)).toBe("edicao pendente");
  editar.mockRestore(); expect((await abrir()).lerArmazem(chave)).toBe("edicao pendente");
});

it("aba com cópia antiga não desfaz o recebimento que outra aba confirmou", async () => {
  await prepararDisco("antes"); const atrasada = await abrir(); const recente = await abrir();
  expect(await recente.receberArmazem(chave, "nova", () => true)).toBe(true);
  expect(await atrasada.receberArmazem(chave, "antiga", () => true)).toBe(false);
  expect(atrasada.lerArmazem(chave)).toBe("nova");
  expect((await abrir()).lerArmazem(chave)).toBe("nova");
});

it("recupera alteração aceita se a página encerrar antes dos 200 ms", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const pagina = await abrir();
  expect(pagina.gravarArmazem(chave, '[{"id":"t-ficticia"}]')).toBe(true);
  vi.clearAllTimers();
  const reaberta = await abrir();
  expect(reaberta.lerArmazem(chave)).toBe('[{"id":"t-ficticia"}]');
});

it("recupera exclusão aceita antes da descarga e não ressuscita o dado antigo", async () => {
  const pagina = await abrir();
  pagina.gravarArmazem(chave, '[{"id":"remover-ficticio"}]'); await esperar();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  pagina.removerArmazem(chave); vi.clearAllTimers();
  const reaberta = await abrir();
  expect(reaberta.lerArmazem(chave)).toBeNull();
});

it("retém o lote que falhou, grava junto da próxima alteração e libera a recuperação só após confirmar", async () => {
  const pagina = await abrir();
  const original = IDBDatabase.prototype.transaction;
  const falhar = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function(this: IDBDatabase, ...args) {
    if (args[1] === "readwrite") throw new Error("Disco fictício indisponível");
    return original.apply(this, args);
  });
  pagina.gravarArmazem(chave, '[{"id":"primeira-ficticia"}]'); await esperar();
  falhar.mockRestore();
  pagina.gravarArmazem(chave + "-outra", '[{"id":"segunda-ficticia"}]'); await esperar();
  // Sem a recuperação temporária, exige que ambas tenham chegado ao IDB.
  localStorage.clear();
  const reaberta = await abrir();
  expect(reaberta.lerArmazem(chave)).toBe('[{"id":"primeira-ficticia"}]');
  expect(reaberta.lerArmazem(chave + "-outra")).toBe('[{"id":"segunda-ficticia"}]');
});

it("não aceita atualização na memória quando a cópia durável é recusada por quota", async () => {
  const pagina = await abrir();
  pagina.gravarArmazem(chave, "antes"); await esperar();
  const falhar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota fictícia", "QuotaExceededError"); });
  expect(pagina.gravarArmazem(chave, "depois")).toBe(false);
  expect(pagina.lerArmazem(chave)).toBe("antes");
  falhar.mockRestore();
  const reaberta = await abrir(); expect(reaberta.lerArmazem(chave)).toBe("antes");
});

it("preserva a versão mais nova quando a anterior falha e não mistura contas", async () => {
  const pagina = await abrir();
  const original = IDBDatabase.prototype.transaction;
  const falhar = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(function(this: IDBDatabase, ...args) {
    if (args[1] === "readwrite") throw new Error("Disco fictício indisponível");
    return original.apply(this, args);
  });
  pagina.gravarArmazem(chave, "antiga"); await esperar();
  pagina.gravarArmazem(chave, "nova");
  const outra = chave.replace("conta-ficticia", "outra-ficticia");
  pagina.gravarArmazem(outra, "outra conta");
  falhar.mockRestore(); await esperar();
  localStorage.clear(); const reaberta = await abrir();
  expect(reaberta.lerArmazem(chave)).toBe("nova"); expect(reaberta.lerArmazem(outra)).toBe("outra conta");
});

it("retoma a recuperação existente mesmo se IndexedDB ficar indisponível na reabertura", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const pagina = await abrir(); pagina.gravarArmazem(chave, "primeira"); vi.clearAllTimers();
  vi.stubGlobal("indexedDB", undefined);
  const semDisco = await abrir();
  expect(semDisco.estadoArmazem()).toBe("erro");
  expect(semDisco.lerArmazem(chave)).toBe("primeira");
  expect(semDisco.gravarArmazem(chave, "segunda")).toBe(true);
  vi.clearAllTimers();
  const reaberta = await abrir(); expect(reaberta.lerArmazem(chave)).toBe("segunda");
  reaberta.removerArmazem(chave); vi.clearAllTimers();
  expect((await abrir()).lerArmazem(chave)).toBeNull();
});

it("uma aba atrasada não substitui uma versão que outra aba já confirmou", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const atrasada = await abrir(); const recente = await abrir();
  atrasada.gravarArmazem(chave, "antiga"); recente.gravarArmazem(chave, "nova");
  await recente.confirmarArmazem(); await atrasada.confirmarArmazem();
  vi.clearAllTimers();
  expect((await abrir()).lerArmazem(chave)).toBe("nova");
});

it("confirmar transação anterior não apaga a recuperação de edição feita durante a gravação", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const pagina = await abrir(); pagina.gravarArmazem(chave, "antiga");
  const original = IDBObjectStore.prototype.put;
  const interceptar = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = original.apply(this, args);
    if (args[1] === chave) pagina.gravarArmazem(chave, "nova");
    return request;
  });
  await pagina.confirmarArmazem(); interceptar.mockRestore();
  expect(pagina.estadoArmazem()).toBe("pendente");
  vi.clearAllTimers();
  expect((await abrir()).lerArmazem(chave)).toBe("nova");
});

it("transação abortada mantém a recuperação e uma retentativa explícita conclui", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const pagina = await abrir(); pagina.gravarArmazem(chave, "preservar");
  const original = IDBObjectStore.prototype.put;
  const abortar = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function(this: IDBObjectStore, ...args) {
    const request = original.apply(this, args); if (args[1] === chave) this.transaction.abort(); return request;
  });
  expect(await pagina.confirmarArmazem()).toBe(false); expect(pagina.estadoArmazem()).toBe("erro");
  abortar.mockRestore();
  expect(await pagina.confirmarArmazem()).toBe(true); expect(pagina.estadoArmazem()).toBe("ok");
  localStorage.clear(); expect((await abrir()).lerArmazem(chave)).toBe("preservar");
});

it("confirmar um lote anterior não esconde a recusa de uma alteração posterior", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const pagina = await abrir(); pagina.gravarArmazem(chave, "aceita");
  const falhar = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("Quota fictícia"); });
  expect(pagina.gravarArmazem(chave, "recusada")).toBe(false);
  falhar.mockRestore(); await pagina.confirmarArmazem();
  expect(pagina.estadoArmazem()).toBe("erro");
  expect(pagina.lerArmazem(chave)).toBe("aceita");
  expect(pagina.gravarArmazem(chave, "retentativa aceita")).toBe(true);
  await pagina.confirmarArmazem(); expect(pagina.estadoArmazem()).toBe("ok");
});

it("uma edição pequena em coleção maior que a quota usa recuperação pequena e sobrevive ao encerramento", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const registros = [{ id: "editavel-ficticio", titulo: "Antes" }, { id: "volume-ficticio", conteudo: "x".repeat(5_100_000) }];
  await prepararDisco(JSON.stringify(registros));
  const pagina = await abrir();
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (value.length > 20_000) throw new DOMException("Pouco espaço compartilhado fictício", "QuotaExceededError");
    original.call(this, key, value);
  });
  registros[0].titulo = "Depois";
  expect(pagina.gravarArmazem(chave, JSON.stringify(registros))).toBe(true);
  vi.clearAllTimers(); quota.mockRestore();
  expect(JSON.parse((await abrir()).lerArmazem(chave)!)[0].titulo).toBe("Depois");
});

it("delta por registro preserva exclusões, inclusões e ordem após commit sem limpeza do diário", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const volume = { id: "volume-ficticio", conteudo: "x".repeat(5_100_000) };
  await prepararDisco(JSON.stringify([{ id: "a", titulo: "Antes A" }, volume, { id: "excluir" }, { id: "c", titulo: "Antes C" }]));
  const pagina = await abrir();
  const esperado = JSON.stringify([{ id: "c", titulo: "Depois C" }, { id: "a", titulo: "Depois A" }, volume, { id: "novo" }]);
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (value.length > 20_000) throw new Error("Quota fictícia");
    original.call(this, key, value);
  });
  expect(pagina.gravarArmazem(chave, esperado)).toBe(true);
  const limpeza = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error("Encerramento após commit fictício"); });
  expect(await pagina.confirmarArmazem()).toBe(false);
  limpeza.mockRestore(); quota.mockRestore(); vi.clearAllTimers();
  expect((await abrir()).lerArmazem(chave)).toBe(esperado);
});

it("base incompatível mantém o diário intacto e bloqueia sua substituição", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const antigo = JSON.stringify([{ id: "ficticio", conteudo: "x".repeat(10_000), titulo: "Antes" }]);
  await prepararDisco(antigo); const pagina = await abrir();
  expect(pagina.gravarArmazem(chave, antigo.replace("Antes", "Depois"))).toBe(true);
  vi.clearAllTimers();
  const diariosAntes = Object.keys(localStorage).filter(k => k.includes("recuperacao:")).map(k => localStorage.getItem(k));
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.open("impresilk.rh.dados", 1);
    req.onsuccess = () => {
      const db = req.result; const tx = db.transaction("chaves", "readwrite"); const cursor = tx.objectStore("chaves").openCursor();
      cursor.onsuccess = () => {
        const atual = cursor.result;
        if (!atual) return;
        if (atual.key !== chave) atual.update(JSON.stringify({ hash: "0".repeat(64), valor: "Base divergente fictícia" }));
        atual.continue();
      };
      tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
    };
  });
  const reaberta = await abrir();
  expect(reaberta.estadoArmazem()).toBe("erro"); expect(reaberta.lerArmazem(chave)).toBe(antigo);
  expect(reaberta.gravarArmazem(chave, "substituição indevida")).toBe(false);
  expect(Object.keys(localStorage).filter(k => k.includes("recuperacao:")).map(k => localStorage.getItem(k))).toEqual(diariosAntes);
});

it("edita e recupera uma coleção que cresceu na nuvem mesmo com base antiga e pouco espaço", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await prepararDisco("[]");
  const pagina = await abrir();
  const registros = Array.from({ length: 400 }, (_, i) => ({ id: `ficticio-${i}`, nome: `Pessoa fictícia ${i}`, observacao: "Informação sintética para ensaio ".repeat(60), tamanho: "M" }));
  const atual = JSON.stringify(registros);
  expect(await pagina.receberArmazem(chave, atual, () => true)).toBe(true);
  const original = Storage.prototype.setItem;
  const quota = vi.spyOn(Storage.prototype, "setItem").mockImplementation(function(this: Storage, key, value) {
    if (value.length > 20_000) throw new DOMException("Quota fictícia", "QuotaExceededError");
    original.call(this, key, value);
  });
  registros[0].tamanho = "G";
  expect(pagina.gravarArmazem(chave, JSON.stringify(registros))).toBe(true);
  vi.clearAllTimers(); quota.mockRestore();
  expect((await abrir()).lerArmazem(chave)).toBe(JSON.stringify(registros));
});

it("migração atrasada não sobrescreve edição que outra aba já confirmou", async () => {
  const recente = await abrir(); localStorage.setItem(chave, "legado antigo");
  vi.resetModules(); const migrando = await import("./armazemLocal");
  const original = indexedDB.open.bind(indexedDB);
  let chamadas = 0; let liberar!: () => void; let avisar!: () => void;
  const travou = new Promise<void>(resolve => { avisar = resolve; });
  const interceptar = vi.spyOn(indexedDB, "open").mockImplementation((...args) => {
    const req = original(...args);
    if (++chamadas === 2) {
      const dispatch = req.dispatchEvent.bind(req);
      vi.spyOn(req, "dispatchEvent").mockImplementation(ev => {
        if (ev.type === "success") { liberar = () => { dispatch(ev); }; avisar(); return true; }
        return dispatch(ev);
      });
    }
    return req;
  });
  const boot = migrando.prontoArmazem(); await travou;
  recente.gravarArmazem(chave, "nova edição confirmada"); await recente.confirmarArmazem();
  liberar(); await boot; interceptar.mockRestore();
  expect((await abrir()).lerArmazem(chave)).toBe("nova edição confirmada");
});
