/* Troca a missão, a visão e os valores ANTIGOS do Código de Ética pelos novos.
 *
 * Pedido do Léo (26/09/2026): pôr no RH a missão, a visão e os valores de
 * 23/09. O RH já tinha os três, mas os antigos (6 valores, "Inovação com
 * Inteligência"...), dentro do Código de Ética -- somar os novos ao lado
 * deixaria duas missões diferentes no mesmo documento.
 *
 * SÓ A PARTE DE IDENTIDADE MUDA. O Código de Ética tem outras seções
 * (Abrangência, Temas principais) que ninguém pediu para mexer; a troca vai do
 * subtítulo "Missão" até o bloco antes do primeiro subtítulo que não seja
 * Missão, Visão ou Valores.
 *
 * O documento mora na nuvem e é editado pela tela; esta função só MONTA os
 * blocos. Quem grava é o botão, com o clique de quem é do RH.
 */
import type { Bloco } from "@/data/types";
import { MISSAO, VISAO, VALORES } from "@/data/identidade";

/** Versão do Código de Ética com a identidade de 23/09. Em 26/09 não havia
 *  nenhum aceite registrado, então subir a versão não obriga ninguém a aceitar
 *  de novo -- mas quem aceitar daqui para frente aceita o texto novo. */
export const VERSAO_IDENTIDADE_NOVA = "2026.2";

export function blocosDaIdentidade(): Bloco[] {
  return [
    { tipo: "subtitulo", texto: "Missão" },
    { tipo: "paragrafo", texto: MISSAO },
    { tipo: "subtitulo", texto: "Visão" },
    { tipo: "paragrafo", texto: VISAO },
    { tipo: "subtitulo", texto: "Valores" },
    { tipo: "passos", itens: VALORES.map((v) => `${v.titulo}. ${v.texto}`) },
  ];
}

const normal = (s?: string) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const ehSecaoDaIdentidade = (b: Bloco) =>
  b.tipo === "subtitulo" && ["missao", "visao", "valores"].includes(normal(b.texto));

/** Onde começa e onde termina a parte de identidade. null se não houver. */
function trecho(blocos: Bloco[]): { ini: number; fim: number } | null {
  const ini = blocos.findIndex(ehSecaoDaIdentidade);
  if (ini < 0) return null;
  let fim = ini + 1;
  while (fim < blocos.length && !(blocos[fim].tipo === "subtitulo" && !ehSecaoDaIdentidade(blocos[fim]))) fim++;
  return { ini, fim };
}

/** Os blocos do documento com a identidade nova no lugar da antiga. */
export function comIdentidadeNova(blocos: Bloco[] = []): Bloco[] {
  const t = trecho(blocos);
  const novos = blocosDaIdentidade();
  if (!t) return [...novos, ...blocos];
  return [...blocos.slice(0, t.ini), ...novos, ...blocos.slice(t.fim)];
}

/** O documento ainda tem a identidade ANTIGA (a de julho)?
 *
 * Pergunta pelo texto velho, e não por "está diferente do novo": se o RH
 * editar um valor à mão depois da troca, o aviso não pode voltar -- um clique
 * nele desfaria a edição de alguém sem ninguém perceber. */
export function precisaAtualizarIdentidade(blocos: Bloco[] = []): boolean {
  const texto = normal(JSON.stringify(blocos));
  return texto.includes(normal("Ajudar negócios a encontrarem sua essência"))
    || texto.includes(normal("Inovação com Inteligência"));
}
