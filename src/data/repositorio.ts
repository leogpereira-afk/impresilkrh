import type { ArquivoRepositorio } from "./types";
import { HOJE } from "./_gen";

// Repositório institucional (Módulo G) — centraliza documentos oficiais.
// Os arquivos podem ser anexados pelo RH (upload no navegador, data URL).
export const REPOSITORIO: ArquivoRepositorio[] = [
  { id: "rep-1", nome: "Política de Férias", categoria: "Política", descricao: "Regras de programação e concessão de férias (CLT).", criadoEm: HOJE.toISOString() },
  { id: "rep-2", nome: "Manual do Colaborador", categoria: "Manual", descricao: "Boas-vindas, normas de conduta e benefícios.", criadoEm: HOJE.toISOString() },
  { id: "rep-3", nome: "Formulário de Reembolso", categoria: "Formulário", descricao: "Solicitação de reembolso de despesas de viagem.", criadoEm: HOJE.toISOString() },
  { id: "rep-4", nome: "Comunicado — Calendário 2026", categoria: "Comunicado", descricao: "Feriados, recessos e datas importantes do ano.", criadoEm: HOJE.toISOString() },
  { id: "rep-5", nome: "Política de Uso de Veículos", categoria: "Política", descricao: "Normas para uso de veículos da empresa em campo.", criadoEm: HOJE.toISOString() },
];
