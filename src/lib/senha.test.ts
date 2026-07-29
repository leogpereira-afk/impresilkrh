// Senha guardada com hash. Se isto quebrar, ou ninguém entra, ou a senha volta
// a ficar legível — os dois casos são graves, então ficam travados por teste.
import { describe, it, expect } from "vitest";
import { criarHash, conferirHash, ehHash, podeHashear } from "./senha";

describe("senha", () => {
  it("o ambiente consegue fazer hash", () => {
    expect(podeHashear()).toBe(true);
  });

  it("aceita a senha certa", async () => {
    const g = await criarHash("Impresilk@2026");
    expect(await conferirHash("Impresilk@2026", g)).toBe(true);
  });

  it("recusa a senha errada", async () => {
    const g = await criarHash("Impresilk@2026");
    expect(await conferirHash("impresilk@2026", g)).toBe(false); // caixa diferente
    expect(await conferirHash("", g)).toBe(false);
    expect(await conferirHash("Impresilk@2027", g)).toBe(false);
  });

  it("NÃO guarda a senha em lugar nenhum do registro", async () => {
    const g = await criarHash("segredo-do-leo");
    expect(JSON.stringify(g)).not.toContain("segredo-do-leo");
  });

  it("duas pessoas com a MESMA senha geram hashes diferentes (sal por pessoa)", async () => {
    const a = await criarHash("mesmaSenha1");
    const b = await criarHash("mesmaSenha1");
    expect(a.hash).not.toBe(b.hash);
    expect(a.sal).not.toBe(b.sal);
    // ainda assim as duas conferem com a própria senha
    expect(await conferirHash("mesmaSenha1", a)).toBe(true);
    expect(await conferirHash("mesmaSenha1", b)).toBe(true);
  });

  it("reconhece o formato novo e rejeita o antigo (texto puro)", async () => {
    expect(ehHash(await criarHash("x"))).toBe(true);
    expect(ehHash("1903")).toBe(false);
    expect(ehHash(null)).toBe(false);
    expect(ehHash({ sal: "a" })).toBe(false);
  });

  it("registro corrompido não derruba o login — só não confere", async () => {
    expect(await conferirHash("x", { algo: "pbkdf2-sha256", sal: "!!!", iteracoes: 1, hash: "zzz" } as never)).toBe(false);
  });
});
