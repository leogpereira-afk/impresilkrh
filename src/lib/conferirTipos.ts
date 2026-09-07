// ============================================================================
// Conferência de classificação: cada pagamento vindo do ERP comparado com o
// que o NOME da conta do contador diz que ele é.
//
// Por que existe (06/09/2026): 70 lançamentos de jul/ago ficaram meses no tipo
// errado sem ninguém ver — cada um tinha um tipo válido, só que o errado. A
// conta do ERP fica gravada na descrição ("… · 2.1.11.1-Comissão interna"),
// então dá para conferir TODOS os lançamentos sem ir ao ERP, a qualquer hora,
// e corrigir em lote pelo caminho normal do app (com rastro no histórico).
// ============================================================================
import type { Pagamento } from "@/data/types";
import { planoDaDescricao, tipoDoPlanoErp } from "./tipoDoPlano";
import { tipoSocietario } from "./societario";

export interface Divergencia {
  id: string;
  colaboradorId: string;
  competencia: string;
  /** Tipo gravado hoje. */
  de: string;
  /** Tipo que o nome da conta diz. */
  para: string;
  /** A conta do ERP, como veio ("2.1.11.1-Comissão interna"). */
  plano: string;
  valor: number;
}

export interface ConferenciaTipos {
  /** Lançamentos com conta do ERP na descrição — os que dá para conferir. */
  conferiveis: number;
  /** Sem conta na descrição (planilha antiga, lançamento manual): fora da conferência. */
  semConta: number;
  divergencias: Divergencia[];
  /** Resumo por troca (de → para), do mais frequente ao menos. */
  porTroca: { de: string; para: string; quantos: number; valor: number }[];
}

/**
 * `colaboradorPor` deixa a conferência enxergar quem é SÓCIO. Sem ela, todo
 * pagamento de direção apareceria como divergente para sempre: a conta do ERP
 * diz "FGTS" e o registro (certo) diz "Arrendamento".
 */
export function conferirTipos(
  pagamentos: Pagamento[],
  colaboradorPor?: (id: string) => { id: string; ehDirecao?: boolean; statusId?: string } | undefined,
): ConferenciaTipos {
  let conferiveis = 0;
  let semConta = 0;
  const divergencias: Divergencia[] = [];
  for (const p of pagamentos) {
    const plano = planoDaDescricao(p.descricao);
    if (!plano) { semConta++; continue; }
    conferiveis++;
    const quem = colaboradorPor?.(p.colaboradorId) ?? null;
    const para = tipoSocietario(plano, quem) ?? tipoDoPlanoErp(plano, p.tipo);
    if (para !== p.tipo) {
      divergencias.push({ id: p.id, colaboradorId: p.colaboradorId, competencia: p.competencia, de: p.tipo, para, plano, valor: Number(p.valor) || 0 });
    }
  }
  // Mais recente primeiro; dentro do mês, por pessoa — é a ordem de conferir.
  divergencias.sort((a, b) => b.competencia.localeCompare(a.competencia) || a.colaboradorId.localeCompare(b.colaboradorId) || a.id.localeCompare(b.id));
  const m = new Map<string, { de: string; para: string; quantos: number; valor: number }>();
  for (const d of divergencias) {
    const k = `${d.de}→${d.para}`;
    const x = m.get(k) ?? { de: d.de, para: d.para, quantos: 0, valor: 0 };
    x.quantos++;
    x.valor = Math.round((x.valor + d.valor) * 100) / 100;
    m.set(k, x);
  }
  const porTroca = [...m.values()].sort((a, b) => b.quantos - a.quantos || a.de.localeCompare(b.de));
  return { conferiveis, semConta, divergencias, porTroca };
}
