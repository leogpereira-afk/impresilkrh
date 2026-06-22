"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { podeEditarColaboradores, idsDaEquipe } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";

// Redefine o gestor (reporte) de um colaborador. Somente RH.
export async function definirGestor(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) return { erro: "Sem permissão." };

  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const gestorId = String(formData.get("gestorId") ?? "") || null;
  if (!colaboradorId) return { erro: "Colaborador inválido." };
  if (gestorId === colaboradorId) return { erro: "Um colaborador não pode ser o próprio gestor." };

  // Evita ciclos: o novo gestor não pode estar na própria equipe (subárvore) do colaborador.
  if (gestorId) {
    const subordinados = await idsDaEquipe(colaboradorId);
    if (subordinados.includes(gestorId)) {
      return { erro: "Esse gestor está abaixo do colaborador — criaria um ciclo." };
    }
  }

  await db.colaborador.update({ where: { id: colaboradorId }, data: { gestorId } });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "DEFINIR_GESTOR",
    recurso: "Organograma",
    colaboradorId,
    detalhe: gestorId ? `novo gestor: ${gestorId}` : "sem gestor (topo)",
  });

  revalidatePath("/organograma");
  return { ok: true };
}
