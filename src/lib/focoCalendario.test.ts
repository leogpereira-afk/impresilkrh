import { describe, it, expect } from "vitest";
import { visivel, alternarFoco, esquecerTipo } from "@/lib/focoCalendario";

const OCULTOS = new Set(["Férias"]);
const vazio = new Set<string>();

describe("visivel — sem nada em foco", () => {
  it("mostra os tipos normais", () => {
    expect(visivel("Aniversário", vazio, OCULTOS)).toBe(true);
    expect(visivel("Pagamento", vazio, OCULTOS)).toBe(true);
  });

  it("esconde o que é oculto por padrão", () => {
    expect(visivel("Férias", vazio, OCULTOS)).toBe(false);
  });

  it("sem lista de ocultos, mostra tudo", () => {
    expect(visivel("Férias", vazio)).toBe(true);
  });
});

describe("visivel — com foco", () => {
  it("O CASO QUE IMPORTA: um clique e vê SÓ aquele tipo", () => {
    // Antes o clique escondia: para ver só aniversário era preciso clicar nos
    // outros onze selos, um por um. Ninguém fazia, e o filtro não servia.
    const foco = new Set(["Aniversário"]);
    expect(visivel("Aniversário", foco, OCULTOS)).toBe(true);
    for (const outro of ["Pagamento", "Feriado", "NR vence", "Reunião"]) {
      expect(visivel(outro, foco, OCULTOS), `${outro} deveria sumir`).toBe(false);
    }
  });

  it("dois em foco mostram os dois, e só eles", () => {
    const foco = new Set(["Aniversário", "Pagamento"]);
    expect(visivel("Aniversário", foco, OCULTOS)).toBe(true);
    expect(visivel("Pagamento", foco, OCULTOS)).toBe(true);
    expect(visivel("Feriado", foco, OCULTOS)).toBe(false);
  });

  it("focar um tipo oculto por padrão passa a mostrá-lo", () => {
    // É o único jeito de ver Férias — e agora é um clique, não onze.
    expect(visivel("Férias", new Set(["Férias"]), OCULTOS)).toBe(true);
  });

  it("o foco manda mesmo sobre o que é oculto por padrão", () => {
    // Férias fora do foco continua fora, como qualquer outro.
    expect(visivel("Férias", new Set(["Aniversário"]), OCULTOS)).toBe(false);
  });
});

describe("alternarFoco", () => {
  it("clicar entra no foco; clicar de novo sai", () => {
    const um = alternarFoco(vazio, "Aniversário");
    expect([...um]).toEqual(["Aniversário"]);
    expect([...alternarFoco(um, "Aniversário")]).toEqual([]);
  });

  it("tirar o último devolve a vista padrão, não uma tela vazia", () => {
    const foco = alternarFoco(vazio, "Aniversário");
    const semFoco = alternarFoco(foco, "Aniversário");
    expect(semFoco.size).toBe(0);
    expect(visivel("Pagamento", semFoco, OCULTOS)).toBe(true);
    expect(visivel("Férias", semFoco, OCULTOS)).toBe(false);
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

  it("apagar o único em foco devolve a vista padrão", () => {
    const r = esquecerTipo(new Set(["Vistoria"]), "Vistoria");
    expect(r.size).toBe(0);
    expect(visivel("Aniversário", r, OCULTOS)).toBe(true);
  });

  it("tipo que não estava em foco não muda nada", () => {
    const foco = new Set(["Pagamento"]);
    expect(esquecerTipo(foco, "Vistoria")).toBe(foco);
  });
});
