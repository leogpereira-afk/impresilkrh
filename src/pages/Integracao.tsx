import { useEffect, useMemo, useRef, useState } from "react";
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
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Campo, Input, Select, Toggle } from "@/components/ui/form";
import { Avatar, Progress, EmptyState } from "@/components/ui/misc";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useDrill, DrillModal } from "@/components/ui/drilldown";
import { BarrasColoridas } from "@/components/charts/charts";
import { useColecao } from "@/lib/store";
import { useDominio } from "@/lib/dominio";
import { useSessao } from "@/lib/session";
import { colaboradoresVisiveis, podeGerir } from "@/lib/rbac";
import { formatDate } from "@/lib/format";
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
  const { items: modelos } = useColecao("modelosChecklist");

  const gere = podeGerir(sessao);
  const [iniciar, setIniciar] = useState(false);

  // Inativos não entram em estatística/jornada/drill (alinhado aos demais módulos).
  const escopo = useMemo(
    () => colaboradoresVisiveis(sessao, d.colaboradores).filter((c) => c.statusId !== "inativo"),
    [sessao, d.colaboradores],
  );
  const idsEscopo = useMemo(() => new Set(escopo.map((c) => c.id)), [escopo]);

  const tarefasEscopo = useMemo(
    () => tarefas.filter((t) => idsEscopo.has(t.colaboradorId)),
    [tarefas, idsEscopo],
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
  }, [tarefasEscopo]);

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
      if (g.temDoc) continue; // já semeado
      const baseOrdem = g.maxOrdem + 1;
      DOCS_RH_PADRAO.forEach((nome, i) => {
        criar({
          colaboradorId,
          tipo: "Admissão",
          titulo: `${PREFIXO_DOC}${nome}`,
          responsavel: "RH",
          concluida: false,
          concluidaEm: null,
          ordem: baseOrdem + i,
        });
      });
    }
  }, [tarefas, idsEscopo, criar]);

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              "Onboardings em andamento",
              colabsDe(resumo.idsAndamento),
              "Admissões com itens pendentes",
            )
          }
        >
          <StatCard
            label="Onboardings em andamento"
            value={resumo.onAndamento}
            icon={<ClipboardList className="h-5 w-5" />}
            accent="brand"
            hint="Admissões com itens pendentes"
          />
        </button>
        <button
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              "Onboardings concluídos",
              colabsDe(resumo.idsConcluidos),
              "Admissões com checklist 100% concluído",
            )
          }
        >
          <StatCard
            label="Onboardings concluídos"
            value={resumo.onConcluidos}
            icon={<CheckCircle2 className="h-5 w-5" />}
            accent="green"
          />
        </button>
        <button
          className="text-left w-full"
          onClick={() =>
            drill.abrir(
              "Offboardings",
              colabsDe(resumo.idsOff),
              "Colaboradores em processo de desligamento",
            )
          }
        >
          <StatCard
            label="Offboardings"
            value={resumo.offTotal}
            icon={<UserMinus className="h-5 w-5" />}
            accent="amber"
          />
        </button>
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
                  tipo="Desligamento"
                  tarefas={tarefasEscopo}
                  escopoIds={idsEscopo}
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
}: {
  tipo: TipoChecklist;
  tarefas: Tarefa[];
  escopoIds: Set<string>;
  onAlternar: (t: Tarefa, valor: boolean) => void;
}) {
  const d = useDominio();
  const [focoId, setFocoId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLDivElement | null>());

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
      .filter((g) => escopoIds.has(g.colaboradorId))
      .sort((a, b) => {
        // Mais pendências primeiro; depois por nome.
        if (b.abertas !== a.abertas) return b.abertas - a.abertas;
        const na = d.nomeColab(a.colaboradorId);
        const nb = d.nomeColab(b.colaboradorId);
        return na.localeCompare(nb);
      });
  }, [tarefas, tipo, escopoIds, d]);

  // Resumo agregado de pendências (item 3 — "tudo em aberto").
  const pendencias = useMemo(() => {
    let tarefasAbertas = 0;
    let docsAbertos = 0;
    for (const g of grupos) {
      tarefasAbertas += g.jornada.filter((t) => !t.concluida).length;
      docsAbertos += g.docs.filter((t) => !t.concluida).length;
    }
    const colabsComPendencia = grupos.filter((g) => g.abertas > 0).length;
    return { tarefasAbertas, docsAbertos, colabsComPendencia };
  }, [grupos]);

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
        description="Use “Iniciar checklist” para criar um novo a partir de um modelo."
        icon={<ClipboardList className="h-8 w-8" />}
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

      <div className="grid gap-4 lg:grid-cols-2">
        {grupos.map((g) => (
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
  const { criar, atualizar: atualizarTarefa } = useColecao("tarefas");
  const { atualizar: atualizarColab } = useColecao("colaboradores");
  const gere = podeGerir(sessao);

  const [novoItem, setNovoItem] = useState("");

  const colab = d.colabById.get(colaboradorId);
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
            <Avatar nome={colab?.nome ?? "—"} size="sm" />
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
          <Badge variant={variantePorcentagem(pct)}>
            {feitas}/{total} · {pct}%
          </Badge>
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
                  <Avatar nome={d.nomeColab(colab.padrinhoId)} size="sm" />
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
                <p
                  className={
                    t.concluida
                      ? "text-sm text-slate-400 line-through"
                      : "text-sm font-medium text-slate-700"
                  }
                >
                  {t.titulo}
                </p>
                <p className="text-xs text-slate-400">
                  {t.responsavel ?? "RH"}
                  {t.concluida && t.concluidaEm
                    ? ` · Concluído em ${formatDate(t.concluidaEm)}`
                    : ""}
                </p>
              </div>
              <div className="mt-0.5 shrink-0">
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
                    <span
                      className={
                        t.concluida
                          ? "truncate text-sm text-slate-400 line-through"
                          : "truncate text-sm font-medium text-slate-700"
                      }
                    >
                      {rotuloDoc(t)}
                    </span>
                    {!t.concluida && (
                      <Badge variant="warning" className="shrink-0">
                        Em aberto
                      </Badge>
                    )}
                  </div>
                  <div className="shrink-0">
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
