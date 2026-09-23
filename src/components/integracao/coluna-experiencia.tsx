/* A coluna "Termina em" da listagem de quem está em contrato de experiência.
 *
 * Pedido do Léo (23/09/2026): "tem que aparecer os que estão em experiência, a
 * data e o dia que termina". O cartão dá o número e a próxima data; é aqui que
 * cada pessoa aparece com o SEU dia.
 *
 * POR QUE É UM ARQUIVO E NÃO JSX SOLTO NA PÁGINA: dentro das 1.400 linhas de
 * Integracao.tsx nada disto seria testável, e há dois casos que só aparecem no
 * dia ruim -- prazo já vencido (que não pode virar "faltam -5 dias") e pessoa
 * que não está na lista (a coluna recebe Colaborador cru do DrillModal, e
 * procurar pode não achar).
 */
import { formatDate } from "@/lib/format";
import type { PessoaEmExperiencia } from "@/lib/emExperiencia";

export function ColunaFimExperiencia({ pessoa }: { pessoa?: PessoaEmExperiencia }) {
  // Não achou: um traço, não uma data inventada nem a tela quebrada.
  if (!pessoa) return <span className="text-slate-400">—</span>;

  const dias = pessoa.sit.diasParaFim;
  /* A cor é o aviso que se lê de longe: vencido em vermelho, a menos de duas
     semanas em âmbar. Passar dos 90 dias sem decidir torna o contrato
     indeterminado sozinho -- é o caso caro, e ele não pode ter a mesma cara de
     quem ainda tem dois meses. */
  const classe =
    dias < 0 ? "font-medium text-red-600" : dias <= 15 ? "font-medium text-amber-700" : "text-slate-600";

  const quanto =
    dias < 0
      ? `venceu há ${Math.abs(dias)} dia(s)`
      : dias === 0
        ? "é hoje"
        : `faltam ${dias} dia(s)`;

  return (
    <span className={classe}>
      {formatDate(pessoa.sit.fim)} · {quanto}
    </span>
  );
}
