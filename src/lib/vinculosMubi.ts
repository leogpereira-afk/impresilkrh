// A conferência dos vínculos guardados do ERP: nome do Mubisys → ficha.
//
// Um vínculo errado era INVISÍVEL: só reaparecia se o mesmo nome voltasse numa
// importação, e enquanto isso mandava dinheiro para a ficha errada em silêncio.
// O Léo achou um em 07/09/2026 — "PEDRO HENRIQUE SANTOS OLIVEIRA" apontando
// para o Pedro Henrique Golçalves Pereira, sendo que essa pessoa não existe na
// casa. O ERP corta o nome do favorecido em 30 letras, então dois nomes
// diferentes começam iguais e o olho não desconfia.
//
// A regra mora aqui, com teste, e não na tela: é identidade, não desenho.
import { casarColaborador, ehOrigemGenerica } from "./mubiPagamentos";
import type { Colaborador } from "@/data/types";

export interface VinculoSalvo {
  /** O nome como o ERP escreve (a chave guardada, já normalizada). */
  chave: string;
  colaboradorId: string;
  ficha: Colaborador | null;
  /** Por que este vínculo merece um olhar. */
  alerta: "generico" | "sem-ficha" | "nome-diferente" | null;
}

/**
 * Diz o que há de errado com cada vínculo — sem adivinhar.
 *
 *  • generico       — a origem é uma leva ("COLABORADORES"), não uma pessoa:
 *                     mandaria a folha inteira para uma ficha só.
 *  • sem-ficha      — aponta para uma ficha que não existe mais.
 *  • nome-diferente — o nome do ERP não casa com o nome da ficha nem pela régua
 *                     do casamento automático. Foi o caso de "PEDRO HENRIQUE
 *                     SANTOS OLIVEIRA" apontando para o Pedro Henrique
 *                     Golçalves Pereira (07/09/2026): o ERP corta o nome em 30
 *                     letras, e dois nomes diferentes começam igual.
 */
export function conferirVinculos(vinculos: Record<string, string>, colaboradores: Colaborador[]): VinculoSalvo[] {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  return Object.entries(vinculos)
    .map(([chave, colaboradorId]) => {
      const ficha = porId.get(colaboradorId) ?? null;
      const alerta: VinculoSalvo["alerta"] = ehOrigemGenerica(chave)
        ? "generico"
        : !ficha
          ? "sem-ficha"
          : casarColaborador(chave, [ficha], {}) ? null : "nome-diferente";
      return { chave, colaboradorId, ficha, alerta };
    })
    .sort((a, b) => (a.alerta === b.alerta ? a.chave.localeCompare(b.chave, "pt-BR") : a.alerta ? -1 : 1));
}

