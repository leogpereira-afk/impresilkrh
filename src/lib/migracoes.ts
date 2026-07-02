// ============================================================================
// Migrações de dados locais. Rodam UMA vez a cada abertura do app, antes do
// primeiro render — consertam dados antigos que ficaram em formato velho no
// localStorage de cada computador.
//
// Caso concreto: o plano de contas importado antes de 2026-06 não tinha `id`
// em cada linha. O envio para a nuvem descarta registro sem id — por isso o
// plano ficou meses SÓ no computador que importou (0 registros na nuvem),
// enquanto folha e classificação subiam normalmente. Aqui geramos o id
// determinístico (mesma competência+código ⇒ mesmo id em qualquer computador)
// e empurramos a coleção para a nuvem.
// ============================================================================
import { NOMES_COLECOES } from "@/data";
import { obter, definirColecao } from "@/lib/store";
import { idConta } from "@/data/planoContas";
import { enviarColecao } from "@/lib/sync";

type RegSolto = { id?: string } & Record<string, unknown>;

function idPara(nome: string, reg: RegSolto, indice: number): string {
  if (nome === "planoContas" && reg.competencia && reg.codigo) {
    return idConta(String(reg.competencia), String(reg.codigo));
  }
  // Demais casos (raros): id aleatório no padrão do store.
  return `${nome}_mig_${Math.random().toString(36).slice(2, 9)}${indice.toString(36)}`;
}

export function rodarMigracoes(): void {
  for (const nome of NOMES_COLECOES) {
    const itens = obter(nome) as unknown as RegSolto[];
    if (!Array.isArray(itens) || !itens.some((r) => !r?.id)) continue;
    const vistos = new Set<string>();
    const corrigidos = itens.map((r, i) => {
      let id = r?.id || idPara(nome, r ?? {}, i);
      while (vistos.has(id)) id = `${id}_dup`; // competência+código repetido não se sobrescreve
      vistos.add(id);
      return r?.id === id ? r : { ...r, id };
    });
    definirColecao(nome as never, corrigidos as never);
    void enviarColecao(nome); // sobe já (ou entra na fila de retentativa se estiver offline)
  }
}
