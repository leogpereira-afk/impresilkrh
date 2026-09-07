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

/**
 * Para onde vai quem o cadastro dava como desligado e continua recebendo.
 *
 * Era "ativo". Virou "freelancer" a pedido do Léo em 07/09/2026: essa gente
 * parou de ser CLT e continua na empreita, e ele quer ela DENTRO do quadro
 * (por isso o status nasce com contaComoAtivo). É só o padrão do seletor — a
 * tela deixa trocar pessoa por pessoa antes de aplicar.
 */
export const STATUS_DE_QUEM_PAROU_DE_SER_CLT = "freelancer";

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
 * O conserto é limpar a data. Se o status também dizia "inativo", ele passa a
 * "freelancer" (quando esse status existe no cadastro) — senão a pessoa
 * continuaria fora do quadro pelo outro lado.
 *
 * `statusDisponiveis` são os ids que EXISTEM na coleção `status`. Propor um id
 * inexistente sumiria com a pessoa do quadro em silêncio.
 */
export function reativarQuemContinuaRecebendo(
  colaboradores: Pick<Colaborador, "id" | "nome" | "statusId" | "dataDesligamento">[],
  pagamentos: Pick<Pagamento, "colaboradorId" | "competencia" | "tipo">[],
  statusDisponiveis?: Iterable<string>,
): PropostaReativar[] {
  // Só propõe "freelancer" se ele EXISTIR no cadastro. Um statusId que não está
  // na coleção `status` não vira erro nenhum: `statusById.get` devolve
  // undefined, `contaHeadcount` lê `?? false` e a pessoa some do quadro em
  // silêncio — o contrário exato do que o Léo pediu. Sem a lista (ninguém
  // passou), cai no "ativo" de antes, que existe desde sempre.
  const existe = statusDisponiveis ? new Set(statusDisponiveis) : null;
  const paraQuemParou = existe?.has(STATUS_DE_QUEM_PAROU_DE_SER_CLT) ? STATUS_DE_QUEM_PAROU_DE_SER_CLT : "ativo";

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
      // Status que conta no quadro. Quem já tinha um status do quadro fica com
      // o dele — experiência, aviso prévio e afastado são situações que nenhum
      // pagamento pode deduzir, e trocá-las seria inventar.
      //
      // Quem o cadastro dava como INATIVO é o caso do pedido do Léo em
      // 07/09/2026: "tem funcionários que param de trabalhar e vão para
      // freelancer" / "na regra de cadastro, ao invés de funcionário vai pra
      // freelancer". Parou de ser CLT e continua recebendo salário = empreita.
      //
      // Continua sendo PROPOSTA, e de propósito: o dado prova que a pessoa não
      // saiu, mas não prova em que condição ela ficou. Por isso a tela põe um
      // seletor ao lado de cada nome — quem sabe quem é freelancer é o Léo, não
      // o banco (a verba "Freelancer (Empreita)" foi paga a 18 pessoas ativas
      // de salário alto e não serve de prova).
      para: { statusId: c.statusId && c.statusId !== "inativo" ? c.statusId : paraQuemParou, dataDesligamento: null },
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
  pagamentos: Pick<Pagamento, "colaboradorId" | "competencia" | "dataPagamento" | "tipo">[],
): PropostaAdmissao[] {
  const porPessoa = new Map<string, Pick<Pagamento, "colaboradorId" | "competencia" | "dataPagamento" | "tipo">[]>();
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
    // SÓ verba que prova vínculo de EMPREGO. Empreita, diária e benefício são
    // pagos a quem ainda não foi contratado — a casa paga empreita a 18 pessoas
    // que depois viram CLT. Aceitar qualquer verba recuava a admissão para
    // antes da contratação e matava o aviso dos 90 dias de experiência: o
    // contrato virava "por tempo indeterminado" sem ninguém decidir nada.
    const provaVinculo = dela.filter(
      (p) => VERBAS_DE_QUEM_TRABALHA.has(String(p.tipo)) || VERBAS_DE_QUEM_SAIU.has(String(p.tipo)),
    );
    if (!provaVinculo.length) continue;
    const antes = adm
      ? provaVinculo.filter((p) => dia(p.dataPagamento) && dia(p.dataPagamento) < adm)
      : provaVinculo;
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

/**
 * As opções do seletor "fica como" — os status do quadro MAIS o que está
 * selecionado, se ele não estiver entre eles.
 *
 * Existe por um jeito de a tela mentir: um `<select>` cujo `value` não é
 * nenhuma das `<option>` mostra a PRIMEIRA opção. O usuário lê "Ativo" e
 * aplica "Externo". Acontece de verdade com quem tem status fora do headcount
 * (Externo, Direção) e data de saída errada: a regra preserva o status dele, e
 * a lista do seletor só traz os que contam no quadro.
 */
export function opcoesDeStatus(
  doQuadro: { id: string; nome: string }[],
  selecionado: string,
): { id: string; nome: string }[] {
  if (doQuadro.some((s) => s.id === selecionado)) return doQuadro;
  // Sem nome bonito para mostrar, o id é mais honesto que a opção errada.
  return [...doQuadro, { id: selecionado, nome: selecionado }];
}
