import type { Usuario } from "./types";
import { COLABORADORES } from "./colaboradores";
import { email as emailDe, HOJE } from "./_gen";
import { MODULOS } from "@/lib/constants";

// Usuários e permissões (v3). O nível máximo (ADMIN_RH) gere usuários e o que
// cada um pode ver. ["*"] = acesso total.
//
// Default de um GESTOR = TUDO menos os módulos exclusivos do RH. Antes esta era
// uma lista escrita à mão, e ela envelheceu: "calendario" e "comportamental"
// entraram no menu e ninguém lembrou de acrescentar aqui. O menu exige as duas
// coisas (o perfil PERMITIR e o módulo estar liberado), então os três gestores
// da empresa simplesmente ficaram sem Calendário e sem Guia Comportamental na
// barra lateral — sem erro, sem aviso, só ausência.
//
// Agora a lista é DERIVADA de MODULOS (a mesma que o Painel de Controle mostra
// ao marcar permissões): módulo novo já nasce liberado para o gestor, e tirar
// acesso é decisão explícita de quem edita SO_RH.
const SO_RH = new Set([
  "carreira",        // faixas salariais da empresa inteira
  "custos",          // folha consolidada
  "relatorios",      // relatórios gerenciais
  "painel-controle", // usuários, permissões e configuração
  "lgpd",            // trilha de acesso a dado sensível
  "aceites",         // termos e aceites
]);
const GESTOR_MODULOS = MODULOS.map((m) => m.chave).filter((k) => !SO_RH.has(k));

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
    perfil: "ADMIN_RH", // diretoria/master com acesso total de administrador
    colaboradorId: leo.id,
    permissoes: ["*"],
    // Sem senha embutida nos dados: o acesso fixo leonardo/1903 vive só no Login
    // (não vai para backup/nuvem). Senha individual é definida no Painel de Controle.
    ativo: true,
    criadoEm: HOJE.toISOString(),
  });
}

export const USUARIOS: Usuario[] = usuarios;
