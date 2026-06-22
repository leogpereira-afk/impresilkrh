"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { podeAvaliar, podeVerColaborador } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";

function num(v: FormDataEntryValue | null): number | null {
  if (v == null || typeof v !== "string" || !v.trim()) return null;
  const n = parseFloat(v.replace(",", "."));
  return isNaN(n) ? null : Math.max(0, Math.min(100, n));
}

function inteiro(v: FormDataEntryValue | null): number | null {
  if (v == null || typeof v !== "string" || !v.trim()) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
}

function statusPorNota(nota: number): string {
  if (nota >= 80) return "Apto";
  if (nota >= 60) return "Em desenvolvimento";
  return "Não apto";
}

// Cria ou atualiza a avaliação de um colaborador no ciclo (tipo GESTOR).
export async function salvarAvaliacao(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return { erro: "Sem permissão para avaliar." };

  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const cicloId = String(formData.get("cicloId") ?? "");
  if (!colaboradorId || !cicloId) return { erro: "Selecione o colaborador e o ciclo." };
  if (!(await podeVerColaborador(sessao, colaboradorId))) {
    return { erro: "Colaborador fora do seu escopo." };
  }

  const ciclo = await db.cicloAvaliacao.findUnique({ where: { id: cicloId } });
  if (!ciclo) return { erro: "Ciclo não encontrado." };

  const notaTecnico = num(formData.get("notaTecnico"));
  const notaComportamental = num(formData.get("notaComportamental"));
  const notaResultado = num(formData.get("notaResultado"));
  if (notaTecnico == null || notaComportamental == null || notaResultado == null) {
    return { erro: "Preencha as três notas (0 a 100)." };
  }

  // Nota final ponderada pelos pesos do ciclo
  const notaFinal = +(
    notaTecnico * ciclo.pesoTecnico +
    notaComportamental * ciclo.pesoComportamental +
    notaResultado * ciclo.pesoResultado
  ).toFixed(1);

  const tempoNoNivelMeses = inteiro(formData.get("tempoNoNivelMeses"));
  const advertencia = formData.get("advertencia") === "on";
  const liderancaAprovou = formData.get("liderancaAprovou") === "on";

  // Regra de elegibilidade a promoção (Plano de Carreira)
  const elegivelPromocao =
    notaFinal >= ciclo.notaMinPromocao &&
    (tempoNoNivelMeses ?? 0) >= ciclo.mesesMinNivel &&
    liderancaAprovou &&
    !advertencia;

  const colaborador = await db.colaborador.findUnique({
    where: { id: colaboradorId },
    select: { proximoNivelSugerido: true },
  });

  const dados = {
    avaliadorId: sessao.colaboradorId ?? null,
    notaTecnico,
    notaComportamental,
    notaResultado,
    notaFinal,
    statusDesempenho: statusPorNota(notaFinal),
    tempoNoNivelMeses,
    advertencia,
    liderancaAprovou,
    elegivelPromocao,
    proximoNivel: elegivelPromocao ? colaborador?.proximoNivelSugerido ?? null : null,
    planoAcao: String(formData.get("planoAcao") ?? "") || null,
    comentarios: String(formData.get("comentarios") ?? "") || null,
    status: "Concluída",
  };

  const existente = await db.avaliacao.findFirst({
    where: { cicloId, colaboradorId, tipo: "GESTOR" },
  });

  if (existente) {
    await db.avaliacao.update({ where: { id: existente.id }, data: dados });
  } else {
    await db.avaliacao.create({
      data: { cicloId, colaboradorId, tipo: "GESTOR", ...dados },
    });
  }

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: existente ? "EDITAR_AVALIACAO" : "CRIAR_AVALIACAO",
    recurso: "Avaliacao",
    colaboradorId,
    detalhe: `${ciclo.nome} · nota ${notaFinal}`,
  });

  revalidatePath("/desempenho");
  return { ok: true };
}

// Registra um feedback contínuo para um colaborador.
export async function registrarFeedback(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!colaboradorId || !conteudo) return { erro: "Preencha o colaborador e o feedback." };
  if (!(await podeVerColaborador(sessao, colaboradorId))) {
    return { erro: "Colaborador fora do seu escopo." };
  }

  await db.feedback.create({
    data: {
      colaboradorId,
      autorId: sessao.colaboradorId ?? null,
      tipo: String(formData.get("tipo") ?? "Contínuo"),
      conteudo,
      contexto: String(formData.get("contexto") ?? "") || null,
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "REGISTRAR_FEEDBACK",
    recurso: "Feedback",
    colaboradorId,
  });

  revalidatePath("/desempenho");
  return { ok: true };
}
