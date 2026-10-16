import type { Colaborador, EventoCalendario } from "@/data/types";
import type { AcaoEndomarketing, ModeloEndo } from "@/data/endomarketing";
import { noQuadro } from "./dominio";
import { diaLocalISO, parseData } from "./format";
import { colaboradoresVisiveis } from "./rbac";
import type { Sessao } from "./session";

export interface MarcoEndo {
  id: string; data: string; titulo: string; detalhe: string;
  tipo: "Aniversário" | "Tempo de empresa" | "Acolhimento" | "Data especial";
  colaboradorId?: string;
}
export function dataValidaEndo(data: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(data) && !!parseData(data);
}
function noAno(data: string, ano: number): string | null {
  if (!dataValidaEndo(data)) return null;
  const candidata = `${ano}${data.slice(4)}`;
  // 29/02: lembrar em 28/02 nos anos sem esse dia, explicitamente na agenda.
  return dataValidaEndo(candidata) ? candidata : data.slice(5) === "02-29" ? `${ano}-02-28` : null;
}
export function pessoasEndo(sessao: Sessao | null, pessoas: Colaborador[], hoje: string) {
  return colaboradoresVisiveis(sessao, pessoas).filter(p => noQuadro(p) && (!dataValidaEndo(p.dataAdmissao ?? "") || (p.dataAdmissao ?? "") <= hoje));
}
export function agendaEndo(pessoas: Colaborador[], eventos: EventoCalendario[], ano: number): MarcoEndo[] {
  const marcos: MarcoEndo[] = [];
  for (const p of pessoas) {
    const nascimento = noAno(p.dataNascimento ?? "", ano);
    if (nascimento && (p.dataNascimento ?? "") < nascimento && (!dataValidaEndo(p.dataAdmissao ?? "") || (p.dataAdmissao ?? "") <= nascimento)) marcos.push({
      id: `aniversario:${p.id}:${ano}`, data: nascimento, tipo: "Aniversário", titulo: p.nome, colaboradorId: p.id,
      detalhe: (p.dataNascimento ?? "").slice(5) === "02-29" && nascimento.endsWith("02-28") ? "Nascimento em 29/02; lembrete em 28/02" : "Combinar a preferência de celebração",
    });
    const admissao = noAno(p.dataAdmissao ?? "", ano);
    if (admissao && admissao >= (p.dataAdmissao ?? "")) {
      const anos = ano - Number((p.dataAdmissao ?? "").slice(0, 4));
      marcos.push({ id: `empresa:${p.id}:${ano}`, data: admissao, titulo: p.nome, colaboradorId: p.id,
        tipo: anos === 0 ? "Acolhimento" : "Tempo de empresa",
        detalhe: anos === 0 ? "Entrada na empresa · boas-vindas" : `${anos} ${anos === 1 ? "ano" : "anos"} de empresa`,
      });
    }
  }
  for (const e of eventos) {
    if (!["Comemorativa", "Empresa", "Reunião", "Feriado"].includes(e.tipo)) continue;
    const data = e.recorrenteAnual ? noAno(e.data, ano) : e.data;
    if (!data || !dataValidaEndo(data) || Number(data.slice(0, 4)) !== ano || data < e.data) continue;
    marcos.push({ id: `evento:${e.id}:${ano}`, data, titulo: e.titulo, detalhe: e.tipo, tipo: "Data especial" });
  }
  return marcos.sort((a, b) => a.data.localeCompare(b.data) || a.titulo.localeCompare(b.titulo, "pt-BR"));
}
export function acaoAberta(a: AcaoEndomarketing) { return a.situacao === "Planejada" || a.situacao === "Em preparação"; }
export function acaoAtrasada(a: AcaoEndomarketing, hoje: string) { return acaoAberta(a) && dataValidaEndo(a.data) && a.data < hoje; }
export function novaAcaoEndo(modelo?: ModeloEndo): AcaoEndomarketing {
  return { id: "", titulo: modelo?.titulo ?? "", tema: modelo?.tema ?? "Bem-estar", data: "", responsavelId: "", objetivo: modelo?.objetivo ?? "", publico: modelo?.publico ?? "", situacao: "Planejada", checklist: (modelo?.passos ?? []).map((texto, i) => ({ id: `item-${i}`, texto, feito: false })), observacoes: "", resultado: "", criterio: modelo?.avaliar, historico: [] };
}
export function registrarAcaoEndo(rascunho: AcaoEndomarketing, anterior: AcaoEndomarketing | undefined, autor: string, agora = new Date()): AcaoEndomarketing {
  const titulo = rascunho.titulo.trim();
  if (!titulo) throw new Error("Informe o título da ação.");
  if (rascunho.data && !dataValidaEndo(rascunho.data)) throw new Error("Informe uma data válida.");
  const em = agora.toISOString();
  const transicao = anterior && anterior.situacao !== rascunho.situacao;
  const texto = !anterior ? `Ação criada · ${rascunho.situacao}` : transicao ? `${anterior.situacao} → ${rascunho.situacao}` : "Planejamento atualizado";
  return { ...rascunho, titulo, concluidaEm: rascunho.situacao === "Realizada" ? (anterior?.concluidaEm ?? em) : undefined,
    historico: [...(anterior?.historico ?? []), { em, por: autor, texto }],
  };
}
export function dataCurtaEndo(data: string) { return data ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : "Sem data"; }
export function hojeEndo(data: Date) { return diaLocalISO(data); }
