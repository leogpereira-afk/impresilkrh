// ============================================================================
// Liga o store ao histórico de alterações e cuida do tamanho dele.
//
// Existe para juntar duas pontas sem criar ciclo de import:
//   store.ts     — avisa "alguém escreveu" (não sabe quem escuta)
//   auditoria.ts — decide o que vira linha (não sabe quem grava)
//   aqui         — grava de verdade, na coleção `alteracoes`
//
// TETO AUTOMÁTICO: o histórico é a única coleção que só cresce, e o
// localStorage tem limite. Quando ele estoura, o store perde a escrita em
// disco — ou seja, o log encheria o espaço e faria o CADASTRO parar de salvar.
// Por isso o corte é automático e acontece na própria gravação; a poda manual
// por data continua existindo, mas como conveniência, não como defesa.
// ============================================================================
import { criarEm, obter, definirColecao, aplicarSemSync, definirAuditor } from "./store";
import { auditar, definirEscritorDeHistorico } from "./auditoria";
import { apagarRegistrosNuvem, enviarColecao } from "./sync";
import type { Alteracao } from "@/data/types";

/**
 * Quantas linhas o navegador guarda. ~3.000 linhas × ~400 bytes ≈ 1,2 MB —
 * cabe folgado, e cobre meses de uso real. O que passa disso sai da ponta
 * velha: perder o registro de um ano atrás é aceitável; travar o sistema por
 * falta de espaço, não.
 */
export const TETO_LINHAS = 3000;

let ligado = false;

export function ligarHistorico(): void {
  // O módulo é importado uma vez, mas HMR e testes podem chamar de novo —
  // ligar duas vezes não duplica nada (o auditor é substituído, não somado),
  // e a guarda deixa a intenção explícita.
  if (ligado) return;
  ligado = true;
  definirEscritorDeHistorico((linha) => {
    criarEm("alteracoes", linha as Partial<Alteracao>);
    aparar();
  });
  definirAuditor(auditar);
}

/** Corta a ponta velha quando passa do teto. Escrita ÚNICA, não uma por linha. */
function aparar(): void {
  const linhas = obter("alteracoes") as Alteracao[];
  if (linhas.length <= TETO_LINHAS) return;
  const ordenadas = [...linhas].sort((a, b) => (b.criadoEm ?? "").localeCompare(a.criadoEm ?? ""));
  const ficam = ordenadas.slice(0, TETO_LINHAS);
  const saem = ordenadas.slice(TETO_LINHAS);
  // `aplicarSemSync` + `apagarRegistrosNuvem`: a poda local não pode virar
  // 500 mutações na fila. As lápides vão em bloco, num pedido só — sem elas o
  // próximo pull ressuscitaria tudo que acabou de sair.
  aplicarSemSync(() => definirColecao("alteracoes", ficam));
  apagarRegistrosNuvem("alteracoes", saem.map((l) => l.id));
}

/**
 * Poda manual (botão do master). Mesma mecânica do teto: UMA escrita local e
 * as lápides em bloco — apagar uma a uma reescrevia a coleção inteira N vezes
 * e enfileirava N chamadas HTTP.
 */
export function podarAntigos(ids: string[]): number {
  if (!ids.length) return 0;
  const fora = new Set(ids);
  const linhas = obter("alteracoes") as Alteracao[];
  aplicarSemSync(() => definirColecao("alteracoes", linhas.filter((l) => !fora.has(l.id))));
  apagarRegistrosNuvem("alteracoes", ids);
  return ids.length;
}

/** Empurra o histórico para a nuvem (o pull dos outros aparelhos traz de volta). */
export function enviarHistorico(): void {
  void enviarColecao("alteracoes");
}
