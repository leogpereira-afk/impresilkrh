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

/**
 * Marcadores de RAZÃO SOCIAL. Nome de gente não tem nenhum deles.
 *
 * Conferido contra os 93 colaboradores do cadastro em 07/09/2026: zero
 * batidas. É o controle que torna esta régua segura — sem ele, seria palpite.
 */
const EMPRESA_FORTE = new Set([
  "ltda", "eireli", "epp", "mei", "cooperativa", "associacao", "sociedade",
  "comercio", "industria", "industrias", "servicos", "distribuidora",
  "distribuicao", "transportes", "engenharia", "construtora", "telecom",
  "energia", "saneamento", "banco", "seguradora", "operadora", "editora",
  "supermercado", "atacado", "farmacia", "posto", "oficina",
]);
/**
 * Marcadores fracos: só valem no FIM do nome, que é onde a forma jurídica fica
 * ("… S/A", "… ME"). No meio, "me" e "sa" podem ser pedaço de outra coisa.
 */
const EMPRESA_NO_FIM = new Set(["sa", "me", "cia"]);

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
 * O nome é de uma EMPRESA (razão social), não de uma pessoa?
 *
 * Pedido do Léo em 07/09/2026, olhando "CEMIG DISTRIBUICAO S/A" na lista que
 * pede vínculo: "isso é custo de empresa". Fornecedor sem CNPJ no título caía
 * na fila de "vincular a…" e não há a quem vincular — a conta de luz não é de
 * ninguém da equipe.
 */
export function ehRazaoSocial(nome: string | null | undefined): boolean {
  const t = semAcento(String(nome ?? "")).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  if (!t.length) return false;
  if (t.some((x) => EMPRESA_FORTE.has(x))) return true;
  return EMPRESA_NO_FIM.has(t[t.length - 1]);
}

/**
 * É custo da empresa (guia, DARF, fornecedor), e não de uma pessoa?
 *
 * Só é chamada para títulos que NÃO casaram com ninguém — quem casou já tem
 * dono e continua individual, seja qual for o texto.
 */
/**
 * Palavras que aparecem AO LADO de uma guia e não são nome de gente.
 *
 * Duas famílias, e as duas vêm do ERP no campo de origem:
 *  - a leva genérica, quando o contador lança um título só para todo mundo
 *    ("COLABORADORES", 44 títulos de gente diferente num só);
 *  - quem RECEBE o recolhimento: a Caixa (FGTS), a Receita (DARF), a
 *    prefeitura (ISSQN), o sindicato.
 *
 * Nenhuma delas é o dono do dinheiro. A origem de uma guia nunca é.
 *
 * SÓ VALEM QUANDO O TEXTO JÁ NOMEIA UM DOCUMENTO. Sozinhas não classificam
 * nada — senão "Caixa" viraria custo da empresa em qualquer contexto, e
 * "colaboradores" engoliria a confraternização.
 */
const AO_LADO_DA_GUIA = new Set([
  // a leva
  "colaboradores", "colaborador", "funcionarios", "funcionario", "empregados",
  "empregado", "trabalhadores", "equipe", "pessoal", "diversos",
  // quem recebe ("previdencia" e "folha" já saem por DOCUMENTOS/NEUTRAS)
  "caixa", "economica", "federal", "receita", "uniao", "tesouro",
  "prefeitura", "municipio", "municipal", "sindicato", "governo", "secretaria",
]);

export function ehCustoDaEmpresa(nome: string | null | undefined, descricao: string | null | undefined): boolean {
  // Razão social resolve na hora: "CEMIG DISTRIBUICAO S/A" não é gente.
  if (ehRazaoSocial(nome) || ehRazaoSocial(descricao)) return true;
  const texto = semAcento(textoUtil(nome, descricao)).replace(/[^a-z0-9]+/g, " ").split(" ").filter(Boolean);
  // Precisa NOMEAR um documento de recolhimento…
  if (!texto.some((t) => DOCUMENTOS.has(t))) return false;
  // …e não sobrar nada que possa ser nome de gente.
  //
  // POR QUE O FILTRO (07/09/2026): a guia de FGTS de R$ 5.515,62 e o DARF de
  // R$ 5.330,85 caíram na lista pedindo vínculo INDIVIDUAL — o Léo mandou o
  // print. A régua reconhecia a guia quando o ERP mandava a origem vazia e
  // deixava de reconhecer quando mandava "COLABORADORES" ou "CAIXA ECONOMICA
  // FEDERAL": a palavra virava "sobra" e vetava. Sobra que não pode ser gente
  // não é sobra.
  //
  // O veto continua de pé para o que É nome: "MARCELLA LAIARA + FGTS" segue
  // pedindo vínculo, porque engolir calado a guia que nomeia alguém seria
  // trocar este defeito por um pior.
  return sobrasDoTexto(nome, descricao).filter((t) => !AO_LADO_DA_GUIA.has(t)).length === 0;
}
