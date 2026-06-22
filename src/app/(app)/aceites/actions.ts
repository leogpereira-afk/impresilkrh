"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createHash } from "crypto";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { registrarAcesso } from "@/lib/lgpd";

function ipAtual(): string | null {
  try {
    const h = headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  } catch {
    return null;
  }
}

// Registra o aceite eletrônico do colaborador logado (autoatendimento).
export async function registrarAceite(formData: FormData) {
  const sessao = await lerSessao();
  if (!sessao?.colaboradorId) return { erro: "Apenas colaboradores podem registrar aceites." };

  const tipo = String(formData.get("tipo") ?? "").trim();
  const referencia = String(formData.get("referencia") ?? "") || null;
  const nomeConfirmado = String(formData.get("nomeConfirmado") ?? "").trim();
  const confirmou = formData.get("confirmo") === "on";

  if (!tipo) return { erro: "Tipo de aceite inválido." };
  if (!confirmou) return { erro: "Marque a confirmação de leitura e concordância." };
  if (!nomeConfirmado || nomeConfirmado.length < 3) {
    return { erro: "Digite seu nome completo para confirmar." };
  }

  // Para documentos institucionais, calcula hash do conteúdo (integridade).
  let versao: string | null = String(formData.get("versao") ?? "") || null;
  let hashConteudo: string | null = null;
  if (referencia) {
    const doc = await db.documentoInstitucional.findUnique({ where: { id: referencia } });
    if (doc) {
      versao = doc.versao ?? versao;
      hashConteudo = createHash("sha256")
        .update(`${doc.titulo}|${doc.versao ?? ""}|${doc.conteudo ?? ""}`)
        .digest("hex")
        .slice(0, 32);
    }
  }

  // Evita duplicar o mesmo aceite (tipo + referência + versão).
  const existente = await db.aceite.findFirst({
    where: { colaboradorId: sessao.colaboradorId, tipo, referencia, versao },
  });
  if (existente) return { ok: true };

  await db.aceite.create({
    data: {
      colaboradorId: sessao.colaboradorId,
      tipo,
      referencia,
      versao,
      hashConteudo,
      nomeConfirmado,
      ip: ipAtual(),
    },
  });

  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "REGISTRAR_ACEITE",
    recurso: `Aceite:${tipo}`,
    colaboradorId: sessao.colaboradorId,
    detalhe: versao ? `${tipo} v${versao}` : tipo,
  });

  revalidatePath("/aceites");
  return { ok: true };
}
