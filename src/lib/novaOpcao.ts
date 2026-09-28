/* Área e cargo criados pelo "+" do cadastro da pessoa
 * (components/colaboradores/opcoes-da-lista).
 *
 * A regra é pura e tem teste, porque o caso ruim é silencioso: criar a mesma
 * área duas vezes ("Produção" e "producao") divide as pessoas em duas listas
 * que parecem uma só, e todo número por área passa a sair pela metade. Então:
 *  - nome que já existe (sem olhar acento, caixa ou espaço) NÃO cria outra:
 *    devolve a que existe, e a tela só a escolhe;
 *  - cargo mora dentro de uma área: o mesmo nome em outra área é outro cargo
 *    (id diferente), na mesma área é o mesmo;
 *  - id que já está em uso por outra coisa ganha sufixo, em vez de estourar.
 */
import { slug } from "@/data/_gen";
import type { Area, Cargo } from "@/data/types";

const chave = (s?: string | null) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

function idLivre(base: string, usados: Set<string>): string {
  if (!usados.has(base)) return base;
  let n = 2;
  while (usados.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export type Resultado<T> = { existente: T } | { nova: T } | { erro: string };

export function areaParaCriar(nome: string, areas: Area[]): Resultado<Area> {
  const n = nome.trim().replace(/\s+/g, " ");
  if (!n) return { erro: "Escreva o nome da área." };
  const igual = areas.find((a) => chave(a.nome) === chave(n));
  if (igual) return { existente: igual };
  /* O nome curto de uso diário ("Produção") dá o mesmo id da área cadastrada
     com o nome longo ("Produção e Comunicação Visual", id "producao"). É quase
     sempre a mesma área: criar "producao-2" calado era abrir a lista dupla que
     este arquivo existe para evitar. Pergunta, dizendo qual é. */
  const mesmoId = areas.find((a) => a.id === slug(n));
  if (mesmoId) return { erro: `Já existe a área "${mesmoId.nome}". Se é ela, escolha na lista; se é outra, use um nome mais completo.` };
  const id = idLivre(slug(n) || "area", new Set(areas.map((a) => a.id)));
  const ordem = areas.reduce((m, a) => Math.max(m, Number.isFinite(a.ordem) ? a.ordem : 0), -1) + 1;
  return { nova: { id, nome: n, descricao: "", ordem } };
}

export function cargoParaCriar(nome: string, areaId: string | null | undefined, cargos: Cargo[], areas: Area[]): Resultado<Cargo> {
  const n = nome.trim().replace(/\s+/g, " ");
  if (!n) return { erro: "Escreva o nome do cargo." };
  if (!areaId) return { erro: "Escolha a área primeiro: o cargo fica dentro de uma área." };
  // A área pode ter sido apagada em outra aba enquanto o cadastro estava
  // aberto: cargo criado nela nasceria órfão, pendurado num id que não existe.
  if (!areas.some((a) => a.id === areaId)) return { erro: "A área escolhida não existe mais. Escolha outra na lista." };
  const igual = cargos.find((c) => c.areaId === areaId && (chave(c.nome) === chave(n) || slug(c.nome) === slug(n)));
  if (igual) return { existente: igual };
  const usados = new Set(cargos.map((c) => c.id));
  const base = slug(n) || "cargo";
  // O mesmo nome em outra área já tem o id "limpo": este leva a área junto.
  const id = idLivre(usados.has(base) ? `${base}-${areaId}` : base, usados);
  // Faixas zeradas, como o "Novo cargo" da tela de Cargos: o valor de cada
  // nível é decisão do RH, feita lá. Zerado quer dizer "ainda sem faixa", e o
  // enquadramento responde "Sem dados" (lib/dominio), não "Acima".
  return { nova: { id, nome: n, areaId, faixas: [0, 0, 0, 0, 0] } };
}
