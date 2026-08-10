import { describe, it, expect } from "vitest";
import { visivel, alternarFoco, esquecerTipo } from "@/lib/focoCalendario";

const vazio = new Set<string>();
const TODOS = ["Aniversário", "Pagamento", "Feriado", "NR vence", "Reunião", "Férias"];

describe("visivel — sem nada em foco", () => {
  it("aparece TUDO, sem exceção", () => {
    // "Férias" já nascia riscado, por encher o quadro. Num modelo em que o
    // clique escolhe o que ver, um selo desligado em repouso parece travado —
    // e foi assim que soou para quem usa. Agora todo selo começa igual.
    for (const t of TODOS) expect(visivel(t, vazio), `${t} deveria aparecer`).toBe(true);
  });
});

describe("visivel — com foco", () => {
  it("O CASO QUE IMPORTA: um clique e vê SÓ aquele tipo", () => {
    // Antes o clique escondia: para ver só aniversário era preciso clicar nos
    // outros onze selos, um por um. Ninguém fazia, e o filtro não servia.
    const foco = new Set(["Aniversário"]);
    expect(visivel("Aniversário", foco)).toBe(true);
    for (const outro of ["Pagamento", "Feriado", "NR vence", "Reunião", "Férias"]) {
      expect(visivel(outro, foco), `${outro} deveria sumir`).toBe(false);
    }
  });

  it("dois em foco mostram os dois, e só eles", () => {
    const foco = new Set(["Aniversário", "Pagamento"]);
    expect(visivel("Aniversário", foco)).toBe(true);
    expect(visivel("Pagamento", foco)).toBe(true);
    expect(visivel("Feriado", foco)).toBe(false);
  });

  it("ver só as férias é um clique", () => {
    const foco = new Set(["Férias"]);
    expect(visivel("Férias", foco)).toBe(true);
    expect(visivel("Aniversário", foco)).toBe(false);
  });
});

describe("alternarFoco", () => {
  it("clicar entra no foco; clicar de novo sai", () => {
    const um = alternarFoco(vazio, "Aniversário");
    expect([...um]).toEqual(["Aniversário"]);
    expect([...alternarFoco(um, "Aniversário")]).toEqual([]);
  });

  it("tirar o último devolve TUDO, não uma tela vazia", () => {
    const foco = alternarFoco(vazio, "Aniversário");
    const semFoco = alternarFoco(foco, "Aniversário");
    expect(semFoco.size).toBe(0);
    for (const t of TODOS) expect(visivel(t, semFoco), `${t} deveria voltar`).toBe(true);
  });

  it("soma tipos sem apagar os anteriores", () => {
    const a = alternarFoco(vazio, "Aniversário");
    const b = alternarFoco(a, "Pagamento");
    expect([...b].sort()).toEqual(["Aniversário", "Pagamento"]);
  });

  it("devolve um Set NOVO — senão o React não redesenha", () => {
    const antes = new Set(["Aniversário"]);
    const depois = alternarFoco(antes, "Pagamento");
    expect(depois).not.toBe(antes);
    expect([...antes]).toEqual(["Aniversário"]); // o antigo não foi mexido
  });
});

describe("esquecerTipo", () => {
  it("apagar um tipo que estava em foco não deixa o quadro filtrado por um fantasma", () => {
    // Sem isto, o filtro apontava para um nome que não tem mais selo: nada
    // aparecia e não havia onde clicar para desfazer.
    const foco = new Set(["Vistoria de extintor", "Pagamento"]);
    expect([...esquecerTipo(foco, "Vistoria de extintor")]).toEqual(["Pagamento"]);
  });

  it("apagar o único em foco devolve a vista completa", () => {
    const r = esquecerTipo(new Set(["Vistoria"]), "Vistoria");
    expect(r.size).toBe(0);
    expect(visivel("Aniversário", r)).toBe(true);
  });

  it("tipo que não estava em foco não muda nada", () => {
    const foco = new Set(["Pagamento"]);
    expect(esquecerTipo(foco, "Vistoria")).toBe(foco);
  });
});
