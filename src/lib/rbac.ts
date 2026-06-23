// RBAC client-side. Calcula o escopo de visibilidade conforme o perfil e a
// hierarquia (gestor recursivo). Mascaramento de dados sensíveis segue a LGPD.

import type { Colaborador, Usuario } from "@/data/types";
import type { Sessao } from "./session";

// IDs da equipe de um gestor (diretos e indiretos), incluindo ele mesmo.
export function idsDaEquipe(colaboradorId: string, colaboradores: Colaborador[]): string[] {
  const filhosPorGestor = new Map<string, string[]>();
  for (const c of colaboradores) {
    if (c.gestorId) {
      const arr = filhosPorGestor.get(c.gestorId) ?? [];
      arr.push(c.id);
      filhosPorGestor.set(c.gestorId, arr);
    }
  }
  const resultado = new Set<string>([colaboradorId]);
  const fila = [colaboradorId];
  while (fila.length) {
    const atual = fila.shift()!;
    for (const filho of filhosPorGestor.get(atual) ?? []) {
      if (!resultado.has(filho)) {
        resultado.add(filho);
        fila.push(filho);
      }
    }
  }
  return [...resultado];
}

// Conjunto de colaboradores visíveis para a sessão.
export function colaboradoresVisiveis(
  sessao: Sessao | null,
  colaboradores: Colaborador[],
): Colaborador[] {
  if (!sessao) return [];
  if (sessao.perfil === "ADMIN_RH") return colaboradores;
  if (sessao.perfil === "GESTOR") {
    const ids = new Set(idsDaEquipe(sessao.colaboradorId, colaboradores));
    return colaboradores.filter((c) => ids.has(c.id));
  }
  return colaboradores.filter((c) => c.id === sessao.colaboradorId);
}

export function podeVerColaborador(
  sessao: Sessao | null,
  colaboradorId: string,
  colaboradores: Colaborador[],
): boolean {
  if (!sessao) return false;
  if (sessao.perfil === "ADMIN_RH") return true;
  if (sessao.perfil === "COLABORADOR") return sessao.colaboradorId === colaboradorId;
  return idsDaEquipe(sessao.colaboradorId, colaboradores).includes(colaboradorId);
}

// Dados sensíveis = CPF completo, salário, dados familiares.
// RH vê tudo; demais só os próprios (regra conservadora LGPD — gestor NÃO vê
// salário de subordinado).
export function podeVerDadosSensiveis(sessao: Sessao | null, colaboradorId: string): boolean {
  if (!sessao) return false;
  if (sessao.perfil === "ADMIN_RH") return true;
  return sessao.colaboradorId === colaboradorId;
}

// Dados de gestão (perfil comportamental, motivação): visíveis ao RH e ao gestor
// da área, mas NUNCA ao próprio colaborador (uso interno de gestão de pessoas).
export function podeVerGestao(
  sessao: Sessao | null,
  colaboradorId: string,
  colaboradores: Colaborador[],
): boolean {
  if (!sessao) return false;
  if (sessao.perfil === "ADMIN_RH") return true;
  if (sessao.perfil === "GESTOR") return idsDaEquipe(sessao.colaboradorId, colaboradores).includes(colaboradorId);
  return false; // colaborador não vê dados de gestão (nem os próprios)
}

export function ehRH(sessao: Sessao | null): boolean {
  return sessao?.perfil === "ADMIN_RH";
}
export function ehGestor(sessao: Sessao | null): boolean {
  return sessao?.perfil === "GESTOR";
}
export function podeGerir(sessao: Sessao | null): boolean {
  return sessao?.perfil === "ADMIN_RH" || sessao?.perfil === "GESTOR";
}

// Gestor master (diretoria) — único que vê os dados societários confidenciais
// (Retiradas Leonardo, Arrendamento/Pedro). Nem o RH vê.
export const MASTER_COLAB_ID = "leonardo-goncalves";
export function ehMaster(sessao: Sessao | null): boolean {
  return sessao?.colaboradorId === MASTER_COLAB_ID;
}

// Módulos liberados para a sessão, segundo o cadastro de Usuários (Painel de Controle).
// Retorna null = SEM restrição por módulo (vale só o perfil) — caso de ADMIN_RH, de
// quem não tem cadastro de usuário, ou de quem tem acesso total ("*").
// Quando retorna um Set, a navegação e as rotas devem se limitar a esses módulos.
export function modulosLiberados(sessao: Sessao | null, usuarios: Usuario[]): Set<string> | null {
  // ADMIN_RH e o diretor master têm acesso irrestrito a todos os módulos.
  if (!sessao || sessao.perfil === "ADMIN_RH" || sessao.colaboradorId === MASTER_COLAB_ID) return null;
  const u = usuarios.find((x) => x.ativo && x.colaboradorId === sessao.colaboradorId);
  if (!u || !u.permissoes || u.permissoes.length === 0 || u.permissoes.includes("*")) return null;
  return new Set(u.permissoes);
}

// O módulo (chave) está acessível para a sessão? "meu-perfil" é sempre liberado
// para o usuário não ficar preso fora da própria conta.
export function moduloAcessivel(modulo: string, liberados: Set<string> | null): boolean {
  if (modulo === "meu-perfil") return true;
  return liberados === null || liberados.has(modulo);
}
