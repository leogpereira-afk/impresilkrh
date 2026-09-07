// Consertar o cadastro pelo que os PAGAMENTOS provam.
//
// A auditoria achava 8 "cadastro contradiz os pagamentos" e parava aí: apontava
// a pessoa e mandava o RH abrir a ficha. Só que 7 dos 8 casos são
// determinísticos — o dinheiro já diz qual dos dois lados está errado. Só o
// oitavo (pessoa sem data de admissão nenhuma) exige alguém saber a resposta.
//
// A REGRA QUE DECIDE: que verba a pessoa recebeu DEPOIS da data.
//
//   Rescisão, Férias, 13º e FGTS são o acerto de quem SAIU — recebê-los depois
//   da data de desligamento é o esperado, e não prova nada.
//
//   Salário e Adiantamento são o pagamento de quem TRABALHOU no mês. Recebê-los
//   numa competência posterior à data de desligamento prova que a pessoa não
//   estava desligada: ninguém paga salário de agosto a quem saiu em junho.
//
// Verificado nos dados reais em 07/09/2026: Demerval e Osmane constam
// desligados em 22/06 e receberam Salário + Adiantamento das competências de
// julho E agosto; o José Adilando consta com saída em 03/08 e recebeu salário
// da competência de agosto. Os três estão trabalhando; a data é que está errada.
//
// NADA AQUI GRAVA. Cada função devolve uma PROPOSTA que a tela mostra e a
// pessoa aplica com um clique — mexer em status e data de saída decide de que
// meses alguém faz parte, e isso não passa em lote mudo.
import type { Colaborador, Pagamento } from "@/data/types";

/** Verbas do acerto de quem saiu: recebê-las depois da saída é normal. */
export const VERBAS_DE_QUEM_SAIU = new Set(["Rescisão", "Férias", "13º Salário", "FGTS", "INSS"]);
/** Verbas de quem trabalhou no mês: depois da saída, provam que a saída não houve. */
export const VERBAS_DE_QUEM_TRABALHA = new Set(["Salário", "Adiantamento"]);

const mes = (s?: string | null) => String(s ?? "").slice(0, 7);
const dia = (s?: string | null) => String(s ?? "").slice(0, 10);
const comp = (s?: string | null) => (/^\d{4}-\d{2}/.test(String(s ?? "")) ? String(s).slice(0, 7) : "");

export interface PropostaReativar {
  colaboradorId: string;
  nome: string;
  /** A competência mais recente em que ela recebeu salário/adiantamento. */
  mesQueProva: string;
  /** As verbas que provam, para a tela poder mostrar por quê. */
  verbas: string[];
  de: { statusId?: string; dataDesligamento?: string | null };
  para: { statusId: string; dataDesligamento: null };
}

/**
 * Quem tem data de desligamento mas continua recebendo salário depois dela.
 *
 * O conserto é limpar a data. Se o status também dizia "inativo", ele volta
 * para "ativo" — senão a pessoa continuaria fora do quadro pelo outro lado.
 */
export function reativarQuemContinuaRecebendo(
  colaboradores: Pick<Colaborador, "id" | "nome" | "statusId" | "dataDesligamento">[],
  pagamentos: Pick<Pagamento, "colaboradorId" | "competencia" | "tipo">[],
): PropostaReativar[] {
  const porPessoa = new Map<string, Pick<Pagamento, "colaboradorId" | "competencia" | "tipo">[]>();
  for (const p of pagamentos) {
    if (!p.colaboradorId) continue;
    const arr = porPessoa.get(p.colaboradorId);
    if (arr) arr.push(p); else porPessoa.set(p.colaboradorId, [p]);
  }

  const out: PropostaReativar[] = [];
  for (const c of colaboradores) {
    const desl = mes(c.dataDesligamento);
    if (!desl) continue;
    const depois = (porPessoa.get(c.id) ?? []).filter(
      (p) => comp(p.competencia) > desl && VERBAS_DE_QUEM_TRABALHA.has(String(p.tipo)),
    );
    if (!depois.length) continue;
    const mesQueProva = depois.map((p) => comp(p.competencia)).sort().slice(-1)[0];
    const verbas = [...new Set(depois.map((p) => String(p.tipo)))].sort();
    out.push({
      colaboradorId: c.id,
      nome: c.nome,
      mesQueProva,
      verbas,
      de: { statusId: c.statusId, dataDesligamento: c.dataDesligamento ?? null },
      // Status que conta no quadro. "ativo" é o único seguro de assumir: os
      // outros (experiência, aviso prévio, afastado) são situações que ninguém
      // pode deduzir de um pagamento.
      para: { statusId: c.statusId && c.statusId !== "inativo" ? c.statusId : "ativo", dataDesligamento: null },
    });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export interface PropostaAdmissao {
  colaboradorId: string;
  nome: string;
  /** O pagamento mais antigo que a pessoa tem. */
  primeiraComp: string;
  primeiroVenc: string;
  de: { dataAdmissao?: string | null };
  para: { dataAdmissao: string };
  /** Verdadeiro quando o cadastro não tem admissão nenhuma (contra "está atrasada"). */
  faltando: boolean;
}

/**
 * Quem recebeu ANTES da data de admissão do cadastro — ou não tem admissão.
 *
 * A proposta é o primeiro dia da competência mais antiga em que ela recebeu.
 * É um PISO, não a verdade: a pessoa pode ter entrado no meio daquele mês. Por
 * isso a tela mostra o número e pede confirmação em vez de aplicar sozinha.
 *
 * Só conta pagamento cujo VENCIMENTO é anterior à admissão. O rótulo da
 * competência ser anterior é normal — a janela vai do dia 16 ao 15 seguinte,
 * então quem entra em 06/07 recebe um título rotulado 2026-06.
 */
export function admissaoAnteriorAoPrimeiroPagamento(
  colaboradores: Pick<Colaborador, "id" | "nome" | "dataAdmissao">[],
  pagamentos: Pick<Pagamento, "colaboradorId" | "competencia" | "dataPagamento">[],
): PropostaAdmissao[] {
  const porPessoa = new Map<string, Pick<Pagamento, "colaboradorId" | "competencia" | "dataPagamento">[]>();
  for (const p of pagamentos) {
    if (!p.colaboradorId) continue;
    const arr = porPessoa.get(p.colaboradorId);
    if (arr) arr.push(p); else porPessoa.set(p.colaboradorId, [p]);
  }

  const out: PropostaAdmissao[] = [];
  for (const c of colaboradores) {
    const dela = (porPessoa.get(c.id) ?? []).filter((p) => comp(p.competencia));
    if (!dela.length) continue;
    const adm = dia(c.dataAdmissao);
    const antes = adm ? dela.filter((p) => dia(p.dataPagamento) && dia(p.dataPagamento) < adm) : dela;
    if (!antes.length) continue;

    const primeiraComp = antes.map((p) => comp(p.competencia)).sort()[0];
    const primeiroVenc = antes.map((p) => dia(p.dataPagamento)).filter(Boolean).sort()[0] ?? "";
    out.push({
      colaboradorId: c.id,
      nome: c.nome,
      primeiraComp,
      primeiroVenc,
      de: { dataAdmissao: c.dataAdmissao ?? null },
      para: { dataAdmissao: `${primeiraComp}-01` },
      faltando: !adm,
    });
  }
  return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
