"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { PERFIS } from "@/lib/constants";
import { registrarAcesso } from "@/lib/lgpd";

async function exigirAdmin() {
  const sessao = await lerSessao();
  if (!sessao || sessao.perfil !== PERFIS.ADMIN_RH) return null;
  return sessao;
}

export async function criarStatus(formData: FormData) {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sem permissão." };
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do status." };
  const cor = String(formData.get("cor") ?? "#64748b");
  const contaComoAtivo = formData.get("contaComoAtivo") === "on";
  const existe = await db.statusColaborador.findUnique({ where: { nome } });
  if (existe) return { erro: "Já existe um status com esse nome." };
  const count = await db.statusColaborador.count();
  await db.statusColaborador.create({
    data: { nome, cor, contaComoAtivo, ordem: count },
  });
  await registrarAcesso({ usuarioId: sessao.sub, acao: "CRIAR_STATUS", recurso: "StatusColaborador", detalhe: nome });
  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function criarCiclo(formData: FormData) {
  const sessao = await exigirAdmin();
  if (!sessao) return { erro: "Sem permissão." };
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do ciclo." };
  const dataInicio = new Date(String(formData.get("dataInicio") ?? ""));
  const dataFim = new Date(String(formData.get("dataFim") ?? ""));
  if (isNaN(dataInicio.getTime()) || isNaN(dataFim.getTime())) {
    return { erro: "Datas inválidas." };
  }
  const existe = await db.cicloAvaliacao.findUnique({ where: { nome } });
  if (existe) return { erro: "Já existe um ciclo com esse nome." };
  await db.cicloAvaliacao.create({
    data: {
      nome,
      dataInicio,
      dataFim,
      status: "Aberto",
      notaMinPromocao: parseFloat(String(formData.get("notaMinPromocao") ?? "80")) || 80,
      mesesMinNivel: parseInt(String(formData.get("mesesMinNivel") ?? "12")) || 12,
    },
  });
  await registrarAcesso({ usuarioId: sessao.sub, acao: "CRIAR_CICLO", recurso: "CicloAvaliacao", detalhe: nome });
  revalidatePath("/configuracoes");
  return { ok: true };
}

export async function alternarCiclo(formData: FormData): Promise<void> {
  const sessao = await exigirAdmin();
  if (!sessao) return;
  const id = String(formData.get("id") ?? "");
  const ciclo = await db.cicloAvaliacao.findUnique({ where: { id } });
  if (!ciclo) return;
  await db.cicloAvaliacao.update({
    where: { id },
    data: { status: ciclo.status === "Aberto" ? "Fechado" : "Aberto" },
  });
  revalidatePath("/configuracoes");
}
