// A conta do ERP que pagava gente todo mês e PAROU.
//
// Pedido do Leonardo (07/09/2026): "os últimos custos de limpeza não estão na
// ficha dos funcionários — procurar e corrigir".
//
// O QUE ACHEI, nos dados: a faxina para em junho/2026. Barbara e Marcella
// continuam ativas e recebendo salário, adiantamento e comissão em julho e
// agosto — não é problema de casar nome. A conta `2.3.2.1-Limpeza Escritório`
// simplesmente deixou de aparecer, e nada na tela dizia isso.
//
// E não foi a primeira vez. Sete contas pararam junto: 2.1.12 (Comissão
// Interna), 2.1.11 (Horas Extras), 2.1.6 (Rescisão), 2.1.13, 2.1.19, 2.11.1
// (Freelancer) e a 2.3.2.1. As outras seis reapareceram sob códigos novos —
// o contador renumerou o plano em julho. A da limpeza é a única que não achou
// sucessora nos lançamentos.
//
// POR QUE ISSO PASSA DESPERCEBIDO. Some dinheiro, mas nada fica vermelho: a
// pessoa continua na folha (o salário dela chega), o mês fecha, o total só é
// um pouco menor. Zero não dispara alarme nenhum — e "não teve faxina" e "a
// faxina não chegou" têm exatamente a mesma cara na tela.
//
// A régua: uma conta que trouxe dinheiro em VÁRIOS meses seguidos e sumiu nos
// últimos é achado. Não prova que o dinheiro existe no ERP — prova que ele
// parou de chegar, que é a pergunta que ninguém estava fazendo.
import type { Pagamento } from "@/data/types";

/** Quantos meses seguidos uma conta precisa ter aparecido para o sumiço contar. */
export const MESES_PARA_VIRAR_HABITO = 3;

export interface ContaParada {
  /** Código do plano, como veio na descrição ("2.3.2.1"). */
  codigo: string;
  /** O texto inteiro, para a tela mostrar ("2.3.2.1-Limpeza Escritório"). */
  rotulo: string;
  /** Em quantas competências distintas ela apareceu. */
  meses: number;
  primeiraComp: string;
  ultimaComp: string;
  /** Quantas competências se passaram desde a última vez. */
  mesesParada: number;
  /** Total que ela trouxe enquanto vinha. */
  total: number;
  /** Média por mês em que apareceu — o tamanho do que está faltando. */
  mediaMensal: number;
  /** Quem costumava receber por essa conta, do mais recente para trás. */
  pessoas: string[];
  /**
   * A conta que assumiu o lugar desta — quando existe e traz MENOS.
   *
   * Sucessora que traz o mesmo tanto cala o alarme (é renumeração, não
   * sumiço). Sucessora que traz um fio de dinheiro não cala: o que ela conta
   * é outra história ("continuou, mas caiu de R$ 1.478 para R$ 90"), e é essa
   * a frase que a tela precisa dizer para a pessoa não sair procurando o que
   * não sumiu.
   */
  sucessora?: { rotulo: string; mediaMensal: number };
}

/**
 * Quanto a sucessora precisa trazer para o sumiço não ser notícia.
 *
 * As guardas "mudou de número" e "virou detalhe" olhavam só se ALGUÉM se
 * mexeu depois — qualquer valor servia, um centavo bastava para calar o
 * alarme de uma conta de R$ 1.478/mês. Nos dados reais de set/2026 as quatro
 * contas caladas trazem 76%, 132%, 149% e 407% do que traziam antes: metade é
 * um corte folgado, que não muda nenhum alarme de hoje e fecha a porta do fio
 * de dinheiro.
 */
export const FRACAO_QUE_CONTINUA = 0.5;

/* O ERP cola o plano no fim da descrição: "Faxina · 2.3.2.1-Limpeza Escritório".
   É de lá que sai a conta de cada lançamento — o registro não guarda o código
   em campo próprio. */
export function planoDaDescricao(descricao: unknown): string {
  const t = String(descricao ?? "");
  const i = t.indexOf("·");
  return i < 0 ? "" : t.slice(i + 1).trim();
}

const codigoDe = (plano: string) => plano.split("-")[0].trim();
const nomeDoPlano = (plano: string) => {
  const i = plano.indexOf("-");
  return i < 0 ? "" : plano.slice(i + 1).trim();
};

/**
 * O nome da conta, reduzido ao que dá para comparar entre plano velho e novo.
 *
 * Sem acento, sem caixa, sem pontuação — e sem o "s" do plural, porque o
 * contador escreveu "Horas Extras" no plano velho e "Hora Extra" no novo. Sem
 * tolerar o plural, a conta de R$ 44.904 aparecia como parada.
 */
export function nomeComparavel(nome: string): string {
  return String(nome ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()
    .split(" ").map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w)).join(" ");
}
const arred = (v: number) => Math.round(v * 100) / 100;
const ehComp = (c: unknown) => /^\d{4}-\d{2}$/.test(String(c ?? ""));

/** Quantos meses de distância entre duas competências AAAA-MM. */
export function distanciaEmMeses(de: string, ate: string): number {
  const [a1, m1] = de.split("-").map(Number);
  const [a2, m2] = ate.split("-").map(Number);
  return (a2 - a1) * 12 + (m2 - m1);
}

/**
 * Contas que vinham e pararam.
 *
 * `ate` é a competência mais recente que se considera fechada — a régua de
 * "parou". Sem ela, a última competência com dado seria sempre "o mês atual" e
 * nada nunca pareceria parado.
 */
export function contasQuePararam(
  pagamentos: Pick<Pagamento, "competencia" | "descricao" | "valor" | "colaboradorId">[],
  ate: string,
  nomeDaPessoa: (colaboradorId: string) => string,
  mesesDeHabito = MESES_PARA_VIRAR_HABITO,
): ContaParada[] {
  if (!ehComp(ate)) return [];

  /* Agrupa por CÓDIGO + NOME, não só por código.
     O contador reaproveitou dois números com outro significado: `2.1.11.1` era
     "Diária" até junho e virou "Comissão interna" em julho; `2.1.11.4` era
     "Hora Extra" e virou "Empreita". Agrupar só pelo número somaria a diária de
     junho com a comissão de julho e chamaria isso de uma conta só. */
  const porConta = new Map<string, {
    codigo: string; nome: string; rotulo: string; comps: Set<string>; total: number;
    /* QUANTO em cada mês — por CONTA (código+nome), não por código.
       Estava chaveado só pelo código, e o contador reaproveita número: o
       dinheiro de "Diária" em 2.1.11.1 entrava no crédito da sucessora
       "Comissão interna" no mesmo número, e R$ 3.800/mês sumiam em silêncio
       porque uma conta alheia usava a numeração. */
    porMes: Map<string, number>;
    ultimoPorPessoa: Map<string, string>;
  }>();
  /* Onde cada nome apareceu, sob que código. É com isto que se distingue "a
     conta parou" de "a conta mudou de número". */
  const ondeApareceu = new Map<string, { codigo: string; comp: string }[]>();

  for (const p of pagamentos) {
    const comp = String(p.competencia ?? "");
    if (!ehComp(comp) || comp > ate) continue;
    const plano = planoDaDescricao(p.descricao);
    const codigo = codigoDe(plano);
    if (!codigo) continue;
    const nome = nomeComparavel(nomeDoPlano(plano));
    const chave = codigo + "|" + nome;

    const x = porConta.get(chave) ?? {
      codigo, nome, rotulo: plano, comps: new Set<string>(), total: 0,
      porMes: new Map<string, number>(), ultimoPorPessoa: new Map<string, string>(),
    };
    const eraUltima = x.comps.size ? [...x.comps].sort().slice(-1)[0] : "";
    x.comps.add(comp);
    x.total = arred(x.total + (Number(p.valor) || 0));
    x.porMes.set(comp, arred((x.porMes.get(comp) ?? 0) + (Number(p.valor) || 0)));
    // Guarda o rótulo mais recente: o contador renomeia, e o nome novo ajuda
    // mais a reconhecer a conta do que o antigo.
    if (comp >= eraUltima) x.rotulo = plano;
    const id = String(p.colaboradorId ?? "");
    if (id) {
      const antes = x.ultimoPorPessoa.get(id);
      if (!antes || comp > antes) x.ultimoPorPessoa.set(id, comp);
    }
    porConta.set(chave, x);

    if (nome) {
      const lista = ondeApareceu.get(nome) ?? [];
      lista.push({ codigo, comp });
      ondeApareceu.set(nome, lista);
    }
  }

  /**
   * Quanto uma conta trouxe DEPOIS de `ultima`, por mês DECORRIDO.
   *
   * O divisor é o tempo que passou, não o número de meses em que ela se mexeu.
   * Dividir pelos meses com movimento faz a média NUNCA ENVELHECER: um único
   * pagamento de R$ 400 em julho continuava valendo "R$ 400 por mês" em
   * dezembro e calava o alarme para sempre — o dinheiro tinha parado de vir
   * cinco meses antes e a tela ficava verde.
   */
  const trazidoDepois = (chave: string, ultima: string) => {
    let total = 0;
    for (const [comp, v] of porConta.get(chave)?.porMes ?? []) if (comp > ultima && comp <= ate) total += v;
    return total;
  };
  const mediaDepois = (chaves: string[], ultima: string) => {
    const decorridos = Math.max(1, distanciaEmMeses(ultima, ate));
    return arred(chaves.reduce((t, k) => t + trazidoDepois(k, ultima), 0) / decorridos);
  };

  /** O mesmo nome voltou depois, sob OUTRO código? Candidatas a sucessora. */
  const porRenumeracao = (nome: string, codigo: string, ultima: string) =>
    [...porConta.values()]
      .filter((x) => x.nome === nome && x.codigo !== codigo && [...x.comps].some((c) => c > ultima))
      .map((x) => x.codigo + "|" + x.nome);

  /** Um filho passou a receber depois que o pai parou? Candidatas a sucessora. */
  const porDetalhe = (codigo: string, ultima: string) =>
    [...porConta.values()]
      .filter((x) => x.codigo !== codigo && x.codigo.startsWith(codigo + ".") && [...x.comps].some((c) => c > ultima))
      .map((x) => x.codigo + "|" + x.nome);

  const out: ContaParada[] = [];
  for (const x of porConta.values()) {
    const comps = [...x.comps].sort();
    if (comps.length < mesesDeHabito) continue; // veio pouco: sumir não é notícia
    const ultima = comps[comps.length - 1];
    const parada = distanciaEmMeses(ultima, ate);
    if (parada < 1) continue; // ainda está vindo
    const media = arred(x.total / comps.length);
    /* O DINHEIRO MUDOU DE NÚMERO OU SECOU? Acusar renumeração enche a tela de
       alarme falso (foram 4 dos 9 no caso real) — mas calar porque alguém se
       mexeu, sem olhar QUANTO, esconde a conta que continuou existindo e
       parou de trazer. Sucessora que mantém o dinheiro cala o alarme;
       sucessora magra vira parte do achado. */
    // Sem o Set, a conta que é filha E tem o mesmo nome entra duas vezes e o
    // dinheiro dela conta em dobro — bastava isso para a sucessora magra
    // passar da régua.
    const sucessoras = [...new Set([
      ...(x.nome ? porRenumeracao(x.nome, x.codigo, ultima) : []),
      ...porDetalhe(x.codigo, ultima),
    ])];
    const mediaNova = sucessoras.length ? mediaDepois(sucessoras, ultima) : 0;
    if (sucessoras.length && mediaNova >= media * FRACAO_QUE_CONTINUA) continue;
    /* O RÓTULO É O DA MAIOR, e o valor é o de TODAS — dizer o nome da primeira
       da lista com a soma de todas afirma um par (conta, valor) que não existe
       em lugar nenhum do ERP e manda procurar a conta errada. */
    const maior = [...sucessoras].sort((a2, b2) => trazidoDepois(b2, ultima) - trazidoDepois(a2, ultima))[0];
    const nomeDaMaior = maior ? porConta.get(maior)?.rotulo ?? maior : "";
    out.push({
      ...(sucessoras.length
        ? {
            sucessora: {
              rotulo: sucessoras.length > 1 ? `${nomeDaMaior} (+${sucessoras.length - 1} outra(s))` : nomeDaMaior,
              mediaMensal: mediaNova,
            },
          }
        : {}),
      codigo: x.codigo,
      rotulo: x.rotulo || x.codigo,
      meses: comps.length,
      primeiraComp: comps[0],
      ultimaComp: ultima,
      mesesParada: parada,
      total: x.total,
      mediaMensal: arred(x.total / comps.length),
      pessoas: [...x.ultimoPorPessoa.entries()]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(([id]) => nomeDaPessoa(id))
        .filter(Boolean),
    });
  }

  // O que some mais dinheiro por mês vem primeiro — é o que dói.
  return out.sort((a, b) => b.mediaMensal - a.mediaMensal || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
}
