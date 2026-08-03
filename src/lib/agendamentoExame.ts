// ============================================================================
// Agendamento de exame ocupacional: onde, quando — e o aviso para a pessoa.
//
// O RH marca o exame por telefone com a clínica e precisa avisar o colaborador.
// Sem isto, o aviso ia por fora do sistema (papelzinho, memória) e a informação
// de ONDE a pessoa deve comparecer não ficava em lugar nenhum: quando ela
// ligava perguntando, ninguém sabia responder.
//
// A montagem do texto mora aqui, e não na tela, por dois motivos: dá para
// testar sem abrir o navegador, e o mesmo texto serve para o WhatsApp e para
// qualquer outro canal que venha depois.
// ============================================================================

export interface DadosAgendamento {
  /** Nome do colaborador. */
  nome: string;
  /** Tipo do exame (ASO Admissional, Periódico, Demissional…). */
  tipo: string;
  /** Data e hora combinadas (ISO local: "2026-08-14T09:30"). */
  quando?: string | null;
  /** Clínica/empresa que vai fazer o exame. */
  clinica?: string | null;
  /** Endereço ou ponto de referência. */
  local?: string | null;
  /** Observação livre (levar documento, jejum…). */
  observacao?: string | null;
  /** Nome da empresa que está convocando (aparece na assinatura). */
  empresa?: string | null;
}

/** "2026-08-14T09:30" → "14/08/2026 às 09:30" (sem hora: só a data). */
export function quandoLegivel(iso?: string | null): string {
  const s = String(iso ?? "").trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(s);
  if (!m) return s;
  const [, a, mes, d, h, min] = m;
  const data = `${d}/${mes}/${a}`;
  return h ? `${data} às ${h}:${min}` : data;
}

/** Primeiro nome — o aviso é uma mensagem, não um ofício. */
const primeiroNome = (n: string) => String(n || "").trim().split(/\s+/)[0] ?? "";

/**
 * Mensagem de convocação. Só entra na mensagem o que foi preenchido: linha de
 * local vazia ("Local: —") faz a pessoa achar que falta informação e ligar
 * para perguntar, que é justamente o que este aviso existe para evitar.
 */
export function mensagemAgendamento(d: DadosAgendamento): string {
  const linhas: string[] = [];
  const ola = primeiroNome(d.nome);
  linhas.push(`Olá${ola ? `, ${ola}` : ""}! Seu *${d.tipo}* está agendado.`);
  linhas.push("");

  const quando = quandoLegivel(d.quando);
  if (quando) linhas.push(`📅 *Quando:* ${quando}`);
  if (d.clinica?.trim()) linhas.push(`🏥 *Onde:* ${d.clinica.trim()}`);
  if (d.local?.trim()) linhas.push(`📍 *Endereço:* ${d.local.trim()}`);
  if (d.observacao?.trim()) linhas.push(`ℹ️ ${d.observacao.trim()}`);

  linhas.push("");
  linhas.push("Leve um documento com foto.");
  linhas.push("Qualquer imprevisto, avise o RH com antecedência.");
  if (d.empresa?.trim()) linhas.push(`\n_${d.empresa.trim()}_`);

  return linhas.join("\n").trim();
}

/**
 * Telefone no formato que o WhatsApp entende (só dígitos, com DDI).
 *
 * Devolve null quando não dá para ter certeza — mandar mensagem para um número
 * adivinhado é pior do que não mandar: pode cair na conversa de um estranho.
 * Regra: 10 ou 11 dígitos = número brasileiro, recebe o 55 na frente; 12 ou 13
 * já vêm com DDI; qualquer outra coisa é recusada.
 */
export function telefoneWhatsApp(tel?: string | null): string | null {
  const so = String(tel ?? "").replace(/\D/g, "");
  if (so.length === 10 || so.length === 11) return `55${so}`;
  if ((so.length === 12 || so.length === 13) && so.startsWith("55")) return so;
  return null;
}

/** Link direto para a conversa com o texto já escrito. */
export function linkWhatsApp(tel: string, texto: string): string {
  return `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
}
