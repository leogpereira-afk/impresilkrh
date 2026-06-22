import { db } from "./db";
import { PERFIS, JANELA_ALERTA_DIAS } from "./constants";
import { idsDaEquipe } from "./rbac";
import type { SessionPayload } from "./session";

// Retorna os IDs de colaboradores no escopo da sessão, ou null quando é acesso total (RH).
export async function escopoColaboradorIds(
  sessao: SessionPayload,
): Promise<string[] | null> {
  if (sessao.perfil === PERFIS.ADMIN_RH) return null;
  if (sessao.perfil === PERFIS.GESTOR && sessao.colaboradorId) {
    return idsDaEquipe(sessao.colaboradorId);
  }
  return [sessao.colaboradorId ?? "__sem_acesso__"];
}

function inicioDoAno12Meses() {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d;
}

export interface DashboardData {
  totalAtivos: number;
  admissoesPeriodo: number;
  desligamentosPeriodo: number;
  turnover: number;
  documentosAVencer: number;
  documentosVencidos: number;
  avaliacoesPendentes: number;
  feriasEmAberto: number;
  aniversariantesMes: { id: string; nome: string; dia: number; cargo: string | null }[];
  porArea: { nome: string; valor: number }[];
  porNivel: { nome: string; valor: number }[];
  porStatusSalarial: { nome: string; valor: number; cor: string }[];
  elegiveisPromocao: number;
  riscoAlto: number;
  mediaSalarial: number;
  alertas: {
    tipo: string;
    titulo: string;
    detalhe: string;
    severidade: "danger" | "warning" | "info";
  }[];
}

export async function dashboardGeral(sessao: SessionPayload): Promise<DashboardData> {
  const ids = await escopoColaboradorIds(sessao);
  const filtroId = ids ? { id: { in: ids } } : {};
  const filtroColabId = ids ? { colaboradorId: { in: ids } } : {};

  const colaboradores = await db.colaborador.findMany({
    where: filtroId,
    include: { status: true, area: true, cargo: true, nivel: true },
  });

  const ativos = colaboradores.filter(
    (c) => c.status?.contaComoAtivo && !c.dataDesligamento,
  );
  const limite = inicioDoAno12Meses();

  const admissoesPeriodo = colaboradores.filter(
    (c) => c.dataAdmissao && c.dataAdmissao >= limite,
  ).length;
  const desligamentosPeriodo = colaboradores.filter(
    (c) => c.dataDesligamento && c.dataDesligamento >= limite,
  ).length;
  const turnover =
    ativos.length > 0
      ? +((desligamentosPeriodo / ((ativos.length + desligamentosPeriodo) || 1)) * 100).toFixed(1)
      : 0;

  // Documentos a vencer / vencidos
  const hoje = new Date();
  const janela = new Date();
  janela.setDate(janela.getDate() + JANELA_ALERTA_DIAS);
  const docsComVenc = await db.documento.findMany({
    where: { ...filtroColabId, dataVencimento: { not: null } },
    include: { colaborador: { select: { nome: true } } },
  });
  const documentosVencidos = docsComVenc.filter(
    (d) => d.dataVencimento! < hoje,
  ).length;
  const documentosAVencer = docsComVenc.filter(
    (d) => d.dataVencimento! >= hoje && d.dataVencimento! <= janela,
  ).length;

  // Avaliações pendentes (autoavaliação não realizada no ciclo aberto)
  const cicloAberto = await db.cicloAvaliacao.findFirst({
    where: { status: "Aberto" },
    orderBy: { dataInicio: "desc" },
  });
  let avaliacoesPendentes = 0;
  if (cicloAberto) {
    const comAuto = await db.avaliacao.findMany({
      where: { cicloId: cicloAberto.id, tipo: "AUTO", ...filtroColabId },
      select: { colaboradorId: true },
    });
    const setAuto = new Set(comAuto.map((a) => a.colaboradorId));
    avaliacoesPendentes = ativos.filter((c) => !setAuto.has(c.id)).length;
  }

  const feriasEmAberto = await db.ferias.count({
    where: { ...filtroColabId, status: "Em aberto" },
  });

  // Aniversariantes do mês
  const mesAtual = hoje.getMonth();
  const aniversariantesMes = ativos
    .filter((c) => c.dataNascimento && c.dataNascimento.getMonth() === mesAtual)
    .map((c) => ({
      id: c.id,
      nome: c.nome,
      dia: c.dataNascimento!.getDate(),
      cargo: c.cargo?.nome ?? null,
    }))
    .sort((a, b) => a.dia - b.dia);

  // Distribuições
  const areasMap = new Map<string, number>();
  for (const c of ativos) {
    const a = c.area?.nome ?? "Sem área";
    areasMap.set(a, (areasMap.get(a) ?? 0) + 1);
  }
  const porArea = [...areasMap.entries()]
    .map(([nome, valor]) => ({ nome: encurtarArea(nome), valor }))
    .sort((a, b) => b.valor - a.valor);

  const niveisMap = new Map<string, number>();
  for (const c of ativos) {
    const n = c.nivel?.codigo ?? "—";
    niveisMap.set(n, (niveisMap.get(n) ?? 0) + 1);
  }
  const porNivel = ["N1", "N2", "N3", "N4", "N5"].map((n) => ({
    nome: n,
    valor: niveisMap.get(n) ?? 0,
  }));

  const corStatus: Record<string, string> = {
    Crítico: "#dc2626",
    Abaixo: "#d97706",
    Dentro: "#16a34a",
    Acima: "#2563eb",
  };
  const statusMap = new Map<string, number>();
  for (const c of ativos) {
    const s = c.posicaoFaixa ?? "—";
    statusMap.set(s, (statusMap.get(s) ?? 0) + 1);
  }
  const porStatusSalarial = ["Crítico", "Abaixo", "Dentro", "Acima"]
    .filter((s) => statusMap.has(s))
    .map((s) => ({ nome: s, valor: statusMap.get(s) ?? 0, cor: corStatus[s] }));

  const elegiveisPromocao = cicloAberto
    ? await db.avaliacao.count({
        where: {
          cicloId: cicloAberto.id,
          tipo: "GESTOR",
          elegivelPromocao: true,
          ...filtroColabId,
        },
      })
    : 0;

  const riscoAlto = ativos.filter((c) => c.riscoSaida === "Alto").length;
  const salarios = ativos.map((c) => c.salario ?? 0).filter((s) => s > 0);
  const mediaSalarial =
    salarios.length > 0
      ? salarios.reduce((a, b) => a + b, 0) / salarios.length
      : 0;

  // Alertas
  const alertas: DashboardData["alertas"] = [];
  for (const d of docsComVenc) {
    if (d.dataVencimento! < hoje) {
      alertas.push({
        tipo: d.categoria,
        titulo: `${d.categoria} vencido — ${d.colaborador.nome}`,
        detalhe: `Venceu em ${d.dataVencimento!.toLocaleDateString("pt-BR")}`,
        severidade: "danger",
      });
    } else if (d.dataVencimento! <= janela) {
      alertas.push({
        tipo: d.categoria,
        titulo: `${d.categoria} a vencer — ${d.colaborador.nome}`,
        detalhe: `Vence em ${d.dataVencimento!.toLocaleDateString("pt-BR")}`,
        severidade: "warning",
      });
    }
  }
  // Retornos de férias próximos
  const feriasProximas = await db.ferias.findMany({
    where: { ...filtroColabId, status: { in: ["Agendada", "Em andamento"] } },
    include: { colaborador: { select: { nome: true } } },
  });
  for (const f of feriasProximas) {
    if (f.dataRetorno && f.dataRetorno >= hoje && f.dataRetorno <= janela) {
      alertas.push({
        tipo: "Férias",
        titulo: `Retorno de férias — ${f.colaborador.nome}`,
        detalhe: `Retorna em ${f.dataRetorno.toLocaleDateString("pt-BR")}`,
        severidade: "info",
      });
    }
  }
  alertas.sort((a, b) => {
    const ordem = { danger: 0, warning: 1, info: 2 };
    return ordem[a.severidade] - ordem[b.severidade];
  });

  return {
    totalAtivos: ativos.length,
    admissoesPeriodo,
    desligamentosPeriodo,
    turnover,
    documentosAVencer,
    documentosVencidos,
    avaliacoesPendentes,
    feriasEmAberto,
    aniversariantesMes,
    porArea,
    porNivel,
    porStatusSalarial,
    elegiveisPromocao,
    riscoAlto,
    mediaSalarial,
    alertas: alertas.slice(0, 8),
  };
}

function encurtarArea(nome: string): string {
  return nome
    .replace("Produção e Comunicação Visual", "Produção")
    .replace("Montagem e Instalação", "Montagem")
    .replace("Serralheria e Metalurgia", "Serralheria")
    .replace("Comercial e Atendimento", "Comercial")
    .replace("Administrativo e Gestão", "Administrativo");
}
