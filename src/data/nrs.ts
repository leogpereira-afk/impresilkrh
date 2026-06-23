// Catálogo de NRs (Normas Regulamentadoras) e certificações por colaborador.
// Para a Impresilk (comunicação visual): EPI, eletricidade, máquinas de corte/
// impressão, movimentação de materiais, montagem em altura de letreiros, etc.
import type { CertificacaoNR } from "./types";

export interface DefinicaoNR {
  codigo: string;
  nome: string;
  validadeMeses: number; // 0 = sem validade fixa (reciclagem conforme necessidade)
}

export const CATALOGO_NR: DefinicaoNR[] = [
  { codigo: "NR-06", nome: "EPI — Equipamento de Proteção Individual", validadeMeses: 0 },
  { codigo: "NR-10", nome: "Segurança em Instalações e Serviços em Eletricidade", validadeMeses: 24 },
  { codigo: "NR-11", nome: "Transporte, Movimentação, Armazenagem e Manuseio de Materiais", validadeMeses: 12 },
  { codigo: "NR-12", nome: "Segurança no Trabalho em Máquinas e Equipamentos", validadeMeses: 24 },
  { codigo: "NR-17", nome: "Ergonomia", validadeMeses: 0 },
  { codigo: "NR-18", nome: "Condições e Meio Ambiente na Indústria da Construção", validadeMeses: 12 },
  { codigo: "NR-33", nome: "Segurança nos Trabalhos em Espaços Confinados", validadeMeses: 12 },
  { codigo: "NR-35", nome: "Trabalho em Altura", validadeMeses: 24 },
];

export const nomeNR = (codigo: string) => CATALOGO_NR.find((n) => n.codigo === codigo)?.nome ?? codigo;
export const validadeMesesNR = (codigo: string) => CATALOGO_NR.find((n) => n.codigo === codigo)?.validadeMeses ?? 0;

// Calcula a data de validade (treinamento + meses de validade da NR). Sem
// validade fixa (0) → null. Não usa "agora": só monta a data a partir do texto.
export function calcularValidadeNR(dataTreinamento: string, codigo: string): string | null {
  const meses = validadeMesesNR(codigo);
  if (!meses || !dataTreinamento) return null;
  const d = new Date(`${dataTreinamento}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + meses);
  return d.toISOString().slice(0, 10);
}

// Seed: certificações da equipe de campo (instaladores/montagem). Mistura de
// situações (válido / a vencer / vencido) para o painel já nascer útil.
export const CERTIFICACOES_NR: CertificacaoNR[] = [
  { id: "nr_seed_1", colaboradorId: "adriano-nunes-araujo", nr: "NR-35", dataTreinamento: "2024-07-15", dataValidade: "2026-07-15", cargaHoraria: 8, instituicao: "SENAI" },
  { id: "nr_seed_2", colaboradorId: "adriano-nunes-araujo", nr: "NR-06", dataTreinamento: "2025-03-01", dataValidade: null, cargaHoraria: 4, instituicao: "Interno" },
  { id: "nr_seed_3", colaboradorId: "adriano-nunes-araujo", nr: "NR-10", dataTreinamento: "2023-05-01", dataValidade: "2025-05-01", cargaHoraria: 40, instituicao: "SENAI" },
  { id: "nr_seed_4", colaboradorId: "andre-juneo-ferreira-vieira", nr: "NR-35", dataTreinamento: "2024-07-01", dataValidade: "2026-07-01", cargaHoraria: 8, instituicao: "SENAI" },
  { id: "nr_seed_5", colaboradorId: "andre-juneo-ferreira-vieira", nr: "NR-06", dataTreinamento: "2025-01-10", dataValidade: null, cargaHoraria: 4, instituicao: "Interno" },
  { id: "nr_seed_6", colaboradorId: "adriano-pinheiro-lima", nr: "NR-35", dataTreinamento: "2025-09-01", dataValidade: "2027-09-01", cargaHoraria: 8, instituicao: "SENAI" },
  { id: "nr_seed_7", colaboradorId: "adriano-pinheiro-lima", nr: "NR-06", dataTreinamento: "2025-09-01", dataValidade: null, cargaHoraria: 4, instituicao: "Interno" },
  { id: "nr_seed_8", colaboradorId: "rony-plablo-soares-queiroz", nr: "NR-12", dataTreinamento: "2024-06-01", dataValidade: "2026-06-01", cargaHoraria: 16, instituicao: "SENAI" },
  { id: "nr_seed_9", colaboradorId: "rony-plablo-soares-queiroz", nr: "NR-06", dataTreinamento: "2025-02-01", dataValidade: null, cargaHoraria: 4, instituicao: "Interno" },
];
