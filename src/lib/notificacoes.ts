import { db } from "./db";
import { PERFIS, JANELA_ALERTA_DIAS } from "./constants";
import { escopoColaboradorIds } from "./queries";
import type { SessionPayload } from "./session";

interface ItemNotificacao {
  chave: string;
  tipo: string;
  severidade: "info" | "warning" | "danger";
  titulo: string;
  mensagem?: string | null;
  link?: string | null;
}

export async function contarNaoLidas(usuarioId: string): Promise<number> {
  return db.notificacao.count({ where: { usuarioId, lida: false } });
}

export async function listarNotificacoes(usuarioId: string) {
  return db.notificacao.findMany({
    where: { usuarioId },
    orderBy: [{ lida: "asc" }, { criadoEm: "desc" }],
    take: 100,
  });
}

// Recalcula as notificações do usuário a partir do estado atual do sistema.
// Idempotente: usa `chave` para deduplicar e remove o que não se aplica mais.
export async function sincronizarNotificacoes(sessao: SessionPayload): Promise<void> {
  const itens = await coletarItens(sessao);
  const usuarioId = sessao.sub;

  for (const i of itens) {
    await db.notificacao.upsert({
      where: { usuarioId_chave: { usuarioId, chave: i.chave } },
      create: {
        usuarioId,
        chave: i.chave,
        tipo: i.tipo,
        severidade: i.severidade,
        titulo: i.titulo,
        mensagem: i.mensagem ?? null,
        link: i.link ?? null,
      },
      update: {
        tipo: i.tipo,
        severidade: i.severidade,
        titulo: i.titulo,
        mensagem: i.mensagem ?? null,
        link: i.link ?? null,
      },
    });
  }

  // Remove notificações automáticas que não constam mais do conjunto atual.
  const chaves = itens.map((i) => i.chave);
  await db.notificacao.deleteMany({
    where: { usuarioId, chave: chaves.length ? { notIn: chaves } : undefined },
  });
}

async function coletarItens(sessao: SessionPayload): Promise<ItemNotificacao[]> {
  const itens: ItemNotificacao[] = [];
  const hoje = new Date();
  const janela = new Date();
  janela.setDate(janela.getDate() + JANELA_ALERTA_DIAS);

  // ---------------- Alertas pessoais (qualquer perfil com ficha) ----------------
  if (sessao.colaboradorId) {
    const meusDocs = await db.documento.findMany({
      where: { colaboradorId: sessao.colaboradorId, dataVencimento: { not: null, lte: janela } },
    });
    for (const d of meusDocs) {
      const venc = d.dataVencimento!;
      const vencido = venc < hoje;
      itens.push({
        chave: `meu-doc-${d.id}`,
        tipo: "Documento",
        severidade: vencido ? "danger" : "warning",
        titulo: vencido ? `Seu ${d.categoria} está vencido` : `Seu ${d.categoria} vence em breve`,
        mensagem: `${d.nome} — ${venc.toLocaleDateString("pt-BR")}`,
        link: "/meu-perfil",
      });
    }

    // Autoavaliação pendente no ciclo aberto
    const ciclo = await db.cicloAvaliacao.findFirst({ where: { status: "Aberto" } });
    if (ciclo) {
      const auto = await db.avaliacao.findFirst({
        where: { cicloId: ciclo.id, colaboradorId: sessao.colaboradorId, tipo: "AUTO" },
      });
      if (!auto) {
        itens.push({
          chave: `autoaval-${ciclo.id}`,
          tipo: "Avaliação",
          severidade: "info",
          titulo: "Autoavaliação pendente",
          mensagem: `Ciclo ${ciclo.nome} aberto para autoavaliação.`,
          link: "/desempenho",
        });
      }
    }
  }

  // ---------------- Alertas de gestão (RH e Gestor) ----------------
  if (sessao.perfil === PERFIS.ADMIN_RH || sessao.perfil === PERFIS.GESTOR) {
    const ids = await escopoColaboradorIds(sessao);
    const filtroColab = ids ? { colaboradorId: { in: ids } } : {};
    const escopoColab = ids ? { id: { in: ids } } : {};

    // Documentos vencidos / a vencer
    const docs = await db.documento.findMany({
      where: { ...filtroColab, dataVencimento: { not: null } },
    });
    const docsVencidos = docs.filter((d) => d.dataVencimento! < hoje).length;
    const docsAVencer = docs.filter((d) => d.dataVencimento! >= hoje && d.dataVencimento! <= janela).length;
    if (docsVencidos > 0) {
      itens.push({
        chave: "gestao-docs-vencidos",
        tipo: "Documento",
        severidade: "danger",
        titulo: `${docsVencidos} documento(s) vencido(s)`,
        mensagem: "Há documentos de colaboradores fora da validade.",
        link: "/sst",
      });
    }
    if (docsAVencer > 0) {
      itens.push({
        chave: "gestao-docs-avencer",
        tipo: "Documento",
        severidade: "warning",
        titulo: `${docsAVencer} documento(s) a vencer`,
        mensagem: `Vencimentos nos próximos ${JANELA_ALERTA_DIAS} dias.`,
        link: "/sst",
      });
    }

    // Avaliações pendentes no ciclo aberto
    const ciclo = await db.cicloAvaliacao.findFirst({ where: { status: "Aberto" } });
    if (ciclo) {
      const ativos = await db.colaborador.count({
        where: { ...escopoColab, dataDesligamento: null, status: { contaComoAtivo: true } },
      });
      const avaliados = await db.avaliacao.count({
        where: { cicloId: ciclo.id, tipo: "GESTOR", colaborador: escopoColab },
      });
      const pendentes = Math.max(0, ativos - avaliados);
      if (pendentes > 0) {
        itens.push({
          chave: `gestao-aval-${ciclo.id}`,
          tipo: "Avaliação",
          severidade: "info",
          titulo: `${pendentes} avaliação(ões) pendente(s)`,
          mensagem: `Ciclo ${ciclo.nome}.`,
          link: "/desempenho",
        });
      }
    }

    // Onboarding/offboarding em aberto
    const tarefasAbertas = await db.tarefa.findMany({
      where: { concluida: false, colaborador: escopoColab },
      select: { colaboradorId: true, tipo: true },
    });
    const checklistsAbertos = new Set(tarefasAbertas.map((t) => `${t.colaboradorId}|${t.tipo}`)).size;
    if (checklistsAbertos > 0) {
      itens.push({
        chave: "gestao-integracao",
        tipo: "Integração",
        severidade: "info",
        titulo: `${checklistsAbertos} checklist(s) de integração/desligamento em aberto`,
        mensagem: "Há etapas pendentes de conclusão.",
        link: "/integracao",
      });
    }
  }

  return itens;
}
