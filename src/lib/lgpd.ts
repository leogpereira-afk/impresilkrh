import { headers } from "next/headers";
import { db } from "./db";

interface RegistroAcesso {
  usuarioId: string;
  acao: string;
  recurso: string;
  colaboradorId?: string | null;
  detalhe?: string | null;
}

// Registra um acesso a dados pessoais/sensíveis para fins de conformidade com a LGPD.
// Nunca lança erro para não interromper a navegação do usuário.
export async function registrarAcesso(r: RegistroAcesso): Promise<void> {
  try {
    let ip: string | null = null;
    try {
      const h = headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
    } catch {
      ip = null;
    }
    await db.accessLog.create({
      data: {
        usuarioId: r.usuarioId,
        acao: r.acao,
        recurso: r.recurso,
        colaboradorId: r.colaboradorId ?? null,
        detalhe: r.detalhe ?? null,
        ip,
      },
    });
  } catch (e) {
    console.error("Falha ao registrar acesso LGPD:", e);
  }
}
