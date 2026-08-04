import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  Clock, History, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs } from "@/components/ui/tabs";
import { ViagensPainel } from "@/pages/Viagens";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, Progress } from "@/components/ui/misc";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { Select, Campo, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { BarrasVerticais } from "@/components/charts/charts";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { calcularEncargos, separarRecebido, PREFIXO_FUNCIONARIOS } from "@/lib/encargos";
import { podeGerir } from "@/lib/rbac";
import { formatBRL } from "@/lib/format";
import { somaPorTipo, corDoTipo, TIPOS_PAGAMENTO, TIPOS_ENCARGO } from "@/lib/folha";
import { buscarPagamentosMubi, buscarHistoricoMubi, competenciasParaTras, paraRegistros, sugerirSalarios, sugerirVinculo, norm as normNome, type LinhaMubi, type RespostaMubi, type SugestaoSalario, type NaoCasado } from "@/lib/mubiPagamentos";
import {
  classeMap,
  competenciasPlano,
  competenciasComDados,
  conferirCompetencia,
  compLabel,
  compLabelLongo,
  folhasDoMes,
  totaisDoMes,
  serieCustos,
  CLASSE_LABEL,
  parsePlanoContas,
  conciliarPagamentos,
  ehDoMubi,
  ehManual,
  ehContaConfidencial,
  type DiffPagamentos,
} from "@/lib/custos";
import { lerPlanilha } from "@/lib/xlsx-lite";
import { enviarColecao, apagarRegistrosNuvem, enviarConfigNuvem } from "@/lib/sync";
import { emLote, registrarAcaoManual } from "@/lib/auditoria";
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
  // Meses do plano de contas MAIS os meses que têm folha: o plano é planilha do
  // contador e chega depois, então o mês corrente (e todo mês ainda não fechado
  // por ele) ficava fora do seletor com a folha já lançada dentro.
  const competencias = useMemo(() => competenciasComDados(planoContas, pagamentos), [planoContas, pagamentos]);
  const ultimaComp = competencias[competencias.length - 1] ?? "";
  // Abre no último mês FECHADO — o último que tem planilha do contador. Abrir
  // direto no mês corrente mostraria o rateio, os encargos e o Custo Global
  // zerados logo de cara, que se lê como sistema quebrado; o mês corrente fica
  // a um clique na seta, com o aviso explicando o que ainda não venceu.
  const compPadrao = useMemo(() => {
    const doPlano = competenciasPlano(planoContas);
    return doPlano[doPlano.length - 1] ?? ultimaComp;
  }, [planoContas, ultimaComp]);
  const [comp, setComp] = useState<string>(compPadrao);

  const ativosOrdenados = useMemo(
    () => [...d.ativos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    [d.ativos],
  );
  // Fora do quadro mas COM lançamento: inativo, desligado, afastado ou direção
  // que tem folha histórica. Antes eles eram invisíveis na seção individual —
  // o dinheiro estava lá, contava na folha geral, e não havia como "entrar" na
  // pessoa para ver (pedido de 01/08/2026: os valores são altos demais para
  // ficarem em aberto).
  const foraDoQuadroComLanc = useMemo(() => {
    const noQuadro = new Set(ativosOrdenados.map((c) => c.id));
    const comPag = new Set((pagamentos as Pagamento[]).map((p) => p.colaboradorId));
    return d.colaboradores
      .filter((c: Colaborador) => !noQuadro.has(c.id) && comPag.has(c.id))
      .sort((a: Colaborador, b: Colaborador) => a.nome.localeCompare(b.nome, "pt-BR"));
  }, [ativosOrdenados, pagamentos, d.colaboradores]);
  // Seletor no topo da seção individual (pedido de 02/08): por padrão a
  // navegação fica SÓ no quadro atual — as setas passavam por inativo no meio
  // dos ativos e parecia erro. Ligando "Com inativos", entram os fora do
  // quadro que têm lançamento (rescisão, folha histórica).
  const [mostrarInativos, setMostrarInativos] = useState(false);
  // As setas ‹ › percorrem o que o seletor mostra: só o quadro, ou tudo.
  const navegaveis = useMemo(
    () => (mostrarInativos ? [...ativosOrdenados, ...foraDoQuadroComLanc] : ativosOrdenados),
    [ativosOrdenados, foraDoQuadroComLanc, mostrarInativos],
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
  const compAtiva = comp && competencias.includes(comp) ? comp : compPadrao;

  // Navegação por setas: entre colaboradores (‹ ›, circular) e entre meses (‹ ›).
  const idxColab = navegaveis.findIndex((c) => c.id === colabId);
  const irColab = (delta: number) => {
    if (!navegaveis.length) return;
    const base = idxColab < 0 ? 0 : idxColab;
    setColabId(navegaveis[(base + delta + navegaveis.length) % navegaveis.length].id);
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
  const hojeIso = new Date().toISOString().slice(0, 7);
  // Fica no último mês COM plano (não no último com folha): o seletor de meses
  // cresceu e o envio de planilha sobrescreve a competência escolhida — mudar
  // esse padrão calado seria trocar o mês em que o plano do contador cai.
  const [compUpload, setCompUpload] = useState<string>(compPadrao || hojeIso);
  // Importação avulsa de comissões, casando por NOME (caso à parte)
  // Prévia de conciliação da folha (subir a mesma planilha: mexe só no diferente).
  const [folhaPrev, setFolhaPrev] = useState<{
    diff: DiffPagamentos;
    naoCasados: NaoCasado[];
    cpfsAprendidos?: { colaboradorId: string; cpf: string }[];
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
  // Sugestões de salário para o cadastro (vindas do ERP) e quem o RH marcou.
  const [salarios, setSalarios] = useState<SugestaoSalario[]>([]);
  const [salariosMarcados, setSalariosMarcados] = useState<Set<string>>(new Set());
  // Um caminho só para fechar a prévia. Antes as marcações de salário
  // sobreviviam ao Cancelar e reapareciam — aplicáveis — na prévia seguinte,
  // inclusive na da PLANILHA, que não tem salário nenhum.
  const fecharPrevia = () => {
    setFolhaPrev(null);
    setSalarios([]);
    setSalariosMarcados(new Set());
    setGruposAbertos(new Set());
  };
  // Varredura do histórico: quantos meses para trás, onde está e o cancelamento.
  const [mesesHistorico, setMesesHistorico] = useState(12);
  const [varrendo, setVarrendo] = useState<{ feitos: number; total: number; onde: string } | null>(null);
  const cancelarVarreduraRef = useRef(false);
  // Quantos daqueles lançamentos já casam com alguém do cadastro. É a MESMA
  // contagem gravada em "Última busca" — sem isso o aviso mostra o total do ERP
  // e a linha de baixo mostra os vinculados, dois números diferentes no mesmo card.
  const vinculadosDaResposta = useMemo(
    () => (respostaMubi ? paraRegistros(respostaMubi.linhas, d.colaboradores, config.vinculosMubi ?? {}, config.vinculosMubiTitulo ?? {}).registros.length : 0),
    [respostaMubi, d.colaboradores, config.vinculosMubi, config.vinculosMubiTitulo],
  );
  // Seletor de vínculo manual: o cadastro INTEIRO, separado em quadro atual e
  // inativos. Os inativos ficavam escondidos — e 57 dos 88 são inativos, quase
  // todos com lançamento, então valor alto ficava preso sem ter para onde ir.
  const opcoesVinculo = useMemo(() => {
    const ordena = (arr: Colaborador[]) => [...arr].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return {
      quadro: ordena(d.colaboradores.filter((c: Colaborador) => noQuadro(c))),
      inativos: ordena(d.colaboradores.filter((c: Colaborador) => c.statusId === "inativo")),
    };
  }, [d.colaboradores]);
  // O sistema PERGUNTA em vez de deixar em aberto: para cada não encontrado,
  // procura um único candidato plausível (regra frouxa, só sugere — quem grava
  // é o clique do RH).
  const sugestoesVinculo = useMemo(() => {
    const m = new Map<string, Colaborador>();
    for (const n of folhaPrev?.naoCasados ?? []) {
      const s = sugerirVinculo(n.nome, d.colaboradores);
      if (s) m.set(n.nome, s);
    }
    return m;
  }, [folhaPrev, d.colaboradores]);
  // Grupos de não-encontrados abertos linha a linha na prévia.
  const [gruposAbertos, setGruposAbertos] = useState<Set<string>>(new Set());
  // Grupo com 2+ CPFs distintos por baixo = várias pessoas na mesma origem
  // genérica; vincular o grupo inteiro a alguém seria erro na certa.
  const ehGrupoDeVarios = (n: NaoCasado) => {
    const docs = new Set(
      (n.titulos ?? [])
        .map((t) => String(t.cpfCnpj ?? "").replace(/\D/g, ""))
        .filter((x) => x.length === 11),
    );
    return docs.size >= 2;
  };

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
      // `definir` troca a coleção inteira e não passa pelo auditor — registra na mão.
      registrarAcaoManual(`Enviou o plano de contas de ${compLabelLongo(compUpload)}`, `${novos.length} conta(s)`, "planoContas");
      toast(`Plano de contas importado: ${novos.length} contas em ${compLabel(compUpload)}.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao ler a planilha.", "erro");
    }
  };

  // Busca a folha do mês direto no Contas a Pagar do Mubisys e cai na MESMA
  // prévia de conciliação da planilha — nada é gravado sem o RH confirmar.
  // Monta a prévia de conciliação a partir do que veio do ERP.
  const previaDoMubi = (r: RespostaMubi, vinculos: Record<string, string>) => {
    const { registros, naoCasados, coletivas, cpfsAprendidos } = paraRegistros(r.linhas, d.colaboradores, vinculos, config.vinculosMubiTitulo ?? {});
    // Compara contra as competências dos REGISTROS, não contra o mês pedido: uma
    // busca pode gerar lançamentos em mais de uma competência e o que ficasse de
    // fora da comparação voltaria como "novo" (duplicata).
    //
    // E entram TODOS os títulos já vindos do ERP, de qualquer competência. Sem
    // isso sobrava um caminho para duplicar: o ERP corrige o vencimento de
    // 15/07 para 16/07, a competência vira outra (a janela é do 16 ao 15), o
    // registro antigo fica fora do recorte e o mesmo título é gravado de novo.
    // Todos os títulos já vindos do ERP entram para poder casar por id; a JANELA
    // diz o que pode ser dado como ausente — sem ela, importar agosto listava a
    // folha inteira de julho como "fora da planilha", com o botão de apagar ao lado.
    const comps = new Set(registros.map((x) => x.competencia));
    const existentesDaComp = pagamentos.filter(
      (p: Pagamento) => comps.has(p.competencia) || ehDoMubi(p),
    );
    setRemoverAusentes(false);
    setFolhaPrev({
      diff: conciliarPagamentos(existentesDaComp, registros, comps),
      naoCasados, cpfsAprendidos, totalLinhas: registros.length,
      mubi: { linhas: r.linhas, coletivas, truncado: r.truncado },
    });
    // Salário do cadastro sugerido pelo que o ERP pagou. Fica separado da folha:
    // são coisas diferentes e cada uma é aplicada por sua conta.
    setSalarios(sugerirSalarios(r.linhas, d.colaboradores, vinculos));
    setSalariosMarcados(new Set()); // marcação vale para a lista da tela, não para a pessoa
    setRespostaMubi(null);
  };

  /**
   * Puxa o histórico inteiro do ERP, mês a mês e página a página.
   *
   * É a operação mais demorada do sistema (cada consulta ao Mubisys leva 25-40s,
   * e são várias por mês), por isso mostra onde está e pode ser cancelada. O que
   * já veio antes do cancelamento é aproveitado — nada se perde.
   *
   * Reimportar é seguro: título do ERP casa pelo id, então rodar de novo
   * ATUALIZA em vez de criar um segundo lançamento.
   */
  const buscarHistorico = async () => {
    cancelarVarreduraRef.current = false;
    setErroMubi("");
    setBuscandoMubi(true);
    const comps = competenciasParaTras(mesesHistorico);
    try {
      const r = await buscarHistoricoMubi(
        comps,
        (feitos, total, onde) => setVarrendo({ feitos, total, onde }),
        () => cancelarVarreduraRef.current,
      );
      const vinculos = config.vinculosMubi ?? {};
      if (r.linhas.length === 0) {
        setErroMubi(`O Mubisys não devolveu lançamento de pessoal nos últimos ${mesesHistorico} meses.`);
        return;
      }
      previaDoMubi(
        { competencia: comps[comps.length - 1], buscadoEm: r.buscadoEm, totalTitulosNoMes: r.linhas.length, paginas: 0, truncado: r.truncado, linhas: r.linhas },
        vinculos,
      );
      const parcial = cancelarVarreduraRef.current ? " (varredura interrompida)" : "";
      const falhou = r.falhas.length ? ` ${r.falhas.length} mês(es) falharam: ${r.falhas.map((f) => f.competencia).join(", ")}.` : "";
      toast(`${r.linhas.length} título(s) lidos em ${r.competenciasLidas.length} competência(s)${parcial}.${falhou}`, r.falhas.length ? "info" : "sucesso");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha ao varrer o histórico.";
      setErroMubi(msg); toast(msg, "erro");
    } finally {
      setVarrendo(null);
      setBuscandoMubi(false);
    }
  };

  const buscarDoMubi = async (competencia: string, abrirPrevia = true) => {
    if (!/^\d{4}-\d{2}$/.test(competencia)) { setErroMubi("Escolha o mês."); return; }
    setBuscandoMubi(true);
    setErroMubi("");
    try {
      const r = await buscarPagamentosMubi(competencia);
      ultimaFalhaMubi = null;
      const vinculos = config.vinculosMubi ?? {};
      const { registros, naoCasados } = paraRegistros(r.linhas, d.colaboradores, vinculos, config.vinculosMubiTitulo ?? {});
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
  const recomputarPrevia = (vinculos: Record<string, string>, vinculosTitulo: Record<string, string>) => {
    if (!folhaPrev?.mubi) return;
    const { registros, naoCasados, coletivas, cpfsAprendidos } = paraRegistros(folhaPrev.mubi.linhas, d.colaboradores, vinculos, vinculosTitulo);
    const comps = new Set(registros.map((r) => r.competencia));
    const existentesDaComp = pagamentos.filter(
      (p: Pagamento) => comps.has(p.competencia) || ehDoMubi(p),
    );
    // O vínculo novo pode fazer aparecer (ou sumir) uma sugestão de salário.
    setSalarios(sugerirSalarios(folhaPrev.mubi.linhas, d.colaboradores, vinculos));
    setSalariosMarcados(new Set());
    setFolhaPrev({
      diff: conciliarPagamentos(existentesDaComp, registros, comps),
      naoCasados, cpfsAprendidos, totalLinhas: registros.length,
      mubi: { ...folhaPrev.mubi, coletivas },
    });
  };

  const vincularMubi = (nomeMubi: string, colaboradorId: string) => {
    if (!folhaPrev?.mubi) return;
    const chave = normNome(nomeMubi);
    const vinculos = { ...(config.vinculosMubi ?? {}) };
    if (colaboradorId) vinculos[chave] = colaboradorId;
    else delete vinculos[chave];
    salvarCfg({ vinculosMubi: vinculos });
    recomputarPrevia(vinculos, config.vinculosMubiTitulo ?? {});
  };

  // Vínculo POR TÍTULO: para as levas com origem genérica ("Colaboradores"),
  // onde o vínculo por nome mandaria títulos de gente diferente para uma
  // pessoa só. O apontamento fica guardado por id do título no ERP.
  const vincularTitulo = (idMubi: string, colaboradorId: string) => {
    if (!folhaPrev?.mubi) return;
    const vinculosTitulo = { ...(config.vinculosMubiTitulo ?? {}) };
    if (colaboradorId) vinculosTitulo[idMubi] = colaboradorId;
    else delete vinculosTitulo[idMubi];
    salvarCfg({ vinculosMubiTitulo: vinculosTitulo });
    recomputarPrevia(config.vinculosMubi ?? {}, vinculosTitulo);
  };

  // Lê a planilha e monta a PRÉVIA de conciliação (não aplica nada ainda). Subir a
  // mesma planilha de novo mostra o que é igual, o que mudou e o que é novo.
  // Aplica a prévia: mexe SÓ no que mudou (corrige valores, insere novos, atualiza
  // descrições) e, opcionalmente, remove os ausentes. Iguais sem mudança não são tocados.
  const aplicarFolha = () => {
    if (!folhaPrev) return;
    // Tudo daqui para baixo é UMA ação para quem lê o histórico: aplicar a
    // folha são centenas de escritas, e cada uma virando linha enterraria o
    // trabalho humano do dia embaixo do log da máquina.
    // Só a parte MECÂNICA entra no lote. A aplicação de salário é decisão
    // humana e merece linha própria no histórico — engolida no resumo do lote,
    // o campo mais sensível do sistema mudaria sem deixar rastro individual.
    emLote(`Aplicou a folha do ERP (${compLabel(folhaPrev.diff.novos[0]?.competencia ?? compAtiva)}…)`, () => aplicarFolhaAgora());
  };

  const aplicarFolhaAgora = () => {
    if (!folhaPrev) return;
    const { diff } = folhaPrev;
    const nd = (s?: string) => (s ?? "").trim();
    // Linhas iguais (mesmo valor) cuja DESCRIÇÃO mudou — atualiza só o texto.
    let descAtualizadas = 0;
    for (const { antigo, novo } of diff.iguais) {
      const adotaId = !antigo.idMubi && !!novo.idMubi;
      if (nd(antigo.descricao) !== nd(novo.descricao) || adotaId) {
        pagamentosColecao.atualizar(antigo.id, {
          descricao: novo.descricao || undefined,
          ...(adotaId ? { idMubi: novo.idMubi } : {}),
        });
        if (nd(antigo.descricao) !== nd(novo.descricao)) descAtualizadas++;
      }
    }
    for (const { antigo, novo } of diff.alterados) {
      // O registro INTEIRO. Gravar só valor/data deixava pessoa, competência e
      // tipo congelados no que foi importado da primeira vez: o ERP repassava o
      // título para outra pessoa (ou reclassificava o plano) e o dinheiro ficava
      // somando na pessoa/mês errados — e o item voltava como "corrigido" em
      // toda importação seguinte, porque nunca convergia.
      pagamentosColecao.atualizar(antigo.id, {
        colaboradorId: novo.colaboradorId,
        competencia: novo.competencia,
        tipo: novo.tipo,
        valor: novo.valor,
        dataPagamento: novo.dataPagamento,
        descricao: novo.descricao,
        idMubi: novo.idMubi ?? null,
      });
    }
    // criarOuAtualizar: se o id já existir (reimportação, aba aberta em dois
    // lugares), atualiza em vez de gravar uma segunda linha com a mesma chave.
    for (const n of diff.novos) pagamentosColecao.criarOuAtualizar(n);
    // Se a busca no ERP veio cortada, "ausente" não quer dizer "saiu da folha" —
    // pode ser só o que não coube na busca. Nesse caso nunca apaga.
    const podeRemover = removerAusentes && !folhaPrev.mubi?.truncado;
    if (podeRemover) {
      for (const a of diff.ausentes) pagamentosColecao.remover(a.id);
    }
    const mexeu = descAtualizadas + diff.alterados.length + diff.novos.length + (podeRemover ? diff.ausentes.length : 0);

    // CPF aprendido do ERP, só onde o cadastro está vazio. É o que faz o mês
    // seguinte casar pela chave forte em vez de depender de como o ERP escreveu
    // o nome — a causa de Limpeza/Faxina e Freelancer nunca casarem.
    const cpfs = folhaPrev.cpfsAprendidos ?? [];
    let cpfsPreenchidos = 0;
    if (cpfs.length) {
      const mapa = new Map(cpfs.map((x) => [x.colaboradorId, x.cpf]));
      const atualizados = colaboradoresColecao.items.map((c) => {
        const cpf = mapa.get(c.id);
        if (cpf && !String(c.cpf ?? "").replace(/\D/g, "")) { cpfsPreenchidos++; return { ...c, cpf }; }
        return c;
      });
      if (cpfsPreenchidos) {
        colaboradoresColecao.definir(atualizados);
        registrarAcaoManual("Preencheu CPF a partir do ERP", `${cpfsPreenchidos} colaborador(es)`, "colaboradores");
        void enviarColecao("colaboradores");
      }
    }
    const avisoCpf = cpfsPreenchidos ? ` CPF preenchido em ${cpfsPreenchidos} colaborador(es) — o próximo mês casa sozinho.` : "";

    // Salários marcados — só o que está na lista da tela (marca órfã não conta).
    const aplicaveis = salarios.filter((x) => salariosMarcados.has(x.colaborador.id));
    for (const sug of aplicaveis) {
      colaboradoresColecao.atualizar(sug.colaborador.id, { salario: sug.sugerido });
    }
    const parteSalario = aplicaveis.length ? ` Salário preenchido em ${aplicaveis.length} colaborador(es).` : "";
    // Um toast só, dizendo tudo: antes ele avisava "nada a alterar" no mesmo
    // clique em que salários eram gravados.
    toast(
      mexeu === 0
        ? `Folha já estava igual — nada a alterar.${parteSalario}${avisoCpf}`
        : `Folha conciliada: ${diff.alterados.length} corrigido(s), ${diff.novos.length} novo(s)${descAtualizadas ? `, ${descAtualizadas} descrição(ões) atualizada(s)` : ""}${podeRemover && diff.ausentes.length ? `, ${diff.ausentes.length} removido(s)` : ""}.${parteSalario}${avisoCpf}`,
      "sucesso",
    );
    fecharPrevia();
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
  const abrirDrillTipo = (tipo: string) => {
    const doTipo = pagsDoMes.filter((p) => p.tipo === tipo);
    const ids = new Set(doTipo.map((p) => p.colaboradorId));
    const pessoas = [...ids].map((id) => d.colabById.get(id)).filter((c): c is NonNullable<typeof c> => !!c);
    drill.abrir(`${tipo} · ${compAtiva}`, pessoas, `${formatBRL(doTipo.reduce((a, p) => a + p.valor, 0))} · ${ids.size} colaborador(es)`);
  };
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
  // Conferência do mês: a folha desta competência está inteira, ainda está
  // chegando, ou faltou gente? Sem isso o mês corrente aparecia pela metade sem
  // dizer que o salário só vence no mês seguinte.
  const conferencia = useMemo(
    () => conferirCompetencia(compAtiva, pagamentos, d.colaboradores),
    [compAtiva, pagamentos, d.colaboradores],
  );
  // Mês que tem folha mas ainda não tem a planilha do contador: o rateio e os
  // encargos ficam zerados e isso precisa estar escrito, não deduzido.
  const semPlanoNaComp = useMemo(
    () => pagsDoMes.length > 0 && !planoContas.some((p: ContaPlano) => p.competencia === compAtiva),
    [pagsDoMes, planoContas, compAtiva],
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
  // Reconciliação do mês: quanto do que a pessoa recebeu está na base de encargo
  // e quanto está fora (faxina, empreita, comissão, extras). Sai de `linhasColab`
  // e NÃO do toggle "Só Salário" de propósito — tem de fechar com o `bruto`, que
  // também ignora o toggle; se um lado obedecesse e o outro não, a conta não
  // fecharia na tela e ninguém saberia por quê.
  const recebido = useMemo(() => separarRecebido(linhasColab, TIPOS_ENCARGO), [linhasColab]);
  const custoReal = custoPago + encargos;
  const custoTotalColab = comEncargos ? custoReal : custoPago;
  const colabSel = d.colabById.get(colabId);

  // ---------- Seção 1b: histórico do colaborador (mês a mês) + acumulado ----------
  const historicoColab = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of pagamentos as Pagamento[]) {
      if (p.colaboradorId !== colabId) continue;
      // FGTS/INSS lançados por pessoa são encargo da EMPRESA — a pessoa nunca
      // viu esse dinheiro. Este histórico é "quanto ela recebeu", então eles
      // ficam de fora, como já fica no custoPago logo acima e na ficha.
      if (TIPOS_ENCARGO.includes(p.tipo)) continue;
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
        // Pagamento em dinheiro não passa pelo ERP: sem esta marca, a prévia
        // da varredura listaria o lançamento como "fora do ERP" com o botão
        // de remover em massa ao lado — um clique apagaria dinheiro real.
        manual: true,
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
          {/* O card vive em metade da tela (grid de 2 colunas). Texto e QUATRO
              controles na mesma linha faziam o texto virar uma coluna de duas
              palavras, o botão quebrar em três linhas e o seletor de histórico
              sair pela borda. Agora: explicação em cima, controles embaixo em
              duas duplas que quebram juntas — cada ação com seu campo ao lado. */}
          <CardBody className="space-y-3">
            <div>
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
            <div className="flex flex-wrap items-end gap-x-3 gap-y-3">
              <div className="flex items-end gap-2">
                <label className="flex shrink-0 flex-col text-[11px] text-slate-500">
                  Mês
                  <input type="month" value={compMubi} onChange={(e) => setCompMubi(e.target.value)}
                    className="mt-0.5 w-[150px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none" />
                </label>
                <button className="btn-primary shrink-0 whitespace-nowrap" onClick={() => void buscarDoMubi(compMubi)} disabled={buscandoMubi}>
                  {buscandoMubi ? <Clock className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {buscandoMubi ? "Buscando no ERP…" : "Buscar do Mubisys"}
                </button>
              </div>
              {/* Histórico: o mês a mês só traz o mês pedido, e o que está mais
                  para trás no ERP nunca chegava. */}
              <div className="flex items-end gap-2">
                <label className="flex shrink-0 flex-col text-[11px] text-slate-500">
                  Histórico
                  <select
                    value={mesesHistorico}
                    onChange={(e) => setMesesHistorico(Number(e.target.value))}
                    className="mt-0.5 w-[165px] rounded-lg border border-slate-200 px-2 py-1.5 text-sm focus:border-brand-300 focus:outline-none"
                  >
                    <option value={6}>últimos 6 meses</option>
                    <option value={12}>últimos 12 meses</option>
                    <option value={24}>últimos 24 meses</option>
                    <option value={36}>últimos 36 meses</option>
                  </select>
                </label>
                <button className="btn-outline shrink-0 whitespace-nowrap" onClick={() => void buscarHistorico()} disabled={buscandoMubi}
                  title="Varre mês a mês e página a página — demora, mas traz tudo o que está lá atrás">
                  <History className="h-4 w-4" /> Puxar histórico
                </button>
              </div>
            </div>
            {varrendo && (
              <div className="rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-brand-ink">
                    Varrendo o histórico: {varrendo.feitos} de {varrendo.total} mês(es)
                    {varrendo.onde ? ` · ${varrendo.onde}` : ""}
                  </p>
                  <button className="btn-ghost h-7 px-2 py-0 text-xs text-red-600"
                    onClick={() => { cancelarVarreduraRef.current = true; }}>
                    Parar
                  </button>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${varrendo.total ? (varrendo.feitos / varrendo.total) * 100 : 0}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Cada mês leva de 30s a 1 minuto. O que já veio é aproveitado se você parar.
                </p>
              </div>
            )}
            {buscandoMubi && !varrendo && (
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

          </CardBody>
        </Card>
      </div>

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
            onFechar={fecharPrevia}
            titulo="Conferir importação da folha"
            descricao="Comparação com o que já está no sistema. Só o que mudou será alterado — o que é igual fica intacto."
            largura="max-w-2xl"
            rodape={<>
              <button className="btn-outline" onClick={fecharPrevia}>Cancelar</button>
              <button className="btn-primary" onClick={aplicarFolha}>
                <Coins className="h-4 w-4" /> {mexeu + salariosMarcados.size === 0
                  ? "Nada a alterar"
                  : `Aplicar ${mexeu} alteração(ões)${salariosMarcados.size ? ` + ${salariosMarcados.size} salário(s)` : ""}`}
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

              {/* SALÁRIO: só para quem está SEM salário no cadastro.
                  O que o ERP tem é o LÍQUIDO pago (já saíram INSS, IRRF, VT e o
                  desconto de falta), então não serve como salário de contrato de
                  quem já tem um — rebaixaria quase todo mundo, e esse campo é a
                  base do cálculo de hora extra e de desconto de falta. Para quem
                  não tem nada, um ponto de partida conferido pelo RH é melhor do
                  que o sistema não conseguir calcular. Nada é aplicado sem marcar. */}
              {folhaPrev.mubi && salarios.length > 0 && (
                <div className="rounded-xl border border-gold-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold-100 bg-gold-50/50 px-3 py-1.5">
                    <p className="text-xs font-semibold text-gold-700">
                      Sem salário no cadastro · {salarios.length} pessoa(s)
                    </p>
                  </div>
                  <p className="px-3 py-1.5 text-[11px] text-slate-500">
                    Valor <b>pago</b> na competência (Salário + Adiantamento) — é o líquido, já sem
                    INSS, IRRF e vale-transporte. Use como <b>ponto de partida</b> e ajuste na ficha
                    se o contrato for outro. Sem salário, o sistema não calcula hora extra nem
                    desconto de falta dessas pessoas.
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <tbody className="divide-y divide-slate-100">
                        {salarios.map((sug) => {
                          const marcado = salariosMarcados.has(sug.colaborador.id);
                          return (
                            <tr key={sug.colaborador.id} className={marcado ? "bg-gold-50/40" : undefined}>
                              <td className="td w-8">
                                <input
                                  type="checkbox"
                                  checked={marcado}
                                  disabled={!sug.completo}
                                  onChange={() => setSalariosMarcados((atual) => {
                                    const n = new Set(atual);
                                    if (n.has(sug.colaborador.id)) n.delete(sug.colaborador.id); else n.add(sug.colaborador.id);
                                    return n;
                                  })}
                                  aria-label={`Preencher o salário de ${sug.colaborador.nome}`}
                                />
                              </td>
                              <td className="td font-medium text-slate-700">{sug.colaborador.nome}</td>
                              <td className="td text-slate-400">
                                {compLabel(sug.competencia)}
                                {/* Mês com só uma das pernas (adiantamento OU saldo) daria
                                    metade do salário: não deixa marcar. */}
                                {!sug.completo && <span className="ml-1 text-red-600">· mês incompleto</span>}
                              </td>
                              <td className="td text-right tabular-nums font-semibold text-gold-700">
                                {formatBRL(sug.sugerido)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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
                  {/* O VALOR na frente: uma lista só de nomes é fácil de passar
                      batido, e o que fica de fora some do extrato da pessoa. */}
                  <p className="mb-1 text-xs font-semibold text-red-800">
                    Não encontrados no cadastro: {naoCasados.length} nome(s) ·{" "}
                    {formatBRL(naoCasados.reduce((acc, x) => acc + x.total, 0))} ficando de fora
                  </p>
                  <p className="mb-2 text-[11px] text-red-700/80">
                    {folhaPrev.mubi
                      ? "Escolha a pessoa ao lado do nome — o sistema lembra, e do mês seguinte em diante casa pelo CPF. Quem ficar sem escolha NÃO entra."
                      : "Não entram nesta importação."}
                  </p>
                  {folhaPrev.mubi ? (
                    <div className="space-y-1.5">
                      {naoCasados.map((n) => {
                        const sug = sugestoesVinculo.get(n.nome);
                        const escolhido = config.vinculosMubi?.[normNome(n.nome)] ?? "";
                        const aberto = gruposAbertos.has(n.nome);
                        return (
                          <div key={n.nome} className="rounded-lg bg-white/80 px-2.5 py-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs font-medium text-slate-700">{n.nome}</span>
                              <span className="block text-[11px] text-slate-400">
                                {n.linhas} lançamento(s) · {formatBRL(n.total)} · {[...n.tipos].join(", ")}
                                {n.cpf ? ` · CPF ${n.cpf}` : ""}
                              </span>
                            </span>
                            {/* A pergunta: um candidato único e plausível vira botão
                                de confirmar — inclusive (principalmente) inativo.
                                Só aparece enquanto o RH não escolheu ninguém. */}
                            {sug && !escolhido && (
                              <button
                                type="button"
                                onClick={() => vincularMubi(n.nome, sug.id)}
                                className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                                title="Confirmar o vínculo sugerido — o sistema lembra para os próximos meses"
                              >
                                É {sug.nome}{sug.statusId === "inativo" ? " (Inativo)" : ""}? Vincular
                              </button>
                            )}
                            {/* Origem genérica com CPFs diferentes por baixo =
                                VÁRIAS pessoas num grupo só ("Colaboradores",
                                44 títulos). Vincular o grupo a alguém mandaria
                                título de gente diferente para uma pessoa — o
                                seletor de grupo some e sobra o título a título. */}
                            {!ehGrupoDeVarios(n) ? (
                              <Select
                                className="min-w-[190px] text-xs"
                                value={escolhido}
                                onChange={(e) => vincularMubi(n.nome, e.target.value)}
                              >
                                <option value="">Vincular a…</option>
                                <optgroup label="Quadro atual">
                                  {opcoesVinculo.quadro.map((c) => (
                                    <option key={c.id} value={c.id}>{c.nome}</option>
                                  ))}
                                </optgroup>
                                {opcoesVinculo.inativos.length > 0 && (
                                  <optgroup label="Inativos (ex-colaboradores)">
                                    {opcoesVinculo.inativos.map((c) => (
                                      <option key={c.id} value={c.id}>{c.nome}</option>
                                    ))}
                                  </optgroup>
                                )}
                              </Select>
                            ) : (
                              <span className="text-[11px] font-medium text-red-700">várias pessoas — vincule título a título ↓</span>
                            )}
                            {(n.titulos ?? []).length > 0 && (
                              <button
                                type="button"
                                className="btn-outline h-7 px-2 text-[11px]"
                                onClick={() => setGruposAbertos((s) => { const x = new Set(s); if (x.has(n.nome)) x.delete(n.nome); else x.add(n.nome); return x; })}
                              >
                                {aberto ? "Fechar" : `Conferir os ${(n.titulos ?? []).length} título(s)`}
                              </button>
                            )}
                          </div>
                          {/* Linha a linha: a descrição é onde mora o nome quando
                              a origem é genérica — dá para conferir até a última
                              linha e apontar cada título para a pessoa certa. */}
                          {aberto && (
                            <div className="mt-2 overflow-x-auto rounded-lg border border-red-100">
                              <table className="w-full text-[11px]">
                                <thead className="bg-red-50/50 text-red-800">
                                  <tr>
                                    <th className="px-2 py-1 text-left">Venc.</th>
                                    <th className="px-2 py-1 text-left">Tipo</th>
                                    <th className="px-2 py-1 text-right">Valor</th>
                                    <th className="px-2 py-1 text-left">Descrição (é aqui que está o nome)</th>
                                    <th className="px-2 py-1 text-left">Vincular este título a…</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-red-50">
                                  {(n.titulos ?? []).map((t) => (
                                    <tr key={t.idMubi} className="bg-white">
                                      <td className="px-2 py-1 whitespace-nowrap text-slate-500">{t.dataVencimento?.slice(8, 10)}/{t.dataVencimento?.slice(5, 7)}/{t.dataVencimento?.slice(2, 4)}</td>
                                      <td className="px-2 py-1 whitespace-nowrap text-slate-600">{t.tipo}</td>
                                      <td className="px-2 py-1 text-right font-medium text-slate-800 whitespace-nowrap">{formatBRL(t.valor)}</td>
                                      <td className="px-2 py-1 text-slate-600" title={t.descricao || undefined}>
                                        <span className="block max-w-[260px] truncate">{t.descricao || "—"}</span>
                                      </td>
                                      <td className="px-2 py-1">
                                        <Select
                                          className="min-w-[170px] text-[11px]"
                                          value={config.vinculosMubiTitulo?.[t.idMubi] ?? ""}
                                          onChange={(e) => vincularTitulo(t.idMubi, e.target.value)}
                                        >
                                          <option value="">Escolher…</option>
                                          <optgroup label="Quadro atual">
                                            {opcoesVinculo.quadro.map((c) => (
                                              <option key={c.id} value={c.id}>{c.nome}</option>
                                            ))}
                                          </optgroup>
                                          {opcoesVinculo.inativos.length > 0 && (
                                            <optgroup label="Inativos (ex-colaboradores)">
                                              {opcoesVinculo.inativos.map((c) => (
                                                <option key={c.id} value={c.id}>{c.nome}</option>
                                              ))}
                                            </optgroup>
                                          )}
                                        </Select>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {naoCasados.map((n, i) => <span key={i} className="rounded-full bg-white px-2.5 py-0.5 text-xs text-red-700 ring-1 ring-red-200">{n.nome} · {formatBRL(n.total)}</span>)}
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
          {/* ===================== SEÇÃO 2 — custo individual por colaborador =====================
              Vem PRIMEIRO (pedido de 02/08): é onde se confere pessoa a pessoa;
              a folha geral virou o resumo logo abaixo. */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Custo individual por colaborador</h2>
              <div className="ml-auto">
                <SegToggle
                  opcoes={[{ v: false, label: `Quadro atual (${ativosOrdenados.length})` }, { v: true, label: `Com inativos (${ativosOrdenados.length + foraDoQuadroComLanc.length})` }]}
                  valor={mostrarInativos}
                  onChange={(v) => {
                    setMostrarInativos(v);
                    // Escondeu os inativos com um inativo selecionado? Volta
                    // para o primeiro do quadro — senão a tela mostra alguém
                    // que o seletor diz não existir.
                    if (!v && colabId && !ativosOrdenados.some((c) => c.id === colabId)) {
                      setColabId(ativosOrdenados[0]?.id ?? "");
                    }
                  }}
                />
              </div>
            </div>

            <Card>
              <CardHeader
                // A tela DIZ quando a pessoa está fora do quadro (Inativo,
                // Direção…) em vez de fingir que é ativa — pedido de 01/08.
                title={
                  colabSel && !ativosOrdenados.some((c) => c.id === colabSel.id)
                    ? `Colaborador · ${d.nomeStatus(colabSel.statusId)}`
                    : "Colaborador ativo"
                }
                subtitle={`Folha real de ${compLabelLongo(compAtiva)}`}
                icon={<Users className="h-5 w-5" />}
                action={
                  <div className="flex items-center gap-1.5">
                    {/* A foto sai do cadastro (fotoDataUrl) — dá rosto ao número
                        e denuncia na hora se o mês aberto é da pessoa errada. */}
                    <Avatar nome={colabSel?.nome ?? "?"} foto={d.fotoColab(colabId)} size="sm" className="mr-1" />
                    <button
                      type="button"
                      onClick={() => irColab(-1)}
                      disabled={navegaveis.length < 2}
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
                      {navegaveis.length === 0 && <option value="">Sem colaboradores</option>}
                      <optgroup label="Quadro atual">
                        {ativosOrdenados.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.nome}
                          </option>
                        ))}
                      </optgroup>
                      {/* Quem saiu (ou está fora do quadro) mas tem folha: só
                          aparece com o seletor "Com inativos" ligado — mas se a
                          pessoa selecionada É inativa, a opção dela fica para o
                          Select não apontar para o vazio. */}
                      {mostrarInativos && foraDoQuadroComLanc.length > 0 && (
                        <optgroup label="Fora do quadro (com lançamentos)">
                          {foraDoQuadroComLanc.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nome} · {d.nomeStatus(c.statusId)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {!mostrarInativos && colabSel && !ativosOrdenados.some((c) => c.id === colabSel.id) && (
                        <option value={colabSel.id}>{colabSel.nome} · {d.nomeStatus(colabSel.statusId)}</option>
                      )}
                    </Select>
                    <button
                      type="button"
                      onClick={() => irColab(1)}
                      disabled={navegaveis.length < 2}
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
                      {/* O que a pessoa recebeu, por inteiro — e onde cada parte
                          entra. Sem isto, ver "encargos sobre o bruto (R$ 20.418)"
                          ao lado de um custo pago de R$ 25.788 não explicava os
                          R$ 5.370 do meio, que são justamente faxina e empreita. */}
                      <div className="rounded-xl border border-slate-200/70 bg-white p-4">
                        <div className="flex items-baseline justify-between">
                          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total recebido no mês</p>
                          <p className="text-lg font-semibold text-green-700 tabular-nums">{formatBRL(recebido.totalRecebido)}</p>
                        </div>
                        <dl className="mt-2 space-y-1.5 text-sm">
                          <div className="flex justify-between text-slate-600">
                            <dt>Base de encargo <span className="text-xs text-slate-400">(salário + adiantamento)</span></dt>
                            <dd className="tabular-nums">{formatBRL(recebido.base)}</dd>
                          </div>
                          {recebido.linhasFora.map((l) => (
                            <div key={l.tipo} className="flex justify-between text-slate-500">
                              <dt className="flex items-center gap-2 pl-3">
                                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: corDoTipo(l.tipo) }} />
                                {l.tipo}
                              </dt>
                              <dd className="tabular-nums">{formatBRL(l.valor)}</dd>
                            </div>
                          ))}
                        </dl>
                        {recebido.fora > 0 && (
                          <p className="mt-2 border-t border-slate-100 pt-2 text-[11px] leading-relaxed text-slate-400">
                            Os {formatBRL(recebido.fora)} acima da base entram no que a pessoa recebeu, mas <strong className="font-semibold text-slate-500">não geram FGTS, 13º nem férias</strong> — a provisão ao lado continua igual à que a empresa deve de fato.
                          </p>
                        )}
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
                                {/* Lançado à mão (dinheiro/acerto): a varredura do
                                    ERP nunca oferece este registro para remoção. */}
                                {ehManual(p) && (
                                  <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200" title="Lançado à mão pelo RH — não passa pelo ERP e a varredura não o remove">
                                    manual
                                  </span>
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
                      {/* A aba inteira fala de uma pessoa e não tinha um único
                          caminho para a ficha dela. */}
                      {colabSel ? <Link to={`/colaboradores/${colabSel.id}`} className="font-medium underline decoration-white/40 underline-offset-2 hover:decoration-white">{colabSel.nome}</Link> : "—"} · {comEncargos ? "custo real (com encargos)" : "custo pago"}
                    </p>
                  </div>
                  <p className="text-3xl font-semibold tracking-tight">{formatBRL(custoTotalColab)}</p>
                </div>
              </CardBody>
            </Card>
          </section>
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
                {/* Conferência do mês. O buraco que existia aqui: julho/2026
                    aparecia com 27 adiantamentos e nenhum salário, e a tela não
                    dizia se aquilo era espera ou perda. */}
                {conferencia.estado !== "completa" && (
                  <div
                    className={
                      "mb-4 rounded-xl border p-3 " +
                      (conferencia.estado === "incompleta"
                        ? "border-amber-200 bg-amber-50/60"
                        : "border-sky-200 bg-sky-50/60")
                    }
                  >
                    <div className="flex items-start gap-2.5">
                      {conferencia.estado === "incompleta" ? (
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      ) : (
                        <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={"text-sm font-semibold " + (conferencia.estado === "incompleta" ? "text-amber-900" : "text-sky-900")}>
                          {conferencia.titulo}
                        </p>
                        <p className={"mt-0.5 text-xs " + (conferencia.estado === "incompleta" ? "text-amber-800" : "text-sky-800")}>
                          {conferencia.detalhe}
                        </p>
                        {/* Nome, não contagem: "3 pessoas" não diz a quem ir
                            perguntar. Até 8, cada nome abre a ficha; acima
                            disso vira um clique só, senão o aviso vira parede
                            de nomes justo no mês em que falta a folha toda. */}
                        {conferencia.semSalario.length > 0 && (
                          <p className="mt-1.5 flex flex-wrap gap-1">
                            {conferencia.semSalario.length <= 8 ? (
                              conferencia.semSalario.map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => {
                                    const c = d.colabById.get(s.id);
                                    if (c) drill.abrir("Sem salário nesta competência", [c], compLabelLongo(compAtiva));
                                  }}
                                  className={
                                    "rounded-full border px-2 py-0.5 text-[11px] hover:brightness-95 " +
                                    (conferencia.estado === "incompleta"
                                      ? "border-amber-300 bg-white/70 text-amber-900"
                                      : "border-sky-300 bg-white/70 text-sky-900")
                                  }
                                  title="Ver a ficha"
                                >
                                  {s.nome}
                                </button>
                              ))
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  drill.abrir(
                                    "Sem salário nesta competência",
                                    conferencia.semSalario
                                      .map((s) => d.colabById.get(s.id))
                                      .filter((c): c is Colaborador => !!c),
                                    compLabelLongo(compAtiva),
                                  )
                                }
                                className={
                                  "rounded-full border px-2 py-0.5 text-[11px] hover:brightness-95 " +
                                  (conferencia.estado === "incompleta"
                                    ? "border-amber-300 bg-white/70 text-amber-900"
                                    : "border-sky-300 bg-white/70 text-sky-900")
                                }
                              >
                                Ver as {conferencia.semSalario.length} pessoas
                              </button>
                            )}
                          </p>
                        )}
                        {conferencia.estado === "incompleta" && (
                          <button
                            type="button"
                            className="btn-outline mt-2 h-8 px-2.5 text-xs"
                            onClick={() => void buscarHistorico()}
                            disabled={buscandoMubi}
                            title="Varre o histórico do Mubisys e mostra a prévia antes de gravar"
                          >
                            <History className="h-3.5 w-3.5" /> Puxar histórico do ERP
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Folha lançada antes de o contador mandar a planilha do mês:
                    o rateio e os encargos ficam em zero e isso tem de estar
                    escrito — zero sem explicação passa por número real. */}
                {semPlanoNaComp && (
                  <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Sem plano de contas em {compLabelLongo(compAtiva)}.</span>{" "}
                      A folha por pessoa está aqui normalmente, mas o rateio, os encargos e o Custo Global ficam zerados até você enviar a planilha do contador deste mês.
                    </p>
                  </div>
                )}

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
                            /* Ver "Comissão R$ 42.310" e não saber quem recebeu
                               era o buraco da conferência do mês — os dois cards
                               vizinhos já abrem a lista. */
                            <tr key={l.tipo} className="cursor-pointer hover:bg-slate-50/60" onClick={() => abrirDrillTipo(l.tipo)} title={`Ver quem recebeu ${l.tipo}`}>
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
                      <BarrasVerticais
                        data={historicoColab.map((h) => ({ nome: h.nome, valor: h.valor }))}
                        moeda
                        altura={260}
                        /* Clicar no pico leva o seletor de competência até lá —
                           antes era preciso achar o mês na lista lá em cima. */
                        onItemClick={(nome) => {
                          const h = historicoColab.find((x) => x.nome === nome);
                          if (h) setComp(h.competencia);
                        }}
                      />
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
