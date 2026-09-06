import type { ContaPlano } from "./types";

export const idConta = (competencia: string, codigo: string) => `pc_${competencia}_${codigo}`;

// Lançamentos financeiros vêm da consulta autenticada, nunca do código público.
export const PLANO_CONTAS: ContaPlano[] = [];
