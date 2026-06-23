import type { EventoCalendario } from "./types";

// Calendário institucional. Aniversários de pessoas e de tempo de empresa são
// derivados dos colaboradores (não ficam aqui). Datas móveis (Carnaval, Páscoa,
// Mães, Pais…) são lançadas por ano; as fixas marcam recorrenteAnual.
export const EVENTOS_CALENDARIO: EventoCalendario[] = [
  // --- Empresa ---
  { id: "ev-fundacao", titulo: "Fundação da Impresilk", data: "1984-01-10", tipo: "Empresa", recorrenteAnual: true, descricao: "Aniversário da empresa — mais de 40 anos de comunicação visual." },

  // --- Feriados nacionais fixos (todo ano) ---
  { id: "ev-fer-confrat", titulo: "Confraternização Universal", data: "2026-01-01", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-tiradentes", titulo: "Tiradentes", data: "2026-04-21", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-trabalho", titulo: "Dia do Trabalho", data: "2026-05-01", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-independencia", titulo: "Independência do Brasil", data: "2026-09-07", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-aparecida", titulo: "Nossa Senhora Aparecida", data: "2026-10-12", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-finados", titulo: "Finados", data: "2026-11-02", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-republica", titulo: "Proclamação da República", data: "2026-11-15", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-consciencia", titulo: "Consciência Negra", data: "2026-11-20", tipo: "Feriado", recorrenteAnual: true },
  { id: "ev-fer-natal", titulo: "Natal", data: "2026-12-25", tipo: "Feriado", recorrenteAnual: true },

  // --- Feriados móveis 2026 (variam a cada ano) ---
  { id: "ev-fer-carnaval1", titulo: "Carnaval", data: "2026-02-16", tipo: "Feriado", descricao: "Ponto facultativo." },
  { id: "ev-fer-carnaval2", titulo: "Carnaval", data: "2026-02-17", tipo: "Feriado", descricao: "Ponto facultativo." },
  { id: "ev-fer-sextasanta", titulo: "Sexta-feira Santa", data: "2026-04-03", tipo: "Feriado" },
  { id: "ev-fer-corpus", titulo: "Corpus Christi", data: "2026-06-04", tipo: "Feriado", descricao: "Ponto facultativo." },

  // --- Datas comemorativas e dias do nosso segmento (todo ano) ---
  { id: "ev-com-publicitario", titulo: "Dia do Publicitário", data: "2026-02-01", tipo: "Comemorativa", recorrenteAnual: true, descricao: "Profissionais de propaganda e marketing." },
  { id: "ev-com-mulher", titulo: "Dia Internacional da Mulher", data: "2026-03-08", tipo: "Comemorativa", recorrenteAnual: true, descricao: "Homenagem às mulheres da equipe." },
  { id: "ev-com-consumidor", titulo: "Dia Mundial do Consumidor", data: "2026-03-15", tipo: "Comemorativa", recorrenteAnual: true },
  { id: "ev-com-designer", titulo: "Dia do Designer Gráfico", data: "2026-04-27", tipo: "Comemorativa", recorrenteAnual: true, descricao: "Nosso time de criação e arte." },
  { id: "ev-com-marketing", titulo: "Dia do Marketing", data: "2026-05-25", tipo: "Comemorativa", recorrenteAnual: true },
  { id: "ev-com-cliente", titulo: "Dia do Cliente", data: "2026-09-15", tipo: "Comemorativa", recorrenteAnual: true, descricao: "Ação de relacionamento com clientes." },
  { id: "ev-com-propaganda", titulo: "Dia da Propaganda", data: "2026-12-04", tipo: "Comemorativa", recorrenteAnual: true },

  // --- Datas móveis 2026 (Mães/Pais) ---
  { id: "ev-com-maes-2026", titulo: "Dia das Mães", data: "2026-05-10", tipo: "Comemorativa", descricao: "2º domingo de maio (varia a cada ano)." },
  { id: "ev-com-pais-2026", titulo: "Dia dos Pais", data: "2026-08-09", tipo: "Comemorativa", descricao: "2º domingo de agosto (varia a cada ano)." },

  // --- Reuniões programadas (exemplos) ---
  { id: "ev-reu-geral", titulo: "Reunião geral de equipe", data: "2026-07-01", tipo: "Reunião", hora: "09:00", descricao: "Resultados e metas do semestre." },
];
