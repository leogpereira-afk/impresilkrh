import { obterSessao } from "./session";

/** O perfil faz parte do escopo para uma redução de acesso não reutilizar dados do RH. */
export function contextoDoUsuario(): string {
  const s = obterSessao();
  return s ? `${encodeURIComponent(s.colaboradorId)}:${s.perfil}` : "visitante";
}

export const chaveLocal = (base: string) => `${base}:conta:${contextoDoUsuario()}`;

export function lerLocal(chave: string): string | null {
  try { return localStorage.getItem(chaveLocal(chave)); } catch { return null; }
}

export function removerLocal(chave: string): void {
  try { localStorage.removeItem(chaveLocal(chave)); } catch { /* sem acesso ao armazenamento */ }
}
