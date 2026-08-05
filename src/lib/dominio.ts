// Lógica de domínio (pura) + hook de lookups reativos. Usado por todos os módulos.
import { useMemo } from "react";
import { useColecao } from "./store";
import type { Cargo, Colaborador, StatusColaborador } from "@/data/types";
import { MAPA_SENIORIDADE } from "./constants";

/* "Sem dados" não é uma posição na faixa — é a ausência dela. Antes, quem não
   tinha salário ou cargo caía no `return "Dentro"` e ganhava selo VERDE, como
   se o salário tivesse sido conferido e estivesse na faixa. São 3 pessoas no
   quadro hoje. Dizer "não sei" é mais honesto e é acionável: aparece na tela
   como cadastro a completar, em vez de sumir no meio do que está certo. */
export type Enquadramento = "Crítico" | "Abaixo" | "Dentro" | "Acima" | "Sem dados";

// Enquadramento do salário frente à faixa do cargo (N1→N5). Apêndice C.
export function enquadrar(salario: number | null | undefined, faixas?: number[]): Enquadramento {
  if (salario == null || !faixas || faixas.length === 0) return "Sem dados";
  const min = faixas[0];
  const max = faixas[faixas.length - 1];
  if (salario < min * 0.92) return "Crítico";
  if (salario < min) return "Abaixo";
  if (salario > max) return "Acima";
  return "Dentro";
}

export function indiceNivel(nivelId?: string | null): number {
  if (!nivelId) return 0;
  const n = parseInt(nivelId.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

export function senioridadeDe(nivelId?: string | null): string {
  return nivelId ? MAPA_SENIORIDADE[nivelId] ?? "—" : "—";
}

export function faixaNoNivel(cargo?: Cargo, nivelId?: string | null): number | null {
  if (!cargo || !nivelId) return null;
  const i = indiceNivel(nivelId) - 1;
  return cargo.faixas[i] ?? null;
}

/**
 * A pessoa ainda pode ser COBRADA por uma pendência (exame, certificação,
 * treinamento, termo, férias)?
 *
 * Regra: só sai quem DESLIGOU. Diferente de `contaHeadcount`, que serve para
 * contar o quadro e por isso tira também a direção e quem não conta como
 * ativo — ali a pergunta é "quantas pessoas temos"; aqui é "de quem ainda faz
 * sentido cobrar". Afastado continua entrando: ele volta, e o exame dele tem de
 * estar em dia quando voltar. Direção também: sócio faz exame ocupacional.
 *
 * Existe porque cada tela vinha inventando a sua: SST cobrava exame de quem
 * saiu (23 "vencidos" numa lista em que boa parte já não trabalha aqui),
 * enquanto a aba de Certificações da MESMA tela filtrava — duas regras
 * diferentes a dois cliques de distância.
 */
export function noQuadro(c: Colaborador): boolean {
  return c.statusId !== "inativo" && !c.dataDesligamento;
}

/**
 * Está de fato TRABALHANDO hoje — presente e ficando.
 *
 * É mais estreito que `noQuadro`, e de propósito. `noQuadro` responde "ainda é
 * funcionário?" e por isso inclui quem está afastado (ele volta, e o exame dele
 * tem de estar em dia). Há perguntas em que isso não serve: quem pode apadrinhar
 * um recém-chegado, por exemplo, precisa estar na casa nos próximos meses.
 *
 * Fica de fora:
 *  - inativo e desligado (já não é funcionário);
 *  - ABANDONO — parou de vir, mesmo sem o desligamento lançado. Medido em
 *    05/08/2026: uma pessoa nesse estado aparecia como candidata a padrinho;
 *  - aviso prévio — está de saída, não vai acompanhar ninguém;
 *  - afastado e atestado médico — não está aqui agora;
 *  - direção — não entra em lista de colaborador.
 */
const STATUS_PRESENTE = new Set(["ativo", "experiencia"]);

export function trabalhandoHoje(c: Colaborador): boolean {
  if (c.ehDirecao) return false;
  if (!noQuadro(c)) return false;
  return STATUS_PRESENTE.has(String(c.statusId ?? ""));
}

export function contaHeadcount(c: Colaborador, statusById: Map<string, StatusColaborador>): boolean {
  if (c.ehDirecao) return false;
  if (c.dataDesligamento) return false;
  const s = c.statusId ? statusById.get(c.statusId) : undefined;
  return s?.contaComoAtivo ?? false;
}

// Hook de domínio: coleções de referência + mapas e helpers de rótulo.
export function useDominio() {
  const { items: areas } = useColecao("areas");
  const { items: cargos } = useColecao("cargos");
  const { items: niveis } = useColecao("niveis");
  const { items: status } = useColecao("status");
  const { items: colaboradores } = useColecao("colaboradores");

  return useMemo(() => {
    const areaById = new Map(areas.map((a) => [a.id, a]));
    const cargoById = new Map(cargos.map((c) => [c.id, c]));
    const nivelById = new Map(niveis.map((n) => [n.id, n]));
    const statusById = new Map(status.map((s) => [s.id, s]));
    const colabById = new Map(colaboradores.map((c) => [c.id, c]));

    const nomeArea = (id?: string | null) => (id ? areaById.get(id)?.nome ?? "—" : "—");
    // O CARGO REAL manda; `cargoLivre` é o rótulo de quem não tem cargo (Direção
    // e quem veio da planilha só com a função).
    //
    // Era o contrário, e o contrário mentia: quem tinha rótulo livre e depois
    // recebia um cargo de verdade continuava aparecendo com o texto antigo na
    // tela inteira, enquanto a faixa salarial e o enquadramento passavam a ser
    // calculados pelo cargo novo — invisível. Nesta ordem, atribuir um cargo já
    // corrige a exibição sozinho, sem precisar apagar o rótulo (apagar era pior:
    // não tinha volta, porque a ficha não mostra esse campo).
    const nomeCargo = (c: Colaborador) =>
      (c.cargoId ? cargoById.get(c.cargoId)?.nome : null) || c.cargoLivre || "—";
    const nomeNivel = (id?: string | null) => (id ? nivelById.get(id)?.codigo ?? "—" : "—");
    const nomeColab = (id?: string | null) => (id ? colabById.get(id)?.nome ?? "—" : "—");
    // Foto da pessoa pelo id — as telas que só guardam o colaboradorId (férias,
    // ponto, treinamento, SST...) usam isto para alimentar o <Avatar>.
    const fotoColab = (id?: string | null) => (id ? colabById.get(id)?.fotoDataUrl ?? null : null);
    const corStatus = (id?: string | null) => (id ? statusById.get(id)?.cor ?? "#64748b" : "#64748b");
    const nomeStatus = (id?: string | null) => (id ? statusById.get(id)?.nome ?? "—" : "—");

    const ativos = colaboradores.filter((c) => contaHeadcount(c, statusById));
    const faixaColab = (c: Colaborador) =>
      c.cargoId ? faixaNoNivel(cargoById.get(c.cargoId), c.nivelId) : null;
    const enquadrarColab = (c: Colaborador): Enquadramento => {
      const cargo = c.cargoId ? cargoById.get(c.cargoId) : undefined;
      // CALCULA SEMPRE que dá para calcular. Preferir o valor gravado deixava o
      // selo congelado no dia em que foi salvo: mexer na faixa do cargo em
      // Carreira e Salários mudava a régua de todo mundo daquele cargo, e a
      // ficha continuava mostrando "Dentro" com base na faixa velha. O campo
      // gravado vira só registro histórico, usado quando não há cargo/salário.
      if (cargo?.faixas?.length && c.salario != null) return enquadrar(c.salario, cargo.faixas);
      return (c.enquadramento as Enquadramento) ?? enquadrar(c.salario, cargo?.faixas);
    };

    // Subárea (nível abaixo da área) — usa o valor salvo ou deriva do cargo/função.
    const subareaDe = (c: Colaborador): string => {
      if (c.subarea) return c.subarea;
      const fn = (c.funcao ?? "").toLowerCase();
      const cid = c.cargoId ?? "";
      switch (c.areaId) {
        case "adm":
          if (cid === "rh-dp" || /\brh\b/.test(fn)) return "RH e DP";
          if (cid === "assistente-suprimentos" || /(compra|suprim|almox)/.test(fn)) return "Compras e Suprimentos";
          if (cid === "analista-pcp" || /pcp/.test(fn)) return "PCP";
          if (/financ/.test(fn)) return "Financeiro";
          if (cid === "gerente-operacoes" || cid === "gerente-administrativo" || cid === "coordenador-administrativo") return "Gestão";
          return "Administração";
        case "producao":
          if (cid === "impressor") return "Impressão";
          if (cid === "operador-cnc") return "CNC";
          if (cid === "designer-grafico" || cid === "projetista") return "Design e Projetos";
          if (cid === "pintor-cv") return "Pintura";
          if (cid === "lider-producao") return "Liderança de Produção";
          return "Operação de Comunicação Visual";
        case "comercial":
          if (cid === "consultor-vendas" || /vend/.test(fn)) return "Vendas";
          return "Atendimento";
        case "montagem":
          return "Montagem e Instalação";
        case "serralheria":
          return "Serralheria e Metalurgia";
        case "direcao":
          return "Diretoria";
        default:
          return nomeArea(c.areaId);
      }
    };

    return {
      areas, cargos, niveis, status, colaboradores,
      areaById, cargoById, nivelById, statusById, colabById,
      nomeArea, nomeCargo, nomeNivel, nomeColab, fotoColab, corStatus, nomeStatus,
      ativos, faixaColab, enquadrarColab, subareaDe,
    };
  }, [areas, cargos, niveis, status, colaboradores]);
}

export type Dominio = ReturnType<typeof useDominio>;
