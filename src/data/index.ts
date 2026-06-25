// Registro central dos dados embutidos (defaults). A camada src/lib/store.ts
// carrega estes valores na 1ª vez e depois persiste as edições no localStorage.

import type {
  Area, Nivel, Cargo, StatusColaborador, Colaborador, Documento, DocumentoInstitucional,
  GuiaComunicacao, POP, Ferias, Movimentacao, CicloAvaliacao, Avaliacao, Meta, PDI,
  Feedback, Viagem, Tarefa, ModeloChecklist, ConsentimentoLGPD, AccessLog, Aceite, Config,
  Advertencia, Ausencia, Contato, TemplateMensagem, Agendamento, ArquivoRepositorio,
  Treinamento, EtapaEvolucao, Usuario, Pagamento, ContaPlano, ClassificacaoConta, EventoCalendario,
  CertificacaoNR, Pesquisa, RespostaPesquisa, Vaga, Candidato,
} from "./types";

import { AREAS } from "./areas";
import { NIVEIS } from "./niveis";
import { CARGOS } from "./cargos";
import { STATUS } from "./status";
import { COLABORADORES } from "./colaboradores";
import { DOCUMENTOS } from "./documentos";
import { INSTITUCIONAIS } from "./institucionais";
import { GUIAS_COMUNICACAO } from "./comunicacao";
import { POPS } from "./pops";
import { FERIAS } from "./ferias";
import { MOVIMENTACOES } from "./movimentacoes";
import { CICLOS, AVALIACOES, METAS, PDIS, FEEDBACKS } from "./desempenho";
import { VIAGENS } from "./viagens";
import { TAREFAS, MODELOS_CHECKLIST } from "./integracao";
import { CONSENTIMENTOS, ACESSOS, ACEITES } from "./lgpd";
import { ADVERTENCIAS, AUSENCIAS } from "./frequencia";
import { CONTATOS, TEMPLATES, AGENDAMENTOS } from "./mensagens";
import { REPOSITORIO } from "./repositorio";
import { TREINAMENTOS } from "./treinamentos";
import { EVOLUCAO } from "./evolucao";
import { USUARIOS } from "./usuarios";
import { PAGAMENTOS } from "./pagamentos";
import { PLANO_CONTAS } from "./planoContas";
import { CLASSIFICACAO_CONTAS } from "./classificacaoContas";
import { EVENTOS_CALENDARIO } from "./eventos";
import { CERTIFICACOES_NR } from "./nrs";
import { PESQUISAS } from "./pesquisas";
import { VAGAS, CANDIDATOS } from "./vagas";

export const VERSAO_DADOS = "1.0.0";

export const CONFIG_DEFAULT: Config = {
  empresaNome: "Impresilk Comunicação Visual",
  empresaCidade: "Montes Claros/MG",
  corPrimaria: "#16334f",
  corAcento: "#c2a14d",
};

// Mapa: nome da coleção → tipo do elemento. Garante tipagem do useColecao.
export interface ColecaoMap {
  areas: Area;
  niveis: Nivel;
  cargos: Cargo;
  status: StatusColaborador;
  colaboradores: Colaborador;
  documentos: Documento;
  institucionais: DocumentoInstitucional;
  comunicacao: GuiaComunicacao;
  pops: POP;
  ferias: Ferias;
  movimentacoes: Movimentacao;
  ciclos: CicloAvaliacao;
  avaliacoes: Avaliacao;
  metas: Meta;
  pdis: PDI;
  feedbacks: Feedback;
  viagens: Viagem;
  tarefas: Tarefa;
  modelosChecklist: ModeloChecklist;
  consentimentos: ConsentimentoLGPD;
  acessos: AccessLog;
  aceites: Aceite;
  advertencias: Advertencia;
  ausencias: Ausencia;
  contatos: Contato;
  templatesMensagem: TemplateMensagem;
  agendamentos: Agendamento;
  repositorio: ArquivoRepositorio;
  treinamentos: Treinamento;
  evolucao: EtapaEvolucao;
  usuarios: Usuario;
  pagamentos: Pagamento;
  planoContas: ContaPlano;
  classificacaoCustos: ClassificacaoConta;
  eventos: EventoCalendario;
  certificacoesNr: CertificacaoNR;
  pesquisas: Pesquisa;
  respostasPesquisa: RespostaPesquisa;
  vagas: Vaga;
  candidatos: Candidato;
}

export type NomeColecao = keyof ColecaoMap;

// Defaults por coleção. A função garante uma cópia profunda a cada chamada
// (para que o "restaurar padrão" não compartilhe referências mutáveis).
export function defaultsColecoes(): { [K in NomeColecao]: ColecaoMap[K][] } {
  return structuredClone({
    areas: AREAS,
    niveis: NIVEIS,
    cargos: CARGOS,
    status: STATUS,
    colaboradores: COLABORADORES,
    documentos: DOCUMENTOS,
    institucionais: INSTITUCIONAIS,
    comunicacao: GUIAS_COMUNICACAO,
    pops: POPS,
    ferias: FERIAS,
    movimentacoes: MOVIMENTACOES,
    ciclos: CICLOS,
    avaliacoes: AVALIACOES,
    metas: METAS,
    pdis: PDIS,
    feedbacks: FEEDBACKS,
    viagens: VIAGENS,
    tarefas: TAREFAS,
    modelosChecklist: MODELOS_CHECKLIST,
    consentimentos: CONSENTIMENTOS,
    acessos: ACESSOS,
    aceites: ACEITES,
    advertencias: ADVERTENCIAS,
    ausencias: AUSENCIAS,
    contatos: CONTATOS,
    templatesMensagem: TEMPLATES,
    agendamentos: AGENDAMENTOS,
    repositorio: REPOSITORIO,
    treinamentos: TREINAMENTOS,
    evolucao: EVOLUCAO,
    usuarios: USUARIOS,
    pagamentos: PAGAMENTOS,
    planoContas: PLANO_CONTAS,
    classificacaoCustos: CLASSIFICACAO_CONTAS,
    eventos: EVENTOS_CALENDARIO,
    certificacoesNr: CERTIFICACOES_NR,
    pesquisas: PESQUISAS,
    respostasPesquisa: [],
    vagas: VAGAS,
    candidatos: CANDIDATOS,
  });
}

export const NOMES_COLECOES = Object.keys(defaultsColecoes()) as NomeColecao[];

export * from "./types";
