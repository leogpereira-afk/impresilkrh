// Banco de pesquisas e dinâmicas (seed). Pesquisas têm perguntas; dinâmicas
// trazem o roteiro da atividade na descrição.
import type { Pesquisa } from "./types";

export const PESQUISAS: Pesquisa[] = [
  {
    id: "pesq_clima_2026",
    titulo: "Pesquisa de Clima 2026",
    descricao: "Como você percebe o ambiente, a liderança e o seu dia a dia na Impresilk.",
    tipo: "Pesquisa",
    status: "Ativa",
    anonima: true,
    publico: "Todos os colaboradores",
    criadoEm: "2026-02-01",
    perguntas: [
      { id: "q1", texto: "Sinto-me respeitado(a) e valorizado(a) no trabalho.", tipo: "Escala" },
      { id: "q2", texto: "Recebo feedback claro do meu gestor.", tipo: "Escala" },
      { id: "q3", texto: "Tenho os recursos necessários para fazer um bom trabalho.", tipo: "Escala" },
      { id: "q4", texto: "Recomendaria a Impresilk como um bom lugar para trabalhar.", tipo: "SimNao" },
      { id: "q5", texto: "O que mais te motiva aqui? E o que melhoraria?", tipo: "Texto" },
    ],
  },
  {
    id: "pesq_enps",
    titulo: "eNPS — Recomendação",
    descricao: "Numa escala de 0 a 10, o quanto você recomendaria a empresa para um amigo trabalhar?",
    tipo: "Pesquisa",
    status: "Ativa",
    anonima: true,
    publico: "Todos os colaboradores",
    criadoEm: "2026-03-15",
    perguntas: [
      { id: "q1", texto: "De 0 a 10, o quanto você recomendaria a Impresilk?", tipo: "Nps" },
      { id: "q2", texto: "Qual o principal motivo da sua nota?", tipo: "Texto" },
    ],
  },
  {
    id: "pesq_pulse_lideranca",
    titulo: "Pulse — Liderança (trimestral)",
    descricao: "Termômetro rápido sobre a relação com a liderança imediata.",
    tipo: "Pesquisa",
    status: "Rascunho",
    anonima: true,
    publico: "Equipes operacionais",
    criadoEm: "2026-05-20",
    perguntas: [
      { id: "q1", texto: "Meu líder reconhece meu esforço.", tipo: "Escala" },
      { id: "q2", texto: "Consigo falar abertamente com meu líder.", tipo: "Escala" },
    ],
  },
  {
    id: "din_2v1m",
    titulo: "Dinâmica: Duas verdades e uma mentira",
    descricao:
      "Quebra-gelo (15 min). Cada pessoa conta três afirmações sobre si — duas verdadeiras e uma falsa. O grupo tenta adivinhar qual é a mentira. Ótimo para integrar novos colaboradores e descontrair reuniões.",
    tipo: "Dinâmica",
    status: "Ativa",
    publico: "Equipe / novos colaboradores",
    criadoEm: "2026-01-10",
    perguntas: [],
  },
  {
    id: "din_roda_feedback",
    titulo: "Dinâmica: Feedback em roda",
    descricao:
      "Atividade de reconhecimento (30 min). Em círculo, cada pessoa diz uma qualidade que admira no colega à sua direita. Fortalece os vínculos e o clima. Conduzir com leveza e garantir que todos participem.",
    tipo: "Dinâmica",
    status: "Ativa",
    publico: "Equipe",
    criadoEm: "2026-04-05",
    perguntas: [],
  },
];
