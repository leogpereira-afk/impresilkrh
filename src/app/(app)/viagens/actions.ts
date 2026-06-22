"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { podeAvaliar, podeVerColaborador } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";

function data(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}
function flt(v: FormDataEntryValue | null): number {
  if (!v || typeof v !== "string") return 0;
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
}

// podeAvaliar = RH ou Gestor (gestão de equipe)
export async function salvarViagem(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return { erro: "Sem permissão." };

  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const destino = String(formData.get("destino") ?? "").trim();
  if (!colaboradorId || !destino) return { erro: "Informe o colaborador e o destino." };
  if (!(await podeVerColaborador(sessao, colaboradorId))) {
    return { erro: "Colaborador fora do seu escopo." };
  }

  const dataInicio = data(formData.get("dataInicio"));
  const dataFim = data(formData.get("dataFim"));
  if (!dataInicio || !dataFim) return { erro: "Informe as datas de início e fim." };

  const dias = Math.max(1, Math.round((dataFim.getTime() - dataInicio.getTime()) / 86400000) + 1);
  const valorDiaria = flt(formData.get("valorDiaria"));
  const valorTotal = dias * valorDiaria;
  const id = String(formData.get("id") ?? "");

  const dados = {
    destino,
    dataInicio,
    dataFim,
    dias,
    valorDiaria,
    valorTotal,
    finalidade: String(formData.get("finalidade") ?? "") || null,
    status: String(formData.get("status") ?? "Planejada"),
  };

  if (id) await db.viagem.update({ where: { id }, data: dados });
  else await db.viagem.create({ data: { colaboradorId, ...dados } });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: id ? "EDITAR_VIAGEM" : "CRIAR_VIAGEM",
    recurso: "Viagem",
    colaboradorId,
    detalhe: `${destino} · ${dias}d`,
  });

  revalidatePath("/viagens");
  return { ok: true };
}

export async function removerViagem(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao || !podeAvaliar(sessao)) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.viagem.delete({ where: { id } });
  revalidatePath("/viagens");
}
