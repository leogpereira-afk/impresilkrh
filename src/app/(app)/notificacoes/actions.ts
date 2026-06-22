"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lerSessao } from "@/lib/session";
import { sincronizarNotificacoes, listarNotificacoes } from "@/lib/notificacoes";
import { enviarEmail, montarDigestHtml } from "@/lib/email";
import { registrarAcesso } from "@/lib/lgpd";

export async function marcarComoLida(formData: FormData): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao) return;
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.notificacao.updateMany({
    where: { id, usuarioId: sessao.sub },
    data: { lida: true },
  });
  revalidatePath("/notificacoes");
}

export async function marcarTodasLidas(): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao) return;
  await db.notificacao.updateMany({
    where: { usuarioId: sessao.sub, lida: false },
    data: { lida: true },
  });
  revalidatePath("/notificacoes");
}

export async function sincronizarAgora(): Promise<void> {
  const sessao = await lerSessao();
  if (!sessao) return;
  await sincronizarNotificacoes(sessao);
  revalidatePath("/notificacoes");
}

export async function enviarDigest() {
  const sessao = await lerSessao();
  if (!sessao) return { erro: "Sessão inválida." };
  await sincronizarNotificacoes(sessao);
  const notifs = await listarNotificacoes(sessao.sub);
  const pendentes = notifs.filter((n) => !n.lida);
  const r = await enviarEmail({
    para: sessao.email,
    assunto: `Impresilk · ${pendentes.length} pendência(s) de RH`,
    html: montarDigestHtml(sessao.nome, pendentes),
  });
  await registrarAcesso({
    usuarioId: sessao.sub,
    acao: "ENVIAR_DIGEST",
    recurso: "Notificacao:Email",
    detalhe: r.simulado ? "simulado (sem provedor)" : "enviado",
  });
  return { ok: true, simulado: r.simulado };
}
