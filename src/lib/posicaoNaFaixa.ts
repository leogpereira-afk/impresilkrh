// ============================================================================
// ONDE O SALÁRIO DE ALGUÉM CAI DENTRO DA FAIXA DO CARGO.
//
// A tela dizia "Dentro" ou "Abaixo" e parava aí. Só que "Dentro" cobre o piso e
// o teto da mesma forma: quem está no N1 e quem está no N5 recebiam o mesmo
// rótulo, e não dava para ver quem tem espaço para crescer no próprio cargo.
//
// Aqui a resposta é uma POSIÇÃO — a bolinha na régua. O rótulo de enquadramento
// continua mandando na cor, porque ele é a regra do plano de carreira; a posição
// só mostra o quanto falta para o próximo degrau.
// ============================================================================

import { enquadrar } from "@/lib/dominio";

export interface PosicaoNaFaixa {
  /** 0 a 100 — onde a bolinha fica na régua do piso ao teto. */
  pct: number;
  enquadramento: string;
  /** O salário saiu da faixa (abaixo do piso ou acima do teto)? */
  foraDaFaixa: boolean;
}

export function posicaoNaFaixa(
  salario: number | null | undefined,
  faixas?: readonly number[],
): PosicaoNaFaixa | null {
  if (salario == null || !Number.isFinite(salario)) return null;
  if (!faixas || faixas.length === 0) return null;

  const min = faixas[0];
  const max = faixas[faixas.length - 1];
  const enquadramento = enquadrar(salario, faixas as number[]);
  const foraDaFaixa = salario < min || salario > max;

  /* Faixa de valor único (piso == teto) existe no cadastro e dividiria por
     zero. Nesse caso a régua não tem onde variar: a bolinha fica no meio, que
     é a leitura honesta de "não há degrau dentro deste cargo". */
  if (max === min) return { pct: 50, enquadramento, foraDaFaixa };

  const bruto = ((salario - min) / (max - min)) * 100;
  // Preso entre as pontas: quem está acima do teto não pode desenhar a bolinha
  // fora da régua, e o fato de estar fora já é dito pelo rótulo e pela cor.
  const pct = Math.min(100, Math.max(0, bruto));
  return { pct, enquadramento, foraDaFaixa };
}
