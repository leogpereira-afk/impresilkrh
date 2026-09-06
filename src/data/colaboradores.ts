import type { Colaborador } from "./types";

// Cadastros vêm do servidor após a autenticação. Não publicar pessoas, salários
// ou informações familiares como dados iniciais do aplicativo.
export const COLABORADORES: Colaborador[] = [];
