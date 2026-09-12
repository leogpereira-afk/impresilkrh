// ============================================================================
// O ID ANDA COM O NOME — verificador do padrão.
//
// Ordem do Leonardo (07/09/2026): "vamos vincular tudo ao id" · "nas
// conferências" · "do de donos e sócios também" · "jogar id a todo o sistema
// em todas as esferas".
//
// A regra já estava escrita em lib/identidade desde 17/08 ("quem mostra a
// pessoa na tela mostra o ID ao lado do nome") e metade das telas não seguia.
// Regra que só existe em comentário volta a ser quebrada no mês seguinte; por
// isso ela vira ESTE script, que roda com o resto da verificação.
//
// POR QUE IMPORTA. O nome não distingue: há três fichas "José Adilando
// Pereira" e três "Dermeval Vieira" no cadastro. Numa tela de conferência —
// onde se decide o que corrigir, o que apagar e a quem vincular — escolher pelo
// nome é escolher no escuro, e o erro é silencioso: o dinheiro sai da ficha
// certa e entra na errada.
//
//   node scripts/conferir-id-nas-conferencias.mjs
//
// Sai com código 1 quando acha tela de conferência mostrando nome sem ID.
// ============================================================================
import fs from "node:fs/promises";
import path from "node:path";

const RAIZ = path.resolve(import.meta.dirname, "..", "src");

/**
 * As telas onde a pessoa é ESCOLHIDA, não apenas exibida.
 *
 * Não é toda tela do sistema: numa lista de aniversariantes o nome basta e o ID
 * seria ruído. A régua é "aqui se decide algo sobre a pessoa certa".
 */
const CONFERENCIAS = [
  "components/programacao/programacao.tsx",
  "pages/Performance.tsx",
  "components/plantoes/plantoes.tsx",
  "components/performance/entrega-modal.tsx",
  "components/custos/auditoria-lancamentos.tsx",
  "components/custos/previa-folha.tsx",
  "components/custos/conferencia-tipos.tsx",
  "components/custos/societarias.tsx",
  "components/colaboradores/cadastros.tsx",
];

/** Uma tela está no padrão se usa o selo <Pessoa> ou monta o ID à mão. */
const NO_PADRAO = [/<Pessoa\b/, /idPessoa\s*\(/];

const problemas = [];
const ok = [];

for (const rel of CONFERENCIAS) {
  const arq = path.join(RAIZ, rel);
  let txt;
  try {
    txt = await fs.readFile(arq, "utf8");
  } catch {
    // Arquivo que sumiu não é aprovação silenciosa: é achado.
    problemas.push(`${rel} — não existe mais. Se a tela mudou de lugar, atualize esta lista.`);
    continue;
  }
  if (NO_PADRAO.some((r) => r.test(txt))) { ok.push(rel); continue; }
  problemas.push(`${rel} — mostra pessoa sem o ID ao lado. Use <Pessoa nome={…} cpf={…} /> de components/ui/pessoa.`);
}

// O selo tem de existir de verdade — a lista acima passaria feliz se alguém
// apagasse o componente e deixasse os imports quebrados.
try {
  await fs.access(path.join(RAIZ, "components/ui/pessoa.tsx"));
} catch {
  problemas.push("components/ui/pessoa.tsx — o selo do padrão não existe.");
}

console.log(`ID nas conferências: ${ok.length} no padrão, ${problemas.length} fora.`);
for (const p of ok) console.log(`  ok   ${p}`);
for (const p of problemas) console.log(`  FORA ${p}`);

if (problemas.length) {
  console.log("\nO nome não distingue: há três fichas \"José Adilando Pereira\" no cadastro.");
  console.log("Numa tela de conferência, escolher pelo nome é escolher no escuro.");
  process.exit(1);
}
