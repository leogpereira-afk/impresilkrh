// Custo da EMPRESA × custo da PESSOA, na hora de importar a folha do ERP.
//
// Pedido do Léo (07/09/2026), olhando a lista de "não encontrados": "aqui nessa
// parte está de funcionário individual e custo global, e puxou em custo
// individual — favor corrigir e criar regra".
//
// O que estava acontecendo: a guia de FGTS da folha inteira (R$ 5.515,62) e um
// DARF caíam na lista que pede "vincular este título a...". Não há a quem
// vincular — é imposto da empresa. Vincular a uma pessoa jogaria o encargo do
// mês inteiro no custo dela.
//
// A regra que já existia era estreita demais: `/^(FGTS|INSS)$/` sobre a ORIGEM
// do título. Só pegava quando o ERP escrevia exatamente "FGTS" no campo de
// origem — não pegava "DARF", nem guia com origem em branco e descrição "FGTS".
//
// A RÉGUA, tirada dos dados reais (07/09/2026): os 9 FGTS individuais que estão
// no banco TODOS carregam nome de pessoa no texto — "FGTS OSMANE", "ftgts
// Camila", "emanuelle", "FGTS RECISÃO OSMANE". Os coletivos não carregam nada
// além do nome do próprio documento.
//
//   É da empresa quando o texto tem palavra de DOCUMENTO DE RECOLHIMENTO e não
//   sobra nada que possa ser nome de gente.
//
// O que a regra deliberadamente NÃO faz:
//
//   - não usa o VALOR. Tentador (a guia é 10× o encargo individual), mas o FGTS
//     de rescisão do Osmane foi R$ 3.262,03 e é de uma pessoa só. Valor grande
//     não prova coletivo.
//   - não trata "Adiantamento de dias trabalhados de novo colaborador" como
//     coletivo. Aquilo É de alguém — só falta o nome, e o RH tem de vincular.
//     Mandar para o rateio esconderia um pagamento individual no custo geral.

/** Palavras que nomeiam um documento de recolhimento — nunca uma pessoa. */
const DOCUMENTOS = new Set([
  "fgts", "inss", "darf", "dae", "das", "gps", "grf", "grrf", "gfip", "sefip",
  "esocial", "irrf", "pis", "cofins", "csll", "sindical", "contribuicao",
  "contribuicoes", "previdencia", "previdenciaria", "guia", "guias",
  "recolhimento", "recolhimentos", "fap", "rat",
]);

/**
 * Palavras que não distinguem ninguém: aparecem tanto no documento coletivo
 * quanto no individual. Sozinhas, não fazem um título ser de pessoa.
 */
const NEUTRAS = new Set([
  "rescisao", "recisao", "rescisoes", "regular", "emprestimo", "parcela",
  "referente", "ref", "competencia", "comp", "mensal", "mes", "folha",
  "pagamento", "pgto", "empresa", "patronal", "imposto", "tributo", "taxa",
  "de", "do", "da", "dos", "das", "e", "a", "o", "em", "para", "por", "no", "na",
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto",
  "setembro", "outubro", "novembro", "dezembro",
]);

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * O texto útil do título: origem + descrição, sem o sufixo do plano de contas.
 *
 * O ERP cola o plano no fim da descrição ("FGTS RESCISÃO · 2.1.9.1-Regular").
 * Esse pedaço é classificação contábil, não nome de gente — se ficasse, todo
 * título teria "sobra" e nada seria coletivo.
 */
export function textoUtil(nome: string | null | undefined, descricao: string | null | undefined): string {
  const junto = `${nome ?? ""} ${descricao ?? ""}`;
  return junto.split("·")[0];
}

/** As palavras que sobram depois de tirar documento, neutras, números e datas. */
export function sobrasDoTexto(nome: string | null | undefined, descricao: string | null | undefined): string[] {
  return semAcento(textoUtil(nome, descricao))
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((t) => !/^\d+$/.test(t))          // 2026, 07, 13
    .filter((t) => t.length > 1)              // iniciais e letras soltas
    .filter((t) => !DOCUMENTOS.has(t))
    .filter((t) => !NEUTRAS.has(t));
}

/**
 * É custo da empresa (guia, DARF), e não de uma pessoa?
 *
 * Só é chamada para títulos que NÃO casaram com ninguém — quem casou já tem
 * dono e continua individual, seja qual for o texto.
 */
export function ehCustoDaEmpresa(nome: string | null | undefined, descricao: string | null | undefined): boolean {
  const texto = semAcento(textoUtil(nome, descricao)).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  // Precisa NOMEAR um documento de recolhimento…
  if (!texto.some((t) => DOCUMENTOS.has(t))) return false;
  // …e não sobrar nada que possa ser nome de gente.
  return sobrasDoTexto(nome, descricao).length === 0;
}
