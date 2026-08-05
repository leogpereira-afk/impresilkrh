// A régua "quem pode apadrinhar" é mais estreita que "quem é funcionário".
// Estes testes travam a diferença — foi por não existir essa distinção que uma
// pessoa em ABANDONO aparecia como candidata a padrinho de um recém-chegado.
import { describe, it, expect } from "vitest";
import { trabalhandoHoje, noQuadro } from "./dominio";
import type { Colaborador } from "@/data/types";

const c = (over: Partial<Colaborador> = {}): Colaborador =>
  ({ id: "x", nome: "Fulano", statusId: "ativo", ...over }) as Colaborador;

describe("trabalhandoHoje", () => {
  it("ativo e em experiência entram", () => {
    expect(trabalhandoHoje(c())).toBe(true);
    expect(trabalhandoHoje(c({ statusId: "experiencia" }))).toBe(true);
  });

  it("ABANDONO fica de fora — o caso real de 05/08/2026", () => {
    // Elnatã aparecia na lista de padrinhos: o status "abandono" está marcado
    // como conta-como-ativo na tabela de status, então passava no headcount.
    expect(trabalhandoHoje(c({ statusId: "abandono" }))).toBe(false);
  });

  it("aviso prévio fica de fora: está de saída, não acompanha ninguém", () => {
    expect(trabalhandoHoje(c({ statusId: "aviso" }))).toBe(false);
  });

  it("afastado e atestado ficam de fora: não estão aqui agora", () => {
    expect(trabalhandoHoje(c({ statusId: "afastado" }))).toBe(false);
    expect(trabalhandoHoje(c({ statusId: "atestado-medico" }))).toBe(false);
  });

  it("direção não entra em lista de colaborador", () => {
    expect(trabalhandoHoje(c({ ehDirecao: true }))).toBe(false);
  });

  it("inativo e desligado ficam de fora", () => {
    expect(trabalhandoHoje(c({ statusId: "inativo" }))).toBe(false);
    expect(trabalhandoHoje(c({ dataDesligamento: "2026-05-30" }))).toBe(false);
  });

  it("status desconhecido não entra por engano", () => {
    expect(trabalhandoHoje(c({ statusId: "sei-la" }))).toBe(false);
    expect(trabalhandoHoje(c({ statusId: undefined }))).toBe(false);
  });

  it("É MAIS ESTREITA que noQuadro — a diferença é o ponto", () => {
    // noQuadro responde "ainda é funcionário?"; esta responde "está aqui hoje?".
    const afastado = c({ statusId: "afastado" });
    expect(noQuadro(afastado)).toBe(true);
    expect(trabalhandoHoje(afastado)).toBe(false);
  });
});
