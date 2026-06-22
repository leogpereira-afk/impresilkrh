"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { podeAvaliar, podeVerColaborador } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";
import { MODELO_ONBOARDING, MODELO_OFFBOARDING } from "@/lib/constants";

export async function iniciarChecklist(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  if (!colaboradorId || !["Admissão", "Desligamento"].includes(tipo)) {
    return { erro: "Dados inválidos." };
  }
  if (!(await podeVerColaborador(sessao, colaboradorId))) return { erro: "Fora do escopo." };

  const jaExiste = await db.tarefa.count({ where: { colaboradorId, tipo } });
  if (jaExiste > 0) return { erro: "Este colaborador já possui um checklist deste tipo." };

  const modelo = tipo === "Admissão" ? MODELO_ONBOARDING : MODELO_OFFBOARDING;
  await db.tarefa.createMany({
    data: modelo.map((t, i) => ({
      colaboradorId,
      tipo,
      titulo: t.titulo,
      responsavel: t.responsavel,
      ordem: i,
    })),
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "INICIAR_CHECKLIST",
    recurso: `Tarefa:${tipo}`,
    colaboradorId,
  });

  revalidatePath("/integracao");
  return { ok: true };
}

export async function alternarTarefa(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const t = await db.tarefa.findUnique({ where: { id } });
  if (!t) return;
  await db.tarefa.update({
    where: { id },
    data: {
      concluida: !t.concluida,
      concluidaEm: !t.concluida ? new Date() : null,
    },
  });
  revalidatePath("/integracao");
}

export async function adicionarTarefa(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!colaboradorId || !titulo) return { erro: "Informe a tarefa." };
  const max = await db.tarefa.aggregate({
    where: { colaboradorId, tipo },
    _max: { ordem: true },
  });
  await db.tarefa.create({
    data: {
      colaboradorId,
      tipo,
      titulo,
      responsavel: String(formData.get("responsavel") ?? "") || null,
      ordem: (max._max.ordem ?? 0) + 1,
    },
  });
  revalidatePath("/integracao");
  return { ok: true };
}

export async function removerTarefa(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.tarefa.delete({ where: { id } });
  revalidatePath("/integracao");
}
