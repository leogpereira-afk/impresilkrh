/* O FILTRO DA FOLHA MORA NO SERVIDOR — e este teste o lê de lá.
 *
 * `ehFolha` vive em supabase/functions/mubi-pagamentos/index.ts (Deno), fora do
 * alcance do vitest. Mas ele é a porta por onde o dinheiro da faxina entra ou
 * não entra na ficha de alguém, e já falhou duas vezes por isso: em 01/08 a
 * faxina não chegava porque o filtro era só "2.1."; em 07/09 ela sumiu de novo
 * quando o contador renumerou o plano.
 *
 * Então o teste extrai a regra do arquivo do servidor e a exercita com as
 * contas REAIS que o Léo achou no Mubisys em 07/09/2026:
 *
 *   2.1.14.3-Limpeza            (despesa "Despesa faxina")
 *   2.2.1.2.1-Limpeza Escritório (despesa "Limpeza escritorio")
 *
 * A primeira entra pelo código (2.1.), a segunda SÓ pelo nome — o grupo dela
 * mudou de 2.3 para 2.2 e nenhuma lista de código a alcança.
 *
 * Começa pelo caso ruim: deixar entrar fornecedor como se fosse gente.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { equivalenciasDeContas, ehConfidencialEquivalente } from "./renumeracao";

const fonte = fs.readFileSync(
  path.join(process.cwd(), "supabase/functions/mubi-pagamentos/index.ts"),
  "utf8",
);

/** A lista de exceções de folha, lida do arquivo do servidor. */
function foraDo21(): string[] {
  const m = fonte.match(/const FOLHA_FORA_DO_21 = \[(.*?)\];/s);
  if (!m) throw new Error("FOLHA_FORA_DO_21 mudou de forma — reveja este teste.");
  return m[1].split(",").map((x) => x.trim().replace(/^"|"$/g, "")).filter(Boolean);
}

/** Recria a decisão do servidor a partir das constantes do próprio arquivo. */
function ehFolhaDoServidor(plano: string): boolean {
  const mNome = fonte.match(/const NOME_DE_FOLHA = (\/.*\/);/);
  const mFora = fonte.match(/const FOLHA_FORA_DO_21 = \[(.*?)\];/s);
  if (!mNome || !mFora) throw new Error("As constantes do filtro mudaram de forma — reveja este teste.");
  const NOME_DE_FOLHA = new RegExp(mNome[1].slice(1, -1));
  const FOLHA_FORA_DO_21 = mFora[1].split(",").map((s) => s.trim().replace(/^"|"$/g, "")).filter(Boolean);

  const normalizar = (s: string) =>
    s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const c = String(plano || "").trim().split("-")[0].trim();
  if (c.startsWith("2.1.") || FOLHA_FORA_DO_21.some((p) => c === p || c.startsWith(p + "."))) return true;
  if (c === "2.14" || c.startsWith("2.14.")) return false;
  const nome = normalizar(String(plano || "").split("-").slice(1).join("-"));
  return !!nome && NOME_DE_FOLHA.test(nome);
}

describe("o caso ruim: fornecedor não pode entrar como gente", () => {
  it("as irmãs da limpeza que são EMPRESA de resíduo ficam de fora", () => {
    expect(ehFolhaDoServidor("2.3.2.3-Caçamba")).toBe(false);
    expect(ehFolhaDoServidor("2.3.2.4-Serquip")).toBe(false);
  });

  it("societária nunca entra, nem com nome de gente", () => {
    expect(ehFolhaDoServidor("2.14.2.2-Leonardo")).toBe(false);
    expect(ehFolhaDoServidor("2.14-Despesas Societárias")).toBe(false);
  });

  it("despesa comum da casa fica de fora", () => {
    expect(ehFolhaDoServidor("2.6.1-Energia Elétrica")).toBe(false);
    expect(ehFolhaDoServidor("2.2.1-Aluguel")).toBe(false);
  });
});

describe("as contas de limpeza que o Léo achou no ERP (07/09/2026)", () => {
  it("2.1.14.3-Limpeza entra — o código já é do grupo da folha", () => {
    expect(ehFolhaDoServidor("2.1.14.3-Limpeza")).toBe(true);
  });

  it("2.2.1.2.1-Limpeza Escritório entra pelo NOME, que é o único caminho", () => {
    // Grupo 2.2 não é folha e não está em nenhuma lista de código. Se a regra
    // por nome cair, esta conta some da folha em silêncio — de novo.
    expect(ehFolhaDoServidor("2.2.1.2.1-Limpeza Escritório")).toBe(true);
  });

  it("a conta velha continua entrando — o antigo não pode quebrar", () => {
    expect(ehFolhaDoServidor("2.3.2.1-Limpeza Escritório")).toBe(true);
    expect(ehFolhaDoServidor("2.3.2.2-Limpeza Produção")).toBe(true);
    expect(ehFolhaDoServidor("2.11.1-Freelancer")).toBe(true);
  });
});

/* O TEXTO DA DESPESA NÃO PODE SER JOGADO FORA (08/09/2026).
 *
 * O Léo corrigiu no ERP: pôs "Curso Marcella Laiara Rocha Farias" no campo que
 * o Mubisys chama de "Despesa". A Edge Function montava a descrição com
 * `String(i.descricao ?? i.despesa ?? "")` — e o `??` só cai para `despesa`
 * quando `descricao` é null/undefined. String VAZIA passa direto, e o texto da
 * despesa ia embora com o nome dentro. A correção dele seria anulada aqui.
 *
 * Achado da auditoria adversarial (index.ts:501). O teste extrai a expressão do
 * arquivo do servidor e a exercita — é Deno, fora do alcance do vitest.
 */
describe("a descrição que sai da Edge Function", () => {
  const montarDescricao = (i: { descricao?: unknown; despesa?: unknown }) => {
    const m = fonte.match(/descricao: (\[\.\.\.new Set\(\[i\.descricao, i\.despesa\][^\n]*?)\,\n/);
    if (!m) throw new Error("A montagem da descrição mudou de forma — reveja este teste.");
    return new Function("i", `return ${m[1]};`)(i) as string;
  };

  it("O CASO RUIM: descrição vazia não pode engolir a despesa", () => {
    expect(montarDescricao({ descricao: "", despesa: "Curso Marcella Laiara Rocha Farias" }))
      .toBe("Curso Marcella Laiara Rocha Farias");
    expect(montarDescricao({ descricao: "   ", despesa: "Despesa faxina" })).toBe("Despesa faxina");
  });

  it("os dois preenchidos: nada se perde", () => {
    // O nome pode estar em qualquer um dos dois — descartar um é apostar.
    expect(montarDescricao({ descricao: "Pix", despesa: "Curso Marcella Laiara Rocha Farias" }))
      .toBe("Pix — Curso Marcella Laiara Rocha Farias");
  });

  it("iguais não viram texto repetido", () => {
    expect(montarDescricao({ descricao: "FGTS", despesa: "FGTS" })).toBe("FGTS");
  });

  it("os dois vazios viram string vazia, não 'undefined'", () => {
    expect(montarDescricao({})).toBe("");
    expect(montarDescricao({ descricao: null, despesa: undefined })).toBe("");
  });
});

/* O CORTE SOCIETÁRIO TEM DE VALER NAS DUAS NUMERAÇÕES (08/09/2026).
 *
 * `ehFolha` diz "nunca" para 2.14 (retirada de sócio, arrendamento) e devolve
 * false. `ehFolhaOuEquivalente` então assumia e podia dizer "sim": basta uma
 * conta 2.14 de hoje traduzir para uma conta 2.1.x do plano antigo — que é
 * exatamente o que a renumeração de julho faz o tempo todo — para a retirada
 * do sócio entrar na folha que o RH lê.
 *
 * A tela de Custos é de ADMIN_RH e só o master vê societária; cortar na porta
 * de dados é o único lugar que segura isso. Achado da auditoria adversarial.
 *
 * O teste reconstrói a decisão a partir do arquivo do servidor (é Deno) e usa
 * a MESMA `equivalenciasDeContas` que ele usa, importada da cópia do cliente —
 * um teste já garante que as duas cópias não divergem.
 */
describe("societária não entra na folha nem traduzida", () => {
  const equivale = (referencia: { codigo: string; nome: string }[], atual: { codigo: string; nome: string }[]) =>
    equivalenciasDeContas(referencia, atual, { prefixosConfidenciais: ["2.14"] });

  /**
   * A decisão SAI DO ARQUIVO DO SERVIDOR, não é reescrita aqui.
   *
   * Na primeira versão eu reimplementei a lógica dentro do teste — e o controle
   * mostrou o defeito: apagando as guardas do servidor, o teste continuava
   * verde. Um controle que compara a coisa com ela mesma não detecta nada.
   */
  const construirDecisor = (eq: ReturnType<typeof equivale>) => {
    const m = fonte.match(/const ehFolhaOuEquivalente = \(plano: string\) => \{[\s\S]*?\n    \};/);
    if (!m) throw new Error("ehFolhaOuEquivalente mudou de forma — reveja este teste.");
    const bloco = m[0].replace(/: string/g, "");
    const fabricar = new Function(
      "codigoDoPlano", "ehConfidencialEquivalente", "eqFolha", "ehFolha", "codigoDeReferencia", "FOLHA_FORA_DO_21",
      bloco + "\nreturn ehFolhaOuEquivalente;",
    );
    return fabricar(
      (plano: string) => String(plano || "").trim().split("-")[0].trim(),
      ehConfidencialEquivalente,
      eq,
      ehFolhaDoServidor,
      (codigo: string, mapa?: Map<string, string> | null) => (mapa && mapa.get(codigo)) || codigo,
      foraDo21(),
    ) as (plano: string) => boolean;
  };
  const decidir = (plano: string, eq: ReturnType<typeof equivale>) => construirDecisor(eq)(plano);

  it("O CASO RUIM: conta 2.14 que traduz para uma conta de folha continua fora", () => {
    // O contador renumerou e hoje "Vale Transporte" está sob 2.14.9. A
    // equivalência acha o par 2.1.5 e diria "é folha" — mas 2.14 é societária
    // em qualquer numeração.
    const eq = equivale([{ codigo: "2.1.5", nome: "Vale Transporte" }], [{ codigo: "2.14.9", nome: "Vale Transporte" }]);
    expect(eq.mapa.get("2.14.9")).toBe("2.1.5"); // a equivalência REALMENTE casa
    expect(decidir("2.14.9-Vale Transporte", eq)).toBe(false); // e mesmo assim não entra
  });

  it("conta nova que traduz para 2.14 também fica fora", () => {
    // O caminho de verdade da renumeração: retiradas saíram de 2.14.2.2 para
    // 2.11.2.2. O código novo não é 2.14, mas o significado é o mesmo.
    const eq = equivale(
      [{ codigo: "2.14.2.2", nome: "Leonardo" }, { codigo: "2.14.2.1", nome: "Pedro" }],
      [{ codigo: "2.11.2.2", nome: "Leonardo" }, { codigo: "2.11.2.1", nome: "Pedro" }],
    );
    expect(decidir("2.11.2.2-Leonardo", eq)).toBe(false);
  });

  it("sem par, o NOME que vive sob 2.14 na referência ainda esconde", () => {
    // "Leonardo" sozinho, sem irmãos que o identifiquem: não casa por grupo.
    // A rede é o nome — na dúvida, esconde.
    const eq = equivale([{ codigo: "2.14.2.2", nome: "Leonardo" }], [{ codigo: "2.9.9.9", nome: "Leonardo" }]);
    expect(decidir("2.9.9.9-Leonardo", eq)).toBe(false);
  });

  it("a equivalência da FOLHA é construída com o prefixo confidencial", () => {
    /* Asserção de FONTE, e digo isso na cara: os testes acima constroem a
       equivalência eles mesmos, então nenhum deles alcança a chamada que o
       servidor faz. Sem `prefixosConfidenciais`, `nomesConfidenciais` sai vazio
       NESTA rota e a rede pelo nome — a que pegou "Leonardo" sozinho em
       2.11.2.2 — simplesmente não existe para a folha. Fraco é melhor que nada
       quando o alvo é uma linha que some sem barulho. */
    const m = fonte.match(/const eqFolha = equivalenciasDeContas\([^;]*\);/);
    expect(m?.[0]).toContain('prefixosConfidenciais: ["2.14"]');
  });

  it("o que É folha continua entrando — a guarda não pode fechar demais", () => {
    const eq = equivale([{ codigo: "2.3.2.1", nome: "Limpeza Escritório" }], [{ codigo: "2.2.1.2.1", nome: "Limpeza Escritório" }]);
    expect(decidir("2.2.1.2.1-Limpeza Escritório", eq)).toBe(true);
    expect(decidir("2.1.1-Salário", eq)).toBe(true);
    expect(decidir("2.1.16.2-Cursos", eq)).toBe(true);
  });
});

/* O NÚMERO EM FORMATO BRASILEIRO VIRAVA ZERO CALADO (08/09/2026). */
describe("num() do servidor entende o formato brasileiro", () => {
  const num = (v: unknown) => {
    const m = fonte.match(/const num = \(v: unknown\) => \{([\s\S]*?)\n\};/);
    if (!m) throw new Error("A função num mudou de forma — reveja este teste.");
    return new Function("v", m[1].replace(/: unknown|: number/g, "") + "\n")(v) as number;
  };

  it("O CASO RUIM: ponto de milhar com vírgula decimal não pode virar zero", () => {
    // Zero não dispara alarme: o título entra valendo nada e ainda some da
    // lista de "contas fora da folha", que descarta total 0.
    expect(num("5.515,62")).toBeCloseTo(5515.62, 2);
    expect(num("1.234.567,89")).toBeCloseTo(1234567.89, 2);
    expect(num("R$ 5.330,85")).toBeCloseTo(5330.85, 2);
  });

  it("o formato que o ERP manda hoje continua igual", () => {
    expect(num("955.76")).toBeCloseTo(955.76, 2);
    expect(num(955.76)).toBeCloseTo(955.76, 2);
    expect(num("1.234")).toBeCloseTo(1.234, 3); // NÃO vira 1234: adivinhar milhar seria pior
    expect(num("300")).toBe(300);
  });

  it("vírgula sozinha é decimal; lixo continua zero", () => {
    expect(num("955,76")).toBeCloseTo(955.76, 2);
    expect(num("")).toBe(0);
    expect(num(null)).toBe(0);
    expect(num("abc")).toBe(0);
  });
});
