// ============================================================================
// Conta do plano de contas do ERP → tipo de pagamento do RH.
//
// O ERP manda a conta numa string só: "2.1.11.1-Comissão interna". O NOME é o
// que o contador escreveu no dia do lançamento; o CÓDIGO é só a posição da
// conta na árvore — e posição muda.
//
// Por que o nome manda (06/09/2026): o contador RENUMEROU as subcontas 2.1.11.x
// em julho/2026. Até junho, 2.1.11.1 era Diária e 2.1.11.4 era Hora Extra; de
// julho em diante 2.1.11.1 é Comissão interna, .2 Bônus, .3 Diária, .4 Empreita,
// .6 Hora Extra e .7 Incentivo de Viagens. A tradução por código (na Edge
// Function) continuou lendo o significado antigo e gravou 70 lançamentos de
// jul/ago no tipo errado: a comissão de quatro vendedoras virou "Diária", a
// diária virou "Limpeza/Faxina", empreita e incentivo de viagens viraram "Horas
// Extras". Nenhum alarme: cada lançamento tinha um tipo válido — só que o
// errado. Ler o nome resolve o passado e o futuro de uma vez: seja qual for o
// número que o contador escolher, "Comissão" continua sendo comissão.
//
// O código fica como DESEMPATE, para subconta cujo nome não diz nada sozinho
// ("2.1.9.1-Regular" é FGTS porque 2.1.9 é FGTS). Quando nem nome nem código
// dizem nada, o tipo é "Outros" — visível, e não um chute silencioso.
// ============================================================================

/** "2.1.11.1-Comissão interna" → "2.1.11.1" */
export const codigoDoPlano = (plano: string): string => String(plano || "").trim().split("-")[0].trim();

/** "2.1.11.1-Comissão interna" → "Comissão interna" */
export const nomeDoPlano = (plano: string): string => {
  const s = String(plano || "").trim();
  const i = s.indexOf("-");
  return i < 0 ? "" : s.slice(i + 1).trim();
};

const normalizar = (s: string) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Palavras do contador → tipo do RH. O primeiro que casar vence, e por isso a
 * ORDEM É A REGRA:
 *  - FGTS e INSS na frente: nome que cita a guia é encargo da empresa, seja o
 *    resto o que for ("FGTS Rescisório" é FGTS, não Rescisão — senão a guia
 *    entraria como dinheiro pago à pessoa);
 *  - "Rescisão" e "13º" antes de "Férias"/"Salário", que aparecem no nome deles;
 *  - "Férias" antes de "Adiantamento": o pagamento antecipado das férias
 *    ("Adiantamento de Férias") é férias, não adiantamento de salário — trocado,
 *    ele inflaria a sugestão de salário, que soma salário + adiantamento;
 *  - "Salário" por último, porque é a palavra que mais aparece de carona.
 * `\bamil\b` com fronteira de palavra de propósito: sem ela, "amil" casa dentro
 * de "família" e "Salário Família" viraria Plano de Saúde.
 */
const POR_NOME: [RegExp, string][] = [
  [/fgts/, "FGTS"],
  [/inss/, "INSS"],
  [/rescis/, "Rescisão"],
  [/(^|\D)13(\D|$)|decimo ?terceiro/, "13º Salário"],
  [/ferias/, "Férias"],
  [/adiantamento/, "Adiantamento"],
  [/comiss|comercial/, "Comissão"],
  [/bonus/, "Bônus"],
  [/diaria/, "Diária"],
  [/empreita|freela/, "Freelancer (Empreita)"],
  [/faxina|limpeza/, "Limpeza/Faxina"],
  [/horas? ?extras?|plantao/, "Horas Extras"],
  [/produtividade/, "Incentivo de Produtividade"],
  [/viage/, "Incentivo de Viagens"],
  [/vale ?transporte|\bvt\b/, "Vale Transporte"],
  [/estagio|bolsa/, "Estágio/Bolsa"],
  [/uniforme/, "Uniforme"],
  [/alimenta/, "Alimentação"],
  [/confraterniza|aniversario|festa/, "Confraternização"],
  [/prestacao/, "Prestação de Serviços"],
  [/treinamento/, "Treinamentos"],
  [/farmacia|minas brasil|drogaria/, "Farmácia"],
  [/plano de saude|\bsaude\b|pro ?vida|unimed|\bamil\b|odonto/, "Plano de Saúde"],
  [/salario/, "Salário"],
];

/**
 * Desempate por código, do plano de contas do contador (31/07/2026). Só contas
 * de GRUPO: subconta herda do pai (2.1.9.1 → 2.1.9). As subcontas 2.1.11.x
 * ficam de fora de propósito — foram renumeradas uma vez e podem ser de novo;
 * uma 2.1.11.x com nome desconhecido vira "Outros", que aparece, e não
 * "Horas Extras", que passa despercebido.
 */
const POR_CODIGO = new Map<string, string>([
  ["2.1.1", "Salário"],
  ["2.1.2", "Adiantamento"],
  ["2.1.3", "Férias"],
  ["2.1.4", "13º Salário"],
  ["2.1.5", "Vale Transporte"],
  ["2.1.6", "Rescisão"],
  ["2.1.7", "Estágio/Bolsa"],
  ["2.1.8", "Uniforme"],
  ["2.1.9", "FGTS"],
  ["2.1.10", "INSS"],
  ["2.1.12", "Comissão"],
  ["2.1.13", "Incentivo de Produtividade"],
  ["2.1.14", "Alimentação"],
  ["2.1.15", "Confraternização"],
  ["2.1.16", "Prestação de Serviços"],
  ["2.1.17", "Treinamentos"],
  ["2.1.18", "Farmácia"], // "Minas Brasil" = drogaria conveniada
  ["2.1.19", "Incentivo de Viagens"],
  ["2.1.20", "Plano de Saúde"],
  // Fora do grupo 2.1, mas é gente recebendo (ver FOLHA_FORA_DO_21 na Edge Function).
  ["2.3.2.1", "Limpeza/Faxina"],
  ["2.3.2.2", "Limpeza/Faxina"],
  ["2.11.1", "Freelancer (Empreita)"],
]);

/**
 * Traduz a conta do ERP no tipo de pagamento do RH.
 *
 * 1. O NOME da conta, por palavra-chave (a verdade do contador).
 * 2. O CÓDIGO, subindo a hierarquia (2.1.9.1 → 2.1.9 → 2.1 → 2).
 * 3. `senao` — por padrão "Outros". O cliente passa o tipo que a Edge Function
 *    já mandou, para uma função antiga no ar continuar funcionando.
 */
export function tipoDoPlanoErp(plano: string, senao = "Outros"): string {
  const nome = normalizar(nomeDoPlano(plano));
  if (nome) {
    for (const [re, tipo] of POR_NOME) if (re.test(nome)) return tipo;
  }
  const codigo = codigoDoPlano(plano);
  if (codigo) {
    const partes = codigo.split(".");
    for (let n = partes.length; n >= 1; n--) {
      const t = POR_CODIGO.get(partes.slice(0, n).join("."));
      if (t) return t;
    }
  }
  return senao || "Outros";
}

/**
 * Recupera a conta do ERP guardada na descrição do pagamento.
 *
 * `montarPagamento` grava `descricao = "<descrição do título> · <conta>"`; a
 * conta é o último pedaço e começa por código ("2.1.11.1-…"). É o que permite
 * CONFERIR um pagamento já gravado sem ir ao ERP de novo — a auditoria de
 * classificação usa isto.
 */
export function planoDaDescricao(descricao: string | null | undefined): string {
  const partes = String(descricao ?? "").split(" · ");
  const ultimo = partes[partes.length - 1]?.trim() ?? "";
  return /^\d+(\.\d+)*\s*-/.test(ultimo) ? ultimo : "";
}
