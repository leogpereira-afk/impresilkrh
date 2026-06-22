// Trilha de acesso a dados sensíveis (LGPD). Registra localmente quem acessou
// CPF/salário/dados familiares — visível apenas para o RH.
import { criarEm } from "./store";
import type { Sessao } from "./session";

export function registrarAcesso(
  sessao: Sessao | null,
  usuarioNome: string,
  dados: { acao: string; recurso: string; colaboradorId?: string | null; detalhe?: string },
): void {
  if (!sessao) return;
  criarEm("acessos", {
    usuarioColaboradorId: sessao.colaboradorId,
    usuarioNome,
    perfil: sessao.perfil,
    acao: dados.acao,
    recurso: dados.recurso,
    colaboradorId: dados.colaboradorId ?? null,
    detalhe: dados.detalhe,
    criadoEm: new Date().toISOString(),
  });
}
