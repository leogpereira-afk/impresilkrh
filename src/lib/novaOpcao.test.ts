/* O "+" do cadastro cria área e cargo só com o nome.
 *
 * Começa pelo caso ruim: a mesma área criada duas vezes com grafias diferentes
 * divide as pessoas em duas listas que parecem uma, e todo número por área
 * passa a sair pela metade, sem ninguém perceber.
 */
import { describe, it, expect } from "vitest";
import { areaParaCriar, cargoParaCriar } from "./novaOpcao";
import { enquadrar } from "./dominio";
import { posicaoNaFaixa } from "./posicaoNaFaixa";
import type { Area, Cargo } from "@/data/types";

const AREAS: Area[] = [
  { id: "producao", nome: "Produção", ordem: 0 },
  { id: "montagem-interna", nome: "Montagem Interna", ordem: 3 },
];
const CARGOS: Cargo[] = [
  { id: "auxiliar", nome: "Auxiliar", areaId: "producao", faixas: [1621, 1700, 1800, 1900, 2000] },
];

describe("o caso ruim: não duplicar o que já existe", () => {
  it("área com o mesmo nome, sem acento e em outra caixa, devolve a existente", () => {
    expect(areaParaCriar("  producao ", AREAS)).toEqual({ existente: AREAS[0] });
    expect(areaParaCriar("MONTAGEM   interna", AREAS)).toEqual({ existente: AREAS[1] });
  });

  it("cargo com o mesmo nome na MESMA área devolve o existente", () => {
    expect(cargoParaCriar("auxíliar", "producao", CARGOS, AREAS)).toEqual({ existente: CARGOS[0] });
  });

  it("o mesmo nome de cargo em OUTRA área é outro cargo, com outro id", () => {
    const r = cargoParaCriar("Auxiliar", "montagem-interna", CARGOS, AREAS);
    expect(r).toEqual({ nova: { id: "auxiliar-montagem-interna", nome: "Auxiliar", areaId: "montagem-interna", faixas: [0, 0, 0, 0, 0] } });
  });
});

describe("criar", () => {
  it("área nova entra no fim da ordem, com id pelo nome", () => {
    expect(areaParaCriar("Serralheria", AREAS)).toEqual({ nova: { id: "serralheria", nome: "Serralheria", descricao: "", ordem: 4 } });
  });

  it("O CASO RUIM: o nome curto da área que já existe com nome longo NÃO cria outra", () => {
    // "Produção" dá o id "producao", que é o da "Produção e Comunicação Visual".
    const base: Area[] = [{ id: "producao", nome: "Produção e Comunicação Visual", ordem: 0 }];
    const r = areaParaCriar("Produção", base);
    expect(r).toEqual({ erro: 'Já existe a área "Produção e Comunicação Visual". Se é ela, escolha na lista; se é outra, use um nome mais completo.' });
  });

  it("cargo sem área escolhida é recusado com o motivo", () => {
    expect(cargoParaCriar("Soldador", "", CARGOS, AREAS)).toEqual({ erro: "Escolha a área primeiro: o cargo fica dentro de uma área." });
  });

  it("cargo numa área que foi apagada em outra aba é recusado (não nasce órfão)", () => {
    expect(cargoParaCriar("Soldador", "area-apagada", CARGOS, AREAS)).toEqual({ erro: "A área escolhida não existe mais. Escolha outra na lista." });
  });

  it("nome vazio é recusado", () => {
    expect("erro" in areaParaCriar("   ", AREAS)).toBe(true);
    expect("erro" in cargoParaCriar("", "producao", CARGOS, AREAS)).toBe(true);
  });
});

describe("cargo recém-criado não pinta ninguém de 'Acima'", () => {
  it("faixa toda zerada é 'Sem dados', não 'Acima'", () => {
    expect(enquadrar(2500, [0, 0, 0, 0, 0])).toBe("Sem dados");
  });
  it("faixa de verdade continua funcionando", () => {
    expect(enquadrar(1750, [1621, 1700, 1800, 1900, 2000])).toBe("Dentro");
    expect(enquadrar(2500, [1621, 1700, 1800, 1900, 2000])).toBe("Acima");
  });
});

describe("a régua de Cargos não contradiz o rótulo", () => {
  it("faixa toda zerada não desenha bolinha 'fora da faixa' com rótulo 'Sem dados'", () => {
    expect(posicaoNaFaixa(2500, [0, 0, 0, 0, 0])).toBeNull();
  });
});
