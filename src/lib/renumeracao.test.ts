import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { codigoDeReferencia, desserializar, ehConfidencialEquivalente, equivalenciasDeContas, normalizarNome, paiDe, serializar } from "./renumeracao";

// A referência (numeração do contador até junho) e a de hoje (o que o ERP
// manda desde julho) — a mesma forma do que aconteceu de verdade, em miniatura.
const REF = [
  { codigo: "2.1", nome: "Despesas de Pessoal" },
  { codigo: "2.1.9", nome: "FGTS" },
  { codigo: "2.1.9.1", nome: "Regular" },
  { codigo: "2.1.14", nome: "Alimentação" },
  { codigo: "2.1.18", nome: "Minas Brasil" },
  { codigo: "2.2", nome: "Tributos" },
  { codigo: "2.2.2", nome: "Contribuição Sindical" },
  { codigo: "2.2.3", nome: "CDL" },
  { codigo: "2.10", nome: "Viagens" },
  { codigo: "2.10.1", nome: "Despesas de Viagem" },
  { codigo: "2.10.1.1", nome: "Hotel" },
  { codigo: "2.10.1.2", nome: "Alimentação" },
  { codigo: "2.12.2.6", nome: "Chapas" },
  { codigo: "2.12.2.6.1", nome: "Poliester" },
  { codigo: "2.12.2.6.2", nome: "Kynnar" },
  { codigo: "2.13.6", nome: "Empréstimos" },
  { codigo: "2.13.6.1", nome: "Leonardo" },
  { codigo: "2.13.6.2", nome: "LGP" },
  { codigo: "2.13.6.3", nome: "Impresilk" },
  { codigo: "2.14", nome: "Despesas Societárias" },
  { codigo: "2.14.2", nome: "Retiradas" },
  { codigo: "2.14.2.1", nome: "Contas pagas" },
  { codigo: "2.14.2.2", nome: "Leonardo" },
  { codigo: "2.14.2.3", nome: "Combustível" },
];
const HOJE = [
  { codigo: "2.1.9.1", nome: "Regular" }, // não renumerou
  { codigo: "2.1.14", nome: "Contribuição Sindical" }, // mesmo código, outro nome
  { codigo: "2.1.15.1", nome: "Minas Brasil" }, // nome único, código novo
  { codigo: "2.2.2", nome: "CDL" }, // mesmo código, outro nome
  { codigo: "2.9.2.6.1", nome: "Poliester" }, // grupo inteiro deslocado
  { codigo: "2.9.2.6.2", nome: "Kynnar" },
  { codigo: "2.13.5.1", nome: "Leonardo" }, // "Leonardo" ambíguo: irmãos decidem
  { codigo: "2.13.5.2", nome: "LGP" },
  { codigo: "2.13.5.3", nome: "Impresilk" },
  { codigo: "2.11.2.1", nome: "Contas pagas" },
  { codigo: "2.11.2.2", nome: "Leonardo" }, // as retiradas, agora fora de 2.14
  { codigo: "2.11.2.3", nome: "Combustível" },
  { codigo: "2.8.1.2", nome: "Alimentação" }, // ambíguo e sem irmãos: fica sem par
  { codigo: "2.99", nome: "Conta Nova" }, // não existia
];

describe("equivalenciasDeContas", () => {
  const eq = equivalenciasDeContas(REF, HOJE);
  const m = eq.mapa;

  it("mesmo código com o mesmo nome é identidade", () => {
    expect(m.get("2.1.9.1")).toBe("2.1.9.1");
    expect(eq.itens.find((i) => i.novo === "2.1.9.1")?.como).toBe("identidade");
  });

  it("mesmo código com OUTRO nome não é a mesma conta: casa pelo nome", () => {
    expect(m.get("2.1.14")).toBe("2.2.2"); // Contribuição Sindical
    expect(m.get("2.2.2")).toBe("2.2.3"); // CDL
  });

  it("grupo deslocado casa filho a filho e o pai pelos filhos", () => {
    expect(m.get("2.9.2.6.1")).toBe("2.12.2.6.1");
    expect(m.get("2.9.2.6.2")).toBe("2.12.2.6.2");
    expect(m.get("2.9.2.6")).toBe("2.12.2.6");
    expect(eq.itens.find((i) => i.novo === "2.9.2.6")?.como).toBe("pai-pelos-filhos");
  });

  it("nome ambíguo é decidido pelos irmãos — os dois Leonardos vão cada um para o seu", () => {
    expect(m.get("2.13.5.1")).toBe("2.13.6.1"); // empréstimos
    expect(m.get("2.11.2.2")).toBe("2.14.2.2"); // retiradas
    expect(m.get("2.11.2")).toBe("2.14.2");
  });

  it("nome único em toda a referência casa mesmo sem irmãos", () => {
    expect(m.get("2.1.15.1")).toBe("2.1.18"); // Minas Brasil
  });

  it("nome ambíguo sem grupo e conta nova ficam SEM PAR, e isso é dito", () => {
    expect(eq.semPar.map((s) => s.codigo).sort()).toEqual(["2.8.1.2", "2.99"]);
  });

  it("um único nome em comum não casa um grupo quando o nome é repetido no plano", () => {
    // "Alimentação" existe em 2.1.14 e 2.10.1.2: um grupo novo só com ela não pode escolher.
    const r = equivalenciasDeContas(REF, [{ codigo: "2.8.1.2", nome: "Alimentação" }, { codigo: "2.8.1.9", nome: "Coisa Nova" }]);
    expect(r.mapa.has("2.8.1.2")).toBe(false);
  });

  it("referência vazia não inventa equivalência", () => {
    const r = equivalenciasDeContas([], HOJE);
    expect(r.referenciaVazia).toBe(true);
    expect(r.mapa.size).toBe(0);
    expect(r.semPar).toHaveLength(HOJE.length);
  });

  it("é determinística", () => {
    const a = equivalenciasDeContas(REF, HOJE);
    const b = equivalenciasDeContas(REF, [...HOJE].reverse());
    expect([...a.mapa.entries()].sort()).toEqual([...b.mapa.entries()].sort());
  });
});

describe("confidencial em qualquer numeração", () => {
  const eq = equivalenciasDeContas(REF, HOJE, { prefixosConfidenciais: ["2.14"] });
  it("a retirada renumerada para 2.11.2.2 continua confidencial", () => {
    expect(ehConfidencialEquivalente({ codigo: "2.11.2.2", nome: "Leonardo" }, ["2.14"], eq)).toBe(true);
    expect(ehConfidencialEquivalente({ codigo: "2.11.2", nome: "Retiradas" }, ["2.14"], eq)).toBe(true);
  });
  it("o empréstimo do Leonardo NÃO vira confidencial por ter o mesmo nome — os irmãos o identificam", () => {
    expect(ehConfidencialEquivalente({ codigo: "2.13.5.1", nome: "Leonardo" }, ["2.14"], eq)).toBe(false);
  });
  it("o caso real: 'Leonardo' sozinho no grupo, sem par — esconde pelo nome", () => {
    const so = equivalenciasDeContas(REF, [{ codigo: "2.11.2.2", nome: "Leonardo" }], { prefixosConfidenciais: ["2.14"] });
    expect(so.mapa.has("2.11.2.2")).toBe(false);
    expect(ehConfidencialEquivalente({ codigo: "2.11.2.2", nome: "Leonardo" }, ["2.14"], so)).toBe(true);
    // e um nome sem par que NÃO é de sócio continua comum
    expect(ehConfidencialEquivalente({ codigo: "2.99", nome: "Conta Nova" }, ["2.14"], so)).toBe(false);
  });
  it("sem equivalência, vale o prefixo literal", () => {
    expect(ehConfidencialEquivalente({ codigo: "2.14.1.2", nome: "x" }, ["2.14"], null)).toBe(true);
    expect(codigoDeReferencia("2.11.2.2", null)).toBe("2.11.2.2");
    expect(codigoDeReferencia("2.11.2.2", eq.mapa)).toBe("2.14.2.2");
  });
  it("vai e volta pela rede sem perder nada", () => {
    const volta = desserializar(serializar({ ...eq, referencia: "2026-06" }))!;
    expect([...volta.mapa.entries()].sort()).toEqual([...eq.mapa.entries()].sort());
    expect([...volta.nomesConfidenciais].sort()).toEqual([...eq.nomesConfidenciais].sort());
    expect(volta.referencia).toBe("2026-06");
    expect(desserializar(null)).toBeNull();
  });
});

describe("utilitários", () => {
  it("normaliza acento, caixa e pontuação", () => {
    expect(normalizarNome("  Contribuição   SINDICAL! ")).toBe("contribuicao sindical");
  });
  it("pai de um código", () => {
    expect(paiDe("2.1.9.1")).toBe("2.1.9");
    expect(paiDe("2")).toBe("");
  });
});

describe("a cópia da Edge Function é idêntica", () => {
  it("supabase/functions/_shared/renumeracao.ts == src/lib/renumeracao.ts", () => {
    const raiz = path.resolve(__dirname, "../..");
    const a = fs.readFileSync(path.join(raiz, "src/lib/renumeracao.ts"), "utf8");
    const b = fs.readFileSync(path.join(raiz, "supabase/functions/_shared/renumeracao.ts"), "utf8");
    expect(b).toBe(a);
  });
});
