import { useEffect, useMemo, useRef, useState } from "react";
import {
  Wallet,
  Users,
  Upload,
  Settings2,
  TrendingUp,
  Coins,
  ReceiptText,
  Layers,
  UserCircle2,
  ShieldCheck,
  FileSpreadsheet,
  Plus,
  Plane,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  RefreshCw,
  Clock,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { ViagensPainel } from "@/pages/Viagens";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState, Progress } from "@/components/ui/misc";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { Select, Campo, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { BarrasVerticais } from "@/components/charts/charts";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { calcularEncargos, PREFIXO_FUNCIONARIOS } from "@/lib/encargos";
import { podeGerir } from "@/lib/rbac";
import { formatBRL } from "@/lib/format";
import { somaPorTipo, corDoTipo, TIPOS_PAGAMENTO, TIPOS_ENCARGO } from "@/lib/folha";
import { buscarPagamentosMubi, paraRegistros, norm as normNome, type LinhaMubi, type RespostaMubi } from "@/lib/mubiPagamentos";
import {
  classeMap,
  competenciasPlano,
  compLabel,
  compLabelLongo,
  folhasDoMes,
  totaisDoMes,
  serieCustos,
  CLASSE_LABEL,
  parsePlanoContas,
  parsePagamentos,
  parseComissoesPorNome,
  conciliarPagamentos,
  ehContaConfidencial,
  type DiffPagamentos,
} from "@/lib/custos";
import { lerPlanilha } from "@/lib/xlsx-lite";
import { enviarColecao, apagarRegistrosNuvem, enviarConfigNuvem } from "@/lib/sync";
import type {
  ClassificacaoConta,
  ClasseCusto,
  Colaborador,
  ContaPlano,
  Pagamento,
} from "@/data/types";

// Classes disponíveis no editor (confidencial fica fora — societárias só do master).
const CLASSES_EDITAVEIS: ClasseCusto[] = ["individual", "rateio", "encargo", "ignorar"];

// Última busca automática no ERP que FALHOU. Fica fora do componente de
// propósito: Custos é rota lazy, então um useRef morre ao navegar e, com o ERP
// fora do ar, cada volta à tela refazia a chamada de ~40s em silêncio. Não vai
// para a config (é sinal de rede, não dado do RH); recarregar a página tenta de novo.
let ultimaFalhaMubi: { competencia: string; em: number } | null = null;
const ESPERA_APOS_FALHA_MS = 30 * 60 * 1000;

export default function Custos() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const drill = useDrill();

  const config = useConfig(); // guarda o último mês buscado no ERP e os vínculos
  // salvarConfig só escreve no navegador. Os vínculos de nome do ERP são trabalho
  // manual do RH e precisam valer em qualquer computador — por isso todo salvar
  // daqui sobe para a nuvem, igual ao Painel de Controle.
  const salvarCfg = (patch: Parameters<typeof salvarConfig>[0]) => { salvarConfig(patch); enviarConfigNuvem(); };
  const planoColecao = useColecao("planoContas");
  const classifColecao = useColecao("classificacaoCustos");
  const pagamentosColecao = useColecao("pagamentos");
  const colaboradoresColecao = useColecao("colaboradores");
  const planoContas = planoColecao.items;
  const classificacaoCustos = classifColecao.items;
  const pagamentos = pagamentosColecao.items;

  // ---------- Estado (hooks SEMPRE antes de qualquer return) ----------
  const competencias = useMemo(() => competenciasPlano(planoContas), [planoContas]);
  const ultimaComp = competencias[competencias.length - 1] ?? "";
  const [comp, setComp] = useState<string>(ultimaComp);

  const ativosOrdenados = useMemo(
    () => [...d.ativos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [d.ativos],
  );
  const [colabId, setColabId] = useState<string>(ativosOrdenados[0]?.id ?? "");

  const [comAdiantamento, setComAdiantamento] = useState<boolean>(true);
  const [comEncargos, setComEncargos] = useState<boolean>(true);
  const [rateioPorPessoa, setRateioPorPessoa] = useState<boolean>(false);

  const [editorAberto, setEditorAberto] = useState<boolean>(false);

  // Lançamento manual (preencher itens faltantes na folha real, ex.: comissão).
  const [addLanc, setAddLanc] = useState<boolean>(false);
  const [lancTipo, setLancTipo] = useState<string>("Comissão");
  const [lancValor, setLancValor] = useState<string>("");
  const [lancDesc, setLancDesc] = useState<string>("");
  const [lancEditId, setLancEditId] = useState<string | null>(null);
  const [pagExcluir, setPagExcluir] = useState<string | null>(null);

  // Competência efetiva (cai para a última quando a selecionada some / inicial vazia).
  const compAtiva = comp && competencias.includes(comp) ? comp : ultimaComp;

  // Navegação por setas: entre colaboradores (‹ ›, circular) e entre meses (‹ ›).
  const idxColab = ativosOrdenados.findIndex((c) => c.id === colabId);
  const irColab = (delta: number) => {
    if (!ativosOrdenados.length) return;
    const base = idxColab < 0 ? 0 : idxColab;
    setColabId(ativosOrdenados[(base + delta + ativosOrdenados.length) % ativosOrdenados.length].id);
  };
  const idxComp = competencias.indexOf(compAtiva);
  const irMes = (delta: number) => {
    const i = idxComp + delta;
    if (i >= 0 && i < competencias.length) setComp(competencias[i]);
  };
  const nColab = d.ativos.length;
  const mapaClasse = useMemo(() => classeMap(classificacaoCustos), [classificacaoCustos]);

  // ---------- Uploads ----------
  const refPlano = useRef<HTMLInputElement>(null);
  const refPagts = useRef<HTMLInputElement>(null);
  const hojeIso = new Date().toISOString().slice(0, 7);
  const [compUpload, setCompUpload] = useState<string>(ultimaComp || hojeIso);
  // Importação avulsa de comissões, casando por NOME (caso à parte)
  const refComissoesNome = useRef<HTMLInputElement>(null);
  const [comissoesPrev, setComissoesPrev] = useState<{ registros: Pagamento[]; naoCasados: string[]; total: number } | null>(null);
  // Prévia de conciliação da folha (subir a mesma planilha: mexe só no diferente).
  const [folhaPrev, setFolhaPrev] = useState<{
    diff: DiffPagamentos;
    naoCasados: string[];
    cpfsAprendidos: { colaboradorId: string; cpf: string }[];
    totalLinhas: number;
    // Presente só quando a origem foi o ERP (para mostrar as despesas coletivas
    // e permitir vincular quem não casou).
    mubi?: { linhas: LinhaMubi[]; coletivas: LinhaMubi[]; truncado: boolean };
  } | null>(null);
  const [removerAusentes, setRemoverAusentes] = useState(false);
  // Busca no ERP Mubisys
  const [compMubi, setCompMubi] = useState<string>(() => config.ultimaBuscaMubi?.competencia || ultimaComp || hojeIso);
  const [buscandoMubi, setBuscandoMubi] = useState(false);
  const [erroMubi, setErroMubi] = useState("");
  // Resultado da busca automática, esperando o RH querer revisar.
  const [respostaMubi, setRespostaMubi] = useState<RespostaMubi | null>(null);
  // Quantos daqueles lançamentos já casam com alguém do cadastro. É a MESMA
  // contagem gravada em "Última busca" — sem isso o aviso mostra o total do ERP
  // e a linha de baixo mostra os vinculados, dois números diferentes no mesmo card.
  const vinculadosDaResposta = useMemo(
    () => (respostaMubi ? paraRegistros(respostaMubi.linhas, d.colaboradores, config.vinculosMubi ?? {}).registros.length : 0),
    [respostaMubi, d.colaboradores, config.vinculosMubi],
  );

  const importarPlano = async (file: File) => {
    try {
      const linhas = await lerPlanilha(file);
      const novos = parsePlanoContas(linhas, compUpload);
      if (novos.length === 0) {
        toast("Nenhuma conta reconhecida na planilha.", "erro");
        return;
      }
      const novosIds = new Set(novos.map((n: ContaPlano) => n.id));
      const removidos = planoContas.filter((p: ContaPlano) => p.competencia === compUpload && !novosIds.has(p.id)).map((p: ContaPlano) => p.id);
      planoColecao.definir([
        ...planoContas.filter((p: ContaPlano) => p.competencia !== compUpload),
        ...novos,
      ]);
      apagarRegistrosNuvem("planoContas", removidos); // lápide nas contas substituídas
      void enviarColecao("planoContas"); // sobe pra nuvem na hora
      setComp(compUpload);
      toast(`Plano de contas importado: ${novos.length} contas em ${compLabel(compUpload)}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao ler a planilha.", "erro");
    }
  };

  // Busca a folha do mês direto no Contas a Pagar do Mubisys e cai na MESMA
  // prévia de conciliação da planilha — nada é gravado sem o RH confirmar.
  // Monta a prévia de conciliação a partir do que veio do ERP.
  const previaDoMubi = (r: RespostaMubi, vinculos: Record<string, string>) => {
    const { registros, naoCasados, coletivas } = paraRegistros(r.linhas, d.colaboradores, vinculos);
    // Compara contra as competências dos REGISTROS, não contra o mês pedido: uma
    // busca pode gerar lançamentos em mais de uma competência e o que ficasse de
    // fora da comparação voltaria como "novo" (duplicata). Mesmo critério de
    // vincularMubi e da importação por planilha.
    const comps = new Set(registros.map((x) => x.competencia));
    const existentesDaComp = pagamentos.filter((p: Pagamento) => comps.has(p.competencia));
    setRemoverAusentes(false);
    setFolhaPrev({
      diff: conciliarPagamentos(existentesDaComp, registros),
      naoCasados, cpfsAprendidos: [], totalLinhas: registros.length,
      mubi: { linhas: r.linhas, coletivas, truncado: r.truncado },
    });
    setRespostaMubi(null);
  };

  const buscarDoMubi = async (competencia: string, abrirPrevia = true) => {
    if (!/^\d{4}-\d{2}$/.test(competencia)) { setErroMubi("Escolha o mês."); return; }
    setBuscandoMubi(true);
    setErroMubi("");
    try {
      const r = await buscarPagamentosMubi(competencia);
      ultimaFalhaMubi = null;
      const vinculos = config.vinculosMubi ?? {};
      const { registros, naoCasados } = paraRegistros(r.linhas, d.colaboradores, vinculos);
      salvarCfg({ ultimaBuscaMubi: { competencia, em: r.buscadoEm, quantidade: registros.length } });
      if (registros.length === 0 && naoCasados.length === 0) {
        if (abrirPrevia) setErroMubi(`O Mubisys não tem lançamentos de pessoal em ${compLabel(competencia)}.`);
        return;
      }
      // Busca automática não abre janela por cima do que a pessoa está fazendo:
      // guarda o resultado e avisa; a prévia abre quando ela quiser.
      if (abrirPrevia) previaDoMubi(r, vinculos); else setRespostaMubi(r);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao consultar o Mubisys.";
      if (abrirPrevia) { setErroMubi(msg); toast(msg, "erro"); }
      else {
        // Falha na busca automática não pode passar em branco: sem registrar a
        // tentativa, cada volta à tela repetia a chamada de ~40s; e sem aviso o
        // RH acha que a tela já está atualizada com o ERP.
        ultimaFalhaMubi = { competencia, em: Date.now() };
        setErroMubi(`Não consegui falar com o ERP agora (${msg}). A tela mostra o que já estava gravado — use "Buscar do Mubisys" para tentar de novo.`);
      }
    } finally {
      setBuscandoMubi(false);
    }
  };

  // Busca automática ao abrir a tela: só do mês corrente e no máximo uma vez a
  // cada 6 horas (a chamada ao ERP leva ~40s e não pode virar rotina a cada
  // clique). O resultado vira um aviso, não um modal.
  const jaBuscouRef = useRef(false);
  useEffect(() => {
    if (jaBuscouRef.current || !podeGerir(sessao)) return;
    const agora = new Date();
    const compAtual = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
    const ultima = config.ultimaBuscaMubi;
    const recente = ultima?.competencia === compAtual && ultima.em
      && agora.getTime() - new Date(ultima.em).getTime() < 6 * 60 * 60 * 1000;
    // Se o ERP acabou de recusar a conversa, espera meia hora antes de insistir
    // (a chamada custa ~40s e a falha costuma durar alguns minutos).
    const falhouHaPouco = ultimaFalhaMubi?.competencia === compAtual
      && agora.getTime() - ultimaFalhaMubi.em < ESPERA_APOS_FALHA_MS;
    if (recente || falhouHaPouco) return;
    jaBuscouRef.current = true;
    void buscarDoMubi(compAtual, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessao]);

  // Vincula um nome do ERP a um colaborador e REFAZ a prévia na hora, com o
  // pagamento já no lugar certo. O vínculo fica guardado (e sobe para a nuvem):
  // no mês que vem esse mesmo nome casa sozinho, em qualquer computador.
  const vincularMubi = (nomeMubi: string, colaboradorId: string) => {
    if (!folhaPrev?.mubi) return;
    const chave = normNome(nomeMubi);
    const vinculos = { ...(config.vinculosMubi ?? {}) };
    if (colaboradorId) vinculos[chave] = colaboradorId;
    else delete vinculos[chave];
    salvarCfg({ vinculosMubi: vinculos });

    const { registros, naoCasados, coletivas } = paraRegistros(folhaPrev.mubi.linhas, d.colaboradores, vinculos);
    const comps = new Set(registros.map((r) => r.competencia));
    const existentesDaComp = pagamentos.filter((p: Pagamento) => comps.has(p.competencia));
    setFolhaPrev({
      diff: conciliarPagamentos(existentesDaComp, registros),
      naoCasados, cpfsAprendidos: [], totalLinhas: registros.length,
      mubi: { ...folhaPrev.mubi, coletivas },
    });
  };

  // Lê a planilha e monta a PRÉVIA de conciliação (não aplica nada ainda). Subir a
  // mesma planilha de novo mostra o que é igual, o que mudou e o que é novo.
  const importarPagamentos = async (file: File) => {
    try {
      const linhas = await lerPlanilha(file);
      const { registros, naoCasados, cpfsAprendidos } = parsePagamentos(linhas, d.colaboradores);
      if (registros.length === 0) {
        toast("Nenhum pagamento reconhecido na planilha.", "erro");
        return;
      }
      const compsImportadas = new Set(registros.map((r: Pagamento) => r.competencia));
      const existentesDaComp = pagamentos.filter((p: Pagamento) => compsImportadas.has(p.competencia));
      const diff = conciliarPagamentos(existentesDaComp, registros);
      setRemoverAusentes(false);
      setFolhaPrev({ diff, naoCasados, cpfsAprendidos, totalLinhas: registros.length });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao ler a planilha.", "erro");
    }
  };

  // Aplica a prévia: mexe SÓ no que mudou (corrige valores, insere novos, atualiza
  // descrições) e, opcionalmente, remove os ausentes. Iguais sem mudança não são tocados.
  const aplicarFolha = () => {
    if (!folhaPrev) return;
    const { diff, cpfsAprendidos } = folhaPrev;
    const nd = (s?: string) => (s ?? "").trim();
    // Linhas iguais (mesmo valor) cuja DESCRIÇÃO mudou — atualiza só o texto.
    let descAtualizadas = 0;
    for (const { antigo, novo } of diff.iguais) {
      if (nd(antigo.descricao) !== nd(novo.descricao)) {
        pagamentosColecao.atualizar(antigo.id, { descricao: novo.descricao || undefined });
        descAtualizadas++;
      }
    }
    for (const { antigo, novo } of diff.alterados) {
      pagamentosColecao.atualizar(antigo.id, { valor: novo.valor, dataPagamento: novo.dataPagamento, descricao: novo.descricao });
    }
    for (const n of diff.novos) pagamentosColecao.criar(n);
    // Se a busca no ERP veio cortada, "ausente" não quer dizer "saiu da folha" —
    // pode ser só o que não coube na busca. Nesse caso nunca apaga.
    const podeRemover = removerAusentes && !folhaPrev.mubi?.truncado;
    if (podeRemover) {
      for (const a of diff.ausentes) pagamentosColecao.remover(a.id);
    }
    // Preenche o CPF no cadastro (só onde está vazio).
    let cpfsPreenchidos = 0;
    if (cpfsAprendidos.length) {
      const mapa = new Map(cpfsAprendidos.map((x) => [x.colaboradorId, x.cpf]));
      const atualizados = colaboradoresColecao.items.map((c) => {
        const cpf = mapa.get(c.id);
        if (cpf && !c.cpf) { cpfsPreenchidos++; return { ...c, cpf }; }
        return c;
      });
      if (cpfsPreenchidos) { colaboradoresColecao.definir(atualizados); void enviarColecao("colaboradores"); }
    }
    const mexeu = descAtualizadas + diff.alterados.length + diff.novos.length + (podeRemover ? diff.ausentes.length : 0);
    const avisoCpf = cpfsPreenchidos ? ` CPF preenchido em ${cpfsPreenchidos} colaborador(es).` : "";
    toast(
      mexeu === 0
        ? "Planilha idêntica ao que já estava — nada a alterar."
        : `Folha conciliada: ${diff.alterados.length} corrigido(s), ${diff.novos.length} novo(s)${descAtualizadas ? `, ${descAtualizadas} descrição(ões) atualizada(s)` : ""}${podeRemover && diff.ausentes.length ? `, ${diff.ausentes.length} removido(s)` : ""}.${avisoCpf}`,
      "sucesso",
    );
    setFolhaPrev(null);
  };

  // Comissões avulsas (casadas por NOME): lê e abre a prévia.
  const abrirComissoesNome = async (file: File) => {
    try {
      const linhas = await lerPlanilha(file);
      const res = parseComissoesPorNome(linhas, d.colaboradores);
      if (res.registros.length === 0 && res.naoCasados.length === 0) { toast("Nenhuma comissão reconhecida na planilha.", "erro"); return; }
      setComissoesPrev(res);
    } catch (e) { toast(e instanceof Error ? e.message : "Falha ao ler a planilha.", "erro"); }
  };
  // Aplica: substitui as comissões das competências afetadas e insere as novas.
  const aplicarComissoesNome = () => {
    if (!comissoesPrev) return;
    const comps = new Set(comissoesPrev.registros.map((r) => r.competencia));
    const novosIds = new Set(comissoesPrev.registros.map((r) => r.id));
    const removidos = pagamentos.filter((p: Pagamento) => p.tipo === "Comissão" && comps.has(p.competencia) && !novosIds.has(p.id)).map((p: Pagamento) => p.id);
    pagamentosColecao.definir([
      ...pagamentos.filter((p: Pagamento) => !(p.tipo === "Comissão" && comps.has(p.competencia))),
      ...comissoesPrev.registros,
    ]);
    apagarRegistrosNuvem("pagamentos", removidos); // lápide nos antigos (não voltam da nuvem)
    void enviarColecao("pagamentos"); // sobe pra nuvem na hora
    toast(`${comissoesPrev.registros.length} comissão(ões) lançada(s) — já somam nos totais.`);
    setComissoesPrev(null);
  };

  // ---------- Seção 1: custo individual por colaborador ----------
  const pagsDoColab = useMemo(
    () => pagamentos.filter((p: Pagamento) => p.colaboradorId === colabId && p.competencia === compAtiva),
    [pagamentos, colabId, compAtiva],
  );
  const linhasColab = useMemo(() => somaPorTipo(pagsDoColab), [pagsDoColab]);

  // ---------- Resumo geral do mês (folha de todos os colaboradores) ----------
  const pagsDoMes = useMemo(() => pagamentos.filter((p: Pagamento) => p.competencia === compAtiva), [pagamentos, compAtiva]);
  const linhasMes = useMemo(() => somaPorTipo(pagsDoMes), [pagsDoMes]);
  const totalMes = useMemo(() => linhasMes.reduce((s, l) => s + l.valor, 0), [linhasMes]);
  const pessoasNoMes = useMemo(() => new Set(pagsDoMes.map((p) => p.colaboradorId)).size, [pagsDoMes]);
  // Só para o drill-down dos cards: quem são as pessoas por trás da folha do mês.
  const colabsPagosNoMes = useMemo(
    () =>
      [...new Set(pagsDoMes.map((p: Pagamento) => p.colaboradorId))]
        .map((id) => d.colabById.get(id))
        .filter((c): c is Colaborador => !!c)
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [pagsDoMes, d.colabById],
  );
  // No modo "Só Salário" excluímos o tipo "Adiantamento" (a soma não duplica).
  const linhasConsideradas = useMemo(
    () => (comAdiantamento ? linhasColab : linhasColab.filter((l) => l.tipo !== "Adiantamento")),
    [linhasColab, comAdiantamento],
  );
  // Custo pago = o que foi pago À PESSOA. Exclui encargos (FGTS lançado), que são
  // custo da empresa, não pagamento ao colaborador.
  const custoPago = useMemo(() => linhasConsideradas.filter((l) => !TIPOS_ENCARGO.includes(l.tipo)).reduce((s, l) => s + l.valor, 0), [linhasConsideradas]);
  // FGTS real lançado para a pessoa (ex.: rescisão) — encargo, entra no custo real.
  const fgtsLancado = useMemo(() => linhasColab.filter((l) => l.tipo === "FGTS").reduce((s, l) => s + l.valor, 0), [linhasColab]);

  // Bruto = base dos encargos (Salário + Adiantamento), independente do toggle de
  // adiantamento. Faxina/extras entram no total pago, mas não nesta base.
  // Regras de encargo vivem em lib/encargos.ts (com testes) — aqui só o uso.
  const enc = useMemo(() => calcularEncargos(linhasColab, fgtsLancado), [linhasColab, fgtsLancado]);
  const { bruto, fgts, decimoTerceiro: prov13, ferias: provFerias, total: encargos } = enc;
  const custoReal = custoPago + encargos;
  const custoTotalColab = comEncargos ? custoReal : custoPago;
  const colabSel = d.colabById.get(colabId);

  // ---------- Seção 1b: histórico do colaborador (mês a mês) + acumulado ----------
  const historicoColab = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pagamentos as Pagamento[]) {
      if (p.colaboradorId !== colabId) continue;
      m.set(p.competencia, (m.get(p.competencia) ?? 0) + p.valor);
    }
    return [...m.keys()].sort().map((c) => ({ competencia: c, nome: compLabel(c), valor: m.get(c) ?? 0 }));
  }, [pagamentos, colabId]);
  const acumuladoColab = useMemo(() => historicoColab.reduce((s, x) => s + x.valor, 0), [historicoColab]);
  const mediaColab = historicoColab.length ? acumuladoColab / historicoColab.length : 0;

  // ---------- Seção 2: custos coletivos (rateio) ----------
  const totais = useMemo(
    () => totaisDoMes(planoContas, mapaClasse, compAtiva, nColab),
    [planoContas, mapaClasse, compAtiva, nColab],
  );
  const totalColetivo = totais.individual + totais.rateio;
  const divisor = rateioPorPessoa && nColab > 0 ? nColab : 1;

  // ---------- Seção 3: evolução mês a mês ----------
  const serie = useMemo(
    () => serieCustos(planoContas, mapaClasse, nColab),
    [planoContas, mapaClasse, nColab],
  );
  const dadosEvolucao = useMemo(
    () => serie.map((s) => ({ nome: s.nome, valor: Math.round(s.medioIndividual) })),
    [serie],
  );

  // ---------- Editor de classificação ----------
  // Contas societárias confidenciais (2.14.*) NUNCA aparecem no editor de
  // classificação — independentemente de já estarem classificadas — para que
  // ninguém (nem gestor) consiga jogá-las no rateio público.
  const folhasEditor = useMemo(
    () =>
      folhasDoMes(planoContas, compAtiva)
        .filter((p: ContaPlano) => !ehContaConfidencial(p.codigo))
        .sort((a: ContaPlano, b: ContaPlano) => b.valor - a.valor),
    [planoContas, compAtiva],
  );

  const definirClasse = (conta: ContaPlano, classe: ClasseCusto) => {
    if (ehContaConfidencial(conta.codigo)) return; // não reclassificar confidenciais
    const existente = classificacaoCustos.find((c: ClassificacaoConta) => c.codigo === conta.codigo);
    if (existente) classifColecao.atualizar(existente.id, { classe, nome: conta.nome });
    else classifColecao.criar({ codigo: conta.codigo, nome: conta.nome, classe });
  };

  // Abre o modal de lançamento em modo "novo".
  const abrirNovoLanc = () => {
    setLancEditId(null);
    setLancTipo("Comissão");
    setLancValor("");
    setLancDesc("");
    setAddLanc(true);
  };

  // Abre o modal de lançamento em modo "edição" de um pagamento existente.
  const abrirEdicaoLanc = (p: Pagamento) => {
    setLancEditId(p.id);
    setLancTipo(p.tipo);
    setLancValor(String(p.valor));
    setLancDesc(p.descricao === "Lançamento manual" ? "" : (p.descricao ?? ""));
    setAddLanc(true);
  };

  // Lança/edita um pagamento manual para o colaborador no mês (preenche o que faltou na folha).
  const salvarLancamento = () => {
    const valor = Number(String(lancValor).replace(",", "."));
    if (!lancTipo) return toast("Escolha o tipo de pagamento.", "erro");
    if (!valor || valor <= 0) return toast("Informe um valor maior que zero.", "erro");
    if (lancEditId) {
      pagamentosColecao.atualizar(lancEditId, {
        tipo: lancTipo,
        valor: Math.round(valor * 100) / 100,
        descricao: lancDesc.trim() || "Lançamento manual",
      });
      toast("Lançamento atualizado.");
    } else {
      pagamentosColecao.criar({
        colaboradorId: colabId,
        competencia: compAtiva,
        tipo: lancTipo,
        valor: Math.round(valor * 100) / 100,
        dataPagamento: `${compAtiva}-15`,
        descricao: lancDesc.trim() || "Lançamento manual",
      });
      toast("Lançamento adicionado.");
    }
    setLancEditId(null);
    setAddLanc(false);
  };

  // ---------- Guard (após os hooks) ----------
  if (!podeGerir(sessao)) {
    return (
      <EmptyState
        title="Acesso restrito"
        description="Esta área de custos de colaboradores é exclusiva da gestão (RH e gestores)."
        icon={<ShieldCheck className="h-10 w-10" />}
      />
    );
  }

  const semPlano = competencias.length === 0;

  return (
    <div>
      <PageHeader
        title="Custos de Colaboradores"
        description="Quanto custa cada colaborador e a equipe — folha real, rateio e encargos, mês a mês."
      />

      <Tabs
        inicial="custos"
        abas={[
          {
            id: "custos",
            label: "Custos de Colaboradores",
            icon: <Coins className="h-4 w-4" />,
            conteudo: (
              <>
                <div className="mb-6 flex flex-wrap items-center gap-2">
                  <Select
                    value={compAtiva}
                    onChange={(e) => setComp(e.target.value)}
                    className="h-10 w-auto py-0"
                    disabled={semPlano}
                  >
                    {semPlano && <option value="">Sem competências</option>}
                    {competencias.map((c) => (
                      <option key={c} value={c}>
                        {compLabelLongo(c)}
                      </option>
                    ))}
                  </Select>
                  <button className="btn-outline" onClick={() => setEditorAberto(true)} disabled={semPlano}>
                    <Settings2 className="h-4 w-4" /> Classificar contas
                  </button>
                </div>

      {/* ---------- Uploads ---------- */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Plano de Contas (custos gerais)"
            subtitle="Planilha mensal de despesas (.xlsx ou .csv) — substitui a competência escolhida."
            icon={<FileSpreadsheet className="h-5 w-5" />}
          />
          <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Campo label="Competência" className="sm:w-44">
              <Select value={compUpload} onChange={(e) => setCompUpload(e.target.value)}>
                {opcoesCompetencia(compUpload).map((c) => (
                  <option key={c} value={c}>
                    {compLabelLongo(c)}
                  </option>
                ))}
              </Select>
            </Campo>
            <input
              ref={refPlano}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importarPlano(f);
                e.target.value = "";
              }}
            />
            <button className="btn-primary sm:mb-0" onClick={() => refPlano.current?.click()}>
              <Upload className="h-4 w-4" /> Enviar plano
            </button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pagamentos (custos individuais)"
            subtitle="A folha real por colaborador — vem do Contas a Pagar do Mubisys."
            icon={<ReceiptText className="h-5 w-5" />}
          />
          <CardBody className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <p className="text-xs text-slate-500">
                  Busca direto no ERP e mostra a prévia antes de gravar. As competências trazidas são atualizadas; as demais permanecem.
                </p>
                {/* Último mês buscado: some a dúvida de "isso já está atualizado?" */}
                <p className="mt-1 text-[11px] text-slate-400">
                  {config.ultimaBuscaMubi
                    ? `Última busca: ${compLabel(config.ultimaBuscaMubi.competencia)} · ${new Date(config.ultimaBuscaMubi.em).toLocaleString("pt-BR")} · ${config.ultimaBuscaMubi.quantidade} lançamento(s) vinculado(s) ao cadastro`
                    : "Nenhuma busca no Mubisys ainda."}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-col text-[11px] text-slate-500">
                  Mês
                  <input type="month" value={compMubi} onChange={(e) => setCompMubi(e.target.value)}
                    className="mt-0.5 rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none" />
                </label>
                <button className="btn-primary" onClick={() => void buscarDoMubi(compMubi)} disabled={buscandoMubi}>
                  {buscandoMubi ? <Clock className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {buscandoMubi ? "Buscando no ERP…" : "Buscar do Mubisys"}
                </button>
              </div>
            </div>
            {buscandoMubi && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                O Mubisys costuma levar de 30 segundos a 1 minuto para responder. Pode deixar a tela aberta.
              </p>
            )}

            {/* Resultado da busca automática: avisa sem interromper. */}
            {respostaMubi && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand/30 bg-brand/5 px-3 py-2">
                <p className="text-xs text-slate-700">
                  O ERP tem <b>{respostaMubi.linhas.length} lançamento(s) de pessoal</b> em {compLabel(respostaMubi.competencia)} — {vinculadosDaResposta} já vinculado(s) ao cadastro.
                  {respostaMubi.truncado && <span className="text-red-700"> Atenção: a lista veio incompleta (o mês tem mais títulos do que a busca traz de uma vez).</span>}
                </p>
                <button className="btn-outline h-8 px-3 py-0 text-xs" onClick={() => previaDoMubi(respostaMubi, config.vinculosMubi ?? {})}>
                  Revisar e aplicar
                </button>
              </div>
            )}
            {erroMubi && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{erroMubi}</p>
            )}

            {/* A planilha continua disponível: se o ERP estiver fora do ar, o
                trabalho não para. */}
            <details className="text-xs text-slate-500">
              <summary className="cursor-pointer hover:text-brand">Enviar por planilha (.xlsx/.csv)</summary>
              <div className="mt-2">
                <input
                  ref={refPagts}
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) importarPagamentos(f);
                    e.target.value = "";
                  }}
                />
                <button className="btn-outline" onClick={() => refPagts.current?.click()}>
                  <Upload className="h-4 w-4" /> Enviar planilha
                </button>
              </div>
            </details>
          </CardBody>
        </Card>
      </div>

      {/* Comissões avulsas — caso à parte, casado por NOME (some na soma total) */}
      <Card className="mb-6">
        <CardHeader
          title="Comissões (por nome)"
          subtitle="Importa só as comissões de uma planilha (formato Resultado), casando por nome. Para um caso pontual — o fluxo normal segue por CPF."
          icon={<Coins className="h-5 w-5" />}
        />
        <CardBody>
          <input ref={refComissoesNome} type="file" accept=".xlsx,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) abrirComissoesNome(f); e.target.value = ""; }} />
          <button className="btn-outline" onClick={() => refComissoesNome.current?.click()}>
            <Upload className="h-4 w-4" /> Importar comissões (por nome)
          </button>
        </CardBody>
      </Card>

      {comissoesPrev && (
        <Modal
          aberto
          onFechar={() => setComissoesPrev(null)}
          titulo="Comissões a lançar"
          descricao="Casadas por nome. Só as que casarem serão lançadas; as competências afetadas têm a comissão substituída."
          largura="max-w-lg"
          rodape={<>
            <button className="btn-outline" onClick={() => setComissoesPrev(null)}>Cancelar</button>
            <button className="btn-primary disabled:opacity-50" disabled={comissoesPrev.registros.length === 0} onClick={aplicarComissoesNome}>
              <Coins className="h-4 w-4" /> Lançar {comissoesPrev.registros.length}
            </button>
          </>}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 text-sm">
              <span className="font-medium text-green-700">{comissoesPrev.registros.length} casaram</span>
              <span className="text-slate-400">·</span>
              <span className="font-medium text-amber-700">{comissoesPrev.naoCasados.length} sem match</span>
              <span className="ml-auto font-semibold text-brand-ink">Total: {formatBRL(comissoesPrev.total)}</span>
            </div>
            {comissoesPrev.registros.length > 0 && (
              <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50"><tr><th className="th">Colaborador</th><th className="th">Competência</th><th className="th text-right">Valor</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {comissoesPrev.registros.map((r) => (
                      <tr key={r.id}>
                        <td className="td font-medium text-slate-700">{d.nomeColab(r.colaboradorId)}</td>
                        <td className="td text-slate-500">{compLabel(r.competencia)}</td>
                        <td className="td text-right tabular-nums">{formatBRL(r.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {comissoesPrev.naoCasados.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                <p className="mb-1.5 text-xs font-semibold text-amber-800">Não encontrados (não serão lançados):</p>
                <div className="flex flex-wrap gap-1.5">
                  {comissoesPrev.naoCasados.map((n, i) => <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200">{n}</span>)}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {folhaPrev && (() => {
        const { diff, naoCasados } = folhaPrev;
        const nd = (s?: string) => (s ?? "").trim();
        const descAtualizar = diff.iguais.filter((p) => nd(p.antigo.descricao) !== nd(p.novo.descricao));
        // Busca cortada = a lista do ERP não é a folha inteira. Quem faltou aparece
        // como "fora desta planilha" mesmo estando certo, então remover é proibido aqui.
        const buscaIncompleta = !!folhaPrev.mubi?.truncado;
        const mexeu = descAtualizar.length + diff.alterados.length + diff.novos.length + (removerAusentes && !buscaIncompleta ? diff.ausentes.length : 0);
        return (
          <Modal
            aberto
            onFechar={() => setFolhaPrev(null)}
            titulo="Conferir importação da folha"
            descricao="Comparação com o que já está no sistema. Só o que mudou será alterado — o que é igual fica intacto."
            largura="max-w-2xl"
            rodape={<>
              <button className="btn-outline" onClick={() => setFolhaPrev(null)}>Cancelar</button>
              <button className="btn-primary" onClick={aplicarFolha}>
                <Coins className="h-4 w-4" /> {mexeu === 0 ? "Nada a alterar" : `Aplicar ${mexeu} alteração(ões)`}
              </button>
            </>}
          >
            <div className="space-y-3">
              {buscaIncompleta && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">A busca no ERP veio incompleta</p>
                  <p className="mt-1 text-[11px] text-red-700/90">
                    O mês tem mais títulos do que a busca consegue trazer de uma vez, então parte da folha ficou de fora desta
                    comparação. Pode aplicar o que veio (é confiável), mas os lançamentos que faltaram aparecem abaixo como
                    "fora desta planilha" mesmo estando corretos — por isso a remoção está bloqueada.
                  </p>
                </div>
              )}
              {/* Placar dos 4 grupos */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2 text-center">
                  <p className="text-xl font-bold tabular-nums text-slate-600">{diff.iguais.length}</p>
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">iguais</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50/60 px-3 py-2 text-center">
                  <p className="text-xl font-bold tabular-nums text-blue-700">{diff.alterados.length}</p>
                  <p className="text-[11px] uppercase tracking-wide text-blue-500">corrigidos</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50/60 px-3 py-2 text-center">
                  <p className="text-xl font-bold tabular-nums text-green-700">{diff.novos.length}</p>
                  <p className="text-[11px] uppercase tracking-wide text-green-600">novos</p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 text-center">
                  <p className="text-xl font-bold tabular-nums text-amber-700">{diff.ausentes.length}</p>
                  <p className="text-[11px] uppercase tracking-wide text-amber-600">fora da planilha</p>
                </div>
              </div>

              {diff.alterados.length > 0 && (
                <div className="rounded-xl border border-blue-200">
                  <p className="border-b border-blue-100 bg-blue-50/50 px-3 py-1.5 text-xs font-semibold text-blue-800">Valores corrigidos</p>
                  <div className="max-h-44 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {diff.alterados.map(({ antigo, novo }) => (
                          <tr key={antigo.id}>
                            <td className="td font-medium text-slate-700">{d.nomeColab(novo.colaboradorId)}</td>
                            <td className="td text-slate-500">{compLabel(novo.competencia)} · {novo.tipo}</td>
                            <td className="td text-right tabular-nums">
                              <span className="text-slate-400 line-through">{formatBRL(antigo.valor)}</span>
                              <span className="mx-1 text-slate-300">→</span>
                              <span className="font-semibold text-blue-700">{formatBRL(novo.valor)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {diff.novos.length > 0 && (
                <div className="rounded-xl border border-green-200">
                  <p className="border-b border-green-100 bg-green-50/50 px-3 py-1.5 text-xs font-semibold text-green-800">Novos lançamentos</p>
                  <div className="max-h-44 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {diff.novos.map((n) => (
                          <tr key={n.id}>
                            <td className="td font-medium text-slate-700">{d.nomeColab(n.colaboradorId)}</td>
                            <td className="td text-slate-500">{compLabel(n.competencia)} · {n.tipo}</td>
                            <td className="td text-right tabular-nums font-semibold text-green-700">{formatBRL(n.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {descAtualizar.length > 0 && (
                <div className="rounded-xl border border-violet-200">
                  <p className="border-b border-violet-100 bg-violet-50/50 px-3 py-1.5 text-xs font-semibold text-violet-800">Descrições a atualizar ({descAtualizar.length}) — mesmo valor, só o texto muda</p>
                  <div className="max-h-44 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {descAtualizar.map(({ antigo, novo }) => (
                          <tr key={antigo.id}>
                            <td className="td font-medium text-slate-700">{d.nomeColab(novo.colaboradorId)}</td>
                            <td className="td text-right">
                              <span className="text-slate-400 line-through">{antigo.descricao || "—"}</span>
                              <span className="mx-1 text-slate-300">→</span>
                              <span className="font-medium text-violet-700">{novo.descricao || "—"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {diff.ausentes.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3">
                  <p className="mb-1 text-xs font-semibold text-amber-800">No sistema, mas fora desta planilha ({diff.ausentes.length})</p>
                  <p className="mb-2 text-[11px] text-slate-500">Podem ser lançamentos manuais (comissão, incentivo) ou linhas que saíram da folha. <strong>Ficam mantidos por padrão.</strong></p>
                  <div className="max-h-32 overflow-y-auto rounded-lg bg-white/70">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {diff.ausentes.map((a) => (
                          <tr key={a.id}>
                            <td className="td text-slate-600">{d.nomeColab(a.colaboradorId)}</td>
                            <td className="td text-slate-500">{compLabel(a.competencia)} · {a.tipo}</td>
                            <td className="td text-right tabular-nums text-slate-500">{formatBRL(a.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <label className={"mt-2 flex items-center gap-2 text-xs text-amber-800" + (buscaIncompleta ? " opacity-50" : "")}>
                    <input type="checkbox" disabled={buscaIncompleta} checked={removerAusentes && !buscaIncompleta} onChange={(e) => setRemoverAusentes(e.target.checked)} />
                    {buscaIncompleta
                      ? "Remoção bloqueada: a busca no ERP veio incompleta"
                      : `Remover também estes ${diff.ausentes.length} lançamento(s) (cuidado: apaga manuais)`}
                  </label>
                </div>
              )}

              {/* Despesas de pessoal sem dono (bolo, Uber, reembolso): não são de
                  ninguém e por isso não viram custo individual. */}
              {folhaPrev.mubi && folhaPrev.mubi.coletivas.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="mb-1 text-xs font-semibold text-slate-700">
                    Despesas de pessoal sem nome ({folhaPrev.mubi.coletivas.length}) — {formatBRL(folhaPrev.mubi.coletivas.reduce((s, l) => s + l.valor, 0))}
                  </p>
                  <p className="mb-2 text-[11px] text-slate-500">Lançadas no ERP sem colaborador (alimentação, reembolso, confraternização). Não viram custo individual — continuam no rateio pelo plano de contas.</p>
                  <div className="max-h-28 overflow-y-auto rounded-lg bg-white/70">
                    <table className="w-full text-xs">
                      <tbody className="divide-y divide-slate-100">
                        {folhaPrev.mubi.coletivas.map((l) => (
                          <tr key={l.idMubi}>
                            <td className="td text-slate-600">{l.descricao || "—"}</td>
                            <td className="td text-slate-400">{l.planoContas}</td>
                            <td className="td text-right tabular-nums text-slate-500">{formatBRL(l.valor)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {naoCasados.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50/40 p-3">
                  <p className="mb-1 text-xs font-semibold text-red-800">Não encontrados no cadastro ({naoCasados.length})</p>
                  <p className="mb-2 text-[11px] text-red-700/80">
                    {folhaPrev.mubi
                      ? "Escolha a pessoa ao lado do nome — o sistema lembra e casa sozinho nos próximos meses. Quem ficar sem escolha não entra."
                      : "Não entram nesta importação."}
                  </p>
                  {folhaPrev.mubi ? (
                    <div className="space-y-1.5">
                      {naoCasados.map((n) => (
                        <div key={n} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/80 px-2.5 py-1.5">
                          <span className="flex-1 text-xs text-slate-700">{n}</span>
                          <Select
                            className="min-w-[190px] text-xs"
                            value={config.vinculosMubi?.[normNome(n)] ?? ""}
                            onChange={(e) => vincularMubi(n, e.target.value)}
                          >
                            <option value="">Vincular a…</option>
                            {d.colaboradores.filter((c) => c.statusId !== "inativo").map((c) => (
                              <option key={c.id} value={c.id}>{c.nome}</option>
                            ))}
                          </Select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {naoCasados.map((n, i) => <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-red-700 ring-1 ring-red-200">{n}</span>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </Modal>
        );
      })()}

      {semPlano ? (
        <EmptyState
          title="Nenhum plano de contas importado"
          description="Envie a planilha de despesas mensal acima para começar a calcular os custos."
          icon={<Wallet className="h-10 w-10" />}
        />
      ) : (
        <div className="space-y-8">
          {/* ===================== SEÇÃO 1 — folha geral do mês (todos) ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Folha geral do mês</h2>
            </div>

            <Card>
              <CardHeader
                title="Resumo do mês"
                subtitle={`Todos os colaboradores · ${compLabelLongo(compAtiva)}`}
                icon={<CalendarDays className="h-5 w-5" />}
                action={
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => irMes(-1)}
                      disabled={idxComp <= 0}
                      className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40"
                      aria-label="Mês anterior"
                      title="Mês anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <Select value={compAtiva} onChange={(e) => setComp(e.target.value)} className="h-9 w-auto py-0 text-sm">
                      {competencias.map((c) => (
                        <option key={c} value={c}>{compLabelLongo(c)}</option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => irMes(1)}
                      disabled={idxComp < 0 || idxComp >= competencias.length - 1}
                      className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40"
                      aria-label="Próximo mês"
                      title="Próximo mês"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
              <CardBody>
                {pagsDoMes.length === 0 ? (
                  <EmptyState
                    title="Sem pagamentos neste mês"
                    description="Não há folha lançada nesta competência."
                    icon={<Coins className="h-8 w-8" />}
                  />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Tabela por tipo (mês inteiro) */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="th">Tipo de pagamento</th>
                            <th className="th text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {linhasMes.map((l) => (
                            <tr key={l.tipo}>
                              <td className="td">
                                <span className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDoTipo(l.tipo) }} />
                                  {l.tipo}
                                </span>
                              </td>
                              <td className="td text-right font-medium text-slate-800">{formatBRL(l.valor)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50/60">
                            <td className="td font-semibold text-brand-ink">Total pago no mês</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(totalMes)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    {/* Destaques do mês */}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
                      <StatCard label="Total pago no mês" value={formatBRL(totalMes)} accent="brand" icon={<Wallet className="h-4 w-4" />} hint={compLabelLongo(compAtiva)} />
                      <StatCard
                        label="Colaboradores pagos"
                        value={pessoasNoMes}
                        accent="blue"
                        icon={<Users className="h-4 w-4" />}
                        hint="Com lançamento no mês"
                        title="Ver quem recebeu neste mês"
                        onClick={() => drill.abrir("Colaboradores pagos", colabsPagosNoMes, `${pessoasNoMes} com lançamento em ${compLabelLongo(compAtiva)}`)}
                      />
                      <StatCard
                        label="Média por colaborador"
                        value={formatBRL(pessoasNoMes ? totalMes / pessoasNoMes : 0)}
                        accent="gold"
                        icon={<Coins className="h-4 w-4" />}
                        hint="Total ÷ pagos"
                        title="Ver quem entra no divisor da média"
                        onClick={() => drill.abrir("Média por colaborador", colabsPagosNoMes, `${formatBRL(totalMes)} ÷ ${pessoasNoMes} pago(s) em ${compLabelLongo(compAtiva)}`)}
                      />
                      <StatCard label="Tipos de pagamento" value={linhasMes.length} accent="green" icon={<ReceiptText className="h-4 w-4" />} hint="Categorias no mês" />
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </section>

          {/* ===================== SEÇÃO 2 — custo individual por colaborador ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Custo individual por colaborador</h2>
            </div>

            <Card>
              <CardHeader
                title="Colaborador ativo"
                subtitle={`Folha real de ${compLabelLongo(compAtiva)}`}
                icon={<Users className="h-5 w-5" />}
                action={
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => irColab(-1)}
                      disabled={ativosOrdenados.length < 2}
                      className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40"
                      aria-label="Colaborador anterior"
                      title="Colaborador anterior"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <Select
                      value={colabId}
                      onChange={(e) => setColabId(e.target.value)}
                      className="h-9 w-auto py-0 text-sm"
                    >
                      {ativosOrdenados.length === 0 && <option value="">Sem colaboradores ativos</option>}
                      {ativosOrdenados.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.nome}
                        </option>
                      ))}
                    </Select>
                    <button
                      type="button"
                      onClick={() => irColab(1)}
                      disabled={ativosOrdenados.length < 2}
                      className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40"
                      aria-label="Próximo colaborador"
                      title="Próximo colaborador"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                }
              />
              <CardBody>
                {/* Controles */}
                <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <SegToggle
                    opcoes={[
                      { v: true, label: "Salário + Adiantamento" },
                      { v: false, label: "Só Salário" },
                    ]}
                    valor={comAdiantamento}
                    onChange={setComAdiantamento}
                  />
                  <SegToggle
                    opcoes={[
                      { v: true, label: "Custo real (com encargos)" },
                      { v: false, label: "Custo pago" },
                    ]}
                    valor={comEncargos}
                    onChange={setComEncargos}
                  />
                  <button type="button" onClick={abrirNovoLanc} className="btn-outline h-9 py-0 text-sm sm:ml-auto" title="Adicionar um pagamento que faltou na folha (ex.: comissão)">
                    <Plus className="h-4 w-4" /> Lançamento
                  </button>
                </div>

                {pagsDoColab.length === 0 ? (
                  <EmptyState
                    title="Sem pagamentos nesta competência"
                    description="Não há folha lançada para este colaborador no mês selecionado."
                    icon={<Coins className="h-8 w-8" />}
                  />
                ) : (
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Tabela por tipo */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="th">Tipo de pagamento</th>
                            <th className="th text-right">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {linhasColab.map((l) => {
                            const ehEncargo = TIPOS_ENCARGO.includes(l.tipo);
                            const ignorado = (!comAdiantamento && l.tipo === "Adiantamento") || ehEncargo;
                            return (
                              <tr key={l.tipo} className={ignorado ? "opacity-40" : undefined}>
                                <td className="td">
                                  <span className="flex items-center gap-2">
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                                      style={{ backgroundColor: corDoTipo(l.tipo) }}
                                    />
                                    {l.tipo}
                                    {ehEncargo
                                      ? <span className="text-xs text-slate-400">(encargo — entra no custo real)</span>
                                      : ignorado && <span className="text-xs text-slate-400">(não somado)</span>}
                                  </span>
                                </td>
                                <td className="td text-right font-medium text-slate-800">{formatBRL(l.valor)}</td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-50/60">
                            <td className="td font-semibold text-brand-ink">Custo pago</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(custoPago)}</td>
                          </tr>
                        </tbody>
                      </table>
                      {!comAdiantamento && (
                        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          Política 60% saldo + 40% adiantamento = 1 salário (a soma não duplica).
                        </p>
                      )}
                    </div>

                    {/* Cálculo de custo real */}
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Os dois cards escolhem qual número o total do colaborador exibe (mesmo estado do toggle). */}
                        <StatCard
                          label="Custo pago"
                          value={formatBRL(custoPago)}
                          accent="blue"
                          icon={<Coins className="h-4 w-4" />}
                          hint={comAdiantamento ? "Salário + adiantamento" : "Só salário"}
                          title="Usar o custo pago (sem encargos) no total do colaborador"
                          ativo={!comEncargos}
                          onClick={() => setComEncargos(false)}
                        />
                        <StatCard
                          label="Custo real"
                          value={formatBRL(custoReal)}
                          accent="brand"
                          icon={<Wallet className="h-4 w-4" />}
                          hint="Pago + encargos"
                          title="Usar o custo real (com encargos) no total do colaborador"
                          ativo={comEncargos}
                          onClick={() => setComEncargos(true)}
                        />
                      </div>
                      <div className="rounded-xl border border-slate-200/70 bg-slate-50/40 p-4">
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                          Encargos estimados sobre o bruto ({formatBRL(bruto)})
                        </p>
                        <dl className="space-y-1.5 text-sm">
                          <LinhaEncargo label="FGTS (8%)" valor={fgts} />
                          <LinhaEncargo label="Provisão 13º (1/12)" valor={prov13} />
                          <LinhaEncargo label="Provisão Férias (1/12 × 1,3333)" valor={provFerias} />
                          {fgtsLancado > 0 && <LinhaEncargo label="FGTS lançado (rescisão)" valor={fgtsLancado} />}
                          <div className="flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-700">
                            <dt>Total de encargos</dt>
                            <dd>{formatBRL(encargos)}</dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                  </div>
                )}

                {/* Lançamentos individuais (editar / excluir registro a registro) */}
                {pagsDoColab.length > 0 && (
                  <div className="mt-6 overflow-hidden rounded-xl border border-slate-200/70">
                    <div className="border-b border-slate-100 bg-slate-50/50 px-3 py-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Lançamentos individuais</p>
                    </div>
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {pagsDoColab.map((p) => (
                          <tr key={p.id} className="transition hover:bg-slate-50/60">
                            <td className="px-3 py-2">
                              <span className="flex items-center gap-2">
                                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: corDoTipo(p.tipo) }} />
                                <span className="text-slate-700">{p.tipo}</span>
                                {p.descricao && p.descricao !== "Lançamento manual" && (
                                  <span className="text-xs text-slate-400">· {p.descricao}</span>
                                )}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-800">{formatBRL(p.valor)}</td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button className="btn-ghost p-1.5 text-slate-400 hover:text-brand" onClick={() => abrirEdicaoLanc(p)} aria-label={`Editar lançamento ${p.tipo}`}>
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button className="btn-ghost p-1.5 text-slate-400 hover:text-red-600" onClick={() => setPagExcluir(p.id)} aria-label={`Excluir lançamento ${p.tipo}`}>
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Destaque: custo total mensal do colaborador */}
                <div className="mt-6 flex flex-col gap-3 rounded-2xl bg-brand px-6 py-5 text-white sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-white/70">
                      Custo total mensal do colaborador
                    </p>
                    <p className="mt-0.5 text-sm text-white/80">
                      {colabSel?.nome ?? "—"} · {comEncargos ? "custo real (com encargos)" : "custo pago"}
                    </p>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{formatBRL(custoTotalColab)}</p>
                </div>
              </CardBody>
            </Card>
          </section>

          {/* ===================== SEÇÃO 1b — histórico do colaborador ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Histórico de {colabSel?.nome ?? "colaborador"} mês a mês</h2>
            </div>
            <Card>
              <CardHeader
                title="Quanto recebeu por mês"
                subtitle="Total efetivamente pago em cada competência e o acumulado do período."
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <CardBody>
                {historicoColab.length === 0 ? (
                  <EmptyState title="Sem pagamentos para este colaborador" icon={<Coins className="h-8 w-8" />} />
                ) : (
                  <div className="grid gap-5 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <BarrasVerticais data={historicoColab.map((h) => ({ nome: h.nome, valor: h.valor }))} moeda altura={260} />
                    </div>
                    <div className="space-y-3">
                      <StatCard label="Acumulado no período" value={formatBRL(acumuladoColab)} accent="brand" icon={<Wallet className="h-4 w-4" />} hint={`${historicoColab.length} mes(es)`} />
                      <StatCard label="Média por mês" value={formatBRL(mediaColab)} accent="blue" icon={<Coins className="h-4 w-4" />} />
                      <div className="overflow-hidden rounded-xl border border-slate-200/70">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-100">
                            {historicoColab.map((h) => (
                              <tr key={h.competencia}>
                                <td className="px-3 py-2 text-slate-600">{compLabelLongo(h.competencia)}</td>
                                <td className="px-3 py-2 text-right font-medium text-slate-800">{formatBRL(h.valor)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-slate-50/60">
                            <tr>
                              <td className="px-3 py-2 font-semibold text-brand-ink">Acumulado</td>
                              <td className="px-3 py-2 text-right font-semibold text-brand-ink">{formatBRL(acumuladoColab)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardBody>
            </Card>
          </section>

          {/* ===================== SEÇÃO 2 ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Layers className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Custos coletivos (rateio para todos)</h2>
            </div>

            {totalColetivo === 0 ? (
              <EmptyState
                title="Sem custos classificados nesta competência"
                description="Use “Classificar contas” para marcar contas como individual ou rateio."
                icon={<Layers className="h-8 w-8" />}
              />
            ) : (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <StatCard
                    label="Custo médio / colaborador"
                    value={formatBRL(nColab > 0 ? totais.individual / nColab : 0)}
                    hint={`Individual ÷ ${nColab} ativos`}
                    accent="brand"
                    icon={<Users className="h-4 w-4" />}
                    title="Ver os ativos que entram no divisor"
                    onClick={() => drill.abrir("Colaboradores ativos", ativosOrdenados, `Individual ${formatBRL(totais.individual)} ÷ ${nColab} ativo(s)`)}
                  />
                  <StatCard
                    label="Total custos de colaboradores"
                    value={formatBRL(totalColetivo)}
                    hint="Individual + rateio"
                    accent="gold"
                    icon={<Wallet className="h-4 w-4" />}
                  />
                  {/* Clicar troca a tabela de contas de rateio para a visão por pessoa (clicar de novo volta). */}
                  <StatCard
                    label="Rateio por colaborador"
                    value={formatBRL(totais.rateioPorColab)}
                    hint={`Rateio ÷ ${nColab} ativos`}
                    accent="green"
                    icon={<Coins className="h-4 w-4" />}
                    title="Mostrar as contas de rateio por colaborador"
                    ativo={rateioPorPessoa}
                    onClick={() => setRateioPorPessoa((v) => !v)}
                  />
                </div>

                <Card>
                  <CardHeader title="Individual × Rateio" subtitle={compLabelLongo(compAtiva)} icon={<Coins className="h-5 w-5" />} />
                  <CardBody>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600">
                        <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Individual {formatBRL(totais.individual)}
                      </span>
                      <span className="flex items-center gap-2 text-slate-600">
                        Rateio {formatBRL(totais.rateio)} <span className="h-2.5 w-2.5 rounded-full bg-gold" />
                      </span>
                    </div>
                    <Progress value={totalColetivo > 0 ? (totais.individual / totalColetivo) * 100 : 0} />
                    <p className="mt-2 text-xs text-slate-400">
                      {totalColetivo > 0
                        ? `${Math.round((totais.individual / totalColetivo) * 100)}% individual · ${Math.round((totais.rateio / totalColetivo) * 100)}% rateio`
                        : "Sem custos no período."}
                    </p>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader
                    title="Contas de rateio"
                    subtitle="Custos coletivos divididos entre todos os colaboradores ativos."
                    icon={<Layers className="h-5 w-5" />}
                    action={
                      <SegToggle
                        opcoes={[
                          { v: false, label: "Total" },
                          { v: true, label: "Por colaborador" },
                        ]}
                        valor={rateioPorPessoa}
                        onChange={setRateioPorPessoa}
                      />
                    }
                  />
                  <CardBody className="p-0">
                    {totais.contasRateio.length === 0 ? (
                      <div className="p-5">
                        <EmptyState title="Nenhuma conta de rateio" description="Classifique contas como “Rateio para todos” no editor." />
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="th">Conta</th>
                            <th className="th text-right">{rateioPorPessoa ? "Por colaborador" : "Valor"}</th>
                            <th className="th text-right">% do total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {totais.contasRateio.map((c: ContaPlano) => (
                            <tr key={c.codigo} className="transition hover:bg-slate-50/60">
                              <td className="td">
                                <span className="font-medium text-slate-800">{c.nome}</span>
                                <span className="ml-2 text-xs text-slate-400">{c.codigo}</span>
                              </td>
                              <td className="td text-right font-medium text-slate-800">{formatBRL(c.valor / divisor)}</td>
                              <td className="td text-right text-slate-500">
                                {totalColetivo > 0 ? `${((c.valor / totalColetivo) * 100).toFixed(1)}%` : "—"}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50/60">
                            <td className="td font-semibold text-brand-ink">Total de rateio</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(totais.rateio / divisor)}</td>
                            <td className="td text-right text-slate-500">
                              {totalColetivo > 0 ? `${((totais.rateio / totalColetivo) * 100).toFixed(1)}%` : "—"}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </div>
            )}
          </section>

          {/* ===================== SEÇÃO 3 ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Evolução mês a mês</h2>
            </div>

            <Card>
              <CardHeader
                title="Custo médio por colaborador"
                subtitle="Custo individual da folha dividido pelos colaboradores ativos, por competência."
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <CardBody>
                {dadosEvolucao.length === 0 ? (
                  <EmptyState title="Sem histórico" description="Importe mais competências para ver a evolução." />
                ) : (
                  <BarrasVerticais data={dadosEvolucao} moeda altura={300} />
                )}

                <div className="mt-6 overflow-x-auto">
                  <table className="w-full">
                    <thead className="border-b border-slate-100 bg-slate-50/50">
                      <tr>
                        <th className="th">Mês</th>
                        <th className="th text-right">Individual</th>
                        <th className="th text-right">Rateio</th>
                        <th className="th text-right">Custo médio / colab.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {serie.map((s) => (
                        <tr
                          key={s.competencia}
                          className={`transition hover:bg-slate-50/60 ${s.competencia === compAtiva ? "bg-brand-50/40" : ""}`}
                        >
                          <td className="td font-medium text-slate-800">{compLabelLongo(s.competencia)}</td>
                          <td className="td text-right text-slate-600">{formatBRL(s.individual)}</td>
                          <td className="td text-right text-slate-600">{formatBRL(s.rateio)}</td>
                          <td className="td text-right font-semibold text-brand-ink">{formatBRL(s.medioIndividual)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </section>
        </div>
      )}

      {/* ===================== Editor de classificação ===================== */}
      <Modal
        aberto={editorAberto}
        onFechar={() => setEditorAberto(false)}
        titulo="Classificar contas"
        descricao={`Defina a classe de cada conta-folha de ${compLabelLongo(compAtiva)}.`}
        largura="max-w-2xl"
        rodape={
          <button className="btn-primary" onClick={() => setEditorAberto(false)}>
            Concluir
          </button>
        }
      >
        {folhasEditor.length === 0 ? (
          <EmptyState title="Sem contas nesta competência" description="Importe um plano de contas para classificar." />
        ) : (
          <div className="space-y-2">
            <p className="mb-3 text-xs text-slate-500">
              Individual vai para a ficha do colaborador; rateio é dividido entre todos; encargo entra no custo real; ignorar fica de fora.
            </p>
            {folhasEditor.map((c: ContaPlano) => {
              const classeAtual = mapaClasse.get(c.codigo) ?? "ignorar";
              return (
                <div
                  key={c.codigo}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-400">
                      {c.codigo} · {formatBRL(c.valor)}
                    </p>
                  </div>
                  <Select
                    value={classeAtual}
                    onChange={(e) => definirClasse(c, e.target.value as ClasseCusto)}
                    className="h-9 w-40 shrink-0 py-0 text-sm"
                  >
                    {CLASSES_EDITAVEIS.map((cl) => (
                      <option key={cl} value={cl}>
                        {CLASSE_LABEL[cl]}
                      </option>
                    ))}
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* Lançamento manual de pagamento (preenche itens faltantes, ex.: comissão) */}
      <Modal
        aberto={addLanc}
        onFechar={() => { setAddLanc(false); setLancEditId(null); }}
        titulo={lancEditId ? "Editar lançamento" : "Adicionar lançamento"}
        descricao={`${d.colabById.get(colabId)?.nome ?? "Colaborador"} · ${compLabelLongo(compAtiva)}. Use para incluir um pagamento que faltou na folha.`}
        largura="max-w-md"
        rodape={
          <>
            <button className="btn-outline" onClick={() => { setAddLanc(false); setLancEditId(null); }}>Cancelar</button>
            <button className="btn-primary" onClick={salvarLancamento}>{lancEditId ? "Salvar" : "Adicionar"}</button>
          </>
        }
      >
        <div className="space-y-3">
          <Campo label="Tipo de pagamento">
            <Select value={lancTipo} onChange={(e) => setLancTipo(e.target.value)}>
              {TIPOS_PAGAMENTO.map((t) => <option key={t.tipo} value={t.tipo}>{t.tipo}</option>)}
            </Select>
          </Campo>
          <Campo label="Valor (R$)">
            <Input type="number" inputMode="decimal" step="0.01" value={lancValor} onChange={(e) => setLancValor(e.target.value)} placeholder="0,00" />
          </Campo>
          <Campo label="Descrição (opcional)">
            <Input value={lancDesc} onChange={(e) => setLancDesc(e.target.value)} placeholder="Ex.: Comissão produção" />
          </Campo>
        </div>
      </Modal>

      <ConfirmDialog
        aberto={!!pagExcluir}
        onFechar={() => setPagExcluir(null)}
        onConfirmar={() => {
          if (pagExcluir) {
            pagamentosColecao.remover(pagExcluir);
            toast("Lançamento excluído.");
          }
          setPagExcluir(null);
        }}
        titulo="Excluir lançamento"
        mensagem="Este pagamento será removido da folha do colaborador. Esta ação não pode ser desfeita."
      />
              </>
            ),
          },
          {
            id: "global",
            label: "Custo Global (Funcionários)",
            icon: <Layers className="h-4 w-4" />,
            conteudo: <CustoGlobalFuncionarios />,
          },
          {
            id: "viagens",
            label: "Viagens e Diárias",
            icon: <Plane className="h-4 w-4" />,
            conteudo: <ViagensPainel />,
          },
        ]}
      />

      <DrillModal {...drill.props} />
    </div>
  );
}

// ===================== Custo Global de Funcionários (bate com o DRE) =====================
// Soma as contas do grupo "Funcionários" do plano de contas — as que começam com
// "2.1." (Salário, Adiantamento, FGTS, Férias, Comissão Interna, Alimentação,
// Confraternização, etc.). É a MESMA base que o DRE usa, então o total bate.
// Diferente da "Folha real" (que soma o pago por pessoa), aqui é a visão contábil
// global, incluindo os custos coletivos (alimentação, confraternização, FGTS mensal).
function CustoGlobalFuncionarios() {
  const { items: plano } = useColecao("planoContas");
  const { items: pagamentos } = useColecao("pagamentos");
  const competencias = useMemo(() => competenciasPlano(plano), [plano]);
  const [comp, setComp] = useState<string>("");
  // Conta em foco pelos cards: filtra a tabela de contas de pessoal (null = todas).
  const [contaFoco, setContaFoco] = useState<string | null>(null);
  const compAtiva = comp && competencias.includes(comp) ? comp : (competencias[competencias.length - 1] ?? "");
  const idx = competencias.indexOf(compAtiva);
  // Trocar de mês limpa o foco — a conta filtrada pode nem existir na outra competência.
  const irMes = (d: number) => { const n = competencias[idx + d]; if (n) { setComp(n); setContaFoco(null); } };

  // Folha real por pessoa (soma dos pagamentos do mês) — para comparar lado a lado.
  const folhaReal = useMemo(
    () => pagamentos.filter((p: Pagamento) => p.competencia === compAtiva).reduce((s, p) => s + (p.valor || 0), 0),
    [pagamentos, compAtiva],
  );

  const { grupos, total } = useMemo(() => {
    const doMes = folhasDoMes(plano, compAtiva).filter((p) => String(p.codigo).startsWith(PREFIXO_FUNCIONARIOS));
    const nomePorCodigo = new Map(plano.filter((p) => p.competencia === compAtiva).map((p) => [p.codigo, p.nome]));
    const g = new Map<string, { nome: string; valor: number }>();
    for (const p of doMes) {
      const cat = String(p.codigo).split(".").slice(0, 3).join("."); // agrupa no nível 2.1.X
      const nome = nomePorCodigo.get(cat) ?? p.nome;
      const atual = g.get(cat) ?? { nome, valor: 0 };
      atual.valor += p.valor;
      g.set(cat, atual);
    }
    const grupos = [...g.entries()].map(([cod, v]) => ({ cod, ...v })).sort((a, b) => b.valor - a.valor);
    return { grupos, total: grupos.reduce((s, x) => s + x.valor, 0) };
  }, [plano, compAtiva]);

  if (competencias.length === 0) {
    return (
      <EmptyState
        title="Sem plano de contas importado"
        description="Envie a planilha de plano de contas (na aba Custos de Colaboradores) para calcular o custo global."
        icon={<Layers className="h-10 w-10" />}
      />
    );
  }

  // A tabela pode estar filtrada por um card. O rodapé precisa fechar com as
  // linhas que estão à vista — senão parece erro de soma (uma linha de R$ 2 mil
  // com um total de R$ 94 mil embaixo, dizendo 100%).
  const visiveis = grupos.filter((g) => !contaFoco || g.cod === contaFoco);
  const somaVisivel = visiveis.reduce((s, g) => s + g.valor, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Custo global de funcionários"
          subtitle={`Contas de pessoal (grupo ${PREFIXO_FUNCIONARIOS}*) · ${compLabelLongo(compAtiva)}`}
          icon={<Layers className="h-5 w-5" />}
          action={
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => irMes(-1)} disabled={idx <= 0} className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40" aria-label="Mês anterior" title="Mês anterior">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Select value={compAtiva} onChange={(e) => { setComp(e.target.value); setContaFoco(null); }} className="h-9 w-auto py-0 text-sm">
                {competencias.map((c) => <option key={c} value={c}>{compLabelLongo(c)}</option>)}
              </Select>
              <button type="button" onClick={() => irMes(1)} disabled={idx < 0 || idx >= competencias.length - 1} className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40" aria-label="Próximo mês" title="Próximo mês">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          }
        />
        <CardBody>
          {/* Lado a lado: folha real (por pessoa) × custo global (contábil) */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Folha real (por pessoa)</p>
              <p className="mt-1 text-2xl font-bold text-slate-800">{formatBRL(folhaReal)}</p>
              <p className="mt-0.5 text-xs text-slate-500">O que foi pago a cada colaborador (aba "Custos de Colaboradores").</p>
            </div>
            <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-brand">Custo global (contábil)</p>
              <p className="mt-1 text-2xl font-bold text-brand-ink">{formatBRL(total)}</p>
              <p className="mt-0.5 text-xs text-slate-500">Grupo {PREFIXO_FUNCIONARIOS}* do plano — bate com o "Funcionários" no DRE.</p>
            </div>
          </div>

          {/* Custos extras (coletivos) em destaque, separados da folha por pessoa */}
          {(() => {
            const acha = (cod: string) => grupos.find((g) => g.cod === cod);
            const extras = [
              { c: acha("2.1.14"), label: "Alimentação", accent: "green" as const },
              { c: acha("2.1.15"), label: "Confraternização", accent: "amber" as const },
            ].filter((x) => x.c);
            if (extras.length === 0) return null;
            return (
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Custos extras (coletivos) — não vão para a folha por pessoa</p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {extras.map((x) => (
                    <StatCard
                      key={x.label}
                      label={x.label}
                      value={formatBRL(x.c!.valor)}
                      accent={x.accent}
                      icon={<ReceiptText className="h-4 w-4" />}
                      hint={compLabelLongo(compAtiva)}
                      title={`Isolar ${x.label} na tabela abaixo`}
                      ativo={contaFoco === x.c!.cod}
                      onClick={() => setContaFoco((atual) => (atual === x.c!.cod ? null : x.c!.cod))}
                    />
                  ))}
                  <StatCard
                    label="Categorias no mês"
                    value={grupos.length}
                    accent="blue"
                    icon={<Layers className="h-4 w-4" />}
                    hint="Contas de pessoal"
                    title="Ver todas as categorias na tabela"
                    // Este é o card do estado "sem filtro": ele precisa acender quando
                    // nada está isolado, senão nenhum card fica aceso no estado padrão.
                    ativo={contaFoco === null}
                    onClick={() => setContaFoco(null)}
                  />
                </div>
              </div>
            );
          })()}
          {grupos.length === 0 ? (
            <EmptyState title="Sem contas de funcionários neste mês" description="Não há lançamentos do grupo 2.1.* nesta competência." icon={<Coins className="h-8 w-8" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-100 bg-slate-50/50">
                  <tr>
                    <th className="th">Conta</th>
                    <th className="th hidden sm:table-cell">Código</th>
                    <th className="th text-right">Valor</th>
                    <th className="th text-right">% do total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visiveis.map((g) => (
                    <tr key={g.cod} className="transition hover:bg-slate-50/60">
                      <td className="td font-medium text-slate-800">{g.nome}</td>
                      <td className="td hidden sm:table-cell text-slate-400">{g.cod}</td>
                      <td className="td text-right font-medium text-slate-800">{formatBRL(g.valor)}</td>
                      <td className="td text-right text-slate-500">{total > 0 ? `${((g.valor / total) * 100).toFixed(1)}%` : "—"}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50/60">
                    <td className="td font-semibold text-brand-ink" colSpan={2}>
                      Total de funcionários no mês{contaFoco ? " (filtrado)" : ""}
                    </td>
                    <td className="td text-right font-semibold text-brand-ink">{formatBRL(somaVisivel)}</td>
                    <td className="td text-right font-semibold text-brand-ink">
                      {total > 0 ? `${((somaVisivel / total) * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          {contaFoco && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              Mostrando {visiveis.length} de {grupos.length} categorias · total do mês inteiro: <b className="text-slate-700">{formatBRL(total)}</b>
              <button type="button" className="btn-outline h-7 px-2 py-0 text-xs" onClick={() => setContaFoco(null)}>Limpar filtro</button>
            </p>
          )}
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Esta é a visão <strong>contábil</strong> (plano de contas, grupo {PREFIXO_FUNCIONARIOS}*) — inclui os custos coletivos como alimentação, confraternização e o FGTS mensal. É a mesma base do DRE, então o total deve bater. A aba "Custos de Colaboradores" mostra a folha real <strong>por pessoa</strong>.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------- Helpers de UI locais ----------

// Lista de competências para o seletor de upload: mês corrente + 23 meses anteriores,
// garantindo que a competência atualmente escolhida esteja presente.
function opcoesCompetencia(incluir: string): string[] {
  const set = new Set<string>();
  const agora = new Date();
  for (let i = 0; i < 24; i++) {
    const dt = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    set.add(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`);
  }
  if (incluir) set.add(incluir);
  return [...set].sort((a, b) => b.localeCompare(a));
}

function LinhaEncargo({ label, valor }: { label: string; valor: number }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd>{formatBRL(valor)}</dd>
    </div>
  );
}

// Alternador segmentado (estilo Apple) — genérico em booleano.
function SegToggle({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: { v: boolean; label: string }[];
  valor: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="inline-flex rounded-xl bg-slate-100 p-0.5">
      {opcoes.map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => onChange(o.v)}
          className={
            "rounded-lg px-3 py-1.5 text-xs font-medium transition " +
            (valor === o.v ? "bg-white text-brand-ink shadow-sm" : "text-slate-500 hover:text-slate-700")
          }
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
