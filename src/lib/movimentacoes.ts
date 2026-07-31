// ============================================================================
// Movimentação de carreira — o que entra na linha do tempo da pessoa.
//
// Fica na lib, e não na página, porque os DOIS caminhos de edição precisam
// disso: a edição no lugar da ficha e o formulário completo. Importar de uma
// página para dentro de um componente fecharia um ciclo de imports.
// ============================================================================
import { formatBRL, diaLocalISO } from "@/lib/format";
import { HOJE } from "@/data/_gen";
import type { Dominio } from "@/lib/dominio";
import type { Colaborador } from "@/data/types";

/**
 * Registra no histórico o que mudou na carreira da pessoa.
 *
 * O histórico mentia por omissão: promover alguém, reajustar o salário ou mudar
 * o cargo alterava o cadastro e mais nada. Meses depois, "desde quando ele é
 * Supervisor?" ou "quando foi o último aumento?" não tinham resposta no
 * sistema — só a admissão e o desligamento deixavam rastro. Agora cada uma
 * dessas três mudanças vira um registro com o antes e o depois.
 *
 * Uma edição que mexe em várias coisas de uma vez (subir de nível E de salário)
 * gera UM registro só, do tipo mais forte — senão a linha do tempo viraria uma
 * lista de micro-eventos do mesmo instante.
 */
export function registrarMovimentacaoDeCarreira(
  antes: Colaborador,
  depois: Colaborador,
  d: Dominio,
  criarMov: (m: Record<string, unknown>) => unknown,
) {
  const mudouSalario = (antes.salario ?? null) !== (depois.salario ?? null);
  const mudouCargo = (antes.cargoId ?? null) !== (depois.cargoId ?? null);
  const mudouNivel = (antes.nivelId ?? null) !== (depois.nivelId ?? null);
  if (!mudouSalario && !mudouCargo && !mudouNivel) return;

  // Nível para número ("N3" → 3) só para saber se subiu ou desceu.
  const grau = (id?: string | null) => Number(String(id ?? "").replace(/\D/g, "")) || 0;
  const subiuDeNivel = mudouNivel && grau(depois.nivelId) > grau(antes.nivelId);

  const tipo = subiuDeNivel ? "Promoção" : mudouCargo ? "Mudança de Cargo" : mudouNivel ? "Mudança de Nível" : "Reajuste";
  const partes: string[] = [];
  if (mudouCargo) partes.push(`cargo ${d.nomeCargo(antes)} → ${d.nomeCargo(depois)}`);
  if (mudouNivel) partes.push(`nível ${d.nomeNivel(antes.nivelId)} → ${d.nomeNivel(depois.nivelId)}`);
  if (mudouSalario) partes.push(`salário ${formatBRL(antes.salario)} → ${formatBRL(depois.salario)}`);

  criarMov({
    colaboradorId: antes.id,
    tipo,
    data: diaLocalISO(HOJE),
    descricao: `${partes.join(" · ")}. Alterado na ficha.`,
    cargoAnterior: mudouCargo ? d.nomeCargo(antes) : null,
    cargoNovo: mudouCargo ? d.nomeCargo(depois) : null,
    nivelAnterior: mudouNivel ? (antes.nivelId ?? null) : null,
    nivelNovo: mudouNivel ? (depois.nivelId ?? null) : null,
    salarioAnterior: mudouSalario ? (antes.salario ?? null) : null,
    salarioNovo: mudouSalario ? (depois.salario ?? null) : null,
    registradoPor: "RH",
  });
}
