import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const chave = "impresilk.rh.v1:sessao";
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-09-06T10:00:00Z")); localStorage.clear(); vi.resetModules(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); localStorage.clear(); });

describe("sessão em computador compartilhado", () => {
  it("a conferência automática não renova o prazo de inatividade", async () => {
    const s = await import("./session");
    s.entrar("ADMIN_RH", "pessoa-ficticia");
    await vi.advanceTimersByTimeAsync(12 * 60 * 60 * 1000 + 5 * 60 * 1000);
    expect(s.obterSessao()).toBeNull();
    expect(localStorage.getItem(chave)).toBeNull();
  });
  it("um clique depois do prazo não ressuscita a sessão", async () => {
    const s = await import("./session");
    s.entrar("ADMIN_RH", "pessoa-ficticia");
    vi.setSystemTime(new Date("2026-09-07T10:00:00Z"));
    s.renovarSessao();
    expect(s.obterSessao()).toBeNull();
  });
  it("a atividade dentro do prazo preserva manter conectado", async () => {
    const s = await import("./session");
    s.entrar("ADMIN_RH", "pessoa-ficticia", true);
    vi.setSystemTime(new Date("2026-09-08T10:00:00Z"));
    s.renovarSessao();
    expect(s.obterSessao()?.colaboradorId).toBe("pessoa-ficticia");
    expect(JSON.parse(localStorage.getItem(chave)!).lembrar).toBe(true);
  });
});
