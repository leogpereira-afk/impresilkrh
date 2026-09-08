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
  /** Por que este vínculo merece um olhar. `null` = nada a dizer. */
  alerta: "generico" | "sem-ficha" | "nome-diferente" | null;
  /** O RH olhou este par nome→ficha e disse que está certo. */
  conferido: boolean;
  /**
   * Faz sentido oferecer o botão "Está certo"? Fato não se cala: ficha que não
   * existe e origem que não é pessoa continuam avisando por mais que alguém
   * olhe. Mora aqui para a tela não repetir a régua e as duas divergirem.
   */
  podeConferir: boolean;
  /**
   * O que a régua automática APONTARIA para este nome hoje, se não houvesse
   * vínculo guardado. É a alternativa que a tela oferece quando o vínculo
   * parece errado — sem ela, a única saída era apagar e torcer.
   */
  sugestao: Colaborador | null;
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
/** Que avisos são JUÍZO (dá para dizer "está certo") e não fato consumado. */
function podeSerConferido(alerta: VinculoSalvo["alerta"]): boolean {
  return alerta === "nome-diferente";
}

export function conferirVinculos(
  vinculos: Record<string, string>,
  colaboradores: Colaborador[],
  /** chave → colaboradorId já conferido pelo RH (config.vinculosMubiConferidos). */
  conferidos: Record<string, string> = {},
): VinculoSalvo[] {
  const porId = new Map(colaboradores.map((c) => [c.id, c]));
  return Object.entries(vinculos)
    .map(([chave, colaboradorId]) => {
      const ficha = porId.get(colaboradorId) ?? null;
      // Conferir vale para o PAR nome→ficha: reapontar para outra pessoa faz o
      // aviso voltar sozinho.
      const conferido = conferidos[chave] === colaboradorId && !!ficha;
      const bruto: VinculoSalvo["alerta"] = ehOrigemGenerica(chave)
        ? "generico"
        : !ficha
          ? "sem-ficha"
          : casarColaborador(chave, [ficha], {}) ? null : "nome-diferente";
      // "sem-ficha" não se cala com um "conferi": a ficha não existe, e isso é
      // fato, não opinião. Os outros dois são juízo sobre o nome — e aí quem
      // olhou decide.
      // FATO NÃO SE CALA COM UM "CONFERI".
      //
      // "ficha não existe" e "não é uma pessoa" são verificáveis: a ficha
      // sumiu do cadastro, e "COLABORADORES" é uma leva do ERP, não gente.
      // Nenhum vira certo porque alguém olhou. Só "confira o nome" é juízo —
      // se quem olhou diz que aquele nome truncado é mesmo aquela ficha, ela
      // sabe mais do que a régua.
      //
      // Estava frouxo: só "sem-ficha" resistia, e em 08/09/2026 o Léo marcou
      // "COLABORADORES → Pedro Ramos" como conferido. O aviso sumiu e o
      // vínculo — a LEVA da folha apontada para o Fundador — continuou
      // guardado, sem ninguém mais lembrar dele. É o que este painel existe
      // para impedir.
      const alerta = conferido && podeSerConferido(bruto) ? null : bruto;
      // A alternativa: quem a régua automática acharia para este nome hoje.
      const sugestao = casarColaborador(chave, colaboradores, {}) ?? null;
      return {
        chave, colaboradorId, ficha, alerta, conferido,
        sugestao: sugestao && sugestao.id !== colaboradorId ? sugestao : null,
        podeConferir: !!alerta && podeSerConferido(alerta),
      };
    })
    .sort((a, b) => (a.alerta === b.alerta ? a.chave.localeCompare(b.chave, "pt-BR") : a.alerta ? -1 : 1));
}

