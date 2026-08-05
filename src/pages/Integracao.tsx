import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClipboardList,
  CheckCircle2,
  Circle,
  UserPlus,
  UserMinus,
  Plus,
  PlayCircle,
  GraduationCap,
  ScrollText,
  MapPin,
  Brain,
  HeartHandshake,
  ChevronRight,
  FolderCheck,
  AlertCircle,
  FileText,
  Trophy,
  Sparkles,
  Users, Pencil, Trash2, Archive, PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Campo, Input, Select, Toggle } from "@/components/ui/form";
import { Avatar, Progress, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { BarrasColoridas } from "@/components/charts/charts";
import { useColecao } from "@/lib/store";
import { useDominio, noQuadro } from "@/lib/dominio";
import { ordemEstavel, aplicarOrdem } from "@/lib/ordemEstavel";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
import { fimDaExperiencia } from "@/lib/clt";
import { HOJE } from "@/data/_gen";
import type { Tarefa } from "@/data/types";

type TipoChecklist = "Admissão" | "Desligamento";

// Prefixo que identifica uma tarefa de "Documentação de RH" dentro do onboarding.
// Modeladas como tarefas tipo "Admissão" cujo título começa com "Doc: ".
const PREFIXO_DOC = "Doc: ";
const ehDoc = (t: Tarefa) => t.titulo.startsWith(PREFIXO_DOC);
const rotuloDoc = (t: Tarefa) => t.titulo.slice(PREFIXO_DOC.length);

// Documentação admissional padrão de RH (item 15 v3).
const DOCS_RH_PADRAO = [
  "Contrato assinado",
  "RG/CPF/CTPS",
  "Comprovante de residência",
  "Dados bancários",
  "ASO admissional",
  "Foto 3x4",
  "Termo do Código de Ética",
];

const variantePorcentagem = (
  pct: number,
): "neutral" | "warning" | "info" | "success" => {
  if (pct >= 100) return "success";
  if (pct >= 50) return "info";
  if (pct > 0) return "warning";
  return "neutral";
};

// Gamificação da jornada de onboarding: "nível" conforme o progresso (%).
const NIVEIS_JORNADA = [
  { min: 100, rotulo: "Pronto!", classe: "border-green-200 bg-green-50 text-green-700" },
  { min: 67, rotulo: "Quase lá", classe: "border-brand-200 bg-brand-50 text-brand" },
  { min: 34, rotulo: "Ambientando", classe: "border-blue-200 bg-blue-50 text-blue-700" },
  { min: 1, rotulo: "Recém-chegado", classe: "border-amber-200 bg-amber-50 text-amber-700" },
  { min: 0, rotulo: "A iniciar", classe: "border-slate-200 bg-slate-50 text-slate-500" },
];
const nivelJornada = (pct: number) => NIVEIS_JORNADA.find((n) => pct >= n.min)!;

export default function Integracao() {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { items: tarefas, criar, atualizar } = useColecao("tarefas");
  const { atualizar: atualizarColab } = useColecao("colaboradores");
  const { items: modelos } = useColecao("modelosChecklist");

  const gere = podeGerir(sessao);
  const [iniciar, setIniciar] = useState(false);

  // Quem ainda está na casa. Régua canônica (noQuadro): a versão anterior
  // olhava só `statusId` e deixava passar quem tem data de desligamento com o
  // status ainda em "aviso"/"afastado".
  const escopo = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores).filter(noQuadro),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  // As TAREFAS seguem um escopo mais largo, com os inativos dentro. Offboarding
  // é justamente o que se faz DEPOIS do último dia — homologação, exame
  // demissional, verbas rescisórias. Filtrar por "não inativo" fazia o checklist
  // sumir da tela no instante em que a pessoa era desligada: um desligamento
  // pela metade virava invisível, sem nenhum outro lugar no sistema para
  // terminá-lo (a ficha do colaborador não tem seção de tarefas).
  const idsComInativos = useMemo(
    () => new Set(colaboradoresVisiveis(sessao, d.colaboradores).map((c) => c.id)),
    [sessao, d.colaboradores],
  );
  const tarefasEscopo = useMemo(
    () => tarefas.filter((t) => idsComInativos.has(t.colaboradorId)),
    [tarefas, idsComInativos],
  );

  // Estatísticas de cabeçalho — mantém também os conjuntos de colaboradorIds
  // de cada grupo para tornar cartões e gráfico clicáveis (auditoria).
  const resumo = useMemo(() => {
    const grupos = new Map<
      string,
      { colaboradorId: string; tipo: string; total: number; feitas: number }
    >();
    for (const t of tarefasEscopo) {
      const chave = `${t.colaboradorId}::${t.tipo}`;
      const g =
        grupos.get(chave) ??
        { colaboradorId: t.colaboradorId, tipo: t.tipo, total: 0, feitas: 0 };
      g.total += 1;
      if (t.concluida) g.feitas += 1;
      grupos.set(chave, g);
    }
    const idsAndamento = new Set<string>();
    const idsConcluidos = new Set<string>();
    const idsOff = new Set<string>();
    for (const g of grupos.values()) {
      if (g.tipo === "Admissão") {
        // Onboarding é COBRANÇA: quem foi admitido e saiu com o checklist pela
        // metade ficava somado a "em andamento" para sempre, e ninguém pode
        // concluir a integração de quem não trabalha mais aqui.
        if (!idsEscopo.has(g.colaboradorId)) continue;
        if (g.feitas >= g.total) idsConcluidos.add(g.colaboradorId);
        else idsAndamento.add(g.colaboradorId);
      } else if (g.tipo === "Desligamento") {
        idsOff.add(g.colaboradorId);
      }
    }
    return {
      onAndamento: idsAndamento.size,
      onConcluidos: idsConcluidos.size,
      offTotal: idsOff.size,
      idsAndamento,
      idsConcluidos,
      idsOff,
    };
  }, [tarefasEscopo, idsEscopo]);

  const drill = useDrill();

  // Converte um conjunto de colaboradorIds em colaboradores (ignora ausentes).
  const colabsDe = (ids: Set<string>) =>
    [...ids].map((id) => d.colabById.get(id)).filter(Boolean) as ReturnType<
      typeof useDominio
    >["colaboradores"];

  const dadosJornada = useMemo(
    () => [
      { nome: "Onboarding em andamento", valor: resumo.onAndamento, cor: "#16334f" },
      { nome: "Onboarding concluído", valor: resumo.onConcluidos, cor: "#16a34a" },
      { nome: "Offboarding", valor: resumo.offTotal, cor: "#d97706" },
    ],
    [resumo],
  );

  const abrirJornada = (nome: string) => {
    if (nome === "Onboarding em andamento")
      drill.abrir(
        "Onboardings em andamento",
        colabsDe(resumo.idsAndamento),
        "Admissões com itens pendentes",
      );
    else if (nome === "Onboarding concluído")
      drill.abrir(
        "Onboardings concluídos",
        colabsDe(resumo.idsConcluidos),
        "Admissões com checklist 100% concluído",
      );
    else if (nome === "Offboarding")
      drill.abrir(
        "Offboardings",
        colabsDe(resumo.idsOff),
        "Colaboradores em processo de desligamento",
      );
  };

  const alternar = (t: Tarefa, valor: boolean) => {
    atualizar(t.id, {
      concluida: valor,
      concluidaEm: valor ? HOJE.toISOString() : null,
    });
  };

  // Semeia a documentação de RH padrão para todo onboarding que ainda não a tem.
  // Feito no nível da página (não dentro do card) para não depender de qual aba
  // está ativa nem de o card estar montado — o seed deixa de ser efeito de render.
  // Idempotente: só cria quando o colaborador tem checklist de Admissão e ainda
  // não possui nenhuma tarefa "Doc: ".
  useEffect(() => {
    const porColab = new Map<string, { temDoc: boolean; maxOrdem: number }>();
    for (const t of tarefas) {
      if (t.tipo !== "Admissão" || !idsEscopo.has(t.colaboradorId)) continue;
      const g = porColab.get(t.colaboradorId) ?? { temDoc: false, maxOrdem: -1 };
      if (t.titulo.startsWith(PREFIXO_DOC)) g.temDoc = true;
      else g.maxOrdem = Math.max(g.maxOrdem, t.ordem);
      porColab.set(t.colaboradorId, g);
    }
    for (const [colaboradorId, g] of porColab) {
      /* A GUARDA É O CARIMBO NA PESSOA, não a presença dos itens.

         Inferir pela presença tinha um buraco no limite: enquanto sobrasse UM
         documento nada acontecia, mas no instante em que o sétimo era apagado o
         efeito disparava e recriava os sete — com ids novos e todos em aberto.
         Ou seja, quem limpasse o bloco inteiro (que é justamente para o que a
         lixeira existe: tirar documento que não se aplica) via tudo voltar, e a
         marcação dos que tinha apagado antes sumia junto.

         Com o carimbo, "já semeei para esta pessoa" é um fato gravado, não um
         palpite a partir do que sobrou na tela. */
      const colab = d.colabById.get(colaboradorId);
      if (colab?.docsRhSemeadosEm || g.temDoc) {
        // Registro antigo, semeado antes de existir o carimbo: carimba agora
        // para não depender mais da presença dos itens.
        if (g.temDoc && !colab?.docsRhSemeadosEm && colab) {
          atualizarColab(colaboradorId, { docsRhSemeadosEm: new Date().toISOString() });
        }
        continue;
      }
      const baseOrdem = g.maxOrdem + 1;
      DOCS_RH_PADRAO.forEach((nome, i) => {
        criar({
          /* ID DETERMINÍSTICO. Com id aleatório, dois navegadores que abrem a
             tela ao mesmo tempo semeiam 7 cada um e o merge do pull entrega 14
             documentos. Com o id derivado da pessoa e da posição, os dois
             semeiam o MESMO registro e o merge resolve sozinho. */
          id: `tar-doc-${colaboradorId}-${i}`,
          colaboradorId,
          tipo: "Admissão",
          titulo: `${PREFIXO_DOC}${nome}`,
          responsavel: "RH",
          concluida: false,
          concluidaEm: null,
          ordem: baseOrdem + i,
        });
      });
      atualizarColab(colaboradorId, { docsRhSemeadosEm: new Date().toISOString() });
    }
  }, [tarefas, idsEscopo, criar, d, atualizarColab]);

  return (
    <div>
      <PageHeader
        title="Onboarding e Offboarding"
        description="A jornada de cada colaborador — da documentação à integração com a equipe — e o desligamento, passo a passo."
      >
        {gere && (
          <button className="btn-primary" onClick={() => setIniciar(true)}>
            <PlayCircle className="h-4 w-4" /> Iniciar jornada
          </button>
        )}
      </PageHeader>

      <p className="mb-3 text-xs text-slate-400">
        Clique nos cartões e barras para ver os colaboradores.
      </p>

      {/* O próprio StatCard já é o botão — reaproveita o mesmo drill das barras
          do gráfico para não haver dois caminhos com regras diferentes. */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Onboardings em andamento"
          value={resumo.onAndamento}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="brand"
          hint="Admissões com itens pendentes"
          onClick={() => abrirJornada("Onboarding em andamento")}
          title="Ver quem está com o onboarding em andamento"
        />
        <StatCard
          label="Onboardings concluídos"
          value={resumo.onConcluidos}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
          onClick={() => abrirJornada("Onboarding concluído")}
          title="Ver quem já concluiu o onboarding"
        />
        <StatCard
          label="Offboardings"
          value={resumo.offTotal}
          icon={<UserMinus className="h-5 w-5" />}
          accent="amber"
          onClick={() => abrirJornada("Offboarding")}
          title="Ver quem está em processo de desligamento"
        />
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title={
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <UserPlus className="h-4 w-4 text-brand" />
                Jornada do colaborador
              </div>
            }
          />
          <CardBody>
            <BarrasColoridas
              data={dadosJornada}
              altura={240}
              onItemClick={abrirJornada}
            />
          </CardBody>
        </Card>
      </div>

      <div className="mt-6">
        <EsteiraOnboarding />
      </div>

      <div className="mt-6">
        <Tabs
          abas={[
            {
              id: "admissao",
              label: "Onboarding (Admissão)",
              icon: <UserPlus className="h-4 w-4" />,
              conteudo: (
                <PainelChecklist
          onIniciar={() => setIniciar(true)}
                  tipo="Admissão"
                  tarefas={tarefasEscopo}
                  escopoIds={idsEscopo}
                  onAlternar={alternar}
                />
              ),
            },
            {
              id: "desligamento",
              label: "Offboarding (Desligamento)",
              icon: <UserMinus className="h-4 w-4" />,
              conteudo: (
                <PainelChecklist
          onIniciar={() => setIniciar(true)}
                  tipo="Desligamento"
                  tarefas={tarefasEscopo}
                  // Aqui o desligado É o assunto. Passar `idsEscopo` (que tira
                  // inativo) esvaziava a aba: o cartão "Offboardings" contava N
                  // e a lista abaixo dizia "Nenhum offboarding em aberto".
                  escopoIds={idsComInativos}
                  onAlternar={alternar}
                />
              ),
            },
          ]}
        />
      </div>

      {iniciar && (
        <IniciarChecklistModal
          aberto={iniciar}
          onFechar={() => setIniciar(false)}
          escopo={escopo}
          tarefas={tarefas}
          modelos={modelos}
          criar={criar}
          onConcluido={(qtd, nome) => {
            toast(`Checklist iniciado para ${nome} (${qtd} itens).`);
            setIniciar(false);
          }}
        />
      )}

      <DrillModal {...drill.props} />
    </div>
  );
}

// ---------- Esteira visual padrão de onboarding ----------
const ETAPAS_ESTEIRA: { titulo: string; icon: React.ReactNode }[] = [
  { titulo: "Documentação de RH completa", icon: <FolderCheck className="h-4 w-4" /> },
  { titulo: "Treinamento inicial completo", icon: <GraduationCap className="h-4 w-4" /> },
  { titulo: "Aceite do Código de Ética", icon: <ScrollText className="h-4 w-4" /> },
  { titulo: "Tour das instalações", icon: <MapPin className="h-4 w-4" /> },
  { titulo: "Apresentação à equipe", icon: <Users className="h-4 w-4" /> },
  { titulo: "Perfil Comportamental", icon: <Brain className="h-4 w-4" /> },
  { titulo: "Designação de Padrinho", icon: <HeartHandshake className="h-4 w-4" /> },
];

function EsteiraOnboarding() {
  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <GraduationCap className="h-4 w-4 text-brand" />
            Esteira padrão de onboarding
          </div>
        }
        action={
          <span className="hidden text-xs text-slate-400 sm:inline">
            Etapas-chave da jornada de integração
          </span>
        }
      />
      <CardBody>
        <ol className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-stretch">
          {ETAPAS_ESTEIRA.map((etapa, i) => (
            <li key={etapa.titulo} className="flex items-center gap-2 sm:flex-1">
              <div className="flex flex-1 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition hover:border-brand/30 hover:shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand">{etapa.icon}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Etapa {i + 1}</p>
                  <p className="truncate text-xs font-medium text-slate-700">{etapa.titulo}</p>
                </div>
              </div>
              {i < ETAPAS_ESTEIRA.length - 1 && (
                <ChevronRight className="hidden h-4 w-4 shrink-0 text-slate-300 sm:block" />
              )}
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

// ---------- Painel de uma aba (lista de cards por colaborador) ----------
function PainelChecklist({
  tipo,
  tarefas,
  escopoIds,
  onAlternar,
  onIniciar,
}: {
  tipo: TipoChecklist;
  tarefas: Tarefa[];
  escopoIds: Set<string>;
  onAlternar: (t: Tarefa, valor: boolean) => void;
  /** Abre o mesmo modal do botão do topo — o estado vazio mandava usar um
   *  botão que não estava ali e ainda por cima com outro nome. */
  onIniciar?: () => void;
}) {
  const d = useDominio();
  const [focoId, setFocoId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement | null>());
  /* Arquivados ficam FORA da tela por padrão, mas nunca escondidos: o contador
     logo abaixo do título diz quantos são e abre a lista. Esconder sem dizer
     quantos é o mesmo que perder. */
  const [verArquivados, setVerArquivados] = useState(false);

  // useCallback para os useMemo abaixo poderem depender DELA, e não do `d`
  // inteiro: sem isso o lint acusa dependência faltando e a alternativa (listar
  // `d`) esconde qual pedaço realmente importa.
  const estaArquivado = useCallback(
    (colaboradorId: string) => {
      const campo = tipo === "Admissão" ? "onboardingArquivadoEm" : "offboardingArquivadoEm";
      return !!d.colabById.get(colaboradorId)?.[campo];
    },
    [d, tipo],
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      if (t.tipo !== tipo) continue;
      const arr = mapa.get(t.colaboradorId) ?? [];
      arr.push(t);
      mapa.set(t.colaboradorId, arr);
    }
    return [...mapa.entries()]
      .map(([colaboradorId, itens]) => {
        const ordenadas = [...itens].sort((a, b) => a.ordem - b.ordem);
        // Jornada = tarefas comuns; Docs = tarefas "Doc: " (apenas no onboarding).
        const jornada = ordenadas.filter((t) => !ehDoc(t));
        const docs = ordenadas.filter((t) => ehDoc(t));
        const total = ordenadas.length;
        const feitas = ordenadas.filter((t) => t.concluida).length;
        return {
          colaboradorId,
          jornada,
          docs,
          abertas: total - feitas,
        };
      })
      .filter((g) => escopoIds.has(g.colaboradorId));
  }, [tarefas, tipo, escopoIds]);

  const arquivados = useMemo(() => grupos.filter((g) => estaArquivado(g.colaboradorId)), [grupos, estaArquivado]);
  const naTela = useMemo(
    () => (verArquivados ? grupos : grupos.filter((g) => !estaArquivado(g.colaboradorId))),
    [grupos, verArquivados, estaArquivado],
  );

  /* A ORDEM NÃO PODE MUDAR DEBAIXO DO CLIQUE.
     Ordenar por "mais pendências primeiro" a cada render fazia o cartão pular
     de lugar assim que se marcava um item: em 05/08/2026, Candida e Victor
     estavam empatados em 12 pendências, e marcar um documento na Candida
     trocava os dois de posição na grade. Quem clicou continuava olhando o mesmo
     ponto da tela, agora ocupado pelo cartão de OUTRA pessoa — e parecia que o
     clique não pegou e que os marcados sumiram.

     A regra de triagem continua: ela decide a ordem quando a LISTA muda (alguém
     entra ou sai), não quando um número dentro dela muda. Ver lib/ordemEstavel. */
  const ordemRef = useRef<string[]>([]);
  const gruposOrdenados = useMemo(() => {
    const paraOrdenar = naTela.map((g) => ({
      id: g.colaboradorId,
      abertas: g.abertas,
      nome: d.nomeColab(g.colaboradorId),
    }));
    ordemRef.current = ordemEstavel(paraOrdenar, ordemRef.current);
    return aplicarOrdem(
      naTela.map((g) => ({ ...g, id: g.colaboradorId })),
      ordemRef.current,
    );
  }, [naTela, d]);

  // Resumo agregado de pendências (item 3 — "tudo em aberto").
  const pendencias = useMemo(() => {
    let tarefasAbertas = 0;
    let docsAbertos = 0;
    /* Conta o que está NA TELA. Somar arquivado daria um número de pendência
       sem nada para clicar — o painel mandaria resolver algo invisível. */
    const visiveis = grupos.filter((g) => !estaArquivado(g.colaboradorId));
    for (const g of visiveis) {
      tarefasAbertas += g.jornada.filter((t) => !t.concluida).length;
      docsAbertos += g.docs.filter((t) => !t.concluida).length;
    }
    const colabsComPendencia = visiveis.filter((g) => g.abertas > 0).length;
    return { tarefasAbertas, docsAbertos, colabsComPendencia };
  }, [grupos, estaArquivado]);

  const focar = (id: string) => {
    setFocoId(id);
    const el = refs.current.get(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // Limpa o destaque após alguns segundos.
  useEffect(() => {
    if (!focoId) return;
    const t = setTimeout(() => setFocoId(null), 2600);
    return () => clearTimeout(t);
  }, [focoId]);

  if (grupos.length === 0) {
    return (
      <EmptyState
        title={
          tipo === "Admissão"
            ? "Nenhum onboarding em aberto"
            : "Nenhum offboarding em aberto"
        }
        description="Comece pelo modelo padrão — dá para ajustar os itens depois."
        icon={<ClipboardList className="h-8 w-8" />}
        acao={onIniciar ? <button className="btn-primary" onClick={onIniciar}>Iniciar jornada</button> : undefined}
      />
    );
  }

  /* Todos arquivados: não é "não há nada", é "está tudo resolvido". Dizer a
     coisa errada aqui faria a pessoa achar que perdeu os checklists. */
  if (naTela.length === 0) {
    return (
      <EmptyState
        title={tipo === "Admissão" ? "Nenhuma integração em aberto" : "Nenhum offboarding em aberto"}
        description={`${arquivados.length} ${arquivados.length === 1 ? "pessoa foi arquivada" : "pessoas foram arquivadas"} — a jornada delas terminou.`}
        icon={<Trophy className="h-8 w-8" />}
        acao={
          <button className="btn-outline" onClick={() => setVerArquivados(true)}>
            Ver arquivados
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {tipo === "Admissão" && (
        <PainelPendencias
          pendencias={pendencias}
          grupos={grupos.map((g) => ({
            colaboradorId: g.colaboradorId,
            nome: d.nomeColab(g.colaboradorId),
            abertas: g.abertas,
          }))}
          onFocar={focar}
        />
      )}

      {/* Quantos saíram da tela — e o caminho de volta. */}
      {arquivados.length > 0 && (
        <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
          <Trophy className="h-3.5 w-3.5 text-slate-400" />
          <span>
            {arquivados.length} {arquivados.length === 1 ? "pessoa arquivada" : "pessoas arquivadas"}
            {verArquivados ? " (aparecendo abaixo)" : " fora desta lista"}
          </span>
          <button
            type="button"
            className="font-medium text-brand hover:underline"
            onClick={() => setVerArquivados((v) => !v)}
          >
            {verArquivados ? "esconder" : "ver"}
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {gruposOrdenados.map((g) => (
          <div
            key={`${tipo}-${g.colaboradorId}`}
            ref={(el) => {
              refs.current.set(g.colaboradorId, el);
            }}
            className={
              focoId === g.colaboradorId
                ? "rounded-2xl ring-2 ring-brand ring-offset-2 transition"
                : "transition"
            }
          >
            <CardChecklist
              colaboradorId={g.colaboradorId}
              tipo={tipo}
              jornada={g.jornada}
              docs={g.docs}
              onAlternar={onAlternar}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Painel "tudo em aberto" (resumo de pendências) ----------
function PainelPendencias({
  pendencias,
  grupos,
  onFocar,
}: {
  pendencias: { tarefasAbertas: number; docsAbertos: number; colabsComPendencia: number };
  grupos: { colaboradorId: string; nome: string; abertas: number }[];
  onFocar: (id: string) => void;
}) {
  const totalAberto = pendencias.tarefasAbertas + pendencias.docsAbertos;
  const comPendencia = grupos.filter((g) => g.abertas > 0);

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Tudo em aberto
          </div>
        }
        action={
          <Badge variant={totalAberto > 0 ? "warning" : "success"}>
            {totalAberto === 0
              ? "Nada pendente"
              : `${totalAberto} ${totalAberto === 1 ? "pendência" : "pendências"}`}
          </Badge>
        }
      />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-slate-800">
              {pendencias.tarefasAbertas}
            </p>
            <p className="text-xs text-slate-500">Etapas em aberto</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-slate-800">
              {pendencias.docsAbertos}
            </p>
            <p className="text-xs text-slate-500">Documentos pendentes</p>
          </div>
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2 text-center">
            <p className="text-lg font-semibold text-slate-800">
              {pendencias.colabsComPendencia}
            </p>
            <p className="text-xs text-slate-500">Colaboradores</p>
          </div>
        </div>

        {comPendencia.length > 0 ? (
          <div>
            <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
              Pendências por colaborador (clique para focar)
            </p>
            <div className="flex flex-wrap gap-2">
              {comPendencia.map((g) => (
                <button
                  key={g.colaboradorId}
                  type="button"
                  onClick={() => onFocar(g.colaboradorId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100"
                >
                  {g.nome}
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-semibold text-white">
                    {g.abertas}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">
            Todos os onboardings estão com etapas e documentos em dia.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

// ---------- Card de checklist de um colaborador ----------
function CardChecklist({
  colaboradorId,
  tipo,
  jornada,
  docs,
  onAlternar,
}: {
  colaboradorId: string;
  tipo: TipoChecklist;
  jornada: Tarefa[];
  docs: Tarefa[];
  onAlternar: (t: Tarefa, valor: boolean) => void;
}) {
  const sessao = useSessao();
  const d = useDominio();
  const toast = useToast();
  const { criar, atualizar: atualizarTarefa, remover: removerTarefa } = useColecao("tarefas");
  // Renomear e excluir item: dava para adicionar e marcar, e mais nada. Tirar
  // um item que não se aplica (EPI para quem é do administrativo, "Foto 3x4"
  // de quem já entregou) ou corrigir um texto digitado errado era impossível —
  // inclusive nos 7 documentos que o modelo cria sozinho.
  const [renomeando, setRenomeando] = useState<{ id: string; texto: string } | null>(null);
  const [excluindoItem, setExcluindoItem] = useState<Tarefa | null>(null);
  const salvarRenome = () => {
    if (!renomeando) return;
    const texto = renomeando.texto.trim();
    if (!texto) { toast("O item não pode ficar sem nome.", "erro"); return; }
    atualizarTarefa(renomeando.id, { titulo: texto });
    setRenomeando(null);
  };
  const AcoesItem = ({ t: item }: { t: Tarefa }) => (
    gere ? (
      <span className="flex shrink-0 items-center">
        <button type="button" className="btn-ghost p-1 text-slate-300 hover:text-brand" title="Renomear item" aria-label="Renomear item"
          onClick={() => setRenomeando({ id: item.id, texto: item.titulo })}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        {/* PERGUNTA ANTES DE APAGAR. Este botão fica a 4px do Toggle, que é o
            controle clicado dezenas de vezes por cartão — e a ação era
            irreversível e sem aviso. Um erro de mira não "deixava de marcar":
            apagava a linha, e o item sumia bem no instante em que a pessoa
            tentou marcá-lo. */}
        <button type="button" className="btn-ghost p-1 text-slate-300 hover:text-red-600"
          title="Remover item do checklist" aria-label={`Remover o item ${item.titulo}`}
          onClick={() => setExcluindoItem(item)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    ) : null
  );
  const { atualizar: atualizarColab } = useColecao("colaboradores");
  const gere = podeGerir(sessao);

  const [novoItem, setNovoItem] = useState("");

  const colab = d.colabById.get(colaboradorId);

  const [confirmandoArquivo, setConfirmandoArquivo] = useState(false);

  /* O FIM DO ONBOARDING É O FIM DA EXPERIÊNCIA — é esse o marco, não "marquei
     todos os itens". Por isso o cartão mostra o relógio dos 90 dias e o botão
     de arquivar fica em destaque quando ele vira. */
  const experiencia = colab ? fimDaExperiencia(colab) : null;
  const campoArquivo = tipo === "Admissão" ? "onboardingArquivadoEm" : "offboardingArquivadoEm";
  const arquivado = !!colab?.[campoArquivo];

  const arquivar = () => {
    atualizarColab(colaboradorId, { [campoArquivo]: new Date().toISOString() });
    setConfirmandoArquivo(false);
    toast(`${colab?.nome ?? "Colaborador"} arquivado. Nada foi apagado — dá para trazer de volta.`);
  };
  const desarquivar = () => {
    atualizarColab(colaboradorId, { [campoArquivo]: null });
    toast(`${colab?.nome ?? "Colaborador"} de volta à lista.`);
  };
  // Progresso considera a jornada + documentos como etapas da integração.
  const itens = useMemo(() => [...jornada, ...docs], [jornada, docs]);
  const total = itens.length;
  const feitas = itens.filter((t) => t.concluida).length;
  const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

  // Etapas da jornada concluídas (para a linha do tempo e o rótulo).
  const etapasFeitas = jornada.filter((t) => t.concluida).length;
  const etapasTotal = jornada.length;
  const docsAbertos = docs.filter((t) => !t.concluida).length;

  // Gamificação: nível atual e próximo passo sugerido (etapa ou documento).
  const nivel = nivelJornada(pct);
  const proximaEtapa = jornada.find((t) => !t.concluida);
  const proximoDoc = docs.find((t) => !t.concluida);
  const proximoPasso = proximaEtapa?.titulo ?? (proximoDoc ? `Entregar documento — ${rotuloDoc(proximoDoc)}` : null);

  // A documentação de RH padrão é semeada no nível da página (Integracao),
  // independentemente de qual aba está ativa — ver o efeito de seed lá.

  // Candidatos a padrinho: colaboradores ativos, exceto o próprio.
  const candidatosPadrinho = useMemo(
    () =>
      d.ativos
        .filter((c) => c.id !== colaboradorId)
        .sort((a, b) => a.nome.localeCompare(b.nome)),
    [d.ativos, colaboradorId],
  );

  const definirPadrinho = (valor: string) => {
    const padrinhoId = valor || null;
    atualizarColab(colaboradorId, { padrinhoId });
    // Nice touch: ao designar um padrinho, conclui a tarefa correspondente.
    if (padrinhoId) {
      const tarefaPadrinho = itens.find((t) =>
        t.titulo.toLowerCase().includes("padrinho"),
      );
      if (tarefaPadrinho && !tarefaPadrinho.concluida) {
        atualizarTarefa(tarefaPadrinho.id, {
          concluida: true,
          concluidaEm: HOJE.toISOString(),
        });
      }
    }
    toast(
      padrinhoId
        ? `Padrinho de ${colab?.nome ?? "colaborador"}: ${d.nomeColab(padrinhoId)}.`
        : "Padrinho removido.",
    );
  };

  const adicionarItem = () => {
    const titulo = novoItem.trim();
    if (!titulo) return;
    const proximaOrdem =
      itens.reduce((max, t) => Math.max(max, t.ordem), -1) + 1;
    criar({
      colaboradorId,
      tipo,
      titulo,
      responsavel: "RH",
      concluida: false,
      concluidaEm: null,
      ordem: proximaOrdem,
    });
    setNovoItem("");
  };

  return (
    <Card>
      <CardHeader
        title={
          <div className="flex items-center gap-3">
            <Avatar nome={colab?.nome ?? "—"} foto={colab?.fotoDataUrl} size="sm" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {colab?.nome ?? "Colaborador"}
              </p>
              <p className="truncate text-xs font-normal text-slate-500">
                {colab ? d.nomeCargo(colab) : "—"}
              </p>
            </div>
          </div>
        }
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant={variantePorcentagem(pct)}>
              {feitas}/{total} · {pct}%
            </Badge>
            {gere && (
              <button
                type="button"
                className="btn-ghost p-1.5 text-slate-300 hover:text-brand"
                title={arquivado ? "Trazer de volta para a lista" : "Arquivar — tira da tela sem apagar nada"}
                aria-label={arquivado ? `Desarquivar ${colab?.nome ?? "colaborador"}` : `Arquivar ${colab?.nome ?? "colaborador"}`}
                onClick={() => (arquivado ? desarquivar() : setConfirmandoArquivo(true))}
              >
                {arquivado ? <PackageOpen className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
              </button>
            )}
          </div>
        }
      />
      <CardBody className="space-y-3">
        {/* Progresso da jornada — barra de % + rótulo de etapas */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              {tipo === "Admissão" ? "Jornada do onboarding" : "Progresso do offboarding"}
              {tipo === "Admissão" && (
                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold normal-case tracking-normal ${nivel.classe}`}>
                  <Sparkles className="h-3 w-3" /> {nivel.rotulo}
                </span>
              )}
            </span>
            <span className="text-xs font-semibold text-slate-600">
              {etapasFeitas} de {etapasTotal} etapas · {pct}%
            </span>
          </div>
          <Progress value={pct} cor={pct >= 100 ? "#16a34a" : undefined} />
          {docs.length > 0 && (
            <p className="text-[11px] text-slate-400">
              Inclui {docs.length} documentos de RH
              {docsAbertos > 0 ? ` · ${docsAbertos} em aberto` : " · todos entregues"}.
            </p>
          )}

          {/* O RELÓGIO QUE ENCERRA A INTEGRAÇÃO. O onboarding não acaba na
              última caixinha marcada: acaba quando termina a experiência da
              pessoa. Por isso o prazo dos 90 dias fica aqui, e é quando ele
              vira que faz sentido arquivar o cartão. */}
          {tipo === "Admissão" && experiencia?.fim && !arquivado && (
            <p
              className={`flex items-center gap-1.5 text-[11px] ${
                experiencia.encerrada ? "font-medium text-emerald-700" : "text-slate-400"
              }`}
            >
              <GraduationCap className="h-3 w-3 shrink-0" />
              {experiencia.encerrada ? (
                <>
                  Experiência encerrada em {formatDate(experiencia.fim)} — a integração acabou.
                  {gere && (
                    <button
                      type="button"
                      className="font-semibold text-brand hover:underline"
                      onClick={() => setConfirmandoArquivo(true)}
                    >
                      Arquivar
                    </button>
                  )}
                </>
              ) : (
                <>
                  Experiência até {formatDate(experiencia.fim)}
                  {Number.isFinite(experiencia.diasParaFim) && ` · faltam ${experiencia.diasParaFim} dias`}
                  {experiencia.decidida && " (já decidida)"}
                </>
              )}
            </p>
          )}
        </div>

        {/* Gamificação: celebração ao concluir ou próximo passo sugerido */}
        {tipo === "Admissão" && (pct >= 100 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
            <Trophy className="h-4 w-4 shrink-0" /> Jornada concluída — boas-vindas oficiais! 🎉
          </div>
        ) : proximoPasso ? (
          <div className="flex items-start gap-2 rounded-lg border border-brand-100 bg-brand-50/50 px-3 py-2 text-sm text-slate-700">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <span><span className="font-semibold text-brand-ink">Próximo passo:</span> {proximoPasso}</span>
          </div>
        ) : null)}

        {/* Linha do tempo / stepper das etapas da jornada */}
        {tipo === "Admissão" && jornada.length > 0 && (
          <ol className="flex flex-col gap-1.5">
            {jornada.map((t) => (
              <li key={t.id} className="flex items-center gap-2">
                {t.concluida ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-amber-500" />
                )}
                <span
                  className={
                    t.concluida
                      ? "text-xs text-slate-400 line-through"
                      : "rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700"
                  }
                >
                  {t.titulo}
                </span>
              </li>
            ))}
          </ol>
        )}

        {tipo === "Admissão" && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <HeartHandshake className="h-4 w-4 text-brand" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Padrinho (mentor)
                </span>
              </div>
              {colab?.padrinhoId ? (
                <div className="flex items-center gap-2">
                  <Avatar nome={d.nomeColab(colab.padrinhoId)} foto={d.fotoColab(colab.padrinhoId)} size="sm" />
                  <span className="text-sm font-medium text-slate-700">
                    {d.nomeColab(colab.padrinhoId)}
                  </span>
                </div>
              ) : (
                <Badge variant="warning">Padrinho não designado</Badge>
              )}
            </div>
            {gere && (
              <div className="mt-2">
                <Select
                  value={colab?.padrinhoId ?? ""}
                  onChange={(e) => definirPadrinho(e.target.value)}
                  className="h-9 py-1.5 text-sm"
                  aria-label="Designar padrinho"
                >
                  <option value="">— designar padrinho —</option>
                  {candidatosPadrinho.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} · {d.nomeCargo(c)}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </div>
        )}

        {tipo === "Admissão" && (
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Etapas da jornada
          </p>
        )}
        <ul className="space-y-1.5">
          {jornada.map((t) => (
            <li
              key={t.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 px-3 py-2"
            >
              <div className="min-w-0">
                {renomeando?.id === t.id ? (
                  <Input
                    autoFocus
                    value={renomeando.texto}
                    onChange={(e) => setRenomeando({ id: t.id, texto: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") salvarRenome(); if (e.key === "Escape") setRenomeando(null); }}
                    onBlur={salvarRenome}
                    className="h-8 py-0 text-sm"
                  />
                ) : (
                  <p
                    className={
                      t.concluida
                        ? "text-sm text-slate-400 line-through"
                        : "text-sm font-medium text-slate-700"
                    }
                  >
                    {t.titulo}
                  </p>
                )}
                <p className="text-xs text-slate-400">
                  {t.responsavel ?? "RH"}
                  {t.concluida && t.concluidaEm
                    ? ` · Concluído em ${formatDate(t.concluidaEm)}`
                    : ""}
                </p>
              </div>
              <div className="mt-0.5 flex shrink-0 items-center gap-1">
                <AcoesItem t={t} />
                <Toggle
                  checked={t.concluida}
                  onChange={(v) => onAlternar(t, v)}
                />
              </div>
            </li>
          ))}
        </ul>

        {/* Sub-seção: Documentação de RH (item 15 v3) */}
        {tipo === "Admissão" && docs.length > 0 && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <FolderCheck className="h-4 w-4 text-brand" />
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Documentação de RH
                </span>
              </div>
              <Badge variant={docsAbertos === 0 ? "success" : "warning"}>
                {docs.length - docsAbertos}/{docs.length}
                {docsAbertos > 0 ? ` · ${docsAbertos} em aberto` : " · completo"}
              </Badge>
            </div>
            <ul className="space-y-1.5">
              {docs.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-white px-3 py-1.5"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                    {/* O lápis desta linha era um botão MORTO: ele guardava o
                        item em `renomeando`, mas o campo de edição só existia na
                        lista de jornada — clicar aqui não fazia nada. */}
                    {renomeando?.id === t.id ? (
                      <input
                        className="input h-7 min-w-0 flex-1 py-0 text-sm"
                        autoFocus
                        value={renomeando.texto}
                        onChange={(e) => setRenomeando({ id: t.id, texto: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") salvarRenome();
                          if (e.key === "Escape") setRenomeando(null);
                        }}
                        onBlur={salvarRenome}
                        aria-label={`Novo nome do documento ${rotuloDoc(t)}`}
                      />
                    ) : (
                    <span
                      className={
                        t.concluida
                          ? "truncate text-sm text-slate-400 line-through"
                          : "truncate text-sm font-medium text-slate-700"
                      }
                    >
                      {rotuloDoc(t)}
                    </span>
                    )}
                    {!t.concluida && !renomeando && (
                      <Badge variant="warning" className="shrink-0">
                        Em aberto
                      </Badge>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <AcoesItem t={t} />
                    <Toggle
                      checked={t.concluida}
                      onChange={(v) => onAlternar(t, v)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {gere && (
          <div className="flex items-center gap-2 pt-1">
            <Input
              value={novoItem}
              onChange={(e) => setNovoItem(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  adicionarItem();
                }
              }}
              placeholder="Adicionar item…"
              className="h-9 flex-1 py-1.5 text-sm"
            />
            <button
              type="button"
              className="btn-outline px-3"
              onClick={adicionarItem}
              disabled={!novoItem.trim()}
              aria-label="Adicionar item"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
        )}
      </CardBody>

      {/* O marco que ENCERRA o onboarding é o fim da experiência, não a última
          caixinha marcada. Por isso o prazo dos 90 dias fica no cartão: é ele
          que diz quando a integração da pessoa acabou de verdade. */}
      <ConfirmDialog
        aberto={confirmandoArquivo}
        onFechar={() => setConfirmandoArquivo(false)}
        onConfirmar={arquivar}
        titulo="Arquivar a integração"
        mensagem={
          <>
            Tirar <span className="font-medium text-slate-700">{colab?.nome ?? "esta pessoa"}</span> da
            tela de Integração? Nada é apagado — o checklist inteiro continua guardado e dá para trazer
            de volta a qualquer momento.
            {experiencia?.fim && !experiencia.encerrada && (
              <>
                {" "}
                <span className="font-medium text-amber-700">
                  A experiência dela só termina em {formatDate(experiencia.fim)}
                  {Number.isFinite(experiencia.diasParaFim) && ` (faltam ${experiencia.diasParaFim} dias)`}.
                </span>
              </>
            )}
            {total - feitas > 0 && (
              <>
                {" "}
                <span className="font-medium text-amber-700">
                  Ainda {total - feitas === 1 ? "há 1 item" : `há ${total - feitas} itens`} em aberto —
                  arquivar não conclui {total - feitas === 1 ? "ele" : "eles"}.
                </span>
              </>
            )}
          </>
        }
      />

      <ConfirmDialog
        aberto={!!excluindoItem}
        onFechar={() => setExcluindoItem(null)}
        onConfirmar={() => {
          if (!excluindoItem) return;
          removerTarefa(excluindoItem.id);
          toast("Item removido do checklist.");
          setExcluindoItem(null);
        }}
        titulo="Remover item do checklist"
        mensagem={
          excluindoItem ? (
            <>
              Remover{" "}
              <span className="font-medium text-slate-700">
                {ehDoc(excluindoItem) ? rotuloDoc(excluindoItem) : excluindoItem.titulo}
              </span>{" "}
              do checklist de {colab?.nome ?? "colaborador"}?
              {excluindoItem.concluida && " Ele já está marcado como feito — a marcação some junto."}
              {" "}Esta ação não pode ser desfeita.
            </>
          ) : (
            ""
          )
        }
      />
    </Card>
  );
}

// ---------- Modal: iniciar checklist a partir de um modelo ----------
function IniciarChecklistModal({
  aberto,
  onFechar,
  escopo,
  tarefas,
  modelos,
  criar,
  onConcluido,
}: {
  aberto: boolean;
  onFechar: () => void;
  escopo: ReturnType<typeof useDominio>["colaboradores"];
  tarefas: Tarefa[];
  modelos: { id: string; tipo: string; itens: { titulo: string; responsavel: string }[] }[];
  criar: (item: Partial<Tarefa> & Record<string, unknown>) => Tarefa;
  onConcluido: (qtd: number, nome: string) => void;
}) {
  const d = useDominio();
  const toast = useToast();
  const [colaboradorId, setColaboradorId] = useState("");
  const [tipo, setTipo] = useState<TipoChecklist>("Admissão");

  const candidatos = useMemo(
    () => [...escopo].sort((a, b) => a.nome.localeCompare(b.nome)),
    [escopo],
  );

  const jaExiste = useMemo(
    () =>
      colaboradorId
        ? tarefas.some(
            (t) => t.colaboradorId === colaboradorId && t.tipo === tipo,
          )
        : false,
    [tarefas, colaboradorId, tipo],
  );

  const modelo = useMemo(
    () => modelos.find((m) => m.tipo === tipo),
    [modelos, tipo],
  );

  const criarTarefas = () => {
    if (!colaboradorId) {
      toast("Selecione um colaborador.", "erro");
      return;
    }
    if (!modelo || modelo.itens.length === 0) {
      toast("Nenhum modelo disponível para este tipo.", "erro");
      return;
    }
    modelo.itens.forEach((item, i) => {
      criar({
        colaboradorId,
        tipo,
        titulo: item.titulo,
        responsavel: item.responsavel,
        concluida: false,
        concluidaEm: null,
        ordem: i,
      });
    });
    const nome = d.nomeColab(colaboradorId);
    onConcluido(modelo.itens.length, nome);
  };

  return (
    <Modal
      aberto={aberto}
      onFechar={onFechar}
      titulo="Iniciar checklist"
      descricao="Cria as tarefas a partir do modelo correspondente."
      rodape={
        <>
          <button className="btn-outline" onClick={onFechar}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={criarTarefas}
            disabled={!colaboradorId || !modelo}
          >
            Criar {modelo ? `${modelo.itens.length} itens` : "checklist"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Campo label="Tipo de checklist" obrigatorio>
          <Select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoChecklist)}
          >
            <option value="Admissão">Onboarding (Admissão)</option>
            <option value="Desligamento">Offboarding (Desligamento)</option>
          </Select>
        </Campo>

        <Campo label="Colaborador" obrigatorio>
          <Select
            value={colaboradorId}
            onChange={(e) => setColaboradorId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {candidatos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome} · {d.nomeCargo(c)}
              </option>
            ))}
          </Select>
        </Campo>

        {jaExiste && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Já existe um checklist de {tipo.toLowerCase()} para este colaborador.
            Os novos itens serão adicionados aos existentes.
          </div>
        )}

        {modelo && (
          <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2">
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
              Itens do modelo ({modelo.itens.length})
            </p>
            <ul className="space-y-0.5">
              {modelo.itens.map((item, i) => (
                <li key={i} className="text-xs text-slate-600">
                  • {item.titulo}{" "}
                  <span className="text-slate-400">— {item.responsavel}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
