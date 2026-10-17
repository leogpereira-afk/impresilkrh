import { tokenAtual } from "./auth";
import { FN_SYNC, ANON_PUBLICA } from "./supabase";

export const PERGUNTA_NPS = "De 0 a 10, quanto você recomendaria a Impresilk como um bom lugar para trabalhar?";
export const DIMENSOES_NPS = [
  { id: "clareza", tema: "Clareza", pergunta: "Sei o que se espera do meu trabalho." },
  { id: "recursos", tema: "Recursos", pergunta: "Tenho os materiais e ferramentas necessários para realizar meu trabalho." },
  { id: "lideranca", tema: "Liderança", pergunta: "Recebo apoio da minha liderança quando preciso." },
  { id: "reconhecimento", tema: "Reconhecimento", pergunta: "Meu trabalho é reconhecido de forma justa." },
  { id: "desenvolvimento", tema: "Desenvolvimento", pergunta: "Tenho oportunidades de aprender e me desenvolver." },
  { id: "respeito", tema: "Respeito", pergunta: "Sou tratado com respeito no ambiente de trabalho." },
  { id: "seguranca", tema: "Segurança", pergunta: "Tenho condições de realizar meu trabalho com segurança." },
  { id: "carga", tema: "Carga de trabalho", pergunta: "Consigo realizar minhas tarefas dentro da jornada combinada." },
  { id: "comunicacao", tema: "Comunicação", pergunta: "Recebo com clareza as informações que preciso para trabalhar." },
] as const;
export type ResultadoNps = { n: number; promotores: number; detratores: number; passivos: number; dimensoes: Record<string, { n: number; soma: number }>; prioridades: Record<string, number> };
export type AcaoNps = { id: string; titulo: string; responsavel: string; prazo: string; concluida: boolean; resultado?:string; concluido_em?:string };
export type CicloNps = { id: string; instrumento?:"clima"|"enps"|"pulso"|"legado"; publico?:string[]; titulo: string; dias: number; versao: number; abertura: string | null; fim: string | null; convidado: boolean; respondeu: boolean; elegiveis: number; recebidas: number | null; resultados: ResultadoNps | null; acoes: AcaoNps[] };
export function pontuacaoNps(r: ResultadoNps): number | null { return r.n >= 5 ? Math.round(1000 * (r.promotores - r.detratores) / r.n) / 10 : null; }
export function estadoNps(c: CicloNps, agora = Date.now()) { return !c.abertura ? "Rascunho" : c.fim && Date.parse(c.fim) <= agora ? "Encerrada" : "Em coleta"; }
export async function chamarNps(op: string, dados: Record<string, unknown> = {}): Promise<{ ok: boolean; ciclos?: CicloNps[]; jaRespondida?: boolean }> {
  const token = tokenAtual();
  if (!token || !FN_SYNC) throw new Error("Conecte-se ao RH para consultar e responder às pesquisas.");
  const controle = new AbortController(); const timer = setTimeout(() => controle.abort(), 20000);
  try {
    const resposta = await fetch(FN_SYNC, { method: "POST", signal: controle.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: ANON_PUBLICA }, body: JSON.stringify({ action: "nps", op, dados }), cache: "no-store" });
    const r = await resposta.json();
    if (tokenAtual() !== token) throw new Error("Sua sessão mudou. Abra a pesquisa novamente.");
    if (!resposta.ok || r.erro || !r.ok) throw new Error(r.erro || "Não foi possível confirmar a operação. Tente novamente.");
    return r;
  } finally { clearTimeout(timer); }
}

export function cicloComparavel(atual:CicloNps,anterior:CicloNps){
 const a=atual.publico??[],b=anterior.publico??[];
 return atual.id!==anterior.id && !!atual.abertura && !!anterior.abertura && anterior.abertura<atual.abertura && atual.instrumento===anterior.instrumento && atual.versao===anterior.versao && a.length>=5 && a.length===b.length && [...a].sort().join('|')===[...b].sort().join('|') && (atual.resultados?.n??0)>=5 && (anterior.resultados?.n??0)>=5;
}
