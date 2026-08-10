// ============================================================================
// POR QUE ESTA PESSOA NÃO ESTÁ NO BLOCO DE EXPERIÊNCIA?
//
// `situacaoExperiencia` devolve null em quatro situações, e em três delas a
// pessoa simplesmente SOME da tela — mesmo com a ficha dela dizendo, em letras
// garrafais, "Em experiência". Quem olha o quadro conta cinco pessoas, abre a
// ficha de uma sexta que diz "Em experiência", e não entende. O selo do topo
// piora: ele conta o BLOCO, não o status, então diz "5 em experiência" enquanto
// o cadastro tem seis marcados assim.
//
// Sumir em silêncio é o pior desfecho justamente no caso que mais custa: passar
// dos 90 dias sem decidir transforma o contrato em indeterminado sozinho, e a
// pessoa desaparece do aviso exatamente quando o prazo estoura.
//
// Esta função não julga: ela explica. Quem usa decide o que fazer.
// ============================================================================

import type { Colaborador } from "@/data/types";
import { HOJE } from "@/data/_gen";
import { parseData } from "@/lib/format";
import { situacaoExperiencia, LIMITE_EXPERIENCIA_DIAS } from "@/lib/clt";

export type ForaDaExperiencia =
  | { motivo: "sem-admissao" }
  | { motivo: "admissao-futura"; admissao: Date }
  | { motivo: "ja-decidida"; em: string }
  | { motivo: "desligado" }
  | { motivo: "prazo-passou"; diasDeCasa: number };

const DIA = 86_400_000;

/**
 * Devolve o motivo pelo qual a pessoa está FORA do bloco de experiência — ou
 * null quando ela está dentro (aí não há nada a explicar).
 *
 * A ordem das checagens é a mesma de `situacaoExperiencia`, senão a explicação
 * não corresponderia ao que de fato tirou a pessoa da lista.
 */
export function foraDaExperiencia(c: Colaborador, hoje: Date = HOJE): ForaDaExperiencia | null {
  if (situacaoExperiencia(c, hoje)) return null; // está no bloco: nada a explicar

  const adm = parseData(c.dataAdmissao);
  if (!adm) return { motivo: "sem-admissao" };
  if (c.experienciaDecididaEm) return { motivo: "ja-decidida", em: c.experienciaDecididaEm };
  if (c.dataDesligamento || c.statusId === "inativo") return { motivo: "desligado" };

  const diasDeCasa = Math.floor((hoje.getTime() - adm.getTime()) / DIA);
  if (diasDeCasa < 0) return { motivo: "admissao-futura", admissao: adm };
  return { motivo: "prazo-passou", diasDeCasa };
}

/** A frase que vai para a tela. Diz o fato e o que ele significa. */
export function explicar(f: ForaDaExperiencia): string {
  switch (f.motivo) {
    case "sem-admissao":
      return "Sem data de admissão — não dá para calcular o prazo.";
    case "admissao-futura":
      return `Admissão marcada para ${f.admissao.toLocaleDateString("pt-BR")} — ainda não começou.`;
    case "ja-decidida": {
      /* `parseData`, não `new Date(iso)`: a string "2026-08-01" é meia-noite
         UTC, que aqui (UTC-3) exibe 31/07 — a data VÉSPERA da que está gravada.
         parseData ancora ao meio-dia local e não escorrega. */
      const em = parseData(f.em);
      return `Experiência já decidida em ${em ? em.toLocaleDateString("pt-BR") : f.em} — falta acertar o status.`;
    }
    case "desligado":
      return "Já saiu da empresa — falta acertar o status.";
    case "prazo-passou":
      return `${f.diasDeCasa} dias de casa: passou dos ${LIMITE_EXPERIENCIA_DIAS} sem decisão, então o contrato JÁ É por tempo indeterminado.`;
  }
}
