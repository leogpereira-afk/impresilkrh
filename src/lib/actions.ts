"use server";

import { redirect } from "next/navigation";
import { destruirSessaoCookie, lerSessao } from "./session";
import { registrarAcesso } from "./lgpd";

export async function sair() {
  const sessao = await lerSessao();
  if (sessao) {
    await registrarAcesso({
      usuarioId: sessao.sub,
      acao: "LOGOUT",
      recurso: "Sessão",
    });
  }
  destruirSessaoCookie();
  redirect("/login");
}
