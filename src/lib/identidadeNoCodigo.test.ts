/* A troca da missão, visão e valores no Código de Ética.
 *
 * Começa pelo caso ruim: a troca comer o resto do documento. O Código de Ética
 * tem Abrangência e Temas principais; se a função errar o fim do trecho, eles
 * somem da tela de todo mundo com um clique.
 */
import { describe, it, expect } from "vitest";
import { comIdentidadeNova, precisaAtualizarIdentidade, blocosDaIdentidade } from "./identidadeNoCodigo";
import { INSTITUCIONAIS } from "@/data/institucionais";
import { VALORES } from "@/data/identidade";
import type { Bloco } from "@/data/types";

/* O Código de Ética como está GRAVADO em produção (conferido em 26/09/2026:
   10 blocos, versão 2026.1, missão antiga). */
const ANTIGO: Bloco[] = [
  { tipo: "subtitulo", texto: "Missão" },
  { tipo: "paragrafo", texto: "Ajudar negócios a encontrarem sua essência..." },
  { tipo: "subtitulo", texto: "Visão" },
  { tipo: "paragrafo", texto: "Ser reconhecida como a principal referência..." },
  { tipo: "subtitulo", texto: "Valores" },
  { tipo: "lista", itens: ["Inovação com Inteligência", "Excelência em Execução"] },
  { tipo: "subtitulo", texto: "Abrangência" },
  { tipo: "paragrafo", texto: "Aplica-se a todos os gestores..." },
  { tipo: "subtitulo", texto: "Temas principais" },
  { tipo: "lista", itens: ["Relacionamento com clientes.", "Sigilo e confidencialidade."] },
];

describe("o caso ruim: o resto do Código de Ética não pode sumir", () => {
  it("Abrangência e Temas principais continuam, inteiros e na ordem", () => {
    const novo = comIdentidadeNova(ANTIGO);
    expect(novo.slice(-4)).toEqual(ANTIGO.slice(-4));
  });

  it("documento sem a seção de identidade ganha a identidade no começo, sem perder nada", () => {
    const outro: Bloco[] = [{ tipo: "paragrafo", texto: "Texto qualquer." }];
    const novo = comIdentidadeNova(outro);
    expect(novo.slice(-1)).toEqual(outro);
    expect(novo[0]).toEqual({ tipo: "subtitulo", texto: "Missão" });
  });
});

describe("a troca", () => {
  it("a missão e a visão antigas saem", () => {
    const texto = JSON.stringify(comIdentidadeNova(ANTIGO));
    expect(texto).not.toContain("Ajudar negócios");
    expect(texto).not.toContain("Inovação com Inteligência");
  });

  it("entram os 12 valores numerados, com título e frase, SEM o 'Se quebra'", () => {
    const valores = comIdentidadeNova(ANTIGO).find((b) => b.tipo === "passos")!;
    expect(valores.itens).toHaveLength(12);
    expect(valores.itens![0]).toMatch(/^Somos uma empresa cristã\. É de onde vem a régua/);
    expect(JSON.stringify(valores)).not.toMatch(/Se quebra/i);
  });

  it("é idempotente: aplicada duas vezes, não duplica nada", () => {
    const uma = comIdentidadeNova(ANTIGO);
    expect(comIdentidadeNova(uma)).toEqual(uma);
  });

  it("o aviso só aparece enquanto a identidade antiga está lá", () => {
    expect(precisaAtualizarIdentidade(ANTIGO)).toBe(true);
    expect(precisaAtualizarIdentidade(comIdentidadeNova(ANTIGO))).toBe(false);
  });

  it("O CASO RUIM: edição feita à mão DEPOIS da troca não faz o aviso voltar", () => {
    // Se voltasse, um clique no botão desfaria a edição de alguém, calado.
    const editado = comIdentidadeNova(ANTIGO).map((b) =>
      b.tipo === "passos" ? { ...b, itens: [...(b.itens ?? []), "Um 13º valor escrito pelo RH."] } : b,
    );
    expect(precisaAtualizarIdentidade(editado)).toBe(false);
  });

  it("sem travessão no texto novo (ordem do Léo, 23/09)", () => {
    expect(JSON.stringify(blocosDaIdentidade())).not.toMatch(/[–—]/);
    expect(VALORES).toHaveLength(12);
  });
});

describe("a semente de instalação nova já nasce com a identidade nova", () => {
  it("o Código de Ética da semente não precisa de atualização", () => {
    const etica = INSTITUCIONAIS.find((d) => d.id === "codigo-etica")!;
    expect(precisaAtualizarIdentidade(etica.blocos)).toBe(false);
  });
});
