// A mensagem vai para o WhatsApp de uma pessoa de verdade: número errado cai
// na conversa de um estranho, e linha vazia faz ela ligar perguntando o que
// faltou. Estes testes travam os dois.
import { describe, it, expect } from "vitest";
import { mensagemAgendamento, quandoLegivel, telefoneWhatsApp, linkWhatsApp } from "./agendamentoExame";

describe("quandoLegivel", () => {
  it("mostra data e hora do jeito que se lê aqui", () => {
    expect(quandoLegivel("2026-08-14T09:30")).toBe("14/08/2026 às 09:30");
  });
  it("sem hora, só a data", () => {
    expect(quandoLegivel("2026-08-14")).toBe("14/08/2026");
  });
  it("vazio não vira 'Invalid Date' na tela", () => {
    expect(quandoLegivel(null)).toBe("");
    expect(quandoLegivel("")).toBe("");
  });
});

describe("telefoneWhatsApp", () => {
  it("celular e fixo brasileiros ganham o 55", () => {
    expect(telefoneWhatsApp("(38) 99999-8888")).toBe("5538999998888");
    expect(telefoneWhatsApp("3833334444")).toBe("553833334444");
  });
  it("número que já tem DDI não ganha outro", () => {
    expect(telefoneWhatsApp("5538999998888")).toBe("5538999998888");
  });
  it("RECUSA o que não dá para ter certeza — mandar para número adivinhado é pior que não mandar", () => {
    expect(telefoneWhatsApp("99998888")).toBeNull(); // sem DDD
    expect(telefoneWhatsApp("")).toBeNull();
    expect(telefoneWhatsApp(null)).toBeNull();
    expect(telefoneWhatsApp("ramal 42")).toBeNull();
    expect(telefoneWhatsApp("1199999888877")).toBeNull(); // 13 dígitos sem 55
  });
});

describe("mensagemAgendamento", () => {
  const base = { nome: "Ana Paula Souza", tipo: "ASO Periódico" };

  it("monta o aviso completo", () => {
    const m = mensagemAgendamento({
      ...base,
      quando: "2026-08-14T09:30",
      clinica: "Clínica Vida",
      local: "Av. Brasil, 100 — Centro",
      observacao: "Comparecer em jejum de 8h.",
      empresa: "Impresilk",
    });
    expect(m).toContain("Olá, Ana!");
    expect(m).toContain("ASO Periódico");
    expect(m).toContain("14/08/2026 às 09:30");
    expect(m).toContain("Clínica Vida");
    expect(m).toContain("Av. Brasil, 100 — Centro");
    expect(m).toContain("jejum");
    expect(m).toContain("Impresilk");
  });

  it("campo não preenchido NÃO vira linha vazia", () => {
    const m = mensagemAgendamento({ ...base, quando: "2026-08-14T09:30" });
    expect(m).not.toContain("Onde:");
    expect(m).not.toContain("Endereço:");
    expect(m).not.toMatch(/—\s*$/m);
  });

  it("trata o colaborador pelo primeiro nome", () => {
    expect(mensagemAgendamento({ nome: "José Adilando Pereira", tipo: "ASO" })).toContain("Olá, José!");
  });

  it("sem nome não deixa saudação quebrada", () => {
    const m = mensagemAgendamento({ nome: "", tipo: "ASO" });
    expect(m.startsWith("Olá!")).toBe(true);
  });

  it("sempre lembra do documento com foto", () => {
    expect(mensagemAgendamento(base)).toContain("documento com foto");
  });
});

describe("linkWhatsApp", () => {
  it("escapa o texto (quebra de linha e acento não podem quebrar o link)", () => {
    const url = linkWhatsApp("5538999998888", "Olá, João!\nExame às 9h");
    expect(url.startsWith("https://wa.me/5538999998888?text=")).toBe(true);
    expect(url).not.toContain("\n");
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Olá, João!\nExame às 9h");
  });
});
