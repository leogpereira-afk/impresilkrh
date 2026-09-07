import { obterSessao } from "./session";
import { lerArmazem, removerArmazem } from "./armazemLocal";

/** O perfil faz parte do escopo para uma redução de acesso não reutilizar dados do RH. */
export function contextoDoUsuario(): string {
  const s = obterSessao();
  return s ? `${encodeURIComponent(s.colaboradorId)}:${s.perfil}` : "visitante";
}

export const chaveLocal = (base: string) => `${base}:conta:${contextoDoUsuario()}`;

export function lerLocal(chave: string): string | null {
  return lerArmazem(chaveLocal(chave));
}

export function removerLocal(chave: string): void {
  removerArmazem(chaveLocal(chave));
}
