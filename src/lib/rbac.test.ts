import { describe, expect, it } from "vitest";
import { modulosLiberados, podeVerGestao } from "./rbac";
import type { Colaborador, Usuario } from "@/data/types";
import type { Sessao } from "@/lib/session";

const col = (id: string, gestorId?: string): Colaborador => ({ id, nome: id, statusId: "ativo", gestorId } as unknown as Colaborador);
const sessao = (perfil: Sessao["perfil"], colaboradorId: string): Sessao => ({ perfil, colaboradorId } as Sessao);

describe("podeVerGestao — nunca ao próprio colaborador", () => {
  const pessoas = [col("maria"), col("bia", "maria"), col("caio", "outro")];
  it("gestora vê os dados de gestão da subordinada", () => {
    expect(podeVerGestao(sessao("GESTOR", "maria"), "bia", pessoas)).toBe(true);
  });
  it("gestora NÃO vê os próprios dados de gestão", () => {
    expect(podeVerGestao(sessao("GESTOR", "maria"), "maria", pessoas)).toBe(false);
  });
  it("gestora não vê quem não é da equipe; RH vê todos; colaborador não vê ninguém", () => {
    expect(podeVerGestao(sessao("GESTOR", "maria"), "caio", pessoas)).toBe(false);
    expect(podeVerGestao(sessao("ADMIN_RH", "rh"), "maria", pessoas)).toBe(true);
    expect(podeVerGestao(sessao("COLABORADOR", "bia"), "bia", pessoas)).toBe(false);
  });
});

describe("modulosLiberados — desativado é sem módulo, não sem restrição", () => {
  const usuarios = [
    { id: "u1", colaboradorId: "joao", ativo: false, permissoes: ["ferias"] },
    { id: "u2", colaboradorId: "ana", ativo: true, permissoes: ["ferias", "calendario"] },
  ] as unknown as Usuario[];
  it("usuário desativado recebe conjunto VAZIO (antes caía em null = tudo liberado)", () => {
    const m = modulosLiberados(sessao("GESTOR", "joao"), usuarios);
    expect(m).not.toBeNull();
    expect(m!.size).toBe(0);
  });
  it("usuário ativo com permissões recebe só elas", () => {
    expect([...modulosLiberados(sessao("GESTOR", "ana"), usuarios)!].sort()).toEqual(["calendario", "ferias"]);
  });
  it("sem cadastro de usuário: sem restrição (vale o perfil)", () => {
    expect(modulosLiberados(sessao("GESTOR", "zeca"), usuarios)).toBeNull();
  });
});
