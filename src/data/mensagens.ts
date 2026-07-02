import type { Agendamento, Contato, TemplateMensagem } from "./types";
import { COLABORADORES } from "./colaboradores";
import { AREAS } from "./areas";
import { HOJE } from "./_gen";

const areaNome = (id?: string | null) => AREAS.find((a) => a.id === id)?.nome ?? "Geral";

// Contatos derivados do quadro ativo (Módulo G — base do disparador).
export const CONTATOS: Contato[] = COLABORADORES.filter(
  (c) => !c.ehDirecao && c.statusId !== "inativo" && c.telefone,
).map((c) => ({
  id: `ct-${c.id}`,
  nome: c.nome,
  telefone: c.telefone!,
  colaboradorId: c.id,
  grupo: areaNome(c.areaId),
}));

export const TEMPLATES: TemplateMensagem[] = [
  { id: "tpl-1", titulo: "Feliz aniversário", corpo: "Olá {{nome}}, toda a equipe Impresilk deseja um feliz aniversário! 🎉", criadoEm: HOJE.toISOString() },
  { id: "tpl-2", titulo: "Reunião semanal", corpo: "Olá {{nome}}, lembrete da reunião operacional desta semana. Conte com sua presença.", criadoEm: HOJE.toISOString() },
  { id: "tpl-3", titulo: "Reforço de EPI", corpo: "{{nome}}, reforço importante: uso obrigatório de EPIs em todas as frentes. Segurança em primeiro lugar.", criadoEm: HOJE.toISOString() },
  { id: "tpl-4", titulo: "Comunicado geral", corpo: "Prezado(a) {{nome}}, informamos que...", criadoEm: HOJE.toISOString() },
  // Rotinas de RH ligadas à operação (pessoas, não processo). Os ids são fixos:
  // a migração de conteúdo usa os mesmos para não duplicar em quem já tem dados.
  { id: "tpl-rh-treinamento", titulo: "Convocação de treinamento", corpo: "Olá {{nome}}, você foi convocado(a) para um treinamento. Confirme sua presença com o RH e fique atento(a) à data e ao horário.", criadoEm: HOJE.toISOString() },
  { id: "tpl-rh-aso", titulo: "Exame periódico (ASO)", corpo: "{{nome}}, seu exame periódico está para ser agendado. Procure o RH para combinar data e local.", criadoEm: HOJE.toISOString() },
  { id: "tpl-rh-nr", titulo: "Reciclagem de NR vencendo", corpo: "{{nome}}, sua certificação de segurança (NR) está perto de vencer. Vamos agendar a reciclagem para você continuar liberado(a) para o trabalho.", criadoEm: HOJE.toISOString() },
];

export const AGENDAMENTOS: Agendamento[] = [];
