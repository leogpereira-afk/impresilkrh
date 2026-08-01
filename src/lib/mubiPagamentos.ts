// ============================================================================
// Pagamentos vindos do ERP Mubisys (contas a pagar) — lado do cliente.
//
// A busca em si é feita por uma Edge Function (o token do ERP não pode ir para
// o navegador). Aqui cuidamos de: casar cada pagamento com o colaborador certo,
// lembrar os vínculos que o RH fez à mão, e montar os registros no formato da
// coleção "pagamentos".
//
// O casamento erra por motivos bobos e conhecidos: o ERP escreve o nome por
// extenso ("BARBARA PATRICIA FERREIRA VASCONCELOS") e o cadastro tem abreviado
// ("Barbara Patrícia F. Vasconcelos"); ou o cadastro tem um erro de digitação
// ("Golçalves" x "Gonçalves"). Por isso existe o vínculo manual, que fica
// guardado e resolve o mesmo nome nos meses seguintes.
// ============================================================================
import { supabase, FN_MUBI_PAGAMENTOS } from "@/lib/supabase";
import { competenciaPagto } from "@/lib/custos";
import type { Colaborador, Pagamento } from "@/data/types";

export interface LinhaMubi {
  idMubi: string;
  nome: string;
  ehColaborador: boolean;
  cpfCnpj: string | null;
  planoContas: string;
  tipo: string;
  descricao: string;
  valor: number;
  dataVencimento: string;
  dataPagamento: string | null;
  status: string;
  formaPagamento: string;
  centroCusto: string;
}

export interface RespostaMubi {
  competencia: string;
  buscadoEm: string;
  totalTitulosNoMes: number;
  paginas: number;
  truncado: boolean;
  /** Página devolvida (quando o cliente pediu página a página). */
  pagina?: number;
  /** Ainda há página depois desta? */
  temMais?: boolean;
  linhas: LinhaMubi[];
}

export const norm = (s: string) =>
  (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();

// Conectivos não ajudam a identificar ninguém e aparecem de forma inconsistente
// ("Jessica Fernanda Souza" no cadastro x "JESSICA FERNANDA DE SOUZA" no ERP).
const CONECTIVOS = new Set(["DE", "DA", "DO", "DAS", "DOS", "E"]);
const tokens = (s: string) => norm(s).split(" ").filter((t) => t && !CONECTIVOS.has(t));

// O Mubisys CORTA o nome em 30 caracteres: "Barbara Patricia Ferreira
// Vasconcelos" chega como "BARBARA PATRICIA FERREIRA VASC". Além disso, o
// cadastro às vezes abrevia ("F." no lugar de "Ferreira"). Por isso dois
// pedaços casam quando um é começo do outro — nos dois sentidos.
const pedacoCasa = (a: string, b: string) => a === b || a.startsWith(b) || b.startsWith(a);

/** Busca os pagamentos de pessoal de um mês no Mubisys. */
export async function buscarPagamentosMubi(competencia: string, page?: number): Promise<RespostaMubi> {
  if (!supabase || !FN_MUBI_PAGAMENTOS) throw new Error("Nuvem não configurada.");
  const { data: sessao } = await supabase.auth.getSession();
  const token = sessao?.session?.access_token;
  if (!token) throw new Error("Faça login novamente para buscar do Mubisys.");

  const r = await fetch(FN_MUBI_PAGAMENTOS, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(page ? { competencia, page } : { competencia }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo?.erro || `Falha ao consultar o Mubisys (${r.status}).`);
  return corpo as RespostaMubi;
}

/**
 * Uma competência inteira, percorrendo TODAS as páginas até o fim.
 *
 * O ERP devolve 500 títulos por página. A versão anterior parava na 4ª (2.000
 * títulos) e o que passasse disso ficava para trás sem ninguém saber — em mês
 * de 13º ou de rescisão, é justamente quando o volume estoura. Agora o laço vai
 * até o servidor dizer que acabou.
 *
 * O teto de segurança existe só para não girar para sempre se o ERP mentir na
 * paginação (last_page errado): 40 páginas = 20 mil títulos num mês, muito além
 * de qualquer realidade da empresa.
 */
export async function buscarCompetenciaCompleta(
  competencia: string,
  aoProgredir?: (pagina: number, totalPaginas: number) => void,
  cancelado?: () => boolean,
): Promise<{ linhas: LinhaMubi[]; paginas: number; incompleta: boolean }> {
  const TETO_PAGINAS = 40;
  const linhas: LinhaMubi[] = [];
  let pagina = 1;
  let totalPaginas = 1;
  let incompleta = false;

  for (;;) {
    if (cancelado?.()) { incompleta = true; break; }
    const r = await buscarPagamentosMubi(competencia, pagina);
    linhas.push(...r.linhas);
    totalPaginas = r.paginas || 1;
    aoProgredir?.(pagina, totalPaginas);
    // `temMais` só existe na função nova. Numa função antiga (sem redeploy) ele
    // vem undefined e a busca se comporta como antes — uma chamada só.
    if (!r.temMais) break;
    pagina++;
    if (pagina > TETO_PAGINAS) { incompleta = true; break; }
  }
  return { linhas, paginas: totalPaginas, incompleta };
}

/**
 * Varre VÁRIAS competências do ERP, da mais recente para a mais antiga.
 *
 * Por que mês a mês e não tudo de uma vez: cada consulta ao Mubisys leva 25-40
 * segundos, e a janela de uma competência vai do dia 16 ao 15 do mês seguinte —
 * um intervalo largo devolveria títulos misturados, sem como dizer de que
 * competência é cada um. Então o laço é aqui, no navegador, e não dentro da
 * Edge Function, que tem tempo limitado e morreria no meio de uma varredura
 * longa deixando metade do histórico para trás.
 *
 * Sequencial de propósito: disparar 12 consultas ao mesmo tempo derruba o ERP
 * (e ele responde 25-40s por consulta, então o paralelo não ajudaria tanto
 * quanto atrapalha).
 *
 * `aoProgredir` recebe o andamento para a tela poder mostrar onde está — uma
 * varredura de 12 meses passa de 5 minutos e sem retorno visual parece travada.
 * `cancelado` é consultado a cada volta: o RH precisa poder desistir.
 */
export async function buscarHistoricoMubi(
  competencias: string[],
  aoProgredir?: (feitos: number, total: number, competencia: string) => void,
  cancelado?: () => boolean,
): Promise<{ linhas: LinhaMubi[]; buscadoEm: string; truncado: boolean; falhas: { competencia: string; erro: string }[]; competenciasLidas: string[] }> {
  const linhas: LinhaMubi[] = [];
  const falhas: { competencia: string; erro: string }[] = [];
  const competenciasLidas: string[] = [];
  let truncado = false;

  for (let i = 0; i < competencias.length; i++) {
    if (cancelado?.()) break;
    const comp = competencias[i];
    aoProgredir?.(i, competencias.length, comp);
    try {
      // Todas as páginas do mês — não só as 4 primeiras.
      const r = await buscarCompetenciaCompleta(
        comp,
        (pag, tot) => aoProgredir?.(i, competencias.length, tot > 1 ? `${comp} (página ${pag}/${tot})` : comp),
        cancelado,
      );
      // Um mês que falha NÃO derruba a varredura inteira: o ERP cai, dá tempo
      // limite ou vem 500 num mês qualquer, e perder os outros 11 por causa
      // dele seria pior. As falhas voltam listadas para o RH tentar de novo.
      linhas.push(...r.linhas);
      competenciasLidas.push(comp);
      if (r.incompleta) truncado = true;
    } catch (e) {
      falhas.push({ competencia: comp, erro: e instanceof Error ? e.message : "falha" });
    }
  }
  aoProgredir?.(competencias.length, competencias.length, "");

  // O mesmo título pode voltar em duas competências vizinhas (a janela 16→15 faz
  // um vencimento de virada aparecer nas duas buscas). Fica só uma cópia — senão
  // a prévia mostraria o dobro de linhas antes mesmo de gravar.
  const vistos = new Set<string>();
  const unicas = linhas.filter((l) => {
    const k = String(l.idMubi);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });

  return { linhas: unicas, buscadoEm: new Date().toISOString(), truncado, falhas, competenciasLidas };
}

/** Lista de competências (AAAA-MM) de `meses` atrás até a atual, da mais nova para a mais antiga. */
export function competenciasParaTras(meses: number, hoje = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < meses; i++) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Acha o colaborador de um nome vindo do ERP.
 * Ordem: vínculo salvo pelo RH → nome igual → todos os pedaços do nome do
 * cadastro cabem no nome do ERP (resolve o abreviado "F." x "Ferreira").
 */
export function casarColaborador(
  nomeMubi: string,
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): Colaborador | null {
  const alvo = norm(nomeMubi);
  if (!alvo) return null;

  const salvo = vinculos[alvo];
  if (salvo) {
    const c = colaboradores.find((x) => x.id === salvo);
    if (c) return c;
  }

  const exato = colaboradores.find((c) => norm(c.nome) === alvo);
  if (exato) return exato;

  // Compara pedaço a pedaço, na ordem: o nome do ERP precisa ser o começo do
  // nome do cadastro (ele vem cortado em 30 caracteres). Exige pelo menos dois
  // pedaços para nunca casar alguém só pelo primeiro nome.
  const alvoToks = tokens(nomeMubi);
  if (alvoToks.length < 2) return null;

  const candidatos = colaboradores.filter((c) => {
    const toks = tokens(c.nome);
    if (toks.length < 2 || alvoToks.length > toks.length) return false;
    return alvoToks.every((t, i) => pedacoCasa(t, toks[i]));
  });
  // Só aceita quando não há dúvida: dois candidatos = decisão do RH.
  return candidatos.length === 1 ? candidatos[0] : null;
}

/**
 * Competência de um pagamento — a MESMA regra da planilha: vencimento até o dia
 * 15 conta para o mês anterior (`competenciaPagto`, em custos.ts).
 *
 * Antes aqui era `slice(0, 7)` (o mês do vencimento cru). Como 63% da folha
 * vence até o dia 15, o ERP jogava esses lançamentos um mês à frente do que já
 * estava gravado, e a conciliação os via como NOVOS: o mesmo dinheiro contado
 * em dois meses. A regra mora em UM lugar só; não copiar para cá.
 */
export const competenciaDe = (l: LinhaMubi) => {
  const venc = (l.dataVencimento || "").slice(0, 10);
  // Título sem vencimento não tem competência (competenciaPagto quebraria no split).
  return /^\d{4}-\d{2}-\d{2}$/.test(venc) ? competenciaPagto(venc) : "";
};

/** Monta o registro da coleção "pagamentos" a partir da linha do ERP. */
export function montarPagamento(l: LinhaMubi, colaboradorId: string): Pagamento {
  return {
    // Vem do id do título no ERP: reimportar o mesmo mês atualiza em vez de duplicar.
    id: `mubi-${l.idMubi}`,
    colaboradorId,
    competencia: competenciaDe(l),
    tipo: l.tipo,
    valor: l.valor,
    dataPagamento: l.dataVencimento,
    descricao: [l.descricao, l.planoContas].filter(Boolean).join(" · ") || undefined,
  };
}

/**
 * Converte a resposta do ERP no MESMO formato que a importação por planilha
 * devolve, para reaproveitar a conciliação que já existe (prévia com o que é
 * novo, o que mudou e o que sumiu).
 *
 * Linhas sem nome (bolo de aniversário, Uber, reembolso) não são de ninguém:
 * ficam de fora dos registros e são devolvidas à parte, como despesa coletiva.
 */
export function paraRegistros(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): { registros: Pagamento[]; naoCasados: string[]; coletivas: LinhaMubi[] } {
  const registros: Pagamento[] = [];
  const naoCasados = new Set<string>();
  const coletivas: LinhaMubi[] = [];

  for (const l of linhas) {
    if (!l.nome.trim()) { coletivas.push(l); continue; }
    const c = casarColaborador(l.nome, colaboradores, vinculos);
    if (!c) { naoCasados.add(l.nome.trim()); continue; }
    registros.push(montarPagamento(l, c.id));
  }
  return { registros, naoCasados: [...naoCasados], coletivas };
}

export interface PreviaMubi {
  vinculadas: { linha: LinhaMubi; colaborador: Colaborador }[];
  semVinculo: LinhaMubi[];   // nome no ERP que não casou com ninguém
  semNome: LinhaMubi[];      // despesa coletiva (bolo, Uber, reembolso) — não é de ninguém
  totalVinculado: number;
  totalSemVinculo: number;
  totalSemNome: number;
}

/** Separa o que já dá para gravar do que precisa da decisão do RH. */
export function montarPrevia(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): PreviaMubi {
  const vinculadas: PreviaMubi["vinculadas"] = [];
  const semVinculo: LinhaMubi[] = [];
  const semNome: LinhaMubi[] = [];

  for (const l of linhas) {
    if (!l.nome.trim()) { semNome.push(l); continue; }
    const c = casarColaborador(l.nome, colaboradores, vinculos);
    if (c) vinculadas.push({ linha: l, colaborador: c });
    else semVinculo.push(l);
  }
  const soma = (arr: { valor: number }[]) => arr.reduce((s, x) => s + (x.valor || 0), 0);
  return {
    vinculadas, semVinculo, semNome,
    totalVinculado: soma(vinculadas.map((v) => v.linha)),
    totalSemVinculo: soma(semVinculo),
    totalSemNome: soma(semNome),
  };
}

// ---------------------------------------------------------------------------
// Salário do cadastro sugerido pelo ERP.
//
// POR QUE SUGERIR E NÃO GRAVAR DIRETO. O que o ERP tem é o que foi PAGO, e pago
// não é o salário de contrato:
//
//  • o mês costuma vir partido em adiantamento (2.1.2) + saldo (2.1.1), então
//    nenhum dos dois sozinho é o salário;
//  • falta, atraso e vale-transporte descontam, então um mês com falta pagaria
//    menos e "corrigiria" o cadastro para baixo;
//  • rescisão, férias e 13º entram como outros tipos e não são salário mensal.
//
// E o salário do cadastro é a base de TODO o cálculo de hora extra e de desconto
// de falta (lib/pontoFolha). Deixar o ERP sobrescrever isso sozinho fecharia um
// ciclo vicioso: mês com falta → salário menor no cadastro → hora extra e
// desconto do mês seguinte calculados por uma base errada.
//
// Por isso a conta é: salário + adiantamento da MESMA competência, mostrado como
// SUGESTÃO ao lado do que está no cadastro. Quem decide é o RH — e quem está sem
// salário nenhum aparece em primeiro lugar, porque é para esses que o sistema
// hoje não consegue calcular nada.
// ---------------------------------------------------------------------------

/** Tipos que, somados na competência, compõem a remuneração mensal. */
const TIPOS_SALARIO = ["Salário", "Adiantamento"];

export interface SugestaoSalario {
  colaborador: Colaborador;
  /** Soma de Salário + Adiantamento na competência usada. */
  sugerido: number;
  competencia: string;
  /** O que está gravado hoje no cadastro (null = em branco). */
  atual: number | null;
  /** Quanto o sugerido difere do atual, em % (0 quando não há atual). */
  diferencaPct: number;
  /** Sem salário no cadastro: é o caso que trava o cálculo de folha. */
  semSalario: boolean;
  /** As linhas do ERP que formaram a soma — para o RH conferir a origem. */
  origem: LinhaMubi[];
}

/**
 * Monta as sugestões de salário a partir das linhas do ERP.
 *
 * Usa a competência MAIS RECENTE em que a pessoa tem salário/adiantamento — mês
 * antigo não serve de base para o contrato de hoje.
 */
export function sugerirSalarios(
  linhas: LinhaMubi[],
  colaboradores: Colaborador[],
  vinculos: Record<string, string>,
): SugestaoSalario[] {
  // colaboradorId -> competencia -> linhas
  const porPessoa = new Map<string, Map<string, LinhaMubi[]>>();
  for (const l of linhas) {
    if (!TIPOS_SALARIO.includes(l.tipo) || !l.nome.trim()) continue;
    const c = casarColaborador(l.nome, colaboradores, vinculos);
    if (!c) continue;
    const comp = competenciaDe(l);
    if (!comp) continue;
    const porComp = porPessoa.get(c.id) ?? new Map<string, LinhaMubi[]>();
    porComp.set(comp, [...(porComp.get(comp) ?? []), l]);
    porPessoa.set(c.id, porComp);
  }

  const out: SugestaoSalario[] = [];
  for (const [colaboradorId, porComp] of porPessoa) {
    const colaborador = colaboradores.find((c) => c.id === colaboradorId);
    if (!colaborador) continue;
    const competencia = [...porComp.keys()].sort().pop()!; // a mais recente
    const origem = porComp.get(competencia) ?? [];
    const sugerido = Math.round(origem.reduce((s, l) => s + (l.valor ?? 0), 0) * 100) / 100;
    if (sugerido <= 0) continue;
    const atual = colaborador.salario ?? null;
    out.push({
      colaborador, sugerido, competencia, atual,
      diferencaPct: atual ? Math.round(((sugerido - atual) / atual) * 1000) / 10 : 0,
      semSalario: atual == null,
      origem,
    });
  }

  // Quem está sem salário primeiro (é o que trava o cálculo); depois a maior
  // divergência, que é o que merece o olho do RH.
  return out.sort((a, b) =>
    Number(b.semSalario) - Number(a.semSalario) ||
    Math.abs(b.diferencaPct) - Math.abs(a.diferencaPct) ||
    a.colaborador.nome.localeCompare(b.colaborador.nome, "pt"),
  );
}
