import { describe, it, expect } from "vitest";
import { gerarAnuncio, itens, type DadosAnuncio } from "@/lib/anuncioVaga";

const base: DadosAnuncio = {
  titulo: "Impressor Digital",
  empresa: "Impresilk Comunicação Visual",
  cidade: "Montes Claros/MG",
  area: "Produção",
  quantidade: 2,
  descricao: "Operar a impressora de grande formato\nConferir a qualidade do material",
  requisitos: "Ensino médio completo\nExperiência com impressão digital",
  diferenciais: "Conhecimento em corte e acabamento",
  beneficios: "Vale-transporte\nPlano de saúde",
  tipoContratacao: "CLT",
  jornada: "Segunda a sexta",
  salario: 2500,
  mostrarSalario: false,
  comoCandidatar: "Envie o currículo para o WhatsApp do RH.",
};

describe("itens", () => {
  it("aceita linha, ponto-e-vírgula e marcador, e ignora vazio", () => {
    expect(itens("- Um\n• Dois;  Três\n\n")).toEqual(["Um", "Dois", "Três"]);
  });
  it("texto vazio devolve lista vazia (não quebra o anúncio)", () => {
    expect(itens(undefined)).toEqual([]);
    expect(itens("   ")).toEqual([]);
  });
});

describe("gerarAnuncio", () => {
  it("salário desligado NUNCA vaza o valor — sai 'A combinar'", () => {
    for (const canal of ["whatsapp", "instagram", "mural", "completo"] as const) {
      const t = gerarAnuncio(base, canal);
      expect(t, canal).not.toContain("2.500");
      expect(t, canal).not.toContain("2500");
    }
  });

  it("salário ligado aparece formatado em real", () => {
    const t = gerarAnuncio({ ...base, mostrarSalario: true }, "completo");
    expect(t).toContain("2.500,00");
  });

  it("sem faixa cadastrada, mesmo ligado, diz 'A combinar'", () => {
    const t = gerarAnuncio({ ...base, mostrarSalario: true, salario: null }, "completo");
    expect(t).toContain("A combinar");
  });

  it("o mural interno não fala de salário nem vende a empresa — fala de como participar", () => {
    const t = gerarAnuncio({ ...base, mostrarSalario: true }, "mural");
    expect(t).toContain("Quero disputar");
    expect(t).not.toContain("2.500,00");
  });

  it("plural certo: 2 vagas / 1 vaga", () => {
    expect(gerarAnuncio(base, "whatsapp")).toContain("2 vagas");
    expect(gerarAnuncio({ ...base, quantidade: 1 }, "whatsapp")).toContain("1 vaga");
    expect(gerarAnuncio({ ...base, quantidade: undefined }, "whatsapp")).toContain("1 vaga");
  });

  it("campo vazio não deixa um título órfão no texto", () => {
    const t = gerarAnuncio({ ...base, beneficios: "", diferenciais: "" }, "instagram");
    expect(t).not.toContain("OFERECEMOS");
    expect(t).not.toContain("CONTA PONTO");
  });

  it("o WhatsApp cabe na tela: bem mais curto que o completo", () => {
    const w = gerarAnuncio(base, "whatsapp");
    const c = gerarAnuncio(base, "completo");
    expect(w.length).toBeLessThan(c.length);
  });

  it("os quatro canais sempre trazem o título da vaga", () => {
    // O WhatsApp usa CAIXA ALTA no título de propósito (chama atenção quando o
    // texto é encaminhado), então a comparação ignora a caixa.
    for (const canal of ["whatsapp", "instagram", "mural", "completo"] as const) {
      expect(gerarAnuncio(base, canal).toLowerCase(), canal).toContain("impressor digital");
    }
  });

  it("vaga sem descrição e sem requisitos ainda gera anúncio utilizável", () => {
    const t = gerarAnuncio({ ...base, descricao: "", requisitos: "", diferenciais: "", beneficios: "" }, "whatsapp");
    expect(t.toLowerCase()).toContain("impressor digital");
    expect(t).toContain("Montes Claros/MG");
    expect(t).not.toContain("undefined");
    expect(t).not.toMatch(/\n{3,}/); // sem buracos de linhas em branco
  });
});
