/**
 * A CONTA QUE O DONO APONTOU AO SÓCIO — uma régua, um lugar.
 *
 * O prefixo 2.14 é a régua estrutural do plano de contas, e ela não alcança o
 * caso real: em julho/2026 o contador tirou as retiradas do Leonardo de
 * 2.14.2.2 e as pôs em 2.11.2.2, onde a equivalência automática não resolve
 * ("Leonardo" aparece sob três pais diferentes, retirada num e antecipação de
 * recebíveis noutro). Quem sabe é o dono, e a resposta dele fica gravada em
 * `config_global.config.vinculosSocioConta`.
 *
 * Este arquivo existe porque a mesma pergunta era respondida em três lugares
 * com três réguas: a tela (src/lib/custos.ts), a porta de dados (`sync`) e a
 * porta do ERP (`mubi-pagamentos`) — e a última simplesmente não perguntava.
 * Resultado: a retirada do sócio saía pela rota da folha para qualquer
 * ADMIN_RH enquanto a rota do plano a escondia.
 *
 * A régua da CHAVE é código+nome, nunca o código sozinho: o contador
 * reaproveita número com outro significado (2.14.2.1 é "Contas Pagas" em junho
 * e "LGP" em janeiro). A chave por código sozinho continua aceita na leitura
 * porque é o formato antigo de apontamentos já gravados.
 *
 * Espelho de `chaveContaSocio`/`NAO_E_DE_SOCIO` em src/lib/custos.ts. Se uma
 * mudar, a outra muda junto — e o teste do servidor cobre as duas.
 */

/** Valor que significa "esta conta NÃO é de sócio nenhum" — resposta explícita. */
export const NAO_E_DE_SOCIO = "nenhum";

export function normalizarNomeDeConta(v: unknown): string {
  return String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export const chaveContaSocio = (codigo: unknown, nome: unknown): string =>
  `${String(codigo ?? "").trim()}|${normalizarNomeDeConta(nome)}`;

/**
 * A conta é de sócio por apontamento do dono?
 *
 * `equivaleA` entra porque o apontamento pode ter sido feito na numeração
 * antiga: a conta de hoje traduz para a do contador, e o apontamento vale nas
 * duas.
 *
 * A ORDEM É PRECEDÊNCIA, NÃO "QUALQUER UMA SERVE": a primeira chave que TEM
 * resposta decide, e a mais específica vem primeiro. Se o dono disse "nenhum"
 * para esta conta com este nome, um apontamento velho só pelo código não pode
 * ressuscitar a resposta antiga — quem falou por último, e mais específico,
 * mandou.
 */
export function contaApontadaAoSocio(
  conta: { codigo: unknown; nome?: unknown; equivaleA?: unknown },
  vinculos: Record<string, string>,
): boolean {
  const chaves = [
    chaveContaSocio(conta.codigo, conta.nome),
    conta.equivaleA ? chaveContaSocio(conta.equivaleA, conta.nome) : "",
    String(conta.codigo ?? "").trim(),
  ];
  for (const k of chaves) {
    const dono = k ? vinculos[k] : undefined;
    if (dono) return dono !== NAO_E_DE_SOCIO;
  }
  return false;
}

/**
 * Lê o mapa do config global e DIZ se falhou.
 *
 * Quem chama decide o que fazer com a falha, e a decisão fica escrita: sem o
 * mapa não dá para separar conta de sócio de conta pública, então "seguir em
 * frente" é servir o que deveria estar escondido. A porta do ERP recusa o
 * pedido (uma tela que não carrega é barulho; um vazamento é silêncio); a
 * porta de dados registra e segue com a régua literal 2.14, porque derrubar
 * toda sincronização por uma leitura de config é pior — e essa escolha está
 * comentada lá.
 */
export async function lerVinculosSocioConta(
  admin: { from: (t: string) => any },
): Promise<{ vinculos: Record<string, string>; falhou: boolean }> {
  try {
    const { data, error } = await admin.from("config_global").select("config").eq("id", true).maybeSingle();
    if (error) throw error;
    const v = data?.config?.vinculosSocioConta;
    return { vinculos: v && typeof v === "object" ? (v as Record<string, string>) : {}, falhou: false };
  } catch (e) {
    console.error("não consegui ler vinculosSocioConta", e);
    return { vinculos: {}, falhou: true };
  }
}
