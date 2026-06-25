import type { Vaga, Candidato } from "./types";
import { HOJE } from "./_gen";

// Exemplo de vaga + candidatos (some no backup real — vide gen). Mostra como o
// módulo funciona: candidatos com nota para classificar/ranquear.
const iso = HOJE.toISOString();
const hoje = iso.slice(0, 10);

export const VAGAS: Vaga[] = [
  {
    id: "vaga-designer-pleno",
    titulo: "Designer Gráfico Pleno",
    areaId: "comercial",
    cargoId: "designer-grafico",
    nivelId: "N3",
    quantidade: 1,
    descricao: "Criação de artes para comunicação visual, sinalização e ambientação de marcas.",
    requisitos: "Domínio de Illustrator/Photoshop, portfólio e experiência com material para impressão.",
    status: "Aberta",
    dataAbertura: hoje,
    criadoEm: iso,
  },
];

export const CANDIDATOS: Candidato[] = [
  { id: "cand-1", vagaId: "vaga-designer-pleno", nome: "Ana Beatriz Lima", email: "ana.lima@email.com", telefone: "(38) 99999-0001", origem: "LinkedIn", nota: 8.5, etapa: "Entrevista", observacao: "Portfólio forte; ótima comunicação.", criadoEm: iso },
  { id: "cand-2", vagaId: "vaga-designer-pleno", nome: "Carlos Eduardo Souza", email: "cadu@email.com", telefone: "(38) 99999-0002", origem: "Indicação", nota: 6, etapa: "Triagem", observacao: "Pouca experiência com grande formato.", criadoEm: iso },
];
