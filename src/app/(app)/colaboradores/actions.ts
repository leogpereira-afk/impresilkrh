"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { podeVerColaborador, podeEditarColaboradores } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";

function parseDataOpcional(v: FormDataEntryValue | null): Date | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function parseFloatOpcional(v: FormDataEntryValue | null): number | null {
  if (!v || typeof v !== "string" || !v.trim()) return null;
  const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

// ---- Documentos do colaborador ----
export async function adicionarDocumento(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) {
    return { erro: "Sem permissão para adicionar documentos." };
  }
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const categoria = String(formData.get("categoria") ?? "Outro");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!colaboradorId || !nome) return { erro: "Informe o nome do documento." };

  await db.documento.create({
    data: {
      colaboradorId,
      categoria,
      nome,
      arquivoNome: String(formData.get("arquivoNome") ?? "") || null,
      dataEmissao: parseDataOpcional(formData.get("dataEmissao")),
      dataVencimento: parseDataOpcional(formData.get("dataVencimento")),
      observacao: String(formData.get("observacao") ?? "") || null,
      enviadoPor: sessao.nome,
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "CRIAR_DOCUMENTO",
    recurso: `Documento:${categoria}`,
    colaboradorId,
    detalhe: nome,
  });

  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
}

export async function removerDocumento(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) return;
  const id = String(formData.get("id") ?? "");
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!id) return;
  await db.documento.delete({ where: { id } });
  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "REMOVER_DOCUMENTO",
    recurso: "Documento",
    colaboradorId,
    detalhe: id,
  });
  revalidatePath(`/colaboradores/${colaboradorId}`);
}

// ---- Férias ----
export async function registrarFerias(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!colaboradorId) return { erro: "Colaborador inválido." };

  const dataInicio = parseDataOpcional(formData.get("dataInicio"));
  const dataRetorno = parseDataOpcional(formData.get("dataRetorno"));
  let diasGozados = 0;
  if (dataInicio && dataRetorno) {
    diasGozados = Math.max(
      0,
      Math.round((dataRetorno.getTime() - dataInicio.getTime()) / 86400000),
    );
  }

  await db.ferias.create({
    data: {
      colaboradorId,
      dataInicio,
      dataRetorno,
      diasGozados,
      saldoDias: Math.max(0, 30 - diasGozados),
      status: String(formData.get("status") ?? "Agendada"),
      observacao: String(formData.get("observacao") ?? "") || null,
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "REGISTRAR_FERIAS",
    recurso: "Ferias",
    colaboradorId,
  });

  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
}

// ---- Movimentações (histórico) ----
export async function registrarMovimentacao(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const tipo = String(formData.get("tipo") ?? "");
  if (!colaboradorId || !tipo) return { erro: "Dados incompletos." };

  await db.movimentacao.create({
    data: {
      colaboradorId,
      tipo,
      data: parseDataOpcional(formData.get("data")) ?? new Date(),
      descricao: String(formData.get("descricao") ?? "") || null,
      cargoNovo: String(formData.get("cargoNovo") ?? "") || null,
      nivelNovo: String(formData.get("nivelNovo") ?? "") || null,
      salarioNovo: parseFloatOpcional(formData.get("salarioNovo")),
      registradoPor: sessao.nome,
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "REGISTRAR_MOVIMENTACAO",
    recurso: `Movimentacao:${tipo}`,
    colaboradorId,
  });

  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
}

// ---- Edição de dados de retenção (risco / potencial) ----
export async function atualizarRetencao(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!colaboradorId) return { erro: "Colaborador inválido." };

  await db.colaborador.update({
    where: { id: colaboradorId },
    data: {
      riscoSaida: String(formData.get("riscoSaida") ?? "Baixo"),
      potencial: String(formData.get("potencial") ?? "Médio"),
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "EDITAR_RETENCAO",
    recurso: "Colaborador:Retencao",
    colaboradorId,
  });

  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
}

// ---- Criação de colaborador ----
export async function criarColaborador(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) {
    return { erro: "Sem permissão para cadastrar colaboradores." };
  }
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome do colaborador." };

  const cargoId = String(formData.get("cargoId") ?? "") || null;
  const cargo = cargoId
    ? await db.cargo.findUnique({ where: { id: cargoId }, select: { areaId: true } })
    : null;

  const novo = await db.colaborador.create({
    data: {
      nome,
      email: String(formData.get("email") ?? "") || null,
      telefone: String(formData.get("telefone") ?? "") || null,
      cargoId,
      areaId: cargo?.areaId ?? (String(formData.get("areaId") ?? "") || null),
      nivelId: String(formData.get("nivelId") ?? "") || null,
      statusId: String(formData.get("statusId") ?? "") || null,
      gestorId: String(formData.get("gestorId") ?? "") || null,
      dataAdmissao: parseDataOpcional(formData.get("dataAdmissao")),
      dataNascimento: parseDataOpcional(formData.get("dataNascimento")),
      salario: parseFloatOpcional(formData.get("salario")),
      cpf: String(formData.get("cpf") ?? "").replace(/\D/g, "") || null,
    },
  });

  await db.movimentacao.create({
    data: {
      colaboradorId: novo.id,
      tipo: "Admissão",
      data: novo.dataAdmissao ?? new Date(),
      descricao: "Cadastro inicial no sistema",
      registradoPor: sessao.nome,
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "CRIAR_COLABORADOR",
    recurso: "Colaborador",
    colaboradorId: novo.id,
    detalhe: nome,
  });

  revalidatePath("/colaboradores");
  redirect(`/colaboradores/${novo.id}`);
}

// Registra a visualização de dados sensíveis (LGPD) — chamado ao abrir o detalhe.
export async function logVisualizacaoSensivel(colaboradorId: string) {
  const sessao = await lerSessao();
  if (!sessao) return;
  if (!(await podeVerColaborador(sessao, colaboradorId))) return;
  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "VISUALIZAR_DADOS_SENSIVEIS",
    recurso: "Colaborador:Ficha",
    colaboradorId,
  });
}
