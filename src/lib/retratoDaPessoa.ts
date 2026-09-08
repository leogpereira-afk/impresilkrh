// O retrato do que está pendurado nas pessoas, lido do store.
//
// EXISTE PARA UM DEFEITO NÃO VOLTAR. As regras puras (lib/cadastrosDuplicados,
// lib/apagarColaborador) recebem de fora um mapa "coleção → registros" e
// confiam nele. Quem monta esse mapa decide, sem saber, o que a regra vai
// enxergar — e em 07/09/2026 a ficha montava só com `COLECOES_DA_PESSOA`:
//
//   Object.fromEntries(COLECOES_DA_PESSOA.map((c) => [c, obterDinamico(c)]))
//
// Resultado: `porColecao["usuarios"]` era `undefined`, `inv.contas` saía
// sempre `[]`, e o impedimento "esta ficha tem conta de acesso" — escrito no
// mesmo dia para fechar exatamente esse buraco — NASCEU MORTO. Nenhum teste
// pegou, porque os testes montam o mapa à mão com a chave certa; só a tela
// real errava. É a "lista copiada falha calada" na sua forma mais traiçoeira:
// não a lista, mas quem a lê.
//
// Daqui em diante existe UMA função que monta o retrato, e ela usa
// `COLECOES_CONSULTADAS` — a união de tudo que as regras leem, derivada das
// próprias listas em vez de repetida à mão.
import { obterDinamico } from "@/lib/store";
import { COLECOES_CONSULTADAS, type RegistroPendurado } from "@/lib/cadastrosDuplicados";

/** Coleção → registros dela, para as regras que recebem o retrato de fora. */
export function retratoDaPessoa(): Record<string, RegistroPendurado[]> {
  const r: Record<string, RegistroPendurado[]> = {};
  for (const nome of COLECOES_CONSULTADAS) {
    r[nome] = obterDinamico(nome) as unknown as RegistroPendurado[];
  }
  return r;
}
