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
  Clock, History, AlertTriangle, TrendingDown, Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Tabs, useAbaAtiva } from "@/components/ui/tabs";
import { ViagensPainel } from "@/pages/Viagens";
import { Card, CardHeader, CardBody, useAbertoPersistido } from "@/components/ui/card";
import { HistoricoMensal } from "@/components/custos/historico-mensal";
import { AuditoriaLancamentos } from "@/components/custos/auditoria-lancamentos";
import { ConferenciaTipos } from "@/components/custos/conferencia-tipos";
import { FaixaMeses, LegendaMeses } from "@/components/custos/faixa-meses";
import { Societarias } from "@/components/custos/societarias";
import { PreviaFolha, type CoberturaBusca } from "@/components/custos/previa-folha";
import { TotalEquipe } from "@/components/custos/total-equipe";
import { resumoDaEquipe, pesoDaPessoa, porPessoaNoMes, type PessoaNoMes } from "@/lib/provisaoEquipe";
import { mudouSobAPrevia, patchDeAplicacao, patchDeDesfazer, planoDeDesfazer, resumoDaPrevia, retratoAntesDeAplicar } from "@/lib/previaFolha";
import { variacaoMensal, sinaisDaCompetencia, type Sinal, type Tom } from "@/lib/custosResumo";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Avatar, EmptyState, Progress } from "@/components/ui/misc";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { Select, Campo, Input } from "@/components/ui/form";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { useColecao, useConfig, salvarConfig } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { ehSocio } from "@/lib/societario";
import { faltasDoMes, pagosForaDoQuadro, quadroDoMes, quantosNoQuadro } from "@/lib/quadroNoMes";
import { useSessao } from "@/lib/session";
import { calcularEncargos, separarRecebido, PREFIXO_FUNCIONARIOS } from "@/lib/encargos";
import { podeGerir, ehMaster } from "@/lib/rbac";
import { formatBRL, formatDate } from "@/lib/format";
import {
  calcularHoraExtra, minutosDaDuracao, diferencaDoCalculo, valorDigitado,
  horasDecimais, ADICIONAIS_HE, FATOR_HE_PADRAO, DIVISOR_MENSAL_PADRAO, dinheiroAmbiguo } from "@/lib/pontoFolha";
import { minParaHora } from "@/lib/pontoImport";
import { somaPorTipo, corDoTipo, TIPOS_PAGAMENTO, TIPOS_ENCARGO } from "@/lib/folha";
import { buscarPagamentosMubi, buscarHistoricoMubi, competenciasParaTras, paraRegistros, sugerirSalarios, sugerirVinculo, norm as normNome, type ContaForaDaFolha, type LinhaMubi, type RespostaMubi, type SugestaoSalario, type NaoCasado } from "@/lib/mubiPagamentos";
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
  contaEhConfidencial,
  classeDaConta,
  confidencialDoMes,
  type DiffPagamentos,
} from "@/lib/custos";
import { lerPlanilha } from "@/lib/xlsx-lite";
import { CARDS_CONFIDENCIAIS } from "@/data/classificacaoContas";
import { buscarPlanoCompleto, compararPlano, competenciaEhDoContador, mesclarPlano, montarPlanoDoErp, type ComparacaoPlano, type ContaMubi } from "@/lib/mubiPlano";
import { enviarColecao, apagarRegistrosNuvem, enviarConfigNuvem } from "@/lib/sync";
import { emLote, registrarAcaoManual } from "@/lib/auditoria";
import type {
  ClassificacaoConta,
  ClasseCusto,
  Colaborador,
  ContaPlano,
  Pagamento,
  RetratoFolha,
} from "@/data/types";

// Classes disponíveis no editor (confidencial fica fora — societárias só do master).
const CLASSES_EDITAVEIS: ClasseCusto[] = ["individual", "rateio", "encargo", "ignorar"];

// Cor de cada tom do semáforo do topo. Semântica (ok / atenção / ruim), não a
// cor da marca — o chip precisa ler "tem problema" antes de a pessoa ler o texto.
const TOM_CLASSES: Record<Tom, string> = {
  ok: "border-green-200 bg-green-50 text-green-900 hover:border-green-300",
  atencao: "border-amber-200 bg-amber-50 text-amber-900 hover:border-amber-300",
  ruim: "border-red-200 bg-red-50 text-red-900 hover:border-red-300",
  neutro: "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300",
};

// Última busca automática no ERP que FALHOU. Fica fora do componente de
// propósito: Custos é rota lazy, então um useRef morre ao navegar e, com o ERP
// fora do ar, cada volta à tela refazia a chamada de ~40s em silêncio. Não vai
// para a config (é sinal de rede, não dado do RH); recarregar a página tenta de novo.
let ultimaFalhaMubi: { competencia: string; em: number } | null = null;
const ESPERA_APOS_FALHA_MS = 30 * 60 * 1000;

const ABAS = ["custos", "global", "societarias", "sync", "viagens"];

export default function Custos() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const drillBase = useDrill();
  // Valor de cada pessoa no mês aberto pelo drill — vira a coluna extra da lista.
  // Qualquer OUTRO drill limpa a coluna: uma lista de pessoas com a coluna
  // "Custo estimado" de um mês que não é o dela seria número errado na tela.
  const [valorDoMesPorPessoa, setValorDoMesPorPessoa] = useState<Map<string, PessoaNoMes>>(new Map());
  const drill = useMemo(
    () => ({
      ...drillBase,
      abrir: (titulo: string, lista: Colaborador[], subtitulo?: string) => {
        setValorDoMesPorPessoa(new Map());
        drillBase.abrir(titulo, lista, subtitulo);
      },
    }),
    [drillBase],
  );

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
  // Abre no mês MAIS RECENTE com dado (pedido do Léo, 07/09/2026). Antes abria
  // no último mês fechado pelo contador, com medo de mostrar rateio e Custo
  // Global zerados no mês corrente — mas agora a faixa de chips diz o estado de
  // cada mês, o rateio sem plano diz "indisponível" em vez de zero, e o plano
  // pode ser puxado do ERP na hora. Abrir em junho quando já há folha de agosto
  // fazia a tela parecer parada.
  const compPadrao = ultimaComp;
  const [comp, setComp] = useState<string>(compPadrao);
  // Aba ativa controlada por fora: os chips de "está atualizado?" precisam
  // mandar abrir Sincronização ou Custo Global antes de rolar até o alvo.
  const [aba, setAba] = useAbaAtiva("custos:aba", ABAS, "custos");
  // Declarado aqui em cima porque o quadro do mês (ativosOrdenados) precisa dele.
  const compAtiva = comp && competencias.includes(comp) ? comp : compPadrao;

  // O QUADRO DO MÊS ABERTO, não o de hoje (pedido do Léo, 07/09/2026): quem
  // entrou depois só aparece do mês dele em diante, quem saiu some do mês
  // seguinte. No Custo Global nada disso muda — lá o dinheiro dele fez parte
  // daquela conta e continua somando.
  const ativosOrdenados = useMemo(() => quadroDoMes(d.colaboradores, compAtiva, pagamentos as Pagamento[]), [d.colaboradores, compAtiva, pagamentos]);
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
  // Quem estava no quadro do mês e não tem lançamento — a conferência que
  // faltava. Junho tinha 8 pessoas assim e a tela não dizia, porque ela só
  // mostrava quem TEM pagamento.
  const faltantes = useMemo(
    () => faltasDoMes(d.colaboradores, pagamentos as Pagamento[], compAtiva),
    [d.colaboradores, pagamentos, compAtiva],
  );
  const recebeuForaDoQuadro = useMemo(
    () => pagosForaDoQuadro(d.colaboradores, pagamentos as Pagamento[], compAtiva),
    [d.colaboradores, pagamentos, compAtiva],
  );
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
  // Trocar de mês pode tirar a pessoa aberta do quadro (ela entrou depois, ou
  // já tinha saído). Sem isto a tela ficava numa pessoa que o seletor daquele
  // mês diz não existir — mostrando zero, que se lê como "não recebeu".
  useEffect(() => {
    if (!colabId) return;
    const visivel = mostrarInativos ? [...ativosOrdenados, ...foraDoQuadroComLanc] : ativosOrdenados;
    if (visivel.length > 0 && !visivel.some((c) => c.id === colabId)) setColabId(visivel[0].id);
  }, [ativosOrdenados, foraDoQuadroComLanc, mostrarInativos, colabId]);

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

  /* HORA EXTRA CALCULADA (pedido do RH: "seria melhor ele calcular, tipo a
     planilha — eu coloco o dia, a hora e o salário, aí ele calcula").
     A conta vem de pontoFolha.ts, a MESMA da Folha Variável: salário ÷ 220 ×
     adicional × horas. Uma regra só, em um lugar só — se o acordo coletivo
     mudar o divisor, muda lá e vale nas duas telas. */
  const [heDia, setHeDia] = useState<string>("");
  const [heDuracao, setHeDuracao] = useState<string>("");
  /* O RH pediu para poder AJUSTAR a conta ("é melhor deixar de uma maneira
     onde eu posso alterar e ajustar o cálculo"). Por isso o adicional é um
     percentual digitável, e não uma lista de dois itens: contabilidade que usa
     60%, ou adicional de acordo coletivo, não cabia nas opções fixas. */
  const [hePercentual, setHePercentual] = useState<string>("50");
  /* A jornada mensal também. 220h é a da Impresilk (44h/semana), mas quem faz
     40h/semana usa 200 — e quem faz a folha lá fora pode usar outro número. */
  const [heDivisor, setHeDivisor] = useState<string>(String(DIVISOR_MENSAL_PADRAO));
  const [heSalario, setHeSalario] = useState<string>("");
  /* O valor calculado preenche o campo, mas o RH pode escrever por cima —
     "tem horas que tem bônus". Esta marca lembra que ele mexeu, para o
     recálculo não apagar o que a pessoa acabou de digitar. */
  const [valorTocado, setValorTocado] = useState(false);

  // Competência efetiva (cai para a última quando a selecionada some / inicial vazia).

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
  // O divisor é o quadro DAQUELE mês, não o de hoje (pedido do Léo, 07/09/2026).
  const nColab = useMemo(() => quantosNoQuadro(d.colaboradores, compAtiva, pagamentos as Pagamento[]), [d.colaboradores, compAtiva, pagamentos]);
  const mapaClasse = useMemo(() => classeMap(classificacaoCustos), [classificacaoCustos]);

  // ---------- Uploads ----------
  const hojeIso = new Date().toISOString().slice(0, 7);
  // Fica no último mês COM plano (não no último com folha): o seletor de meses
  // cresceu e o envio de planilha sobrescreve a competência escolhida — mudar
  // esse padrão calado seria trocar o mês em que o plano do contador cai.
  // Abre no mês ATUAL (pedido do Léo, 07/09/2026), não no último com dado.
  const [compUpload, setCompUpload] = useState<string>(hojeIso);
  const [anoPlano, setAnoPlano] = useState<string>(hojeIso.slice(0, 4));
  // Importação avulsa de comissões, casando por NOME (caso à parte)
  // Prévia de conciliação da folha (subir a mesma planilha: mexe só no diferente).
  const [folhaPrev, setFolhaPrev] = useState<{
    diff: DiffPagamentos;
    naoCasados: NaoCasado[];
    cpfsAprendidos?: { colaboradorId: string; cpf: string }[];
    totalLinhas: number;
    // Presente só quando a origem foi o ERP (para mostrar as despesas coletivas
    // e permitir vincular quem não casou).
    mubi?: { linhas: LinhaMubi[]; coletivas: LinhaMubi[]; truncado: boolean; foraDaFolha?: ContaForaDaFolha[]; idsForaDaFolha?: string[]; busca?: CoberturaBusca };
    /** Competências que a busca cobriu — o que pode ser dado como ausente. */
    janela: string[];
  } | null>(null);
  // Remoção é POR LINHA marcada (07/09/2026) — nunca um checkbox que apaga
  // tudo. E cada aviso grave pede "conferi" antes de o botão liberar.
  const [ausentesMarcados, setAusentesMarcados] = useState<Set<string>>(new Set());
  // Chaves de alarme conferidas (chaveDoAlarme: tipo + quantos + valor + ids).
  // Guardar só o tipo deixava o "Conferi" de "remover 1" valendo para "remover 74".
  const [confirmados, setConfirmados] = useState<Set<string>>(new Set());
  const [confirmarAplicacao, setConfirmarAplicacao] = useState(false);
  const [confirmarDesfazer, setConfirmarDesfazer] = useState(false);
  // Retratos para desfazer: cada aplicação guarda antes/depois dos tocados.
  const recuperacoesColecao = useColecao("recuperacoesFolha");
  // Busca no ERP Mubisys
  const [compMubi, setCompMubi] = useState<string>(() => config.ultimaBuscaMubi?.competencia || ultimaComp || hojeIso);
  const [buscandoMubi, setBuscandoMubi] = useState(false);
  const [erroMubi, setErroMubi] = useState("");
  // Resultado da busca automática, esperando o RH querer revisar.
  const [respostaMubi, setRespostaMubi] = useState<RespostaMubi | null>(null);
  // Plano de contas puxado do ERP, esperando a conferência do RH.
  const [planoPrev, setPlanoPrev] = useState<{
    competencia: string;
    contas: ContaPlano[];
    comparacao: ComparacaoPlano;
    titulos: number;
    incompleta: boolean;
    pessoais: ContaMubi[];
    societarias: ContaMubi[];
    /** Renumeradas pelo contador e reconhecidas pelo nome; e as que ficaram sem par. */
    renumeradas: number;
    semPar: ContaMubi[];
    referencia: string | null;
    naoReconhecidas: ContaMubi[];
    societariasOmitidasNoServidor: number;
    /** O mês já tem a planilha do contador: aqui só se confere, não se grava. */
    somenteConferencia: boolean;
  } | null>(null);
  const [buscandoPlano, setBuscandoPlano] = useState("");
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
  // A mesma régua do lado dos Pagamentos, para o plano do ano (pedido do
  // Leonardo, 07/09/2026): puxar 9 meses leva minutos e o botão sozinho não diz
  // onde está nem deixa parar.
  const [puxandoAno, setPuxandoAno] = useState<{ feitos: number; total: number; onde: string } | null>(null);
  const pararAnoRef = useRef(false);
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

  // O plano de contas do mês direto do ERP, para o mês que o contador ainda não
  // fechou. Cai na mesma regra da planilha: nada é gravado sem o RH conferir.
  const puxarPlanoDoErp = async () => {
    setBuscandoPlano("Consultando o Mubisys…");
    try {
      const r = await buscarPlanoCompleto(compUpload, (pag, tot) =>
        setBuscandoPlano(tot > 1 ? `Consultando o Mubisys… página ${pag}/${tot}` : "Consultando o Mubisys…"),
      );
      if (r.contas.length === 0) {
        toast(`O ERP não tem título nenhum vencendo em ${compLabelLongo(compUpload)}.`, "erro");
        return;
      }
      const montado = montarPlanoDoErp(r.contas, compUpload, mapaClasse, r.equivalencias);
      const doMes = planoContas.filter((p: ContaPlano) => p.competencia === compUpload);
      setPlanoPrev({
        competencia: compUpload,
        contas: montado.contas,
        comparacao: compararPlano(doMes, montado.contas, { ocultarConfidenciais: !ehMaster(sessao) }),
        titulos: r.titulos,
        incompleta: r.incompleta,
        pessoais: montado.pessoais,
        societarias: montado.societarias,
        renumeradas: montado.renumeradas,
        semPar: montado.semPar,
        referencia: r.equivalencias?.referencia ?? null,
        naoReconhecidas: montado.naoReconhecidas,
        societariasOmitidasNoServidor: r.societariasOmitidas,
        somenteConferencia: competenciaEhDoContador(planoContas, compUpload),
      });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao consultar o Mubisys.", "erro");
    } finally {
      setBuscandoPlano("");
    }
  };

  /**
   * Puxa e GRAVA o plano de um mês sem prévia — o caminho da automação e do
   * "puxar o ano". Devolve o que aconteceu, para quem chamou contar.
   * Mês fechado pelo contador não é tocado.
   */
  const puxarPlanoDoErpEmSilencio = async (comp: string): Promise<"gravado" | "contador" | "vazio" | "incompleto" | "falhou"> => {
    try {
      setBuscandoPlano(`Trazendo ${compLabel(comp)} do Mubisys…`);
      const r = await buscarPlanoCompleto(comp);
      if (r.incompleta) return "incompleto";
      const montado = montarPlanoDoErp(r.contas, comp, mapaClasse, r.equivalencias);
      const base = planoColecao.items as ContaPlano[];
      if (competenciaEhDoContador(base, comp)) return "contador";
      salvarCfg({ ultimoPlanoMubi: { competencia: comp, em: new Date().toISOString(), contas: montado.contas.length } });
      if (montado.contas.length === 0) return "vazio";
      planoColecao.definir(mesclarPlano(base, montado.contas, comp));
      void enviarColecao("planoContas");
      registrarAcaoManual(`Trouxe o plano de contas de ${compLabelLongo(comp)} do Mubisys`, `${montado.contas.length} conta(s) coletiva(s)`, "planoContas");
      return "gravado";
    } catch {
      salvarCfg({ ultimoPlanoMubi: { competencia: comp, em: new Date().toISOString(), contas: 0 } });
      return "falhou";
    } finally {
      setBuscandoPlano("");
    }
  };

  // O ANO INTEIRO (pedido do Léo, 07/09/2026): mês a mês, do primeiro ao
  // corrente, cada um pelo mesmo caminho seguro. Mês do contador é pulado e
  // dito no fim. Sequencial de propósito — o ERP não aguenta doze de uma vez.
  const puxarAnoDoErp = async (ano: string) => {
    const hojeComp = hojeIso;
    const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`).filter((c) => c <= hojeComp);
    const placar = { gravado: [] as string[], contador: [] as string[], vazio: [] as string[], incompleto: [] as string[], falhou: [] as string[] };
    pararAnoRef.current = false;
    setPuxandoAno({ feitos: 0, total: meses.length, onde: "" });
    try {
      for (let i = 0; i < meses.length; i++) {
        if (pararAnoRef.current) break;
        const comp = meses[i];
        setPuxandoAno({ feitos: i, total: meses.length, onde: compLabel(comp) });
        const r = await puxarPlanoDoErpEmSilencio(comp);
        placar[r].push(compLabel(comp));
      }
    } finally {
      setPuxandoAno(null);
    }
    const parou = pararAnoRef.current ? " (interrompido — o que já veio ficou gravado)" : "";
    const partes = [
      placar.gravado.length ? `${placar.gravado.length} mês(es) gravado(s)` : "",
      placar.contador.length ? `${placar.contador.length} do contador (não tocados)` : "",
      placar.vazio.length ? `${placar.vazio.length} sem coletivo` : "",
      placar.incompleto.length ? `${placar.incompleto.length} incompleto(s)` : "",
      placar.falhou.length ? `${placar.falhou.length} falharam: ${placar.falhou.join(", ")}` : "",
    ].filter(Boolean);
    toast(`Plano de ${ano} pelo Mubisys: ${partes.join(" · ") || "nada a trazer"}${parou}.`, placar.falhou.length ? "erro" : undefined);
  };

  const aplicarPlanoDoErp = () => {
    if (!planoPrev || planoPrev.somenteConferencia) return;
    const { competencia, contas } = planoPrev;
    // MESCLA, não substitui: o que o ERP trouxe entra; o que já existia e ele
    // não trouxe fica. Nada é apagado na nuvem.
    planoColecao.definir(mesclarPlano(planoContas as ContaPlano[], contas, competencia));
    void enviarColecao("planoContas");
    setComp(competencia);
    registrarAcaoManual(`Montou o plano de contas de ${compLabelLongo(competencia)} pelo Mubisys`, `${contas.length} conta(s)`, "planoContas");
    toast(`Plano de contas de ${compLabel(competencia)} montado pelo ERP: ${contas.length} contas.`);
    setPlanoPrev(null);
  };

  // Busca a folha do mês direto no Contas a Pagar do Mubisys e cai na MESMA
  // prévia de conciliação da planilha — nada é gravado sem o RH confirmar.
  // Monta a prévia de conciliação a partir do que veio do ERP.
  const previaDoMubi = (r: RespostaMubi, vinculos: Record<string, string>, busca?: CoberturaBusca) => {
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
    setAusentesMarcados(new Set());
    setConfirmados(new Set());
    setFolhaPrev({
      diff: conciliarPagamentos(existentesDaComp, registros, comps),
      naoCasados, cpfsAprendidos, totalLinhas: registros.length,
      janela: [...comps].filter(Boolean).sort(),
      mubi: { linhas: r.linhas, coletivas, truncado: r.truncado, foraDaFolha: r.contasForaDaFolha, idsForaDaFolha: r.idsForaDaFolha, busca: busca ?? { truncado: r.truncado, pedidas: [r.competencia], lidas: [r.competencia], falhas: [] } },
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
        { competencia: comps[comps.length - 1], buscadoEm: r.buscadoEm, totalTitulosNoMes: r.linhas.length, paginas: 0, truncado: r.truncado, linhas: r.linhas, idsForaDaFolha: r.idsForaDaFolha },
        vinculos,
        // A cobertura vai junto: mês que falhou aparecia só num toast e sumia.
        { truncado: r.truncado, pedidas: comps, lidas: r.competenciasLidas, falhas: r.falhas.map((f) => f.competencia) },
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
      salvarCfg({ ultimaBuscaMubi: {
        competencia, em: r.buscadoEm, quantidade: registros.length,
        // O que sobrou fora dos vinculados. É isto que explica "consultou 140,
        // tem 141 gravados" na própria tela, sem ninguém precisar deduzir.
        consultados: r.linhas.length, naoCasados: naoCasados.length, truncado: !!r.truncado,
      } });
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

  // PLANO DE CONTAS SOZINHO (pedido do Léo, 07/09/2026: "se resolve na
  // sincronização automática"). Ao abrir um mês que tem folha e não tem plano
  // nenhum — e que não é mês fechado pelo contador — o coletivo vem do ERP e
  // entra sem clique. É seguro porque o caminho já é o de mesclar: só entra o
  // que não é pagamento a pessoa, nada é apagado, 2.14 não passa. No máximo
  // uma tentativa por mês a cada 6 horas; falha fica quieta e espera.
  const planoAutoRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!compAtiva || !podeGerir(sessao) || buscandoPlano) return;
    if (planoAutoRef.current.has(compAtiva)) return;
    const temFolha = (pagamentos as Pagamento[]).some((p) => p.competencia === compAtiva);
    const temPlano = (planoContas as ContaPlano[]).some((p) => p.competencia === compAtiva);
    if (!temFolha || temPlano) return;
    const ultimo = config.ultimoPlanoMubi;
    if (ultimo?.competencia === compAtiva && ultimo.em && Date.now() - new Date(ultimo.em).getTime() < 6 * 60 * 60 * 1000) return;
    planoAutoRef.current.add(compAtiva);
    void puxarPlanoDoErpEmSilencio(compAtiva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compAtiva, sessao, pagamentos, planoContas]);

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
    setAusentesMarcados(new Set()); // o vínculo pode ter tirado alguém de "ausente"
    setFolhaPrev({
      diff: conciliarPagamentos(existentesDaComp, registros, comps),
      naoCasados, cpfsAprendidos, totalLinhas: registros.length,
      janela: [...comps].filter(Boolean).sort(),
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
  // A inteligência da prévia (lib/previaFolha): quanto cada mês muda, o que
  // muda em cada linha, o que pede confirmação e o que bloqueia.
  const resumoPrev = useMemo(() => {
    if (!folhaPrev) return null;
    // Título que veio do ERP sem pessoa: existe, só não casou — nunca é "sumiu".
    const semDono = new Set<string>();
    for (const n of folhaPrev.naoCasados) for (const t of n.titulos ?? []) semDono.add(String(t.idMubi));
    for (const l of folhaPrev.mubi?.coletivas ?? []) semDono.add(String(l.idMubi));
    // Título que o ERP tem mas cuja conta ficou fora da lista de folha: existe,
    // e remover destrói registro de dinheiro real.
    const foraDaFolha = new Set((folhaPrev.mubi?.idsForaDaFolha ?? []).map(String));
    return resumoDaPrevia({
      diff: folhaPrev.diff,
      gravados: pagamentos as Pagamento[],
      janela: new Set(folhaPrev.janela),
      ausentesMarcados,
      colaboradorPor: (id) => d.colabById.get(id),
      tiposEncargo: TIPOS_ENCARGO,
      busca: folhaPrev.mubi?.busca,
      semDono,
      foraDaFolha,
    });
  }, [folhaPrev, pagamentos, ausentesMarcados, d.colabById]);

  const ultimoRetrato = useMemo(
    () => [...(recuperacoesColecao.items as RetratoFolha[])].filter((r) => !r.usado).sort((a, b) => b.em.localeCompare(a.em))[0] ?? null,
    [recuperacoesColecao.items],
  );
  const planoDesfazer = useMemo(() => (ultimoRetrato ? planoDeDesfazer(ultimoRetrato, pagamentos as Pagamento[]) : null), [ultimoRetrato, pagamentos]);

  const desfazerUltimaAplicacao = () => {
    if (!ultimoRetrato || !planoDesfazer) return;
    const { restaurar, apagar, pulados, semVolta } = planoDesfazer;
    emLote(`Desfez a aplicação da folha do ERP de ${ultimoRetrato.competencias.map(compLabel).join(", ")}`, () => {
      for (const p of restaurar) pagamentosColecao.atualizar(p.id, patchDeDesfazer(p));
      for (const id of apagar) pagamentosColecao.remover(id);
    });
    recuperacoesColecao.atualizar(ultimoRetrato.id, { usado: true });
    const partes = [
      restaurar.length ? `${restaurar.length} restaurado(s)` : "",
      apagar.length ? `${apagar.length} novo(s) apagado(s)` : "",
      pulados.length ? `${pulados.length} pulado(s) (editados depois)` : "",
      semVolta.length ? `${semVolta.length} removido(s) não voltam por aqui` : "",
    ].filter(Boolean).join(" · ");
    toast(`Aplicação desfeita: ${partes || "nada a desfazer"}.`, pulados.length || semVolta.length ? "info" : "sucesso");
    setConfirmarDesfazer(false);
  };

  const aplicarFolha = () => {
    if (!folhaPrev || !resumoPrev) return;
    // O clique abre a confirmação com o resumo em reais; quem grava é o passo seguinte.
    setConfirmarAplicacao(true);
  };

  const aplicarFolhaAgora = () => {
    if (!folhaPrev || !resumoPrev) return;
    setConfirmarAplicacao(false);
    const { diff } = folhaPrev;
    const removidos = diff.ausentes.filter((a) => ausentesMarcados.has(a.id));
    const comps = new Set<string>();
    for (const x of diff.alterados) { comps.add(x.antigo.competencia); comps.add(x.novo.competencia); }
    for (const x of diff.novos) comps.add(x.competencia);
    for (const a of removidos) comps.add(a.competencia);
    const lista = [...comps].filter(Boolean).sort();
    const faixa = lista.length === 0 ? compLabel(compAtiva) : lista.length === 1 ? compLabel(lista[0]) : `${compLabel(lista[0])}–${compLabel(lista[lista.length - 1])}`;

    // 1) O RETRATO ANTES DE QUALQUER ESCRITA. Cada registro tocado com antes e
    //    depois, numa coleção própria (nível RH no sync). É o que permite
    //    "Desfazer a última aplicação". Sem ele, o histórico guardava só
    //    contagens e o valor anterior de um "corrigido" não ficava em lugar nenhum.
    // 0) O CHÃO AINDA É O MESMO? A prévia congela o diff na hora da busca e o
    //    sync puxa a cada 20 s. Se alguém editou (ou apagou) um lançamento que
    //    esta aplicação ia tocar, gravar por cima apagaria esse trabalho — e o
    //    retrato guardaria como "antes" um valor que já não existia. Aborta e
    //    manda refazer a busca, que é barato.
    const mexeramEmbaixo = mudouSobAPrevia(diff, ausentesMarcados, pagamentos as Pagamento[]);
    if (mexeramEmbaixo.length) {
      const sumiram = mexeramEmbaixo.filter((x) => x.motivo === "sumiu").length;
      toast(
        `${mexeramEmbaixo.length} lançamento(s) mudaram depois desta busca` +
          (sumiram ? ` (${sumiram} sumiram)` : "") +
          ". Nada foi gravado — busque de novo para ver o estado atual.",
        "erro",
      );
      return;
    }
    const retrato = retratoAntesDeAplicar(diff, ausentesMarcados, new Date().toISOString(), `Folha do ERP · ${faixa}`, pagamentos as Pagamento[]);
    if (retrato.tocados.length > 0) recuperacoesColecao.criarOuAtualizar(retrato);

    // 2) O lote mecânico — UMA linha no histórico, com a faixa e o que mudou.
    const partes = resumoPrev.grupos.map((g) => `${g.itens.length} ${g.natureza}`).concat(
      diff.novos.length ? [`${diff.novos.length} novos`] : [],
      removidos.length ? [`${removidos.length} removidos`] : [],
    );
    emLote(`Aplicou a folha do ERP · ${faixa} · ${partes.join(" · ") || "nada"}`, () => {
      const nd = (x?: string) => (x ?? "").trim();
      for (const { antigo, novo } of diff.iguais) {
        const adotaId = !antigo.idMubi && !!novo.idMubi;
        if (nd(antigo.descricao) !== nd(novo.descricao) || adotaId) {
          pagamentosColecao.atualizar(antigo.id, { descricao: novo.descricao || undefined, ...(adotaId ? { idMubi: novo.idMubi } : {}) });
        }
      }
      // O registro inteiro, com a MESMA lista de campos do retrato (patchDeAplicacao):
      // gravar só valor/data deixava pessoa, competência e tipo congelados.
      for (const { antigo, novo } of diff.alterados) pagamentosColecao.atualizar(antigo.id, patchDeAplicacao(novo));
      for (const n of diff.novos) pagamentosColecao.criarOuAtualizar(n);
      for (const a of removidos) pagamentosColecao.remover(a.id);
    });

    // 3) O placar (só contagens — a config sobe inteira e é lida por qualquer logado).
    salvarCfg({ ultimaConciliacaoMubi: {
      em: new Date().toISOString(),
      competencias: lista,
      iguais: diff.iguais.length,
      corrigidos: diff.alterados.length,
      novos: diff.novos.length,
      mantidos: diff.ausentes.length - removidos.length,
      removidos: removidos.length,
    } });

    // 4) CPF aprendido do ERP, só onde o cadastro está vazio (fora do lote: tem linha própria).
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

    // 5) Salários marcados — FORA do lote, um por pessoa: é decisão humana e o
    //    campo mais sensível do sistema; engolido no resumo do lote, mudava sem
    //    deixar rastro individual (o histórico mascara o valor, mas registra quem).
    const aplicaveis = salarios.filter((x) => salariosMarcados.has(x.colaborador.id));
    for (const sug of aplicaveis) colaboradoresColecao.atualizar(sug.colaborador.id, { salario: sug.sugerido });

    const mexeu = resumoPrev.contaNoBotao + resumoPrev.silenciosos;
    const parteSalario = aplicaveis.length ? ` Salário preenchido em ${aplicaveis.length} colaborador(es).` : "";
    const avisoCpf = cpfsPreenchidos ? ` CPF preenchido em ${cpfsPreenchidos} colaborador(es).` : "";
    toast(
      mexeu === 0
        ? `Folha já estava igual — nada a alterar.${parteSalario}${avisoCpf}`
        : `Folha aplicada (${faixa}): ${partes.join(", ")}.${parteSalario}${avisoCpf} Dá para desfazer em Sincronização.`,
      "sucesso",
    );
    fecharPrevia();
  };

  // ---------- Seção 1: custo individual por colaborador ----------
  const pagsDoColab = useMemo(
    () => pagamentos.filter((p: Pagamento) => p.colaboradorId === colabId && p.competencia === compAtiva),
    [pagamentos, colabId, compAtiva],
  );
  // Base da régua de % nos lançamentos da pessoa: tudo que ela recebeu no mês.
  const totalLancColab = useMemo(() => pagsDoColab.reduce((t: number, p: Pagamento) => t + (Number(p.valor) || 0), 0), [pagsDoColab]);
  const linhasColab = useMemo(() => somaPorTipo(pagsDoColab), [pagsDoColab]);

  // ---------- Resumo geral do mês (folha de todos os colaboradores) ----------
  // A FOLHA GERAL É DA EQUIPE. O que sai para sócio (arrendamento, retirada,
  // plano de saúde da direção) é despesa societária: entra na ficha da pessoa,
  // mas não no custo da equipe, não vira base de FGTS/13º/férias e não entra na
  // variação do mês — senão o honorário de um fundador apareceria como
  // "a folha subiu". Ver lib/societario.
  const ehDeSocio = useMemo(() => {
    const socios = new Set(d.colaboradores.filter((c: Colaborador) => ehSocio(c)).map((c: Colaborador) => c.id));
    return (p: Pagamento) => socios.has(p.colaboradorId);
  }, [d.colaboradores]);
  const pagamentosDaEquipe = useMemo(() => (pagamentos as Pagamento[]).filter((p) => !ehDeSocio(p)), [pagamentos, ehDeSocio]);
  const pagsDoMes = useMemo(() => pagamentosDaEquipe.filter((p: Pagamento) => p.competencia === compAtiva), [pagamentosDaEquipe, compAtiva]);
  const pagsSocietariosDoMes = useMemo(
    () => (pagamentos as Pagamento[]).filter((p) => p.competencia === compAtiva && ehDeSocio(p)),
    [pagamentos, compAtiva, ehDeSocio],
  );
  const totalSocietarioMes = useMemo(() => pagsSocietariosDoMes.reduce((s, p) => s + (Number(p.valor) || 0), 0), [pagsSocietariosDoMes]);
  const linhasMes = useMemo(() => somaPorTipo(pagsDoMes), [pagsDoMes]);
  // Quem compõe o total de um mês, pessoa por pessoa e com o valor de cada uma
  // (pedido do Leonardo, 07/09/2026: o número do mês tem de ser clicável).
  const abrirDrillDoMes = (comp: string) => {
    const linhas = porPessoaNoMes(pagamentosDaEquipe, comp);
    const pessoas = linhas
      .map((l) => d.colabById.get(l.colaboradorId))
      .filter((c): c is NonNullable<typeof c> => !!c);
    const porPessoa = new Map(linhas.map((l) => [l.colaboradorId, l]));
    setValorDoMesPorPessoa(porPessoa);
    // Lançamento de quem não está no cadastro entra na SOMA do mês mas não tem
    // linha na lista. Sem esta frase, o total do cabeçalho não fecharia com o
    // que está embaixo dele e ninguém saberia por quê.
    const semCadastro = linhas.filter((l) => !d.colabById.get(l.colaboradorId));
    const total = linhas.reduce((s, l) => s + l.estimado, 0);
    drillBase.abrir(
      `Custo estimado de ${compLabelLongo(comp)}`,
      pessoas,
      `${formatBRL(total)} · ${pessoas.length} pessoa(s) · pago + provisões, sem sócios` +
        (semCadastro.length
          ? ` · ${semCadastro.length} lançamento(s) de quem não está no cadastro (${formatBRL(semCadastro.reduce((s, l) => s + l.estimado, 0))}) entram na soma e não têm linha aqui`
          : ""),
    );
  };

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

  // ---------- Topo da tela: "está atualizado?" e "o que mudou?" ----------
  // A auditoria de 06/09/2026 mediu 4.591 px de altura e a resposta a "isto
  // está atualizado?" a seis telas dos números. Aqui ficam os dois juntos.
  //
  // "Pago" é o que foi pago ÀS PESSOAS: FGTS/INSS lançados são custo da empresa
  // e ficam fora — a mesma régua do `custoPago` de cada colaborador logo acima,
  // senão o topo e o detalhe discordariam sem ninguém saber por quê.
  const pagoMes = useMemo(
    () => pagsDoMes.filter((p) => !TIPOS_ENCARGO.includes(p.tipo)).reduce((s, p) => s + p.valor, 0),
    [pagsDoMes],
  );
  const fgtsLancadoMes = useMemo(() => pagsDoMes.filter((p) => p.tipo === "FGTS").reduce((s, p) => s + p.valor, 0), [pagsDoMes]);
  const provisoesMes = useMemo(() => calcularEncargos(pagsDoMes, fgtsLancadoMes), [pagsDoMes, fgtsLancadoMes]);
  // O total da equipe no mês + a reserva mensal (lib/provisaoEquipe, com testes).
  // A régua é a MESMA do resumo do mês logo abaixo: se divergissem, o topo da
  // aba individual e a aba global diriam números diferentes do mesmo mês.
  const totalEquipe = useMemo(() => resumoDaEquipe(pagamentosDaEquipe, compAtiva), [pagamentosDaEquipe, compAtiva]);
  const pesoDoColab = useMemo(
    () => (colabId ? pesoDaPessoa(pagamentosDaEquipe, compAtiva, colabId) : null),
    [pagamentosDaEquipe, compAtiva, colabId],
  );
  const variacao = useMemo(() => variacaoMensal(pagamentosDaEquipe, compAtiva, TIPOS_ENCARGO), [pagamentosDaEquipe, compAtiva]);
  // Comparar com um mês que ainda está pela metade (adiantamento sem salário)
  // dá variação falsa: o aviso vai junto do número, nos dois lados.
  const anteriorIncompleto = useMemo(
    () => (variacao.compAnterior ? conferirCompetencia(variacao.compAnterior, pagamentos as Pagamento[], d.colaboradores).estado !== "completa" : false),
    [variacao.compAnterior, pagamentos, d.colaboradores],
  );
  // Estes dois falam da IMPORTAÇÃO, não do custo: contam o mês inteiro, sócio
  // incluído. Se contassem só a equipe, o chip diria "132 gravados" ao lado de
  // uma busca que vinculou 136 e acusaria 4 faltando que estão lá.
  const pagsDoMesTodos = useMemo(() => (pagamentos as Pagamento[]).filter((p) => p.competencia === compAtiva), [pagamentos, compAtiva]);
  const manuaisNoMes = useMemo(() => pagsDoMesTodos.filter((p) => ehManual(p)).length, [pagsDoMesTodos]);
  const contasNoPlano = useMemo(() => planoContas.filter((p: ContaPlano) => p.competencia === compAtiva).length, [planoContas, compAtiva]);
  const sinais = useMemo(
    () => sinaisDaCompetencia({
      comp: compAtiva,
      gravados: pagsDoMesTodos.length,
      manuais: manuaisNoMes,
      contasNoPlano,
      conferencia,
      ultimaBusca: config.ultimaBuscaMubi ?? null,
      ultimaConciliacao: config.ultimaConciliacaoMubi ?? null,
    }),
    [compAtiva, pagsDoMesTodos.length, manuaisNoMes, contasNoPlano, conferencia, config.ultimaBuscaMubi, config.ultimaConciliacaoMubi],
  );
  // O que cada mês tem, para os pontos sob os chips.
  const infoDoMes = useMemo(() => {
    const comFolha = new Set((pagamentos as Pagamento[]).map((p) => p.competencia));
    const plano = new Map<string, "contador" | "erp">();
    for (const p of planoContas as ContaPlano[]) {
      // Basta UMA linha do contador para o mês ser dele.
      if (p.origem !== "erp") plano.set(p.competencia, "contador");
      else if (!plano.has(p.competencia)) plano.set(p.competencia, "erp");
    }
    return (c: string) => ({ folha: comFolha.has(c), plano: plano.get(c) ?? null });
  }, [pagamentos, planoContas]);
  // O pior sinal do mês vira o chip ao lado do seletor de competência.
  const sinalResumo = useMemo(() => {
    const peso: Record<Tom, number> = { ruim: 0, atencao: 1, ok: 2, neutro: 3 };
    return [...sinais].sort((a, b) => peso[a.tom] - peso[b.tom])[0] ?? null;
  }, [sinais]);
  const atualizacaoRef = useRef<HTMLDivElement>(null);
  // Recolhimento do "Resumo do mês" guardado aqui (e não dentro do Card) porque
  // o atalho das pendências precisa poder abri-lo de fora.
  const [resumoAberto, setResumoAberto] = useAbertoPersistido("custos:resumo-mes");
  const irParaSinal = (id: Sinal["id"]) => {
    // Troca de aba primeiro e rola depois do render — rolar antes leva a um
    // alvo que ainda não existe na tela.
    if (id === "pendencias") {
      setAba("global");
      // O aviso de pendências mora DENTRO do "Resumo do mês", que recolhe e
      // guarda a escolha: sem abrir, o atalho rolava até uma seção vazia.
      setResumoAberto(true);
      window.setTimeout(() => document.getElementById("folha-geral")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return;
    }
    setAba("sync");
    window.setTimeout(() => atualizacaoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
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

  // ---------- Seção 2: custos coletivos (rateio) ----------
  const totais = useMemo(
    () => totaisDoMes(planoContas, mapaClasse, compAtiva, nColab),
    [planoContas, mapaClasse, compAtiva, nColab],
  );
  const totalColetivo = totais.individual + totais.rateio;
  const divisor = rateioPorPessoa && nColab > 0 ? nColab : 1;

  // ---------- Seção 3: evolução mês a mês ----------
  const serie = useMemo(
    () => serieCustos(planoContas, mapaClasse, (c) => quantosNoQuadro(d.colaboradores, c, pagamentos as Pagamento[])),
    [planoContas, mapaClasse, d.colaboradores, pagamentos],
  );

  // ---------- Editor de classificação ----------
  // Contas societárias confidenciais (2.14.*) NUNCA aparecem no editor de
  // classificação — independentemente de já estarem classificadas — para que
  // ninguém (nem gestor) consiga jogá-las no rateio público.
  const folhasEditor = useMemo(
    () =>
      folhasDoMes(planoContas, compAtiva)
        .filter((p: ContaPlano) => !contaEhConfidencial(p))
        .sort((a: ContaPlano, b: ContaPlano) => b.valor - a.valor),
    [planoContas, compAtiva],
  );

  const definirClasse = (conta: ContaPlano, classe: ClasseCusto) => {
    if (contaEhConfidencial(conta)) return; // não reclassificar confidenciais
    // As classes vivem na numeração do CONTADOR. Conta que chegou do ERP com
    // código renumerado grava pela referência (equivaleA) — gravar pelo código
    // novo mudava a classe de OUTRA conta nos meses do contador (07/09/2026).
    const chave = conta.equivaleA ?? conta.codigo;
    const existente = classificacaoCustos.find((c: ClassificacaoConta) => c.codigo === chave);
    if (existente) classifColecao.atualizar(existente.id, { classe, nome: conta.nome });
    else classifColecao.criar({ codigo: chave, nome: conta.nome, classe });
  };

  /* Abre o modal de lançamento em modo "novo", SEMPRE limpo. O dia e as horas
     do lançamento anterior reaparecendo no próximo passariam despercebidos,
     porque o valor "parece certo" — e sairia hora extra no dia errado. */
  const abrirNovoLanc = () => {
    setLancEditId(null);
    setLancTipo("Comissão");
    setLancValor("");
    setLancDesc("");
    limparHoraExtra();
    setAddLanc(true);
  };

  /** Zera os campos da hora extra e repõe o salário do cadastro. */
  function limparHoraExtra() {
    setHeDia("");
    setHeDuracao("");
    setHePercentual("50");
    setHeDivisor(String(DIVISOR_MENSAL_PADRAO));
    // Vem do cadastro; quem não tem aparece vazio para o RH digitar.
    setHeSalario(d.colabById.get(colabId)?.salario ? String(d.colabById.get(colabId)!.salario) : "");
    setValorTocado(false);
  }

  // Abre o modal de lançamento em modo "edição" de um pagamento existente.
  const abrirEdicaoLanc = (p: Pagamento) => {
    setLancEditId(p.id);
    setLancTipo(p.tipo);
    setLancValor(String(p.valor));
    setLancDesc(p.descricao === "Lançamento manual" ? "" : (p.descricao ?? ""));
    limparHoraExtra();
    /* Na edição o valor já é o gravado: marcar como "tocado" impede que o
       recálculo o substitua e apague um bônus lançado semanas atrás. */
    setValorTocado(true);
    setAddLanc(true);
  };

  /* ---------- Hora extra: a conta ---------- */
  const ehLancHE = lancTipo === "Horas Extras";
  const colabDoLanc = d.colabById.get(colabId);
  // `null` = não entendi o que foi digitado (ver minutosDaDuracao). Diferente de
  // vazio, que é só "ainda não preencheu".
  const heMinutos = ehLancHE ? minutosDaDuracao(heDuracao) : null;
  // "2.500.38" (milhar + centavo no teclado numérico) virava 250038 e o
  // lançamento saía cem vezes maior. A mesma trava da folha variável.
  const heSalarioAmbiguo = !!heSalario.trim() && dinheiroAmbiguo(heSalario);
  const heSalarioNum = heSalarioAmbiguo ? 0 : valorDigitado(heSalario);
  // "+50%" quer dizer hora × 1,5. Percentual vazio ou impossível cai no padrão
  // em vez de zerar o valor calado.
  const hePctNum = valorDigitado(hePercentual);
  const heFator = Number.isFinite(hePctNum) && hePctNum >= 0 ? 1 + hePctNum / 100 : FATOR_HE_PADRAO;
  const heDivisorNum = valorDigitado(heDivisor) || DIVISOR_MENSAL_PADRAO;
  const heCalc = useMemo(
    () => calcularHoraExtra({ salario: heSalarioNum, minutos: heMinutos ?? 0, fator: heFator, divisor: heDivisorNum }),
    [heSalarioNum, heMinutos, heFator, heDivisorNum],
  );
  const heValido = ehLancHE && heMinutos != null && heMinutos > 0 && !heCalc.semSalario;

  /* Preenche o campo de valor com o que a conta deu — mas só enquanto o RH não
     tiver escrito nele. Sobrescrever o que a pessoa acabou de digitar seria
     exatamente o defeito que o pedido pediu para evitar ("tem horas que tem
     bônus"): ela põe 80,00, mexe no adicional para conferir, e os 80 somem. */
  useEffect(() => {
    if (!heValido || valorTocado) return;
    setLancValor(heCalc.valor.toFixed(2));
  }, [heValido, valorTocado, heCalc.valor]);

  // Quanto o valor no campo se afasta do calculado — o bônus, em número.
  const heDiferenca = heValido ? diferencaDoCalculo(valorDigitado(lancValor), heCalc.valor) : 0;

  // Lança/edita um pagamento manual para o colaborador no mês (preenche o que faltou na folha).
  const salvarLancamento = () => {
    if (dinheiroAmbiguo(lancValor)) return toast("Valor ambíguo. Escreva assim: 2.500,38", "erro");
    if (ehLancHE && heSalarioAmbiguo) return toast("Salário base ambíguo. Escreva assim: 2.500,38", "erro");
    const valor = valorDigitado(lancValor);
    if (!lancTipo) return toast("Escolha o tipo de pagamento.", "erro");
    /* Duração escrita de um jeito que não dá para entender NÃO pode virar
       lançamento: sem esta trava ela valeria zero minuto, e o pagamento sairia
       com o valor que estivesse no campo — ou R$ 0,00 — sem ninguém notar. */
    if (ehLancHE && heDuracao.trim() && heMinutos == null) {
      return toast('Não entendi as horas. Escreva como na planilha: "02:50".', "erro");
    }
    if (!valor || valor <= 0) return toast("Informe um valor maior que zero.", "erro");

    /* A descrição guarda a CONTA, não só o resultado. Daqui a seis meses, "R$
       80,00 de hora extra" não se explica sozinho; "3h00 em 12/08 · +50% ·
       base R$ 2.800,00 · calculado R$ 57,27 · +R$ 22,73" se explica. É também
       o que separa bônus combinado de erro de digitação. */
    let descricao = lancDesc.trim();
    if (ehLancHE && heValido) {
      const partes = [
        `${minParaHora(heMinutos ?? 0)} de hora extra`,
        heDia ? `em ${formatDate(heDia)}` : null,
        `+${hePctNum.toLocaleString("pt-BR")}%`,
        // O divisor entra na descrição só quando não é o da casa: registrar
        // "220h" em todo lançamento vira ruído; registrar quando é OUTRO é o
        // que explica um valor diferente meses depois.
        heDivisorNum !== DIVISOR_MENSAL_PADRAO ? `jornada ${heDivisorNum}h` : null,
        `base ${formatBRL(heSalarioNum)}`,
        `calculado ${formatBRL(heCalc.valor)}`,
        heDiferenca !== 0 ? `${heDiferenca > 0 ? "+" : "−"}${formatBRL(Math.abs(heDiferenca))} à mão` : null,
      ].filter(Boolean);
      descricao = [descricao, partes.join(" · ")].filter(Boolean).join(" — ");
    }
    if (lancEditId) {
      pagamentosColecao.atualizar(lancEditId, {
        tipo: lancTipo,
        valor: Math.round(valor * 100) / 100,
        descricao: descricao || "Lançamento manual",
      });
      toast("Lançamento atualizado.");
    } else {
      pagamentosColecao.criar({
        colaboradorId: colabId,
        competencia: compAtiva,
        tipo: lancTipo,
        valor: Math.round(valor * 100) / 100,
        // Hora extra tem dia próprio; os demais caem no dia 15 como antes.
        // Dia que PERTENCE à competência escolhida pela régua 16→15 (dia 20):
        // dia 15 caía no mês anterior e a auditoria oferecia "corrigir" a
        // comissão de agosto para julho.
        dataPagamento: ehLancHE && heDia ? heDia : `${compAtiva}-20`,
        descricao: descricao || "Lançamento manual",
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

      {/* ---------- Competência: vale para as três abas ----------
          O seletor saiu de dentro da aba de colaboradores (06/09/2026): a mesma
          competência serve o individual, o global e a sincronização, e um
          seletor por aba obrigava a trocar o mês três vezes. Ao lado, o pior
          sinal do mês responde "está atualizado?" sem sair da aba — os quatro
          chips completos moram em Sincronização. */}
      {/* Ano + chips de mês. A faixa não aparece em Viagens, que não usa
          competência — uma faixa sobre uma aba que a ignora confunde. */}
      {aba !== "viagens" && (
        <div className="mb-4 space-y-2">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-3">
            <div className="min-w-0 flex-1">
              <FaixaMeses competencias={competencias} ativa={compAtiva} onEscolher={setComp} info={infoDoMes} hoje={hojeIso} />
            </div>
            {compAtiva && sinalResumo && (
              <button
                type="button"
                onClick={() => irParaSinal(sinalResumo.id)}
                title={sinalResumo.detalhe}
                className={"inline-flex h-10 shrink-0 items-center gap-1.5 self-start rounded-xl border px-3 text-xs font-medium transition lg:self-auto " + TOM_CLASSES[sinalResumo.tom]}
              >
                {sinalResumo.tom === "ok" ? <ShieldCheck className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                <span>{sinalResumo.rotulo}: {sinalResumo.valor}</span>
              </button>
            )}
          </div>
          <LegendaMeses />
        </div>
      )}

      <Tabs
        ativa={aba}
        aoMudar={setAba}
        abas={[
          {
            id: "custos",
            label: "Custos de Colaboradores",
            icon: <Coins className="h-4 w-4" />,
            conteudo: semPlano ? (
              <EmptyState
                title="Nenhuma competência com dados"
                description="Traga a folha do Mubisys ou o plano de contas do contador na aba Sincronização."
                icon={<Wallet className="h-10 w-10" />}
                acao={<button type="button" className="btn-outline" onClick={() => setAba("sync")}><RefreshCw className="h-4 w-4" /> Ir para Sincronização</button>}
              />
            ) : (
              <div className="space-y-8">
          {/* ===================== custo individual por colaborador =====================
              A aba é só do colaborador (pedido de 06/09/2026): a ficha do mês e
              o histórico dele. O que é de todos — folha geral, rateio, evolução
              — mudou para a aba Custo Global. */}
          <section>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <UserCircle2 className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Custo individual por colaborador</h2>
              <div className="ml-auto">
                <SegToggle
                  opcoes={[{ v: false, label: `Quadro de ${compLabel(compAtiva)} (${ativosOrdenados.length})` }, { v: true, label: `Com quem saiu (${ativosOrdenados.length + foraDoQuadroComLanc.length})` }]}
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

            <Card idPersistencia="custos:individual">
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
                      <optgroup label={`Quadro de ${compLabel(compAtiva)}`}>
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
                      { v: true, label: "Custo estimado (c/ provisões)" },
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
                        {/* Era "Custo real". O nome era mais forte que a conta: a
                            fórmula soma FGTS, 13º e férias ESTIMADOS sobre salário +
                            adiantamento, e só isso — hora extra, comissão e diária
                            ficam fora da provisão por decisão de 07/2026. Não é o
                            custo patronal completo, e o rótulo agora diz o que é. */}
                        <StatCard
                          label="Custo estimado c/ provisões"
                          value={formatBRL(custoReal)}
                          accent="brand"
                          icon={<Wallet className="h-4 w-4" />}
                          hint="Pago + FGTS 8%, 13º e férias sobre salário + adiantamento"
                          title="Estimativa: soma ao pago as provisões de FGTS, 13º e férias calculadas sobre salário + adiantamento. Hora extra, comissão, diária e demais verbas entram no pago, não na provisão. Não é o custo patronal completo."
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
                            {/* Régua de % também aqui (pedido do Léo, 07/09/2026):
                                a parte de cada lançamento no mês da pessoa. */}
                            <td className="w-44 px-3 py-2">
                              <span className="flex items-center gap-2">
                                <span className="h-1.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
                                  <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, totalLancColab > 0 ? ((Number(p.valor) || 0) / totalLancColab) * 100 : 0))}%`, backgroundColor: corDoTipo(p.tipo) }} />
                                </span>
                                <span className="w-11 text-right text-xs tabular-nums text-slate-500">{totalLancColab > 0 ? `${(((Number(p.valor) || 0) / totalLancColab) * 100).toFixed(1).replace(".", ",")}%` : "—"}</span>
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
          {/* O total da equipe fica ABAIXO da ficha individual (pedido do
              Leonardo, 07/09/2026): primeiro a pessoa aberta, depois quanto ela
              pesa no mês inteiro e quanto separar para a conta dos acertos. */}
          <TotalEquipe
            resumo={totalEquipe}
            pessoaNome={colabSel?.nome}
            pessoaPeso={pesoDoColab}
            comEncargos={comEncargos}
            onAbrirMes={abrirDrillDoMes}
          />

          {/* ===================== histórico do colaborador — mês a mês ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Histórico de {colabSel?.nome ?? "colaborador"} mês a mês</h2>
            </div>
            <Card idPersistencia="custos:historico-colab">
              <CardHeader
                title="Quanto recebeu por mês"
                subtitle="Total efetivamente pago em cada competência, a variação contra o mês anterior e o acumulado. Clique num mês para abri-lo."
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <CardBody>
                <HistoricoMensal
                  pontos={historicoColab}
                  selecionada={compAtiva}
                  onSelecionar={setComp}
                  rotuloValor="Recebido"
                  vazio={<EmptyState title="Sem pagamentos para este colaborador" icon={<Coins className="h-8 w-8" />} />}
                />
              </CardBody>
            </Card>
          </section>
              </div>
            ),
          },
          {
            id: "global",
            label: "Custo Global",
            icon: <Layers className="h-4 w-4" />,
            conteudo: semPlano ? (
              <EmptyState
                title="Nenhuma competência com dados"
                description="Traga a folha do Mubisys ou o plano de contas do contador na aba Sincronização."
                icon={<Layers className="h-10 w-10" />}
                acao={<button type="button" className="btn-outline" onClick={() => setAba("sync")}><RefreshCw className="h-4 w-4" /> Ir para Sincronização</button>}
              />
            ) : (
              <div className="space-y-8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">Toda a equipe em {compLabelLongo(compAtiva)}: o que foi pago, o rateio dos custos coletivos e a leitura contábil.</p>
                  <button type="button" className="btn-outline" onClick={() => setEditorAberto(true)}>
                    <Settings2 className="h-4 w-4" /> Classificar contas
                  </button>
                </div>
                {/* ---------- Placar executivo do mês ----------
                    Pago, provisões, o estimado e a variação — com QUEM explica a
                    variação. "+33,5%" sozinho assusta; "diárias e horas extras
                    explicam 91%" é uma decisão. */}
                {pagsDoMes.length > 0 && (() => {
                  const dlt = variacao.delta;
                  const sobe = dlt > 0;
                  const pct = variacao.pct != null ? `${sobe ? "+" : ""}${(variacao.pct * 100).toFixed(1).replace(".", ",")}%` : null;
                  const motores = variacao.motores
                    .filter((m) => Math.sign(m.delta) === Math.sign(dlt))
                    .slice(0, variacao.quantosMaiores)
                    .map((m) => `${m.tipo} ${m.delta > 0 ? "+" : "−"}${formatBRL(Math.abs(m.delta))}`)
                    .join(", ");
                  const parcela = variacao.parcelaDosMaiores != null ? ` explicam ${Math.round(variacao.parcelaDosMaiores * 100)}%` : "";
                  const cautela = conferencia.estado !== "completa" || anteriorIncompleto ? " · mês incompleto, ler com cautela" : "";
                  const hintVar = !variacao.temAnterior
                    ? "Sem mês anterior com folha para comparar"
                    : dlt === 0
                      ? "Igual ao mês anterior"
                      : `${pct ? pct + " · " : ""}${motores}${parcela}${cautela}`;
                  const todosMotores = variacao.motores.map((m) => `${m.tipo}: ${m.delta > 0 ? "+" : "−"}${formatBRL(Math.abs(m.delta))}`).join("\n");
                  return (
                    <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <StatCard
                        label="Custo pago no mês"
                        value={formatBRL(pagoMes)}
                        accent="brand"
                        icon={<Wallet className="h-4 w-4" />}
                        hint={fgtsLancadoMes ? "Pago às pessoas — sem o FGTS lançado" : "Pago às pessoas"}
                      />
                      <StatCard
                        label="Provisões estimadas"
                        value={formatBRL(provisoesMes.total)}
                        accent="blue"
                        icon={<ShieldCheck className="h-4 w-4" />}
                        hint={`FGTS 8% + 13º + férias sobre ${formatBRL(provisoesMes.bruto)} (salário + adiantamento)`}
                        title="Estimativa. Hora extra, comissão, diária e demais verbas não entram nesta base — decisão de 07/2026."
                      />
                      <StatCard
                        label="Custo estimado c/ provisões"
                        value={formatBRL(pagoMes + provisoesMes.total)}
                        accent="gold"
                        icon={<Coins className="h-4 w-4" />}
                        hint="Pago + provisões. Não é o custo patronal completo."
                      />
                      <StatCard
                        label={variacao.compAnterior ? `Contra ${compLabel(variacao.compAnterior)}` : "Contra o mês anterior"}
                        value={variacao.temAnterior ? `${sobe ? "+" : dlt < 0 ? "−" : ""}${formatBRL(Math.abs(dlt))}` : "—"}
                        accent={sobe ? "gold" : "green"}
                        icon={sobe ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                        hint={hintVar}
                        title={todosMotores ? `Variação por tipo:\n${todosMotores}` : undefined}
                      />
                    </div>
                  );
                })()}

          {/* ===================== SEÇÃO 1 — folha geral do mês (todos) ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-brand" />
              <h2 id="folha-geral" className="scroll-mt-20 text-base font-semibold text-brand-ink">Folha geral do mês</h2>
            </div>

            {/* O que sai para sócio aparece, mas separado: é despesa
                societária, não folha. Sem esta linha o dinheiro sumiria da vista
                ao ser tirado dos totais da equipe. */}
            {pagsSocietariosDoMes.length > 0 && (
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-xl border border-slate-300 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Direção · despesa societária</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {pagsSocietariosDoMes.length} lançamento(s) de sócio em {compLabelLongo(compAtiva)}. Fora da folha, fora da base de FGTS/13º/férias e fora do custo por colaborador.{ehMaster(sessao) ? " O detalhe está na aba Societárias." : ""}
                  </p>
                </div>
                <p className="text-xl font-semibold tabular-nums text-slate-700">{formatBRL(totalSocietarioMes)}</p>
              </div>
            )}

            <Card aberto={resumoAberto} onAlternar={() => setResumoAberto((v: boolean) => !v)}>
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
                    <span className="px-1 text-sm font-medium tabular-nums text-slate-700">{compLabelLongo(compAtiva)}</span>
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
                      A folha por pessoa está aqui normalmente; o rateio, os encargos e o Custo Global ficam indisponíveis — não zerados — até o plano deste mês chegar do Mubisys, o que acontece sozinho ao abrir o mês.
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
                  <div className="space-y-5">
                    {/* Cards em cima e as despesas em linha embaixo (pedido do
                        Léo, 07/09/2026): os quatro números primeiro, a lista
                        por tipo na largura toda — cabe mais e lê melhor. */}
                    {/* Destaques do mês */}
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                    {/* Tabela por tipo (mês inteiro) */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200/70">
                      <table className="w-full">
                        <thead className="border-b border-slate-100 bg-slate-50/50">
                          <tr>
                            <th className="th">Tipo de pagamento</th>
                            <th className="th">Parte do mês</th>
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
                              {/* A régua de % (pedido do Léo, 07/09/2026): a composição
                                  do mês num relance — o que está pesando salta aos olhos. */}
                              <td className="td w-56">
                                <span className="flex items-center gap-2">
                                  <span className="h-1.5 flex-1 rounded-full bg-slate-100" aria-hidden="true">
                                    <span className="block h-1.5 rounded-full" style={{ width: `${Math.max(0, Math.min(100, totalMes > 0 ? (l.valor / totalMes) * 100 : 0))}%`, backgroundColor: corDoTipo(l.tipo) }} />
                                  </span>
                                  <span className="w-11 text-right text-xs tabular-nums text-slate-500">{totalMes > 0 ? `${((l.valor / totalMes) * 100).toFixed(1).replace(".", ",")}%` : "—"}</span>
                                </span>
                              </td>
                              <td className="td text-right font-medium text-slate-800">{formatBRL(l.valor)}</td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50/60">
                            <td className="td font-semibold text-brand-ink">Total pago no mês</td>
                            <td className="td text-right text-xs text-slate-500">100%</td>
                            <td className="td text-right font-semibold text-brand-ink">{formatBRL(totalMes)}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                  </div>
                )}

                {/* No quadro do mês e SEM lançamento nenhum. O aviso acima só
                    pega quem tem adiantamento sem salário; quem não tem nada
                    passava batido — junho/2026 tinha 8 pessoas assim. */}
                {faltantes.some((f) => f.semLancamento) && (
                  <div className="mt-4 rounded-xl border border-red-200 bg-red-50/60 p-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-red-900">
                          {faltantes.filter((f) => f.semLancamento).length} pessoa(s) do quadro de {compLabelLongo(compAtiva)} sem nenhum lançamento
                        </p>
                        <p className="mt-0.5 text-xs text-red-800">
                          Estavam na casa neste mês pelo cadastro (admissão e desligamento) e não têm um único pagamento gravado. Ou o título está no ERP com outro nome e ficou em “não encontrados”, ou a pessoa não foi paga por aqui, ou a data do cadastro está errada.
                        </p>
                        <p className="mt-1.5 flex flex-wrap gap-1">
                          {faltantes.filter((f) => f.semLancamento).map((f) => (
                            <button
                              key={f.colaborador.id}
                              type="button"
                              onClick={() => drill.abrir("Sem lançamento nesta competência", [f.colaborador], compLabelLongo(compAtiva))}
                              className="rounded-full border border-red-300 bg-white/70 px-2 py-0.5 text-[11px] text-red-900 hover:brightness-95"
                              title={f.semDataAdmissao ? "Sem data de admissão no cadastro — a presença é presumida" : "Ver a ficha"}
                            >
                              {f.colaborador.nome}{f.semDataAdmissao ? " · sem data de admissão" : ""}
                            </button>
                          ))}
                        </p>
                        {recebeuForaDoQuadro.length > 0 && (
                          <p className="mt-2 text-[11px] text-red-800/80">
                            Recebeu neste mês sem estar no quadro dele (acerto de quem saiu, ou cadastro sem a data certa): {recebeuForaDoQuadro.map((c) => c.nome).join(", ")}.
                          </p>
                        )}
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
              /* Zero aqui tem duas causas e só uma se resolve classificando
                 contas. Sem o plano do contador, mandar a pessoa "classificar"
                 é mandar procurar o que não existe — e o zero parecia resultado. */
              semPlanoNaComp ? (
                /* Sem cartão vazio com botão (pedido do Léo, 07/09/2026): o
                   plano vem sozinho do Mubisys ao abrir o mês. Se não veio, a
                   linha diz, e o chip lá em cima leva a Sincronização. */
                <p className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  <RefreshCw className={"h-4 w-4 shrink-0 text-slate-400" + (buscandoPlano ? " animate-spin" : "")} />
                  <span>
                    {buscandoPlano
                      ? `${buscandoPlano} O rateio aparece assim que ele chegar.`
                      : `Sem plano de contas em ${compLabelLongo(compAtiva)} ainda. Ele é trazido do Mubisys sozinho ao abrir o mês; se não veio, tente em Sincronização.`}
                  </span>
                </p>
              ) : (
                <EmptyState
                  title="Sem custos classificados nesta competência"
                  description="Use “Classificar contas” para marcar contas como individual ou rateio."
                  icon={<Layers className="h-8 w-8" />}
                />
              )
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

          {/* ===================== evolução mês a mês ===================== */}
          <section>
            <div className="mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-brand" />
              <h2 className="text-base font-semibold text-brand-ink">Evolução mês a mês</h2>
            </div>
            <Card idPersistencia="custos:evolucao">
              <CardHeader
                title="Custo da folha por mês"
                subtitle="Individual + rateio do plano de contas em cada competência, com o custo médio por colaborador ativo. Clique num mês para abri-lo."
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <CardBody>
                <HistoricoMensal
                  pontos={serie.map((x) => ({ competencia: x.competencia, valor: x.individual + x.rateio }))}
                  selecionada={compAtiva}
                  onSelecionar={setComp}
                  rotuloValor="Custo do mês"
                  rotuloTotal="Custo do período"
                  altura={280}
                  colunas={[
                    { rotulo: "Individual", valorDe: (c) => serie.find((x) => x.competencia === c)?.individual ?? null },
                    { rotulo: "Rateio", valorDe: (c) => serie.find((x) => x.competencia === c)?.rateio ?? null },
                    { rotulo: "Médio / colab.", valorDe: (c) => serie.find((x) => x.competencia === c)?.medioIndividual ?? null, destaque: true },
                  ]}
                  vazio={<EmptyState title="Sem histórico" description="Importe mais competências do plano de contas para ver a evolução." />}
                />
              </CardBody>
            </Card>
          </section>
                <CustoGlobalFuncionarios comp={compAtiva} competencias={competencias} onComp={setComp} irParaSync={() => irParaSinal("plano")} />
              </div>
            ),
          },
          ...(ehMaster(sessao) ? [{
            id: "societarias",
            label: "Societárias",
            icon: <Landmark className="h-4 w-4" />,
            conteudo: (
              <Societarias
                socios={d.colaboradores.filter((c: Colaborador) => ehSocio(c))}
                pagamentos={pagamentos as Pagamento[]}
                plano={planoContas as ContaPlano[]}
                compAtiva={compAtiva}
                onEscolherMes={setComp}
              />
            ),
          }] : []),
          {
            id: "sync",
            label: "Sincronização",
            icon: <RefreshCw className="h-4 w-4" />,
            conteudo: (
              <div className="space-y-6">
                <p className="text-sm text-slate-500">
                  Plano de contas do contador e folha do Mubisys — de onde vêm os números desta tela — e a conferência da classificação.
                </p>
                {/* ---------- Está atualizado? ----------
                    Quatro chips com tom e uma linha de porquê. Clicar leva ao
                    lugar onde se resolve (rola até o quadro de carga, ou vai à
                    folha geral no Custo Global). O texto completo fica no title. */}
                {compAtiva && (
                  <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Estado da competência">
                    {sinais.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => irParaSinal(s.id)}
                        title={s.detalhe}
                        className={"rounded-xl border px-3 py-2 text-left transition " + TOM_CLASSES[s.tom]}
                      >
                        <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{s.rotulo}</p>
                        <p className="mt-0.5 text-sm font-semibold tabular-nums">{s.valor}</p>
                        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-80">{s.detalhe}</p>
                      </button>
                    ))}
                  </div>
                )}

      {/* ---------- Atualização de dados ----------
          Os dois quadros de carga (plano do contador + folha do ERP) moram na
          aba Sincronização (pedido de 06/09/2026): as outras abas ficam só com
          o que é do colaborador e só com o que é global. */}
      <div ref={atualizacaoRef} className="mb-6 scroll-mt-20">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Plano de Contas (custos coletivos)"
            subtitle="Somado do Contas a Pagar do Mubisys, conta a conta, no mês civil do vencimento. Só o que não é pagamento a pessoa: o individual já entra pela folha."
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
            {/* A planilha do contador saiu de cena (pedido do Léo, 07/09/2026):
                o plano vem só do Contas a Pagar. O que já foi importado por
                planilha continua valendo como está — nesses meses o ERP só
                confere. */}
            <button
              className="btn-primary sm:mb-0"
              onClick={puxarPlanoDoErp}
              disabled={!!buscandoPlano}
              title="Monta o plano de contas somando os títulos do Contas a Pagar que vencem no mês — mostra a comparação antes de gravar"
            >
              <RefreshCw className={"h-4 w-4" + (buscandoPlano ? " animate-spin" : "")} />
              {buscandoPlano || "Puxar do Mubisys"}
            </button>
            {/* O ano inteiro de uma vez (pedido do Léo, 07/09/2026): mês a mês,
                pelo mesmo caminho seguro, sem prévia. Mês do contador é pulado. */}
            <Campo label="Ano" className="sm:w-28">
              <Select value={anoPlano} onChange={(e) => setAnoPlano(e.target.value)}>
                {[...new Set([hojeIso.slice(0, 4), ...competencias.map((c) => c.slice(0, 4))])].sort().reverse().map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </Select>
            </Campo>
            <button
              className="btn-outline sm:mb-0"
              onClick={() => void puxarAnoDoErp(anoPlano)}
              disabled={!!buscandoPlano || !!puxandoAno}
              title="Traz e grava o plano coletivo de cada mês do ano, até o mês atual, direto do Contas a Pagar. Mês fechado pelo contador não é tocado."
            >
              <History className="h-4 w-4" /> Puxar o ano
            </button>
          </CardBody>
          {puxandoAno && (
            <CardBody className="pt-0">
              <div className="rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-brand-ink">
                    Puxando o plano: {puxandoAno.feitos} de {puxandoAno.total} mês(es)
                    {puxandoAno.onde ? ` · ${puxandoAno.onde}` : ""}
                  </p>
                  <button className="btn-ghost h-7 px-2 py-0 text-xs text-red-600" onClick={() => { pararAnoRef.current = true; }}>
                    Parar
                  </button>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-brand transition-all"
                    style={{ width: `${puxandoAno.total ? (puxandoAno.feitos / puxandoAno.total) * 100 : 0}%` }} />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  Cada mês leva de 30s a 1 minuto. O que já foi gravado permanece se você parar.
                </p>
              </div>
            </CardBody>
          )}
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
      </div>

                {/* A conferência que faltou em jul/2026: cada lançamento do ERP
                    contra o nome da conta do contador. Corrige em lote pelo
                    caminho normal (atualizar + sync), com rastro no histórico. */}
                {/* A volta: o retrato da última aplicação da folha. */}
                {ultimoRetrato && planoDesfazer && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Última aplicação da folha</p>
                      <p className="mt-0.5 text-sm text-slate-700">
                        {ultimoRetrato.rotulo ?? "Folha do ERP"} · {new Date(ultimoRetrato.em).toLocaleString("pt-BR")} · {ultimoRetrato.tocados.length} registro(s) tocado(s)
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {planoDesfazer.restaurar.length + planoDesfazer.apagar.length > 0
                          ? `Dá para voltar ${planoDesfazer.restaurar.length + planoDesfazer.apagar.length} deles${planoDesfazer.pulados.length ? `; ${planoDesfazer.pulados.length} foram editados depois e ficam` : ""}.`
                          : "Tudo o que ela tocou já foi editado ou desfeito — nada a voltar."}
                      </p>
                    </div>
                    <button type="button" className="btn-outline" onClick={() => setConfirmarDesfazer(true)} disabled={planoDesfazer.restaurar.length + planoDesfazer.apagar.length === 0}>
                      <History className="h-4 w-4" /> Desfazer
                    </button>
                  </div>
                )}
                {/* A varredura de 07/09/2026 virou tela: roda sozinha, toda vez. */}
                <AuditoriaLancamentos
                  pagamentos={pagamentos as Pagamento[]}
                  colaboradores={d.colaboradores}
                  onVerPessoa={(id) => { setColabId(id); setMostrarInativos(true); setAba("custos"); }}
                  onDesligar={(propostas) => {
                    // Uma escrita por pessoa, com linha própria no histórico:
                    // status e data de saída são o que decide de quais meses
                    // ela faz parte — não é coisa de passar num lote mudo.
                    for (const p of propostas) {
                      colaboradoresColecao.atualizar(p.colaboradorId, { statusId: "inativo", dataDesligamento: p.para.dataDesligamento });
                      registrarAcaoManual(`Desligou pelo último pagamento (${compLabel(p.ultimoMes)})`, p.nome, "colaboradores");
                    }
                    void enviarColecao("colaboradores");
                    toast(`${propostas.length} pessoa(s) marcada(s) como inativa(s) com a data do último mês em que receberam.`, "sucesso");
                  }}
                  onCorrigir={(achados) => {
                    const tipos = achados.filter((a) => a.conserto?.campo === "tipo");
                    const comps = achados.filter((a) => a.conserto?.campo === "competencia");
                    emLote(`Auditoria: corrigiu ${tipos.length} tipo(s) e ${comps.length} competência(s)`, () => {
                      for (const a of achados) {
                        const alvo = a.pagamentoIds[0];
                        if (!alvo || !a.conserto) continue;
                        pagamentosColecao.atualizar(alvo, a.conserto.campo === "tipo" ? { tipo: a.conserto.para } : { competencia: a.conserto.para });
                      }
                    });
                    toast(`${achados.length} lançamento(s) corrigido(s) pela auditoria.`, "sucesso");
                  }}
                />

                <ConferenciaTipos
                  pagamentos={pagamentos as Pagamento[]}
                  colaboradorPor={(id) => d.colaboradores.find((c: Colaborador) => c.id === id)}
                  nomeDe={(id) => d.colaboradores.find((c: Colaborador) => c.id === id)?.nome ?? id}
                  onCorrigir={(divs) => {
                    emLote(`Reclassificou ${divs.length} lançamento(s) pelo nome da conta do ERP`, () => {
                      for (const x of divs) pagamentosColecao.atualizar(x.id, { tipo: x.para });
                    });
                    toast(`${divs.length} lançamento(s) reclassificado(s).`);
                  }}
                />
              </div>
            ),
          },
          {
            id: "viagens",
            label: "Viagens e Diárias",
            icon: <Plane className="h-4 w-4" />,
            conteudo: <ViagensPainel />,
          },
        ]}
      />

      {planoPrev && (() => {
        const cp = planoPrev.comparacao;
        const jaTinha = cp.iguais + cp.mudaram + cp.somem > 0;
        const fmtDif = (v: number) => `${v > 0 ? "+" : "−"}${formatBRL(Math.abs(v))}`;
        return (
          <Modal
            aberto
            onFechar={() => setPlanoPrev(null)}
            titulo={`Plano de contas de ${compLabelLongo(planoPrev.competencia)} pelo Mubisys`}
            descricao={planoPrev.somenteConferencia
              ? "Este mês já tem a planilha fechada do contador. O ERP só confere: nada é gravado por aqui."
              : "Soma dos títulos do Contas a Pagar que vencem no mês, por conta — só o coletivo e o encargo. Gravar MESCLA: entra o que veio, nada é apagado."}
            largura="max-w-3xl"
            rodape={<>
              <button className="btn-outline" onClick={() => setPlanoPrev(null)}>{planoPrev.somenteConferencia ? "Fechar" : "Cancelar"}</button>
              {!planoPrev.somenteConferencia && (
                <button className="btn-primary" onClick={aplicarPlanoDoErp} disabled={planoPrev.contas.length === 0}>
                  <FileSpreadsheet className="h-4 w-4" /> Gravar {planoPrev.contas.length} conta(s)
                </button>
              )}
            </>}
          >
            <div className="space-y-3">
              {planoPrev.incompleta && (
                <div className="rounded-xl border border-red-300 bg-red-50 p-3">
                  <p className="text-xs font-semibold text-red-800">A consulta não chegou ao fim</p>
                  <p className="mt-1 text-[11px] text-red-700/90">Parte dos títulos do mês ficou de fora, então os valores abaixo estão incompletos. Tente de novo antes de gravar.</p>
                </div>
              )}
              {planoPrev.somenteConferencia && (
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3">
                  <p className="text-xs font-semibold text-sky-900">Mês fechado pelo contador — só conferência</p>
                  <p className="mt-1 text-[11px] text-sky-800/90">
                    A planilha dele tem provisão (FGTS, férias) e reclassificação que o Contas a Pagar não tem; ela é a verdade contábil deste mês.
                    Use a tabela para ver onde os dois discordam.
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { n: cp.iguais, r: "iguais", cor: "text-slate-600", borda: "border-slate-200 bg-slate-50/60" },
                  { n: cp.mudaram, r: "mudam", cor: "text-blue-700", borda: "border-blue-200 bg-blue-50/60" },
                  { n: cp.novas, r: "novas", cor: "text-green-700", borda: "border-green-200 bg-green-50/60" },
                  { n: cp.somemComValor, r: "com R$ que o ERP não tem", cor: "text-amber-700", borda: "border-amber-200 bg-amber-50/60" },
                ].map((x) => (
                  <div key={x.r} className={`rounded-xl border px-3 py-2 text-center ${x.borda}`}>
                    <p className={`text-xl font-bold tabular-nums ${x.cor}`}>{x.n}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">{x.r}</p>
                  </div>
                ))}
              </div>

              {/* O "somem" em três partes: só a terceira merece decisão. Antes
                  era um número só ("377 somem") e 218 delas valiam R$ 0,00. */}
              {cp.somem > 0 && (
                <p className="text-xs text-slate-600">
                  Existem hoje e o ERP não trouxe: <strong>{cp.somemComValor}</strong> com dinheiro ({formatBRL(cp.valorQueSome)}) ·{" "}
                  {cp.somemPais} conta(s)-pai (soma das filhas, o ERP nunca tem) · {cp.somemZeradas} zerada(s).
                  {planoPrev.somenteConferencia ? " Nada disso é apagado: este mês é do contador." : " Nada é apagado ao gravar."}
                </p>
              )}
              {cp.confidenciaisOcultas > 0 && (
                <p className="text-[11px] text-slate-500">{cp.confidenciaisOcultas} conta(s) societária(s) fora desta lista — só a direção vê.</p>
              )}

              <ListaFora
                titulo="conta(s) de pagamento a pessoa ficaram de fora"
                porque="Salário, comissão, hora extra, diária… já entram por pessoa pela folha. Trazer pelo plano seria o mesmo dinheiro em dois lugares."
                itens={planoPrev.pessoais}
                tom="border-slate-200 bg-slate-50 text-slate-700"
              />
              <ListaFora
                titulo="conta(s) societária(s) ficaram de fora"
                porque="2.14 nunca entra por este caminho. O servidor já corta; esta lista é a rede de segurança do lado de cá."
                itens={planoPrev.societarias}
                tom="border-slate-300 bg-slate-100 text-slate-700"
              />
              {planoPrev.societariasOmitidasNoServidor > 0 && (
                <p className="text-[11px] text-slate-500">O servidor deixou de fora {planoPrev.societariasOmitidasNoServidor} título(s) de contas societárias (sem valor, de propósito).</p>
              )}
              {/* O contador renumerou o plano em jul/2026: a tela diz quantas contas
                  foram reconhecidas pelo nome e classificadas pela numeração de
                  referência — e quais ficaram sem par (classe pelo código literal). */}
              {(planoPrev.renumeradas > 0 || planoPrev.semPar.length > 0) && (
                <p className="rounded-lg border border-sky-200 bg-sky-50/60 px-3 py-2 text-[11px] text-sky-900">
                  {planoPrev.renumeradas > 0 && <>{planoPrev.renumeradas} conta(s) com código diferente do plano do contador{planoPrev.referencia ? ` (${compLabel(planoPrev.referencia)})` : ""}, reconhecidas pelo nome e classificadas pela numeração dele. </>}
                  {planoPrev.semPar.length > 0 && <>{planoPrev.semPar.length} sem par no plano de referência — classificadas pelo código como está; confira em “Classificação”: {planoPrev.semPar.slice(0, 6).map((c) => `${c.codigo} ${c.nome}`).join(" · ")}{planoPrev.semPar.length > 6 ? " …" : ""}.</>}
                </p>
              )}
              <ListaFora
                titulo="conta(s) com código que não é do grupo 2"
                porque="Não é despesa (grupo 2) ou o texto da conta não começa com código. Ficam aqui para não sumir caladas."
                itens={planoPrev.naoReconhecidas}
                tom="border-amber-200 bg-amber-50 text-amber-900"
              />

              <p className="text-xs text-slate-500">
                {planoPrev.titulos} título(s) lidos do ERP · entra {formatBRL(cp.totalDepois)}
                {jaTinha && <> · hoje gravado {formatBRL(cp.totalAntes)} ({fmtDif(Math.round((cp.totalDepois - cp.totalAntes) * 100) / 100)})</>}
              </p>
              <div className="max-h-80 overflow-y-auto rounded-xl border border-slate-200/70">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 border-b border-slate-100 bg-slate-50">
                    <tr>
                      <th className="th">Conta</th>
                      <th className="th text-right">Hoje</th>
                      <th className="th text-right">Pelo ERP</th>
                      <th className="th text-right">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cp.linhas.filter((l) => !(l.estado === "some" && Math.abs(l.antes ?? 0) < 0.005)).map((l) => (
                      <tr key={l.codigo} className={l.estado === "some" ? "bg-amber-50/40" : l.estado === "nova" ? "bg-green-50/30" : undefined}>
                        <td className="td">
                          <span className="font-mono text-xs text-slate-500">{l.codigo}</span> <span className="text-slate-700">{l.nome}</span>
                        </td>
                        <td className="td text-right tabular-nums text-slate-500">{l.antes == null ? <span className="text-slate-300">—</span> : formatBRL(l.antes)}</td>
                        <td className="td text-right font-medium tabular-nums text-slate-800">{l.depois == null ? <span className="text-amber-600">não veio</span> : formatBRL(l.depois)}</td>
                        <td className="td text-right tabular-nums text-xs">
                          {l.dif == null ? <span className="text-slate-300">—</span> : l.dif === 0 ? <span className="text-slate-400">igual</span> : <span className={l.dif > 0 ? "text-blue-700" : "text-slate-600"}>{fmtDif(l.dif)}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Modal>
        );
      })()}

      {folhaPrev && resumoPrev && (() => {
        const { naoCasados } = folhaPrev;
        // "Busca cortada" vale para o bloco de não encontrados, que fala de completude.
        const buscaIncompleta = !!folhaPrev.mubi?.truncado || !!folhaPrev.mubi?.busca?.truncado || (folhaPrev.mubi?.busca?.falhas.length ?? 0) > 0;
        void buscaIncompleta;
        return (
          <PreviaFolha
            resumo={resumoPrev}
            iguais={folhaPrev.diff.iguais.length}
            cobertura={folhaPrev.mubi?.busca}
            nomeDe={(id) => d.nomeColab(id)}
            ausentesMarcados={ausentesMarcados}
            onMarcarAusente={(id, ok) => setAusentesMarcados((atual) => { const n = new Set(atual); if (ok) n.add(id); else n.delete(id); return n; })}
            onMarcarBloco={(ids, ok) => setAusentesMarcados((atual) => { const n = new Set(atual); for (const id of ids) { if (ok) n.add(id); else n.delete(id); } return n; })}
            confirmados={confirmados}
            onConfirmar={(chave, ok) => setConfirmados((atual) => { const n = new Set(atual); if (ok) n.add(chave); else n.delete(chave); return n; })}
            salarios={folhaPrev.mubi ? salarios : []}
            salariosMarcados={salariosMarcados}
            onMarcarSalario={(id) => setSalariosMarcados((atual) => { const n = new Set(atual); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
            cpfs={folhaPrev.cpfsAprendidos ?? []}
            onAplicar={aplicarFolha}
            onCancelar={fecharPrevia}
            extras={<>
              {/* Conta de pessoa que o filtro recusou. O filtro é por CÓDIGO e o
                  contador muda código: sem este aviso, a faxina simplesmente
                  para de aparecer e o mês fecha menor sem ninguém notar. */}
              {(folhaPrev.mubi?.foraDaFolha?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                  <p className="text-xs font-semibold text-amber-900">Contas de pessoal que ficaram de fora</p>
                  <p className="mt-1 text-[11px] text-amber-800/90">
                    O ERP tem títulos nestas contas, o nome delas é de pagamento a pessoa, mas elas não estão na lista de contas de folha —
                    então não entram na ficha de ninguém. Se alguma for de colaborador, me avise para incluí-la.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {folhaPrev.mubi!.foraDaFolha!.map((c) => (
                      <li key={c.plano} className="flex items-baseline justify-between gap-3 text-[11px] text-amber-900">
                        <span className="font-mono">{c.plano}</span>
                        <span className="tabular-nums">{c.quantos} título(s) · {formatBRL(c.total)}</span>
                      </li>
                    ))}
                  </ul>
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
                                <optgroup label={`Quadro de ${compLabel(compAtiva)}`}>
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
                                          <optgroup label={`Quadro de ${compLabel(compAtiva)}`}>
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
            </>}
          />
        );
      })()}

      {/* Confirmação final: o resumo em reais mais uma vez, antes de gravar. */}
      {folhaPrev && resumoPrev && (
        <ConfirmDialog
          aberto={confirmarAplicacao}
          onFechar={() => setConfirmarAplicacao(false)}
          onConfirmar={aplicarFolhaAgora}
          // O padrão do diálogo é o botão vermelho escrito "Excluir": aqui o
          // que se faz é aplicar, e o texto tem de dizer o que vai acontecer.
          textoConfirmar={ausentesMarcados.size ? `Aplicar e remover ${ausentesMarcados.size}` : "Aplicar"}
          perigo={ausentesMarcados.size > 0}
          titulo={`Aplicar ${resumoPrev.contaNoBotao} alteração(ões)?`}
          mensagem={[
            `Pago à equipe: ${formatBRL(resumoPrev.totalHoje)} → ${formatBRL(resumoPrev.totalDepois)}${resumoPrev.delta !== 0 ? ` (${resumoPrev.delta > 0 ? "+" : "−"}${formatBRL(Math.abs(resumoPrev.delta))})` : ""}.`,
            resumoPrev.silenciosos ? `${resumoPrev.silenciosos} mudança(s) só de texto, conta ou id do ERP entram junto.` : "",
            ausentesMarcados.size ? `${ausentesMarcados.size} lançamento(s) serão removidos.` : "",
            salariosMarcados.size ? `${salariosMarcados.size} salário(s) do cadastro serão preenchidos.` : "",
            "Um retrato do que muda fica guardado: dá para desfazer em Sincronização.",
          ].filter(Boolean).join(" ")}
        />
      )}

      {/* Desfazer a última aplicação da folha */}
      {ultimoRetrato && planoDesfazer && (
        <ConfirmDialog
          aberto={confirmarDesfazer}
          onFechar={() => setConfirmarDesfazer(false)}
          onConfirmar={desfazerUltimaAplicacao}
          textoConfirmar="Desfazer"
          perigo={false}
          titulo="Desfazer a última aplicação da folha?"
          mensagem={[
            `${ultimoRetrato.rotulo ?? "Folha do ERP"} · aplicada em ${new Date(ultimoRetrato.em).toLocaleString("pt-BR")}.`,
            planoDesfazer.restaurar.length ? `${planoDesfazer.restaurar.length} registro(s) voltam ao que eram.` : "",
            planoDesfazer.apagar.length ? `${planoDesfazer.apagar.length} novo(s) serão apagados.` : "",
            planoDesfazer.pulados.length ? `${planoDesfazer.pulados.length} ficam como estão (editados depois ou já desfeitos).` : "",
            planoDesfazer.semVolta.length ? `${planoDesfazer.semVolta.length} removido(s) na aplicação NÃO voltam por aqui — peça restauração.` : "",
          ].filter(Boolean).join(" ")}
        />
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
              // A mesma régua do rateio (classeDaConta): pela referência quando renumerou.
              const classeAtual = classeDaConta(c, mapaClasse);
              return (
                <div
                  key={c.codigo}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/70 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{c.nome}</p>
                    <p className="text-xs text-slate-400">
                      {c.codigo}{c.equivaleA ? ` (ref. ${c.equivaleA} no plano do contador)` : ""} · {formatBRL(c.valor)}
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
          {/* HORA EXTRA: os campos da planilha do RH — dia, horas e a base.
              Só aparecem neste tipo; nos outros o modal continua como era. */}
          {ehLancHE && (
            <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Dia">
                  <Input type="date" value={heDia} onChange={(e) => setHeDia(e.target.value)} />
                </Campo>
                <Campo label="Horas" hint='Como na planilha: 02:50'>
                  <Input
                    value={heDuracao}
                    onChange={(e) => { setHeDuracao(e.target.value); setValorTocado(false); }}
                    placeholder="02:50"
                    inputMode="numeric"
                  />
                </Campo>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Adicional (%)" hint="50 em dia útil · 100 em domingo/feriado">
                  <Input
                    value={hePercentual}
                    onChange={(e) => { setHePercentual(e.target.value); setValorTocado(false); }}
                    placeholder="50"
                    inputMode="decimal"
                  />
                </Campo>
                <Campo label="Jornada mensal (h)" hint="220 = 44h/semana · 200 = 40h">
                  <Input
                    value={heDivisor}
                    onChange={(e) => { setHeDivisor(e.target.value); setValorTocado(false); }}
                    placeholder="220"
                    inputMode="decimal"
                  />
                </Campo>
              </div>
              <Campo
                label="Salário base (R$)"
                hint={colabDoLanc?.salario ? "Veio do cadastro — pode corrigir só para esta conta" : "Sem salário no cadastro: digite para calcular"}
              >
                <Input
                  value={heSalario}
                  onChange={(e) => { setHeSalario(e.target.value); setValorTocado(false); }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </Campo>

              {/* A conta à mostra. Número que aparece sem explicação vira número
                  em que ninguém confia — e aí o RH volta para a planilha. */}
              {heDuracao.trim() && heMinutos == null ? (
                <p className="text-xs text-red-600">
                  Não entendi as horas. Escreva como na planilha: <b>02:50</b> (ou 2,5 para duas horas e meia).
                </p>
              ) : heCalc.semSalario && (heMinutos ?? 0) > 0 ? (
                <p className="text-xs text-amber-700">
                  Falta o salário base para calcular. Digite acima — e vale cadastrar em Colaboradores para não precisar de novo.
                </p>
              ) : heValido ? (
                /* A conta escrita passo a passo, com os MESMOS números que o
                   sistema usa. Antes ela mostrava os passos arredondados e
                   cravava um total que eles não produzem: dizia "R$ 16,79/h ×
                   4,5h" e gravava R$ 75,52, quando na calculadora dá R$ 75,56.
                   Três centavos bastaram para o RH dizer "está calculando
                   errado" — e estava, no que importa. Agora cada linha daqui
                   refaz na mão e bate. */
                <p className="text-xs text-slate-500">
                  {formatBRL(heSalarioNum)} ÷ {heDivisorNum.toLocaleString("pt-BR")}h = {formatBRL(heCalc.valorHoraNormal)}/h
                  {" · "}+{hePctNum.toLocaleString("pt-BR")}% = {formatBRL(heCalc.valorHoraExtra)}/h
                  {" · "}× {horasDecimais(heMinutos ?? 0).toLocaleString("pt-BR")}h ={" "}
                  <b className="text-slate-700">{formatBRL(heCalc.valor)}</b>
                </p>
              ) : null}
            </div>
          )}

          <Campo
            label="Valor (R$)"
            hint={heValido ? "Calculado — pode alterar se houve bônus" : undefined}
          >
            {/* Texto, não type=number: o campo numérico devolve "" para "0," e
                comia o que estava sendo digitado. valorDigitado() lê os dois
                formatos brasileiros. */}
            <Input
              value={lancValor}
              onChange={(e) => { setLancValor(e.target.value); setValorTocado(true); }}
              placeholder="0,00"
              inputMode="decimal"
            />
          </Campo>
          {heDiferenca !== 0 && (
            <p className="text-xs text-amber-700">
              {heDiferenca > 0 ? "+" : "−"}{formatBRL(Math.abs(heDiferenca))} {heDiferenca > 0 ? "acima" : "abaixo"} do calculado
              {heDiferenca > 0 ? " (bônus)" : ""} — fica registrado na descrição.
            </p>
          )}
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
      <DrillModal
        {...drillBase.props}
        colunaExtra={
          valorDoMesPorPessoa.size
            ? {
                titulo: "Custo estimado",
                render: (c) => {
                  const l = valorDoMesPorPessoa.get(c.id);
                  return l ? <span className="tabular-nums">{formatBRL(l.estimado)}</span> : "—";
                },
              }
            : undefined
        }
      />
    </div>
  );
}

// ===================== Custo Global de Funcionários (bate com o DRE) =====================
// Soma as contas do grupo "Funcionários" do plano de contas — as que começam com
// "2.1." (Salário, Adiantamento, FGTS, Férias, Comissão Interna, Alimentação,
// Confraternização, etc.). É a MESMA base que o DRE usa, então o total bate.
// Diferente da "Folha real" (que soma o pago por pessoa), aqui é a visão contábil
// global, incluindo os custos coletivos (alimentação, confraternização, FGTS mensal).
// O mês vem da página (seletor único para as três abas, 06/09/2026): o bloco
// não escolhe mais a competência sozinho — mostra a que está aberta, e diz
// quando ela não tem plano do contador em vez de pular calado para outro mês.
function CustoGlobalFuncionarios({
  comp,
  competencias,
  onComp,
  irParaSync,
}: {
  comp: string;
  competencias: string[];
  onComp: (c: string) => void;
  irParaSync: () => void;
}) {
  const { items: plano } = useColecao("planoContas");
  const { items: pagamentos } = useColecao("pagamentos");
  // Conta em foco pelos cards: filtra a tabela de contas de pessoal (null = todas).
  const [focoBruto, setContaFoco] = useState<string | null>(null);
  const compAtiva = comp;
  const idx = competencias.indexOf(compAtiva);
  const temPlano = useMemo(() => plano.some((p) => p.competencia === compAtiva), [plano, compAtiva]);
  // Trocar de mês limpa o foco — a conta filtrada pode nem existir na outra competência.
  const irMes = (d: number) => { const n = competencias[idx + d]; if (n) { onComp(n); setContaFoco(null); } };

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

  // O mês agora muda por FORA deste bloco (seletor do topo, setas do resumo,
  // clique no histórico), e um foco preso numa conta que o outro mês não tem
  // deixava a tabela com zero linha e um total de R$ 0,00 "filtrado". O foco
  // vale enquanto a conta existir no mês aberto; fora disso, some sozinho.
  const contaFoco = focoBruto && grupos.some((g) => g.cod === focoBruto) ? focoBruto : null;

  if (!compAtiva || !temPlano) {
    // As setas ficam AQUI também: sem elas, cair num mês sem plano do contador
    // era um beco — o bloco sumia inteiro e só o seletor lá no topo trazia de
    // volta. Elas percorrem a mesma lista de meses do resto da tela.
    return (
      <EmptyState
        title={compAtiva ? `Sem plano de contas em ${compLabelLongo(compAtiva)}` : "Sem plano de contas importado"}
        description="O custo global depende do plano de contas deste mês, que chega sozinho do Mubisys ao abrir o mês. Até lá este bloco fica indisponível, não zerado."
        icon={<Layers className="h-10 w-10" />}
        acao={
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button type="button" onClick={() => irMes(-1)} disabled={idx <= 0} className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40" aria-label="Mês anterior" title="Mês anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className="btn-outline" onClick={irParaSync}><RefreshCw className="h-4 w-4" /> Ver a sincronização</button>
            <button type="button" onClick={() => irMes(1)} disabled={idx < 0 || idx >= competencias.length - 1} className="btn-outline h-9 w-9 shrink-0 p-0 disabled:opacity-40" aria-label="Próximo mês" title="Próximo mês">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
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
              <span className="px-1 text-sm font-medium text-slate-700 tabular-nums">{compLabelLongo(compAtiva)}</span>
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
              <p className="mt-0.5 text-xs text-slate-500">O que foi pago a cada colaborador — a folha geral do mês, logo acima.</p>
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
            Esta é a visão <strong>contábil</strong> (plano de contas, grupo {PREFIXO_FUNCIONARIOS}*) — inclui os custos coletivos como alimentação, confraternização e o FGTS mensal. É a mesma base do DRE, então o total deve bater. A folha real <strong>por pessoa</strong> está na aba "Custos de Colaboradores"; a folha geral do mês, logo acima.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

// ---------- Helpers de UI locais ----------

// Lista de competências para o seletor de upload: mês corrente + 23 meses anteriores,
// garantindo que a competência atualmente escolhida esteja presente.
/** Lista recolhível do que ficou de fora do plano do ERP — fora do componente, senão remonta a cada render. */
function ListaFora({ titulo, porque, itens, tom }: { titulo: string; porque: string; itens: ContaMubi[]; tom: string }) {
  if (itens.length === 0) return null;
  const soma = itens.reduce((s, x) => s + x.valor, 0);
  return (
    <details className={`rounded-xl border p-3 ${tom}`}>
      <summary className="cursor-pointer text-xs font-semibold">
        {itens.length} {titulo} · {formatBRL(soma)}
      </summary>
      <p className="mt-1 text-[11px] opacity-80">{porque}</p>
      <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto">
        {itens.map((x) => (
          <li key={x.codigo} className="flex items-baseline justify-between gap-3 text-[11px]">
            <span><span className="font-mono">{x.codigo}</span> {x.nome}</span>
            <span className="tabular-nums">{formatBRL(x.valor)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

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
