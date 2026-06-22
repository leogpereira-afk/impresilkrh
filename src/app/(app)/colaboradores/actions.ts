"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { podeVerColaborador, podeEditarColaboradores } from "@/lib/rbac";
import { registrarAcesso } from "@/lib/lgpd";
import { salvarArquivo, removerArquivo } from "@/lib/storage";

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

  // Upload de arquivo (opcional)
  let arquivoNome: string | null = String(formData.get("arquivoNome") ?? "") || null;
  let arquivoPath: string | null = null;
  let tamanhoBytes: number | null = null;
  const arquivo = formData.get("arquivo");
  if (arquivo instanceof File && arquivo.size > 0) {
    if (arquivo.size > 10 * 1024 * 1024) return { erro: "Arquivo excede o limite de 10 MB." };
    const salvo = await salvarArquivo(arquivo);
    arquivoPath = salvo.caminho;
    arquivoNome = salvo.nome;
    tamanhoBytes = salvo.tamanho;
  }

  await db.documento.create({
    data: {
      colaboradorId,
      categoria,
      nome,
      arquivoNome,
      arquivoPath,
      tamanhoBytes,
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
  const doc = await db.documento.findUnique({ where: { id }, select: { arquivoPath: true } });
  await db.documento.delete({ where: { id } });
  if (doc?.arquivoPath) await removerArquivo(doc.arquivoPath);
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

// ---- Edição de colaborador ----
export async function atualizarColaborador(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeEditarColaboradores(sessao)) {
    return { erro: "Sem permissão para editar colaboradores." };
  }
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Colaborador inválido." };

  const atual = await db.colaborador.findUnique({
    where: { id },
    include: { cargo: { select: { nome: true } }, nivel: { select: { codigo: true } } },
  });
  if (!atual) return { erro: "Colaborador não encontrado." };

  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return { erro: "Informe o nome." };

  const cargoId = String(formData.get("cargoId") ?? "") || null;
  const nivelId = String(formData.get("nivelId") ?? "") || null;
  const salario = parseFloatOpcional(formData.get("salario"));
  const cargo = cargoId
    ? await db.cargo.findUnique({ where: { id: cargoId }, select: { areaId: true, nome: true } })
    : null;
  const nivel = nivelId
    ? await db.nivel.findUnique({ where: { id: nivelId }, select: { codigo: true } })
    : null;

  await db.colaborador.update({
    where: { id },
    data: {
      nome,
      email: String(formData.get("email") ?? "") || null,
      telefone: String(formData.get("telefone") ?? "") || null,
      cpf: String(formData.get("cpf") ?? "").replace(/\D/g, "") || null,
      dataNascimento: parseDataOpcional(formData.get("dataNascimento")),
      dataAdmissao: parseDataOpcional(formData.get("dataAdmissao")),
      dataDesligamento: parseDataOpcional(formData.get("dataDesligamento")),
      enderecoRua: String(formData.get("enderecoRua") ?? "") || null,
      enderecoNumero: String(formData.get("enderecoNumero") ?? "") || null,
      enderecoBairro: String(formData.get("enderecoBairro") ?? "") || null,
      enderecoCep: String(formData.get("enderecoCep") ?? "") || null,
      conjugeNome: String(formData.get("conjugeNome") ?? "") || null,
      qtdFilhos: parseInt(String(formData.get("qtdFilhos") ?? "0")) || 0,
      valeTransporte: formData.get("valeTransporte") === "on",
      cargoId,
      areaId: cargo?.areaId ?? (String(formData.get("areaId") ?? "") || null),
      nivelId,
      statusId: String(formData.get("statusId") ?? "") || null,
      gestorId: String(formData.get("gestorId") ?? "") || null,
      salario,
      riscoSaida: String(formData.get("riscoSaida") ?? atual.riscoSaida ?? "Baixo"),
      potencial: String(formData.get("potencial") ?? atual.potencial ?? "Médio"),
    },
  });

  // Registra movimentação se cargo, nível ou salário mudaram
  const mudouCargo = (cargo?.nome ?? null) !== (atual.cargo?.nome ?? null) && cargoId;
  const mudouNivel = (nivel?.codigo ?? null) !== (atual.nivel?.codigo ?? null) && nivelId;
  const mudouSalario = salario != null && salario !== atual.salario;
  if (mudouCargo || mudouNivel || mudouSalario) {
    await db.movimentacao.create({
      data: {
        colaboradorId: id,
        tipo: mudouCargo ? "Mudança de Cargo" : mudouNivel ? "Promoção" : "Reajuste",
        data: new Date(),
        descricao: "Atualização cadastral",
        cargoAnterior: atual.cargo?.nome ?? null,
        cargoNovo: cargo?.nome ?? null,
        nivelAnterior: atual.nivel?.codigo ?? null,
        nivelNovo: nivel?.codigo ?? null,
        salarioAnterior: atual.salario,
        salarioNovo: salario,
        registradoPor: sessao.nome,
      },
    });
  }

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "EDITAR_COLABORADOR",
    recurso: "Colaborador:Ficha",
    colaboradorId: id,
    detalhe: nome,
  });

  revalidatePath(`/colaboradores/${id}`);
  redirect(`/colaboradores/${id}`);
}

// ---- Desenvolvimento: Metas ----
function podeGerirDesenvolvimento(sessao: { perfil: string }) {
  return sessao.perfil === "ADMIN_RH" || sessao.perfil === "GESTOR";
}

export async function salvarMeta(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeGerirDesenvolvimento(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!colaboradorId || !(await podeVerColaborador(sessao, colaboradorId))) {
    return { erro: "Colaborador fora do seu escopo." };
  }
  const titulo = String(formData.get("titulo") ?? "").trim();
  if (!titulo) return { erro: "Informe o título da meta." };
  const id = String(formData.get("id") ?? "");
  const dados = {
    titulo,
    descricao: String(formData.get("descricao") ?? "") || null,
    indicador: String(formData.get("indicador") ?? "") || null,
    valorAlvo: parseFloatOpcional(formData.get("valorAlvo")),
    valorAtual: parseFloatOpcional(formData.get("valorAtual")),
    unidade: String(formData.get("unidade") ?? "") || null,
    prazo: parseDataOpcional(formData.get("prazo")),
    status: String(formData.get("status") ?? "Em andamento"),
  };
  if (id) await db.meta.update({ where: { id }, data: dados });
  else await db.meta.create({ data: { colaboradorId, ...dados } });
  await registrarAcesso({ usuarioId: sessao.sub, acao: id ? "EDITAR_META" : "CRIAR_META", recurso: "Meta", colaboradorId });
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
}

export async function removerMeta(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao || !podeGerirDesenvolvimento(sessao)) return;
  const id = String(formData.get("id") ?? "");
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!id) return;
  await db.meta.delete({ where: { id } });
  revalidatePath(`/colaboradores/${colaboradorId}`);
}

// ---- Desenvolvimento: PDI ----
export async function salvarPDI(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeGerirDesenvolvimento(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!colaboradorId || !(await podeVerColaborador(sessao, colaboradorId))) {
    return { erro: "Colaborador fora do seu escopo." };
  }
  const competencia = String(formData.get("competencia") ?? "").trim();
  const acao = String(formData.get("acao") ?? "").trim();
  if (!competencia || !acao) return { erro: "Informe a competência e a ação." };
  const id = String(formData.get("id") ?? "");
  const progresso = Math.max(0, Math.min(100, parseInt(String(formData.get("progresso") ?? "0")) || 0));
  const dados = {
    competencia,
    acao,
    resultadoEsperado: String(formData.get("resultadoEsperado") ?? "") || null,
    prazo: parseDataOpcional(formData.get("prazo")),
    progresso,
    status: progresso >= 100 ? "Concluída" : String(formData.get("status") ?? "Em andamento"),
  };
  if (id) await db.pDI.update({ where: { id }, data: dados });
  else await db.pDI.create({ data: { colaboradorId, ...dados } });
  await registrarAcesso({ usuarioId: sessao.sub, acao: id ? "EDITAR_PDI" : "CRIAR_PDI", recurso: "PDI", colaboradorId });
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
}

export async function removerPDI(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao || !podeGerirDesenvolvimento(sessao)) return;
  const id = String(formData.get("id") ?? "");
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  if (!id) return;
  await db.pDI.delete({ where: { id } });
  revalidatePath(`/colaboradores/${colaboradorId}`);
}

// ---- Desenvolvimento: Feedback ----
export async function salvarFeedback(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao || !podeGerirDesenvolvimento(sessao)) return { erro: "Sem permissão." };
  const colaboradorId = String(formData.get("colaboradorId") ?? "");
  const conteudo = String(formData.get("conteudo") ?? "").trim();
  if (!colaboradorId || !conteudo) return { erro: "Preencha o feedback." };
  if (!(await podeVerColaborador(sessao, colaboradorId))) return { erro: "Colaborador fora do escopo." };
  await db.feedback.create({
    data: {
      colaboradorId,
      autorId: sessao.colaboradorId ?? null,
      tipo: String(formData.get("tipo") ?? "Contínuo"),
      conteudo,
      contexto: String(formData.get("contexto") ?? "") || null,
    },
  });
  await registrarAcesso({ usuarioId: sessao.sub, acao: "REGISTRAR_FEEDBACK", recurso: "Feedback", colaboradorId });
  revalidatePath(`/colaboradores/${colaboradorId}`);
  return { ok: true };
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
