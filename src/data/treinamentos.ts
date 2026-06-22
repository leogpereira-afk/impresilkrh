import type { Treinamento } from "./types";
import { COLABORADORES } from "./colaboradores";
import { mulberry32, HOJE, addDias } from "./_gen";

// Treinamento (v3) — quem está treinando e o que precisa treinar. Sintético/determinístico.
const ativos = COLABORADORES.filter((c) => !c.ehDirecao && c.statusId !== "inativo");
const lista: Treinamento[] = [];

ativos.forEach((c, i) => {
  const rng = mulberry32(21000 + i * 53);
  const rint = (a: number, b: number) => Math.floor(rng() * (b - a + 1)) + a;
  const operacao = c.areaId === "montagem" || c.areaId === "serralheria" || c.areaId === "producao";

  if (operacao && rng() < 0.7) {
    const prog = rint(0, 100);
    lista.push({
      id: `tre-epi-${c.id}`,
      colaboradorId: c.id,
      titulo: "Uso de EPIs e Segurança (NR-06)",
      tipo: "Segurança",
      status: prog >= 100 ? "Concluído" : prog > 0 ? "Em andamento" : "Pendente",
      progresso: prog,
      prazo: addDias(HOJE, rint(10, 90)).slice(0, 10),
      descricao: "Treinamento obrigatório de segurança e uso de equipamentos de proteção.",
    });
  }

  const mesesCasa = c.dataAdmissao ? (HOJE.getTime() - new Date(c.dataAdmissao).getTime()) / (86400000 * 30.44) : 999;
  if (mesesCasa < 6) {
    lista.push({
      id: `tre-onb-${c.id}`,
      colaboradorId: c.id,
      titulo: "Integração e treinamento inicial do cargo",
      tipo: "Onboarding",
      status: "Em andamento",
      progresso: rint(20, 90),
      prazo: addDias(HOJE, rint(5, 30)).slice(0, 10),
      descricao: "Trilha de integração e capacitação do novo colaborador.",
    });
  }

  if (rng() < 0.2) {
    lista.push({
      id: `tre-rec-${c.id}`,
      colaboradorId: c.id,
      titulo: "Reciclagem de Procedimentos (POPs)",
      tipo: "Reciclagem",
      status: "Pendente",
      progresso: 0,
      prazo: addDias(HOJE, rint(15, 120)).slice(0, 10),
      descricao: "Atualização dos procedimentos operacionais padrão da área.",
    });
  }
});

export const TREINAMENTOS: Treinamento[] = lista;
