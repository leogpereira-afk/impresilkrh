// Em que card cada pessoa do quadro cai, na tela de Colaboradores.
//
// POR QUE ISTO SAIU DA TELA E VIROU REGRA COM TESTE.
// Em 07/09/2026 o Léo criou o status "Freelancer" e marcou o Osmane. No dia
// seguinte a tela dizia "2 Indisponíveis · férias, atestado, afastamento…" — e
// um dos dois era o Osmane, que estava trabalhando. Nada quebrou, nada avisou:
// o card de "presentes" perguntava `trabalhandoHoje`, que carrega uma lista
// FECHADA de status presentes (`ativo`, `experiencia`). O que não estava na
// lista caía no balde do "hoje não está".
//
// A LIÇÃO, e é ela que dita o desenho daqui: a lista fechada tem de ser a das
// AUSÊNCIAS, não a das presenças. Cada id abaixo está aqui porque significa uma
// ausência concreta. Tudo o que NÃO está aqui é presença — então um status novo
// nasce visível, com card próprio, em vez de sumir dentro de "Indisponíveis".
import { noQuadro } from "./dominio";
import type { Colaborador, StatusColaborador } from "@/data/types";

/**
 * É da casa, mas HOJE não está trabalhando.
 *
 * Não confundir com "fora do quadro": todos estes contam como gente da empresa
 * (é por isso que entram no total "na empresa hoje"). A pergunta aqui é outra:
 * dá para contar com esta pessoa hoje?
 *
 *  - aviso            está de saída, já não se conta com ela
 *  - afastado         INSS, licença — não está
 *  - atestado-medico  não está
 *  - abandono         parou de vir, mesmo sem o desligamento lançado
 *  - externo          não é mão de obra da casa
 *
 * Férias entra por fora (é situação, não status) — quem está de férias hoje
 * também cai em "Indisponíveis".
 */
export const STATUS_AUSENTE_HOJE = new Set(["aviso", "afastado", "atestado-medico", "abandono", "externo"]);

/**
 * As ausências deste cadastro: a lista de fábrica acima, corrigida pelo campo
 * `ausenteHoje` de cada status. O campo manda quando existe (true põe, false
 * tira); quando não existe, vale a lista. É assim que um status criado pela
 * tela ("Licença maternidade") vira ausência sem ninguém mexer em código —
 * e que o Léo pode, se quiser, dizer que "Aviso prévio" conta como presença.
 */
export function ausenciasDe(status: Pick<StatusColaborador, "id" | "ausenteHoje">[]): Set<string> {
  const out = new Set(STATUS_AUSENTE_HOJE);
  for (const s of status) {
    if (s.ausenteHoje === true) out.add(s.id);
    else if (s.ausenteHoje === false) out.delete(s.id);
  }
  return out;
}

/** Um card de presença: um status do quadro que tem gente trabalhando hoje. */
export interface GrupoPresente {
  statusId: string;
  nome: string;
  cor: string;
  ordem: number;
  quantidade: number;
}

export interface QuadroPorSituacao {
  /** Um grupo por status presente COM gente, na ordem do próprio status. */
  presentes: GrupoPresente[];
  /** É da casa mas hoje não está (os status acima + quem está de férias). */
  indisponiveis: number;
  /** Todo mundo que é da casa hoje = soma dos presentes + indisponíveis. */
  naEmpresa: number;
  /** Saiu: status inativo ou com data de desligamento. */
  desligados: number;
}

/** Pessoa no quadro sem status nenhum: ganha chave própria em vez de sumir. */
export const SEM_STATUS = "(sem status)";

/** A chave do card em que esta pessoa cai. A tela filtra por ela. */
export const chaveDeStatus = (c: Pick<Colaborador, "statusId">) => String(c.statusId ?? "") || SEM_STATUS;

/**
 * A partição do quadro para os cards. Cada pessoa cai em UM lugar só, e
 * `naEmpresa` é exatamente a soma dos presentes com os indisponíveis.
 *
 * A Direção fica fora de tudo — a tela de Colaboradores não lista sócio, e o
 * total que o Léo lê aqui é o que bate com a folha (decisão dele, 08/09/2026).
 */
export function quadroPorSituacao(
  pessoas: Pick<Colaborador, "id" | "statusId" | "dataDesligamento" | "ehDirecao">[],
  status: Pick<StatusColaborador, "id" | "nome" | "cor" | "ordem" | "ausenteHoje">[],
  emFerias: Set<string> = new Set(),
): QuadroPorSituacao {
  const catalogo = new Map(status.map((s) => [s.id, s]));
  const ausencias = ausenciasDe(status);
  const base = pessoas.filter((p) => !p.ehDirecao);
  const dentro = base.filter((p) => noQuadro(p as Colaborador));

  const porStatus = new Map<string, number>();
  let indisponiveis = 0;
  for (const p of dentro) {
    const id = chaveDeStatus(p);
    if (ausencias.has(id) || emFerias.has(p.id)) { indisponiveis++; continue; }
    porStatus.set(id, (porStatus.get(id) ?? 0) + 1);
  }

  const presentes = [...porStatus.entries()]
    .map(([statusId, quantidade]) => {
      const s = catalogo.get(statusId);
      return {
        statusId,
        // Status apagado do cadastro com gente ainda apontando para ele: mostra
        // o id cru em vez de "—". Um card sem nome é melhor que uma pessoa
        // desaparecida do total.
        nome: s?.nome ?? (statusId === SEM_STATUS ? "Sem status" : statusId),
        cor: s?.cor ?? "#64748b",
        ordem: s?.ordem ?? 9999,
        quantidade,
      };
    })
    .sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));

  return { presentes, indisponiveis, naEmpresa: dentro.length, desligados: base.length - dentro.length };
}

/**
 * Está trabalhando hoje? O MESMO critério dos cards, para a lista filtrada
 * concordar com o número. `ausencias` vem de `ausenciasDe(status)` — passar a
 * lista de fábrica é só para quem não tem o cadastro à mão.
 */
export function presenteHoje(
  c: Pick<Colaborador, "id" | "statusId" | "dataDesligamento">,
  emFerias: Set<string> = new Set(),
  ausencias: Set<string> = STATUS_AUSENTE_HOJE,
): boolean {
  if (!noQuadro(c as Colaborador)) return false;
  return !ausencias.has(chaveDeStatus(c)) && !emFerias.has(c.id);
}
