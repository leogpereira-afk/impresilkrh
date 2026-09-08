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

const fonte = fs.readFileSync(
  path.join(process.cwd(), "supabase/functions/mubi-pagamentos/index.ts"),
  "utf8",
);

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
