import { db } from "./db";
import { PERFIS } from "./constants";
import type { SessionPayload } from "./session";
import type { Prisma } from "@prisma/client";

// Calcula recursivamente os IDs da equipe de um gestor (subordinados diretos e indiretos),
// incluindo o próprio gestor. Usado para restringir o acesso do perfil GESTOR à sua área.
export async function idsDaEquipe(colaboradorId: string): Promise<string[]> {
  const todos = await db.colaborador.findMany({
    select: { id: true, gestorId: true },
  });
  const filhosPorGestor = new Map<string, string[]>();
  for (const c of todos) {
    if (c.gestorId) {
      const lista = filhosPorGestor.get(c.gestorId) ?? [];
      lista.push(c.id);
      filhosPorGestor.set(c.gestorId, lista);
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

// Retorna o filtro Prisma (where) com os colaboradores visíveis para a sessão.
export async function escopoColaboradores(
  sessao: SessionPayload,
): Promise<Prisma.ColaboradorWhereInput> {
  if (sessao.perfil === PERFIS.ADMIN_RH) return {};
  if (sessao.perfil === PERFIS.GESTOR && sessao.colaboradorId) {
    const ids = await idsDaEquipe(sessao.colaboradorId);
    return { id: { in: ids } };
  }
  // Colaborador: apenas ele mesmo
  return { id: sessao.colaboradorId ?? "__sem_acesso__" };
}

// Verifica se a sessão pode acessar um colaborador específico.
export async function podeVerColaborador(
  sessao: SessionPayload,
  colaboradorId: string,
): Promise<boolean> {
  if (sessao.perfil === PERFIS.ADMIN_RH) return true;
  if (sessao.perfil === PERFIS.COLABORADOR)
    return sessao.colaboradorId === colaboradorId;
  if (sessao.perfil === PERFIS.GESTOR && sessao.colaboradorId) {
    const ids = await idsDaEquipe(sessao.colaboradorId);
    return ids.includes(colaboradorId);
  }
  return false;
}

// Pode ver/editar dados sensíveis (CPF completo, salário, dados familiares)?
// RH vê tudo; gestor vê de sua equipe; colaborador vê só os próprios.
export function podeVerDadosSensiveis(
  sessao: SessionPayload,
  colaboradorId: string,
): boolean {
  if (sessao.perfil === PERFIS.ADMIN_RH) return true;
  if (sessao.perfil === PERFIS.COLABORADOR)
    return sessao.colaboradorId === colaboradorId;
  // Gestor: dados de cargo/área sim; salário só do próprio (regra conservadora LGPD)
  return sessao.colaboradorId === colaboradorId;
}

export function podeEditarColaboradores(sessao: SessionPayload): boolean {
  return sessao.perfil === PERFIS.ADMIN_RH;
}

export function podeAvaliar(sessao: SessionPayload): boolean {
  return sessao.perfil === PERFIS.ADMIN_RH || sessao.perfil === PERFIS.GESTOR;
}
