/* A CONTA APONTADA AO SÓCIO, DOS DOIS LADOS DA PAREDE.
 *
 * A pergunta "esta conta é do sócio?" é respondida na tela
 * (src/lib/custos.ts) e nas duas portas do servidor (`sync` e
 * `mubi-pagamentos`). Elas precisam responder IGUAL: enquanto a porta do ERP
 * não perguntava, a rota do plano escondia a conta 2.11.2.2 e a rota da folha
 * devolvia os títulos dela — com nome e valor — para qualquer ADMIN_RH.
 *
 * O arquivo do servidor é Deno e não roda no vitest; o `_shared` roda, e é ele
 * que as duas funções importam. Aqui as duas réguas são exercitadas com a
 * MESMA entrada, e o teste falha se elas divergirem.
 */
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  chaveContaSocio as chaveServidor,
  contaApontadaAoSocio,
  lerVinculosSocioConta,
  NAO_E_DE_SOCIO as NENHUM_SERVIDOR,
} from "../../supabase/functions/_shared/socioConta";
import { chaveContaSocio, contaEhConfidencial, NAO_E_DE_SOCIO } from "./custos";

/* O caso real de julho/2026: o contador tirou a retirada do Leonardo de
   2.14.2.2 e a pôs em 2.11.2.2; o dono apontou a conta ao card à mão. */
const VINCULOS = {
  [chaveContaSocio("2.11.2.2", "Retiradas Leonardo")]: "leonardo",
  [chaveContaSocio("2.3.1", "Aluguel")]: NAO_E_DE_SOCIO,
  "2.12.9": "pedro", // formato antigo, só código — existe em produção
};

describe("a régua do apontamento é a mesma na tela e no servidor", () => {
  const casos: { codigo: string; nome: string; equivaleA?: string; esperado: boolean; porque: string }[] = [
    { codigo: "2.11.2.2", nome: "Retiradas Leonardo", esperado: true, porque: "apontada pelo dono" },
    { codigo: "2.11.2.2", nome: "RETIRADAS  LEONARDO", esperado: true, porque: "o nome vem normalizado" },
    { codigo: "2.11.2.2", nome: "Munk", esperado: false, porque: "mesmo número, outra conta" },
    { codigo: "2.3.1", nome: "Aluguel", esperado: false, porque: '"nenhum" é o dono dizendo que não é de sócio' },
    { codigo: "2.12.9", nome: "qualquer", esperado: true, porque: "chave antiga, só código" },
    { codigo: "2.9.9", nome: "Água", esperado: false, porque: "conta comum" },
    { codigo: "2.7.7", nome: "Retiradas Leonardo", equivaleA: "2.11.2.2", esperado: true, porque: "apontada na numeração antiga" },
  ];

  for (const c of casos) {
    it(`${c.codigo}-${c.nome}: ${c.porque}`, () => {
      const naTela = contaEhConfidencial({ codigo: c.codigo, nome: c.nome, equivaleA: c.equivaleA }, VINCULOS);
      const noServidor = contaApontadaAoSocio({ codigo: c.codigo, nome: c.nome, equivaleA: c.equivaleA }, VINCULOS);
      expect(noServidor).toBe(c.esperado);
      expect(naTela).toBe(c.esperado);
    });
  }

  /* "nenhum" é o dono OLHANDO e dizendo que não é de sócio. Um apontamento
     velho, só pelo código, não pode desfazer isso — foi o que o `??` da porta
     de dados já fazia, e a régua compartilhada tinha de manter. */
  it("o 'nenhum' específico vence o apontamento antigo só pelo código", () => {
    const v = { "2.12.9": "pedro", [chaveContaSocio("2.12.9", "Aluguel do galpão")]: NAO_E_DE_SOCIO };
    expect(contaApontadaAoSocio({ codigo: "2.12.9", nome: "Aluguel do galpão" }, v)).toBe(false);
    expect(contaEhConfidencial({ codigo: "2.12.9", nome: "Aluguel do galpão" }, v)).toBe(false);
    // E a mesma conta com outro nome continua valendo pela chave antiga.
    expect(contaApontadaAoSocio({ codigo: "2.12.9", nome: "Retirada Pedro" }, v)).toBe(true);
  });

  it("as duas montam a mesma chave", () => {
    expect(chaveServidor("2.11.2.2", "Retiradas  Leonárdo")).toBe(chaveContaSocio("2.11.2.2", "Retiradas  Leonárdo"));
    expect(NENHUM_SERVIDOR).toBe(NAO_E_DE_SOCIO);
  });
});

describe("ler o mapa do config global", () => {
  const cliente = (resposta: unknown) => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => resposta }) }) }),
  });

  it("devolve o mapa quando o config tem", async () => {
    const r = await lerVinculosSocioConta(cliente({ data: { config: { vinculosSocioConta: { "2.1|x": "leo" } } }, error: null }));
    expect(r).toEqual({ vinculos: { "2.1|x": "leo" }, falhou: false });
  });

  it("config sem o mapa não é falha — é mapa vazio", async () => {
    expect(await lerVinculosSocioConta(cliente({ data: { config: {} }, error: null }))).toEqual({ vinculos: {}, falhou: false });
  });

  /* ZERO NÃO É RESULTADO: erro de leitura tem de ser DISTINGUÍVEL de "não há
     apontamento nenhum". Sem isso, a porta do ERP serviria a retirada do sócio
     achando que o mapa estava vazio. */
  it("erro de leitura volta marcado como falha, não como mapa vazio", async () => {
    const r = await lerVinculosSocioConta(cliente({ data: null, error: { message: "timeout" } }));
    expect(r).toEqual({ vinculos: {}, falhou: true });
  });
});

describe("a porta do ERP recusa quando não consegue ler os vínculos", () => {
  const fonte = fs.readFileSync(
    path.join(__dirname, "../../supabase/functions/mubi-pagamentos/index.ts"),
    "utf8",
  );

  it("as duas rotas consultam o apontamento antes de responder", () => {
    // A leitura acontece ANTES do `if (escopo === "plano")`: as duas rotas
    // usam o mesmo mapa. Foi a assimetria — plano cortava, folha não — que
    // deixou a retirada sair.
    const ondeLe = fonte.indexOf("lerVinculosSocioConta(admin)");
    const ondeAbreOPlano = fonte.indexOf('if (escopo === "plano")');
    expect(ondeLe).toBeGreaterThan(0);
    expect(ondeLe).toBeLessThan(ondeAbreOPlano);
    // E a rota da folha pergunta nas duas decisões que ela toma.
    expect(fonte.match(/ehDeSocio\(/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });

  it("falha de leitura interrompe o pedido em vez de servir sem o mapa", () => {
    expect(fonte).toContain("if (socio.falhou) throw new Error(");
  });
});
