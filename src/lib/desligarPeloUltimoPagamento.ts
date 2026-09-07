// Desligamento pelo último pagamento — a regra do Leonardo de 07/09/2026:
// "considerar pessoas que não recebem salário do mês de junho para trás como
// desligadas no último mês em que receberam; fazer isso em todos; os que ficam
// para a frente de junho de 2026 eu faço manual".
//
// Por que existe: a auditoria achou 11 fichas cujas datas contradizem os
// pagamentos, e a causa de a ficha de custo aparecer vazia é justamente a
// data de desligamento errada ou ausente. A folha é o registro mais confiável
// de quando alguém deixou de estar na casa: o último mês com lançamento.
//
// O que a regra NÃO faz, de propósito:
//   - direção (sócio) nunca é desligada por aqui;
//   - quem não tem lançamento nenhum fica de fora — não há "último mês";
//   - quem recebeu DEPOIS do limite fica para decisão humana.
import type { Colaborador, Pagamento } from "@/data/types";
import { VERBAS_DE_QUEM_SAIU } from "./consertoCadastro";

export interface PropostaDesligamento {
  colaboradorId: string;
  nome: string;
  /** Última competência com lançamento (AAAA-MM). */
  ultimoMes: string;
  de: { statusId?: string; dataDesligamento?: string | null };
  para: { statusId: "inativo"; dataDesligamento: string };
  /** "data" = só a data muda; "status" = só o status; "ambos". */
  muda: "data" | "status" | "ambos";
}

/** Último dia do mês (AAAA-MM → AAAA-MM-DD). */
export function fimDoMes(comp: string): string {
  const [y, m] = comp.split("-").map(Number);
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${comp}-${String(ultimo).padStart(2, "0")}`;
}

export function desligamentosPeloUltimoPagamento(
  colaboradores: Colaborador[],
  pagamentos: Pick<Pagamento, "colaboradorId" | "competencia" | "tipo">[],
  ate: string,
): PropostaDesligamento[] {
  if (!/^\d{4}-\d{2}$/.test(ate)) return [];
  const ultimo = new Map<string, string>();
  for (const p of pagamentos) {
    if (!p.colaboradorId || !/^\d{4}-\d{2}$/.test(String(p.competencia ?? ""))) continue;
    // "Último mês em que TRABALHOU" — o acerto de quem saiu não conta. FGTS e
    // INSS individualizados caem na competência SEGUINTE (a guia vence no dia
    // 20 e a janela é 16→15), então quem saiu em 15/04 com encargo lançado em
    // maio tinha a saída empurrada para 31/05: 46 dias a mais no quadro, no
    // relógio de férias e no turnover, dentro de um lote que a tela mostrava
    // como "só ajuste de data".
    if (VERBAS_DE_QUEM_SAIU.has(String(p.tipo ?? ""))) continue;
    const atual = ultimo.get(p.colaboradorId) ?? "";
    if (p.competencia > atual) ultimo.set(p.colaboradorId, p.competencia);
  }
  const out: PropostaDesligamento[] = [];
  for (const c of colaboradores) {
    if (c.ehDirecao || c.statusId === "direcao") continue;
    const u = ultimo.get(c.id);
    if (!u || u > ate) continue;
    const dataAtual = (c.dataDesligamento ?? "").slice(0, 10) || null;
    // A régua é o MÊS: se o RH já anotou uma saída dentro do último mês com
    // lançamento (o dia real, que alimenta férias e experiência), esse dia
    // fica. Só quem não tem data, ou tem data em outro mês, recebe o fim do
    // mês — que é o que a folha prova, na falta de coisa melhor.
    const mudaData = (dataAtual ?? "").slice(0, 7) !== u;
    const data = mudaData ? fimDoMes(u) : dataAtual!;
    const mudaStatus = c.statusId !== "inativo";
    if (!mudaData && !mudaStatus) continue;
    out.push({
      colaboradorId: c.id,
      nome: c.nome,
      ultimoMes: u,
      de: { statusId: c.statusId, dataDesligamento: dataAtual },
      para: { statusId: "inativo", dataDesligamento: data },
      muda: mudaData && mudaStatus ? "ambos" : mudaData ? "data" : "status",
    });
  }
  return out.sort((a, b) => a.ultimoMes.localeCompare(b.ultimoMes) || a.nome.localeCompare(b.nome, "pt-BR"));
}
