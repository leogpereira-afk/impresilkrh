// ============================================================================
// Quem fazia parte do quadro NAQUELE mês.
//
// A tela usava sempre o quadro de HOJE: o custo médio de janeiro era o custo de
// janeiro dividido pelas 30 pessoas de setembro, e não pelas 46 que estavam lá.
// Quanto mais para trás, mais errado — e o gráfico de evolução, que é onde se
// olha tendência, era o mais afetado.
//
// A régua (pedido do Léo em 07/09/2026): dentro de um mês, é do quadro quem já
// tinha entrado e ainda não tinha saído. Quem entra depois só aparece do mês
// dele em diante; quem saiu antes some daquele mês para a frente — mas continua
// somando no Custo Global, porque o dinheiro dele fez parte daquela conta.
// ============================================================================
import type { Colaborador } from "@/data/types";

const mes = (iso?: string | null) => String(iso ?? "").slice(0, 7);

export interface MotivoFora {
  /** Por que a pessoa não está no quadro deste mês. */
  motivo: "direcao" | "entrou-depois" | "saiu-antes" | "inativo-sem-data";
}

/**
 * A pessoa fazia parte do quadro na competência?
 *
 * Direção nunca entra (não é headcount — ver dominio.contaHeadcount).
 * Sem data de admissão, presume-se que já estava: sumir gente de um mês por
 * falta de cadastro seria pior que contá-la a mais, e a tela lista quem está
 * sem data para o RH corrigir.
 * Desligado NO mês ainda conta: ele trabalhou parte dele.
 */
export function noQuadroEm(c: Colaborador, comp: string): boolean {
  if (!comp) return false;
  if (c.ehDirecao) return false;
  const adm = mes(c.dataAdmissao);
  const des = mes(c.dataDesligamento);
  if (adm && adm > comp) return false;
  if (des) return des >= comp;
  // Sem data de desligamento: quem está marcado inativo saiu em algum momento
  // que ninguém anotou. Para o mês corrente vale o status; para trás, só o
  // lançamento prova que estava — quem chama junta as duas coisas.
  return c.statusId !== "inativo";
}

/** O quadro do mês, em ordem alfabética. */
export function quadroDoMes(colaboradores: Colaborador[], comp: string): Colaborador[] {
  return colaboradores.filter((c) => noQuadroEm(c, comp)).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Quantas pessoas o mês tinha — o divisor honesto do custo médio e do rateio. */
export const quantosNoQuadro = (colaboradores: Colaborador[], comp: string): number =>
  colaboradores.reduce((n, c) => n + (noQuadroEm(c, comp) ? 1 : 0), 0);

export interface FaltaNoMes {
  colaborador: Colaborador;
  /** Não tem lançamento nenhum na competência. */
  semLancamento: boolean;
  /** Tem adiantamento, mas nenhum salário/rescisão/férias que feche o mês. */
  soAdiantamento: boolean;
  /** Cadastro sem data de admissão — a presença dele no mês é presumida. */
  semDataAdmissao: boolean;
}

/** Tipos que, sozinhos, já explicam o mês de uma pessoa. */
const FECHA_O_MES = ["Salário", "Rescisão", "Férias", "13º Salário"];

/**
 * Quem estava no quadro do mês e não tem lançamento — a lista que responde
 * "faltou gente na folha deste mês?". É a conferência que faltava: um mês com
 * 8 pessoas sem nenhum pagamento passava batido, porque a tela só mostrava
 * quem TEM lançamento.
 */
export function faltasDoMes(
  colaboradores: Colaborador[],
  pagamentos: { colaboradorId: string; competencia: string; tipo: string }[],
  comp: string,
): FaltaNoMes[] {
  const porPessoa = new Map<string, Set<string>>();
  for (const p of pagamentos) {
    if (p.competencia !== comp) continue;
    const s = porPessoa.get(p.colaboradorId) ?? new Set<string>();
    s.add(p.tipo);
    porPessoa.set(p.colaboradorId, s);
  }
  const faltas: FaltaNoMes[] = [];
  for (const c of quadroDoMes(colaboradores, comp)) {
    const tipos = porPessoa.get(c.id);
    const semLancamento = !tipos || tipos.size === 0;
    const soAdiantamento = !semLancamento && !FECHA_O_MES.some((t) => tipos!.has(t));
    if (semLancamento || soAdiantamento) {
      faltas.push({ colaborador: c, semLancamento, soAdiantamento, semDataAdmissao: !c.dataAdmissao });
    }
  }
  return faltas;
}

/**
 * Recebeu no mês sem estar no quadro dele. Quase sempre é acerto de quem saiu
 * (rescisão paga no mês seguinte) — normal. Vira pista quando é gente que
 * deveria estar no quadro e o cadastro não sabe disso.
 */
export function pagosForaDoQuadro(
  colaboradores: Colaborador[],
  pagamentos: { colaboradorId: string; competencia: string }[],
  comp: string,
): Colaborador[] {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  const ids = new Set(pagamentos.filter((p) => p.competencia === comp).map((p) => p.colaboradorId));
  const fora: Colaborador[] = [];
  for (const id of ids) {
    const c = porId.get(id);
    if (c && !c.ehDirecao && !noQuadroEm(c, comp)) fora.push(c);
  }
  return fora.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
