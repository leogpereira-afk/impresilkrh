import { describe, it, expect } from "vitest";
import { naoLido, marcarTodas, limpar, lerLidas, gravarLidas, type Lidas } from "@/lib/notificacoesLidas";

const a = (id: string, severidade: "alta" | "media" | "baixa") => ({ id, severidade });

describe("naoLido", () => {
  it("nunca lido conta", () => {
    expect(naoLido(a("doc-1", "alta"), {})).toBe(true);
  });

  it("lido na mesma severidade não conta", () => {
    expect(naoLido(a("doc-1", "alta"), { "doc-1": "alta" })).toBe(false);
  });

  it("O CASO QUE IMPORTA: piorou depois de lido, volta a contar", () => {
    // Ter visto que um exame vence em 30 dias não é ter visto que ele venceu.
    expect(naoLido(a("doc-1", "alta"), { "doc-1": "media" })).toBe(true);
    expect(naoLido(a("doc-1", "media"), { "doc-1": "baixa" })).toBe(true);
  });

  it("melhorou depois de lido, continua quieto", () => {
    // Quem já viu o problema no auge não precisa ser cutucado porque amenizou.
    expect(naoLido(a("doc-1", "baixa"), { "doc-1": "alta" })).toBe(false);
    expect(naoLido(a("doc-1", "media"), { "doc-1": "alta" })).toBe(false);
  });
});

describe("marcarTodas", () => {
  it("guarda a severidade de cada uma, não só o id", () => {
    const r = marcarTodas([a("x", "alta"), a("y", "baixa")], {});
    expect(r).toEqual({ x: "alta", y: "baixa" });
  });

  it("depois de marcar, o contador zera", () => {
    const avisos = [a("x", "alta"), a("y", "media"), a("z", "baixa")];
    const lidas = marcarTodas(avisos, {});
    expect(avisos.filter((n) => naoLido(n, lidas))).toHaveLength(0);
  });

  it("não apaga marcações de avisos que não estão na lista agora", () => {
    // Um filtro pode esconder avisos; marcar o que está na tela não pode
    // reabrir o que já foi visto fora dela.
    const r = marcarTodas([a("x", "alta")], { antigo: "media" });
    expect(r.antigo).toBe("media");
  });

  it("não muta o objeto que recebeu", () => {
    const antes: Lidas = { x: "media" };
    marcarTodas([a("x", "alta")], antes);
    expect(antes.x).toBe("media");
  });
});

describe("limpar", () => {
  it("esquece o que saiu da lista — senão o registro cresce para sempre", () => {
    const r = limpar([a("vivo", "alta")], { vivo: "alta", morto: "media" });
    expect(r).toEqual({ vivo: "alta" });
  });

  it("lista vazia limpa tudo", () => {
    expect(limpar([], { x: "alta" })).toEqual({});
  });
});

describe("ler/gravar", () => {
  const fake = (): Storage => {
    const m = new Map<string, string>();
    return {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, v),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
      key: () => null, length: 0,
    } as unknown as Storage;
  };

  it("o que grava é o que lê de volta", () => {
    const st = fake();
    gravarLidas("u1", { x: "alta" }, st);
    expect(lerLidas("u1", st)).toEqual({ x: "alta" });
  });

  it("cada pessoa tem a sua marcação no mesmo aparelho", () => {
    // Numa gráfica há máquina compartilhada: o que um marcou como visto não
    // pode silenciar o sino do outro.
    const st = fake();
    gravarLidas("u1", { x: "alta" }, st);
    expect(lerLidas("u2", st)).toEqual({});
  });

  it("conteúdo corrompido não derruba a tela", () => {
    const st = fake();
    st.setItem("impresilk.rh.v1:notificacoes-lidas:u1", "{isso não é json");
    expect(lerLidas("u1", st)).toEqual({});
    st.setItem("impresilk.rh.v1:notificacoes-lidas:u1", "[1,2,3]");
    expect(lerLidas("u1", st)).toEqual({});
  });

  it("sem usuário, não grava nem lê nada", () => {
    const st = fake();
    gravarLidas("", { x: "alta" }, st);
    expect(lerLidas("", st)).toEqual({});
  });
});
