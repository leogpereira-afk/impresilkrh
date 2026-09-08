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
}

/* O ERP cola o plano no fim da descrição: "Faxina · 2.3.2.1-Limpeza Escritório".
   É de lá que sai a conta de cada lançamento — o registro não guarda o código
   em campo próprio. */
export function planoDaDescricao(descricao: unknown): string {
  const t = String(descricao ?? "");
  const i = t.indexOf("·");
  return i < 0 ? "" : t.slice(i + 1).trim();
}

const codigoDe = (plano: string) => plano.split("-")[0].trim();
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
  nomeDe: (colaboradorId: string) => string,
  mesesDeHabito = MESES_PARA_VIRAR_HABITO,
): ContaParada[] {
  if (!ehComp(ate)) return [];

  const porConta = new Map<string, {
    rotulo: string; comps: Set<string>; total: number;
    ultimoPorPessoa: Map<string, string>;
  }>();

  for (const p of pagamentos) {
    const comp = String(p.competencia ?? "");
    if (!ehComp(comp) || comp > ate) continue;
    const plano = planoDaDescricao(p.descricao);
    const codigo = codigoDe(plano);
    if (!codigo) continue;
    const x = porConta.get(codigo) ?? { rotulo: plano, comps: new Set<string>(), total: 0, ultimoPorPessoa: new Map<string, string>() };
    x.comps.add(comp);
    x.total = arred(x.total + (Number(p.valor) || 0));
    // Guarda o rótulo mais recente: o contador renomeia, e o nome novo ajuda
    // mais a reconhecer a conta do que o antigo.
    if (comp >= [...x.comps].sort().slice(-1)[0]) x.rotulo = plano;
    const id = String(p.colaboradorId ?? "");
    if (id) {
      const antes = x.ultimoPorPessoa.get(id);
      if (!antes || comp > antes) x.ultimoPorPessoa.set(id, comp);
    }
    porConta.set(codigo, x);
  }

  const out: ContaParada[] = [];
  for (const [codigo, x] of porConta) {
    const comps = [...x.comps].sort();
    if (comps.length < mesesDeHabito) continue; // veio pouco: sumir não é notícia
    const ultima = comps[comps.length - 1];
    const parada = distanciaEmMeses(ultima, ate);
    if (parada < 1) continue; // ainda está vindo
    out.push({
      codigo,
      rotulo: x.rotulo || codigo,
      meses: comps.length,
      primeiraComp: comps[0],
      ultimaComp: ultima,
      mesesParada: parada,
      total: x.total,
      mediaMensal: arred(x.total / comps.length),
      pessoas: [...x.ultimoPorPessoa.entries()]
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(([id]) => nomeDe(id))
        .filter(Boolean),
    });
  }

  // O que some mais dinheiro por mês vem primeiro — é o que dói.
  return out.sort((a, b) => b.mediaMensal - a.mediaMensal || a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true }));
}
