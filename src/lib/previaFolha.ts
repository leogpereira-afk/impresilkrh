// ============================================================================
// A inteligência da prévia "Conferir importação da folha".
//
// Por que existe (07/09/2026): a prévia mostrava quatro contagens e um botão
// "Aplicar 505 alterações". "Corrigidos" recebia qualquer diferença em sete
// campos e imprimia só o valor — 20 de 21 "corrigidos" de julho eram só o
// código da conta renumerado, mostrados como "R$ X → R$ X"; uma troca de
// pessoa ou de mês era gravada mostrando só a pessoa/mês NOVA. Nenhum balde
// dizia quanto a folha de cada mês mudaria. O dono chamou a tela de "confusa
// e propícia a lançar informação errada; pode acabar com todo um trabalho".
//
// Aqui mora a conta, pura e testada: o que muda por campo, quanto cada mês
// muda em reais, os alarmes que pedem confirmação ou bloqueiam, e o retrato
// que permite desfazer. A tela só desenha.
// ============================================================================
import type { Colaborador, Pagamento } from "@/data/types";
import { chefeDasMudancas, ehManual, ehRenumeracao, fimDaCompetencia, idMubiDe, mudancas, ORDEM_CAMPOS, type CampoMudado, type DiffPagamentos, type Mudanca } from "./custos";
import { noQuadroEm } from "./quadroNoMes";
import { ehSocio } from "./societario";

export type Natureza = CampoMudado | "renumeracao";
/** Do mais grave ao mais inofensivo. Renumeração é a conta que só trocou de código. */
export const ORDEM_NATUREZAS: Natureza[] = [...ORDEM_CAMPOS.filter((c) => c !== "conta"), "conta", "renumeracao"];
/** O que NÃO conta no botão: nada de dinheiro, pessoa, mês, tipo ou data muda. */
export const NATUREZAS_SILENCIOSAS = new Set<Natureza>(["texto", "conta", "renumeracao", "adocao", "status"]);

export interface ItemAlterado { antigo: Pagamento; novo: Pagamento; muds: Mudanca[]; natureza: Natureza }
export interface GrupoAlterado { natureza: Natureza; itens: ItemAlterado[]; deltaValor: number }
export interface LinhaMes {
  competencia: string;
  hoje: number;
  depois: number;
  delta: number;
  pct: number | null;
  fechada: boolean;
  mexe: number;
  /**
   * Quanto de dinheiro o mês MEXE, em módulo — somando cada alteração, cada
   * novo e cada removido separadamente.
   *
   * Por que existe (revisão de 07/09/2026): o alarme de mês fechado olhava só
   * o `delta`. Trocar R$ 3.000 de uma pessoa para outra, ou corrigir +500 numa
   * linha e −500 noutra, dá delta zero — e um mês já fechado mudava de conteúdo
   * sem nenhuma caixa de "conferi". O saldo é o efeito no caixa; o bruto é o
   * tamanho da mexida.
   */
  bruto: number;
}
export type NivelAlarme = "bloqueia" | "confirma" | "avisa";
export interface Alarme {
  id: "busca-parcial" | "ausente-sem-dono" | "mes-fechado" | "mes-varia" | "muda-pessoa" | "muda-mes" | "muda-tipo" | "fora-do-quadro" | "remocao" | "sem-id-removido";
  nivel: NivelAlarme;
  titulo: string;
  detalhe: string;
  quantos: number;
  valor: number;
  ids: string[];
}
/**
 * A identidade de um alarme PARA EFEITO DE CONFIRMAÇÃO.
 *
 * Não é o id: o id é o tipo do alarme ("remocao"), e ele continua o mesmo
 * quando o RH marca mais linhas para remover. Confirmar "remover 1" e depois
 * marcar 74 deixava o "Conferi" marcado e o botão liberado (revisão de
 * 07/09/2026). A chave inclui quantos, quanto e QUAIS — qualquer mexida
 * desmarca a caixa sozinha.
 */
export const chaveDoAlarme = (a: Alarme): string =>
  `${a.id}|${a.nivel}|${a.quantos}|${a.valor.toFixed(2)}|${[...a.ids].sort().join(",")}`;

export interface AusentesSeparados {
  /** Vieram do ERP e não voltaram nesta busca — podem ter sumido ou mudado de mês. */
  comIdErp: Pagamento[];
  /** Vieram de planilha/migração e nunca casaram com o ERP. */
  semId: Pagamento[];
  /** O título EXISTE no ERP nesta busca, só não casou com ninguém — vincule, não remova. */
  semDono: Pagamento[];
  /**
   * O título EXISTE no ERP, mas a CONTA dele saiu da lista de folha.
   *
   * O filtro de folha é por código, e o contador renumera: a faxina já saiu da
   * lista assim. Sem este balde o lançamento aparecia como "não voltou", com
   * caixa de remover e "marcar todos" ao lado — apagar aqui destrói registro de
   * dinheiro que o ERP tem (revisão de 07/09/2026).
   */
  foraDaFolha: Pagamento[];
}
export interface ResumoDaPrevia {
  porMes: LinhaMes[];
  totalHoje: number;
  totalDepois: number;
  delta: number;
  grupos: GrupoAlterado[];
  novos: Pagamento[];
  ausentes: AusentesSeparados;
  /** Alterações que mexem em dinheiro, pessoa, mês, tipo ou data + novos + remoções marcadas. */
  contaNoBotao: number;
  /** Alterações silenciosas (texto, conta renumerada, adoção de id, status). */
  silenciosos: number;
  alarmes: Alarme[];
  podeAplicar: boolean;
  precisaConfirmar: Alarme[];
}

export interface EntradaResumo {
  diff: DiffPagamentos;
  /** A coleção inteira como está hoje. */
  gravados: Pagamento[];
  /** Competências que a busca cobriu. */
  janela: Set<string>;
  /** Ids marcados para remoção (nunca "todos" por padrão). */
  ausentesMarcados: Set<string>;
  colaboradorPor: (id: string) => Colaborador | undefined;
  tiposEncargo: readonly string[];
  hoje?: Date;
  busca?: { truncado: boolean; pedidas: string[]; lidas: string[]; falhas: string[] };
  /** idMubi dos títulos que vieram do ERP sem pessoa (não encontrados / coletivas). */
  semDono?: Set<string>;
  /** idMubi dos títulos que o ERP tem mas a conta ficou fora da lista de folha. */
  foraDaFolha?: Set<string>;
  limites?: { pctFechada: number; pctAberta: number };
}

const arred = (v: number) => Math.round(v * 100) / 100;
const num = (v: unknown) => Number(v) || 0;
const LIMITES_PADRAO = { pctFechada: 0.05, pctAberta: 0.25 };
const TIPOS_DE_QUEM_SAIU = new Set(["Rescisão", "Férias", "13º Salário", "FGTS"]);

export function classificarAlterados(diff: DiffPagamentos): ItemAlterado[] {
  return diff.alterados.map(({ antigo, novo }) => {
    const muds = mudancas(antigo, novo);
    const chefe = chefeDasMudancas(muds);
    const natureza: Natureza =
      chefe === "conta" && muds.every((m) => m.campo !== "conta" || ehRenumeracao(m)) ? "renumeracao"
      : chefe === "nada" ? "adocao"
      : chefe;
    return { antigo, novo, muds, natureza };
  });
}

export function resumoDaPrevia(e: EntradaResumo): ResumoDaPrevia {
  const hoje = e.hoje ?? new Date();
  const limites = { ...LIMITES_PADRAO, ...(e.limites ?? {}) };
  const ehSocioId = (id: string) => ehSocio(e.colaboradorPor(id) ?? null);
  // A régua do "pago à equipe", a mesma do topo da tela: sem encargo, sem sócio.
  const contaNaFolha = (p: Pagamento) => !e.tiposEncargo.includes(p.tipo) && !ehSocioId(p.colaboradorId);
  const valorFolha = (p: Pagamento) => (contaNaFolha(p) ? num(p.valor) : 0);

  const itens = classificarAlterados(e.diff);
  const grupos: GrupoAlterado[] = ORDEM_NATUREZAS
    .map((natureza) => {
      const doGrupo = itens.filter((i) => i.natureza === natureza);
      return { natureza, itens: doGrupo, deltaValor: arred(doGrupo.reduce((s, i) => s + valorFolha(i.novo) - valorFolha(i.antigo), 0)) };
    })
    .filter((g) => g.itens.length > 0);

  // ---- ausentes em três motivos ----
  const semDonoIds = e.semDono ?? new Set<string>();
  const foraDaFolhaIds = e.foraDaFolha ?? new Set<string>();
  const ausentes: AusentesSeparados = { comIdErp: [], semId: [], semDono: [], foraDaFolha: [] };
  for (const a of e.diff.ausentes) {
    const id = idMubiDe(a);
    if (id && semDonoIds.has(id)) ausentes.semDono.push(a);
    else if (id && foraDaFolhaIds.has(id)) ausentes.foraDaFolha.push(a);
    else if (id) ausentes.comIdErp.push(a);
    else ausentes.semId.push(a);
  }
  const removidos = e.diff.ausentes.filter((a) => e.ausentesMarcados.has(a.id));

  // ---- por competência: hoje × depois ----
  const comps = new Set<string>(e.janela);
  for (const i of itens) { comps.add(i.antigo.competencia); comps.add(i.novo.competencia); }
  for (const n of e.diff.novos) comps.add(n.competencia);
  for (const a of removidos) comps.add(a.competencia);
  const porMes: LinhaMes[] = [...comps].filter(Boolean).sort().map((competencia) => {
    const hojeMes = arred(e.gravados.filter((p) => p.competencia === competencia).reduce((s, p) => s + valorFolha(p), 0));
    let depoisMes = hojeMes;
    let mexe = 0;
    let bruto = 0;
    for (const i of itens) {
      // Sai do mês (o antigo estava aqui) e/ou entra no mês (o novo vem para
      // cá): cada perna conta no bruto, e a linha "mexe" no mês de DESTINO
      // também — senão a troca de competência aparecia como "—" no mês que
      // recebe o dinheiro.
      if (i.antigo.competencia === competencia) { depoisMes -= valorFolha(i.antigo); mexe++; bruto += valorFolha(i.antigo); }
      if (i.novo.competencia === competencia) {
        depoisMes += valorFolha(i.novo);
        bruto += valorFolha(i.novo);
        if (i.antigo.competencia !== competencia) mexe++;
      }
    }
    for (const n of e.diff.novos) if (n.competencia === competencia) { depoisMes += valorFolha(n); mexe++; bruto += valorFolha(n); }
    for (const a of removidos) if (a.competencia === competencia) { depoisMes -= valorFolha(a); mexe++; bruto += valorFolha(a); }
    depoisMes = arred(depoisMes);
    const delta = arred(depoisMes - hojeMes);
    const fim = fimDaCompetencia(competencia);
    const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
    const fechada = !!fim && hojeDia > fim.getTime();
    return { competencia, hoje: hojeMes, depois: depoisMes, delta, pct: hojeMes > 0 ? delta / hojeMes : null, fechada, mexe, bruto: arred(bruto) };
  });
  const totalHoje = arred(porMes.reduce((s, m) => s + m.hoje, 0));
  const totalDepois = arred(porMes.reduce((s, m) => s + m.depois, 0));

  // ---- alarmes ----
  const alarmes: Alarme[] = [];
  const soma = (xs: Pagamento[]) => arred(xs.reduce((s, p) => s + num(p.valor), 0));
  const buscaParcial = !!e.busca && (e.busca.truncado || e.busca.falhas.length > 0 || e.busca.lidas.length < e.busca.pedidas.length);
  if (buscaParcial) {
    const faltou = e.busca!.pedidas.filter((c) => !e.busca!.lidas.includes(c));
    alarmes.push({
      id: "busca-parcial", nivel: removidos.length > 0 ? "bloqueia" : "avisa",
      titulo: "A busca no ERP não cobriu tudo",
      detalhe: [e.busca!.truncado ? "veio cortada" : "", e.busca!.falhas.length ? `falhou em ${e.busca!.falhas.join(", ")}` : "", faltou.length && !e.busca!.falhas.length ? `faltou ${faltou.join(", ")}` : ""].filter(Boolean).join(" · ") + (removidos.length ? " — remover está bloqueado: o que faltou apareceria como ausente" : ""),
      quantos: faltou.length + (e.busca!.truncado ? 1 : 0), valor: 0, ids: [],
    });
  }
  const semDonoMarcados = removidos.filter((a) => ausentes.semDono.includes(a) || ausentes.foraDaFolha.includes(a));
  if (semDonoMarcados.length) {
    alarmes.push({ id: "ausente-sem-dono", nivel: "bloqueia", titulo: "Marcado para remover, mas o título existe no ERP", detalhe: "Ou não casou com ninguém nesta busca, ou a conta dele saiu da lista de folha. Vincule ou ajuste a conta — não apague.", quantos: semDonoMarcados.length, valor: soma(semDonoMarcados), ids: semDonoMarcados.map((a) => a.id) });
  }
  const semIdMarcados = removidos.filter((a) => !idMubiDe(a) && !ehManual(a));
  if (semIdMarcados.length) {
    alarmes.push({ id: "sem-id-removido", nivel: "confirma", titulo: "Remoção de lançamento que não veio do ERP", detalhe: "Veio de planilha ou foi lançado à mão sem a marca. Não existir no Mubisys é a natureza dele — confira antes.", quantos: semIdMarcados.length, valor: soma(semIdMarcados), ids: semIdMarcados.map((a) => a.id) });
  }
  // Mês fechado que MEXE (bruto), e não só o que muda de saldo: troca de pessoa
  // dentro do mesmo mês tem delta zero e continua sendo alteração de mês fechado.
  const fechadasQueMudam = porMes.filter((m) => m.fechada && m.bruto > 0.005);
  if (fechadasQueMudam.length) {
    const forte = fechadasQueMudam.filter((m) => m.pct == null || Math.abs(m.pct) > limites.pctFechada || (m.hoje > 0 && m.bruto / m.hoje > limites.pctFechada));
    alarmes.push({
      id: "mes-fechado", nivel: forte.length ? "confirma" : "avisa",
      titulo: `${fechadasQueMudam.length} mês(es) fechado(s) mudam de valor`,
      detalhe: fechadasQueMudam.map((m) => `${m.competencia}: ${m.delta > 0 ? "+" : "−"}${Math.abs(m.delta).toFixed(2)} de saldo, ${m.bruto.toFixed(2)} de mexida`).join(" · "),
      quantos: fechadasQueMudam.length, valor: arred(fechadasQueMudam.reduce((s, m) => s + m.delta, 0)), ids: fechadasQueMudam.map((m) => m.competencia),
    });
  }
  const abertasQueSaltam = porMes.filter((m) => !m.fechada && m.pct != null && Math.abs(m.pct) > limites.pctAberta);
  if (abertasQueSaltam.length) {
    alarmes.push({ id: "mes-varia", nivel: "confirma", titulo: `${abertasQueSaltam.length} mês(es) varia(m) mais de ${Math.round(limites.pctAberta * 100)}%`, detalhe: abertasQueSaltam.map((m) => `${m.competencia}: ${(m.pct! * 100).toFixed(1)}%`).join(" · "), quantos: abertasQueSaltam.length, valor: arred(abertasQueSaltam.reduce((s, m) => s + m.delta, 0)), ids: abertasQueSaltam.map((m) => m.competencia) });
  }
  const mudaPessoa = itens.filter((i) => i.muds.some((m) => m.campo === "pessoa"));
  if (mudaPessoa.length) alarmes.push({ id: "muda-pessoa", nivel: "confirma", titulo: `${mudaPessoa.length} lançamento(s) trocam de pessoa`, detalhe: "O dinheiro sai de uma ficha e entra em outra. Confira o vínculo antes de aplicar.", quantos: mudaPessoa.length, valor: soma(mudaPessoa.map((i) => i.novo)), ids: mudaPessoa.map((i) => i.antigo.id) });
  const mudaMes = itens.filter((i) => i.muds.some((m) => m.campo === "mes"));
  if (mudaMes.length) alarmes.push({ id: "muda-mes", nivel: "confirma", titulo: `${mudaMes.length} lançamento(s) trocam de mês`, detalhe: "O vencimento cruzou o dia 15: sai de um mês e entra no outro.", quantos: mudaMes.length, valor: soma(mudaMes.map((i) => i.novo)), ids: mudaMes.map((i) => i.antigo.id) });
  const mudaTipo = itens.filter((i) => i.muds.some((m) => m.campo === "tipo"));
  if (mudaTipo.length) alarmes.push({ id: "muda-tipo", nivel: "confirma", titulo: `${mudaTipo.length} lançamento(s) trocam de tipo`, detalhe: "Se você corrigiu o tipo à mão, a importação desfaz. Confira o de → para.", quantos: mudaTipo.length, valor: soma(mudaTipo.map((i) => i.novo)), ids: mudaTipo.map((i) => i.antigo.id) });
  const foraDoQuadro = e.diff.novos.filter((n) => { const c = e.colaboradorPor(n.colaboradorId); return c && !ehSocio(c) && !noQuadroEm(c, n.competencia); });
  if (foraDoQuadro.length) {
    const acerto = foraDoQuadro.filter((n) => TIPOS_DE_QUEM_SAIU.has(n.tipo));
    const suspeito = foraDoQuadro.filter((n) => !TIPOS_DE_QUEM_SAIU.has(n.tipo));
    if (suspeito.length) alarmes.push({ id: "fora-do-quadro", nivel: "confirma", titulo: `${suspeito.length} lançamento(s) novo(s) para quem não estava no quadro do mês`, detalhe: "Salário ou verba para quem já tinha saído, ou ainda não tinha entrado. Ou o cadastro está sem a data certa, ou o título é de outra pessoa.", quantos: suspeito.length, valor: soma(suspeito), ids: suspeito.map((n) => n.id) });
    if (acerto.length) alarmes.push({ id: "fora-do-quadro", nivel: "avisa", titulo: `${acerto.length} acerto(s) de quem saiu`, detalhe: "Rescisão, férias, 13º ou FGTS depois do desligamento — é o esperado.", quantos: acerto.length, valor: soma(acerto), ids: acerto.map((n) => n.id) });
  }
  if (removidos.length) alarmes.push({ id: "remocao", nivel: "confirma", titulo: `${removidos.length} lançamento(s) serão removidos`, detalhe: "Somem da tela e ficam arquivados no banco. Título que o ERP ainda tem não volta sozinho depois.", quantos: removidos.length, valor: soma(removidos), ids: removidos.map((a) => a.id) });

  const silenciosos = itens.filter((i) => NATUREZAS_SILENCIOSAS.has(i.natureza)).length;
  const contaNoBotao = (itens.length - silenciosos) + e.diff.novos.length + removidos.length;
  const podeAplicar = !alarmes.some((a) => a.nivel === "bloqueia");
  return {
    porMes, totalHoje, totalDepois, delta: arred(totalDepois - totalHoje),
    grupos, novos: e.diff.novos, ausentes, contaNoBotao, silenciosos,
    alarmes, podeAplicar, precisaConfirmar: alarmes.filter((a) => a.nivel === "confirma"),
  };
}

// ============================================================================
// Retrato para desfazer. Guarda SÓ os registros tocados, cada um com antes e
// depois — nunca a competência inteira, senão desfazer devolveria também o que
// o RH editou depois. Desfaz só o registro cujo estado atual é IDÊNTICO ao
// "depois" gravado; o resto fica como está e é listado.
// ============================================================================
export interface Tocado { id: string; antes: Pagamento | null; depois: Pagamento | null }
export interface RetratoFolha { id: string; em: string; competencias: string[]; tocados: Tocado[]; usado?: boolean; rotulo?: string }

const semCarimbo = (p: Pagamento | null): Record<string, unknown> | null => {
  if (!p) return null;
  const r = { ...(p as unknown as Record<string, unknown>) };
  delete r.atualizadoEm; delete r._rhRev; delete r.importadoEm; delete r.buscadoEm; delete r.sincronizadoEm;
  return r;
};
export const mesmoConteudo = (a: Pagamento | null, b: Pagamento | null): boolean =>
  JSON.stringify(semCarimbo(a), Object.keys(semCarimbo(a) ?? {}).sort()) === JSON.stringify(semCarimbo(b), Object.keys(semCarimbo(b) ?? {}).sort());

/**
 * O que a aplicação grava por cima de um registro alterado — os campos do ERP,
 * e só eles. É a MESMA lista que aplicarFolha usa: o retrato do "depois" tem
 * de ser exatamente o que vai ficar gravado, senão desfazer não reconhece.
 */
export function patchDeAplicacao(novo: Pagamento): Partial<Pagamento> {
  return {
    colaboradorId: novo.colaboradorId,
    competencia: novo.competencia,
    tipo: novo.tipo,
    valor: novo.valor,
    dataPagamento: novo.dataPagamento,
    descricao: novo.descricao,
    idMubi: novo.idMubi ?? null,
    ...(novo.statusErp !== undefined ? { statusErp: novo.statusErp } : {}),
    ...(novo.pagoEm !== undefined ? { pagoEm: novo.pagoEm } : {}),
    ...(novo.casadoPor !== undefined ? { casadoPor: novo.casadoPor } : {}),
  };
}

/**
 * O que o "Desfazer" grava para voltar ao `antes`.
 *
 * Diferente do patch de aplicação num ponto que importa: statusErp e pagoEm
 * vão SEMPRE, com null quando o registro anterior não os tinha. Sem isso o
 * desfazer devolvia o valor velho mas deixava o estado e a data de pagamento
 * que a aplicação escreveu — um "antes" que nunca existiu.
 */
export function patchDeDesfazer(antes: Pagamento): Partial<Pagamento> {
  return {
    colaboradorId: antes.colaboradorId,
    competencia: antes.competencia,
    tipo: antes.tipo,
    valor: antes.valor,
    dataPagamento: antes.dataPagamento,
    descricao: antes.descricao,
    idMubi: antes.idMubi ?? null,
    statusErp: antes.statusErp ?? null,
    pagoEm: antes.pagoEm ?? null,
  } as Partial<Pagamento>;
}

/**
 * O retrato do que a aplicação vai tocar.
 *
 * `atuais` é o que está gravado NA HORA DE APLICAR, e não o que a busca viu.
 * A prévia congela o diff no momento da busca; entre ela e o clique passam
 * minutos, e o sync puxa a cada 20 segundos. Se o retrato guardasse o `antigo`
 * congelado, "Desfazer" devolveria um valor anterior à edição que chegou no
 * meio — apagando o trabalho de quem editou, sem aviso (revisão de 07/09/2026).
 */
export function retratoAntesDeAplicar(
  diff: DiffPagamentos,
  ausentesMarcados: Set<string>,
  agoraIso: string,
  rotulo?: string,
  atuais: Pagamento[] = [],
): RetratoFolha {
  const vivo = new Map(atuais.map((p) => [p.id, p]));
  const tocados: Tocado[] = [];
  const comps = new Set<string>();
  for (const { antigo, novo } of diff.alterados) {
    const antes = vivo.get(antigo.id) ?? antigo;
    tocados.push({ id: antigo.id, antes, depois: { ...antes, ...patchDeAplicacao(novo) } });
    comps.add(antigo.competencia); comps.add(novo.competencia);
  }
  for (const n of diff.novos) { tocados.push({ id: n.id, antes: null, depois: n }); comps.add(n.competencia); }
  for (const a of diff.ausentes) if (ausentesMarcados.has(a.id)) { tocados.push({ id: a.id, antes: vivo.get(a.id) ?? a, depois: null }); comps.add(a.competencia); }
  return { id: `desfazer_${agoraIso}`, em: agoraIso, competencias: [...comps].filter(Boolean).sort(), tocados, rotulo };
}

/**
 * O que mudou embaixo da prévia enquanto ela estava aberta.
 *
 * Devolve os registros que a aplicação ia tocar e que JÁ NÃO SÃO o que a busca
 * viu — porque outro aparelho editou (o pull roda a cada 20 s) ou porque
 * sumiram. Aplicar em cima disso grava por cima de uma edição que ninguém viu
 * na tela e ainda a esconde do "Desfazer": o retrato acharia que o "antes" era
 * o valor velho. Quem chama aborta e manda refazer a busca.
 */
export function mudouSobAPrevia(diff: DiffPagamentos, ausentesMarcados: Set<string>, atuais: Pagamento[]): { id: string; motivo: "editado" | "sumiu" }[] {
  const vivo = new Map(atuais.map((p) => [p.id, p]));
  const fora: { id: string; motivo: "editado" | "sumiu" }[] = [];
  const conferir = (p: Pagamento) => {
    const atual = vivo.get(p.id);
    if (!atual) { fora.push({ id: p.id, motivo: "sumiu" }); return; }
    if (!mesmoConteudo(atual, p)) fora.push({ id: p.id, motivo: "editado" });
  };
  for (const { antigo } of diff.alterados) conferir(antigo);
  for (const { antigo } of diff.iguais) conferir(antigo);
  for (const a of diff.ausentes) if (ausentesMarcados.has(a.id)) conferir(a);
  return fora;
}

export interface PlanoDeDesfazer {
  restaurar: Pagamento[];
  apagar: string[];
  /** Removidos pela importação: não voltam por aqui (lápide no servidor). */
  semVolta: Pagamento[];
  pulados: { id: string; motivo: "editado depois" | "já desfeito" | "sumiu depois" }[];
}

export function planoDeDesfazer(retrato: RetratoFolha, atuais: Pagamento[]): PlanoDeDesfazer {
  const porId = new Map(atuais.map((p) => [p.id, p]));
  const plano: PlanoDeDesfazer = { restaurar: [], apagar: [], semVolta: [], pulados: [] };
  for (const t of retrato.tocados) {
    const atual = porId.get(t.id) ?? null;
    if (t.antes && !t.depois) { plano.semVolta.push(t.antes); continue; } // removido: lápide
    if (t.antes && t.depois) {
      if (!atual) { plano.pulados.push({ id: t.id, motivo: "sumiu depois" }); continue; }
      if (mesmoConteudo(atual, t.antes)) { plano.pulados.push({ id: t.id, motivo: "já desfeito" }); continue; }
      if (!mesmoConteudo(atual, t.depois)) { plano.pulados.push({ id: t.id, motivo: "editado depois" }); continue; }
      plano.restaurar.push(t.antes); continue;
    }
    if (!t.antes && t.depois) {
      if (!atual) { plano.pulados.push({ id: t.id, motivo: "já desfeito" }); continue; }
      if (!mesmoConteudo(atual, t.depois)) { plano.pulados.push({ id: t.id, motivo: "editado depois" }); continue; }
      plano.apagar.push(t.id);
    }
  }
  return plano;
}
