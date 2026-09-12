/** Planejamento e apuração operacional. Não são lançamentos de folha. */
export interface ParticipantePlantao {
  colaboradorId: string;
  situacao: 'Escalado' | 'Confirmado' | 'Realizado' | 'Dispensado';
  realizadoMin: number | null;
  extrasMin: number | null;
}
export interface Plantao {
  id: string;
  titulo: string;
  data: string;
  inicio: string;
  fim: string;
  intervaloMin: number;
  tipo: 'Sábado' | 'Hora extra' | 'Empreita';
  local: string;
  osNumero: string;
  observacao: string;
  participantes: ParticipantePlantao[];
  cancelado: boolean;
  criadoPor: string;
  atualizadoEm: string;
}
export interface OrdemPerformance {
  participantesRH?: string[];
  id: string;
  numero: string;
  cliente: string;
  servico: string;
  finalizadaEm: string;
  prazo: string;
  equipe: string[];
  retrabalho: boolean;
  baixaAutomatica: boolean;
  atualizadoEm: string;
}
export interface EntregaPerformance {
  id: string;
  colaboradorId: string;
  os: OrdemPerformance;
  participacao: number;
  complexidade: number;
  evidencia: string;
  aceite: boolean;
  qualidade: 'pendente' | 'sem_retrabalho' | 'execucao' | 'externo';
  prazo: 'pendente' | 'no_prazo' | 'atraso' | 'externo';
  justificativa: string;
}
export interface RegraPerformance {
  pesos: { entrega: number; qualidade: number; prazo: number; colaboracao: number };
  notaMinima: number;
  qualidadeMinima: number;
  tetoIndividual: number;
  orcamento: number;
  referencia: string;
}
export interface PessoaPerformance {
  colaboradorId: string;
  habitual: number;
  meta: number;
  colaboracao: [number | null, number | null, number | null];
  evidenciaColaboracao: string;
  contexto: string;
  aprovacao?: { valor: number; nota: number; em: string; por: string; justificativa: string; regra: RegraPerformance };
}
export interface CicloPerformance {
  id: string;
  competencia: string;
  regra: RegraPerformance;
  pessoas: PessoaPerformance[];
  entregas: EntregaPerformance[];
  historico: { em: string; por: string; acao: string }[];
  atualizadoEm: string;
}

export interface EquipePlantao { id: string; nome: string; colaboradorIds: string[]; atualizadoEm: string }
