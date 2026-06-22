// ===================== Tipos de domínio — Sistema de RH Impresilk =====================
// Modelo de dados da SPA (sem banco). Todas as coleções são arrays destes tipos,
// persistidos em localStorage pela camada src/lib/store.ts.

export type Perfil = "ADMIN_RH" | "GESTOR" | "COLABORADOR";

export interface Area {
  id: string;
  nome: string;
  descricao?: string;
  ordem: number;
}

export interface Nivel {
  id: string; // "N1".."N5"
  codigo: string;
  nome: string; // Júnior, Pleno, Sênior
  senioridade: string;
  ordem: number;
  descricao?: string;
}

export interface Cargo {
  id: string;
  nome: string;
  areaId: string;
  descricao?: string;
  competenciasTecnicas?: string;
  competenciasComportamentais?: string;
  indicadores?: string;
  requisitos?: string;
  trilha?: string;
  // Faixa salarial por nível N1..N5 (R$). Apêndice C.
  faixas: [number, number, number, number, number];
}

export interface StatusColaborador {
  id: string;
  nome: string;
  cor: string;
  contaComoAtivo: boolean; // entra no headcount?
  ordem: number;
}

export interface Colaborador {
  id: string;
  nome: string;
  cpf?: string;
  email?: string;
  telefone?: string;
  dataNascimento?: string;
  dataAdmissao?: string;
  dataDesligamento?: string | null;

  enderecoRua?: string;
  enderecoNumero?: string;
  enderecoComplemento?: string | null;
  enderecoBairro?: string;
  enderecoCep?: string;

  conjugeNome?: string | null;
  conjugeTelefone?: string | null;
  qtdFilhos?: number;

  cargoId?: string | null;
  nivelId?: string | null;
  areaId?: string | null;
  gestorId?: string | null;

  salario?: number | null;
  matriculaEsocial?: string;
  valeTransporte?: boolean;

  statusId?: string;

  // Enquadramento salarial (Apêndice C/F)
  refMin?: number | null;
  refMax?: number | null;
  enquadramento?: string | null; // Crítico, Abaixo, Dentro, Acima
  observacaoEnquadramento?: string | null;

  // Retenção / 9-box
  riscoSaida?: string; // Baixo, Médio, Alto
  potencial?: string; // Baixo, Médio, Alto

  // Acesso / hierarquia institucional
  perfil?: Perfil; // perfil de login (quando aplicável)
  ehDirecao?: boolean; // fundadores/diretor/assessorias — não contam como headcount
  cargoLivre?: string; // rótulo de cargo p/ Direção (sem cargoId)
}

export interface Documento {
  id: string;
  colaboradorId: string;
  categoria: string;
  nome: string;
  arquivoNome?: string | null;
  arquivoDataUrl?: string | null; // upload no navegador (data URL)
  tamanhoBytes?: number | null;
  dataEmissao?: string | null;
  dataVencimento?: string | null;
  observacao?: string | null;
  enviadoPor?: string;
  criadoEm: string;
}

// Bloco de conteúdo rico (editável no Painel de Controle)
export type BlocoTipo = "titulo" | "subtitulo" | "paragrafo" | "lista" | "passos" | "destaque";
export interface Bloco {
  tipo: BlocoTipo;
  texto?: string;
  itens?: string[];
}

export interface DocumentoInstitucional {
  id: string;
  titulo: string;
  categoria: string; // Código de Ética, POP, Comunicação, Treinamento, SST
  descricao?: string;
  conteudo?: string; // texto simples (compatibilidade)
  blocos?: Bloco[];
  versao?: string;
  atualizadoEm: string;
}

// Guia de Comunicação interna (Apêndice D) — conteúdo rico em blocos
export interface GuiaComunicacao {
  id: string;
  titulo: string;
  descricao?: string;
  blocos: Bloco[];
  versao?: string;
  ordem: number;
  atualizadoEm: string;
}

// POP / Procedimento (Apêndice E) — conteúdo rico em blocos
export interface POP {
  id: string;
  titulo: string;
  descricao?: string;
  sla?: string;
  blocos: Bloco[];
  versao?: string;
  ordem: number;
  atualizadoEm: string;
}

export interface Ferias {
  id: string;
  colaboradorId: string;
  periodoAquisitivoInicio?: string | null;
  periodoAquisitivoFim?: string | null;
  dataInicio?: string | null;
  dataRetorno?: string | null;
  diasGozados: number;
  saldoDias: number;
  status: string; // Em aberto, Agendada, Em andamento, Concluída
  observacao?: string | null;
}

export interface Movimentacao {
  id: string;
  colaboradorId: string;
  tipo: string;
  data: string;
  descricao?: string;
  cargoAnterior?: string | null;
  cargoNovo?: string | null;
  nivelAnterior?: string | null;
  nivelNovo?: string | null;
  salarioAnterior?: number | null;
  salarioNovo?: number | null;
  registradoPor?: string;
}

export interface CicloAvaliacao {
  id: string;
  nome: string;
  dataInicio: string;
  dataFim: string;
  status: string; // Aberto, Fechado
  pesoTecnico: number;
  pesoComportamental: number;
  pesoResultado: number;
  notaMinPromocao: number;
  mesesMinNivel: number;
}

export interface Avaliacao {
  id: string;
  cicloId: string;
  colaboradorId: string;
  avaliadorId?: string | null;
  tipo: string; // AUTO, GESTOR
  notaTecnico?: number | null;
  notaComportamental?: number | null;
  notaResultado?: number | null;
  notaFinal?: number | null;
  statusDesempenho?: string | null;
  tempoNoNivelMeses?: number | null;
  advertencia?: boolean;
  liderancaAprovou?: boolean;
  elegivelPromocao?: boolean;
  proximoNivel?: string | null;
  planoAcao?: string | null;
  comentarios?: string | null;
  status: string;
  criadoEm: string;
}

export interface Meta {
  id: string;
  titulo: string;
  descricao?: string;
  tipo: string; // Individual, Área
  colaboradorId?: string | null;
  areaId?: string | null;
  indicador?: string;
  valorAlvo?: number;
  valorAtual?: number;
  unidade?: string;
  prazo?: string | null;
  status: string;
}

export interface PDI {
  id: string;
  colaboradorId: string;
  competencia: string;
  acao: string;
  resultadoEsperado?: string;
  prazo?: string | null;
  status: string;
  progresso: number;
}

export interface Feedback {
  id: string;
  colaboradorId: string;
  autorId?: string | null;
  tipo: string;
  conteudo: string;
  contexto?: string;
  criadoEm: string;
}

export interface Viagem {
  id: string;
  colaboradorId: string;
  destino: string;
  dataInicio: string;
  dataFim: string;
  dias: number;
  valorDiaria: number;
  valorTotal: number;
  finalidade?: string;
  status: string;
}

export interface Tarefa {
  id: string;
  colaboradorId: string;
  tipo: string; // Admissão, Desligamento
  titulo: string;
  responsavel?: string;
  prazo?: string | null;
  concluida: boolean;
  concluidaEm?: string | null;
  ordem: number;
}

export interface Aceite {
  id: string;
  colaboradorId: string;
  tipo: string; // Código de Ética, PDI, Política
  referencia?: string | null;
  versao?: string;
  nomeConfirmado?: string;
  criadoEm: string;
}

export interface ConsentimentoLGPD {
  id: string;
  colaboradorId: string;
  finalidade: string;
  consentido: boolean;
  data: string;
}

export interface AccessLog {
  id: string;
  usuarioColaboradorId: string;
  usuarioNome: string;
  perfil: string;
  acao: string;
  recurso: string;
  colaboradorId?: string | null;
  detalhe?: string;
  criadoEm: string;
}

// Modelos de checklist editáveis (Painel de Controle)
export interface ModeloChecklist {
  id: string;
  tipo: string; // Admissão, Desligamento
  itens: { titulo: string; responsavel: string }[];
}

export interface Config {
  empresaNome: string;
  empresaCidade: string;
  corPrimaria: string;
  corAcento: string;
}
