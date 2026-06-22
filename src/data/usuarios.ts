import type { Usuario } from "./types";
import { COLABORADORES } from "./colaboradores";
import { email as emailDe, HOJE } from "./_gen";

// Usuários e permissões (v3). O nível máximo (ADMIN_RH) gere usuários e o que
// cada um pode ver. ["*"] = acesso total.
const GESTOR_MODULOS = [
  "painel", "colaboradores", "organograma", "desempenho", "treinamento", "ponto",
  "ferias", "integracao", "viagens", "comunicacao", "pops", "documentos", "sst",
  "meu-perfil", "aceites",
];

const usuarios: Usuario[] = [];
COLABORADORES.filter((c) => !c.ehDirecao && c.statusId !== "inativo" && c.perfil && c.perfil !== "COLABORADOR").forEach((c) => {
  usuarios.push({
    id: `user-${c.id}`,
    nome: c.nome,
    email: c.email ?? emailDe(c.nome),
    perfil: c.perfil!,
    colaboradorId: c.id,
    permissoes: c.perfil === "ADMIN_RH" ? ["*"] : GESTOR_MODULOS,
    ativo: true,
    criadoEm: HOJE.toISOString(),
  });
});

const leo = COLABORADORES.find((c) => c.id === "leonardo-goncalves");
if (leo) {
  usuarios.push({
    id: "user-leonardo",
    nome: leo.nome,
    email: "diretoria@impresilk.com.br",
    perfil: "GESTOR",
    colaboradorId: leo.id,
    permissoes: ["*"],
    ativo: true,
    criadoEm: HOJE.toISOString(),
  });
}

export const USUARIOS: Usuario[] = usuarios;
